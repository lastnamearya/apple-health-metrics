import type { DayRecord } from "./types";

const STORAGE_KEY = "health-dashboard:days:v1";

/**
 * v1 keeps everything in the browser. Nothing leaves the device, which is a
 * reasonable place to be for health data until there's a server worth trusting.
 * When the REST ingest lands, this module is the only thing that changes.
 */

export function loadDays(): DayRecord[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(migrateDay) : null;
  } catch {
    return null;
  }
}

/**
 * Records saved before `sleepingHeartRate` was renamed to `restingHeartRate`
 * still carry the old key in localStorage. Without this, the field reads as
 * `undefined` rather than `null` and slips past `!== null` checks.
 */
function migrateDay(raw: unknown): DayRecord {
  const day = raw as DayRecord & { sleepingHeartRate?: DayRecord["restingHeartRate"] };
  if (day.restingHeartRate === undefined && "sleepingHeartRate" in day) {
    const { sleepingHeartRate, ...rest } = day;
    return { ...rest, restingHeartRate: sleepingHeartRate ?? null };
  }
  return day;
}

export function saveDays(days: DayRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

export function clearDays(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Upsert by date. Incoming fields win, but only where they actually carry a
 * value — a partial export that omits sleep shouldn't wipe the sleep you
 * already had for that night.
 */
export function mergeDays(
  existing: DayRecord[],
  incoming: DayRecord[]
): DayRecord[] {
  const merged = new Map(existing.map((d) => [d.date, { ...d }]));

  for (const day of incoming) {
    const current = merged.get(day.date);
    if (!current) {
      merged.set(day.date, { ...day });
      continue;
    }
    merged.set(day.date, {
      date: day.date,
      steps: day.steps ?? current.steps,
      hrvMs: day.hrvMs ?? current.hrvMs,
      sleep: day.sleep ?? current.sleep,
      restingHeartRate: day.restingHeartRate ?? current.restingHeartRate,
      vo2Max: day.vo2Max ?? current.vo2Max,
    });
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function exportDays(days: DayRecord[]): void {
  const blob = new Blob([JSON.stringify({ days }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `health-data-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
