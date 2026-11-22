import { describe, expect, it, vi } from "vitest";
import { withEdgeCache, type EdgeCache } from "./edge-cache.js";

const url = "https://api.test/api/v1/characters";

function memoryCache(): EdgeCache & { size: () => number } {
  const entries = new Map<string, Response>();
  return {
    size: () => entries.size,
    match: async (request) => entries.get(request.url)?.clone(),
    put: async (request, response) => {
      entries.set(request.url, response);
    },
  };
}

const ok = () =>
  new Response('{"ok":true}', {
    status: 200,
    headers: { ETag: '"abc"', "Content-Type": "application/json" },
  });

describe("withEdgeCache", () => {
  it("stores a successful response and serves it again", async () => {
    const cache = memoryCache();
    const handler = vi.fn(ok);
    const tasks: Promise<unknown>[] = [];
    await withEdgeCache(new Request(url), handler, cache, (task) => tasks.push(task));
    await Promise.all(tasks);
    const second = await withEdgeCache(new Request(url), handler, cache, () => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await second.json()).toEqual({ ok: true });
  });

  it("answers 304 from a cached entry", async () => {
    const cache = memoryCache();
    await cache.put(new Request(url), ok());
    const response = await withEdgeCache(
      new Request(url, { headers: { "If-None-Match": '"abc"' } }),
      ok,
      cache,
      () => undefined,
    );
    expect(response.status).toBe(304);
    expect(response.headers.get("ETag")).toBe('"abc"');
  });

  it("stores a full response when a conditional request misses", async () => {
    const cache = memoryCache();
    const handler = vi.fn((request: Request) => {
      expect(request.headers.has("If-None-Match")).toBe(false);
      return ok();
    });
    const tasks: Promise<unknown>[] = [];
    const response = await withEdgeCache(
      new Request(url, { headers: { "If-None-Match": '"abc"', "cf-connecting-ip": "203.0.113.1" } }),
      handler,
      cache,
      (task) => tasks.push(task),
    );
    await Promise.all(tasks);
    expect(response.status).toBe(304);
    expect((await cache.match(new Request(url)))?.status).toBe(200);
  });

  it("does not store errors", async () => {
    const cache = memoryCache();
    await withEdgeCache(new Request(url), () => new Response("no", { status: 404 }), cache, () => undefined);
    expect(cache.size()).toBe(0);
  });

  it("bypasses the cache for other methods", async () => {
    const cache = memoryCache();
    const response = await withEdgeCache(
      new Request(url, { method: "POST" }),
      () => new Response(null, { status: 405 }),
      cache,
      () => undefined,
    );
    expect(response.status).toBe(405);
    expect(cache.size()).toBe(0);
  });
});
