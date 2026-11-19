import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modul supabase: hanya `from` yang dipakai queries.ts laporan.
const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from },
}));

import { getMonthlyReport } from '@/features/reports/queries';

/** Waktu tetap untuk test deterministik (setelah semua sesi fixture berakhir). */
const NOW = new Date('2026-11-19T00:00:00Z');

/**
 * Builder query Supabase palsu (mengikuti pola tests/features/admin/queries.test.ts).
 * - `awaited`: hasil saat builder di-await langsung (select berantai .gte/.lt/.order).
 */
function makeBuilder(opts: { awaited?: { data?: unknown; error: unknown } } = {}) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.gte = vi.fn(() => b);
  b.lt = vi.fn(() => b);
  b.order = vi.fn(() =>
    Promise.resolve(opts.awaited ?? { data: [], error: null }),
  );
  return b as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

/** Row join palsu hasil PostgREST untuk satu sesi. */
function sessionRow(over: Record<string, unknown> = {}) {
  return {
    id: 'sesi-1',
    teacher_id: 'guru-1',
    date: '2026-11-02',
    starts_at: '2026-11-02T01:00:00.000Z', // 08:00 WIB
    ends_at: '2026-11-02T02:30:00.000Z',
    users: { name: 'Budi Santoso' },
    schedules: { subjects: { name: 'Matematika' } },
    attendance_records: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMonthlyReport', () => {
  it('memfilter sesi dengan rentang tanggal bulan (gte awal, lt awal bulan berikutnya)', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await getMonthlyReport('2026-11', NOW);

    expect(from).toHaveBeenCalledWith('attendance_sessions');
    expect(b.gte).toHaveBeenCalledWith('date', '2026-11-01');
    expect(b.lt).toHaveBeenCalledWith('date', '2026-12-01');
  });

  it('melempar error bila query supabase gagal', async () => {
    from.mockReturnValue(makeBuilder({ awaited: { error: new Error('rls denied') } }));

    await expect(getMonthlyReport('2026-11', NOW)).rejects.toThrow('rls denied');
  });

  it('mengembalikan array kosong bila tidak ada sesi', async () => {
    from.mockReturnValue(makeBuilder({ awaited: { data: [], error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    expect(rows).toEqual([]);
  });

  it('mengagregasi per guru: record hadir, terlambat, dan tanpa record menjadi tidak hadir', async () => {
    const data = [
      sessionRow({ id: 's1', attendance_records: [{ status: 'hadir', scanned_at: 'x' }] }),
      sessionRow({ id: 's2', attendance_records: [{ status: 'terlambat', scanned_at: 'x' }] }),
      sessionRow({ id: 's3', attendance_records: null }), // sesi lewat tanpa record
    ];
    from.mockReturnValue(makeBuilder({ awaited: { data, error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      teacher: 'Budi Santoso',
      hadir: 1,
      terlambat: 1,
      tidakHadir: 1,
    });
  });

  it('memisahkan agregasi per guru (join users untuk nama)', async () => {
    const data = [
      sessionRow({ id: 's1', attendance_records: [{ status: 'hadir', scanned_at: 'x' }] }),
      sessionRow({
        id: 's2',
        teacher_id: 'guru-2',
        users: { name: 'Ani Wijaya' },
        attendance_records: null,
      }),
    ];
    from.mockReturnValue(makeBuilder({ awaited: { data, error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({
      teacher: 'Budi Santoso',
      hadir: 1,
      terlambat: 0,
      tidakHadir: 0,
    });
    expect(rows).toContainEqual({
      teacher: 'Ani Wijaya',
      hadir: 0,
      terlambat: 0,
      tidakHadir: 1,
    });
  });

  it('mengurutkan hasil berdasarkan nama guru', async () => {
    const data = [
      sessionRow({ id: 's1', users: { name: 'Zaki' } }),
      sessionRow({ id: 's2', teacher_id: 'guru-2', users: { name: 'Ani' } }),
    ];
    from.mockReturnValue(makeBuilder({ awaited: { data, error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    expect(rows.map((r) => r.teacher)).toEqual(['Ani', 'Zaki']);
  });

  it('nama guru null pada data join → fallback teacher_id', async () => {
    const data = [sessionRow({ id: 's1', users: null })];
    from.mockReturnValue(makeBuilder({ awaited: { data, error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    expect(rows[0].teacher).toBe('guru-1');
  });

  it('sesi masa depan tanpa record TIDAK dihitung tidak hadir', async () => {
    const data = [
      // sesi berikutnya belum selesai saat NOW
      sessionRow({
        id: 's1',
        date: '2026-11-20',
        starts_at: '2026-11-20T01:00:00.000Z',
        ends_at: '2026-11-20T02:30:00.000Z',
        attendance_records: null,
      }),
    ];
    from.mockReturnValue(makeBuilder({ awaited: { data, error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    // sesi belum lewat → tidak masuk hitungan apa pun
    expect(rows).toEqual([]);
  });

  it('record hadir pada sesi masa depan tetap dihitung (status otoritatif dari record)', async () => {
    const data = [
      sessionRow({
        id: 's1',
        date: '2026-11-20',
        starts_at: '2026-11-20T01:00:00.000Z',
        ends_at: '2026-11-20T02:30:00.000Z',
        attendance_records: [{ status: 'hadir', scanned_at: 'x' }],
      }),
    ];
    from.mockReturnValue(makeBuilder({ awaited: { data, error: null } }));

    const rows = await getMonthlyReport('2026-11', NOW);

    expect(rows).toEqual([
      { teacher: 'Budi Santoso', hadir: 1, terlambat: 0, tidakHadir: 0 },
    ]);
  });
});
