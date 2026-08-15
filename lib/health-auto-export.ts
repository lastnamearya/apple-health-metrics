import type { DayRecord, SleepStages, RestingHeartRate } from "./types";

/**
 * Health Auto Export's real payload shape.
 *
 * Every sample carries `start`, `end`, `date` and `source`, and there can be
 * more than one sample per day per metric. How they collapse into a single
 * daily figure depends on the metric — steps add up, HRV averages — so the
 * aggregation is declared per series in METRIC_SPECS below.
 */

export interface HaeSample {
  date: string;
  start?: string;
  end?: string;
  source?: string;
  qty?: number;
  Avg?: number;
  Min?: number;
  Max?: number;
  // Sleep-analysis samples come in two shapes depending on HAE/watchOS
  // version: an aggregated one-row-per-night total (asleep/core/deep/rem/...)
  // handled by normalizeSleep(), or a modern one-row-per-stage-interval shape
  // (value: "Core"/"Deep"/"REM"/"Awake" with its own start/end) handled by
  // buildSleepSessions(). `value` is how the two are told apart.
  asleep?: number;
  totalSleep?: number;
  core?: number;
  deep?: number;
  rem?: number;
  awake?: number;
  inBed?: number;
  sleepStart?: string;
  sleepEnd?: string;
  inBedStart?: string;
  inBedEnd?: string;
  value?: string;
}

export interface HaeMetric {
  name: string;
  units?: string;
  data: HaeSample[];
}

export interface HaeExport {
  data: {
    metrics: HaeMetric[];
    workouts?: unknown[];
  };
}

/* ------------------------------------------------------------ timestamps -- */

/**
 * HAE timestamps look like "2026-08-03 04:00:00 +0530", which is not valid
 * ISO-8601. Safari and Chrome disagree about what to do with it, and Safari
 * often returns Invalid Date. Normalize before handing it to Date.
 */
export function parseHaeTimestamp(value: string): Date | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(" ", "T")
    .replace(/\s?([+-])(\d{2}):?(\d{2})$/, "$1$2:$3");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The calendar day a sample belongs to. The leading 10 characters are already
 * the local date in the exporter's own timezone, which is what we want —
 * converting to UTC first would shift late-night samples a day backwards.
 */
export function localDay(timestamp: string): string {
  return (timestamp ?? "").slice(0, 10);
}

/** HAE metric names vary in case and separator across app versions. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Device names like "Jigyasu's Apple Watch" come through with a
 * non-breaking space (U+00A0) between "Apple" and "Watch" — Apple's own
 * typography for the trademark, to stop it line-wrapping in their UI. A
 * plain `.includes("Apple Watch")` never matches that, so source
 * preference silently fails for every real Watch. Normalize before compare.
 */
function normalizeDeviceName(name: string | undefined): string {
  return (name ?? "").replace(/ /g, " ");
}

/* ----------------------------------------------------------------- specs -- */

type Aggregation = "sum" | "avg" | "min" | "max" | "last";
type Field = "steps" | "hrvMs" | "vo2Max";

interface MetricSpec {
  field: Field;
  aggregation: Aggregation;
  scale?: number;
  round?: boolean;
  /** Round down instead of to nearest. Steps only — see METRIC_SPECS. */
  floor?: boolean;
}

/**
 * Aliases are listed because HAE has renamed several series over the years,
 * so an older export won't use the current identifier.
 */
