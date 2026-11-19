# Sistem Absensi Guru — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi web mobile-first untuk absensi guru berbasis QR/link unik per guru per sesi, dengan penjadwalan mingguan berulang dan laporan kehadiran.

**Architecture:** SPA React (Vite + TypeScript) yang berbicara langsung ke Supabase (Auth + Postgres + RLS). Aturan bisnis absensi (window waktu, penentuan status) diimplementasikan dua kali: sebagai fungsi TypeScript murni untuk UI/test, dan sebagai Postgres function `SECURITY DEFINER` yang otoritatif untuk penulisan data. Sesi absensi harian digenerate oleh Postgres function yang dijadwalkan `pg_cron`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Supabase JS v2, Vitest + React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-absensi-guru-design.md`

## Global Constraints

- Skala: 1 sekolah, 4 guru, 4 kelas, 1 lokasi. Jangan bangun abstraksi multi-sekolah yang belum dibutuhkan — kolom `school_id` ada, tapi UI tidak punya pemilih sekolah.
- Timezone: semua timestamp disimpan **UTC** (`timestamptz`). Konversi ke WIB (UTC+7) hanya di layer tampilan.
- Toleransi Hadir vs Terlambat: **15 menit** setelah `start_time`.
- Window link absensi: **`start_time` − 15 menit s/d `end_time`**.
- Role: `superadmin`, `kepala_sekolah`, `guru` — disimpan di `auth.users.raw_app_meta_data->>'role'`.
- Mobile-first: layout utama dirancang untuk lebar 360–430px. Tabel laporan boleh scroll horizontal.
- Semua copy UI dalam **Bahasa Indonesia**.
- Nominal/konstanta waktu diambil dari tabel `school_settings`, tidak di-hardcode di komponen.

## Review Focus

Hal-hal yang spec tidak sebut eksplisit tapi akan menggigit pengguna:

1. **Scan ganda** — guru menekan tombol absen dua kali (atau refresh halaman). Harus idempoten: satu record per sesi, bukan error 500 atau duplikat.
2. **Scan di luar window** — guru membuka link jam 06:00 untuk kelas 08:00, atau jam 15:00 untuk kelas yang selesai 12:00. Harus dapat pesan jelas, bukan status salah.
3. **Zona waktu salah** — `start_time` 08:00 WIB harus jadi 01:00 UTC. Bug di sini membuat semua guru "Terlambat" atau "Hadir" di jam yang salah.
4. **Sesi untuk hari yang jadi pengecualian** — tanggal 25 Desember (libur nasional) tidak boleh punya sesi sama sekali, dan guru tidak boleh bisa absen di tanggal itu.
5. **Guru membuka link milik guru lain** — token harus terikat ke satu guru; guru lain yang memakai token itu harus ditolak.

---

## File Structure

```
absensi-guru/
├── src/
│   ├── domain/                    # logika murni, nol dependency ke React/Supabase
│   │   ├── types.ts
│   │   ├── time.ts                # buildSessionWindow, formatWIB
│   │   ├── attendance.ts          # resolveScanResult, resolveFinalStatus
│   │   └── session-generation.ts  # shouldGenerateSession
│   ├── lib/
│   │   └── supabase.ts            # createClient + env validation
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts
│   │   └── RequireRole.tsx
│   ├── features/
│   │   ├── admin/                 # Super Admin: schools, years, subjects, classes, users
│   │   ├── schedule/              # Kepala Sekolah: schedules + exceptions
│   │   ├── attendance/            # Guru: jadwal hari ini + halaman scan
│   │   └── reports/               # Kepala Sekolah: rekap + export CSV
│   ├── components/ui/             # shadcn/ui primitives
│   ├── routes/
│   │   └── router.tsx
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql
│   │   ├── 0002_rls.sql
│   │   ├── 0003_record_attendance.sql
│   │   └── 0004_generate_sessions.sql
│   └── functions/                 # tidak dipakai — pakai pg_cron, lihat Task 11
├── tests/
│   ├── domain/
│   ├── features/
│   └── e2e/
├── .env.example
└── package.json
```

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.env.example`, `.gitignore`
- Test: `tests/smoke.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: dev server di port 5173; alias import `@/` → `src/`; `npm test` menjalankan Vitest

- [ ] **Step 1: Scaffold Vite + React + TS**

```bash
cd ~/projects/absensi-guru
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Pasang dependency**

```bash
npm install react-router-dom @tanstack/react-query @supabase/supabase-js qrcode.react
npm install -D tailwindcss postcss autoprefixer vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @types/node @playwright/test
npx tailwindcss init -p
```

- [ ] **Step 3: Konfigurasi Tailwind, alias `@/`, dan Vitest**

