import { createCloudflarePorts, type CloudflareEnv } from "./adapters/cloudflare.js";
import { withEdgeCache, type EdgeCache } from "./adapters/edge-cache.js";
import { createApp } from "./api/app.js";

interface WorkerContext {
  waitUntil(task: Promise<unknown>): void;
}

export default {
  fetch(request: Request, env: CloudflareEnv, context: WorkerContext): Promise<Response> {
    const app = createApp(createCloudflarePorts(env));
    const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
    return withEdgeCache(
      request,
      (current) => app.fetch(current),
      cache,
      (task) => context.waitUntil(task),
    );
  },
};
