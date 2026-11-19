import { describe, it, expect } from 'vitest';

import { buildCsv, type ReportRow } from '@/features/reports/csv';

/**
 * Test buildCsv sesuai task-13-brief:
 * - header 'Guru,Hadir,Terlambat,Tidak Hadir'
 * - field berisi koma dibungkus double-quoted
 * - tanda kutip di dalam field di-escape menjadi ""
 */
describe('buildCsv', () => {
  it('menghasilkan header dan baris CSV dengan escaping koma', () => {
    const csv = buildCsv([{ teacher: 'Budi, S.Pd', hadir: 10, terlambat: 1, tidakHadir: 2 }]);
    expect(csv.split('\n')[0]).toBe('Guru,Hadir,Terlambat,Tidak Hadir');
    expect(csv.split('\n')[1]).toBe('"Budi, S.Pd",10,1,2');
  });

  it('header saja bila rows kosong', () => {
    const csv = buildCsv([]);
    expect(csv).toBe('Guru,Hadir,Terlambat,Tidak Hadir');
  });

  it('field tanpa koma / kutip tidak dibungkus kutip', () => {
    const csv = buildCsv([{ teacher: 'Ani', hadir: 5, terlambat: 0, tidakHadir: 0 }]);
    expect(csv.split('\n')[1]).toBe('Ani,5,0,0');
  });

  it('escape tanda kutip ganda dalam field menjadi ""', () => {
    const csv = buildCsv([{ teacher: 'Joko "Jokowi" W.', hadir: 3, terlambat: 2, tidakHadir: 1 }]);
    expect(csv.split('\n')[1]).toBe('"Joko ""Jokowi"" W.",3,2,1');
  });

  it('koma dan tanda kutip di-escape bersamaan', () => {
    const csv = buildCsv([
      { teacher: 'Dewi "D", M.Pd', hadir: 8, terlambat: 4, tidakHadir: 2 },
    ]);
    expect(csv.split('\n')[1]).toBe('"Dewi ""D"", M.Pd",8,4,2');
  });

  it('angka 0 tetap ditampilkan, bukan string kosong', () => {
    const csv = buildCsv([{ teacher: 'Eka', hadir: 0, terlambat: 0, tidakHadir: 7 }]);
    expect(csv.split('\n')[1]).toBe('Eka,0,0,7');
  });

  it('beberapa baris mengikuti urutan input', () => {
    const rows: ReportRow[] = [
      { teacher: 'Budi', hadir: 1, terlambat: 2, tidakHadir: 3 },
      { teacher: 'Ani', hadir: 4, terlambat: 5, tidakHadir: 6 },
    ];
    const lines = buildCsv(rows).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Budi,1,2,3');
    expect(lines[2]).toBe('Ani,4,5,6');
  });
});
