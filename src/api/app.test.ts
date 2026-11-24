import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import { MemoryRateLimiter, sqliteRunner } from "../adapters/node.js";
import { SqlQueryStore } from "../adapters/sql-query-store.js";
import { buildOutput } from "../build/model.js";
import { insertStatements, SCHEMA } from "../build/sql.js";
import type { Dataset } from "../data/validate.js";
import type { Attribution } from "../schemas/attribution.js";
import type { Glossary } from "../schemas/glossary.js";
import { createApp } from "./app.js";
import { canonicalRegion, labelCatalog, localizeBody, localizeReferences } from "./i18n.js";
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
      captains: [
        { character: "hero", status: "current" },
        { character: "zed", status: "current", revealed_chapter: 9 },
      ],
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
    {
      // Known only as "Mask" until chapter 9; the real name is revealed in chapter 10.
      slug: "zed",
      name: { en: "Zed", ja: "ゼッド" },
      canon: "manga",
      status: "alive",
      status_revealed_chapter: 9,
      first_appearance: { chapter: 9 },
      aliases: [{ en: "Mask", ja: "マスク", revealed_chapter: 9, cover_until: 9 }],
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
  const glossary: Glossary = {
    occupations: { Cook: ["Cocinero", "Cocinera"] },
    epithets: {},
    aliases: { "Early Alias": "Alias temprano", "Late Alias": "Alias tardío" },
    fruit_meanings: {},
    arcs: { "First Arc": "Primer arco", "Late Arc": "Árbol tardío" },
    sagas: { "First Saga": "Primera saga" },
    species: {},
    regions: { "East Blue": "Mar del Este" },
    periods: { debut: "Debut" },
    crews: { "Test Pirates": "Piratas de Pruebas" },
    devil_fruits: { "Test Fruit": "Fruta Tesuto", "Secret Fruit": "Fruta Secreta" },
  };
  const output = buildOutput(
    dataset,
    {
      license: "CC BY-SA 3.0",
      license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
      notice: "Test notice",
      articles: articles(),
    },
    glossary,
  );
  const database = new DatabaseSync(":memory:");
  database.exec(SCHEMA);
  for (const statement of insertStatements(output)) database.exec(statement);
  output.documents.set("v1/i18n/es", glossary);
  ports = {
    assets: { get: async (path) => structuredClone(output.documents.get(path) ?? null) },
    queries: new SqlQueryStore(sqliteRunner(database)),
    rateLimiter: new MemoryRateLimiter(10_000),
  };
});

