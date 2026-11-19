# Design Doc: Sistem Absensi Guru — Yayasan Pendidikan

**Date:** 2026-11-18 (approved 2026-11-19)
**Status:** APPROVED

---

## Intent & Why

Aplikasi web mobile-first untuk mengelola absensi guru di yayasan pendidikan. Ini
adalah fondasi LMS (Learning Management System) yang lebih besar. Tujuan segera:
menggantikan pencatatan manual kehadiran guru dengan sistem digital berbasis
QR/link unik per guru per sesi mengajar, yang bisa dipakai dari Android smartphone
tanpa install aplikasi.

## Goals

- Super Admin mengkonfigurasi aplikasi (data sekolah, tahun ajaran, master data, kelola user)
- Kepala Sekolah membuat jadwal mingguan berulang per semester
- Sistem otomatis generate sesi absensi dari jadwal setiap hari
- Tiap guru mendapat link/QR unik per sesi mengajar mereka
- Guru scan/klik link → sistem catat Hadir atau Terlambat
- Tidak scan dalam window waktu → otomatis Tidak Hadir
- Kepala Sekolah melihat laporan kehadiran (per guru, per bulan, per kelas) dan export

## Non-Goals

- Absensi siswa
- Modul nilai / akademik siswa
- Komunikasi guru-orang tua
- Multi-sekolah (ada 2 sekolah di yayasan, hanya 1 yang urgent — tambah nanti)
- Approval izin/sakit (tidak scan = tidak hadir)

## Anti-Goals

- Jangan membuat sistem yang terlalu kompleks untuk dipakai guru non-teknis di smartphone
- Jangan membuat dependency ke hardware khusus (fingerprint, RFID)

## Constraints

- Skala awal: 1 sekolah, 4 guru (termasuk Kepala Sekolah mengajar), 4 kelas, 1 lokasi
- Pengguna utama: Android smartphone
- Stack: React + shadcn/ui + Tailwind | Supabase (Auth + DB + Edge Functions) | Vercel
- Kalender akademik: jadwal mingguan berulang dengan pengecualian (libur nasional, ulangan umum, event sekolah)

## Actors & Roles

| Role | Akses |
|------|-------|
| **Super Admin** | Konfigurasi app, master data sekolah, tahun ajaran, kelola user |
| **Kepala Sekolah** | Buat/edit jadwal, lihat & export laporan, lihat status absensi realtime |
| **Guru** | Lihat jadwal sendiri, klik link/scan QR untuk absensi |

Super Admin adalah orang terpisah (bukan Kepala Sekolah).

## Approaches Considered

- **Opsi A — FastAPI + SQLite + Vanilla JS:** Self-hosted, cepat untuk MVP, kurang ideal untuk LMS jangka panjang karena scaling terbatas
- **Opsi B — Static + Google Sheets:** Sangat mudah dikelola non-teknis, tidak fleksibel untuk pengembangan LMS
- **Opsi C — React + Supabase + Vercel ✅ (dipilih):** Production-ready dari awal, auth built-in, realtime, gratis sampai skala tertentu, paling mudah dikembangkan ke LMS penuh. Trade-off: lebih kompleks, dependency ke layanan cloud pihak ketiga

## Database Schema

```
schools             — data sekolah (name, address, timezone)
academic_years      — tahun ajaran (name, start_date, end_date, is_active)
users               — semua user, linked ke Supabase Auth
                      (auth_id, name, email, role: superadmin/kepala_sekolah/guru, school_id)
subjects            — mata pelajaran (name, code)
classes             — kelas (name, level)
schedules           — jadwal mingguan berulang
                      (guru_id, class_id, subject_id, day_of_week 0-6,
                       start_time, end_time, academic_year_id, is_active)
schedule_exceptions — pengecualian jadwal
                      (date, type: libur_nasional/ulangan_umum/event, description,
                       affects_all: bool, schedule_id nullable)
attendance_sessions — sesi absensi harian, di-generate otomatis dari schedules
                      (schedule_id, date, guru_id, token_uuid, expires_at, hadir_cutoff)
attendance_records  — hasil absensi
                      (session_id, guru_id, scanned_at, status: hadir/terlambat/tidak_hadir)
```

## Alur Utama

**Setup (Super Admin):**
Buat sekolah → tahun ajaran → user (guru + kepala sekolah), assign role

**Penjadwalan (Kepala Sekolah):**
Input jadwal mingguan berulang → tambah pengecualian (libur, ulangan, event)

**Generate Sesi Otomatis (Supabase Edge Function / pg_cron, 00:00 WIB):**
Buat `attendance_sessions` untuk hari itu dari `schedules` → skip tanggal yang ada di `schedule_exceptions` → generate token UUID unik per guru per sesi

**Absensi (Guru):**
Buka app → lihat jadwal hari ini → klik link / scan QR → sistem catat waktu scan → bandingkan dengan `start_time` + toleransi 15 menit → status Hadir / Terlambat
Jika tidak scan sampai sesi berakhir → status otomatis Tidak Hadir

**Laporan (Kepala Sekolah):**
Rekap per guru per bulan, per kelas/mata pelajaran, export CSV/PDF

## Decisions Locked In

| Keputusan | Nilai |
|---|---|
| Generate sesi absensi | **Otomatis** (cron/Edge Function), bukan manual |
| Status kehadiran | **Hadir / Terlambat / Tidak Hadir** |
| Toleransi Hadir vs Terlambat | **15 menit** setelah `start_time` (configurable di DB) |
| Window link absensi | **`start_time` − 15 menit s/d `end_time`**. Hadir ≤ `start_time`+15m; Terlambat > `start_time`+15m s/d `end_time`; di luar window = Tidak Hadir |
| Izin/sakit | Tidak ada — tidak scan = tidak hadir |
| QR code | **Unik per guru per sesi** (bukan satu QR di proyektor) |
| Jadwal | Mingguan berulang + pengecualian tanggal |
| Super Admin | Orang terpisah dari Kepala Sekolah |

## Builder's Calls (tidak perlu approval)

- UI library: **shadcn/ui + Tailwind** (mobile-first, ringan)
- QR library: **qrcode.react**
- Role storage: Supabase custom JWT claims (`app_metadata.role`)
- CI/CD: GitHub → Vercel auto-deploy
- Token expiry: 15 menit (configurable di DB)
- Timezone: semua UTC di DB, display WIB di frontend
- Export PDF: `window.print()` + print stylesheet untuk MVP
- Folder structure: feature-based (`/features/attendance`, `/features/schedule`, `/features/reports`)

## Left to the Builder

- Struktur folder React project detail
- Supabase Row Level Security (RLS) policies detail
- Implementasi QR code generator
- Komponen UI spesifik per halaman
- Setup CI/CD ke Vercel
