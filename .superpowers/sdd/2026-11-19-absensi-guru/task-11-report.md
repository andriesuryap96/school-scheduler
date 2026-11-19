# Task 11 Report: Session Generation (pg_cron)

**Status:** COMPLETE (Steps 1–5, 7 done; Step 6 deferred per controller ruling)
**Commit:** `3ba4806` feat: generate daily attendance sessions via pg_cron
**Branch:** master (base: `f5ad83e`)

## Files

- Created: `src/domain/session-generation.ts` — pure function `shouldGenerateSession({ schedule, date, dayOfWeek, exceptions })` plus input interfaces (`ScheduleCandidate`, `ScheduleException`, `ShouldGenerateSessionInput`; reuses `ExceptionType` from `src/domain/types.ts`).
- Created: `tests/domain/session-generation.test.ts` — all 5 scenarios from the brief.
- Created: `supabase/migrations/0004_generate_sessions.sql` — verbatim transcription of the brief's SQL + cron.schedule call.

## Part A: shouldGenerateSession — strict TDD evidence

### RED (Step 1–2)

Wrote all 5 tests **before** any implementation existed. The brief gave only one fully written test (libur nasional affects_all) and stubs for the rest; I made all five concrete:

1. `melewati tanggal yang jadi libur nasional untuk semua jadwal` — verbatim from brief: `day_of_week: 1`, `is_active: true`, date `2026-12-25`, `dayOfWeek: 5`, exception `{type: 'libur_nasional', affects_all: true, schedule_id: null}` → `false`.
2. `melewati jadwal yang tidak aktif` — `day_of_week: 5, is_active: false`, day matches (5), no exceptions → `false`.
3. `melewati hari yang tidak cocok` — per brief stub: `day_of_week: 1` vs `dayOfWeek: 5` → `false`.
4. `menghasilkan sesi bila tidak ada pengecualian dan hari cocok` — `day_of_week: 5, is_active: true`, `dayOfWeek: 5`, no exceptions → `true`.
5. `menghormati pengecualian yang hanya untuk satu jadwal` — two assertions to pin down the semantics:
   - exception `affects_all: false, schedule_id: 'schedule-b'` against schedule-a (matching day) → `true` (specific exception for *another* schedule does not block this one);
   - exception `affects_all: false, schedule_id: 'schedule-a'` against schedule-a → `false`.

RED run (`npx vitest run tests/domain/session-generation.test.ts`) before implementation:

```
Test Files  1 failed (1)
      Tests  no tests
```

with `Failed to resolve import "@/domain/session-generation"` — fail cause is the missing module (correct RED for "test fails because the feature doesn't exist"), not a spurious assertion bug. LSP also flagged `TS2307 Cannot find module '@/domain/session-generation'` immediately after writing the test.

### GREEN (Step 3–4)

Implementation (`src/domain/session-generation.ts`):

```ts
export function shouldGenerateSession({ schedule, date, dayOfWeek, exceptions }: ShouldGenerateSessionInput): boolean {
  if (!schedule.is_active) return false;
  if (schedule.day_of_week !== dayOfWeek) return false;
  return !exceptions.some(
    (e) => e.date === date && (e.affects_all || (schedule.id != null && e.schedule_id === schedule.id)),
  );
}
```

Design notes:
- Order mirrors the SQL predicate intent: active → dow match → no blocking exception.
- `schedule.id != null` guard: per-schedule exceptions only match when the candidate actually carries an `id` (mirrors SQL `e.schedule_id = sc.id`, which is never true for a NULL id); `affects_all` exceptions still block schedule-less candidates, matching the brief's first test which has no `id` on the schedule.
- Exact string date comparison mirrors SQL `e.date = p_date`.

GREEN run:

```
Test Files  1 passed (1)
      Tests  5 passed (5)
```

`npx tsc --noEmit` → No errors found.

### Full suite (regression check)

```
Test Files  8 passed (8)
      Tests  46 passed (46)
```

## Part B: 0004_generate_sessions.sql

Transcribed **verbatim** from the brief (Steps 5): `create extension if not exists pg_cron;`, the full `generate_sessions_for_date(p_date date) returns int` plpgsql function (`security definer`, `set search_path = public`; loops active schedules matching `extract(dow from p_date)`, within the schedule's academic-year start/end dates, minus `schedule_exceptions` where `e.affects_all or e.schedule_id = sc.id`; builds `starts_at`/`ends_at` by concatenating date+time, subtracting `timezone_offset_minutes`, converting `at time zone 'UTC'`; inserts with `on conflict (schedule_id, date) do nothing`; counts inserts via `found`), plus the `cron.schedule('generate-sessions-daily', '0 17 * * *', ...)` call scheduling `generate_sessions_for_date((now() at time zone 'Asia/Jakarta')::date + 1)` — 17:00 UTC = 00:00 WIB, generating the next day's sessions against the Asia/Jakarta calendar date. No DB was touched.

### Step 6 — deferred per controller ruling

Per the ledger ruling, no live DB connection was made. Verification (`select generate_sessions_for_date(current_date);` + idempotency re-run, cron job presence) is deferred to the final DB-apply checkpoint.

## Checkpoint risks / notes for DB-apply

1. **pg_cron schema (flagged by controller):** On Supabase cloud, `pg_cron` is installed in the `extensions` schema. `create extension if not exists pg_cron` (verbatim from the brief) may fail with a permissions error or create it in the wrong schema; on Supabase cloud it likely needs `create extension if not exists pg_cron with schema extensions;`. Transcribed verbatim per instructions — the checkpoint must adjust this line if the migration errors. Related knock-on: the `cron.schedule(...)` call may need schema qualification (`extensions.cron.schedule`) depending on the caller's `search_path`, and `cron.schedule` requires the extension's function to be on the caller's search path.
2. **Idempotency of cron.schedule:** If migration 0004 is re-applied, `cron.schedule` with an existing job name updates the job (it does not error), but at the checkpoint verify only one `generate-sessions-daily` job exists in `cron.job`.
3. **DST/school-timezone nuance:** `timezone_offset_minutes` is a fixed offset (no DST), matching `Asia/Jakarta` (no DST), so `at time zone 'Asia/Jakarta'` in the cron call vs per-school offsets is consistent for WIB schools but would diverge for schools in DST zones — acceptable per current domain (offsets fixed, default 420).
4. **Academic year subquery:** If a schedule's `academic_year_id` has no matching row, the `between` subselects yield NULL and the schedule is silently skipped — same behavior as brief, noted only for awareness.
5. **`is_active` on academic_years is not checked** by the brief's predicate (only start/end dates) — transcribed verbatim; flagging in case the checkpoint expects only active academic years to generate sessions.
6. **`on conflict (schedule_id, date) do nothing` requires the unique constraint** on those columns — present in 0001 (`unique (schedule_id, date)`), verified.

## TDD artifact summary

- RED before GREEN: yes (module-resolution failure captured above, then 5/5 green after minimal implementation).
- All 5 brief scenarios concrete and passing; 1 verbatim + 4 written out per brief stubs.
- No subagents dispatched; no DB connections; no live Supabase verification performed.
