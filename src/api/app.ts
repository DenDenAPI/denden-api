import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { Glossary } from "../schemas/glossary.js";
import { canonicalRegion, labelCatalog, localizeBody, localizeItems, localizeReferences } from "./i18n.js";
import type { Covers, Ports, QueryResult } from "./ports.js";
import {
  isCollection,
  normalizeId,
  RESOURCES,
  type CollectionName,
  type ResourceDefinition,
} from "./resources.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Json = Record<string, unknown>;

interface DetailDocument {
  first_chapter: number | null;
  body: Json;
}

interface ListDocument {
  items: { first_chapter: number | null; item: Json }[];
}

class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 405 | 429,
    readonly title: string,
    readonly detail: string,
  ) {
    super(detail);
  }
}

function notFound(detail = "The requested resource does not exist."): ApiError {
  return new ApiError(404, "Not Found", detail);
}

function badRequest(detail: string): ApiError {
  return new ApiError(400, "Bad Request", detail);
}

/** Parameters that say how to show the data, not which data to return, so every URL in a response keeps them. */
interface ViewContext {
  lang?: string;
  untilChapter?: string;
}

function viewContext(requestUrl: string): ViewContext {
  const params = new URL(requestUrl).searchParams;
  const lang = params.get("lang");
  const untilChapter = params.get("until_chapter");
  return {
    ...(lang && lang !== "en" ? { lang } : {}),
    ...(untilChapter !== null ? { untilChapter } : {}),
  };
}

const API_PATH = /^\/api\/v1\/([a-z-]+)(?:\/[^/?]+(?:\/([a-z-]+))?)?$/;

/** Adds the view parameters that the target endpoint accepts. A URL that already has a query is a page link built from the request. */
function withView(url: string, context: ViewContext): string {
  const match = API_PATH.exec(url);
  if (!match) return url;
  const [, collection, subresource] = match as unknown as [string, string, string | undefined];
  const params = new URLSearchParams();
  if (isCollection(collection)) {
    const definition = RESOURCES[collection];
    const spoilerSafe = subresource
      ? definition.subresources[subresource]?.spoilerSafe
      : definition.supportsSpoilerFilter;
    if (context.untilChapter !== undefined && spoilerSafe) params.set("until_chapter", context.untilChapter);
    if (context.lang) params.set("lang", context.lang);
  } else if (collection === "labels" && context.lang) {
    params.set("lang", context.lang);
  }
  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

function withOrigin(value: unknown, origin: string, context: ViewContext): unknown {
  if (typeof value === "string") return value.startsWith("/api/") ? `${origin}${withView(value, context)}` : value;
  if (Array.isArray(value)) return value.map((item) => withOrigin(item, origin, context));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withOrigin(item, origin, context)]),
    );
  }
  return value;
}

async function etagOf(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `"${hex.slice(0, 32)}"`;
}

async function sendJson(c: Context, value: unknown): Promise<Response> {
  const origin = new URL(c.req.url).origin;
  const body = JSON.stringify(withOrigin(value, origin, viewContext(c.req.url)));
  const etag = await etagOf(body);
  c.header("ETag", etag);
  c.header("Cache-Control", "public, max-age=3600");
  if (c.req.header("If-None-Match") === etag) return c.body(null, 304);
  c.header("Content-Type", "application/json; charset=utf-8");
  return c.body(body, 200);
}

function singleParams(c: Context, allowed: Set<string>): URLSearchParams {
  const params = new URL(c.req.url).searchParams;
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key)) {
      throw badRequest(`Unknown query parameter "${key}". Allowed: ${[...allowed].sort().join(", ")}.`);
    }
    if (params.getAll(key).length > 1) throw badRequest(`Query parameter "${key}" must appear only once.`);
  }
  return params;
}

function integerParam(params: URLSearchParams, name: string, minimum: number): number | undefined {
  const raw = params.get(name);
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < minimum) {
    throw badRequest(`"${name}" must be an integer greater than or equal to ${minimum}.`);
  }
  return Number(raw);
}

