import type { SessionWindow, AttendancePolicy, ScanResult, AttendanceStatus } from '@/domain/types';

/**
 * Menentukan hasil scan guru terhadap jendela sesi dan kebijakan sekolah.
 *
 * Batas buka = startsAt - earlyOpenMinutes; scan sebelum batas buka → too_early.
 * Scan setelah endsAt → expired. Scan tepat di endsAt masih diterima.
 * Batas terlambat = startsAt + lateThresholdMinutes; scan pada atau sebelum
 * batas terlambat → hadir, selain itu terlambat.
 */
export function resolveScanResult(
  scannedAt: Date,
  window: SessionWindow,
  policy: AttendancePolicy,
): ScanResult {
  const t = scannedAt.getTime();

  const batasBuka = window.startsAt.getTime() - policy.earlyOpenMinutes * 60_000;
  if (t < batasBuka) {
    return { ok: false, reason: 'too_early' };
  }

  if (t > window.endsAt.getTime()) {
    return { ok: false, reason: 'expired' };
  }

  const batasTerlambat = window.startsAt.getTime() + policy.lateThresholdMinutes * 60_000;
  if (t <= batasTerlambat) {
    return { ok: true, status: 'hadir' };
  }

  return { ok: true, status: 'terlambat' };
}

/**
 * Menentukan status akhir guru untuk keperluan laporan.
 *
 * Bila record tidak null (guru sudah absen) → kembalikan status record.
 * Selain itu → 'tidak_hadir' (dihitung saat laporan; sesi yang belum lewat
 * pun belum punya record, dan laporan hanya menampilkan sesi yang sudah lewat).
 */
export function resolveFinalStatus(
  record: { status: AttendanceStatus } | null,
  _window: SessionWindow,
  _now: Date,
): AttendanceStatus {
  if (record !== null) {
    return record.status;
  }
  return 'tidak_hadir';
}
