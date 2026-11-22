import type { ListQuery, QueryResult, QueryStore, ResultRow, SearchQuery } from "../api/ports.js";
import type { SortColumn } from "../api/resources.js";

export type SqlValue = string | number;
export type SqlRunner = <T>(sql: string, params: SqlValue[]) => Promise<T[]>;

const SORT_COLUMNS: Record<SortColumn, string> = {
  sort_name: "r.sort_name",
  number: "r.number",
  first_chapter: "r.first_chapter",
  bounty: "r.bounty",
};

function matchExpression(terms: string[], spoilerSafe: boolean): string {
  const expression = terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" AND ");
  // Epithets, aliases and revealed names can be spoilers.
  return spoilerSafe ? `{name} : (${expression})` : `{name extra} : (${expression})`;
}

export class SqlQueryStore implements QueryStore {
  constructor(private readonly run: SqlRunner) {}

  async list(query: ListQuery): Promise<QueryResult> {
    const conditions = ["r.collection = ?"];
    const params: SqlValue[] = [query.collection];
    for (const { facet, value } of query.filters) {
      conditions.push(
        "EXISTS (SELECT 1 FROM facets f WHERE f.collection = r.collection AND f.id = r.id AND f.facet = ? AND f.value = ?)",
      );
      params.push(facet, value);
    }
    if (query.maxChapter !== undefined) {
      conditions.push("r.first_chapter IS NOT NULL AND r.first_chapter <= ?");
      params.push(query.maxChapter);
    }

    const where = conditions.join(" AND ");
    const column = SORT_COLUMNS[query.sort.column];
    const direction = query.sort.direction === "desc" ? "DESC" : "ASC";
    const [total] = await this.run<{ count: number }>(
      `SELECT COUNT(*) AS count FROM records r WHERE ${where}`,
      params,
    );
    const rows = await this.run<ResultRow>(
      `SELECT r.collection, r.id, r.name FROM records r WHERE ${where}
       ORDER BY ${column} IS NULL, ${column} ${direction}, r.sort_name, r.id LIMIT ? OFFSET ?`,
      [...params, query.limit, query.offset],
    );
    return { count: total?.count ?? 0, rows };
  }

  async search(query: SearchQuery): Promise<QueryResult> {
    const conditions = ["search_index MATCH ?"];
    const params: SqlValue[] = [matchExpression(query.terms, query.maxChapter !== undefined)];
    if (query.collection) {
      conditions.push("r.collection = ?");
      params.push(query.collection);
    }
    if (query.maxChapter !== undefined) {
      conditions.push("r.first_chapter IS NOT NULL AND r.first_chapter <= ?");
      params.push(query.maxChapter);
    }

    const from = "FROM search_index JOIN records r ON r.collection = search_index.collection AND r.id = search_index.id";
    const where = conditions.join(" AND ");
    const [total] = await this.run<{ count: number }>(`SELECT COUNT(*) AS count ${from} WHERE ${where}`, params);
    const rows = await this.run<ResultRow>(
      `SELECT r.collection, r.id, r.name ${from} WHERE ${where}
       ORDER BY bm25(search_index), r.sort_name, r.id LIMIT ? OFFSET ?`,
      [...params, query.limit, query.offset],
    );
    return { count: total?.count ?? 0, rows };
  }
}
