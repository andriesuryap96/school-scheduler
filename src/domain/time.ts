import type { SessionWindow } from '@/domain/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/**
 * Membangun SessionWindow (UTC instant) dari jam lokal sekolah.
 *
 * date: tanggal kalender lokal sekolah, format YYYY-MM-DD.
 * startTime/endTime: jam lokal sekolah, format HH:MM.
 * utcOffsetMinutes: offset zona waktu sekolah terhadap UTC dalam menit
 *   (mis. WIB = UTC+7 = 420; EST = UTC-5 = -300).
 *
 * Jam endTime < startTime dianggap sesi melewati tengah malam (+24 jam).
 */
export function buildSessionWindow(
  date: string,
  startTime: string,
  endTime: string,
  utcOffsetMinutes: number,
): SessionWindow {
  if (!DATE_RE.test(date)) {
    throw new Error('Format tanggal harus YYYY-MM-DD');
  }

  const [y, m, d] = date.split('-').map(Number);

  const parseTime = (t: string): { hh: number; mm: number } => {
    const match = TIME_RE.exec(t);
    if (!match) {
      throw new Error(`Format jam harus HH:MM: ${t}`);
    }
    return { hh: Number(match[1]), mm: Number(match[2]) };
  };

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  // Jam lokal diinterpretasikan sebagai UTC dulu, lalu digeser oleh offset.
  const startUtc = Date.UTC(y, m - 1, d, start.hh, start.mm) - utcOffsetMinutes * 60_000;

  let endUtc = Date.UTC(y, m - 1, d, end.hh, end.mm) - utcOffsetMinutes * 60_000;
  if (endUtc < startUtc) {
    // Sesi melewati tengah malam: tambahkan 24 jam.
    endUtc += 24 * 60 * 60_000;
  }

  return { startsAt: new Date(startUtc), endsAt: new Date(endUtc) };
}
