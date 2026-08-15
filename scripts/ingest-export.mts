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

// Merge with existing data
const outPath = resolve("data/health.json");
let existingData: { days: typeof result.days } = { days: [] };
try {
  const existing = readFileSync(outPath, "utf-8");
  existingData = JSON.parse(existing);
} catch {
  console.log("No existing data found, starting fresh.");
}

// Create a map of existing days by date for easy lookup
const existingMap = new Map(existingData.days.map(d => [d.date, d]));

// Merge field-by-field, not whole-record: a partial export (e.g. one that
// only covers Step Count) must not null out fields — like restingHeartRate —
// that only a *different* export (raw Heart Rate) can populate. A new day's
// field wins only when it actually has a value; null/undefined defers to
// whatever the existing record already had.
for (const newDay of result.days) {
  const existing = existingMap.get(newDay.date);
  if (!existing) {
    existingMap.set(newDay.date, newDay);
    continue;
  }
  existingMap.set(newDay.date, {
    date: newDay.date,
    steps: newDay.steps ?? existing.steps,
    hrvMs: newDay.hrvMs ?? existing.hrvMs,
    sleep: newDay.sleep ?? existing.sleep,
    restingHeartRate: newDay.restingHeartRate ?? existing.restingHeartRate,
    vo2Max: newDay.vo2Max ?? existing.vo2Max,
  });
}

// Convert back to array and sort by date
const mergedDays = Array.from(existingMap.values()).sort((a, b) => 
  a.date.localeCompare(b.date)
);

writeFileSync(outPath, JSON.stringify({ days: mergedDays }, null, 2) + "\n");
console.log(`\nMerged ${result.days.length} new days. Total: ${mergedDays.length} days in ${outPath}`);
