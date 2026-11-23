import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import { MemoryRateLimiter, sqliteRunner } from "../adapters/node.js";
import { SqlQueryStore } from "../adapters/sql-query-store.js";
import { buildOutput } from "../build/model.js";
import { insertStatements, SCHEMA } from "../build/sql.js";
import type { Dataset } from "../data/validate.js";
import type { Attribution } from "../schemas/attribution.js";
import { createApp } from "./app.js";
import type { Ports } from "./ports.js";
import { COLLECTIONS } from "./resources.js";

const span = (start: number, end: number | null) => ({
  count: end === null ? null : end - start + 1,
  ranges: [{ start, end }],
});

const dataset: Dataset = {
  sagas: [{ slug: "first-saga", order: 1, name: { en: "First Saga" }, chapters: span(1, 10) }],
  arcs: [
    {
      slug: "first-arc",
      order: 1,
      name: { en: "First Arc" },
      kind: "story",
      canon: "manga",
      sagas: ["first-saga"],
      chapters: span(1, 3),
    },
    {
      slug: "late-arc",
      order: 2,
      name: { en: "Late Arc" },
      kind: "story",
      canon: "manga",
      sagas: ["first-saga"],
      chapters: span(4, 10),
    },
  ],
  chapters: Array.from({ length: 10 }, (_, index) => ({
    slug: `chapter-${index + 1}`,
    number: index + 1,
    name: { en: `Chapter ${index + 1}` },
  })),
  volumes: [{ slug: "volume-1", number: 1, name: { en: "Volume One" }, chapters: { start: 1, end: 10 } }],
  episodes: [
    { slug: "episode-1", number: 1, kind: "regular", name: { en: "Episode One" }, canon: "manga" },
  ],
  "devil-fruits": [
    {
      slug: "test-fruit",
      name: { en: "Test Fruit", romaji: "Tesuto no Mi" },
      type: "paramecia",
      revealed_identity: { chapter: 5, name: { en: "Secret Fruit" }, type: "zoan", sub_type: "mythical" },
      canon: "manga",
      first_appearance: { chapter: 1 },
      users: [{ character: "hero", status: "current" }],
    },
  ],
  crews: [
    {
      slug: "test-pirates",
      name: { en: "Test Pirates" },
      canon: "manga",
      first_appearance: { chapter: 1 },
      captains: [{ character: "hero", status: "current" }],
    },
  ],
  organizations: [],
  locations: [
    { slug: "test-island", name: { en: "Test Island" }, canon: "manga", first_appearance: { chapter: 1 }, affiliations: [] },
  ],
  ships: [
    {
      slug: "test-ship",
      name: { en: "Test Ship" },
      canon: "manga",
      first_appearance: { chapter: 2 },
      affiliations: [{ type: "crew", slug: "test-pirates", status: "current" }],
    },
  ],
  characters: [
    {
      slug: "hero",
      name: { en: "Hero" },
      canon: "manga",
      gender: "male",
      status: "alive",
      first_appearance: { chapter: 1 },
      aliases: [{ en: "Secret King" }],
      affiliations: [{ type: "crew", slug: "test-pirates", status: "current" }],
      ages: [
        { years: 17, period: "debut" },
        { years: 19, period: "post_timeskip" },
        { years: 40, period: "other" },
      ],
      heights: [{ cm: 180, period: "post_timeskip" }],
      bounties: [
        { amount: 100, status: "former", revealed_chapter: 2 },
        { amount: 900, status: "current", revealed_chapter: 8 },
      ],
    },
    {
      slug: "mate",
      name: { en: "Mate" },
      canon: "manga",
      status: "alive",
      status_revealed_chapter: 2,
      first_appearance: { chapter: 2 },
      aliases: [{ en: "Early Alias", revealed_chapter: 2 }, { en: "Late Alias", revealed_chapter: 8 }, { en: "Unknown Alias" }],
      occupations: [{ name: "Cook", status: "former", revealed_chapter: 2 }],
      origin: { region: "East Blue", revealed_chapter: 3 },
      ages: [{ years: 38, period: "other", revealed_chapter: 3 }],
      affiliations: [{ type: "crew", slug: "test-pirates", status: "former", revealed_chapter: 2 }],
    },
    {
      slug: "villain",
      name: { en: "Villain" },
      canon: "manga",
      gender: "female",
      status: "deceased",
      first_appearance: { chapter: 7 },
      bounties: [{ amount: 500, status: "current", revealed_chapter: 7 }],
    },
  ],
};

