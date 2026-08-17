"use client";

import { useEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STEP_GOAL, shortDate } from "@/lib/metrics";
import type { DayRecord } from "@/lib/types";
import { StackedDateTick } from "./stacked-date-tick";

export function StepsChart({ days }: { days: DayRecord[] }) {
  const rows = days
    .filter((d) => d.steps !== null)
    .map((d) => ({ date: d.date, label: shortDate(d.date), steps: d.steps! }));

  // Each bar gets a fixed minimum width so dates never get squeezed onto
  // small screens — once the row of bars is wider than the panel, the
  // container scrolls horizontally instead of shrinking everything.
  const minWidth = Math.max(rows.length * 42, 280);

  // Start scrolled to the most recent day — that's what you want on open,
  // with older history a swipe to the left away.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rows.length]);

  return (
    <div
      ref={scrollRef}
      className="h-64 w-full overflow-x-auto overscroll-x-contain"
    >
      <div className="h-full" style={{ minWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={18}
              height={48}
              padding={{ left: 16, right: 16 }}
              tick={<StackedDateTick />}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--color-ink-faint)" }}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              domain={[0, (max: number) => Math.max(STEP_GOAL * 1.4, max * 1.1)]}
              width={34}
            />
            <ReferenceLine
              y={STEP_GOAL}
              stroke="var(--color-ink)"
              strokeDasharray="3 4"
              strokeOpacity={0.35}
            />
            <Tooltip
              cursor={{ fill: "var(--color-flare-wash)" }}
              contentStyle={{
                border: "1px solid var(--color-line)",
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                boxShadow: "none",
              }}
              formatter={(value) => [
                `${Number(value).toLocaleString("en-IN")} steps`,
                "",
              ]}
            />
            <Bar dataKey="steps" radius={[4, 4, 0, 0]} maxBarSize={34}>
              {rows.map((row) => (
                <Cell
                  key={row.date}
                  fill={
                    row.steps >= STEP_GOAL
                      ? "var(--color-flare)"
                      : "var(--color-flare-wash)"
                  }
                  stroke={
                    row.steps >= STEP_GOAL ? "none" : "var(--color-flare)"
                  }
                  strokeOpacity={0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
