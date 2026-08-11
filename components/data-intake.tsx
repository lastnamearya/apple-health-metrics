"use client";

import { useCallback, useRef, useState } from "react";
import {
  parseHealthAutoExport,
  type HaeExport,
  type ParseResult,
} from "@/lib/health-auto-export";
import {
  MANUAL_FIELDS,
  buildDayRecord,
  numFrom,
  parseBulkText,
  type BulkRow,
} from "@/lib/day-record";
import { todayIso } from "@/lib/metrics";
import type { DayRecord } from "@/lib/types";

type Tab = "drop" | "manual" | "bulk";

export function DataIntake({
  onIngest,
  onReset,
  dayCount,
  onExport,
}: {
  onIngest: (days: DayRecord[]) => void;
  onReset: () => void;
  onExport: () => void;
  dayCount: number;
}) {
  const [tab, setTab] = useState<Tab>("drop");
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-canvas">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            Data
          </span>
          <span className="mt-0.5 block font-display text-base font-700 tracking-tight text-ink">
            {dayCount} days stored
          </span>
        </span>
        <span className="font-mono text-[11px] text-flare">
          {open ? "Close" : "Add data"}
        </span>
      </button>

      {open && (
        <div className="border-t border-line p-5">
          <div className="mb-5 flex gap-1 rounded-lg bg-surface p-1">
            {(
              [
                ["drop", "Drop an export"],
                ["manual", "Enter a day"],
                ["bulk", "Paste multiple days"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
                  tab === key
                    ? "bg-canvas text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "drop" && <DropZone onIngest={onIngest} />}
          {tab === "manual" && <ManualEntry onIngest={onIngest} />}
          {tab === "bulk" && <BulkEntry onIngest={onIngest} />}

          <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 font-mono text-[11px]">
            <button onClick={onExport} className="text-ink-soft hover:text-flare">
              Download stored data
            </button>
            <button onClick={onReset} className="text-ink-soft hover:text-flare-deep">
              Clear everything
            </button>
            <span className="ml-auto text-ink-faint">
              Stored in this browser only
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- drop zone -- */

function DropZone({ onIngest }: { onIngest: (days: DayRecord[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);
      setResult(null);

      try {
        const collected: DayRecord[] = [];
        let last: ParseResult | null = null;

        for (const file of Array.from(files)) {
          const text = await file.text();
          const payload = JSON.parse(text) as HaeExport;

          if (!payload?.data?.metrics) {
            throw new Error(
              `${file.name} has no data.metrics array — that's the shape Health Auto Export writes. Is this the right file?`
            );
          }

          const parsed = parseHealthAutoExport(payload);
          collected.push(...parsed.days);
          last = parsed;
        }

        if (!collected.length) {
          throw new Error(
            "Parsed the file but found no days the dashboard tracks. Check that Steps, HRV, Sleep Analysis and Heart Rate are selected in your export."
          );
        }

        setResult(last);
        onIngest(collected);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read that file.");
      }
    },
    [onIngest]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-flare bg-flare-wash"
            : "border-line bg-surface hover:border-flare/50"
        }`}
      >
        <p className="font-display text-sm font-700 text-ink">
          Drop a Health Auto Export JSON here
        </p>
        <p className="mt-1.5 text-[12px] text-ink-soft">
          or click to choose files. Several at once is fine — days merge by date.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p className="mt-4 rounded-lg border border-flare/30 bg-flare-wash px-3.5 py-2.5 text-[12px] leading-relaxed text-flare-deep">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-2.5">
          <p className="font-mono text-[11px] text-calm">
            Read {result.days.length} days.
          </p>
          {result.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[12px] leading-relaxed text-ink-soft"
            >
              {warning}
            </p>
          ))}
          {result.ignored.length > 0 && (
            <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
              Ignored series: {result.ignored.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- manual entry -- */

function ManualEntry({ onIngest }: { onIngest: (days: DayRecord[]) => void }) {
  const [date, setDate] = useState(todayIso());
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const save = () => {
    const record = buildDayRecord(date, {
      steps: numFrom(values.steps),
      hrvMs: numFrom(values.hrvMs),
      asleep: numFrom(values.asleep),
      inBed: numFrom(values.inBed),
      deep: numFrom(values.deep),
      rem: numFrom(values.rem),
      hrMin: numFrom(values.hrMin),
      hrAvg: numFrom(values.hrAvg),
    });

    onIngest([record]);
    setValues({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <label className="mb-4 block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          Date
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="nums w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-sm text-ink"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MANUAL_FIELDS.map((field) => (
          <label key={field.key}>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              {field.label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.key]: e.target.value }))
              }
              className="nums w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-faint"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          className="rounded-lg bg-flare px-4 py-2 font-mono text-[12px] text-white transition-colors hover:bg-flare-deep"
        >
          Save day
        </button>
        {saved && (
          <span className="font-mono text-[11px] text-calm">Saved</span>
        )}
        <span className="ml-auto font-mono text-[10px] text-ink-faint">
          Blank fields are left untouched
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bulk entry -- */

const BULK_PLACEHOLDER = `2026-08-05, 10423, 41, 401, 452, 62, 107, 56, 61
2026-08-06, 9876, 38, 388, 430, 55, 95, 58, 63`;

function BulkEntry({ onIngest }: { onIngest: (days: DayRecord[]) => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<BulkRow[] | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const preview = () => {
    setSaved(null);
    setRows(parseBulkText(text));
  };

  const validRows = rows?.filter((r) => r.record) ?? [];

  const commit = () => {
    if (!validRows.length) return;
    onIngest(validRows.map((r) => r.record!));
    setSaved(validRows.length);
    setText("");
    setRows(null);
  };

  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
        Date · {MANUAL_FIELDS.map((f) => f.label).join(" · ")}
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setRows(null);
          setSaved(null);
        }}
        rows={6}
        placeholder={BULK_PLACEHOLDER}
        className="nums w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-ink placeholder:text-ink-faint"
      />
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
        One day per line, date first (YYYY-MM-DD). Comma or tab separated —
        pasting straight from a spreadsheet works. Missing trailing columns
        and blank cells are left untouched.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={preview}
          disabled={!text.trim()}
          className="rounded-lg border border-line px-4 py-2 font-mono text-[12px] text-ink transition-colors hover:border-flare/50 disabled:opacity-40"
        >
          Preview
        </button>
        {rows && (
          <button
            onClick={commit}
            disabled={!validRows.length}
            className="rounded-lg bg-flare px-4 py-2 font-mono text-[12px] text-white transition-colors hover:bg-flare-deep disabled:opacity-40"
          >
            Add {validRows.length} day{validRows.length === 1 ? "" : "s"}
          </button>
        )}
        {saved !== null && (
          <span className="font-mono text-[11px] text-calm">
            Saved {saved} day{saved === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {rows && (
        <ol className="mt-4 space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={`${row.date ?? row.raw}-${i}`}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 font-mono text-[11px] ${
                row.error
                  ? "border-flare/30 bg-flare-wash text-flare-deep"
                  : "border-line bg-surface text-ink-soft"
              }`}
            >
              <span className="truncate">{row.date ?? row.raw}</span>
              <span className="shrink-0">{row.error ?? "ok"}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