function pagination(params: URLSearchParams): { page: number; limit: number; offset: number } {
  const page = integerParam(params, "page", 1) ?? 1;
  const limit = integerParam(params, "limit", 1) ?? DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) throw badRequest(`"limit" must not exceed ${MAX_LIMIT}.`);
  return { page, limit, offset: (page - 1) * limit };
}

function pageUrl(c: Context, page: number): string {
  const url = new URL(c.req.url);
  url.searchParams.set("page", String(page));
  return `${url.pathname}${url.search}`;
}

function paginated(c: Context, count: number, page: number, limit: number, results: unknown[]): Json {
  return {
    count,
    next: page * limit < count ? pageUrl(c, page + 1) : null,
    previous: page > 1 && count > 0 ? pageUrl(c, Math.min(page - 1, Math.ceil(count / limit))) : null,
    results,
  };
}

export function createApp({ assets, queries, rateLimiter }: Ports): Hono {
  const app = new Hono();

  const lastChapter = async (): Promise<number> => {
    const index = (await assets.get("v1/index")) as { data: { last_chapter: number } } | null;
    if (!index) throw new Error("Dataset index is missing");
    return index.data.last_chapter;
  };

  const spoilerLimit = async (params: URLSearchParams): Promise<number | undefined> => {
    const value = integerParam(params, "until_chapter", 0);
    if (value === undefined) return undefined;
    const last = await lastChapter();
    if (value > last) throw badRequest(`"until_chapter" must not exceed the latest chapter (${last}).`);
    return value;
  };

  let glossary: Promise<Glossary | null> | undefined;

  /** Returns the Spanish glossary when requested, or undefined for the default English response. */
  const requestedGlossary = async (c: Context, params: URLSearchParams): Promise<Glossary | null | undefined> => {
    const lang = params.get("lang");
    if (lang === null || lang === "en") return undefined;
    if (lang !== "es") throw badRequest('"lang" must be "en" or "es".');
    c.header("Content-Language", "es");
    glossary ??= assets.get("v1/i18n/es") as Promise<Glossary | null>;
    return glossary;
  };

  const enforceRateLimit = async (c: Context): Promise<void> => {
    const key = c.req.header("cf-connecting-ip") ?? "local";
    if (!(await rateLimiter.allow(key))) {
      c.header("Retry-After", "60");
      throw new ApiError(429, "Too Many Requests", "Rate limit exceeded. Try again in a minute.");
    }
  };

  const requireSpoilerSupport = (definition: ResourceDefinition, collection: string, maxChapter?: number) => {
    if (maxChapter !== undefined && !definition.supportsSpoilerFilter) {
      throw badRequest(`"until_chapter" is not supported for ${collection} yet.`);
    }
  };

  let covers: Promise<Covers> | undefined;
  const coverMap = (): Promise<Covers> => {
    covers ??= assets.get("v1/covers").then((document) => (document ?? {}) as Covers);
    return covers;
  };

  /** Shows a character's cover name (Kyoshiro) instead of the real one (Denjiro) while the reader cannot know it. */
  const withCovers = async <T>(value: T, maxChapter: number | undefined): Promise<T> => {
    if (maxChapter === undefined) return value;
    return coverReferences(value, await coverMap(), maxChapter) as T;
  };

  const resultRows = (result: QueryResult) =>
    result.rows.map((row) => ({ name: row.name, url: `/api/v1/${row.collection}/${row.id}` }));

  app.use("*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"], exposeHeaders: ["ETag", "Link", "Retry-After"] }));
  app.use("*", async (c, next) => {
    c.header("Link", `<${new URL(c.req.url).origin}/api/v1/attribution>; rel="license"`);
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      c.header("Allow", "GET, HEAD, OPTIONS");
      throw new ApiError(405, "Method Not Allowed", "This API is read-only.");
    }
    await next();
  });

  app.get("/", (c) => c.redirect("/api/v1", 302));

  app.get("/api/v1", async (c) => {
    singleParams(c, new Set());
    return sendJson(c, await assets.get("v1/index"));
  });

  app.get("/api/v1/openapi.json", async (c) => {
    singleParams(c, new Set());
    return sendJson(c, await assets.get("v1/openapi"));
  });

  app.get("/api/v1/labels", async (c) => {
    const params = singleParams(c, new Set(["lang"]));
    return sendJson(c, labelCatalog(await requestedGlossary(c, params)));
  });

  app.get("/api/v1/attribution", async (c) => {
    singleParams(c, new Set());
    return sendJson(c, await assets.get("v1/attribution"));
  });

  app.get("/api/v1/attribution/:collection", async (c) => {
    const collection = c.req.param("collection");
    if (!isCollection(collection)) throw notFound();
    const params = singleParams(c, new Set(["page", "limit"]));
    const { page, limit, offset } = pagination(params);
    const document = (await assets.get(`v1/attribution/${collection}`)) as ListDocument | null;
    if (!document) throw notFound();
    const results = document.items.slice(offset, offset + limit).map(({ item }) => item);
    return sendJson(c, paginated(c, document.items.length, page, limit, results));
  });

  app.get("/api/v1/search", async (c) => {
    const params = singleParams(c, new Set(["q", "type", "page", "limit", "until_chapter", "lang"]));
    const translations = await requestedGlossary(c, params);
    const terms = (params.get("q") ?? "").trim().split(/\s+/u).filter(Boolean).slice(0, 8);
    if (terms.length === 0) throw badRequest('"q" is required.');
    if (terms.some((term) => term.length > 64)) throw badRequest('"q" terms must not exceed 64 characters.');

    const type = params.get("type");
    if (type !== null && !isCollection(type)) throw badRequest(`Unknown type "${type}".`);
    const maxChapter = await spoilerLimit(params);
    if (type) requireSpoilerSupport(RESOURCES[type], type, maxChapter);
    const { page, limit, offset } = pagination(params);

    await enforceRateLimit(c);
    const result = await queries.search({
      terms,
      limit,
      offset,
      ...(type ? { collection: type } : {}),
      ...(maxChapter !== undefined ? { maxChapter } : {}),
    });
    const results = result.rows.map((row) => ({
      type: row.collection,
      name: row.name,
      url: `/api/v1/${row.collection}/${row.id}`,
    }));
    const localized = translations === undefined ? results : (localizeReferences(results, translations) as unknown[]);
    return sendJson(c, paginated(c, result.count, page, limit, localized));
  });

  app.get("/api/v1/:collection", async (c) => {
    const collection = c.req.param("collection");
    if (!isCollection(collection)) throw notFound();
    const definition = RESOURCES[collection];
    const filterNames = Object.keys(definition.filters);
    const params = singleParams(c, new Set(["page", "limit", "sort", "until_chapter", "lang", ...filterNames]));
    const translations = await requestedGlossary(c, params);
    const { page, limit, offset } = pagination(params);
    const maxChapter = await spoilerLimit(params);
    requireSpoilerSupport(definition, collection, maxChapter);

    const filters: { facet: string; value: string }[] = [];
    for (const name of filterNames) {
      const value = params.get(name);
      if (value === null) continue;
      if (value === "" || value.length > 100) throw badRequest(`"${name}" has an invalid value.`);
      if (maxChapter !== undefined && !definition.filters[name]?.spoilerSafe) {
        throw badRequest(`Filter "${name}" cannot be combined with "until_chapter" because it may reveal spoilers.`);
      }
      filters.push({ facet: name, value: name === "region" ? canonicalRegion(translations, value) : value });
    }

    const rawSort = params.get("sort");
    const descending = rawSort?.startsWith("-") ?? false;
    const sortName = rawSort?.replace(/^-/, "");
    const column = sortName === undefined ? definition.defaultSort : definition.sorts[sortName];
    if (!column) {
      throw badRequest(`Unknown sort "${sortName}". Allowed: ${Object.keys(definition.sorts).join(", ")}.`);
    }
    if (maxChapter !== undefined && column === "bounty") {
      throw badRequest('Sorting by "bounty" cannot be combined with "until_chapter" because it may reveal spoilers.');
    }

    await enforceRateLimit(c);
    const result = await queries.list({
      collection,
      filters,
      sort: { column, direction: descending ? "desc" : "asc" },
      limit,
      offset,
      ...(maxChapter !== undefined ? { maxChapter } : {}),
      ...(translations !== undefined ? { language: "es" as const } : {}),
    });
    const rows = resultRows(result);
    const localized = translations === undefined ? rows : (localizeReferences(rows, translations) as unknown[]);
    return sendJson(c, paginated(c, result.count, page, limit, localized));
  });

  const resourcePath = (collection: CollectionName, rawId: string): string => {
    const id = normalizeId(collection, rawId);
    if (!ID_PATTERN.test(id)) throw notFound();
    return `v1/${collection}/${id}`;
  };

  app.get("/api/v1/:collection/:id", async (c) => {
    const collection = c.req.param("collection");
    if (!isCollection(collection)) throw notFound();
    const definition = RESOURCES[collection];
    const params = singleParams(c, new Set(["until_chapter", "lang"]));
    const translations = await requestedGlossary(c, params);
    const maxChapter = await spoilerLimit(params);
    requireSpoilerSupport(definition, collection, maxChapter);

    const document = (await assets.get(resourcePath(collection, c.req.param("id")))) as DetailDocument | null;
    if (!document) throw notFound();
    if (maxChapter !== undefined && (document.first_chapter === null || document.first_chapter > maxChapter)) {
      throw notFound();
    }
    let body = maxChapter === undefined ? document.body : redact(definition, document.body, maxChapter);
    if (maxChapter !== undefined) {
      body = await withCovers(body, maxChapter);
      const id = normalizeId(collection, c.req.param("id"));
      const cover = collection === "characters" ? (await coverMap())[id] : undefined;
      if (cover && cover.until >= maxChapter) body = coverBody(body, cover);
    }
    return sendJson(c, localizeBody(collection, body, translations));
  });

  app.get("/api/v1/:collection/:id/:subresource", async (c) => {
    const collection = c.req.param("collection");
    if (!isCollection(collection)) throw notFound();
    const definition = RESOURCES[collection];
    const name = c.req.param("subresource");
    const rule = definition.subresources[name];
    if (!rule) throw notFound();

    const params = singleParams(c, new Set(["page", "limit", "until_chapter", "lang"]));
    const translations = await requestedGlossary(c, params);
    const { page, limit, offset } = pagination(params);
    const maxChapter = await spoilerLimit(params);
    if (maxChapter !== undefined && !rule.spoilerSafe) {
      throw badRequest(`"${name}" cannot be combined with "until_chapter" because it may reveal spoilers.`);
    }

    const path = resourcePath(collection, c.req.param("id"));
    const parent = (await assets.get(path)) as DetailDocument | null;
    if (!parent) throw notFound();
    if (maxChapter !== undefined && (parent.first_chapter === null || parent.first_chapter > maxChapter)) {
      throw notFound();
    }

    const document = (await assets.get(`${path}/${name}`)) as ListDocument | null;
    const visible = (document?.items ?? []).filter(
      ({ first_chapter }) =>
        maxChapter === undefined || (first_chapter !== null && first_chapter <= maxChapter),
    );
    const results = await withCovers(
      visible.slice(offset, offset + limit).map(({ item }) => item),
      maxChapter,
    );
    return sendJson(c, paginated(c, visible.length, page, limit, localizeItems(results, translations)));
  });

  app.notFound((c) => problem(c, notFound()));
  app.onError((error, c) => {
    if (error instanceof ApiError) return problem(c, error);
    console.error(error);
    return c.body(
      JSON.stringify({ type: "about:blank", title: "Internal Server Error", status: 500 }),
      500,
      { "Content-Type": "application/problem+json" },
    );
  });

  return app;
}

