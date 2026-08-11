"use client";

import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Text,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  stackDateLabels = false,
}: {
  points: TrendPoint[];
  baseline?: number;
  baselineLabel?: string;
  unit: string;
  color?: string;
  height?: number;
  /** Splits a "3 Aug" label onto two lines (day / month) so it takes less
   *  horizontal room — enough that every date can fit without skipping any. */
  stackDateLabels?: boolean;
}) {
  const resolvedHeight = height ?? (stackDateLabels ? 188 : 172);
  const axisHeight = stackDateLabels ? 48 : 36;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values, baseline ?? Infinity);
  const hi = Math.max(...values, baseline ?? -Infinity);
  const pad = Math.max(2, (hi - lo) * 0.35);
  const gradientId = `fill-${unit.replace(/\W/g, "")}`;

  return (
    <div style={{ height: resolvedHeight }} className="w-full">
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
            height={axisHeight}
            tick={(props) => {
              const { x, y, payload, index } = props;
              // Nudge only the first/last labels inward from their point —
              // the plotted line/area still starts and ends at the true
              // edge, just the label text renders with some breathing room
              // from the Y-axis / right edge instead of sitting flush on it.
              const isFirst = index === 0;
              const isLast = index === points.length - 1;
              const dx = isFirst ? 10 : isLast ? -10 : 0;
              const tickX = Number(x) + dx;
              const anchor = isFirst ? "start" : isLast ? "end" : "middle";

              if (stackDateLabels) {
                const [day, ...monthParts] = String(payload.value).split(" ");
                const month = monthParts.join(" ");
                return (
                  <text
                    x={tickX}
                    y={y}
                    textAnchor={anchor}
                    fontSize={10}
                    fill="var(--color-ink-faint)"
                  >
                    <tspan x={tickX} dy="0.9em">
                      {day}
                    </tspan>
                    <tspan x={tickX} dy="1.15em">
                      {month}
                    </tspan>
                  </text>
                );
              }

              return (
                <Text x={tickX} y={y} textAnchor={anchor} fontSize={10} fill="var(--color-ink-faint)">
                  {payload.value}
                </Text>
              );
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "var(--color-ink-faint)" }}
            domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]}
            width={38}
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
  );
}
