export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

type Handler = (request: Request) => Response | Promise<Response>;
type Defer = (task: Promise<unknown>) => void;

function conditional(request: Request, response: Response): Response {
  const etag = response.headers.get("ETag");
  if (response.status !== 200 || !etag || request.headers.get("If-None-Match") !== etag) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete("Content-Type");
  headers.delete("Content-Length");
  return new Response(null, { status: 304, headers });
}

/** Serve successful GET responses from the edge so repeated calls do not reach D1. */
export async function withEdgeCache(
  request: Request,
  handler: Handler,
  cache: EdgeCache | undefined,
  defer: Defer,
): Promise<Response> {
  if (!cache || request.method !== "GET") return handler(request);

  const key = new Request(request.url, { method: "GET" });
  const cached = await cache.match(key);
  if (cached) return conditional(request, cached);

  // The handler must produce a full body, so the stored entry is never a 304.
  const unconditional = new Request(request);
  unconditional.headers.delete("If-None-Match");
  const response = await handler(unconditional);
  if (response.status === 200) defer(cache.put(key, response.clone()));
  return conditional(request, response);
}
