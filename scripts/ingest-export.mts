/**
 * One-off / occasional CLI ingest: parse a Health Auto Export JSON file with
 * the same parser the browser drop-zone uses, and write the result over
 * data/health.json — the app's fallback dataset when nothing is in
 * localStorage. Run with: node scripts/ingest-export.ts <path-to-export.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHealthAutoExport, type HaeExport } from "../lib/health-auto-export.ts";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/ingest-export.ts <path-to-export.json>");
  process.exit(1);
}

const raw = readFileSync(resolve(inputPath), "utf-8");
const payload = JSON.parse(raw) as HaeExport;

if (!payload?.data?.metrics) {
  console.error("No data.metrics array found — is this a Health Auto Export file?");
  process.exit(1);
}

const result = parseHealthAutoExport(payload);

console.log(`Parsed ${result.days.length} days.`);
if (result.warnings.length) {
  console.log("\nWarnings:");
  for (const w of result.warnings) console.log(`  - ${w}`);
}
if (result.ignored.length) {
  console.log(`\nIgnored series: ${result.ignored.join(", ")}`);
}

const outPath = resolve("data/health.json");
writeFileSync(outPath, JSON.stringify({ days: result.days }, null, 2) + "\n");
console.log(`\nWrote ${result.days.length} days to ${outPath}`);
