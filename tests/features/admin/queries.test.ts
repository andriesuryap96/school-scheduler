import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modul supabase: hanya `from` yang dipakai queries.ts.
const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from },
}));

import {
  createSubject,
  createClass,
  createAcademicYear,
  activateAcademicYear,
} from '@/features/admin/queries';

/**
 * Builder query Supabase palsu.
 * - `awaited`: hasil saat builder di-await langsung (insert / update().eq()).
 * - `single`: hasil .single() untuk select satu baris.
 */
function makeBuilder(opts: {
  awaited?: { error: unknown };
  single?: { data: unknown; error: unknown };
}) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  b.select = vi.fn(() => b);
  b.insert = vi.fn(() => Promise.resolve(opts.awaited ?? { error: null }));
  b.update = vi.fn(() => b);
  b.eq = vi.fn(() => (opts.awaited ? Promise.resolve(opts.awaited) : b));
  b.single = vi.fn(() => Promise.resolve(opts.single ?? { data: null, error: null }));
  return b as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSubject', () => {
  it('memanggil supabase.from("subjects").insert dengan payload benar', async () => {
    const b = makeBuilder({ awaited: { error: null } });
    from.mockReturnValue(b);

    await createSubject({ school_id: 'sch-1', name: 'Matematika', code: 'MTK' });

    expect(from).toHaveBeenCalledWith('subjects');
    expect(b.insert).toHaveBeenCalledTimes(1);
    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      name: 'Matematika',
      code: 'MTK',
    });
  });

  it('mengirim code null bila code tidak diisi', async () => {
    const b = makeBuilder({ awaited: { error: null } });
    from.mockReturnValue(b);

    await createSubject({ school_id: 'sch-1', name: 'Fisika' });

    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      name: 'Fisika',
      code: null,
    });
  });

  it('melempar error bila insert gagal', async () => {
    const b = makeBuilder({ awaited: { error: new Error('insert gagal') } });
    from.mockReturnValue(b);

    await expect(
      createSubject({ school_id: 'sch-1', name: 'Matematika', code: 'MTK' }),
    ).rejects.toThrow('insert gagal');
  });
});

describe('createClass', () => {
  it('memanggil supabase.from("classes").insert dengan payload benar', async () => {
    const b = makeBuilder({ awaited: { error: null } });
    from.mockReturnValue(b);

    await createClass({ school_id: 'sch-1', name: 'X IPA 1', level: 10 });

    expect(from).toHaveBeenCalledWith('classes');
    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      name: 'X IPA 1',
      level: 10,
    });
  });

  it('melempar error bila insert gagal', async () => {
    const b = makeBuilder({ awaited: { error: new Error('duplicate key') } });
    from.mockReturnValue(b);

    await expect(
      createClass({ school_id: 'sch-1', name: 'X IPA 1' }),
    ).rejects.toThrow('duplicate key');
  });
});

describe('createAcademicYear', () => {
  it('memanggil supabase.from("academic_years").insert dengan payload benar', async () => {
    const b = makeBuilder({ awaited: { error: null } });
    from.mockReturnValue(b);

    await createAcademicYear({
      school_id: 'sch-1',
      name: '2025/2026',
      start_date: '2025-07-14',
      end_date: '2026-06-13',
    });

    expect(from).toHaveBeenCalledWith('academic_years');
    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      name: '2025/2026',
      start_date: '2025-07-14',
      end_date: '2026-06-13',
      is_active: false,
    });
  });
});

describe('activateAcademicYear', () => {
  it('dua langkah: nonaktifkan semua tahun di sekolah, lalu aktifkan id', async () => {
    const fetchB = makeBuilder({
      single: { data: { id: 'year-1', school_id: 'sch-1' }, error: null },
    });
    const deactivateB = makeBuilder({ awaited: { error: null } });
    const activateB = makeBuilder({ awaited: { error: null } });
    from
      .mockReturnValueOnce(fetchB)
      .mockReturnValueOnce(deactivateB)
      .mockReturnValueOnce(activateB);

    await activateAcademicYear('year-1');

    // langkah 0: ambil school_id tahun ajaran
    expect(fetchB.eq).toHaveBeenCalledWith('id', 'year-1');
    // langkah 1: is_active = false untuk semua tahun di sekolah itu
    expect(deactivateB.update).toHaveBeenCalledWith({ is_active: false });
    expect(deactivateB.eq).toHaveBeenCalledWith('school_id', 'sch-1');
    // langkah 2: is_active = true untuk id
    expect(activateB.update).toHaveBeenCalledWith({ is_active: true });
    expect(activateB.eq).toHaveBeenCalledWith('id', 'year-1');
  });

  it('melempar error bila langkah nonaktifasi gagal', async () => {
    const fetchB = makeBuilder({
      single: { data: { id: 'year-1', school_id: 'sch-1' }, error: null },
    });
    const deactivateB = makeBuilder({ awaited: { error: new Error('rls denied') } });
    from.mockReturnValueOnce(fetchB).mockReturnValueOnce(deactivateB);

    await expect(activateAcademicYear('year-1')).rejects.toThrow('rls denied');
  });

  it('melempar error bila tahun ajaran tidak ditemukan', async () => {
    const fetchB = makeBuilder({
      single: { data: null, error: new Error('not found') },
    });
    from.mockReturnValue(fetchB);

    await expect(activateAcademicYear('missing')).rejects.toThrow('not found');
  });
});
