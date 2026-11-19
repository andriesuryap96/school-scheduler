export type Role = 'superadmin' | 'kepala_sekolah' | 'guru';
export type AttendanceStatus = 'hadir' | 'terlambat' | 'tidak_hadir';
export type ExceptionType = 'libur_nasional' | 'ulangan_umum' | 'event';

export interface SessionWindow {
  startsAt: Date;  // UTC instant kelas dimulai
  endsAt: Date;    // UTC instant kelas selesai
}

export interface AttendancePolicy {
  earlyOpenMinutes: number;      // 15
  lateThresholdMinutes: number;  // 15
}

export type ScanResult =
  | { ok: true; status: 'hadir' | 'terlambat'; duplicate?: boolean }
  | { ok: false; reason: 'too_early' | 'expired' | 'not_found' | 'not_yours' };
