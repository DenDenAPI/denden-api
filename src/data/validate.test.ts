import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { validateDataset } from "./validate.js";

const roots: string[] = [];
const url = "https://example.com/article";

const saga = {
  slug: "first-saga",
  order: 1,
  name: { en: "First Saga" },
  chapters: { count: 10, ranges: [{ start: 1, end: 10 }] },
};

const arc = {
  slug: "first-arc",
  order: 1,
  name: { en: "First Arc" },
  kind: "story",
  canon: "manga",
  sagas: ["first-saga"],
  chapters: { count: 5, ranges: [{ start: 1, end: 5 }] },
  episodes: { count: 2, ranges: [{ start: 1, end: 2 }] },
};

const fillerArc = {
  ...arc,
  slug: "filler-arc",
  order: 2,
  name: { en: "Filler Arc" },
  kind: "filler",
  canon: "anime_only",
  chapters: undefined,
  episodes: { count: 1, ranges: [{ start: 3, end: 3 }] },
};

const volume = {
  slug: "volume-1",
  number: 1,
  name: { en: "First Volume" },
  chapters: { start: 1, end: 10 },
};

function write(root: string, directory: string, slug: string, record: object): void {
  mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(join(root, directory, `${slug}.yaml`), stringify(record));
}

function episode(number: number, canon = "manga"): object {
  return { slug: `episode-${number}`, number, kind: "regular", name: { en: `Episode ${number}` }, canon };
}

