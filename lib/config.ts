/**
 * Everything you'd want to change without touching component code.
 */

/** Day 1 of the 21-day challenge, YYYY-MM-DD. */
export const CHALLENGE_START = "2026-08-03";

/** Length of the challenge in days. */
export const CHALLENGE_LENGTH = 21;

/** Daily step goal. */
export const STEP_GOAL = 9_800;

/**
 * Targets used by the derived sleep score. These are population defaults;
 * once you have a few months of your own data, replace them with your
 * personal baselines — a score against someone else's normal isn't worth much.
 */
export const SLEEP_TARGETS = {
  /** Minutes asleep for a full-credit night. */
  durationMinutes: 450, // 7h30m
  /** Share of total sleep, as fractions. */
  deepShare: { min: 0.13, max: 0.23 },
  remShare: { min: 0.2, max: 0.25 },
  /** Asleep ÷ in bed. */
  efficiency: 0.9,
};

/**
 * Resting heart rate is read against a baseline. This is a placeholder until
 * there's enough history for a rolling 60-day median.
 *
 * HRV has no baseline here on purpose: it's displayed exactly as exported.
 */
export const BASELINES = {
  restingHrBpm: 58,
};
