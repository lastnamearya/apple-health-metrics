"use client";

import seed from "@/data/health.json";
import { SleepPanel } from "./sleep-panel";
import { StepsChart } from "./steps-chart";
import { TrendChart } from "./trend-chart";
import { Delta, Panel, Stat } from "./ui";
import {
  BASELINES,
  dayIndex,
  mean,
  scoreLabel,
  shortDate,
  sleepScore,
  todayIso,
  trendDelta,
} from "@/lib/metrics";
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

  const vo2Series = days.filter((d) => d.vo2Max !== null);
  const recentVo2 = vo2Series.slice(-9);
  const avgVo2Last7 =
    recentVo2.length > 0
      ? (
          recentVo2.reduce((sum, d) => sum + d.vo2Max!, 0) / recentVo2.length
        ).toFixed(1)
      : "—";

  const sleepScores = days
    .filter((d) => d.sleep !== null)
    .map((d) => ({ date: d.date, score: sleepScore(d.sleep!) }));
  const latestSleepScore = sleepScores.at(-1);
  const recentSleepScores = sleepScores.slice(-7);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          Jigyasu · Health Metrics
        </p>
        <p className="font-mono text-[11px] text-ink-faint">
          Day {dayIndex(todayIso())} of 21
        </p>
      </header>

      <div className="rise space-y-4">
        <div className="grid gap-4">
          <Panel
            eyebrow="Movement"
            title="Daily steps"
            aside={
              <Stat
                value={Math.round(mean(stepValues)).toLocaleString("en-IN")}
                label="daily average"
              />
            }
          >
            <StepsChart days={days} />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            eyebrow="Recovery"
            title="Heart rate variability"
            aside={
              <Stat
                value={formatHrv(
                  mean(
                    hrvSeries
                      .slice(-7)
                      .filter((d) => d.hrvMs !== null)
                      .map((d) => d.hrvMs!)
                  )
                )}
                unit="ms"
                label="7-day avg"
                tone="flare"
              />
            }
          >
            <TrendChart
              points={hrvSeries.slice(-7).map((d) => ({
                label: shortDate(d.date),
                value: d.hrvMs!,
              }))}
              unit="ms"
            />
          </Panel>

          <Panel
            eyebrow="Cardio Fitness"
            title="VO2 Max"
            aside={
              <Stat
                value={recentVo2.at(-1)?.vo2Max?.toFixed(2) ?? "—"}
                unit="ml/kg/min"
                label="latest"
                tone="flare"
              />
            }
          >
            <TrendChart
              points={recentVo2.map((d) => ({
                label: shortDate(d.date),
                value: d.vo2Max!,
              }))}
              unit="ml/kg/min"
            />
          </Panel>
        </div>

        <div className="grid gap-4">
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
              percentile), not Apple's own Resting Heart Rate figure — that one
              can take a day or two to settle after export, so it's sometimes
              stale by the time you check it.
            </p>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SleepPanel days={days} />

          <Panel
            eyebrow="Sleep"
            title="Sleep score, last 7 nights"
            aside={
              latestSleepScore && (
                <div>
                  <p className="nums font-display text-3xl font-800 leading-none text-flare">
                    {latestSleepScore.score}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                    {scoreLabel(latestSleepScore.score)}
                  </p>
                </div>
              )
            }
          >
            <TrendChart
              points={recentSleepScores.map((d) => ({
                label: shortDate(d.date),
                value: d.score,
              }))}
              unit="pts"
            />
          </Panel>
        </div>
      </div>

      <footer className="mt-10 border-t border-line pt-5 font-mono text-[10px] leading-relaxed text-ink-faint" />
    </main>
  );
}