const METRIC_SPECS: Record<string, MetricSpec> = {
  // When both an Apple Watch and iPhone are active (Preferred Source "All"
  // in Health Auto Export), a *fine-grained* (per-second/minute) export
  // gives step_count samples with a joined source like "Apple Watch|iPhone
  // (2)" for any instant both devices contributed to, and HealthKit sums
  // rather than dedupes those — summing runs ~6-10% above what the Health
  // app itself displays for the day. There's no "prefer Watch, fall back to
  // iPhone" export option (Preferred Source is exclusive: one device or
  // "All"), so picking a single device instead would undercount far worse.
  //
  // The real fix: turn on "Summarize Data" for Step Count specifically in
  // Health Auto Export. At day granularity, HealthKit's own statistics
  // query reconciles overlapping devices correctly — validated against real
  // exports, it matches the Health app's displayed total almost exactly.
  // Don't do this for Heart Rate too, though — resting heart rate below is
  // derived from many raw samples per day, and a summarized one-row-per-day
  // Min/Max/Avg isn't enough signal for that percentile calculation.
  //
  // Apple's own displayed step count truncates the fractional daily total
  // rather than rounding to nearest — verified against 13 real days: every
  // day where the raw qty had a fractional part ≥0.5 (e.g. 11945.924),
  // Math.round would overcount by 1 (11946) while the Health app showed the
  // floored value (11945). Floor here, not round, to match.
  step_count: { field: "steps", aggregation: "sum", round: true, floor: true },
  steps: { field: "steps", aggregation: "sum", round: true, floor: true },

  // A day carries one SDNN sample roughly every 5-15 minutes (mostly
  // overnight), not one reading total — Health's own daily HRV figure is
  // the mean of those. Validated against real Vitals values across four
  // days (matched to within rounding on all four).
  heart_rate_variability: { field: "hrvMs", aggregation: "avg", round: true },
  heart_rate_variability_sdnn: { field: "hrvMs", aggregation: "avg", round: true },

  // VO2 Max can have multiple readings per day — average them.
  vo2_max: { field: "vo2Max", aggregation: "avg", round: false },
};

/** Series handled specially rather than through METRIC_SPECS. */
const SLEEP_NAMES = new Set(["sleep_analysis", "sleep"]);
const HEART_RATE_NAMES = new Set(["heart_rate"]);

/**
 * Apple's own `resting_heart_rate` is recognized but deliberately unused —
 * it's HealthKit's own calculation, which can take a day or two to settle
 * after export, so an export can carry a stale number even when the source
 * is right. Resting heart rate is derived from raw heart_rate samples
 * instead (see restingHeartRateByDay below), which has no such lag.
 */
const IGNORED_KNOWN_NAMES = new Set(["resting_heart_rate"]);

/* --------------------------------------------------------------- parsing -- */

/**
 * Sources dropped entirely before parsing, regardless of what metric they
 * write to. Athlytic wrote its own independently-computed Resting Heart
 * Rate into HealthKit, which then got averaged in alongside the Watch's —
 * it's since been deleted, so its samples shouldn't be used even where it's
 * the only source for a given day.
 */
const DEFAULT_EXCLUDED_SOURCES = ["Athlytic"];

export interface ParseOptions {
  /**
   * When several devices report the same summed metric on the same day, prefer
   * this one. Without it, an iPhone in your pocket and a Watch on your wrist
   * both report step_count and adding them roughly doubles your count.
   */
  preferSource?: string;
  /** Sources to drop entirely before parsing. See DEFAULT_EXCLUDED_SOURCES. */
  excludeSources?: string[];
}

export interface ParseResult {
  days: DayRecord[];
  /** Metric names present in the file, so the UI can show what was found. */
  seen: string[];
  /** Metric names the parser has no handler for. */
  ignored: string[];
  warnings: string[];
}

