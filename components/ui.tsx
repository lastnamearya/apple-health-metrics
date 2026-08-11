import type { ReactNode } from "react";

export function Panel({
  eyebrow,
  title,
  aside,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-canvas p-5 sm:p-6 ${className}`}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-base font-700 tracking-tight text-ink">
            {title}
          </h2>
        </div>
        {aside && <div className="shrink-0 text-right">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export function Stat({
  value,
  unit,
  label,
  tone = "ink",
}: {
  value: string;
  unit?: string;
  label: string;
  tone?: "ink" | "flare" | "faint";
}) {
  const toneClass =
    tone === "flare" ? "text-flare" : tone === "faint" ? "text-ink-faint" : "text-ink";

  return (
    <div>
      <p className={`nums font-display text-2xl font-700 leading-none ${toneClass}`}>
        {value}
        {unit && (
          <span className="ml-1 font-sans text-xs font-500 text-ink-faint">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[11px] leading-tight text-ink-soft">{label}</p>
    </div>
  );
}

export function Delta({
  value,
  suffix = "",
  goodDirection = "up",
}: {
  value: number | null;
  suffix?: string;
  goodDirection?: "up" | "down";
}) {
  if (value === null) {
    return (
      <span className="font-mono text-[11px] text-ink-faint">
        not enough history
      </span>
    );
  }

  const rounded = Math.round(value * 10) / 10;
  const isFlat = Math.abs(rounded) < 0.05;
  const isGood = goodDirection === "up" ? rounded > 0 : rounded < 0;
  const arrow = isFlat ? "→" : rounded > 0 ? "↑" : "↓";

  const color = isFlat
    ? "text-ink-faint"
    : isGood
      ? "text-calm"
      : "text-flare-deep";

  return (
    <span className={`nums font-mono text-[11px] font-500 ${color}`}>
      {arrow} {Math.abs(rounded)}
      {suffix}
    </span>
  );
}
