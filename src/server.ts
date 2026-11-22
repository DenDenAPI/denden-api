import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createNodePorts } from "./adapters/node.js";
import { createApp } from "./api/app.js";

const port = Number(process.env.PORT ?? 8787);
const requestLimit = Number(process.env.RATE_LIMIT ?? 60);
const app = createApp(createNodePorts(resolve(process.env.DIST_DIR ?? "dist"), requestLimit));

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`DenDen API listening on http://127.0.0.1:${port}/api/v1`);
});
