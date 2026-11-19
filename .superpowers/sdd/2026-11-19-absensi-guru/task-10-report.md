# Task 10 Report: Schedule CRUD + Exceptions Management (Kepala Sekolah)

**Commit:** a9f4319 `feat: add schedule and exception management` (8 files, +1382/−2)

## Files

| File | Kind | Purpose |
|---|---|---|
| `tests/features/schedule/queries.test.ts` | test | TDD tests for schedule/exception mutations (written FIRST) |
| `src/features/schedule/queries.ts` | create | Plain async fns + TanStack Query hooks + queryKeys (admin pattern) |
| `src/features/schedule/useSchedulePageData.ts` | create | Shared gating hook: schoolId + active year + guru/kelas/mapel master data |
| `src/features/schedule/ScheduleForm.tsx` | create | Sheet form: guru/kelas/mapel/hari/jam mulai/selesai (add + edit) |
| `src/features/schedule/SchedulePage.tsx` | replace placeholder | Weekly grid (desktop 7 cols Senin–Minggu) / vertical day list (mobile) |
| `src/features/schedule/ExceptionForm.tsx` | create | Sheet form: tanggal, tipe, keterangan, toggle semua/satu jadwal |
| `src/features/schedule/ExceptionPage.tsx` | create | Exception list + delete + form |
| `src/routes/router.tsx` | edit | Adds `/pengecualian` route (kepala_sekolah only) |

## TDD Evidence (queries.ts)

**Step 1 — RED:** wrote `tests/features/schedule/queries.test.ts` first (11 tests, same mock pattern as `tests/features/admin/queries.test.ts`: `vi.hoisted` + `vi.mock('@/lib/supabase')` + fake builder). Run before implementation:

```
npx vitest run tests/features/schedule/queries.test.ts
Error: Failed to resolve import "@/features/schedule/queries" — FAIL (1 failed suite)
```

**Step 2 — implement:** `src/features/schedule/queries.ts`:
- `createSchedule`, `updateSchedule(id, input)`, `deleteSchedule(id)`, `createException`, `deleteException(id)`
- `ScheduleInput = { teacher_id, class_id, subject_id, day_of_week, start_time, end_time, academic_year_id }`
- Postgres error mapping `toUserMessage()`: `23514` → `'Jam selesai harus setelah jam mulai'`; other errors pass through `message` (plain-object Supabase errors normalized to `Error`).
- Also: `listSchedules`, `listExceptions` reads, `EXCEPTION_TYPES`, `DAY_NAMES`/`WEEK_ORDER`, queryKeys, and `useX` hooks (thin wrappers, invalidate on success).

**Intermediate RED→fix cycle (honest log):** first implementation failed 2/11:
1. `is_active: true` in insert payload ≠ test's expected payload → removed (DB default `true` covers it).
2. Plain-object errors threw as `[object Object]` → `toUserMessage` now uses `error.message` when present.

**Step 3 — GREEN:**

```
npx vitest run tests/features/schedule/queries.test.ts
Test Files  1 passed (1) · Tests  11 passed (11)
```

Key tests: `createSchedule` payload; 23514 → Indonesian message (create + update); unknown code passthrough; `createException` with `affects_all: true` sends `schedule_id: null`; `affects_all: false` sends chosen id; delete calls.

**Full suite:** `npx vitest run` → **7 files, 40 tests, all pass** (no regressions). `npx tsc -b` clean, `npm run build` clean, eslint clean.

## Component notes (admin patterns reused)

- `Sheet` + `FormDialog`/`inputCls` reused verbatim; Bahasa Indonesia copy throughout; mobile-first (bottom-sheet forms, full-width buttons, `max-w-md`-style spacing, `md:` breakpoints for the 7-column grid).
- `ErrorBox`/`Spinner`/empty-card patterns copied from AdminPage. Gating: no active academic year → "Tambah Jadwal" disabled + amber hint (analog of NoSchoolHint).
- Weekly grid: `WEEK_ORDER = [1..6, 0]` (Senin–Minggu, `day_of_week` 0=Minggu per schema). Desktop = `grid-cols-7`; mobile = `<DayList>` with per-day `<h2>` headings; both render from the same `ScheduleRow[]` via CSS `md:hidden` / `hidden md:block`.
- Schedule cards show resolved names (guru/kelas/mapel from master data) with UUID fallback; Ubah/Hapus actions.
- ExceptionForm toggle: radio "Semua jadwal" vs "Satu jadwal saja" (disabled + hint when no schedules exist); single-schedule path requires a schedule selection (`required`).
- Shared hook `useSchedulePageData`: for `kepala_sekolah` reads `school_id` from JWT `app_metadata` (matches RLS `auth_school_id()` in 0002_rls.sql); for `superadmin` falls back to first school (AdminPage convention), so the pages are also demoable by superadmin.

## ExceptionPage routing decision

Route: **`/pengecualian`**, top-level (sibling of `/jadwal`), guarded by `RequireRole allow={['kepala_sekolah']}`, linked from the SchedulePage header ("Pengecualian" ↔ "Jadwal" back-link). Rationale:
- Flat top-level route matches the existing router style (`/admin`, `/jadwal`, `/laporan` are all flat siblings — no nested children anywhere yet).
- Same role guard as `/jadwal`; RLS already restricts `schedule_exceptions` writes to `kepala_sekolah`.
- A separate page (rather than a tab on `/jadwal`) keeps the weekly grid uncluttered on mobile and gives exceptions their own URL for deep linking from reports later.

## Deferred verification (per ledger ruling)

Step 7 (manual: login as kepala sekolah, add Senin 08:00–09:30 schedule + 25 Des 2026 `libur_nasional` exception) was **not** run — no live Supabase in this environment. Covered instead by: 11 unit tests on payload/error mapping, `tsc -b` clean, production build clean, and router route registered.
