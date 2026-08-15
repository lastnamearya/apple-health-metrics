import type { DayRecord } from "./types";

/**
 * Shared between the single-day form and the bulk paste-in — both build a
 * DayRecord from the same eight fields, just gathered differently.
 */
export const MANUAL_FIELDS = [
  { key: "steps", label: "Steps", placeholder: "10412" },
  { key: "hrvMs", label: "HRV (ms)", placeholder: "41" },
  { key: "asleep", label: "Asleep (min)", placeholder: "401" },
  { key: "inBed", label: "In bed (min)", placeholder: "452" },
  { key: "deep", label: "Deep (min)", placeholder: "62" },
  { key: "rem", label: "REM (min)", placeholder: "107" },
  { key: "hrMin", label: "Resting bpm (min)", placeholder: "56" },
  { key: "hrAvg", label: "Resting bpm (avg)", placeholder: "61" },
] as const;

export type ManualFieldKey = (typeof MANUAL_FIELDS)[number]["key"];

export function numFrom(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildDayRecord(
  date: string,
  values: Partial<Record<ManualFieldKey, number | null>>
): DayRecord {
  const asleep = values.asleep ?? null;
  const inBed = values.inBed ?? asleep;
  const deep = values.deep ?? 0;
  const rem = values.rem ?? 0;
  const hrMin = values.hrMin ?? null;

  return {
    date,
    steps: values.steps ?? null,
    hrvMs: values.hrvMs ?? null,
    sleep:
      asleep && inBed
        ? {
            inBedMinutes: inBed,
            asleepMinutes: asleep,
            coreMinutes: Math.max(0, asleep - deep - rem),
            deepMinutes: deep,
            remMinutes: rem,
            awakeMinutes: Math.max(0, inBed - asleep),
            bedtime: "",
            wakeTime: "",
          }
        : null,
    restingHeartRate: hrMin
      ? { minBpm: hrMin, avgBpm: values.hrAvg ?? hrMin }
      : null,
    vo2Max: null,
  };
}

/* ---------------------------------------------------------- bulk parsing -- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BulkRow {
  raw: string;
  date: string | null;
  record: DayRecord | null;
  error: string | null;
}

/**
 * One day per line, comma- or tab-separated (spreadsheets paste as tab).
 * Column order matches MANUAL_FIELDS, date first. A leading "date" header
 * row is skipped. Missing trailing columns are fine — those fields are just
 * left blank, same as an untouched field in the single-day form.
 */
export function parseBulkText(text: string): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: BulkRow[] = [];

  for (const line of lines) {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = line.split(delimiter).map((c) => c.trim());
    const [dateCell, ...rest] = cells;

    if (dateCell?.toLowerCase() === "date") continue;

    if (!dateCell || !DATE_RE.test(dateCell)) {
      rows.push({
        raw: line,
        date: null,
        record: null,
        error: `"${dateCell || line}" isn't a YYYY-MM-DD date`,
      });
      continue;
    }

    const values: Partial<Record<ManualFieldKey, number | null>> = {};
    let error: string | null = null;

    MANUAL_FIELDS.forEach((field, i) => {
      const cell = rest[i];
      if (cell === undefined || cell === "") return;
      const n = Number(cell);
      if (!Number.isFinite(n)) {
        error = `"${cell}" (${field.label}) isn't a number`;
        return;
      }
      values[field.key] = n;
    });

    rows.push({
      raw: line,
      date: dateCell,
      record: error ? null : buildDayRecord(dateCell, values),
      error,
    });
  }

  return rows;
}
