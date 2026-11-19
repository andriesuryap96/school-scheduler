/**
 * Query & mutation data master (Super Admin).
 *
 * Fungsi data (`listX`/`createX`) adalah fungsi async biasa supaya mudah
 * diuji; hook TanStack Query di bawah membungkusnya untuk komponen.
 * `activateAcademicYear` dua langkah:
 * 1. `is_active = false` untuk semua tahun ajaran di sekolah terkait.
 * 2. `is_active = true` untuk tahun ajaran yang dipilih.
 *
 * Two-step ini TIDAK atomik di sisi client — bila langkah 2 gagal,
 * tidak ada tahun ajaran aktif; user dapat mencoba lagi (idempotent).
 */
import { useQuery } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/domain/types';

// =====================================================================
// Row types (mirror supabase/migrations/0001_schema.sql)
// =====================================================================

export interface School {
  id: string;
  name: string;
  address: string | null;
  timezone_offset_minutes: number;
}

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
}

export interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  level: number | null;
}

export interface UserRow {
  id: string;
  school_id: string;
  name: string;
  email: string;
  role: Role;
}

// =====================================================================
// Reads
// =====================================================================

export async function listSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, address, timezone_offset_minutes')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, school_id, name, start_date, end_date, is_active')
    .eq('school_id', schoolId)
    .order('start_date');
  if (error) throw error;
  return data ?? [];
}

export async function listSubjects(schoolId: string): Promise<Subject[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, school_id, name, code')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listClasses(schoolId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, school_id, name, level')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listUsers(schoolId: string): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, school_id, name, email, role')
    .eq('school_id', schoolId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// =====================================================================
// Mutations
// =====================================================================

export interface CreateSubjectInput {
  school_id: string;
  name: string;
  code?: string | null;
}

export async function createSubject(input: CreateSubjectInput): Promise<void> {
  const { error } = await supabase.from('subjects').insert({
    school_id: input.school_id,
    name: input.name,
    code: input.code ?? null,
  });
  if (error) throw error;
}

export interface CreateClassInput {
  school_id: string;
  name: string;
  level?: number | null;
}

export async function createClass(input: CreateClassInput): Promise<void> {
  const { error } = await supabase.from('classes').insert({
    school_id: input.school_id,
    name: input.name,
    level: input.level ?? null,
  });
  if (error) throw error;
}

export interface CreateAcademicYearInput {
  school_id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

export async function createAcademicYear(input: CreateAcademicYearInput): Promise<void> {
  const { error } = await supabase.from('academic_years').insert({
    school_id: input.school_id,
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    is_active: false, // aktifkan eksplisit lewat activateAcademicYear
  });
  if (error) throw error;
}

export async function activateAcademicYear(id: string): Promise<void> {
  // Langkah 0: ambil school_id tahun ajaran supaya hanya tahun ajaran
  // di sekolah itu yang dinonaktifkan (bukan lintas sekolah).
  const { data: year, error: fetchError } = await supabase
    .from('academic_years')
    .select('id, school_id')
    .eq('id', id)
    .single();
  if (fetchError) throw fetchError;
  if (!year) throw new Error(`Tahun ajaran ${id} tidak ditemukan`);

  // Langkah 1: nonaktifkan semua tahun ajaran di sekolah itu.
  const { error: deactivateError } = await supabase
    .from('academic_years')
    .update({ is_active: false })
    .eq('school_id', year.school_id);
  if (deactivateError) throw deactivateError;

  // Langkah 2: aktifkan tahun ajaran yang dipilih.
  const { error: activateError } = await supabase
    .from('academic_years')
    .update({ is_active: true })
    .eq('id', id);
  if (activateError) throw activateError;
}

/**
 * Membuat baris di tabel public.users. TIDAK membuat user auth —
 * pembuatan auth user harus lewat dashboard Supabase (Authentication →
 * Add user) karena butuh service_role, yang tidak boleh ada di browser.
 */
export interface CreateUserInput {
  id: string;         // auth.users id dari dashboard Supabase
  school_id: string;
  name: string;
  email: string;
  role: Role;
}

export async function createUser(input: CreateUserInput): Promise<void> {
  const { error } = await supabase.from('users').insert({
    id: input.id,
    school_id: input.school_id,
    name: input.name,
    email: input.email,
    role: input.role,
  });
  if (error) throw error;
}

// =====================================================================
// TanStack Query hooks (dipakai komponen AdminPage)
// =====================================================================

export const queryKeys = {
  schools: ['schools'] as const,
  academicYears: (schoolId: string) => ['academic-years', schoolId] as const,
  subjects: (schoolId: string) => ['subjects', schoolId] as const,
  classes: (schoolId: string) => ['classes', schoolId] as const,
  users: (schoolId: string) => ['users', schoolId] as const,
};

export function useSchools() {
  return useQuery({ queryKey: queryKeys.schools, queryFn: () => listSchools() });
}

export function useAcademicYears(schoolId: string) {
  return useQuery({
    queryKey: queryKeys.academicYears(schoolId),
    queryFn: () => listAcademicYears(schoolId),
    enabled: !!schoolId,
  });
}

export function useSubjects(schoolId: string) {
  return useQuery({
    queryKey: queryKeys.subjects(schoolId),
    queryFn: () => listSubjects(schoolId),
    enabled: !!schoolId,
  });
}

export function useClasses(schoolId: string) {
  return useQuery({
    queryKey: queryKeys.classes(schoolId),
    queryFn: () => listClasses(schoolId),
    enabled: !!schoolId,
  });
}

export function useUsers(schoolId: string) {
  return useQuery({
    queryKey: queryKeys.users(schoolId),
    queryFn: () => listUsers(schoolId),
    enabled: !!schoolId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: ReadonlyArray<string | readonly unknown[]>) => {
    keys.forEach((key) => qc.invalidateQueries({ queryKey: key as readonly unknown[] }));
  };
}

export function useCreateSubject(
  schoolId: string,
): UseMutationResult<void, Error, CreateSubjectInput> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createSubject,
    onSuccess: () => invalidate([queryKeys.subjects(schoolId)]),
  });
}

export function useCreateClass(
  schoolId: string,
): UseMutationResult<void, Error, CreateClassInput> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createClass,
    onSuccess: () => invalidate([queryKeys.classes(schoolId)]),
  });
}

export function useCreateAcademicYear(
  schoolId: string,
): UseMutationResult<void, Error, CreateAcademicYearInput> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => invalidate([queryKeys.academicYears(schoolId)]),
  });
}

export function useActivateAcademicYear(
  schoolId: string,
): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: activateAcademicYear,
    onSuccess: () => invalidate([queryKeys.academicYears(schoolId)]),
  });
}