function dataset(
  arcRecord: object = arc,
  episodes: object[] = [episode(1), episode(2), episode(3, "anime_only")],
): string {
  const root = mkdtempSync(join(tmpdir(), "denden-data-"));
  roots.push(root);
  write(root, "sagas", saga.slug, saga);
  write(root, "arcs", arc.slug, arcRecord);
  write(root, "arcs", fillerArc.slug, fillerArc);
  write(root, "volumes", volume.slug, volume);
  for (const directory of ["devil-fruits", "crews", "organizations", "locations", "ships", "characters"]) {
    mkdirSync(join(root, directory));
  }

  const chapterArticles: Record<string, string> = {};
  for (let number = 1; number <= 10; number += 1) {
    write(root, "chapters", `chapter-${number}`, {
      slug: `chapter-${number}`,
      number,
      name: { en: `Chapter ${number}` },
    });
    chapterArticles[`chapter-${number}`] = url;
  }

  const episodeArticles: Record<string, string> = {};
  for (const record of episodes as { slug: string }[]) {
    write(root, "episodes", record.slug, record);
    episodeArticles[record.slug] = url;
  }

  writeFileSync(
    join(root, "ATTRIBUTION.yaml"),
    stringify({
      license: "CC BY-SA 3.0",
      license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
      notice: "Test notice",
      articles: {
        sagas: { "first-saga": url },
        arcs: { "first-arc": url, "filler-arc": url },
        chapters: chapterArticles,
        volumes: { "volume-1": url },
        episodes: episodeArticles,
        "devil-fruits": {},
        crews: {},
        organizations: {},
        locations: {},
        ships: {},
        characters: {},
      },
    }),
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("validateDataset", () => {
  it("accepts a consistent dataset", () => {
    expect(validateDataset(dataset()).issues).toEqual([]);
  });

  it("rejects a relation to an unknown saga", () => {
    const { issues } = validateDataset(dataset({ ...arc, sagas: ["missing-saga"] }));
    expect(issues).toContain('arcs/first-arc: unknown saga "missing-saga"');
  });

  it("rejects a count that does not match its ranges", () => {
    const chapters = { count: 6, ranges: [{ start: 1, end: 5 }] };
    const { issues } = validateDataset(dataset({ ...arc, chapters }));
    expect(issues).toContain("arcs/first-arc chapters: count 6 does not match ranges total 5");
  });

  it("rejects a slug that differs from its file name", () => {
    const { issues } = validateDataset(dataset({ ...arc, slug: "other-arc" }));
    expect(issues.some((issue) => issue.includes("does not match the file name"))).toBe(true);
  });

  it("rejects a range that points to an unknown chapter", () => {
    const chapters = { count: 11, ranges: [{ start: 1, end: 11 }] };
    const { issues } = validateDataset(dataset({ ...arc, chapters }));
    expect(issues).toContain("arcs/first-arc chapters: unknown end 11");
  });

  it("rejects a gap in the episode numbering", () => {
    const { issues } = validateDataset(dataset(arc, [episode(1), episode(3, "anime_only")]));
    expect(issues).toContain("episodes: number 2 is missing");
  });

  it("rejects a ship linked to an unknown crew", () => {
    const root = dataset();
    write(root, "ships", "first-ship", {
      slug: "first-ship",
      name: { en: "First Ship" },
      canon: "manga",
      affiliations: [{ type: "crew", slug: "missing-crew", status: "current" }],
    });
    const { issues } = validateDataset(root);
    expect(issues).toContain('ships/first-ship affiliations: unknown crew "missing-crew"');
  });

  it("rejects a crew captain that is not a known character", () => {
    const root = dataset();
    write(root, "crews", "first-crew", {
      slug: "first-crew",
      name: { en: "First Crew" },
      canon: "manga",
      captains: [{ character: "missing-character", status: "current" }],
    });
    const { issues } = validateDataset(root);
    expect(issues).toContain('crews/first-crew captains: unknown character "missing-character"');
  });

  it("rejects a bounty revealed in an unknown chapter", () => {
    const root = dataset();
    write(root, "characters", "first-character", {
      slug: "first-character",
      name: { en: "First Character" },
      canon: "manga",
      status: "alive",
      bounties: [{ amount: 100, status: "current", revealed_chapter: 99 }],
    });
    const { issues } = validateDataset(root);
    expect(issues).toContain("characters/first-character: unknown bounty chapter 99");
  });

  it("rejects a cover alias without a chapter or that ends before it starts", () => {
    const root = dataset();
    write(root, "characters", "first-character", {
      slug: "first-character",
      name: { en: "First Character" },
      canon: "manga",
      status: "alive",
      first_appearance: { chapter: 1 },
      aliases: [
        { en: "Mask", cover_until: 1 },
        { en: "Hood", revealed_chapter: 2, cover_until: 1 },
      ],
    });
    const { issues } = validateDataset(root);
    expect(issues).toContain("characters/first-character: only one alias can be a cover name");
    expect(issues).toContain('characters/first-character: cover alias "Mask" needs a revealed chapter');
    expect(issues).toContain('characters/first-character: cover alias "Hood" ends before it is revealed');
  });

  it("rejects a cycle between parent locations", () => {
    const root = dataset();
    for (const [slug, parent] of [["island-a", "island-b"], ["island-b", "island-a"]] as const) {
      write(root, "locations", slug, {
        slug,
        name: { en: slug },
        canon: "manga",
        parent,
        affiliations: [],
      });
    }
    const { issues } = validateDataset(root);
    expect(issues).toContain('locations/island-a: parent cycle through "island-a"');
  });

  it("rejects episode dates that go backwards", () => {
    const dated = (number: number, air_date: string, canon?: string) => ({
      ...episode(number, canon),
      air_date,
    });
    const { issues } = validateDataset(
      dataset(arc, [
        dated(1, "2000-01-08"),
        dated(2, "2000-01-01"),
        dated(3, "2000-01-15", "anime_only"),
      ]),
    );
    expect(issues).toContain("episodes/episode-2: date 2000-01-01 is before 2000-01-08");
  });

  it("rejects a filler episode marked as manga canon", () => {
    const { issues } = validateDataset(dataset(arc, [episode(1), episode(2), episode(3)]));
    expect(issues).toContain("episodes/episode-3: belongs to filler-arc but canon is manga");
  });
});
