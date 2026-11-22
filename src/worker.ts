import { createCloudflarePorts, type CloudflareEnv } from "./adapters/cloudflare.js";
import { createApp } from "./api/app.js";

export default {
  fetch(request: Request, env: CloudflareEnv): Response | Promise<Response> {
    return createApp(createCloudflarePorts(env)).fetch(request);
  },
};
