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
 * - kepala_sekolah: school_id dari JWT app_metadata (satu sekolah per akun).
 * - superadmin: sekolah pertama dari useSchools (satu sekolah aktif pada
 *   satu waktu — konvensi AdminPage).
 *
 * SEMUA hook master data (tahun ajaran/mapel/kelas/guru) dipanggil dengan
 * id sekolah hasil resolusi di atas, jadi fallback superadmin benar-benar
 * berfungsi — bukan hanya mengisi `schoolId`.
 */
export function useSchedulePageData(): SchedulePageData {
  const { role, user } = useAuth();
  const [metadataSchoolId, setMetadataSchoolId] = useState('');
  const [metadataError, setMetadataError] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'kepala_sekolah') {
      const sid = (user?.app_metadata as Record<string, unknown> | undefined)?.school_id;
      if (typeof sid === 'string' && sid) {
        setMetadataSchoolId(sid);
      } else {
        setMetadataError('school_id tidak ditemukan di profil akun.');
      }
    }
  }, [role, user]);

  // superadmin: daftar sekolah untuk fallback "sekolah pertama".
  const schoolsQ = useSchools();

  // Resolve SEKALI, lalu pakai id hasil resolusi untuk semua hook master
  // data. Hooks selalu dipanggil (aturan React); `enabled: !!schoolId`
  // pada useAcademicYears/useSubjects/useClasses/useUsers menahan query
  // saat id masih kosong.
  const schoolId =
    role === 'kepala_sekolah'
      ? metadataSchoolId
      : (schoolsQ.data?.[0]?.id ?? '');

  const yearsQ = useAcademicYears(schoolId);
  const subjectsQ = useSubjects(schoolId);
  const classesQ = useClasses(schoolId);
  const usersQ = useUsers(schoolId);

  const masterPending =
    !schoolId ||
    yearsQ.isPending ||
    subjectsQ.isPending ||
    classesQ.isPending ||
    usersQ.isPending;

  const masterError =
    metadataError ??
    (role === 'superadmin' ? schoolsQ.error?.message : null) ??
    (schoolId &&
      (yearsQ.error?.message ??
        subjectsQ.error?.message ??
        classesQ.error?.message ??
        usersQ.error?.message)) ??
    null;

  const activeYear = yearsQ.data?.find((y) => y.is_active) ?? null;

  return {
    loading: !!masterPending,
    error: masterError,
    schoolId,
    activeYear: activeYear ? { id: activeYear.id, name: activeYear.name } : null,
    hasYears: (yearsQ.data?.length ?? 0) > 0,
    teachers: usersQ.data
      ?.filter((u) => u.role === 'guru')
      .map((u) => ({ id: u.id, name: u.name })) ?? [],
    classes: classesQ.data?.map((c) => ({ id: c.id, name: c.name })) ?? [],
    subjects: subjectsQ.data?.map((s) => ({ id: s.id, name: s.name })) ?? [],
  };
}
