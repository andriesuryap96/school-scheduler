/**
 * Ekspor CSV laporan kehadiran bulanan (Task 13).
 *
 * Format sesuai task-13-brief:
 * - header: `Guru,Hadir,Terlambat,Tidak Hadir`
 * - field berisi koma dibungkus double-quoted
 * - tanda kutip ganda dalam field di-escape menjadi `""`
 */

/** Baris laporan per guru (agregasi bulanan). */
export interface ReportRow {
  teacher: string;
  hadir: number;
  terlambat: number;
  tidakHadir: number;
}

const HEADER = 'Guru,Hadir,Terlambat,Tidak Hadir';

/**
 * Escape satu field CSV (RFC 4180): bila field mengandung koma atau
 * tanda kutip ganda, bungkus dengan kutip dan gandakan setiap kutip.
 */
function escapeField(value: string): string {
  if (/[",]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Susun string CSV dari baris laporan; selalu diawali header. */
export function buildCsv(rows: ReportRow[]): string {
  const lines = [HEADER];
  for (const row of rows) {
    lines.push(
      [
        escapeField(row.teacher),
        String(row.hadir),
        String(row.terlambat),
        String(row.tidakHadir),
      ].join(','),
    );
  }
  return lines.join('\n');
}
