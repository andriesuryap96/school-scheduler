/**
 * Query & mutasi absensi (Guru).
 *
 * Mengikuti pola src/features/admin/queries.ts dan
 * src/features/schedule/queries.ts: fungsi data async biasa (mudah
 * diuji) + hook TanStack Query sebagai pembungkus tipis.
 *
 * Pemisahan tanggung jawab:
 * - TULIS kehadiran hanya lewat RPC `record_attendance` (SECURITY
 *   DEFINER, satu-satunya jalur insert ke attendance_records — RLS
 *   sengaja tidak memberi insert policy). RPC ini otoritatif.
 * - BACA sesi hari ini via select biasa; RLS memfilter baris milik
 *   guru sendiri, jadi client tidak perlu (dan tidak boleh) memfilter
 *   teacher_id sendiri.
 * - `resolveScanResult`/`resolveFinalStatus` (src/domain/attendance.ts)
 *   dipakai komponen untuk UI segera (badge status, pratinjau hasil)
 *   — bukan untuk menulis.
 *
 * Semua pesan user dalam Bahasa Indonesia.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { resolveFinalStatus, resolveScanResult } from '@/domain/attendance';
import type { AttendanceStatus, SessionWindow } from '@/domain/types';
import { buildSessionWindow } from '@/domain/time';

// =====================================================================
// Domain: hasil scan + pesan Indonesia
// =====================================================================

/** Offset WIB (UTC+7) terhadap UTC, dalam menit. */
export const WIB_OFFSET_MINUTES = 420;

const RESULT_MESSAGES = {
  hadir: 'Kehadiran tercatat sebagai Hadir',
  terlambat: 'Kehadiran tercatat sebagai Terlambat',
} as const;

const REASON_MESSAGES = {
  too_early: 'Sesi belum dibuka. Coba lagi mendekati jam mulai.',
  expired: 'Sesi sudah berakhir',
  not_found: 'Token absen tidak ditemukan atau tidak valid',
  not_yours: 'Link ini bukan untuk jadwal mengajar kamu',
} as const;

/**
 * ScanResult + `message` (teks Indonesia siap tampil) dan `scannedAt`
 * (waktu client; hanya informatif — RPC tidak mengembalikan jam scan).
 */
export type RecordAttendanceResult =
  | { ok: true; status: 'hadir' | 'terlambat'; duplicate?: boolean; message: string; scannedAt: Date }
  | { ok: false; reason: 'too_early' | 'expired' | 'not_found' | 'not_yours'; message: string };

// =====================================================================
// Row types (mirror supabase/migrations/0001_schema.sql + join)
// =====================================================================

/** attendance_records milik guru pada sesi ini (paling banyak 1). */
export interface AttendanceRecordRow {
  status: AttendanceStatus;
  scanned_at: string; // ISO timestamptz
}

/** Row mentah hasil join PostgREST. */
interface SessionJoinRow {
  id: string;
  teacher_id: string;
  date: string;
  token: string;
  starts_at: string;
  ends_at: string;
  schedules: {
    start_time: string;
    end_time: string;
    subjects: { name: string } | null;
    classes: { name: string } | null;
  } | null;
  attendance_records: AttendanceRecordRow[] | null;
}

/** Sesi tampilan hari ini / halaman scan (sudah diratakan). */
export interface TodaySession {
  id: string;
  token: string;
  date: string; // YYYY-MM-DD (tanggal sekolah)
  startsAt: string; // ISO timestamptz
  endsAt: string;
  subjectName: string | null;
  className: string | null;
  startTime: string | null; // 'HH:MM:SS' jadwal
  endTime: string | null;
  record: { status: AttendanceStatus; scannedAt: string } | null;
}

// =====================================================================
// Helpers waktu WIB
// =====================================================================

