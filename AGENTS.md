# AGENTS.md — Proyek Absensi Guru

## Model LLM

Proyek ini memakai provider **Cosmosin** (`https://api.cosmosin.io/v1`, OpenAI-compatible,
harga IDR). Tiga alias sudah dikonfigurasi di `~/.hermes/profiles/surish/config.yaml`:

| Alias | Model | Pakai untuk |
|---|---|---|
| `absensi` | `glm-5.3` | **Default proyek ini.** Logika domain, bugfix, tool chain agentic |
| `cepat` | `deepseek-v4.1-flash` | Task mekanis: scaffold, form CRUD, boilerplate, rename |
| `kuat` | `gpt-6.2-astra` | Keputusan arsitektur yang tidak bisa diuji otomatis (mahal — pakai hemat) |

Jalankan dengan: `hermes chat --model absensi`

**Jangan pakai** (hasil bake-off, lihat `~/bakeoff-final.json`):
- `hy4-preview` — gagal total menulis kode (bakar 20k token di reasoning, 272s)
- `qwen-3.8-max` — 33× lebih boros token (11.420 vs ~350) meski harga/1M terlihat termurah
- `kimi-k3.1-pro` — lambat (28–32s per task)

## Konvensi kode

- **Timezone:** semua timestamp disimpan **UTC** (`timestamptz`). Konversi ke WIB (UTC+7) hanya
  di layer tampilan. Jangan pernah menyimpan waktu lokal.
- **Konstanta waktu** (toleransi 15 menit, window 15 menit sebelum mulai) dibaca dari tabel
  `school_settings`, tidak di-hardcode di komponen.
- **Copy UI dalam Bahasa Indonesia.**
- **Mobile-first:** layout dirancang untuk 360–430px. Tabel laporan boleh scroll horizontal.
- Logika bisnis absensi ada di `src/domain/` sebagai fungsi murni (tanpa React/Supabase),
  dan di Postgres function `record_attendance` sebagai otoritas penulisan.

## Dokumen

- Spec: `docs/superpowers/specs/2026-11-18-absensi-guru-design.md`
- Plan: `docs/superpowers/plans/2026-11-19-absensi-guru.md`

## Catatan lingkungan

- Docker dan Supabase CLI **tidak tersedia**. Migration diterapkan ke project Supabase cloud.
- Git identity repo ini: `Surish <surish@localhost>`.
