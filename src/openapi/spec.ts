import { z } from "zod";
import { COLLECTIONS, RESOURCES, type CollectionName } from "../api/resources.js";
import { ArcSchema } from "../schemas/arc.js";
import { ChapterSchema } from "../schemas/chapter.js";
import { CharacterSchema } from "../schemas/character.js";
import { CrewSchema } from "../schemas/crew.js";
import { DevilFruitSchema } from "../schemas/devil-fruit.js";
import { EpisodeSchema } from "../schemas/episode.js";
import { LocationSchema } from "../schemas/location.js";
import { OrganizationSchema } from "../schemas/organization.js";
import { SagaSchema } from "../schemas/saga.js";
import { ShipSchema } from "../schemas/ship.js";
import { VolumeSchema } from "../schemas/volume.js";

type JsonSchema = Record<string, any>;

export interface DatasetSummary {
  counts: Record<CollectionName, number>;
  last_chapter: number;
  last_episode: number;
}

const SOURCE_SCHEMAS: Record<CollectionName, z.ZodType> = {
  sagas: SagaSchema,
  arcs: ArcSchema,
  chapters: ChapterSchema,
  volumes: VolumeSchema,
  episodes: EpisodeSchema,
  "devil-fruits": DevilFruitSchema,
  crews: CrewSchema,
  organizations: OrganizationSchema,
  locations: LocationSchema,
  ships: ShipSchema,
  characters: CharacterSchema,
};

export const SCHEMA_NAMES: Record<CollectionName, string> = {
  sagas: "Saga",
  arcs: "Arc",
  chapters: "Chapter",
  volumes: "Volume",
  episodes: "Episode",
  "devil-fruits": "DevilFruit",
  crews: "Crew",
  organizations: "Organization",
  locations: "Location",
  ships: "Ship",
  characters: "Character",
};

const component = (name: string): JsonSchema => ({ $ref: `#/components/schemas/${name}` });
const arrayOf = (name: string): JsonSchema => ({ type: "array", items: component(name) });
const REF = component("Reference");
const REFS = arrayOf("Reference");
const RELATIONS = arrayOf("RelationReference");
const ENTITIES = arrayOf("EntityReference");

const RESPONSE_OVERRIDES: Record<CollectionName, JsonSchema> = {
  sagas: {},
  arcs: { sagas: REFS },
  chapters: { volume: REF, arcs: REFS },
  volumes: {},
  episodes: { arcs: REFS },
  "devil-fruits": { users: RELATIONS },
  crews: { captains: RELATIONS },
  organizations: { leaders: RELATIONS, affiliations: ENTITIES, residences: ENTITIES },
  locations: { parent: REF, affiliations: ENTITIES },
  ships: { affiliations: ENTITIES },
  characters: {
    affiliations: ENTITIES,
    residences: ENTITIES,
    devil_fruits: RELATIONS,
    origin: {
      type: "object",
      properties: { location: REF, region: { type: "string" } },
      additionalProperties: false,
    },
  },
};

function responseSchema(collection: CollectionName): JsonSchema {
  const schema = z.toJSONSchema(SOURCE_SCHEMAS[collection], { target: "draft-2020-12" }) as JsonSchema;
  delete schema.$schema;
  schema.properties = {
    url: { type: "string", format: "uri" },
    ...schema.properties,
    ...RESPONSE_OVERRIDES[collection],
    links: { type: "object", additionalProperties: { type: "string", format: "uri" } },
    spoiler_filter: component("SpoilerFilter"),
  };
  const redacted = new Set<string>(RESOURCES[collection].redact);
  schema.required = ["url", ...(schema.required as string[]).filter((name) => !redacted.has(name))];

  const bountyItems = schema.properties.bounties?.items as JsonSchema | undefined;
  if (bountyItems?.required) {
    // The current/former status is hidden while a spoiler filter is active.
    bountyItems.required = (bountyItems.required as string[]).filter((name) => name !== "status");
  }
  return schema;
}

const pagedSchema = (items: JsonSchema): JsonSchema => ({
  type: "object",
  required: ["count", "next", "previous", "results"],
  additionalProperties: false,
  properties: {
    count: { type: "integer", minimum: 0 },
    next: { type: ["string", "null"], format: "uri" },
    previous: { type: ["string", "null"], format: "uri" },
    results: { type: "array", items },
  },
});