export function parseHealthAutoExport(
  payload: HaeExport,
  options: ParseOptions = {}
): ParseResult {
  const metrics = payload?.data?.metrics ?? [];
  const preferSource = options.preferSource ?? "Apple Watch";
  const excludeSources = (options.excludeSources ?? DEFAULT_EXCLUDED_SOURCES).map((s) =>
    normalizeDeviceName(s).toLowerCase()
  );
  const isExcluded = (source: string | undefined) => {
    if (!source) return false;
    const normalized = normalizeDeviceName(source).toLowerCase();
    return excludeSources.some((excluded) => normalized.includes(excluded));
  };

  const days = new Map<string, DayRecord>();
  const buckets = new Map<Field, Map<string, number[]>>();
  const seen: string[] = [];
  const ignored: string[] = [];
  const warnings: string[] = [];

  const ensure = (date: string): DayRecord => {
    let record = days.get(date);
    if (!record) {
      record = {
        date,
        steps: null,
        hrvMs: null,
        sleep: null,
        restingHeartRate: null,
        vo2Max: null,
      };
      days.set(date, record);
    }
    return record;
  };

  const collect = (field: Field, date: string, value: number) => {
    if (!buckets.has(field)) buckets.set(field, new Map());
    const byDate = buckets.get(field)!;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(value);
  };

  // Raw heart-rate samples, kept aside so resting heart rate can be derived
  // per calendar day. dateStr is the original HAE string, not just the
  // parsed Date, so day-bucketing can use localDay() the same way every
  // other metric does rather than re-deriving a local date from a UTC instant.
  const heartRateSamples: { at: Date; bpm: number; dateStr: string }[] = [];

  for (const metric of metrics) {
    const name = normalizeName(metric.name ?? "");
    seen.push(metric.name);
    const samples = (metric.data ?? []).filter((s) => !isExcluded(s.source));

    if (IGNORED_KNOWN_NAMES.has(name)) continue;

    if (SLEEP_NAMES.has(name)) {
      const intervalSamples = samples.filter((s) => typeof s.value === "string");
      const legacySamples = samples.filter((s) => typeof s.value !== "string");

      for (const sample of legacySamples) {
        const date = localDay(sample.date ?? sample.sleepStart ?? "");
        if (!date) continue;
        ensure(date).sleep = normalizeSleep(sample);
      }

      for (const [date, stages] of buildSleepSessions(intervalSamples)) {
        ensure(date).sleep = stages;
      }
      continue;
    }

    if (HEART_RATE_NAMES.has(name)) {
      for (const sample of samples) {
        const dateStr = sample.date ?? sample.start ?? "";
        const at = parseHaeTimestamp(dateStr);
        const bpm = sample.Avg ?? sample.qty;
        if (at && bpm != null && dateStr) heartRateSamples.push({ at, bpm, dateStr });
      }
      continue;
    }

    const spec = METRIC_SPECS[name];
    if (!spec) {
      ignored.push(metric.name);
      continue;
    }

    // Source filtering. An averaged metric like resting heart rate gets
    // silently blended when two sources both write it — e.g. Apple Watch's
    // own reading averaged with a third-party app's independent one — so
    // prefer one source whenever more than one shows up. "sum" fields are
    // deliberately exempted: for steps specifically, Watch+iPhone samples
    // arrive pre-merged by HealthKit (see METRIC_SPECS), and a handful of
    // leftover genuinely-solo-source samples exist alongside them — filtering
    // to "preferred source only" would keep just that unrepresentative
    // sliver and discard almost the entire day's data, which is far worse
    // than the accepted ~6-10% overcount from summing everything.
    let relevant = samples;
    {
      const sources = new Set(samples.map((s) => s.source).filter(Boolean));
      if (sources.size > 1 && spec.aggregation !== "sum") {
        // A sample whose source is itself a join of multiple devices (e.g.
        // "Apple Watch|iPhone (2)") is HealthKit's own merged/summed figure
        // for that instant, not a genuine single-source reading — matching
        // it via .includes(preferSource) would silently accept an already-
        // blended (and for cumulative types like steps, likely inflated)
        // value as if it came from the preferred device alone.
        const preferred = samples.filter((s) => {
          const normalized = normalizeDeviceName(s.source);
          return !normalized.includes("|") && normalized.includes(preferSource);
        });
        if (preferred.length) {
          relevant = preferred;
          warnings.push(
            `${metric.name}: ${sources.size} sources present — used "${preferSource}" only, to avoid blending devices/apps.`
          );
        } else {
          warnings.push(
            `${metric.name}: ${sources.size} sources present and none matched "${preferSource}" — value may be skewed.`
          );
        }
      }
    }

    // A merged source label ("A|B") only signals real inflation risk when
    // the export is fine-grained (per-second/minute) — HealthKit sums each
    // device's contribution per instant there. At day-granularity ("Summarize
    // Data" on in Health Auto Export for this metric), the same label shows
    // up on an already-correctly-reconciled daily total instead — validated
    // against real data, it matches the Health app's own figure almost
    // exactly — so warning here would be a false positive. Tell the two
    // apart by sample density: many rows per day means raw/naively-summed,
    // ~1 per day means pre-aggregated by HealthKit itself.
    const distinctDays = new Set(
      relevant.map((s) => localDay(s.date ?? s.start ?? "")).filter(Boolean)
    ).size;
    const isFineGrained = distinctDays > 0 && relevant.length > distinctDays * 3;

    if (
      spec.aggregation === "sum" &&
      isFineGrained &&
      relevant.some((s) => (s.source ?? "").includes("|"))
    ) {
      warnings.push(
        `${metric.name}: samples are fine-grained and pre-merged across multiple devices — sum may run ~6-10% above the Health app's own total. Enabling "Summarize Data" for this metric in Health Auto Export avoids this.`
      );
    }

    for (const sample of relevant) {
      const date = localDay(sample.date ?? sample.start ?? "");
      const raw = sample.qty ?? sample.Avg;
      if (!date || raw == null) continue;
      collect(spec.field, date, raw * (spec.scale ?? 1));
    }
  }

  // Collapse each bucket into one number per day.
  for (const [field, byDate] of buckets) {
    const spec = Object.values(METRIC_SPECS).find((s) => s.field === field);
    if (!spec) continue;

    for (const [date, values] of byDate) {
      const value = aggregate(values, spec.aggregation);
      const rounded = spec.round ? (spec.floor ? Math.floor(value) : Math.round(value)) : value;
      const record = ensure(date);

      if (field === "steps") record.steps = rounded;
      else if (field === "hrvMs") record.hrvMs = rounded;
      else if (field === "vo2Max") record.vo2Max = rounded;
    }
  }

  // Resting heart rate: derived per calendar day from raw heart_rate
  // samples, not read from Apple's own resting_heart_rate Vitals figure
  // (see IGNORED_KNOWN_NAMES above for why).
  const byDay = new Map<string, number[]>();
  for (const sample of heartRateSamples) {
    const date = localDay(sample.dateStr);
    if (!date) continue;
    if (!byDay.has(date)) byDay.set(date, []);
    byDay.get(date)!.push(sample.bpm);
  }

  let derivedDays = 0;
  for (const [date, bpms] of byDay) {
    const derived = deriveRestingHeartRate(bpms);
    if (derived) {
      ensure(date).restingHeartRate = derived;
      derivedDays++;
    }
  }

  if (heartRateSamples.length === 0) {
    warnings.push(
      "No raw Heart Rate series in this export, so resting heart rate will be blank. Add Heart Rate to your automation."
    );
  } else if (derivedDays === 0) {
    warnings.push(
      `Heart Rate samples found, but no day had enough (${MIN_HEART_RATE_SAMPLES}+) to estimate resting heart rate from.`
    );
  }

  return {
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    seen,
    ignored,
    warnings,
  };
}