describe("Spanish translations", () => {
  it("keeps English responses unchanged by default and with lang=en", async () => {
    const plain = await json("/api/v1/characters/mate");
    expect(plain.translation).toBeUndefined();
    expect(plain.occupations[0].name).toBe("Cook");
    expect(plain.aliases[0]).toMatchObject({ en: "Early Alias", label: "Early Alias" });
    expect(await json("/api/v1/characters/mate?lang=en")).toEqual(plain);
  });

  it("uses the same keys in both languages and falls back when missing", async () => {
    const english = await json("/api/v1/characters/mate");
    const response = await request("/api/v1/characters/mate?lang=es");
    expect(response.headers.get("Content-Language")).toBe("es");
    const body = (await response.json()) as Record<string, any>;
    const { translation, ...shared } = body;
    expect(translation).toEqual({ language: "es", reviewed: false });
    expect(Object.keys(shared).sort()).toEqual(Object.keys(english).sort());
    expect(Object.keys(body.occupations[0]).sort()).toEqual(Object.keys(english.occupations[0]).sort());
    expect(body.occupations[0].name).toBe("Cocinero");
    expect(body.aliases[0]).toMatchObject({ en: "Early Alias", label: "Alias temprano" });
    expect(body.aliases[2]).toMatchObject({ en: "Unknown Alias", label: "Unknown Alias" });
    expect(body.origin.region).toBe("Mar del Este");
    expect(body.status).toEqual({ id: "alive", label: "Alive" });
  });

  it("accepts a translated region in filters", () => {
    const glossary = { regions: { "East Blue": "Mar del Este" } } as unknown as Glossary;
    expect(canonicalRegion(glossary, "Mar del Este")).toBe("East Blue");
    expect(canonicalRegion(undefined, "East Blue")).toBe("East Blue");
  });

  it("uses the character gender for gendered values", () => {
    const glossary = { occupations: { Cook: ["Cocinero", "Cocinera"] } } as unknown as Glossary;
    const body = { gender: "female", occupations: [{ name: "Cook" }] };
    const localized = localizeBody("characters", body, glossary) as { occupations: { name: string }[] };
    expect(localized.occupations[0]?.name).toBe("Cocinera");
  });

  it("translates record names and the names of references to them", () => {
    const glossary = {
      crews: { "Straw Hat Pirates": "Piratas del Sombrero de Paja" },
      devil_fruits: { "Gum-Gum Fruit": "Fruta Gomu Gomu", "Human-Human Fruit, Model: Nika": "Fruta Hito Hito, modelo Nika" },
    } as unknown as Glossary;
    const crew = localizeBody("crews", { name: { en: "Straw Hat Pirates", ja: "麦わらの一味" } }, glossary) as Record<string, any>;
    expect(crew.name).toEqual({ en: "Straw Hat Pirates", ja: "麦わらの一味", label: "Piratas del Sombrero de Paja" });

    const fruit = localizeBody(
      "devil-fruits",
      { name: { en: "Gum-Gum Fruit" }, revealed_identity: { name: { en: "Human-Human Fruit, Model: Nika" } } },
      glossary,
    ) as Record<string, any>;
    expect(fruit.name.label).toBe("Fruta Gomu Gomu");
    expect(fruit.revealed_identity.name.label).toBe("Fruta Hito Hito, modelo Nika");

    const character = localizeBody(
      "characters",
      {
        name: { en: "Monkey D. Luffy" },
        affiliations: [{ type: "crew", name: "Straw Hat Pirates", url: "/api/v1/crews/straw-hat-pirates" }],
      },
      glossary,
    ) as Record<string, any>;
    expect(character.name.label).toBe("Monkey D. Luffy");
    expect(character.affiliations[0].name).toBe("Piratas del Sombrero de Paja");
    expect(localizeReferences({ name: "Straw Hat Pirates", url: "/api/v1/characters/x" }, glossary)).toEqual({
      name: "Straw Hat Pirates",
      url: "/api/v1/characters/x",
    });
  });

  it("finds records by their Spanish name, with or without accents", async () => {
    const byName = await json("/api/v1/search?q=piratas&lang=es");
    expect(byName.results.map((item: { name: string }) => item.name)).toEqual(["Piratas de Pruebas"]);
    expect((await json("/api/v1/search?q=prueba")).results[0].name).toBe("Test Pirates");
    expect((await json("/api/v1/search?q=ARCO&lang=es")).results[0].name).toBe("Primer arco");
    expect((await json("/api/v1/search?q=tardio&type=characters")).results[0].name).toBe("Mate");
  });

  it("sorts by the name in the requested language, ignoring accents", async () => {
    const names = async (path: string) =>
      (await json(path)).results.map((item: { name: string }) => item.name);
    expect(await names("/api/v1/arcs?sort=name")).toEqual(["First Arc", "Late Arc"]);
    // "Árbol" sorts as "arbol", before "primer", not after "z".
    expect(await names("/api/v1/arcs?sort=name&lang=es")).toEqual(["Árbol tardío", "Primer arco"]);
    expect(await names("/api/v1/arcs?sort=-name&lang=es")).toEqual(["Primer arco", "Árbol tardío"]);
  });

  it("does not reveal a translated hidden name through search", async () => {
    expect((await json("/api/v1/search?q=secreta&until_chapter=4")).count).toBe(0);
    expect((await json("/api/v1/search?q=secreta")).results[0].url).toMatch(/\/devil-fruits\/test-fruit$/);
  });

  it("translates only what the spoiler filter leaves visible", async () => {
    const body = await json("/api/v1/characters/mate?until_chapter=2&lang=es");
    expect(body.aliases).toEqual([{ en: "Early Alias", revealed_chapter: 2, label: "Alias temprano" }]);
    expect(JSON.stringify(body)).not.toContain("Alias tardío");
    expect(body.origin).toBeUndefined();
  });

  it("translates arc and saga references and keeps lang in links", async () => {
    const list = await json("/api/v1/arcs?lang=es&limit=1");
    expect(list.results[0].name).toBe("Primer arco");
    expect(list.next).toContain("lang=es");
    const arc = await json("/api/v1/arcs/first-arc?lang=es");
    expect(arc.name).toMatchObject({ en: "First Arc", label: "Primer arco" });
    expect(arc.sagas[0].name).toBe("Primera saga");
    expect(arc.links.chapters).toMatch(/\/chapters\?lang=es$/);
  });

  it("rejects unsupported languages", async () => {
    expect((await request("/api/v1/characters?lang=fr")).status).toBe(400);
    expect((await request("/api/v1/labels?lang=fr")).status).toBe(400);
  });

  it("returns technical codes as id and label, using the character gender", () => {
    const glossary = {
      species: { human: ["Humano", "Humana"] },
      character_statuses: { alive: ["Vivo", "Viva"] },
      relation_statuses: { current: "Actual" },
    } as unknown as Glossary;
    const body = { gender: "female", species: ["human"], status: "alive", occupations: [{ name: "Cook", status: "current" }] };
    const female = localizeBody("characters", body, glossary) as Record<string, any>;
    expect(female.gender).toEqual({ id: "female", label: "Female" });
    expect(female.species).toEqual([{ id: "human", label: "Humana" }]);
    expect(female.status).toEqual({ id: "alive", label: "Viva" });
    expect(female.occupations[0].status).toEqual({ id: "current", label: "Actual" });

    const { gender: _gender, ...unknown } = body;
    const generic = localizeBody("characters", unknown, glossary) as Record<string, any>;
    expect(generic.gender).toBeUndefined();
    expect(generic.species).toEqual([{ id: "human", label: "Humano" }]);
  });

  it("serves display text for technical codes", async () => {
    const english = await json("/api/v1/labels");
    expect(english.language).toBe("en");
    expect(english.species.fish_man).toEqual({ male: "Fish-Man", female: "Fish-Man", generic: "Fish-Man" });
    expect(english.character_statuses.alive).toEqual({ male: "Alive", female: "Alive", generic: "Alive" });

    const glossary = { species: { human: ["Humano", "Humana"] }, periods: { debut: "Debut" } } as unknown as Glossary;
    const spanish = labelCatalog(glossary) as Record<string, any>;
    expect(spanish.language).toBe("es");
    expect(spanish.species.human).toEqual({ male: "Humano", female: "Humana", generic: "Humano" });
    expect(spanish.species.mink).toEqual({ male: "Mink", female: "Mink", generic: "Mink" });
  });
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
    expect(members.results[0]).toMatchObject({ name: "Hero", status: { id: "current", label: "Current" } });
    const bounties = await json("/api/v1/characters/hero/bounties");
    expect(bounties.results.map((item: { amount: number }) => item.amount)).toEqual([100, 900]);
    expect((await json("/api/v1/volumes/1/chapters?limit=1")).count).toBe(10);
  });

  it("publishes an OpenAPI document covering every resource", async () => {
    const spec = await json("/api/v1/openapi.json");
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info["x-dataset"].counts.characters).toBe(4);
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

  it("forgets clients whose window has expired", async () => {
    let time = 0;
    const limiter = new MemoryRateLimiter(2, 1_000, () => time);
    for (let client = 0; client < 500; client += 1) await limiter.allow(`ip-${client}`);
    expect(limiter.size).toBe(500);

    time = 1_000;
    expect(await limiter.allow("new-client")).toBe(true);
    expect(limiter.size).toBe(1);

    expect(await limiter.allow("new-client")).toBe(true);
    expect(await limiter.allow("new-client")).toBe(false);
    time = 1_500;
    await limiter.allow("other");
    expect(await limiter.allow("new-client")).toBe(false);
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
    expect(before.ages).toEqual([{ years: 17, period: { id: "debut", label: "Debut" } }]);
    expect(before.heights).toBeUndefined();
    expect(before.spoiler_filter.redacted).toEqual(expect.arrayContaining(["ages", "heights"]));
  });

  it("keeps values already revealed at the chapter", async () => {
    const early = await json("/api/v1/characters/mate?until_chapter=2");
    expect(early.status).toEqual({ id: "alive", label: "Alive" });
    expect(early.status_revealed_chapter).toBeUndefined();
    expect(early.aliases).toEqual([{ en: "Early Alias", label: "Early Alias", revealed_chapter: 2 }]);
    expect(early.occupations).toEqual([{ name: "Cook", revealed_chapter: 2 }]);
    expect(early.affiliations[0].status).toBeUndefined();
    expect(early.origin).toBeUndefined();
    expect(early.spoiler_filter.redacted).toEqual(expect.arrayContaining(["aliases", "origin"]));

    const later = await json("/api/v1/characters/mate?until_chapter=8");
    expect(later.aliases.map((alias: { en: string }) => alias.en)).toEqual(["Early Alias", "Late Alias"]);
    expect(later.origin.region).toBe("East Blue");
    expect(early.ages).toBeUndefined();
    expect(later.ages).toEqual([{ years: 38, period: { id: "other", label: "Other" }, revealed_chapter: 3 }]);
  });

  it("does not reveal what a record hides through the filter metadata", async () => {
    const hero = await json("/api/v1/characters/hero?until_chapter=8");
    const mate = await json("/api/v1/characters/mate?until_chapter=8");
    expect(hero.spoiler_filter.redacted).toEqual(mate.spoiler_filter.redacted);

    const before = await json("/api/v1/devil-fruits/test-fruit?until_chapter=4");
    const after = await json("/api/v1/devil-fruits/test-fruit?until_chapter=5");
    expect(before.spoiler_filter.redacted).toEqual(after.spoiler_filter.redacted);
  });

  it("hides a revealed identity until its chapter", async () => {
    expect((await json("/api/v1/devil-fruits/test-fruit?until_chapter=4")).revealed_identity).toBeUndefined();
    expect((await json("/api/v1/devil-fruits/test-fruit?until_chapter=5")).revealed_identity.type).toEqual({ id: "zoan", label: "Zoan" });
  });

  it("shows a cover name instead of the real name until it is revealed", async () => {
    const covered = await json("/api/v1/characters/zed?until_chapter=9");
    expect(covered.name).toEqual({ en: "Mask", ja: "マスク", label: "Mask" });
    expect(covered.aliases).toBeUndefined();
    expect(covered.spoiler_filter.redacted).toContain("name");

    const revealed = await json("/api/v1/characters/zed?until_chapter=10");
    expect(revealed.name).toEqual({ en: "Zed", ja: "ゼッド", label: "Zed" });
    expect(revealed.aliases).toEqual([{ en: "Mask", ja: "マスク", label: "Mask", revealed_chapter: 9 }]);

    const full = await json("/api/v1/characters/zed");
    expect(full.name.en).toBe("Zed");
    expect(full.aliases[0].cover_until).toBe(9);
  });

  it("uses the cover name in lists, sorting, references and search", async () => {
    const names = async (path: string) => (await json(path)).results.map((item: { name: string }) => item.name);
    expect(await names("/api/v1/characters?until_chapter=9")).toEqual(["Hero", "Mask", "Mate", "Villain"]);
    expect(await names("/api/v1/characters?until_chapter=10")).toEqual(["Hero", "Mate", "Villain", "Zed"]);

    const crew = await json("/api/v1/crews/test-pirates?until_chapter=9");
    expect(crew.captains.map((item: { name: string }) => item.name)).toContain("Mask");
    const later = await json("/api/v1/crews/test-pirates?until_chapter=10");
    expect(later.captains.map((item: { name: string }) => item.name)).toContain("Zed");

    expect((await json("/api/v1/search?q=zed&until_chapter=9")).count).toBe(0);
    expect(await names("/api/v1/search?q=mask&until_chapter=9")).toEqual(["Mask"]);
    expect(await names("/api/v1/search?q=zed")).toEqual(["Zed"]);
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

  it("keeps the chapter and language in every API URL it returns", async () => {
    const mate = await json("/api/v1/characters/mate?until_chapter=2&lang=es");
    expect(mate.affiliations[0].url).toMatch(/\/api\/v1\/[a-z-]+\/[a-z0-9-]+\?until_chapter=2&lang=es$/);

    const list = await json("/api/v1/characters?until_chapter=3&lang=es&limit=1");
    expect(list.results[0].url).toMatch(/\/characters\/hero\?until_chapter=3&lang=es$/);
    expect(list.next).toMatch(/\?until_chapter=3&lang=es&limit=1&page=2$/);

    const arcs = await json("/api/v1/sagas/first-saga/arcs?until_chapter=3");
    expect(arcs.results[0].url).toMatch(/\/arcs\/first-arc\?until_chapter=3$/);

    const english = await json("/api/v1/characters/mate?lang=en");
    expect(english.affiliations[0].url).not.toContain("?");
  });

  it("returns only API URLs that can be followed as they are", async () => {
    const urls = (value: unknown): string[] =>
      typeof value === "string"
        ? /^https?:\/\/[^/]+\/api\//.test(value) ? [value.replace(/^https?:\/\/[^/]+/, "")] : []
        : value && typeof value === "object"
          ? Object.values(value).flatMap(urls)
          : [];
    const pages = [
      "/api/v1/characters/mate?until_chapter=8&lang=es",
      "/api/v1/characters/hero?until_chapter=8&lang=es",
      "/api/v1/arcs/first-arc?until_chapter=3&lang=es",
      "/api/v1/sagas/first-saga?until_chapter=3&lang=es",
      "/api/v1/crews/test-pirates?until_chapter=3&lang=es",
      "/api/v1/devil-fruits/test-fruit?until_chapter=5&lang=es",
    ];
    let followed = 0;
    for (const page of pages) {
      for (const url of urls(await json(page))) {
        const response = await request(url);
        expect([200, 404], url).toContain(response.status);
        followed += 1;
      }
    }
    expect(followed).toBeGreaterThan(5);
  });

  it("filters safe subresources by chapter", async () => {
    const arcs = await json("/api/v1/sagas/first-saga/arcs?until_chapter=3");
    expect(arcs.results.map((item: { name: string }) => item.name)).toEqual(["First Arc"]);
  });
});
