import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import { parse } from "yaml";
import { buildOutput } from "../build/model.js";
import { insertStatements, SCHEMA } from "../build/sql.js";
import { validateDataset } from "../data/validate.js";
import { AttributionSchema } from "../schemas/attribution.js";

const dataRoot = resolve(process.argv[2] ?? "../denden-data");
const outDir = resolve(process.argv[3] ?? "dist");

const { issues, ...dataset } = validateDataset(dataRoot);
if (issues.length > 0) {
  console.error(`Dataset has ${issues.length} issue(s). Run validate:data for details.`);
  process.exit(1);
}

const attribution = AttributionSchema.parse(parse(readFileSync(join(dataRoot, "ATTRIBUTION.yaml"), "utf8")));
const output = buildOutput(dataset, attribution);

rmSync(outDir, { recursive: true, force: true });
for (const [path, document] of output.documents) {
  const file = join(outDir, "assets", `${path}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(document));
}

const database = new DatabaseSync(join(outDir, "denden.sqlite"));
const sql = createWriteStream(join(outDir, "d1.sql"), "utf8");
sql.write(SCHEMA);
database.exec(SCHEMA);
database.exec("BEGIN");
for (const statement of insertStatements(output)) {
  database.exec(statement);
  if (!sql.write(`${statement}\n`)) await once(sql, "drain");
}
database.exec("COMMIT");
database.close();
sql.end();
await once(sql, "finish");

console.log(`Documents: ${output.documents.size}`);
console.log(`Records: ${output.records.length}`);
console.log(`Facets: ${output.facets.length}`);
console.log(`Output: ${outDir}`);