function aggregate(values: number[], how: Aggregation): number {
  if (!values.length) return 0;
  switch (how) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "last":
      return values[values.length - 1];
  }
}

/* ----------------------------------------------------------------- sleep -- */

/**
 * HAE reports stage totals in hours in most versions but minutes in some.
 * Anything at or under 24 is treated as hours — a 24-minute total of core
 * sleep is far more likely to be "0.4 hours" than a genuine 24 minutes.
 */
function toMinutes(value: number | undefined): number {
  if (value == null) return 0;
  return value <= 24 ? Math.round(value * 60) : Math.round(value);
}

/**
 * A gap this long between one stage interval ending and the next starting
 * means the Watch came off (charging, etc.) — treat what's on either side
 * as separate sleep sessions rather than one very broken night.
 */
const SLEEP_SESSION_GAP_MINUTES = 90;

/** Sessions shorter than this are naps/noise, not "the night's sleep". */
const MIN_SESSION_ASLEEP_MINUTES = 30;

type StageBucket = "core" | "deep" | "rem" | "awake" | "inBed" | "asleep";

/** HAE's stage names, tolerant of casing/spacing variants. */
function classifyStage(value: string): StageBucket {
  const s = value.toLowerCase();
  if (s.includes("deep")) return "deep";
  if (s.includes("rem")) return "rem";
  if (s.includes("core")) return "core";
  if (s.includes("awake")) return "awake";
  if (s.includes("bed")) return "inBed";
  return "asleep"; // e.g. plain "Asleep"/"AsleepUnspecified" — no stage detail
}

interface StageInterval {
  bucket: StageBucket;
  start: Date;
  end: Date;
  startRaw: string;
  endRaw: string;
}

/**
 * Modern HAE exports report sleep as one row per stage interval rather than
 * one row per night. Reconstruct nights by grouping consecutive intervals,
 * splitting wherever the gap between them exceeds SLEEP_SESSION_GAP_MINUTES,
 * then attribute each resulting session to the calendar date it ended on —
 * "last night's sleep" belongs to the day you woke up, same as Health's own UI.
 */
