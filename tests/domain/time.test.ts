import { describe, it, expect } from 'vitest';
import { buildSessionWindow } from '@/domain/time';

const WIB = 420; // UTC+7 dalam menit

describe('buildSessionWindow', () => {
  it('mengkonversi jam WIB ke instant UTC yang benar', () => {
    const w = buildSessionWindow('2026-11-20', '08:00', '09:30', WIB);
    expect(w.startsAt.toISOString()).toBe('2026-11-20T01:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-11-20T02:30:00.000Z');
  });

  it('menangani kelas yang selesai lewat tengah malam UTC', () => {
    const w = buildSessionWindow('2026-11-20', '07:00', '08:00', WIB);
    expect(w.startsAt.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('menangani offset negatif (UTC-5)', () => {
    const w = buildSessionWindow('2026-11-20', '08:00', '09:00', -300);
    expect(w.startsAt.toISOString()).toBe('2026-11-20T13:00:00.000Z');
  });

  it('melempar error untuk format tanggal salah', () => {
    expect(() => buildSessionWindow('20-11-2026', '08:00', '09:00', WIB))
      .toThrow(/format tanggal/i);
  });
});
