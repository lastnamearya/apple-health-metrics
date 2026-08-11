import { Panel, Stat } from "./ui";
import { formatDuration, scoreLabel, shortDate, sleepScore } from "@/lib/metrics";
import type { DayRecord } from "@/lib/types";

const STAGES = [
  { key: "deepMinutes", label: "Deep", className: "bg-flare-deep" },
  { key: "remMinutes", label: "REM", className: "bg-flare" },
  { key: "coreMinutes", label: "Core", className: "bg-flare/35" },
  { key: "awakeMinutes", label: "Awake", className: "bg-line" },
] as const;

export function SleepPanel({ days }: { days: DayRecord[] }) {
  const nights = days.filter((d) => d.sleep !== null);
  const latest = nights.at(-1);

  if (!latest?.sleep) {
    return (
      <Panel eyebrow="Sleep" title="No nights recorded yet">
        <p className="text-sm text-ink-soft">
          Sleep shows up here once an export includes sleep analysis. Check that
          the metric is selected in your Health Auto Export automation.
        </p>
      </Panel>
    );
  }

  const score = sleepScore(latest.sleep);
  const avgScore = Math.round(
    nights.reduce((sum, d) => sum + sleepScore(d.sleep!), 0) / nights.length
  );

  return (
    <Panel
      eyebrow="Sleep"
      title={`Night of ${shortDate(latest.date)}`}
      aside={
        <div>
          <p className="nums font-display text-3xl font-800 leading-none text-flare">
            {score}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {scoreLabel(score)}
          </p>
        </div>
      }
    >
      {/* stage composition — one bar, proportional, no legend needed twice */}
      <div className="mb-1.5 flex h-9 w-full overflow-hidden rounded-lg">
        {STAGES.map((stage) => {
          const minutes = latest.sleep![stage.key];
          const pct = (minutes / latest.sleep!.inBedMinutes) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={stage.key}
              className={stage.className}
              style={{ width: `${pct}%` }}
              title={`${stage.label} — ${formatDuration(minutes)}`}
            />
          );
        })}
      </div>
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-soft">
        {STAGES.map((stage) => (
          <span key={stage.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${stage.className}`} />
            {stage.label} {formatDuration(latest.sleep![stage.key])}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-line pt-4">
        <Stat
          value={formatDuration(latest.sleep.asleepMinutes)}
          label="Asleep"
        />
        <Stat
          value={`${Math.round(
            (latest.sleep.asleepMinutes / latest.sleep.inBedMinutes) * 100
          )}%`}
          label="Efficiency"
        />
        <Stat value={String(avgScore)} label={`${nights.length}-night average`} />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
        Apple Health has no exportable sleep score, so this one is computed here
        from duration, deep and REM share, and efficiency. The weighting lives in{" "}
        <code className="font-mono text-ink-soft">lib/config.ts</code>.
      </p>
    </Panel>
  );
}
