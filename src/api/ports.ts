import type { CollectionName, SortColumn } from "./resources.js";

export interface AssetStore {
  get(path: string): Promise<unknown | null>;
}

export interface ListQuery {
  collection: CollectionName;
  filters: { facet: string; value: string }[];
  sort: { column: SortColumn; direction: "asc" | "desc" };
  limit: number;
  offset: number;
  maxChapter?: number;
  /** Language whose names decide the order when sorting by name. English by default. */
  language?: "es";
}

export interface SearchQuery {
  terms: string[];
  collection?: CollectionName;
  limit: number;
  offset: number;
  maxChapter?: number;
  /** Language of the cover names in the results. English by default. */
  language?: "es";
}

export interface ResultRow {
  collection: CollectionName;
  id: string;
  name: string;
}

export interface Cover {
  name: { en: string; ja?: string; romaji?: string };
  until: number;
  /** Spanish label, for a descriptive cover such as "Mysterious Figure". Proper names are not translated. */
  label_es?: string;
}

/**
 * The `v1/covers` asset: characters the reader first knows by false names, keyed by public id and sorted by `until`.
 * Spoiler-filtered responses show the first cover whose `until` has not passed instead of the real name.
 */
export type Covers = Record<string, Cover[]>;

/** The cover name in force at a chapter, if any. */
export function activeCover(covers: Cover[] | undefined, maxChapter: number): Cover | undefined {
  return covers?.find((cover) => cover.until >= maxChapter);
}

export interface QueryResult {
  count: number;
  rows: ResultRow[];
}

export interface QueryStore {
  list(query: ListQuery): Promise<QueryResult>;
  search(query: SearchQuery): Promise<QueryResult>;
}

export interface RateLimiter {
  allow(key: string): Promise<boolean>;
}

export interface Ports {
  assets: AssetStore;
  queries: QueryStore;
  rateLimiter: RateLimiter;
}