`tailwind.config.ts` — `content: ['./index.html', './src/**/*.{ts,tsx}']`.
`vite.config.ts` — tambahkan `resolve.alias['@'] = path.resolve(__dirname, './src')`, dan blok `test: { environment: 'jsdom', setupFiles: './tests/setup.ts', globals: true }`.
`tsconfig.json` — tambahkan `"baseUrl": ".", "paths": { "@/*": ["./src/*"] }`.

- [ ] **Step 4: Buat test smoke yang gagal**

`tests/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '@/App';

describe('App', () => {
  it('merender judul aplikasi', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /absensi guru/i })).toBeInTheDocument();
  });
});
```

`tests/setup.ts`: `import '@testing-library/jest-dom';`

- [ ] **Step 5: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/smoke.test.tsx`
Expected: FAIL — tidak ada heading "Absensi Guru"

- [ ] **Step 6: Implementasi `App.tsx` minimal**

```tsx
export default function App() {
  return (
    <main className="min-h-dvh bg-slate-50 p-4">
      <h1 className="text-2xl font-semibold">Absensi Guru</h1>
    </main>
  );
}
```

- [ ] **Step 7: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/smoke.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react ts with tailwind and vitest"
```

---

### Task 2: Domain Types

**Files:**
- Create: `src/domain/types.ts`
- Test: `tests/domain/types.test.ts` (compile-time only, tidak ada assertion runtime)

**Interfaces:**
- Consumes: nothing
- Produces: semua tipe di bawah — dipakai Task 3, 4, 5 dan seluruh `src/features/`

```ts
export type Role = 'superadmin' | 'kepala_sekolah' | 'guru';
export type AttendanceStatus = 'hadir' | 'terlambat' | 'tidak_hadir';
export type ExceptionType = 'libur_nasional' | 'ulangan_umum' | 'event';

export interface SessionWindow {
  startsAt: Date;  // UTC instant kelas dimulai
  endsAt: Date;    // UTC instant kelas selesai
}

export interface AttendancePolicy {
  earlyOpenMinutes: number;      // 15
  lateThresholdMinutes: number;  // 15
}

export type ScanResult =
  | { ok: true; status: 'hadir' | 'terlambat'; duplicate?: boolean }
  | { ok: false; reason: 'too_early' | 'expired' | 'not_found' | 'not_yours' };
```

- [ ] **Step 1: Tulis file tipe**

Buat `src/domain/types.ts` dengan isi di atas persis.

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: tidak ada error

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add domain types"
```

---

### Task 3: Session Window Builder

**Files:**
- Create: `src/domain/time.ts`
- Test: `tests/domain/time.test.ts`

**Interfaces:**
- Consumes: `SessionWindow` dari `@/domain/types`
- Produces: `buildSessionWindow(date: string, startTime: string, endTime: string, utcOffsetMinutes: number): SessionWindow`

- [ ] **Step 1: Tulis test yang gagal**

`tests/domain/time.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSessionWindow } from '@/domain/time';

const WIB = 420; // UTC+7 dalam menit

