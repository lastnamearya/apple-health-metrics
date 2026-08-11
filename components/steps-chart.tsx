"use client";

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

export function StepsChart({ days }: { days: DayRecord[] }) {
  const rows = days
    .filter((d) => d.steps !== null)
    .map((d) => ({ date: d.date, label: shortDate(d.date), steps: d.steps! }));

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--color-ink-faint)" }}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--color-ink-faint)" }}
            tickFormatter={(v: number) => `${v / 1000}k`}
            domain={[0, (max: number) => Math.max(STEP_GOAL * 1.4, max * 1.1)]}
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
  );
}