function articles(): Attribution["articles"] {
  return Object.fromEntries(
    COLLECTIONS.map((name) => [
      name,
      Object.fromEntries(dataset[name].map((record) => [record.slug, `https://example.com/${record.slug}`])),
    ]),
  ) as Attribution["articles"];
}

let ports: Ports;
const request = (path: string, init?: RequestInit) =>
  createApp(ports).request(`https://api.test${path}`, init);
const json = async (path: string) => (await request(path)).json() as Promise<Record<string, any>>;

beforeAll(() => {
  const output = buildOutput(dataset, {
    license: "CC BY-SA 3.0",
    license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
    notice: "Test notice",
    articles: articles(),
  });
  const database = new DatabaseSync(":memory:");
  database.exec(SCHEMA);
  for (const statement of insertStatements(output)) database.exec(statement);
  ports = {
    assets: { get: async (path) => structuredClone(output.documents.get(path) ?? null) },
    queries: new SqlQueryStore(sqliteRunner(database)),
    rateLimiter: new MemoryRateLimiter(10_000),
  };
});

describe("REST API", () => {
  it("serves a record with absolute relation URLs", async () => {
    const body = await json("/api/v1/characters/hero");
    expect(body.url).toBe("https://api.test/api/v1/characters/hero");
    expect(body.affiliations[0]).toMatchObject({
      type: "crew",
      name: "Test Pirates",
      url: "https://api.test/api/v1/crews/test-pirates",
    });
    expect(body.devil_fruits[0].name).toBe("Test Fruit");
  });

  it("accepts numeric and slug ids for chapters", async () => {
    expect((await json("/api/v1/chapters/2")).slug).toBe("chapter-2");
    expect((await json("/api/v1/chapters/chapter-2")).slug).toBe("chapter-2");
  });

  it("paginates collections", async () => {
    const body = await json("/api/v1/chapters?limit=3&page=2");
    expect(body.count).toBe(10);
    expect(body.results.map((item: { name: string }) => item.name)).toEqual(["Chapter 4", "Chapter 5", "Chapter 6"]);
    expect(body.next).toBe("https://api.test/api/v1/chapters?limit=3&page=3");
    expect(body.previous).toBe("https://api.test/api/v1/chapters?limit=3&page=1");
  });

  it("filters and sorts collections", async () => {
    const female = await json("/api/v1/characters?gender=female");
    expect(female.results.map((item: { name: string }) => item.name)).toEqual(["Villain"]);
    const sorted = await json("/api/v1/characters?sort=-bounty");
    expect(sorted.results[0].name).toBe("Hero");
    const crew = await json("/api/v1/characters?crew=test-pirates");
    expect(crew.count).toBe(1);
  });

  it("serves relations as subresources", async () => {
    const members = await json("/api/v1/crews/test-pirates/members");
    expect(members.results[0]).toMatchObject({ name: "Hero", status: "current" });
    const bounties = await json("/api/v1/characters/hero/bounties");
    expect(bounties.results.map((item: { amount: number }) => item.amount)).toEqual([100, 900]);
    expect((await json("/api/v1/volumes/1/chapters?limit=1")).count).toBe(10);
  });

  it("publishes an OpenAPI document covering every resource", async () => {
    const spec = await json("/api/v1/openapi.json");
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info["x-dataset"].counts.characters).toBe(3);
    for (const collection of COLLECTIONS) {
      expect(spec.paths[`/api/v1/${collection}`]).toBeDefined();
      expect(spec.paths[`/api/v1/${collection}/{id}`]).toBeDefined();
    }
    expect(spec.paths["/api/v1/crews/{id}/members"]).toBeDefined();
  });

  it("orders saga arcs by story order", () => {
    const output = buildOutput(
      { ...dataset, arcs: [...dataset.arcs].reverse() },
      {
        license: "CC BY-SA 3.0",
        license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
        notice: "Test notice",
        articles: articles(),
      },
    );
    const document = output.documents.get("v1/sagas/first-saga/arcs") as {
      items: { item: { name: string } }[];
    };
    expect(document.items.map(({ item }) => item.name)).toEqual(["First Arc", "Late Arc"]);
  });

  it("searches names and aliases", async () => {
    const body = await json("/api/v1/search?q=secret");
    const names = body.results.map((item: { name: string }) => item.name);
    expect(names).toContain("Hero");
    expect(names).toContain("Test Fruit");
  });

  it("returns RFC 9457 errors", async () => {
    const response = await request("/api/v1/characters?unknown=1");
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(await response.json()).toMatchObject({ status: 400, title: "Bad Request" });
    expect((await request("/api/v1/characters/nobody")).status).toBe(404);
    expect((await request("/api/v1/characters/..%2Fsecret")).status).toBe(404);
    expect((await request("/api/v1/characters", { method: "POST" })).status).toBe(405);
  });

  it("supports conditional requests", async () => {
    const first = await request("/api/v1/characters/hero");
    const etag = first.headers.get("etag") as string;
    const second = await request("/api/v1/characters/hero", { headers: { "If-None-Match": etag } });
    expect(second.status).toBe(304);
  });

  it("sends CORS and attribution headers", async () => {
    const response = await request("/api/v1/characters/hero", { headers: { Origin: "https://app.test" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("link")).toBe('<https://api.test/api/v1/attribution>; rel="license"');
    const source = await json("/api/v1/attribution/characters");
    expect(source.results[0].source_url).toBe("https://example.com/hero");
  });

  it("limits dynamic requests", async () => {
    const limited = { ...ports, rateLimiter: new MemoryRateLimiter(1) };
    const app = createApp(limited);
    expect((await app.request("https://api.test/api/v1/characters")).status).toBe(200);
    const blocked = await app.request("https://api.test/api/v1/characters");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
  });
});

describe("spoiler filter", () => {
  it("hides records that appear after the chapter", async () => {
    expect((await request("/api/v1/characters/villain?until_chapter=3")).status).toBe(404);
    const list = await json("/api/v1/characters?until_chapter=3");
    expect(list.results.map((item: { name: string }) => item.name)).toEqual(["Hero", "Mate"]);
  });

  it("removes fields that cannot be placed on the timeline", async () => {
    const body = await json("/api/v1/characters/hero?until_chapter=3");
    expect(body.status).toBeUndefined();
    expect(body.aliases).toBeUndefined();
    expect(body.affiliations).toBeUndefined();
    expect(body.devil_fruits).toBeUndefined();
    expect(body.bounties).toEqual([{ amount: 100, revealed_chapter: 2 }]);
    expect(body.spoiler_filter.redacted).toEqual(expect.arrayContaining(["status", "aliases", "bounties"]));
  });

  it("shows ages and heights according to the timeskip", async () => {
    const before = await json("/api/v1/characters/hero?until_chapter=8");
    expect(before.ages).toEqual([{ years: 17, period: "debut" }]);
    expect(before.heights).toBeUndefined();
    expect(before.spoiler_filter.redacted).toEqual(expect.arrayContaining(["ages", "heights"]));
  });

  it("keeps values already revealed at the chapter", async () => {
    const early = await json("/api/v1/characters/mate?until_chapter=2");
    expect(early.status).toBe("alive");
    expect(early.status_revealed_chapter).toBeUndefined();
    expect(early.aliases).toEqual([{ en: "Early Alias", revealed_chapter: 2 }]);
    expect(early.occupations).toEqual([{ name: "Cook", revealed_chapter: 2 }]);
    expect(early.affiliations[0].status).toBeUndefined();
    expect(early.origin).toBeUndefined();
    expect(early.spoiler_filter.redacted).toEqual(expect.arrayContaining(["aliases", "origin"]));

    const later = await json("/api/v1/characters/mate?until_chapter=8");
    expect(later.aliases.map((alias: { en: string }) => alias.en)).toEqual(["Early Alias", "Late Alias"]);
    expect(later.origin.region).toBe("East Blue");
    expect(early.ages).toBeUndefined();
    expect(later.ages).toEqual([{ years: 38, period: "other", revealed_chapter: 3 }]);
  });

  it("hides a revealed identity until its chapter", async () => {
    expect((await json("/api/v1/devil-fruits/test-fruit?until_chapter=4")).revealed_identity).toBeUndefined();
    expect((await json("/api/v1/devil-fruits/test-fruit?until_chapter=5")).revealed_identity.type).toBe("zoan");
  });

  it("does not leak spoilers through search", async () => {
    const body = await json("/api/v1/search?q=secret&until_chapter=3");
    expect(body.count).toBe(0);
  });

  it("rejects queries that would reveal spoilers", async () => {
    expect((await request("/api/v1/characters?status=alive&until_chapter=3")).status).toBe(400);
    expect((await request("/api/v1/characters?sort=-bounty&until_chapter=3")).status).toBe(400);
    expect((await request("/api/v1/crews/test-pirates/members?until_chapter=3")).status).toBe(400);
    expect((await request("/api/v1/episodes?until_chapter=3")).status).toBe(400);
    expect((await request("/api/v1/characters?until_chapter=99")).status).toBe(400);
  });

  it("filters safe subresources by chapter", async () => {
    const arcs = await json("/api/v1/sagas/first-saga/arcs?until_chapter=3");
    expect(arcs.results.map((item: { name: string }) => item.name)).toEqual(["First Arc"]);
  });
});