const parameter = (
  name: string,
  schema: JsonSchema,
  description: string,
  location: "query" | "path" = "query",
): JsonSchema => ({
  name,
  in: location,
  ...(location === "path" ? { required: true } : {}),
  description,
  schema,
});

const PAGE = parameter("page", { type: "integer", minimum: 1, default: 1 }, "Page number.");
const LIMIT = parameter("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }, "Items per page.");
const UNTIL = parameter(
  "until_chapter",
  { type: "integer", minimum: 0 },
  "Hide anything that cannot be confirmed as known at this manga chapter.",
);

const errors = (...statuses: number[]): JsonSchema =>
  Object.fromEntries(
    statuses.map((status) => [
      String(status),
      {
        description: { 400: "Invalid request", 404: "Not found", 429: "Rate limit exceeded" }[status],
        content: { "application/problem+json": { schema: component("Problem") } },
      },
    ]),
  );

const success = (schema: JsonSchema, description = "Successful response"): JsonSchema => ({
  "200": {
    description,
    headers: {
      ETag: { schema: { type: "string" } },
      Link: { description: "Attribution and license.", schema: { type: "string" } },
    },
    content: { "application/json": { schema } },
  },
  "304": { description: "Not modified" },
});

function filterSchema(collection: CollectionName, name: string, properties: JsonSchema): JsonSchema {
  const property = properties[name] as JsonSchema | undefined;
  const values = property?.enum ?? property?.items?.enum;
  return values ? { type: "string", enum: values } : { type: "string" };
}

function subresourceSchema(name: string): JsonSchema {
  if (name === "bounties") return component("Bounty");
  if (name === "affiliations") return component("EntityReference");
  if (["members", "users", "residents", "ships", "devil-fruits"].includes(name)) {
    return component("RelationReference");
  }
  return REF;
}

function idParameter(collection: CollectionName): JsonSchema {
  const descriptions: Partial<Record<CollectionName, string>> = {
    chapters: "Chapter number, for example 1000.",
    volumes: "Volume number, for example 99.",
    episodes: "Episode number, or special-N for specials.",
  };
  return parameter("id", { type: "string" }, descriptions[collection] ?? "Resource slug.", "path");
}

export function createOpenApiDocument(summary: DatasetSummary): JsonSchema {
  const schemas: JsonSchema = {
    Reference: {
      type: "object",
      required: ["name", "url"],
      additionalProperties: false,
      properties: { name: { type: "string" }, url: { type: "string", format: "uri" } },
    },
    RelationReference: {
      type: "object",
      required: ["name", "url", "status"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        url: { type: "string", format: "uri" },
        status: { type: "string", enum: ["current", "former"] },
        canon: { type: "string", enum: ["manga", "anime_only", "movie", "other"] },
      },
    },
    EntityReference: {
      type: "object",
      required: ["type", "name", "url", "status"],
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["crew", "organization", "location"] },
        name: { type: "string" },
        url: { type: "string", format: "uri" },
        status: { type: "string", enum: ["current", "former"] },
        canon: { type: "string", enum: ["manga", "anime_only", "movie", "other"] },
      },
    },
    SpoilerFilter: {
      type: "object",
      required: ["until_chapter", "redacted"],
      additionalProperties: false,
      properties: {
        until_chapter: { type: "integer", minimum: 0 },
        redacted: { type: "array", items: { type: "string" } },
      },
    },
    SearchResult: {
      type: "object",
      required: ["type", "name", "url"],
      additionalProperties: false,
      properties: {
        type: { type: "string", enum: [...COLLECTIONS] },
        name: { type: "string" },
        url: { type: "string", format: "uri" },
      },
    },
    AttributionEntry: {
      type: "object",
      required: ["name", "url", "source_url"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        url: { type: "string", format: "uri" },
        source_url: { type: "string", format: "uri" },
      },
    },
    Problem: {
      type: "object",
      required: ["type", "title", "status"],
      properties: {
        type: { type: "string" },
        title: { type: "string" },
        status: { type: "integer" },
        detail: { type: "string" },
        instance: { type: "string" },
      },
    },
  };

  for (const collection of COLLECTIONS) schemas[SCHEMA_NAMES[collection]] = responseSchema(collection);
  schemas.Bounty = (schemas.Character as JsonSchema).properties.bounties.items;

  const paths: JsonSchema = {
    "/api/v1": {
      get: {
        operationId: "getIndex",
        tags: ["general"],
        summary: "API index",
        responses: success({ type: "object" }),
      },
    },
    "/api/v1/openapi.json": {
      get: {
        operationId: "getOpenApi",
        tags: ["general"],
        summary: "OpenAPI document",
        responses: success({ type: "object" }),
      },
    },
    "/api/v1/search": {
      get: {
        operationId: "search",
        tags: ["search"],
        summary: "Search across all resources",
        parameters: [
          { ...parameter("q", { type: "string", minLength: 1 }, "Search text."), required: true },
          parameter("type", { type: "string", enum: [...COLLECTIONS] }, "Limit results to one resource."),
          PAGE,
          LIMIT,
          UNTIL,
        ],
        responses: { ...success(pagedSchema(component("SearchResult"))), ...errors(400, 429) },
      },
    },
    "/api/v1/attribution": {
      get: {
        operationId: "getAttribution",
        tags: ["attribution"],
        summary: "Data license and attribution",
        responses: success({ type: "object" }),
      },
    },
    "/api/v1/attribution/{collection}": {
      get: {
        operationId: "listAttribution",
        tags: ["attribution"],
        summary: "Source articles for one resource",
        parameters: [
          parameter("collection", { type: "string", enum: [...COLLECTIONS] }, "Resource name.", "path"),
          PAGE,
          LIMIT,
        ],
        responses: { ...success(pagedSchema(component("AttributionEntry"))), ...errors(400, 404) },
      },
    },
  };

  for (const collection of COLLECTIONS) {
    const definition = RESOURCES[collection];
    const schemaName = SCHEMA_NAMES[collection];
    const properties = (schemas[schemaName] as JsonSchema).properties as JsonSchema;
    const sortValues = Object.keys(definition.sorts).flatMap((name) => [name, `-${name}`]);
    const spoiler = definition.supportsSpoilerFilter ? [UNTIL] : [];

    paths[`/api/v1/${collection}`] = {
      get: {
        operationId: `list:${collection}`,
        tags: [collection],
        summary: `List ${collection}`,
        parameters: [
          PAGE,
          LIMIT,
          parameter("sort", { type: "string", enum: sortValues }, "Sort field. Prefix with - for descending."),
          ...spoiler,
          ...Object.keys(definition.filters).map((name) =>
            parameter(name, filterSchema(collection, name, properties), `Filter by ${name}.`),
          ),
        ],
        responses: { ...success(pagedSchema(REF)), ...errors(400, 429) },
      },
    };
    paths[`/api/v1/${collection}/{id}`] = {
      get: {
        operationId: `get:${collection}`,
        tags: [collection],
        summary: `Get one of ${collection}`,
        parameters: [idParameter(collection), ...spoiler],
        responses: { ...success(component(schemaName)), ...errors(400, 404) },
      },
    };
    for (const [name, rule] of Object.entries(definition.subresources)) {
      paths[`/api/v1/${collection}/{id}/${name}`] = {
        get: {
          operationId: `list:${collection}:${name}`,
          tags: [collection],
          summary: `List ${name}`,
          parameters: [idParameter(collection), PAGE, LIMIT, ...(rule.spoilerSafe ? [UNTIL] : [])],
          responses: { ...success(pagedSchema(subresourceSchema(name))), ...errors(400, 404) },
        },
      };
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "DenDen API",
      version: "1.0.0",
      summary: "Unofficial, read-only REST API for One Piece data.",
      license: { name: "BSD-3-Clause", identifier: "BSD-3-Clause" },
      "x-data-license": "CC BY-SA 3.0",
      "x-dataset": summary,
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "general" },
      { name: "search" },
      ...COLLECTIONS.map((name) => ({ name })),
      { name: "attribution" },
    ],
    paths,
    components: { schemas },
  };
}
