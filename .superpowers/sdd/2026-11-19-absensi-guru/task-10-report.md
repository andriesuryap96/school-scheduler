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
- Shared hook `useSchedulePageData`: for `kepala_sekolah` reads `school_id` from JWT `app_metadata` (matches RLS `auth_school_id()` in 0002_rls.sql); for `superadmin` falls back to first school (AdminPage convention), and **all** master-data hooks are keyed to that resolved id, so the fallback is genuinely functional (see Fix section — original submission had a dead fallback, repaired in bd855f0).

## ExceptionPage routing decision

Route: **`/pengecualian`**, top-level (sibling of `/jadwal`), guarded by `RequireRole allow={['kepala_sekolah']}`, linked from the SchedulePage header ("Pengecualian" ↔ "Jadwal" back-link). Rationale:
- Flat top-level route matches the existing router style (`/admin`, `/jadwal`, `/laporan` are all flat siblings — no nested children anywhere yet).
- Same role guard as `/jadwal`; RLS already restricts `schedule_exceptions` writes to `kepala_sekolah`.
- A separate page (rather than a tab on `/jadwal`) keeps the weekly grid uncluttered on mobile and gives exceptions their own URL for deep linking from reports later.

## Deferred verification (per ledger ruling)

Step 7 (manual: login as kepala sekolah, add Senin 08:00–09:30 schedule + 25 Des 2026 `libur_nasional` exception) was **not** run — no live Supabase in this environment. Covered instead by: 11 unit tests on payload/error mapping, `tsc -b` clean, production build clean, and router route registered.

---

## Fix Section (review findings — commit `fix: send school_id on schedule insert and repair school resolution`)

### Finding 1: createSchedule omitted school_id (CONFIRMED REAL)

`schedules.school_id` is `uuid NOT NULL` with no default/trigger (0001_schema.sql:52), so the original insert would fail at the DB. Fix:

- `ScheduleInput` now includes required `school_id: string` (exported type, same pattern as `createException`'s input).
- `createSchedule` and `updateSchedule` send `school_id` in their payloads.
- Tests: payload constants now include `school_id: 'sch-1'`; exact-payload assertions for create/update include it; added an explicit test `mengirim school_id di payload (kolom NOT NULL tanpa default)` using `expect.objectContaining({ school_id: 'sch-1' })`. 12 tests total (was 11).
- Call sites: `ScheduleForm` takes `schoolId` prop and includes it in the `ScheduleInput`; `SchedulePage` passes `data.schoolId`.

### Finding 2: superadmin fallback in useSchedulePageData was broken/dead

The original code called `useAcademicYears(schoolId)` etc. with the *state* variable (empty for superadmin) and only computed `resolvedSchoolId` afterward for the return value — so master data never loaded for superadmin. Fix (preferred option — make it work): resolve the school id once (`metadataSchoolId` for kepala_sekolah from JWT `app_metadata`, else `schoolsQ.data?.[0]?.id` for superadmin) **before** the master-data hooks, and pass that resolved id to `useAcademicYears`/`useSubjects`/`useClasses`/`useUsers`. The `enabled: !!schoolId` guards on those hooks (in admin/queries.ts) hold queries while the id is empty, and once `useSchools` resolves, all master data loads for superadmin. Also: `schoolsQ.error` now surfaces for superadmin, and `masterPending` now covers the pre-resolution state. Report claim corrected above (the "pages are also demoable by superadmin" line was false for the original submission).

### Tests run after fixes

```
$ npx vitest run tests/features/schedule/queries.test.ts
Test Files  1 passed (1) · Tests  12 passed (12)

$ npx vitest run            # full suite
Test Files  7 passed (7) · Tests  41 passed (41)

$ npx tsc -b --force        # clean (exit 0)
$ npm run build             # clean, 135 modules
```
