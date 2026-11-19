import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import {
  useSchools,
  useAcademicYears,
  useSubjects,
  useClasses,
  useUsers,
} from '@/features/admin/queries';

export interface SchedulePageData {
  loading: boolean;
  error: string | null;
  schoolId: string;
  activeYear: { id: string; name: string } | null;
  hasYears: boolean;
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}

/**
 * Gating data untuk SchedulePage/ExceptionPage: menentukan schoolId dan
 * tahun ajaran aktif, plus master data guru/kelas/mapel untuk dropdown.
 *
 * - superadmin: memakai sekolah pertama (sama seperti AdminPage).
 * - kepala_sekolah: school_id dari JWT app_metadata (satu sekolah per akun).
 */
export function useSchedulePageData(): SchedulePageData {
  const { role, user } = useAuth();
  const [schoolId, setSchoolId] = useState('');
  const [schoolIdError, setSchoolIdError] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'kepala_sekolah') {
      const sid = (user?.app_metadata as Record<string, unknown> | undefined)?.school_id;
      if (typeof sid === 'string' && sid) {
        setSchoolId(sid);
      } else {
        setSchoolIdError('school_id tidak ditemukan di profil akun.');
      }
    }
  }, [role, user]);

  const schoolsQ = useSchools();
  const yearsQ = useAcademicYears(schoolId);
  const subjectsQ = useSubjects(schoolId);
  const classesQ = useClasses(schoolId);
  const usersQ = useUsers(schoolId);

  // superadmin: satu sekolah aktif pada satu waktu (pola AdminPage).
  const resolvedSchoolId = role === 'kepala_sekolah' ? schoolId : schoolsQ.data?.[0]?.id ?? '';

  const masterPending =
    (role === 'kepala_sekolah' && !schoolId) ||
    (resolvedSchoolId && (yearsQ.isPending || subjectsQ.isPending || classesQ.isPending || usersQ.isPending));

  const masterError =
    schoolIdError ??
    (resolvedSchoolId &&
      (yearsQ.error?.message ?? subjectsQ.error?.message ?? classesQ.error?.message ?? usersQ.error?.message)) ??
    null;

  const activeYear = yearsQ.data?.find((y) => y.is_active) ?? null;

  return {
    loading: !!masterPending,
    error: masterError,
    schoolId: resolvedSchoolId,
    activeYear: activeYear ? { id: activeYear.id, name: activeYear.name } : null,
    hasYears: (yearsQ.data?.length ?? 0) > 0,
    teachers: usersQ.data
      ?.filter((u) => u.role === 'guru')
      .map((u) => ({ id: u.id, name: u.name })) ?? [],
    classes: classesQ.data?.map((c) => ({ id: c.id, name: c.name })) ?? [],
    subjects: subjectsQ.data?.map((s) => ({ id: s.id, name: s.name })) ?? [],
  };
}