describe('buildSessionWindow', () => {
  it('mengkonversi jam WIB ke instant UTC yang benar', () => {
    const w = buildSessionWindow('2026-11-20', '08:00', '09:30', WIB);
    expect(w.startsAt.toISOString()).toBe('2026-11-20T01:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-11-20T02:30:00.000Z');
  });

  it('menangani kelas yang selesai lewat tengah malam UTC', () => {
    const w = buildSessionWindow('2026-11-20', '07:00', '08:00', WIB);
    expect(w.startsAt.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('menangani offset negatif (UTC-5)', () => {
    const w = buildSessionWindow('2026-11-20', '08:00', '09:00', -300);
    expect(w.startsAt.toISOString()).toBe('2026-11-20T13:00:00.000Z');
  });

  it('melempar error untuk format tanggal salah', () => {
    expect(() => buildSessionWindow('20-11-2026', '08:00', '09:00', WIB))
      .toThrow(/format tanggal/i);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/domain/time.test.ts`
Expected: FAIL — module `@/domain/time` tidak ditemukan

- [ ] **Step 3: Implementasi `buildSessionWindow`**

Validasi `date` dengan regex `/^\d{4}-\d{2}-\d{2}$/`, lempar `Error('Format tanggal harus YYYY-MM-DD')` bila tidak cocok. Bangun `Date` dari `Date.UTC(y, m-1, d, hh, mm)` lalu kurangi `utcOffsetMinutes * 60_000`. Jam `endTime` yang lebih kecil dari `startTime` dianggap sesi melewati tengah malam — tambahkan 24 jam.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/domain/time.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/domain/time.ts tests/domain/time.test.ts
git commit -m "feat: build UTC session window from WIB clock times"
```

---

### Task 4: Scan Result Resolution

**Files:**
- Create: `src/domain/attendance.ts`
- Test: `tests/domain/attendance.test.ts`

**Interfaces:**
- Consumes: `SessionWindow`, `AttendancePolicy`, `ScanResult` dari `@/domain/types`
- Produces: `resolveScanResult(scannedAt: Date, window: SessionWindow, policy: AttendancePolicy): ScanResult`

- [ ] **Step 1: Tulis test yang gagal**

`tests/domain/attendance.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveScanResult } from '@/domain/attendance';
import type { SessionWindow, AttendancePolicy } from '@/domain/types';

const window: SessionWindow = {
  startsAt: new Date('2026-11-20T01:00:00Z'), // 08:00 WIB
  endsAt: new Date('2026-11-20T02:30:00Z'),   // 09:30 WIB
};
const policy: AttendancePolicy = { earlyOpenMinutes: 15, lateThresholdMinutes: 15 };

const at = (iso: string) => new Date(iso);

describe('resolveScanResult', () => {
  it('menolak scan 16 menit sebelum jam mulai', () => {
    expect(resolveScanResult(at('2026-11-20T00:44:00Z'), window, policy))
      .toEqual({ ok: false, reason: 'too_early' });
  });

  it('menerima scan tepat 15 menit sebelum jam mulai sebagai hadir', () => {
    expect(resolveScanResult(at('2026-11-20T00:45:00Z'), window, policy))
      .toEqual({ ok: true, status: 'hadir' });
  });

  it('menerima scan tepat di jam mulai sebagai hadir', () => {
    expect(resolveScanResult(at('2026-11-20T01:00:00Z'), window, policy))
      .toEqual({ ok: true, status: 'hadir' });
  });

  it('menerima scan tepat di batas toleransi sebagai hadir', () => {
    expect(resolveScanResult(at('2026-11-20T01:15:00Z'), window, policy))
      .toEqual({ ok: true, status: 'hadir' });
  });

  it('menandai terlambat satu detik setelah batas toleransi', () => {
    expect(resolveScanResult(at('2026-11-20T01:15:01Z'), window, policy))
      .toEqual({ ok: true, status: 'terlambat' });
  });

  it('menerima scan tepat di jam selesai sebagai terlambat', () => {
    expect(resolveScanResult(at('2026-11-20T02:30:00Z'), window, policy))
      .toEqual({ ok: true, status: 'terlambat' });
  });

  it('menolak scan satu detik setelah jam selesai', () => {
    expect(resolveScanResult(at('2026-11-20T02:30:01Z'), window, policy))
      .toEqual({ ok: false, reason: 'expired' });
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/domain/attendance.test.ts`
Expected: FAIL — module tidak ditemukan

- [ ] **Step 3: Implementasi `resolveScanResult`**

Batas buka = `startsAt - earlyOpenMinutes * 60_000`. Bila `scannedAt < batasBuka` → `{ ok: false, reason: 'too_early' }`. Bila `scannedAt > endsAt` → `{ ok: false, reason: 'expired' }`. Batas terlambat = `startsAt + lateThresholdMinutes * 60_000`. Bila `scannedAt <= batasTerlambat` → `hadir`, selain itu `terlambat`. Perbandingan pakai `getTime()`.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/domain/attendance.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add src/domain/attendance.ts tests/domain/attendance.test.ts
git commit -m "feat: resolve attendance status from scan time and session window"
```

---

### Task 5: Final Status For Reporting

**Files:**
- Modify: `src/domain/attendance.ts`
- Test: `tests/domain/attendance.test.ts` (tambahkan blok describe baru)

**Interfaces:**
- Consumes: `resolveScanResult`, tipe domain
- Produces: `resolveFinalStatus(record: { status: AttendanceStatus } | null, window: SessionWindow, now: Date): AttendanceStatus`

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `tests/domain/attendance.test.ts`:
```ts
import { resolveFinalStatus } from '@/domain/attendance';

describe('resolveFinalStatus', () => {
  it('mengembalikan status record bila sudah absen', () => {
    expect(resolveFinalStatus({ status: 'terlambat' }, window, at('2026-11-20T05:00:00Z')))
      .toBe('terlambat');
  });

  it('mengembalikan tidak_hadir bila belum absen dan sesi sudah selesai', () => {
    expect(resolveFinalStatus(null, window, at('2026-11-20T02:30:01Z')))
      .toBe('tidak_hadir');
  });

  it('mengembalikan tidak_hadir bila belum absen dan sekarang persis jam selesai', () => {
    expect(resolveFinalStatus(null, window, at('2026-11-20T02:30:00Z')))
      .toBe('tidak_hadir');
  });

  it('tetap tidak_hadir untuk sesi yang belum dimulai', () => {
    expect(resolveFinalStatus(null, window, at('2026-11-20T00:00:00Z')))
      .toBe('tidak_hadir');
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/domain/attendance.test.ts`
Expected: FAIL — `resolveFinalStatus` bukan export

- [ ] **Step 3: Implementasi `resolveFinalStatus`**

Bila `record` tidak null → kembalikan `record.status`. Selain itu → `'tidak_hadir'` (dihitung saat laporan; sesi yang belum lewat pun belum punya record, dan laporan hanya menampilkan sesi yang sudah lewat).

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/domain/attendance.test.ts`
Expected: PASS (11 test total)

- [ ] **Step 5: Commit**

```bash
git add src/domain/attendance.ts tests/domain/attendance.test.ts
git commit -m "feat: resolve final status for reporting"
```

---

### Task 6: Database Schema Migration

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tabel `schools`, `school_settings`, `academic_years`, `users`, `subjects`, `classes`, `schedules`, `schedule_exceptions`, `attendance_sessions`, `attendance_records`

- [ ] **Step 1: Tulis migration**

Isi `0001_schema.sql`:

```sql
create extension if not exists "pgcrypto";

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  timezone_offset_minutes int not null default 420,
  created_at timestamptz not null default now()
);

create table school_settings (
  school_id uuid primary key references schools(id) on delete cascade,
  early_open_minutes int not null default 15,
  late_threshold_minutes int not null default 15,
  session_token_ttl_minutes int not null default 15
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('superadmin','kepala_sekolah','guru')),
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  code text
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  level int
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Minggu
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  date date not null,
  type text not null check (type in ('libur_nasional','ulangan_umum','event')),
  description text,
  affects_all boolean not null default true,
  schedule_id uuid references schedules(id) on delete cascade,
  check (affects_all or schedule_id is not null)
);

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  date date not null,
  token uuid not null unique default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, date)
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  status text not null check (status in ('hadir','terlambat')),
  unique (session_id)
);

create index on attendance_sessions (date);
create index on attendance_sessions (teacher_id, date);
create index on attendance_records (teacher_id);
create index on schedules (academic_year_id, day_of_week);
```

- [ ] **Step 2: Terapkan ke project Supabase**

Prasyarat: user sudah membuat project Supabase dan menyimpan `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`. Terapkan lewat SQL Editor di dashboard Supabase (salin-tempel isi file), karena Supabase CLI tidak tersedia di mesin ini.

- [ ] **Step 3: Verifikasi tabel ada**

Jalankan di SQL Editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```
Expected: 10 tabel di atas muncul (plus tabel bawaan Supabase).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat: add database schema"
```

---

### Task 7: RLS Policies And Attendance Function

**Files:**
- Create: `supabase/migrations/0002_rls.sql`, `supabase/migrations/0003_record_attendance.sql`

**Interfaces:**
- Consumes: skema dari Task 6
- Produces: RPC `record_attendance(p_token uuid) returns jsonb`; policy baca/tulis per role

- [ ] **Step 1: Tulis migration RLS**

Isi `0002_rls.sql` — aktifkan RLS di semua 10 tabel, lalu:

```sql
-- helper: role & school dari JWT
create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function auth_school_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'school_id', '')::uuid
$$;
```

Policy ringkas:
- `superadmin` → `all` pada `schools`, `school_settings`, `academic_years`, `users`, `subjects`, `classes`
- `kepala_sekolah` → `select` semua tabel; `all` pada `schedules` dan `schedule_exceptions`
- `guru` → `select` pada `schedules` (hanya `teacher_id = auth.uid()`), `select` pada `attendance_sessions` (hanya milik sendiri), `select` pada `attendance_records` (hanya milik sendiri)
- Semua role → `select` pada `subjects`, `classes`, `academic_years` (dibutuhkan untuk render jadwal)
- **Tidak ada** policy `insert` pada `attendance_records` — penulisan hanya lewat RPC

- [ ] **Step 2: Tulis migration `record_attendance`**

Isi `0003_record_attendance.sql`:

```sql
create or replace function record_attendance(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session attendance_sessions%rowtype;
  v_settings school_settings%rowtype;
  v_open timestamptz;
  v_late timestamptz;
  v_status text;
  v_existing attendance_records%rowtype;
begin
  select s.* into v_session
  from attendance_sessions s
  where s.token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_session.teacher_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select ss.* into v_settings
  from school_settings ss
  join schedules sc on sc.school_id = ss.school_id
  where sc.id = v_session.schedule_id;

  v_open := v_session.starts_at
            - make_interval(mins => coalesce(v_settings.early_open_minutes, 15));
  v_late := v_session.starts_at
            + make_interval(mins => coalesce(v_settings.late_threshold_minutes, 15));

  if now() < v_open then
    return jsonb_build_object('ok', false, 'reason', 'too_early');
  end if;

  if now() > v_session.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select * into v_existing from attendance_records where session_id = v_session.id;
  if found then
    return jsonb_build_object('ok', true, 'status', v_existing.status, 'duplicate', true);
  end if;

  v_status := case when now() <= v_late then 'hadir' else 'terlambat' end;

  insert into attendance_records (session_id, teacher_id, scanned_at, status)
  values (v_session.id, v_session.teacher_id, now(), v_status);

  return jsonb_build_object('ok', true, 'status', v_status, 'duplicate', false);
end;
$$;

revoke all on function record_attendance(uuid) from public;
grant execute on function record_attendance(uuid) to authenticated;
```

- [ ] **Step 3: Terapkan kedua migration ke Supabase**

Salin-tempel ke SQL Editor, jalankan berurutan.

- [ ] **Step 4: Verifikasi RPC menolak token tak dikenal**

Di SQL Editor:
```sql
select record_attendance('00000000-0000-0000-0000-000000000000');
```
Expected: `{"ok": false, "reason": "not_found"}`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_rls.sql supabase/migrations/0003_record_attendance.sql
git commit -m "feat: add rls policies and record_attendance rpc"
```

---

### Task 8: Supabase Client, Auth Provider, Role Routing

**Files:**
- Create: `src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`, `src/auth/useAuth.ts`, `src/auth/RequireRole.tsx`, `src/routes/router.tsx`, `src/App.tsx` (modify), `.env.example`
- Test: `tests/auth/RequireRole.test.tsx`

**Interfaces:**
- Consumes: env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Produces: `useAuth(): { user: User | null; role: Role | null; loading: boolean; signIn(email, password): Promise<void>; signOut(): Promise<void> }`; `<RequireRole allow={Role[]}>`

- [ ] **Step 1: Buat `.env.example` dan `src/lib/supabase.ts`**

`.env.example`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`src/lib/supabase.ts` melempar `Error('VITE_SUPABASE_URL wajib diisi')` bila env kosong, lalu `export const supabase = createClient(url, key)`.

- [ ] **Step 2: Tulis test yang gagal**

`tests/auth/RequireRole.test.tsx` — mock `useAuth` dengan `vi.mock`, lalu:
```tsx
it('mengalihkan guru dari halaman admin', () => {
  // useAuth → { role: 'guru', loading: false, user: {...} }
  // render <MemoryRouter><RequireRole allow={['superadmin']}><div>rahasia</div></RequireRole></MemoryRouter>
  // expect(screen.queryByText('rahasia')).not.toBeInTheDocument()
});

it('mengizinkan superadmin', () => {
  // expect(screen.getByText('rahasia')).toBeInTheDocument()
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/auth/RequireRole.test.tsx`
Expected: FAIL — komponen tidak ada

- [ ] **Step 4: Implementasi AuthProvider, useAuth, RequireRole**

`AuthProvider` memanggil `supabase.auth.getSession()` saat mount, berlangganan `onAuthStateChange`, dan membaca role dari `session.user.app_metadata.role`. `RequireRole` mengembalikan `<Navigate to="/" replace />` bila role tidak diizinkan, dan spinner bila `loading`.

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/auth/RequireRole.test.tsx`
Expected: PASS

- [ ] **Step 6: Buat router**

`src/routes/router.tsx` dengan `createBrowserRouter`:
- `/login` → LoginPage
- `/` → redirect sesuai role: superadmin → `/admin`, kepala_sekolah → `/jadwal`, guru → `/hari-ini`
- `/admin` → RequireRole(['superadmin'])
- `/jadwal` → RequireRole(['kepala_sekolah'])
- `/laporan` → RequireRole(['kepala_sekolah'])
- `/hari-ini` → RequireRole(['guru'])
- `/absen/:token` → RequireRole(['guru'])

Halaman di atas dibuat sebagai placeholder di task ini; diisi di task berikutnya.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add supabase client auth provider and role-based routing"
```

---

### Task 9: Master Data Admin (Super Admin)

**Files:**
- Create: `src/features/admin/AdminPage.tsx`, `src/features/admin/SchoolForm.tsx`, `src/features/admin/AcademicYearForm.tsx`, `src/features/admin/SubjectForm.tsx`, `src/features/admin/ClassForm.tsx`, `src/features/admin/UserForm.tsx`, `src/features/admin/queries.ts`
- Test: `tests/features/admin/queries.test.ts`

**Interfaces:**
- Consumes: `supabase` dari `@/lib/supabase`
- Produces: hooks `useSchools()`, `useAcademicYears()`, `useSubjects()`, `useClasses()`, `useUsers()` dan mutation `createSubject`, `createClass`, `createAcademicYear`, `activateAcademicYear`

- [ ] **Step 1: Tulis test yang gagal**

`tests/features/admin/queries.test.ts` — mock `@/lib/supabase` dengan `vi.mock`, lalu uji bahwa `createSubject({ name: 'Matematika', code: 'MTK' })` memanggil `supabase.from('subjects').insert(...)` dengan payload benar, dan melempar error bila insert gagal.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/features/admin/queries.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi `queries.ts`**

Semua fungsi query/mutation sebagai fungsi async biasa; dibungkus TanStack Query di komponen. `activateAcademicYear(id)` melakukan dua langkah: set `is_active = false` untuk semua tahun ajaran di sekolah itu, lalu `is_active = true` untuk `id`.

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/features/admin/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Bangun `AdminPage.tsx`**

Tab: Sekolah · Tahun Ajaran · Mata Pelajaran · Kelas · Guru. Tiap tab berisi daftar (Card, mobile-first) + tombol "Tambah" yang membuka `Sheet` berisi form. Setelah submit, invalidate query terkait.

Catatan implementasi: pembuatan user guru butuh `service_role` (Supabase Auth admin API). Untuk MVP, **jangan** buat user dari UI — tampilkan instruksi "buat user lewat dashboard Supabase → Authentication → Add user, lalu isi `app_metadata` `{ role: 'guru', school_id: '<uuid>' }`", plus form untuk mengisi baris di tabel `users`. Ini menghindari menaruh `service_role` key di browser.

- [ ] **Step 6: Verifikasi manual**

Run: `npm run dev`, login sebagai superadmin, tambah 1 mata pelajaran, 1 kelas, 1 tahun ajaran. Refresh halaman — data masih ada.
Expected: data persist

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add super admin master data management"
```

---

### Task 10: Schedule CRUD And Exceptions (Kepala Sekolah)

**Files:**
- Create: `src/features/schedule/SchedulePage.tsx`, `src/features/schedule/ScheduleForm.tsx`, `src/features/schedule/ExceptionPage.tsx`, `src/features/schedule/ExceptionForm.tsx`, `src/features/schedule/queries.ts`
- Test: `tests/features/schedule/queries.test.ts`

**Interfaces:**
- Consumes: `supabase`, master data dari Task 9
- Produces: `createSchedule(input)`, `updateSchedule(id, input)`, `deleteSchedule(id)`, `createException(input)`, `deleteException(id)`; tipe `ScheduleInput = { teacher_id, class_id, subject_id, day_of_week, start_time, end_time, academic_year_id }`

- [ ] **Step 1: Tulis test yang gagal**

Uji `createSchedule` mengirim payload benar dan melempar error yang bisa dibaca bila constraint `end_time > start_time` dilanggar (Supabase mengembalikan `code: '23514'`). Uji juga `createException` dengan `affects_all: true` mengirim `schedule_id: null`.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/features/schedule/queries.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi `queries.ts`**

Petakan error Postgres ke pesan Indonesia: `23514` → "Jam selesai harus setelah jam mulai".

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/features/schedule/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Bangun `SchedulePage.tsx`**

Tampilan grid mingguan: 7 kolom hari (Senin–Minggu), tiap kolom berisi kartu jadwal. Di mobile, hari ditampilkan sebagai daftar vertikal dengan heading hari. Form tambah jadwal: pilih guru, kelas, mapel (dropdown), hari, jam mulai, jam selesai.

- [ ] **Step 6: Bangun `ExceptionPage.tsx`**

Daftar pengecualian + form: tanggal, tipe (libur_nasional / ulangan_umum / event), keterangan, toggle "berlaku semua jadwal" atau pilih satu jadwal.

- [ ] **Step 7: Verifikasi manual**

Run: `npm run dev`, login sebagai kepala sekolah, tambah jadwal Senin 08:00–09:30, lalu tambah pengecualian 25 Des 2026 tipe libur_nasional.
Expected: keduanya tersimpan dan tampil

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add schedule and exception management"
```

---

### Task 11: Session Generation (pg_cron)

**Files:**
- Create: `supabase/migrations/0004_generate_sessions.sql`
- Test: `tests/domain/session-generation.test.ts` (menguji logika pemilihan jadwal yang sama di TS)

**Interfaces:**
- Consumes: skema Task 6
- Produces: fungsi SQL `generate_sessions_for_date(p_date date) returns int` (jumlah sesi dibuat)

- [ ] **Step 1: Tulis test yang gagal**

`tests/domain/session-generation.test.ts` menguji fungsi murni `shouldGenerateSession({ schedule, date, exceptions })`:
```ts
it('melewati tanggal yang jadi libur nasional untuk semua jadwal', () => {
  expect(shouldGenerateSession({
    schedule: { day_of_week: 1, is_active: true },
    date: '2026-12-25',
    dayOfWeek: 5,
    exceptions: [{ date: '2026-12-25', type: 'libur_nasional', affects_all: true, schedule_id: null }],
  })).toBe(false);
});

it('melewati jadwal yang tidak aktif', () => { /* ... → false */ });
it('melewati hari yang tidak cocok', () => { /* day_of_week 1 vs dayOfWeek 5 → false */ });
it('menghasilkan sesi bila tidak ada pengecualian dan hari cocok', () => { /* → true */ });
it('menghormati pengecualian yang hanya untuk satu jadwal', () => { /* ... */ });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/domain/session-generation.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi `shouldGenerateSession` di `src/domain/session-generation.ts`**

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/domain/session-generation.test.ts`
Expected: PASS

- [ ] **Step 5: Tulis migration `0004_generate_sessions.sql`**

```sql
create extension if not exists pg_cron;

create or replace function generate_sessions_for_date(p_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_tz int;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  for r in
    select sc.*, s.timezone_offset_minutes
    from schedules sc
    join schools s on s.id = sc.school_id
    where sc.is_active
      and sc.day_of_week = extract(dow from p_date)::int
      and p_date between (select start_date from academic_years ay where ay.id = sc.academic_year_id)
                    and (select end_date   from academic_years ay where ay.id = sc.academic_year_id)
      and not exists (
        select 1 from schedule_exceptions e
        where e.school_id = sc.school_id
          and e.date = p_date
          and (e.affects_all or e.schedule_id = sc.id)
      )
  loop
    v_starts := ((p_date::text || ' ' || r.start_time::text)::timestamp
                 - make_interval(mins => r.timezone_offset_minutes)) at time zone 'UTC';
    v_ends   := ((p_date::text || ' ' || r.end_time::text)::timestamp
                 - make_interval(mins => r.timezone_offset_minutes)) at time zone 'UTC';

    insert into attendance_sessions (schedule_id, teacher_id, date, starts_at, ends_at)
    values (r.id, r.teacher_id, p_date, v_starts, v_ends)
    on conflict (schedule_id, date) do nothing;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;
```

Jadwalkan:
```sql
select cron.schedule('generate-sessions-daily', '0 17 * * *',
  $$select generate_sessions_for_date((now() at time zone 'Asia/Jakarta')::date + 1)$$);
```
(17:00 UTC = 00:00 WIB, membuat sesi untuk hari berikutnya.)

- [ ] **Step 6: Verifikasi di Supabase**

Tambahkan satu jadwal untuk hari ini, lalu:
```sql
select generate_sessions_for_date(current_date);
select count(*) from attendance_sessions where date = current_date;
```
Expected: jumlah sesi > 0, dan menjalankan ulang tidak menambah baris (idempoten karena `on conflict do nothing`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: generate daily attendance sessions via pg_cron"
```

---

### Task 12: Teacher Today View And Scan Page

**Files:**
- Create: `src/features/attendance/TodayPage.tsx`, `src/features/attendance/ScanPage.tsx`, `src/features/attendance/queries.ts`
- Test: `tests/features/attendance/queries.test.ts`

**Interfaces:**
- Consumes: `supabase`, `resolveScanResult`, `resolveFinalStatus`
- Produces: `useTodaySessions()`, `recordAttendance(token: string): Promise<ScanResult>`

- [ ] **Step 1: Tulis test yang gagal**

Uji `recordAttendance` memanggil `supabase.rpc('record_attendance', { p_token: token })` dan memetakan `{ ok: false, reason: 'expired' }` ke pesan "Sesi sudah berakhir". Uji juga bahwa `ok: true, duplicate: true` menghasilkan pesan "Kamu sudah tercatat hadir", dan `{ ok: false, reason: 'not_yours' }` menghasilkan pesan "Link ini bukan untuk jadwal mengajar kamu" (guru tidak boleh bisa absen memakai token guru lain).

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/features/attendance/queries.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi `queries.ts`**

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/features/attendance/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Bangun `TodayPage.tsx`**

Header "Jadwal Hari Ini" + tanggal dalam format Indonesia. Tiap sesi jadi Card: nama mapel, kelas, jam (WIB), badge status (Hadir / Terlambat / Tidak Hadir / Belum absen), dan tombol "Absen Sekarang" yang menuju `/absen/:token`. Bila `token` sudah lewat `ends_at`, tombol diganti teks "Sesi sudah berakhir".

- [ ] **Step 6: Bangun `ScanPage.tsx`**

Halaman `/absen/:token`: tampilkan detail sesi, lalu tombol besar "Konfirmasi Kehadiran". Setelah ditekan → panggil `recordAttendance(token)` → tampilkan hasil: sukses (status + waktu scan WIB) atau pesan error yang jelas. Tampilkan juga QR code sesi ini (via `qrcode.react`) supaya Kepala Sekolah bisa mencetak/menampilkan bila perlu.

- [ ] **Step 7: Verifikasi manual end-to-end**

Run: `npm run dev`, login sebagai guru, buka `/hari-ini`, klik "Absen Sekarang".
Expected: status berubah jadi "Hadir" (bila dalam 15 menit pertama), dan menekan ulang menampilkan "Kamu sudah tercatat hadir" tanpa membuat record baru.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add teacher today view and attendance scan page"
```

---

### Task 13: Reports And CSV Export (Kepala Sekolah)

**Files:**
- Create: `src/features/reports/ReportsPage.tsx`, `src/features/reports/queries.ts`, `src/features/reports/csv.ts`
- Test: `tests/features/reports/csv.test.ts`, `tests/features/reports/queries.test.ts`

**Interfaces:**
- Consumes: `supabase`, `resolveFinalStatus`
- Produces: `buildCsv(rows: ReportRow[]): string`; `useMonthlyReport(month: string)`

- [ ] **Step 1: Tulis test yang gagal**

`tests/features/reports/csv.test.ts`:
```ts
it('menghasilkan header dan baris CSV dengan escaping koma', () => {
  const csv = buildCsv([{ teacher: 'Budi, S.Pd', hadir: 10, terlambat: 1, tidakHadir: 2 }]);
  expect(csv.split('\n')[0]).toBe('Guru,Hadir,Terlambat,Tidak Hadir');
  expect(csv.split('\n')[1]).toBe('"Budi, S.Pd",10,1,2');
});
```
Uji juga bahwa field berisi tanda kutip di-escape menjadi `""`.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx vitest run tests/features/reports/csv.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasi `csv.ts`**

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx vitest run tests/features/reports/csv.test.ts`
Expected: PASS

- [ ] **Step 5: Implementasi `queries.ts`**

`useMonthlyReport(month)` mengambil `attendance_sessions` + `attendance_records` untuk bulan tersebut (join ke `users` dan `subjects`), lalu mengagregasi per guru memakai `resolveFinalStatus` untuk sesi yang tidak punya record.

- [ ] **Step 6: Bangun `ReportsPage.tsx`**

Pemilih bulan (input `type="month"`, default bulan berjalan). Tabel rekap per guru: Hadir / Terlambat / Tidak Hadir / Persentase. Tombol "Export CSV" memakai `buildCsv` + `Blob` + `URL.createObjectURL`. Tombol "Cetak" memanggil `window.print()`.

- [ ] **Step 7: Verifikasi manual**

Run: `npm run dev`, login sebagai kepala sekolah, buka `/laporan`, pilih bulan berjalan.
Expected: tabel terisi; tombol Export CSV mengunduh file dengan isi sesuai tampilan.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add monthly attendance reports with csv export"
```

---

### Task 14: Deploy To Vercel

**Files:**
- Create: `vercel.json`, `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: semua task sebelumnya
- Produces: URL produksi yang bisa dibuka dari Android

- [ ] **Step 1: Tambah `vercel.json` untuk SPA routing**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Tanpa ini, membuka `/absen/<token>` langsung akan 404.

- [ ] **Step 2: Tambah CI**

`.github/workflows/ci.yml`: jalankan `npm ci`, `npx tsc --noEmit`, `npm test -- --run` pada push ke `main` dan PR.

- [ ] **Step 3: Tulis `README.md`**

Cantumkan: prasyarat (Node 20+, project Supabase), cara mengisi `.env.local`, cara menerapkan 4 migration lewat SQL Editor, cara membuat user lewat dashboard Supabase beserta contoh `app_metadata`, dan cara menjalankan `npm run dev`.

- [ ] **Step 4: Deploy**

Push ke GitHub → import repo di Vercel → set `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di Environment Variables → deploy.

- [ ] **Step 5: Verifikasi produksi**

Buka URL Vercel dari Android, login sebagai guru, buka `/hari-ini`, klik "Absen Sekarang", lalu refresh halaman.
Expected: status tetap "Hadir", dan URL `/absen/<token>` bisa dibuka langsung tanpa 404.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add vercel config ci and readme"
```

---

## Catatan Eksekusi

**Prasyarat yang belum ada di mesin ini:**
- Docker tidak terpasang → Supabase lokal tidak bisa dijalankan. Semua task database (6, 7, 11) diverifikasi terhadap **project Supabase cloud** milik user.
- Supabase CLI tidak terpasang → migration diterapkan manual lewat SQL Editor.

**Konsekuensi:** Task 6, 7, dan 11 tidak bisa dijalankan penuh tanpa `SUPABASE_URL` dan akses ke project Supabase. Task 1–5 dan 8–14 bisa dikerjakan tanpa itu (Task 8–14 memakai mock Supabase di test).
