/** Renders a "15 Aug" axis label as two centered lines — day on top, month
 *  below — so dates stay legible at the tighter spacing mobile charts use. */
export function StackedDateTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  if (x === undefined || y === undefined || !payload) return null;
  const [day, ...monthParts] = String(payload.value).split(" ");
  const month = monthParts.join(" ");

  return (
    <text x={x} y={y} textAnchor="middle" fontSize={10} fill="var(--color-ink-faint)">
      <tspan x={x} dy="0.9em">
        {day}
      </tspan>
      <tspan x={x} dy="1.15em">
        {month}
      </tspan>
    </text>
  );
}