function problem(c: Context, error: ApiError): Response {
  return c.body(
    JSON.stringify({
      type: "about:blank",
      title: error.title,
      status: error.status,
      detail: error.detail,
      instance: new URL(c.req.url).pathname,
    }),
    error.status,
    { "Content-Type": "application/problem+json" },
  );
}

const CHARACTER_URL = /^\/api\/v1\/characters\/([a-z0-9-]+)$/;

/** Renames every reference to a character that is still known by a cover name. */
function coverReferences(value: unknown, covers: Covers, maxChapter: number): unknown {
  if (Array.isArray(value)) return value.map((item) => coverReferences(item, covers, maxChapter));
  if (!value || typeof value !== "object") return value;
  const copy = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, coverReferences(item, covers, maxChapter)]),
  ) as Json;
  const id = typeof copy.url === "string" ? CHARACTER_URL.exec(copy.url)?.[1] : undefined;
  const cover = id ? covers[id] : undefined;
  if (cover && cover.until >= maxChapter && typeof copy.name === "string") copy.name = cover.name.en;
  return copy;
}

/** The cover name replaces the record name and leaves the alias list. */
function coverBody(body: Json, cover: Covers[string]): Json {
  const copy: Json = { ...body, name: cover.name };
  if (Array.isArray(copy.aliases)) {
    const aliases = (copy.aliases as { en: string }[]).filter((alias) => alias.en !== cover.name.en);
    if (aliases.length > 0) copy.aliases = aliases;
    else delete copy.aliases;
  }
  return copy;
}

