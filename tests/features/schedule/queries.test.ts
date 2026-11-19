import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modul supabase: hanya `from` yang dipakai queries.ts.
const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from },
}));

import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createException,
  deleteException,
} from '@/features/schedule/queries';

// Payload jadwal standar untuk semua test — school_id wajib dikirim
// karena skema: schedules.school_id uuid NOT NULL tanpa default.
const SCHEDULE_INPUT = {
  school_id: 'sch-1',
  teacher_id: 'guru-1',
  class_id: 'kelas-1',
  subject_id: 'mapel-1',
  day_of_week: 1,
  start_time: '08:00',
  end_time: '09:30',
  academic_year_id: 'tahun-1',
};

/**
 * Builder query Supabase palsu (mengikuti pola tests/features/admin/queries.test.ts).
 * - `awaited`: hasil saat builder di-awaited langsung (insert / update().eq() / delete().eq()).
 */
function makeBuilder(opts: { awaited?: { error: unknown } } = {}) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  b.select = vi.fn(() => b);
  b.insert = vi.fn(() => Promise.resolve(opts.awaited ?? { error: null }));
  b.update = vi.fn(() => b);
  b.delete = vi.fn(() => b);
  b.eq = vi.fn(() => (opts.awaited ? Promise.resolve(opts.awaited) : b));
  b.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return b as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSchedule', () => {
  it('memanggil supabase.from("schedules").insert dengan payload benar', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await createSchedule(SCHEDULE_INPUT);

    expect(from).toHaveBeenCalledWith('schedules');
    expect(b.insert).toHaveBeenCalledTimes(1);
    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      teacher_id: 'guru-1',
      class_id: 'kelas-1',
      subject_id: 'mapel-1',
      day_of_week: 1,
      start_time: '08:00',
      end_time: '09:30',
      academic_year_id: 'tahun-1',
    });
  });

  it('mengirim school_id di payload (kolom NOT NULL tanpa default)', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await createSchedule(SCHEDULE_INPUT);

    expect(b.insert).toHaveBeenCalledWith(
      expect.objectContaining({ school_id: 'sch-1' }),
    );
  });

  it('melempar pesan Indonesia bila constraint 23514 (end_time <= start_time)', async () => {
    const b = makeBuilder({
      awaited: { error: { code: '23514', message: 'check constraint violated' } },
    });
    from.mockReturnValue(b);

    await expect(
      createSchedule({ ...SCHEDULE_INPUT, start_time: '10:00', end_time: '08:00' }),
    ).rejects.toThrow('Jam selesai harus setelah jam mulai');
  });

  it('melempar error apa adanya bila kode error tidak dikenal', async () => {
    const b = makeBuilder({
      awaited: { error: { code: '23503', message: 'foreign key violation' } },
    });
    from.mockReturnValue(b);

    await expect(createSchedule(SCHEDULE_INPUT)).rejects.toThrow(
      'foreign key violation',
    );
  });
});

describe('updateSchedule', () => {
  it('memanggil supabase.from("schedules").update().eq("id", id) dengan payload benar', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await updateSchedule('jadwal-1', {
      ...SCHEDULE_INPUT,
      teacher_id: 'guru-2',
      subject_id: 'mapel-2',
      day_of_week: 2,
      start_time: '07:00',
      end_time: '08:30',
    });

    expect(from).toHaveBeenCalledWith('schedules');
    expect(b.update).toHaveBeenCalledWith({
      school_id: 'sch-1',
      teacher_id: 'guru-2',
      class_id: 'kelas-1',
      subject_id: 'mapel-2',
      day_of_week: 2,
      start_time: '07:00',
      end_time: '08:30',
      academic_year_id: 'tahun-1',
    });
    expect(b.eq).toHaveBeenCalledWith('id', 'jadwal-1');
  });

  it('melempar pesan Indonesia bila constraint 23514 dilanggar saat update', async () => {
    const b = makeBuilder({
      awaited: { error: { code: '23514', message: 'check constraint violated' } },
    });
    from.mockReturnValue(b);

    await expect(
      updateSchedule('jadwal-1', { ...SCHEDULE_INPUT, start_time: '09:00', end_time: '08:00' }),
    ).rejects.toThrow('Jam selesai harus setelah jam mulai');
  });
});

describe('deleteSchedule', () => {
  it('memanggil supabase.from("schedules").delete().eq("id", id)', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await deleteSchedule('jadwal-1');

    expect(from).toHaveBeenCalledWith('schedules');
    expect(b.delete).toHaveBeenCalledTimes(1);
    expect(b.eq).toHaveBeenCalledWith('id', 'jadwal-1');
  });

  it('melempar error bila delete gagal', async () => {
    const b = makeBuilder({ awaited: { error: new Error('rls denied') } });
    from.mockReturnValue(b);

    await expect(deleteSchedule('jadwal-1')).rejects.toThrow('rls denied');
  });
});

describe('createException', () => {
  it('mengirim schedule_id null saat affects_all: true', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await createException({
      school_id: 'sch-1',
      date: '2026-12-25',
      type: 'libur_nasional',
      description: 'Hari Raya Natal',
      affects_all: true,
      schedule_id: null,
    });

    expect(from).toHaveBeenCalledWith('schedule_exceptions');
    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      date: '2026-12-25',
      type: 'libur_nasional',
      description: 'Hari Raya Natal',
      affects_all: true,
      schedule_id: null,
    });
  });

  it('mengirim schedule_id terpilih saat affects_all: false', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await createException({
      school_id: 'sch-1',
      date: '2026-11-20',
      type: 'ulangan_umum',
      description: 'Ujian Matematika',
      affects_all: false,
      schedule_id: 'jadwal-1',
    });

    expect(b.insert).toHaveBeenCalledWith({
      school_id: 'sch-1',
      date: '2026-11-20',
      type: 'ulangan_umum',
      description: 'Ujian Matematika',
      affects_all: false,
      schedule_id: 'jadwal-1',
    });
  });

  it('melempar error bila insert gagal', async () => {
    const b = makeBuilder({ awaited: { error: new Error('insert gagal') } });
    from.mockReturnValue(b);

    await expect(
      createException({
        school_id: 'sch-1',
        date: '2026-12-25',
        type: 'event',
        description: null,
        affects_all: true,
        schedule_id: null,
      }),
    ).rejects.toThrow('insert gagal');
  });
});

describe('deleteException', () => {
  it('memanggil supabase.from("schedule_exceptions").delete().eq("id", id)', async () => {
    const b = makeBuilder();
    from.mockReturnValue(b);

    await deleteException('exc-1');

    expect(from).toHaveBeenCalledWith('schedule_exceptions');
    expect(b.delete).toHaveBeenCalledTimes(1);
    expect(b.eq).toHaveBeenCalledWith('id', 'exc-1');
  });
});
