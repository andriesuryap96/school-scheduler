/**
 * Query laporan kehadiran bulanan (kepala sekolah, /laporan).
 *
 * Mengikuti pola src/features/attendance/queries.ts: fungsi data async
 * biasa (mudah diuji) + hook TanStack Query sebagai pembungkus tipis.
 *
 * Alur:
 * - ambil attendance_sessions bulan tsb (join users/subjects) beserta
 *   attendance_records-nya lewat embed PostgREST;
 * - status akhir tiap sesi ditentukan `resolveFinalStatus`
 *   (src/domain/attendance.ts): record ada → status record (hadir /
 *   terlambat); record null → 'tidak_hadir';
 * - sesi yang belum selesai (masa depan) dan belum punya record tidak
 *   dihitung — jangan labeli "tidak hadir" guru yang masih akan
 *   mengajar (dokumentasi resolveFinalStatus: laporan hanya menampilkan
 *   sesi yang sudah lewat).
 *
 * Semua pesan user dalam Bahasa Indonesia.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { resolveFinalStatus } from '@/domain/attendance';
import type { AttendanceStatus, SessionWindow } from '@/domain/types';
import type { ReportRow } from './csv';

export type { ReportRow };

// =====================================================================
// Row types (mirror supabase/migrations/0001_schema.sql + join)
// =====================================================================

/** attendance_records maksimal 1 per sesi (unique session_id). */
interface RecordJoinRow {
  status: 'hadir' | 'terlambat';
  scanned_at: string;
}

/** Row mentah hasil join PostgREST. */
interface ReportSessionJoinRow {
  id: string;
  teacher_id: string;
  date: string;
  starts_at: string; // ISO timestamptz
  ends_at: string;
  users: { name: string } | null;
  schedules: { subjects: { name: string } | null } | null;
  attendance_records: RecordJoinRow[] | null;
}

// =====================================================================
// Helpers
// =====================================================================

/** Kolom + join yang dipakai query laporan. */
const REPORT_SELECT = [
  'id, teacher_id, date, starts_at, ends_at',
  'users ( name )',
  'schedules ( subjects ( name ) )',
  'attendance_records ( status, scanned_at )',
].join(', ');

/**
 * Rentang tanggal sebuah bulan 'YYYY-MM' (zona WIB = tanggal kalender
 * sekolah): [awal bulan, awal bulan berikutnya).
 * Mengembalikan string date 'YYYY-MM-DD' untuk filter PostgREST.
 */
export function monthRange(month: string): { start: string; end: string } {
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${y}-${pad(m)}-01`;
  const end = `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}-01`;
  return { start, end };
}

/** SessionWindow UTC dari kolom sesi. */
function toWindow(row: Pick<ReportSessionJoinRow, 'starts_at' | 'ends_at'>): SessionWindow {
  return { startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) };
}

// =====================================================================
// Reads
// =====================================================================

/**
 * Agregasi kehadiran seluruh guru untuk satu bulan.
 *
 * @param month kunci bulan 'YYYY-MM'
 * @param now   waktu referensi (default waktu nyata) — menentukan sesi
 *              mana yang dianggap sudah lewat; parameter agar mudah
 *              diuji secara deterministik.
 */
export async function getMonthlyReport(month: string, now: Date = new Date()): Promise<ReportRow[]> {
  const { start, end } = monthRange(month);

  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(REPORT_SELECT)
    .gte('date', start)
    .lt('date', end)
    .order('date');
  if (error) throw error;

  const rows = (data ?? []) as unknown as ReportSessionJoinRow[];

  const totals = new Map<string, ReportRow>();
  for (const row of rows) {
    const record = row.attendance_records?.[0] ?? null;
    // Sesi belum selesai & belum ada record → belum bisa dinilai:
    // jangan dihitung sebagai tidak hadir.
    if (!record && new Date(row.ends_at).getTime() > now.getTime()) {
      continue;
    }

    const status: AttendanceStatus = resolveFinalStatus(
      record ? { status: record.status } : null,
      toWindow(row),
      now,
    );

    const teacher = row.users?.name ?? row.teacher_id;
    let t = totals.get(teacher);
    if (!t) {
      t = { teacher, hadir: 0, terlambat: 0, tidakHadir: 0 };
      totals.set(teacher, t);
    }
    if (status === 'hadir') t.hadir += 1;
    else if (status === 'terlambat') t.terlambat += 1;
    else t.tidakHadir += 1;
  }

  // Urut nama guru supaya tabel & CSV stabil.
  return [...totals.values()].sort((a, b) => a.teacher.localeCompare(b.teacher, 'id'));
}

// =====================================================================
// TanStack Query hooks (dipakai ReportsPage)
// =====================================================================

export const queryKeys = {
  /** Prefix semua query laporan bulanan. */
  monthlyReportPrefix: ['monthly-report'] as const,
  monthlyReport: (month: string) => ['monthly-report', month] as const,
};

/** Laporan kehadiran bulanan seluruh guru (kepala sekolah). */
export function useMonthlyReport(month: string) {
  return useQuery({
    queryKey: queryKeys.monthlyReport(month),
    queryFn: () => getMonthlyReport(month),
    enabled: !!month,
  });
}
