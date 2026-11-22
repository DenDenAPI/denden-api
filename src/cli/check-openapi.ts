import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { createNodePorts } from "../adapters/node.js";
import { createApp } from "../api/app.js";
import { COLLECTIONS, RESOURCES } from "../api/resources.js";
import { SCHEMA_NAMES } from "../openapi/spec.js";

const distDir = resolve(process.argv[2] ?? "dist");
const spec = JSON.parse(readFileSync(resolve(distDir, "assets/v1/openapi.json"), "utf8"));
const lastChapter: number = spec.info["x-dataset"].last_chapter;

const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const ajv = new Ajv2020({ strict: false, allErrors: true, validateSchema: false });
addFormats(ajv);
const SPEC_ID = "https://denden.test/openapi";
ajv.addSchema({ ...spec, $id: SPEC_ID });

const validatorFor = (name: string) => {
  const validator = ajv.getSchema(`${SPEC_ID}#/components/schemas/${name}`);
  if (!validator) throw new Error(`Missing schema ${name}`);
  return validator;
};

const app = createApp({ ...createNodePorts(distDir), rateLimiter: { allow: async () => true } });
const failures: string[] = [];
let checked = 0;

async function check(path: string, validate: ReturnType<typeof validatorFor>): Promise<void> {
  const response = await app.request(`https://api.test${path}`);
  if (response.status !== 200) {
    failures.push(`${path}: HTTP ${response.status}`);
    return;
  }
  checked += 1;
  if (!validate(await response.json())) {
    failures.push(`${path}: ${ajv.errorsText(validate.errors, { dataVar: "body" }).slice(0, 220)}`);
  }
}

function pagedValidator(pathTemplate: string) {
  const schema = spec.paths[pathTemplate].get.responses["200"].content["application/json"].schema;
  return ajv.compile(rebase(schema));
}

function rebase(value: unknown): Record<string, unknown> {
  const text = JSON.stringify(value).replaceAll('"#/components', `"${SPEC_ID}#/components`);
  return JSON.parse(text) as Record<string, unknown>;
}

for (const collection of COLLECTIONS) {
  const definition = RESOURCES[collection];
  const validate = validatorFor(SCHEMA_NAMES[collection]);
  await check(`/api/v1/${collection}?limit=100`, pagedValidator(`/api/v1/${collection}`));

  const subValidators = Object.fromEntries(
    Object.keys(definition.subresources).map((name) => [
      name,
      pagedValidator(`/api/v1/${collection}/{id}/${name}`),
    ]),
  );

  const index = (await (await app.request(`https://api.test/api/v1/attribution/${collection}?limit=100`)).json()) as {
    count: number;
  };
  const pages = Math.ceil(index.count / 100);
  for (let page = 1; page <= pages; page += 1) {
    const list = (await (
      await app.request(`https://api.test/api/v1/attribution/${collection}?limit=100&page=${page}`)
    ).json()) as { results: { url: string }[] };
    for (const { url } of list.results) {
      const path = new URL(url).pathname;
      await check(path, validate);
      if (definition.supportsSpoilerFilter) {
        const redacted = await app.request(`https://api.test${path}?until_chapter=${lastChapter}`);
        if (redacted.status === 200) {
          checked += 1;
          if (!validate(await redacted.json())) {
            failures.push(`${path}?until_chapter: ${ajv.errorsText(validate.errors).slice(0, 220)}`);
          }
        }
      }
      for (const [name, validator] of Object.entries(subValidators)) {
        await check(`${path}/${name}?limit=100`, validator);
      }
    }
  }
}

await check("/api/v1/search?q=luffy&limit=100", pagedValidator("/api/v1/search"));

console.log(`Paths in OpenAPI: ${Object.keys(spec.paths).length}`);
console.log(`Responses checked: ${checked}`);
if (failures.length > 0) {
  console.error(`${failures.length} failure(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("All responses match the OpenAPI document.");
}