/** Kunci tanggal kalender WIB (YYYY-MM-DD) dari sebuah instant. */
export function wibDateKey(now: Date): string {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format ISO timestamptz menjadi jam WIB 'HH:MM'. */
export function wibTime(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + WIB_OFFSET_MINUTES * 60_000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** SessionWindow UTC dari kolom sesi (starts_at/ends_at sudah timestamptz). */
export function toSessionWindow(s: { startsAt: string; endsAt: string }): SessionWindow {
  return { startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt) };
}

// =====================================================================
// Reads (RLS: guru hanya melihat sesi miliknya sendiri)
// =====================================================================

/** Kolom + join yang dipakai kedua query sesi. */
const SESSION_SELECT = [
  'id, teacher_id, date, token, starts_at, ends_at',
  'schedules ( start_time, end_time, subjects ( name ), classes ( name ) )',
  'attendance_records ( status, scanned_at )',
].join(', ');

/** Meratakan row join PostgREST menjadi TodaySession. */
function toSession(row: SessionJoinRow): TodaySession {
  return {
    id: row.id,
    token: row.token,
    date: row.date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    subjectName: row.schedules?.subjects?.name ?? null,
    className: row.schedules?.classes?.name ?? null,
    startTime: row.schedules?.start_time ?? null,
    endTime: row.schedules?.end_time ?? null,
    record: row.attendance_records?.[0]
      ? {
          status: row.attendance_records[0].status,
          scannedAt: row.attendance_records[0].scanned_at,
        }
      : null,
  };
}

/**
 * Sesi absen milik guru untuk tanggal (YYYY-MM-DD) tertentu.
 * Tanggal sesi = tanggal kalender sekolah (WIB). RLS memastikan hanya
 * sesi milik guru yang login yang terlihat — tidak perlu filter
 * teacher_id di client.
 */
export async function listTodaySessions(date: string): Promise<TodaySession[]> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(SESSION_SELECT)
    .eq('date', date)
    .order('starts_at');
  if (error) throw error;
  // `data` tidak punya tipe schema yang digenerate; cast manual.
  return ((data ?? []) as unknown as SessionJoinRow[]).map(toSession);
}

/**
 * Satu sesi berdasarkan token (halaman /absen/:token).
 * `PGRST116` (0 baris saat .single()) → null, bukan error.
 */
export async function getSessionByToken(token: string): Promise<TodaySession | null> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(SESSION_SELECT)
    .eq('token', token)
    .single();
  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  return toSession(data as unknown as SessionJoinRow);
}

// =====================================================================
// Write: RPC otoritatif
// =====================================================================

/**
 * Mencatat kehadiran guru lewat RPC `record_attendance(p_token)`.
 * Satu-satunya jalur tulis ke attendance_records (SECURITY DEFINER).
 * Guru tidak bisa absen dengan token milik guru lain → reason
 * 'not_yours'.
 *
 * RPC mengembalikan jsonb ScanResult; di sini hanya ditambah pesan
 * Indonesia untuk UI. Waktu scan yang ditampilkan client diambil dari
 * record setelah invalidasi query (kolom scanned_at).
 */
export async function recordAttendance(token: string): Promise<RecordAttendanceResult> {
  const { data, error } = await supabase.rpc('record_attendance', { p_token: token });
  if (error) throw error;
  if (!data) {
    // RPC selalu mengembalikan jsonb; null berarti sesuatu yang tak
    // terduga — perlakukan sebagai token tidak ditemukan.
    return { ok: false, reason: 'not_found', message: REASON_MESSAGES.not_found };
  }

  const result = data as
    | { ok: true; status: 'hadir' | 'terlambat'; duplicate?: boolean }
    | { ok: false; reason: 'too_early' | 'expired' | 'not_found' | 'not_yours' };

  if (result.ok) {
    if (result.duplicate) {
      return { ...result, message: 'Kamu sudah tercatat hadir', scannedAt: new Date() };
    }
    return {
      ...result,
      message: RESULT_MESSAGES[result.status],
      scannedAt: new Date(),
    };
  }

  return { ...result, message: REASON_MESSAGES[result.reason] };
}

// =====================================================================
// TanStack Query hooks (dipakai TodayPage / ScanPage)
// =====================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

export const queryKeys = {
  todaySessions: (date: string) => ['attendance-sessions', date] as const,
  sessionByToken: (token: string) => ['attendance-session', token] as const,
};

/** Sesi hari ini (tanggal WIB saat ini) milik guru yang login. */
export function useTodaySessions() {
  return useQuery({
    queryKey: queryKeys.todaySessions(wibDateKey(new Date())),
    queryFn: () => listTodaySessions(wibDateKey(new Date())),
  });
}

/** Detail sesi berdasarkan token dari URL /absen/:token. */
export function useSessionByToken(token: string) {
  return useQuery({
    queryKey: queryKeys.sessionByToken(token),
    queryFn: () => getSessionByToken(token),
    enabled: !!token,
  });
}

/**
 * Mutasi absen (RPC record_attendance) + invalidasi cache sesi supaya
 * status & waktu scan terbaru (scanned_at) ter-refresh setelah absen.
 * `onSuccess` komponen menampilkan hasil (status + jam scan).
 */
export function useRecordAttendance(
  token = '',
): UseMutationResult<RecordAttendanceResult, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: string) => recordAttendance(t),
    onSuccess: () => {
      const date = wibDateKey(new Date());
      qc.invalidateQueries({ queryKey: queryKeys.todaySessions(date) });
      qc.invalidateQueries({ queryKey: queryKeys.sessionByToken(token) });
    },
  });
}

// Re-export domain helpers supaya komponen tinggal import dari sini.
export { resolveScanResult, resolveFinalStatus, buildSessionWindow };
