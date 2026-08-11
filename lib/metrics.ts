import {
  BASELINES,
  CHALLENGE_LENGTH,
  CHALLENGE_START,
  SLEEP_TARGETS,
  STEP_GOAL,
} from "./config";
import type { DayRecord, SleepStages } from "./types";

/* ---------------------------------------------------------------- dates -- */

export function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return todayIso(d);
}

export function dayIndex(iso: string): number {
  const ms = toDate(iso).getTime() - toDate(CHALLENGE_START).getTime();
  return Math.round(ms / 86_400_000) + 1; // Day 1 is the start date itself
}

export function shortDate(iso: string): string {
  return toDate(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function weekdayLetter(iso: string): string {
  return toDate(iso).toLocaleDateString("en-IN", { weekday: "narrow" });
}

/* ---------------------------------------------------------------- sleep -- */

/**
 * Apple Health does not export a sleep score. watchOS shows one in the UI,
 * but it isn't a HealthKit sample type, so it never reaches an export file.
 * This computes our own out of the four things that *are* exported, weighted
 * by how much each one actually moves how a night feels.
 *
 * Duration is worth the most because nothing else compensates for being short.
 * Stage shares are scored as bands rather than targets — being inside a healthy
 * range earns full credit, and there's no bonus for overshooting.
 */
export function sleepScore(sleep: SleepStages): number {
  const { asleepMinutes, inBedMinutes, deepMinutes, remMinutes } = sleep;
  if (asleepMinutes <= 0) return 0;

  // Duration — 40 points, linear up to target, capped.
  const duration = Math.min(1, asleepMinutes / SLEEP_TARGETS.durationMinutes) * 40;

  // Deep — 20 points.
  const deep = bandScore(deepMinutes / asleepMinutes, SLEEP_TARGETS.deepShare) * 20;

  // REM — 20 points.
  const rem = bandScore(remMinutes / asleepMinutes, SLEEP_TARGETS.remShare) * 20;

  // Efficiency — 20 points, how much of your time in bed was actually sleep.
  const efficiency =
    Math.min(1, asleepMinutes / inBedMinutes / SLEEP_TARGETS.efficiency) * 20;

  return Math.round(duration + deep + rem + efficiency);
}

/** Full credit inside the band, tapering off outside it. */
function bandScore(value: number, band: { min: number; max: number }): number {
  if (value >= band.min && value <= band.max) return 1;
  const distance = value < band.min ? band.min - value : value - band.max;
  const tolerance = (band.max - band.min) * 1.5;
  return Math.max(0, 1 - distance / tolerance);
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Solid";
  if (score >= 55) return "Light";
  return "Poor";
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/* --------------------------------------------------------------- streak -- */

export interface StreakCell {
  date: string;
  day: number;
  steps: number | null;
  hit: boolean;
  status: "hit" | "missed" | "today" | "upcoming";
}

export function buildStreak(days: DayRecord[], today = todayIso()): StreakCell[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: StreakCell[] = [];

  for (let i = 0; i < CHALLENGE_LENGTH; i++) {
    const date = addDays(CHALLENGE_START, i);
    const steps = byDate.get(date)?.steps ?? null;
    const hit = steps !== null && steps >= STEP_GOAL;

    let status: StreakCell["status"];
    if (date > today) status = "upcoming";
    else if (date === today) status = hit ? "hit" : "today";
    else status = hit ? "hit" : "missed";

    cells.push({ date, day: i + 1, steps, hit, status });
  }

  return cells;
}

/* --------------------------------------------------------------- trends -- */

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compares the most recent `window` readings against everything before them.
 * Returns null when there isn't enough history for the comparison to mean
 * anything — an unknown trend is more honest than a trend built on two points.
 */
export function trendDelta(values: number[], window = 3): number | null {
  if (values.length < window * 2) return null;
  const recent = values.slice(-window);
  const prior = values.slice(0, -window);
  return mean(recent) - mean(prior);
}

export function relativeToBaseline(
  value: number,
  baseline: number
): { delta: number; pct: number } {
  const delta = value - baseline;
  return { delta, pct: (delta / baseline) * 100 };
}

export { BASELINES, STEP_GOAL, CHALLENGE_LENGTH, CHALLENGE_START };
