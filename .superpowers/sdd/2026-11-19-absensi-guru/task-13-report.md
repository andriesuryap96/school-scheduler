# Task 13 Report: Monthly Attendance Reports + CSV Export

**Status:** ✅ Complete
**Commit:** `9919f28` — feat: add monthly attendance reports with csv export
**Branch:** master (parent: `b7fa8a8`)

## Deliverables

| File | Kind | Content |
|---|---|---|
| `src/features/reports/csv.ts` | new | `buildCsv(rows: ReportRow[]): string` + `ReportRow` interface (RFC 4180 escaping) |
| `src/features/reports/queries.ts` | new | `getMonthlyReport(month, now?)` + `useMonthlyReport(month)` + `monthRange` |
| `src/features/reports/ReportsPage.tsx` | rewrite | month picker, rekap table, Export CSV, Cetak |
| `tests/features/reports/csv.test.ts` | new | 7 tests |
| `tests/features/reports/queries.test.ts` | new | 9 tests |

Route `/laporan` (kepala_sekolah) already existed in `src/routes/router.tsx` — untouched.

## TDD Evidence

### Step 1 — RED (csv.ts + queries.ts)

Wrote both test files first, before any implementation:

- `tests/features/reports/csv.test.ts` — exact brief test:
  ```ts
  it('menghasilkan header dan baris CSV dengan escaping koma', () => {
    const csv = buildCsv([{ teacher: 'Budi, S.Pd', hadir: 10, terlambat: 1, tidakHadir: 2 }]);
    expect(csv.split('\n')[0]).toBe('Guru,Hadir,Terlambat,Tidak Hadir');
    expect(csv.split('\n')[1]).toBe('"Budi, S.Pd",10,1,2');
  });
  ```
  plus: quote escaping (`""`), combined comma+quote, empty rows → header only, zero values, multi-row ordering.
- `tests/features/reports/queries.test.ts` — vi.hoisted fake-builder `from` mock (pattern of `tests/features/admin/queries.test.ts`), `makeBuilder({ awaited })` resolving on `.order()`; `sessionRow()` PostgREST join fixture with `users`, `schedules.subjects`, `attendance_records`.

**Step 2 — RED run** (`npx vitest run tests/features/reports/`):

```
Error: Failed to resolve import "@/features/reports/queries" from "tests/features/reports/queries.test.ts". Does the file exist?
Test Files  2 failed (2)
      Tests  no tests
```

Both fail on missing modules — RED confirmed for csv.ts and queries.ts.

### Step 3/4 — csv.ts implementation → GREEN

```ts
function escapeField(value: string): string {
  if (/[",]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
```

`npx vitest run tests/features/reports/csv.test.ts` → **7 passed**.

### Step 5 — queries.ts implementation → GREEN

`getMonthlyReport(month, now = new Date())`:
- `monthRange('YYYY-MM')` → `[start, nextMonthStart)` date filters: `.gte('date', start).lt('date', end)`;
- select embeds `users (name)`, `schedules (subjects (name))`, `attendance_records (status, scanned_at)`;
- per session, status via `resolveFinalStatus(record, window, now)` from `src/domain/attendance.ts` — no record → `tidak_hadir`;
- **future-session rule** (per `resolveFinalStatus` docstring "laporan hanya menampilkan sesi yang sudah lewat"): a session with no record whose `ends_at > now` is skipped — not counted as tidak hadir;
- aggregation into a `Map` keyed by teacher name (fallback `teacher_id`), sorted by name (locale `id`).

`now` is an injectable parameter so tests are deterministic (mocked `NOW = 2026-11-19T00:00:00Z`).

Two additional RED-first tests cover the future-session behavior:
- `sesi masa depan tanpa record TIDAK dihitung tidak hadir` → rows `[]`;
- `record hadir pada sesi masa depan tetap dihitung` → hadir 1.

`npx vitest run tests/features/reports/` → **16 passed (2 files)**.

### Step 6 — ReportsPage.tsx

- `useState(() => currentMonthKey(new Date()))` default bulan berjalan (WIB, offset +420 menit, sama basis dengan `wibDateKey`);
- `<input type="month">` bound to state; changing month refetches via `useMonthlyReport(month)` (query key `['monthly-report', month]`);
- table per guru: Guru / Hadir / Terlambat / Tidak Hadir / Persentase (`(hadir+terlambat)/total`, `Math.round`, `—` bila total 0), wrapped in `overflow-x-auto` for horizontal scroll on mobile, `whitespace-nowrap` cells;
- "Export CSV" → `buildCsv(rows)` + `new Blob([csv], {type: 'text/csv;charset=utf-8'})` + `URL.createObjectURL` + anchor click + `URL.revokeObjectURL`; disabled while no data;
- "Cetak" → `window.print()`;
- Spinner / ErrorBox / empty state ("Tidak ada data kehadiran pada bulan ini.") following the app's established patterns; header + Keluar (signOut) like other pages; all copy in Bahasa Indonesia.

### Steps 7 — Manual verification

Deferred per ledger ruling (not run here). Suggested manual script remains as in the brief: `npm run dev`, login kepala sekolah, open `/laporan`, pick current month.

## Full verification

```
npm test           → Test Files 11 passed (11), Tests 85 passed (85)
npm run build      → tsc --noEmit + vite build OK (141 modules, 0 errors)
```

## Test summary

- New: 16 tests / 2 files (csv 7, queries 9) — all GREEN.
- Full suite regression: 85/85 pass; production build (incl. `tsc --noEmit`) clean.

## Notes / decisions

- `getMonthlyReport` accepts optional `now` param (default `new Date()`) for deterministic tests; `useMonthlyReport` calls it with the default.
- `ReportRow` interface lives in `csv.ts` (per brief) and is re-exported from `queries.ts`.
- The brief's "join ke users dan subjects" is realized via the PostgREST select embed; `subjects` name is fetched alongside for future drill-down, though the per-guru table itself doesn't display it.
- CSV uses `\n` line endings (per the exact test expectations); no trailing newline.
- Sorting by teacher name (locale `id`) keeps table/CSV order stable across refetches.
