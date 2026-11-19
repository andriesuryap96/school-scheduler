import type { ExceptionType } from '@/domain/types';

// Input untuk shouldGenerateSession — logika pemilihan jadwal yang sama
// dengan generate_sessions_for_date() di supabase/migrations/0004_generate_sessions.sql.
export interface ScheduleCandidate {
  id?: string;
  day_of_week: number;
  is_active: boolean;
}

export interface ScheduleException {
  date: string;          // 'YYYY-MM-DD'
  type: ExceptionType;
  affects_all: boolean;
  schedule_id: string | null;
}

export interface ShouldGenerateSessionInput {
  schedule: ScheduleCandidate;
  date: string;          // 'YYYY-MM-DD'
  dayOfWeek: number;     // 0=Minggu..6=Sabtu (extract(dow from date))
  exceptions: ScheduleException[];
}

/**
 * Menentukan apakah sebuah jadwal harus menghasilkan sesi absen pada
 * tanggal tertentu. Harus memilih jadwal yang sama dengan fungsi SQL
 * generate_sessions_for_date:
 *   - jadwal aktif,
 *   - day_of_week cocok dengan hari tanggal,
 *   - tidak ada pengecualian pada tanggal itu yang affects_all
 *     atau menunjuk jadwal ini.
 */
export function shouldGenerateSession({
  schedule,
  date,
  dayOfWeek,
  exceptions,
}: ShouldGenerateSessionInput): boolean {
  if (!schedule.is_active) return false;
  if (schedule.day_of_week !== dayOfWeek) return false;

  return !exceptions.some(
    (e) =>
      e.date === date &&
      (e.affects_all || (schedule.id != null && e.schedule_id === schedule.id)),
  );
}
