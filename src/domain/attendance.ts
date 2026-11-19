import type { SessionWindow, AttendancePolicy, ScanResult } from '@/domain/types';

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
