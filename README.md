# Health Dashboard

A personal dashboard for Apple Watch / Apple Health data, built with Next.js 16,
Tailwind v4 and Recharts.

## What it tracks

- **Steps** — the 21-day challenge (goal set in `lib/config.ts`), plus daily counts
- **HRV** — shown exactly as exported, no averaging or scoring
- **Sleep** — stage breakdown and a derived sleep score
- **Resting heart rate** — Apple's daily Vitals figure, the one checked each
  morning; falls back to an overnight average when an export lacks it

## Running it

```bash
npm install
npm run dev
```

## Getting data in

Two paths, both in the "Add data" panel on the dashboard:

1. **Drop a file** — drag a Health Auto Export JSON onto the drop zone. Several
   files at once is fine; days merge by date, and a partial export won't wipe
   fields it doesn't carry.
2. **Enter a day** — type one day's numbers in by hand.

Everything is stored in browser local storage. Nothing is sent anywhere.

### Parser notes

`lib/health-auto-export.ts` handles HAE's real sample shape:

- Timestamps like `2026-08-03 04:00:00 +0530` are not valid ISO-8601. Safari
  returns Invalid Date for them, so they're normalized before parsing.
- Multiple samples per day are aggregated per metric — steps sum, HRV averages.
  Declared in `METRIC_SPECS`.
- When both an iPhone and a Watch report steps for the same day, the Watch wins.
  Summing them roughly doubles the count.
- Metric name aliases are handled, since HAE has renamed series across versions.

Unrecognized series are listed in the UI rather than silently dropped.

## Configuration

`lib/config.ts` holds the challenge start date, step goal, sleep score
weightings and personal baselines. Change these, not the components.

## On the sleep score

Apple Health does not export a sleep score. watchOS shows one in its own UI, but
it is not a HealthKit sample type, so it never reaches an export file. The score
here is computed locally from duration (40 points), deep sleep share (20), REM
share (20) and sleep efficiency (20).

## Roadmap

- [ ] Ingest endpoint for Health Auto Export's REST API automation
- [ ] Postgres storage, deduplicated on Apple sample UUIDs
- [ ] Rolling 60-day baselines replacing the static ones
