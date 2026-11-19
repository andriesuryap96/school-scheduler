import { describe, it, expect } from 'vitest';
import { shouldGenerateSession } from '@/domain/session-generation';

// Menguji logika murni pemilihan jadwal — harus sama dengan
// generate_sessions_for_date() di 0004_generate_sessions.sql.

describe('shouldGenerateSession', () => {
  it('melewati tanggal yang jadi libur nasional untuk semua jadwal', () => {
    expect(shouldGenerateSession({
      schedule: { day_of_week: 1, is_active: true },
      date: '2026-12-25',
      dayOfWeek: 5,
      exceptions: [{ date: '2026-12-25', type: 'libur_nasional', affects_all: true, schedule_id: null }],
    })).toBe(false);
  });

  it('melewati jadwal yang tidak aktif', () => {
    expect(shouldGenerateSession({
      schedule: { day_of_week: 5, is_active: false },
      date: '2026-12-25',
      dayOfWeek: 5,
      exceptions: [],
    })).toBe(false);
  });

  it('melewati hari yang tidak cocok', () => {
    // day_of_week 1 (Senin) vs dayOfWeek 5 (Jumat) → false
    expect(shouldGenerateSession({
      schedule: { day_of_week: 1, is_active: true },
      date: '2026-12-25',
      dayOfWeek: 5,
      exceptions: [],
    })).toBe(false);
  });

  it('menghasilkan sesi bila tidak ada pengecualian dan hari cocok', () => {
    expect(shouldGenerateSession({
      schedule: { day_of_week: 5, is_active: true },
      date: '2026-12-25',
      dayOfWeek: 5,
      exceptions: [],
    })).toBe(true);
  });

  it('menghormati pengecualian yang hanya untuk satu jadwal', () => {
    // Pengecualian spesifik jadwal lain tidak memengaruhi jadwal ini → true
    expect(shouldGenerateSession({
      schedule: { day_of_week: 5, is_active: true, id: 'schedule-a' },
      date: '2026-12-25',
      dayOfWeek: 5,
      exceptions: [
        { date: '2026-12-25', type: 'ulangan_umum', affects_all: false, schedule_id: 'schedule-b' },
      ],
    })).toBe(true);

    // Pengecualian spesifik untuk jadwal ini → false
    expect(shouldGenerateSession({
      schedule: { day_of_week: 5, is_active: true, id: 'schedule-a' },
      date: '2026-12-25',
      dayOfWeek: 5,
      exceptions: [
        { date: '2026-12-25', type: 'ulangan_umum', affects_all: false, schedule_id: 'schedule-a' },
      ],
    })).toBe(false);
  });
});
