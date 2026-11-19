# Absensi Guru

Aplikasi absensi guru berbasis web (mobile-first, 360–430px) dengan Supabase
sebagai backend. Guru melakukan absensi mandiri via token/QR, kepala sekolah
mengelola jadwal dan memantau laporan, superadmin mengelola sekolah dan pengguna.

## Prasyarat

- **Node.js 20+** (dan npm)
- **Project Supabase** (cloud, buat gratis di [supabase.com](https://supabase.com))
- Browser modern (aplikasi ini adalah SPA)

## Setup

### 1. Salin dan isi `.env.local`

Salin `.env.example` menjadi `.env.local`, lalu isi dengan nilai dari project
Supabase Anda (**Project Settings → API**):

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

- `VITE_SUPABASE_URL` → **Project URL**
- `VITE_SUPABASE_ANON_KEY` → **anon public key** (bukan `service_role` —
  kunci `service_role` tidak boleh ada di browser)

### 2. Terapkan 4 migration lewat SQL Editor

Docker dan Supabase CLI tidak dipakai; migration diterapkan manual lewat
dashboard Supabase (**SQL Editor → New query**), **satu per satu, sesuai urutan
nomornya** (tabel/policy/function saling bergantung antar-file):

1. `supabase/migrations/0001_schema.sql` — semua tabel
2. `supabase/migrations/0002_rls.sql` — Row Level Security untuk semua tabel
3. `supabase/migrations/0003_record_attendance.sql` — function `record_attendance()`
   (otoritas penulisan absensi, dengan fix null-safe)
4. `supabase/migrations/0004_generate_sessions.sql` — function
   `generate_sessions_for_date()` + schedule pg_cron harian (00:00 WIB)

Cara pakai: buka file SQL-nya, salin seluruh isinya, tempel ke SQL Editor,
klik **Run**. Ulangi untuk file berikutnya.

> **Catatan risiko pg_cron (0004):** di Supabase cloud, ekstensi `pg_cron`
> berada di schema `extensions`. Baris `create extension if not exists pg_cron;`
> bisa gagal atau memasang ekstensi di luar schema tersebut. Jika muncul error
> terkait pg_cron (mis. *extension pg_cron is not allowed* atau schedule tidak
> berjalan), ubah baris itu menjadi:
> ```sql
> create extension if not exists pg_cron with schema extensions;
> ```
> lalu Run ulang. Verifikasi juga schedule cron-nya di **Database → Cron**
> setelah diterapkan.

### 3. Buat user lewat dashboard Supabase

User auth tidak dibuat dari aplikasi (butuh kunci `service_role` yang tidak
boleh ada di browser). Langkahnya:

1. Buat data sekolah dulu: di SQL Editor, `insert` satu baris ke tabel
   `schools` (dan `school_settings` bila perlu mengubah toleransi default),
   catat `id` (UUID) sekolahnya.
2. Buka **Authentication → Users → Add user**, isi email + password.
3. Di detail user tersebut, isi **`app_metadata`** (klik ikon pensil pada
   `app_metadata`) dengan contoh:

   ```json
   { "role": "guru", "school_id": "<uuid sekolah>" }
   ```

   - `role`: salah satu dari `superadmin`, `kepala_sekolah`, `guru`
   - `school_id`: UUID sekolah dari langkah 1

4. Salin **User ID** (UID) user tersebut, lalu isi baris di tabel `users`
   lewat SQL Editor:

   ```sql
   insert into users (id, school_id, name) values ('<user-uid>', '<uuid-sekolah>', 'Nama Guru');
   ```

   (Di dalam aplikasi, halaman Admin tab "Guru" menampilkan panduan langkah 2–4
   ini juga.)

Setelah mengubah `app_metadata` pada user yang sedang login, user perlu
logout/login ulang agar token JWT lama (tanpa klaim baru) diganti.

### 4. Jalankan aplikasi

```bash
npm install
npm run dev
```

Buka URL yang ditampilkan (default `http://localhost:5173`).

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server development (Vite) |
| `npm run build` | Type-check (`tsc --noEmit`) + build produksi ke `dist/` |
| `npm test` | Jalankan seluruh test suite (Vitest) sekali jalan |
| `npm test -- --run` | Sama seperti di atas (bentuk eksplisit untuk CI) |
| `npm run preview` | Preview build produksi secara lokal |

## Deploy ke Vercel (ringkasan)

1. Push repo ke GitHub.
2. Import repo di [vercel.com](https://vercel.com) (framework terdeteksi: Vite).
3. Di **Environment Variables**, tambahkan `VITE_SUPABASE_URL` dan
   `VITE_SUPABASE_ANON_KEY`.
4. Deploy. File `vercel.json` sudah mengatur rewrite SPA sehingga URL seperti
   `/absen/<token>` bisa dibuka langsung tanpa 404.

## Struktur singkat

- `src/domain/` — logika bisnis murni (tanpa React/Supabase), teruji unit
- `src/features/` — halaman per fitur (admin, jadwal, absensi, laporan)
- `src/auth/` — AuthProvider + guard role (klaim `role` dari JWT `app_metadata`)
- `supabase/migrations/` — 4 file SQL skema database
- `tests/` — test suite (Vitest + Testing Library)

## Konvensi penting

- Semua timestamp disimpan **UTC** (`timestamptz`); konversi ke WIB hanya di layer tampilan.
- Toleransi waktu (15 menit default) dibaca dari tabel `school_settings`, tidak di-hardcode.
- Copy UI dalam Bahasa Indonesia.
