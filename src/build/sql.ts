import type { BuildOutput } from "./model.js";

export const SCHEMA = `
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS facets;
DROP TABLE IF EXISTS search_index;
CREATE TABLE records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_name TEXT NOT NULL,
  number INTEGER,
  first_chapter INTEGER,
  bounty INTEGER,
  PRIMARY KEY (collection, id)
);
CREATE INDEX records_name ON records (collection, sort_name);
CREATE INDEX records_number ON records (collection, number);
CREATE INDEX records_first_chapter ON records (collection, first_chapter);
CREATE INDEX records_bounty ON records (collection, bounty);
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
  for (const row of output.records) {
    const values = [
      row.collection,
      row.id,
      row.slug,
      row.name,
      row.sort_name,
      row.number,
      row.first_chapter,
      row.bounty,
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
