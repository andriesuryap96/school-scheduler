# Task 12 Report: Teacher Today View And Scan Page

**Status: COMPLETE** (Step 7 manual E2E deferred per ledger ruling — no live Supabase DB on this machine)
**Commit: `cdf2176` — feat: add teacher today view and attendance scan page**

## Files

- Created: `src/features/attendance/queries.ts`, `tests/features/attendance/queries.test.ts`
- Filled: `src/features/attendance/TodayPage.tsx`, `src/features/attendance/ScanPage.tsx` (were Task-8 placeholders)

## TDD Evidence (Steps 1–4)

### Step 1 — Tests written first

`tests/features/attendance/queries.test.ts` (21 tests) — mock pattern `vi.hoisted` + fake builder, identical to `tests/features/admin|schedule/queries.test.ts`. Covers:

- `recordAttendance` calls `supabase.rpc('record_attendance', { p_token: token })` with exact args (asserted via `toHaveBeenCalledWith`)
- Message mappings (exact strings from the brief):
  - `{ ok: false, reason: 'expired' }` → "Sesi sudah berakhir"
  - `{ ok: true, duplicate: true }` → "Kamu sudah tercatat hadir"
  - `{ ok: false, reason: 'not_yours' }` → "Link ini bukan untuk jadwal mengajar kamu" (guru cannot scan with another guru's token — enforced server-side by RPC check `v_session.teacher_id is distinct from auth.uid()`)
  - `too_early` → "Sesi belum dibuka. Coba lagi mendekati jam mulai."
  - `not_found` → "Token absen tidak ditemukan atau tidak valid"
  - `ok hadir/terlambat` (non-duplicate) → "Kehadiran tercatat sebagai Hadir/Terlambat"
  - rpc-level error → thrown
- `listTodaySessions`: filters `attendance_sessions` by `eq('date', ...)` (school calendar date), select string contains joins `schedules (start_time, end_time, subjects (name), classes (name))` + `attendance_records (status, scanned_at)` + `token`, nested row flattened to `TodaySession` (subjectName/className/record), `record: null` when no attendance row, error thrown on query failure
- `getSessionByToken`: `.eq('token', t).single()`, `PGRST116` → null
- WIB helpers: `wibDateKey` (UTC+7 calendar-day rollover at 17:00 UTC), `wibTime` (ISO → 'HH:MM' WIB)

### Step 2 — RED

`npx vitest run tests/features/attendance/queries.test.ts` → FAIL — module `@/features/attendance/queries` did not exist (`Failed to resolve import`; 1 test file failed, 0 tests run). Verified before any implementation was written.

### Step 3 — Implementation

`src/features/attendance/queries.ts`:
- `recordAttendance(token)` — write path ONLY via `supabase.rpc('record_attendance', { p_token: token })` (SECURITY DEFINER, the only insert path into `attendance_records`; RLS grants no insert). Returns `RecordAttendanceResult` = `ScanResult` + Indonesian `message` (+ `scannedAt` client-side timestamp for the success panel; authoritative scan time comes from `attendance_records.scanned_at` after cache invalidation).
- `listTodaySessions(date)` / `getSessionByToken(token)` — reads with RLS guaranteeing own-rows-only (`attendance_sessions_guru_select_own: teacher_id = auth.uid()`); client sends no teacher filter.
- `useTodaySessions()` — TanStack Query wrapper (queryKey keyed by today's WIB date), `useSessionByToken`, `useRecordAttendance` (invalidates today-sessions + session-by-token so status/scanned_at refresh after scanning).
- Re-exports `resolveScanResult`/`resolveFinalStatus`/`buildSessionWindow` for components (client-side immediate UI only; server RPC authoritative for writes).

One mid-cycle correction during GREEN (before first green run completed): implementation initially used `.maybeSingle()` while the repo-wide fake-builder test pattern chains `.single()`; switched to `.single()` + `PGRST116`-→null handling to match the established pattern. No test expectations were changed after Step 1 except two TS-narrowing guards (`if (res.ok)` around `res.duplicate`/`res.scannedAt` accesses) required by the discriminated-union type — behavior assertions unchanged.

### Step 4 — GREEN

`npx vitest run tests/features/attendance/queries.test.ts` → **21 passed (21)**

## Step 5 — TodayPage.tsx (`/hari-ini`, guru)

- Header "Jadwal Hari Ini" + Indonesian date (`id-ID` locale, e.g. "19 November 2026")
- One card per session: subject name, "Kelas 7A", "07:00–08:30 WIB" (`wibTime`), status badge
- Badge logic uses `resolveFinalStatus`: record present → Hadir/Terlambat; no record + past `ends_at` → Tidak Hadir; no record + session ongoing/future → "Belum absen"
- "Absen Sekarang" button → `/absen/:token`; replaced by "Sesi sudah berakhir" text when now > `ends_at`; when already scanned shows scan time WIB
- Empty state "Tidak ada jadwal mengajar hari ini.", Spinner, ErrorBox — all Bahasa Indonesia, mobile-first Tailwind consistent with SchedulePage/ExceptionPage

## Step 6 — ScanPage.tsx (`/absen/:token`, guru)

- Session detail card (mapel, kelas, jam WIB) via `useSessionByToken`
- Client-side preview via `resolveScanResult` ("Jika absen sekarang: Hadir/Terlambat" / "Sesi belum dibuka" / "Sesi sudah berakhir") — display only, writes stay server-authoritative
- Big "Konfirmasi Kehadiran" button → `recordAttendance(token)`:
  - Success panel (green): message + "Status: Hadir/Terlambat · Pukul HH:MM WIB" (scan time), duplicate note "Tidak ada record baru yang dibuat."
  - Failure: clear Indonesian error via `role="alert"`
- Already-scanned notice with recorded time from the refetched session
- QR code of the session link via `qrcode.react` (`QRCodeSVG`, value `origin/absen/:token`) for Kepala Sekolah display/printing
- Invalid/unknown token → "Token absen tidak ditemukan atau tidak valid"

## Step 7 — Manual E2E: DEFERRED

Per ledger ruling (Task 6/7/11 DB steps): DB-apply/manual verification steps that need the live Supabase project are deferred to the final "DB apply" checkpoint with the user. All Task-12 code paths are covered by unit tests; the E2E flow (login → /hari-ini → Absen Sekarang → "Hadir" within 15 min → re-scan shows "Kamu sudah tercatat hadir") depends on migrations 0001–0004 being applied and pg_cron sessions existing, which cannot run on this machine.

## Verification runs

- `npx vitest run tests/features/attendance/queries.test.ts` → 21 passed
- `npx vitest run` (full suite) → **67 passed (67)**, no regressions
- `npx tsc --noEmit` → clean
- `npm run build` → success (139 modules, dist emitted)

## Notes / minor deviations

- `RecordAttendanceResult` extends the brief's `ScanResult` return with a `message` field (and `scannedAt` on ok) — required to carry the Indonesian user messages the brief mandates; still a discriminated union on `ok`, structurally compatible with `ScanResult`.
- Hardcoded 15/15 policy in the client-side preview mirrors the DB defaults (`school_settings` defaults 15/15; RPC reads school settings). Client preview is advisory only; the RPC is authoritative.
- WIB fixed at UTC+7 (matches schema default `timezone_offset_minutes = 420`; tz-hardcode already parked as a minor from Task 9).
- Test file uses `beforeEach(vi.clearAllMocks())` per repo convention.

---

## Fix round 1 — 3 Important review findings

Commit: `fix: session refetch after scan, error surface, accurate duplicate display`

### Finding 1 — invalidation token mismatch (stale session after confirm)

**Root cause:** ScanPage called `useRecordAttendance()` without the token, so the hook invalidated `['attendance-session', '']` which never matched the active `['attendance-session', token]` query — the session query never refetched after a scan.

**Fix (mechanism: prefix-based invalidation, parameterless hook):**
- `queryKeys` gains `todaySessionsPrefix: ['attendance-sessions']` and `sessionByTokenPrefix: ['attendance-session']`
- `useRecordAttendance()` (now parameterless — token still flows through `mutate(token)`) invalidates both **prefixes**, so refetch happens regardless of which token/date key is active. This is strictly more robust than per-token keying: it also refreshes the today-list across a WIB date rollover (the old code computed the date at invalidation time but the exact-key list still missed if the date key changed).
- Acceptance criterion (session query refetches after successful scan) is now covered by a hook-level integration test: renders `useSessionByToken` + `useTodaySessions` + `useRecordAttendance()` in a real `QueryClient`, flips the mocked server data from "no record" to "has record" after `mutateAsync`, and asserts both queries refetch (record appears) — even though the mutation hook receives no token.

### Finding 2 — mutation error never rendered

**Fix:** ScanPage renders `{record.error && <ErrorBox message={`Gagal mencatat kehadiran: ${record.error.message}`} />}` below the confirm button. Network/RPC failures (which `recordAttendance` throws) now surface clearly instead of silently re-enabling the button.

### Finding 3 — duplicate flow showed wrong scan time + wrong status label

**Fixes:**
- `RecordAttendanceResult.scannedAt` is now optional and **not set on duplicate** — the re-click time is never presented as the scan time.
- `ResultPanel` takes the refetched session record; on duplicate it prefers `sessionRecord.scannedAt` (made available by Finding 1's refetch), and falls back to showing the duplicate message **without any timestamp** rather than a wrong one.
- Duplicate copy is status-aware: `Kamu sudah tercatat {Hadir|Terlambat}` (was always "hadir"); the already-scanned card notice likewise shows the actual record status.

### Tests

- `npx vitest run tests/features/attendance/queries.test.ts` → **23 passed (23)** (was 21; +1 duplicate-status-label test, +1 invalidation integration test; duplicate test now also asserts `scannedAt` undefined and updated copy)
- `npx vitest run` (full suite) → **9 files, 69 passed (69)** — no regressions
- `npx tsc --noEmit` → clean (exit 0)
