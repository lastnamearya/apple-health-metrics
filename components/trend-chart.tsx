"use client";

import { useEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StackedDateTick } from "./stacked-date-tick";

export interface TrendPoint {
  label: string;
  value: number;
}

export function TrendChart({
  points,
  baseline,
  baselineLabel,
  unit,
  color = "var(--color-flare)",
  height,
  peakMax,
  troughMin,
  yAxisDecimals,
}: {
  points: TrendPoint[];
  baseline?: number;
  baselineLabel?: string;
  unit: string;
  color?: string;
  height?: number;
  /** Pin the y-axis top to a known record high instead of padding above the
   * visible series — makes the line reach the top of the chart. */
  peakMax?: number;
  /** Pin the y-axis bottom to a known record low instead of padding below the
   * visible series. */
  troughMin?: number;
  /** Fix the number of decimal places shown on y-axis tick labels. */
  yAxisDecimals?: number;
}) {
  const resolvedHeight = height ?? 188;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, baseline ?? Infinity);
  const hi = Math.max(...values, baseline ?? -Infinity);
  const pad = Math.max(2, (hi - lo) * 0.35);
  const gradientId = `fill-${unit.replace(/\W/g, "")}`;

  // Fixed minimum width per point keeps date labels legible instead of
  // overlapping — short series just fill the panel, longer ones scroll.
  const minWidth = Math.max(points.length * 46, 280);

  // Start scrolled to the most recent point — that's what you want on open,
  // with older history a swipe to the left away.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [points.length]);

  return (
    <div
      ref={scrollRef}
      style={{ height: resolvedHeight }}
      className="chart-scroll w-full overflow-x-auto overscroll-x-contain"
    >
      <div className="h-full" style={{ minWidth }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
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
              domain={[troughMin ?? Math.floor(lo - pad), peakMax ?? Math.ceil(hi + pad)]}
              width={38}
              tickFormatter={
                yAxisDecimals != null ? (v: number) => v.toFixed(yAxisDecimals) : undefined
              }
            />
            {baseline !== undefined && (
              <ReferenceLine
                y={baseline}
                stroke="var(--color-ink)"
                strokeDasharray="3 4"
                strokeOpacity={0.3}
                label={{
                  value: baselineLabel ?? "baseline",
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "var(--color-ink-faint)",
                  fontFamily: "var(--font-mono)",
                }}
              />
            )}
            <Tooltip
              cursor={{ stroke: color, strokeOpacity: 0.35 }}
              contentStyle={{
                border: "1px solid var(--color-line)",
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                boxShadow: "none",
              }}
              formatter={(value) => [`${Number(value)} ${unit}`, ""]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
