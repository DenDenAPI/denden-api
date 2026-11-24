import type { BuildOutput } from "./model.js";

export const SCHEMA = `
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS facets;
DROP TABLE IF EXISTS search_index;
DROP TABLE IF EXISTS collection_counts;
CREATE TABLE collection_counts (
  collection TEXT PRIMARY KEY,
  count INTEGER NOT NULL
) WITHOUT ROWID;
CREATE TABLE records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_name TEXT NOT NULL,
  sort_name_es TEXT NOT NULL,
  number INTEGER,
  first_chapter INTEGER,
  bounty INTEGER,
  cover_name TEXT,
  cover_sort_name TEXT,
  cover_sort_name_es TEXT,
  cover_until INTEGER,
  PRIMARY KEY (collection, id)
);
CREATE INDEX records_name ON records (collection, sort_name, id);
CREATE INDEX records_name_es ON records (collection, sort_name_es, id);
CREATE INDEX records_number ON records (collection, number, sort_name, id);
CREATE INDEX records_first_chapter ON records (collection, first_chapter);
CREATE INDEX records_bounty ON records (collection, bounty DESC, sort_name, id);
CREATE TABLE facets (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  facet TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (collection, facet, value, id)
) WITHOUT ROWID;
CREATE VIRTUAL TABLE search_index USING fts5(collection UNINDEXED, id UNINDEXED, name, extra);
`;

function literal(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

export function* insertStatements(output: BuildOutput): Generator<string> {
  const counts = new Map<string, number>();
  for (const row of output.records) counts.set(row.collection, (counts.get(row.collection) ?? 0) + 1);
  for (const [collection, count] of counts) {
    yield `INSERT INTO collection_counts VALUES (${literal(collection)},${count});`;
  }
  for (const row of output.records) {
    const values = [
      row.collection,
      row.id,
      row.slug,
      row.name,
      row.sort_name,
      row.sort_name_es,
      row.number,
      row.first_chapter,
      row.bounty,
      row.cover_name,
      row.cover_sort_name,
      row.cover_sort_name_es,
      row.cover_until,
    ].map(literal);
    yield `INSERT INTO records VALUES (${values.join(",")});`;
  }
  const seen = new Set<string>();
  for (const row of output.facets) {
    const key = `${row.collection}\u0000${row.facet}\u0000${row.value}\u0000${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const values = [row.collection, row.id, row.facet, row.value].map(literal);
    yield `INSERT INTO facets VALUES (${values.join(",")});`;
  }
  for (const row of output.search) {
    const values = [row.collection, row.id, row.name, row.extra].map(literal);
    yield `INSERT INTO search_index (collection, id, name, extra) VALUES (${values.join(",")});`;
  }
}
