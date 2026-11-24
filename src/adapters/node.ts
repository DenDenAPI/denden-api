import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AssetStore, Ports, RateLimiter } from "../api/ports.js";
import { SqlQueryStore, type SqlRunner } from "./sql-query-store.js";

class FileAssetStore implements AssetStore {
  constructor(private readonly root: string) {}

  async get(path: string): Promise<unknown | null> {
    try {
      return JSON.parse(await readFile(join(this.root, `${path}.json`), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();
  private lastSweep: number;

  constructor(
    private readonly limit = 60,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {
    this.lastSweep = now();
  }

  /** Number of clients currently tracked. */
  get size(): number {
    return this.windows.size;
  }

  async allow(key: string): Promise<boolean> {
    const time = this.now();
    // Expired windows are dropped once per window, so memory follows recent traffic instead of every client ever seen.
    if (time - this.lastSweep >= this.windowMs) {
      for (const [client, window] of this.windows) {
        if (time - window.start >= this.windowMs) this.windows.delete(client);
      }
      this.lastSweep = time;
    }
    const current = this.windows.get(key);
    if (!current || time - current.start >= this.windowMs) {
      this.windows.set(key, { start: time, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }
}

export function sqliteRunner(database: DatabaseSync): SqlRunner {
  return async <T>(sql: string, params: (string | number)[]) =>
    database.prepare(sql).all(...params) as T[];
}

export function createNodePorts(distDir: string, requestLimit = 60): Ports {
  const database = new DatabaseSync(join(distDir, "denden.sqlite"), { readOnly: true });
  return {
    assets: new FileAssetStore(join(distDir, "assets")),
    queries: new SqlQueryStore(sqliteRunner(database)),
    rateLimiter: new MemoryRateLimiter(requestLimit),
  };
}
