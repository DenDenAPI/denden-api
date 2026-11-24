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
}

export interface ResultRow {
  collection: CollectionName;
  id: string;
  name: string;
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