function buildSleepSessions(samples: HaeSample[]): Map<string, SleepStages> {
  const intervals: StageInterval[] = [];
  for (const sample of samples) {
    const startRaw = sample.start ?? sample.date;
    const endRaw = sample.end ?? sample.date;
    const start = parseHaeTimestamp(startRaw ?? "");
    const end = parseHaeTimestamp(endRaw ?? "");
    if (!start || !end || !sample.value) continue;
    intervals.push({ bucket: classifyStage(sample.value), start, end, startRaw: startRaw!, endRaw: endRaw! });
  }
  intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  const sessions: StageInterval[][] = [];
  let current: StageInterval[] = [];
  for (const interval of intervals) {
    const last = current.at(-1);
    if (last && interval.start.getTime() - last.end.getTime() > SLEEP_SESSION_GAP_MINUTES * 60_000) {
      sessions.push(current);
      current = [];
    }
    current.push(interval);
  }
  if (current.length) sessions.push(current);

  const byDate = new Map<string, SleepStages>();

  for (const session of sessions) {
    const minutesIn = (bucket: StageBucket) =>
      session
        .filter((i) => i.bucket === bucket)
        .reduce((sum, i) => sum + (i.end.getTime() - i.start.getTime()) / 60_000, 0);

    const core = minutesIn("core");
    const deep = minutesIn("deep");
    const rem = minutesIn("rem");
    const awake = minutesIn("awake");
    const explicitInBed = minutesIn("inBed");
    const unstaged = minutesIn("asleep");
    const asleep = core + deep + rem + unstaged;

    if (asleep < MIN_SESSION_ASLEEP_MINUTES) continue;

    const wakeTime = session[session.length - 1].endRaw;
    const date = localDay(wakeTime);
    if (!date) continue;

    const existing = byDate.get(date);
    if (existing && existing.asleepMinutes >= Math.round(asleep)) continue;

    byDate.set(date, {
      inBedMinutes: Math.round(asleep + awake + explicitInBed),
      asleepMinutes: Math.round(asleep),
      coreMinutes: Math.round(core),
      deepMinutes: Math.round(deep),
      remMinutes: Math.round(rem),
      awakeMinutes: Math.round(awake),
      bedtime: session[0].startRaw,
      wakeTime,
    });
  }

  return byDate;
}

export function normalizeSleep(sample: HaeSample): SleepStages {
  const core = toMinutes(sample.core);
  const deep = toMinutes(sample.deep);
  const rem = toMinutes(sample.rem);
  const awake = toMinutes(sample.awake);
  const asleep = toMinutes(sample.totalSleep ?? sample.asleep) || core + deep + rem;
  const inBed = toMinutes(sample.inBed) || asleep + awake;

  return {
    inBedMinutes: inBed,
    asleepMinutes: asleep,
    coreMinutes: core,
    deepMinutes: deep,
    remMinutes: rem,
    awakeMinutes: awake,
    bedtime: sample.sleepStart ?? sample.inBedStart ?? sample.start ?? "",
    wakeTime: sample.sleepEnd ?? sample.inBedEnd ?? sample.end ?? "",
  };
}

/* --------------------------------------------------- resting heart rate --- */

/** Below this many samples in a day, a 1st-percentile read is too noisy to trust. */
const MIN_HEART_RATE_SAMPLES = 20;

/**
 * Resting heart rate isn't a plain average of the day's heart rate (that's
 * dominated by activity — whole-day means run 85-120+ bpm) or the literal
 * minimum (a single sample can be sensor noise). The 1st percentile is a
 * calibrated middle ground: low enough to reflect genuine rest, but drawn
 * from several samples so one glitchy reading can't skew it. Validated
 * against real Health app Vitals values across multiple days — see the
 * conversation this was built in for how the percentile was chosen.
 */
export function deriveRestingHeartRate(bpms: number[]): RestingHeartRate | null {
  if (bpms.length < MIN_HEART_RATE_SAMPLES) return null;

  const sorted = [...bpms].sort((a, b) => a - b);
  const p1 = sorted[Math.floor(sorted.length * 0.01)];

  return { avgBpm: Math.round(p1), minBpm: Math.round(p1) };
}
