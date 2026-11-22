import type { AssetStore, Ports, RateLimiter } from "../api/ports.js";
import { SqlQueryStore, type SqlRunner } from "./sql-query-store.js";

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<{ results: T[] }>;
}

export interface CloudflareEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: { prepare(sql: string): D1Statement };
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

class WorkerAssetStore implements AssetStore {
  constructor(private readonly binding: CloudflareEnv["ASSETS"]) {}

  async get(path: string): Promise<unknown | null> {
    const response = await this.binding.fetch(new Request(`https://assets.local/${path}.json`));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Asset request failed with ${response.status}`);
    return response.json();
  }
}

class WorkerRateLimiter implements RateLimiter {
  constructor(private readonly binding: CloudflareEnv["RATE_LIMITER"]) {}

  async allow(key: string): Promise<boolean> {
    if (!this.binding) return true;
    return (await this.binding.limit({ key })).success;
  }
}

export function createCloudflarePorts(env: CloudflareEnv): Ports {
  const run: SqlRunner = async <T>(sql: string, params: (string | number)[]) =>
    (await env.DB.prepare(sql).bind(...params).all<T>()).results;
  return {
    assets: new WorkerAssetStore(env.ASSETS),
    queries: new SqlQueryStore(run),
    rateLimiter: new WorkerRateLimiter(env.RATE_LIMITER),
  };
}
