/**
 * The shape below is deliberately close to what Health Auto Export emits,
 * so swapping the seed JSON for real exports is a parsing change, not a
 * redesign. Every field is nullable: a missing day should render as missing,
 * never as a zero.
 */

export interface SleepStages {
  /** Minutes between getting into bed and getting out of it. */
  inBedMinutes: number;
  /** Minutes actually asleep (core + deep + REM). */
  asleepMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  /** ISO local times, used for the consistency read. */
  bedtime: string;
  wakeTime: string;
}

export interface RestingHeartRate {
  /**
   * Derived from raw heart_rate samples (roughly the day's 1st percentile),
   * not Apple's own `resting_heart_rate` Vitals figure — that one can take a
   * day or two to settle after export. avgBpm and minBpm carry the same
   * value; the split exists for manual entry, where they can genuinely
   * differ. See deriveRestingHeartRate() in lib/health-auto-export.ts.
   */
  avgBpm: number;
  minBpm: number;
}

export interface DayRecord {
  /** YYYY-MM-DD, local date the day belongs to. */
  date: string;
  steps: number | null;
  /** HRV SDNN in milliseconds, daily average. */
  hrvMs: number | null;
  sleep: SleepStages | null;
  restingHeartRate: RestingHeartRate | null;
}

export interface HealthDataset {
  days: DayRecord[];
}
