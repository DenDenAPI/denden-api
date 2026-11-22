import { resolve } from "node:path";
import { validateDataset } from "../data/validate.js";

const root = resolve(process.argv[2] ?? "../denden-data");
const { issues, ...collections } = validateDataset(root);

console.log(`Dataset: ${root}`);
for (const [name, records] of Object.entries(collections)) {
  console.log(`${name}: ${records.length}`);
}

if (issues.length > 0) {
  console.error(`\n${issues.length} issue(s):`);
  for (const issue of issues.slice(0, 60)) console.error(`- ${issue}`);
  if (issues.length > 60) console.error(`...and ${issues.length - 60} more`);
  process.exitCode = 1;
} else {
  console.log("No issues found.");
}
