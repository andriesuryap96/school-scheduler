/**
 * Query & mutation jadwal + pengecualian (Kepala Sekolah).
 *
 * Mengikuti pola src/features/admin/queries.ts: fungsi data async biasa
 * (mudah diuji) + hook TanStack Query sebagai pembungkus tipis.
 *
 * Pemetaan error Postgres ke pesan Indonesia:
 * - `23514` (check constraint `end_time > start_time` dilanggar) →
 *   "Jam selesai harus setelah jam mulai".
 */
import { useQuery } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// =====================================================================
// Row types (mirror supabase/migrations/0001_schema.sql)
// =====================================================================

export interface ScheduleRow {
  id: string;
  school_id: string;
  academic_year_id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  day_of_week: number; // 0=Minggu .. 6=Sabtu
  start_time: string;  // 'HH:MM:SS'
  end_time: string;
  is_active: boolean;
}

export interface ExceptionType {
  value: 'libur_nasional' | 'ulangan_umum' | 'event';
  label: string;
}

/** Opsi tipe pengecualian — dipakai dropdown form. */
export const EXCEPTION_TYPES: ExceptionType[] = [
  { value: 'libur_nasional', label: 'Libur Nasional' },
  { value: 'ulangan_umum', label: 'Ulangan Umum' },
  { value: 'event', label: 'Event' },
];

export interface ExceptionRow {
  id: string;
  school_id: string;
  date: string; // YYYY-MM-DD
  type: 'libur_nasional' | 'ulangan_umum' | 'event';
  description: string | null;
  affects_all: boolean;
  schedule_id: string | null;
}

/** Nama hari sesuai day_of_week (0=Minggu) — konsisten dengan skema DB. */
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** Urutan tampil Senin–Minggu (day_of_week 1..6, 0). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// =====================================================================
// Error mapping (Postgres code → pesan Indonesia)
// =====================================================================

const PG_ERROR_MESSAGES: Record<string, string> = {
  23514: 'Jam selesai harus setelah jam mulai',
};

/**
 * Ubah error Supabase/Postgres jadi pesan yang bisa dibaca user.
 * Error tanpa code yang dikenal diteruskan apa adanya.
 */
function toUserMessage(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code;
  if (code && PG_ERROR_MESSAGES[code]) {
    return new Error(PG_ERROR_MESSAGES[code]);
  }
  // Error Supabase bisa berupa objek polos (bukan instance Error);
  // pakai properti message bila ada supaya teksnya terbaca.
  const message = (error as { message?: string } | null)?.message;
  if (message) return new Error(message);
  return new Error(String(error));
}

// =====================================================================
// Reads
// =====================================================================

export async function listSchedules(academicYearId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select(
      'id, school_id, academic_year_id, teacher_id, class_id, subject_id, day_of_week, start_time, end_time, is_active',
    )
    .eq('academic_year_id', academicYearId)
    .order('day_of_week')
    .order('start_time');
  if (error) throw error;
  return data ?? [];
}

export async function listExceptions(schoolId: string): Promise<ExceptionRow[]> {
  const { data, error } = await supabase
    .from('schedule_exceptions')
    .select('id, school_id, date, type, description, affects_all, schedule_id')
    .eq('school_id', schoolId)
    .order('date');
  if (error) throw error;
  return data ?? [];
}

// =====================================================================
// Mutations
// =====================================================================

export interface ScheduleInput {
  /** Wajib: schedules.school_id NOT NULL tanpa default di skema. */
  school_id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string; // 'HH:MM'
  end_time: string;   // 'HH:MM'
  academic_year_id: string;
}

export async function createSchedule(input: ScheduleInput): Promise<void> {
  const { error } = await supabase.from('schedules').insert({
    school_id: input.school_id,
    teacher_id: input.teacher_id,
    class_id: input.class_id,
    subject_id: input.subject_id,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    academic_year_id: input.academic_year_id,
  });
  if (error) throw toUserMessage(error);
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({
      school_id: input.school_id,
      teacher_id: input.teacher_id,
      class_id: input.class_id,
      subject_id: input.subject_id,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      academic_year_id: input.academic_year_id,
    })
    .eq('id', id);
  if (error) throw toUserMessage(error);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw toUserMessage(error);
}

export interface ExceptionInput {
  school_id: string;
  date: string; // YYYY-MM-DD
  type: 'libur_nasional' | 'ulangan_umum' | 'event';
  description?: string | null;
  /** true → berlaku semua jadwal (schedule_id null); false → satu jadwal. */
  affects_all: boolean;
  /** Wajib diisi bila affects_all false (skema: affects_all or schedule_id is not null). */
  schedule_id: string | null;
}

export async function createException(input: ExceptionInput): Promise<void> {
  const { error } = await supabase.from('schedule_exceptions').insert({
    school_id: input.school_id,
    date: input.date,
    type: input.type,
    description: input.description ?? null,
    affects_all: input.affects_all,
    schedule_id: input.affects_all ? null : input.schedule_id,
  });
  if (error) throw toUserMessage(error);
}

export async function deleteException(id: string): Promise<void> {
  const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id);
  if (error) throw toUserMessage(error);
}

// =====================================================================
// TanStack Query hooks (dipakai komponen SchedulePage / ExceptionPage)
// =====================================================================

export const queryKeys = {
  schedules: (academicYearId: string) => ['schedules', academicYearId] as const,
  exceptions: (schoolId: string) => ['schedule-exceptions', schoolId] as const,
};

export function useSchedules(academicYearId: string) {
  return useQuery({
    queryKey: queryKeys.schedules(academicYearId),
    queryFn: () => listSchedules(academicYearId),
    enabled: !!academicYearId,
  });
}

export function useExceptions(schoolId: string) {
  return useQuery({
    queryKey: queryKeys.exceptions(schoolId),
    queryFn: () => listExceptions(schoolId),
    enabled: !!schoolId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: ReadonlyArray<string | readonly unknown[]>) => {
    keys.forEach((key) => qc.invalidateQueries({ queryKey: key as readonly unknown[] }));
  };
}

export function useCreateSchedule(
  academicYearId: string,
): UseMutationResult<void, Error, ScheduleInput> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => invalidate([queryKeys.schedules(academicYearId)]),
  });
}

export function useUpdateSchedule(
  academicYearId: string,
): UseMutationResult<void, Error, { id: string; input: ScheduleInput }> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }) => updateSchedule(id, input),
    onSuccess: () => invalidate([queryKeys.schedules(academicYearId)]),
  });
}

export function useDeleteSchedule(
  academicYearId: string,
): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => invalidate([queryKeys.schedules(academicYearId)]),
  });
}

export function useCreateException(
  schoolId: string,
): UseMutationResult<void, Error, ExceptionInput> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createException,
    onSuccess: () => invalidate([queryKeys.exceptions(schoolId)]),
  });
}

export function useDeleteException(
  schoolId: string,
): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: deleteException,
    onSuccess: () => invalidate([queryKeys.exceptions(schoolId)]),
  });
}
