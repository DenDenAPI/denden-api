export const COLLECTIONS = [
  "sagas",
  "arcs",
  "chapters",
  "volumes",
  "episodes",
  "devil-fruits",
  "crews",
  "organizations",
  "locations",
  "ships",
  "characters",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
export type SortColumn = "sort_name" | "number" | "first_chapter" | "bounty";

interface SpoilerRule {
  spoilerSafe: boolean;
}

export interface ResourceDefinition {
  filters: Record<string, SpoilerRule>;
  sorts: Record<string, SortColumn>;
  defaultSort: SortColumn;
  subresources: Record<string, SpoilerRule>;
  /** Fields without chapter data, removed when a spoiler filter is active. */
  redact: readonly string[];
  /** False when records cannot be placed on the manga timeline. */
  supportsSpoilerFilter: boolean;
}

const safe: SpoilerRule = { spoilerSafe: true };
const unsafe: SpoilerRule = { spoilerSafe: false };
const byName = { name: "sort_name", first_chapter: "first_chapter" } as const;

export const RESOURCES: Record<CollectionName, ResourceDefinition> = {
  sagas: {
    filters: {},
    sorts: { number: "number", ...byName },
    defaultSort: "number",
    subresources: { arcs: safe },
    redact: [],
    supportsSpoilerFilter: true,
  },
  arcs: {
    filters: { kind: safe, canon: safe, saga: safe },
    sorts: { number: "number", ...byName },
    defaultSort: "number",
    subresources: { chapters: safe, episodes: unsafe },
    redact: [],
    supportsSpoilerFilter: true,
  },
  chapters: {
    filters: { volume: safe, arc: safe },
    sorts: { number: "number", name: "sort_name" },
    defaultSort: "number",
    subresources: {},
    redact: [],
    supportsSpoilerFilter: true,
  },
  volumes: {
    filters: {},
    sorts: { number: "number", name: "sort_name" },
    defaultSort: "number",
    subresources: { chapters: safe },
    redact: [],
    supportsSpoilerFilter: true,
  },
  episodes: {
    filters: { canon: unsafe, kind: unsafe, arc: unsafe },
    sorts: { number: "number", name: "sort_name" },
    defaultSort: "number",
    subresources: {},
    redact: [],
    supportsSpoilerFilter: false,
  },
  "devil-fruits": {
    filters: { type: safe, sub_type: safe, canon: safe },
    sorts: byName,
    defaultSort: "sort_name",
    subresources: { users: unsafe },
    redact: ["users"],
    supportsSpoilerFilter: true,
  },
  crews: {
    filters: { canon: safe, status: unsafe },
    sorts: byName,
    defaultSort: "sort_name",
    subresources: { members: unsafe, ships: unsafe },
    redact: ["status", "captains"],
    supportsSpoilerFilter: true,
  },
  organizations: {
    filters: { canon: safe, status: unsafe },
    sorts: byName,
    defaultSort: "sort_name",
    subresources: { members: unsafe, ships: unsafe },
    redact: ["status", "leaders", "affiliations", "residences"],
    supportsSpoilerFilter: true,
  },
  locations: {
    filters: { canon: safe, region: safe, parent: safe },
    sorts: byName,
    defaultSort: "sort_name",
    subresources: { residents: unsafe, children: safe },
    redact: ["affiliations"],
    supportsSpoilerFilter: true,
  },
  ships: {
    filters: { canon: safe, status: unsafe, crew: unsafe },
    sorts: byName,
    defaultSort: "sort_name",
    subresources: {},
    redact: ["status", "affiliations"],
    supportsSpoilerFilter: true,
  },
  characters: {
    filters: {
      canon: safe,
      gender: safe,
      species: safe,
      blood_type: safe,
      status: unsafe,
      crew: unsafe,
      organization: unsafe,
    },
    sorts: { ...byName, bounty: "bounty" },
    defaultSort: "sort_name",
    subresources: { affiliations: unsafe, bounties: unsafe, "devil-fruits": unsafe },
    redact: [
      "status",
      "epithets",
      "aliases",
      "occupations",
      "affiliations",
      "origin",
      "residences",
      "ages",
      "heights",
      "devil_fruits",
      "marine_rating",
    ],
    supportsSpoilerFilter: true,
  },
};

export function isCollection(value: string): value is CollectionName {
  return (COLLECTIONS as readonly string[]).includes(value);
}

/** Accept both the public id (`1`) and the record slug (`chapter-1`). */
export function normalizeId(collection: CollectionName, id: string): string {
  if (collection === "chapters") return id.replace(/^chapter-/, "");
  if (collection === "volumes") return id.replace(/^volume-/, "");
  if (collection === "episodes") return id.replace(/^episode-special-/, "special-").replace(/^episode-/, "");
  return id;
}
