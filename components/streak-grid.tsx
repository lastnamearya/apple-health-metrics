import { STEP_GOAL, buildStreak, shortDate } from "@/lib/metrics";
import type { DayRecord } from "@/lib/types";

/** Fill is capped above the goal so an overshoot day doesn't clip at 100%. */
const FILL_CAP = 1.35;

/**
 * The hero. Twenty-one cells, one per day of the challenge, each filled from
 * the bottom in proportion to that day's step count. The hairline across every
 * cell is the STEP_GOAL mark, so "did I clear it" is readable at a glance
 * without a single number being printed — and overshoot stays visible instead
 * of being flattened into a checkmark.
 */
export function StreakGrid({ days }: { days: DayRecord[] }) {
  const cells = buildStreak(days);
  const completed = cells.filter((c) => c.status === "hit").length;
  const elapsed = cells.filter((c) => c.status !== "upcoming").length;
  const maxFill = Math.round(STEP_GOAL * FILL_CAP);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-flare">
            21-day challenge
          </p>
          <h1 className="font-display text-3xl font-800 leading-none tracking-tight text-ink sm:text-4xl">
            Day {elapsed}
            <span className="text-ink-faint">/21</span>
          </h1>
        </div>
        <p className="nums text-sm text-ink-soft">
          <span className="font-display text-xl font-700 text-ink">{completed}</span>{" "}
          days cleared
          <span className="mx-2 text-line">·</span>
          <span className="font-display text-xl font-700 text-ink">
            {21 - elapsed}
          </span>{" "}
          to go
        </p>
      </header>

      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {cells.map((cell) => {
          const fill =
            cell.steps === null
              ? 0
              : Math.min(FILL_CAP, cell.steps / STEP_GOAL);
          const isUpcoming = cell.status === "upcoming";
          const isMissed = cell.status === "missed";

          return (
            <li key={cell.date} className="group relative">
              <div
                title={
                  cell.steps === null
                    ? `${shortDate(cell.date)} — no data yet`
                    : `${shortDate(cell.date)} — ${cell.steps.toLocaleString("en-IN")} steps`
                }
                className={`relative aspect-square overflow-hidden rounded-lg border transition-colors ${
                  isUpcoming
                    ? "border-dashed border-line bg-canvas"
                    : isMissed
                      ? "border-line bg-canvas"
                      : "border-flare/25 bg-flare-wash"
                }`}
              >
                {/* proportional fill */}
                {fill > 0 && (
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 bottom-0 ${
                      cell.hit ? "bg-flare" : "bg-flare/30"
                    }`}
                    style={{ height: `${Math.min(100, fill * 100)}%` }}
                  />
                )}

                {/* the STEP_GOAL line */}
                {!isUpcoming && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 border-t border-dotted border-ink/25"
                    style={{ bottom: `${(1 / FILL_CAP) * 100}%` }}
                  />
                )}

                <span
                  className={`nums absolute left-1 top-0.5 font-mono text-[9px] leading-tight ${
                    cell.hit ? "text-flare-deep" : "text-ink-faint"
                  }`}
                >
                  {cell.day}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-flare" /> goal cleared
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-flare/30" /> short of goal
        </span>
        <span>
          dotted line = {STEP_GOAL.toLocaleString("en-IN")} steps · fill height ={" "}
          {maxFill.toLocaleString("en-IN")} max
        </span>
      </p>
    </section>
  );
}
