"use client";

import seed from "@/data/health.json";
import { SleepPanel } from "./sleep-panel";
import { StepsChart } from "./steps-chart";
import { TrendChart } from "./trend-chart";
import { Delta, Panel, Stat } from "./ui";
import { BASELINES, mean, shortDate, todayIso, trendDelta } from "@/lib/metrics";
import type { HealthDataset } from "@/lib/types";

const DAYS = (seed as HealthDataset).days;

/**
 * Display formatting only. hrvMs is rounded at parse time, but manual entry
 * can still carry decimals — trims trailing zeros without altering anything.
 */
function formatHrv(value: number | null | undefined): string {
  if (value == null) return "—";
  return String(Number(value.toFixed(1)));
}

export function Dashboard() {
  const days = DAYS;

  const hrvSeries = days.filter((d) => d.hrvMs !== null);
  const hrSeries = days.filter((d) => d.restingHeartRate != null);
  const hrValues = hrSeries.map((d) => d.restingHeartRate!.avgBpm);
  const latestHr = hrSeries.at(-1)?.restingHeartRate;
  const stepValues = days.filter((d) => d.steps !== null).map((d) => d.steps!);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          Health · Apple Watch
        </p>
        <p className="font-mono text-[11px] text-ink-faint">
          through {shortDate(todayIso())}
        </p>
      </header>

      <div className="rise space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel
            eyebrow="Movement"
            title="Daily steps"
            className="lg:col-span-2"
            aside={
              <Stat
                value={Math.round(mean(stepValues)).toLocaleString("en-IN")}
                label="daily average"
              />
            }
          >
            <StepsChart days={days} />
          </Panel>

          <Panel
            eyebrow="Recovery"
            title="Heart rate variability"
            aside={
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                daily average
              </span>
            }
          >
            <div className="mb-4">
              <Stat
                value={formatHrv(hrvSeries.at(-1)?.hrvMs)}
                unit="ms"
                label={
                  hrvSeries.length
                    ? shortDate(hrvSeries.at(-1)!.date)
                    : "No reading"
                }
                tone="flare"
              />
            </div>
            <TrendChart
              points={hrvSeries.map((d) => ({
                label: shortDate(d.date),
                value: d.hrvMs!,
              }))}
              unit="ms"
            />
            <ol className="mt-4 space-y-1.5 border-t border-line pt-3">
              {hrvSeries
                .slice(-5)
                .reverse()
                .map((d) => (
                  <li
                    key={d.date}
                    className="nums flex items-baseline justify-between font-mono text-[11px]"
                  >
                    <span className="text-ink-faint">{shortDate(d.date)}</span>
                    <span className="text-ink">{formatHrv(d.hrvMs)}</span>
                  </li>
                ))}
            </ol>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SleepPanel days={days} />

          <Panel
            eyebrow="Recovery"
            title="Resting heart rate"
            aside={
              <Delta
                value={trendDelta(hrValues)}
                suffix=" bpm"
                goodDirection="down"
              />
            }
          >
            <div className="mb-4">
              <Stat
                value={String(latestHr?.avgBpm ?? "—")}
                unit="bpm"
                label="Latest reading"
                tone="flare"
              />
            </div>
            <TrendChart
              points={hrSeries.map((d) => ({
                label: shortDate(d.date),
                value: d.restingHeartRate!.avgBpm,
              }))}
              baseline={BASELINES.restingHrBpm}
              baselineLabel="your baseline"
              unit="bpm"
              color="var(--color-calm)"
            />
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Derived from the day's raw heart-rate samples (roughly the 1st
              percentile), not Apple's own Resting Heart Rate figure — that
              one can take a day or two to settle after export, so it's
              sometimes stale by the time you check it.
            </p>
          </Panel>
        </div>
      </div>

      <footer className="mt-10 border-t border-line pt-5 font-mono text-[10px] leading-relaxed text-ink-faint">
        Data comes from data/health.json, updated via `npm run ingest`.
      </footer>
    </main>
  );
}
