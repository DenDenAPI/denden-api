import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_BATCH_CHARS = 24_000;
const CONCURRENCY = 3;
const ATTEMPTS = 4;

const databaseName = process.argv[2] ?? "denden";
const sqlFile = resolve(process.argv[3] ?? "dist/d1.sql");
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");

async function execute(sql: string): Promise<void> {
  const args = [wrangler, "d1", "execute", databaseName, "--remote", "--yes", "--json", "--command", sql];
  for (let attempt = 1; ; attempt += 1) {
    try {
      await run(process.execPath, args, { maxBuffer: 8 * 1024 * 1024 });
      return;
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      await new Promise((done) => setTimeout(done, attempt * 2_000));
    }
  }
}

const lines = readFileSync(sqlFile, "utf8").split("\n");
const firstInsert = lines.findIndex((line) => line.startsWith("INSERT "));
const schema = lines.slice(0, firstInsert).join(" ").replace(/\s+/g, " ").trim();
const inserts = lines.slice(firstInsert).filter(Boolean);

const batches: string[] = [];
let current: string[] = [];
let size = 0;
for (const statement of inserts) {
  if (size + statement.length > MAX_BATCH_CHARS && current.length > 0) {
    batches.push(current.join(" "));
    current = [];
    size = 0;
  }
  current.push(statement);
  size += statement.length + 1;
}
if (current.length > 0) batches.push(current.join(" "));

console.log(`Loading ${inserts.length} rows in ${batches.length} batches into ${databaseName}.`);
await execute(schema);

let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < batches.length) {
      const batch = batches[next] as string;
      next += 1;
      await execute(batch);
      done += 1;
      if (done % 20 === 0 || done === batches.length) console.log(`${done}/${batches.length}`);
    }
  }),
);
console.log("Database loaded.");