/** First chapter set after the two-year timeskip. */
const POST_TIMESKIP_CHAPTER = 598;

/** Values from an unspecified period ("other") cannot be placed on the timeline. */
function isPeriodKnown(period: string, maxChapter: number): boolean {
  if (period === "debut" || period === "pre_timeskip") return true;
  return period === "post_timeskip" && maxChapter >= POST_TIMESKIP_CHAPTER;
}

function redact(definition: ResourceDefinition, body: Json, maxChapter: number): Json {
  const copy: Json = { ...body };
  const isRevealed = (chapter: unknown) => typeof chapter === "number" && chapter <= maxChapter;

  for (const field of definition.redact) {
    if (!(field in copy)) continue;
    const value = copy[field];
    if (field === "status" && isRevealed(copy.status_revealed_chapter)) continue;
    if (field === "origin") {
      const origin = value as { region?: string; revealed_chapter?: number; region_revealed_chapter?: number };
      if (isRevealed(origin.revealed_chapter)) continue;
      // The region alone, while the place is still unknown.
      if (origin.region && isRevealed(origin.region_revealed_chapter)) {
        copy.origin = { region: origin.region, region_revealed_chapter: origin.region_revealed_chapter };
        continue;
      }
    }
    if (Array.isArray(value)) {
      const items = value as { revealed_chapter?: number; canon?: string; status?: string; cover_until?: number }[];
      // The current/former status can reveal a later departure, so it stays hidden.
      // `cover_until` would tell when a false name is exposed, so it stays hidden too.
      const visible = items
        .filter((item) => !item.canon && isRevealed(item.revealed_chapter))
        .map(({ status: _status, cover_until: _cover, ...item }) => item);
      if (visible.length > 0) copy[field] = visible;
      else delete copy[field];
      continue;
    }
    delete copy[field];
  }
  delete copy.status_revealed_chapter;

  if (Array.isArray(copy.bounties)) {
    const bounties = copy.bounties as { revealed_chapter?: number; canon?: string; status: string }[];
    const visible = bounties
      .filter((item) => !item.canon && item.revealed_chapter !== undefined && item.revealed_chapter <= maxChapter)
      .map(({ status: _status, ...item }) => item);
    if (visible.length > 0) copy.bounties = visible;
    else delete copy.bounties;
  }

  for (const field of ["ages", "heights"]) {
    const items = copy[field];
    if (!Array.isArray(items)) continue;
    const visible = (items as { period: string; revealed_chapter?: number }[]).filter((item) =>
      item.revealed_chapter !== undefined
        ? item.revealed_chapter <= maxChapter
        : isPeriodKnown(item.period, maxChapter),
    );
    if (visible.length > 0) copy[field] = visible;
    else delete copy[field];
  }

  const identity = copy.revealed_identity as { chapter: number } | undefined;
  if (identity && identity.chapter > maxChapter) delete copy.revealed_identity;

  if (copy.links && typeof copy.links === "object") {
    const links = Object.entries(copy.links).filter(([name]) => definition.subresources[name]?.spoilerSafe);
    if (links.length > 0) {
      copy.links = Object.fromEntries(links);
    } else {
      delete copy.links;
    }
  }

  // The list is the same for every record, so it cannot reveal what a record is hiding.
  copy.spoiler_filter = {
    until_chapter: maxChapter,
    redacted: [...definition.redact, ...(definition.timelineFields ?? [])],
  };
  return copy;
}
