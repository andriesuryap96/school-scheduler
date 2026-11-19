import { describe, it, expect } from 'vitest';
import { resolveScanResult } from '@/domain/attendance';
import type { SessionWindow, AttendancePolicy } from '@/domain/types';

const window: SessionWindow = {
  startsAt: new Date('2026-11-20T01:00:00Z'), // 08:00 WIB
  endsAt: new Date('2026-11-20T02:30:00Z'),   // 09:30 WIB
};
const policy: AttendancePolicy = { earlyOpenMinutes: 15, lateThresholdMinutes: 15 };

const at = (iso: string) => new Date(iso);

describe('resolveScanResult', () => {
  it('menolak scan 16 menit sebelum jam mulai', () => {
    expect(resolveScanResult(at('2026-11-20T00:44:00Z'), window, policy))
      .toEqual({ ok: false, reason: 'too_early' });
  });

  it('menerima scan tepat 15 menit sebelum jam mulai sebagai hadir', () => {
    expect(resolveScanResult(at('2026-11-20T00:45:00Z'), window, policy))
      .toEqual({ ok: true, status: 'hadir' });
  });

  it('menerima scan tepat di jam mulai sebagai hadir', () => {
    expect(resolveScanResult(at('2026-11-20T01:00:00Z'), window, policy))
      .toEqual({ ok: true, status: 'hadir' });
  });

  it('menerima scan tepat di batas toleransi sebagai hadir', () => {
    expect(resolveScanResult(at('2026-11-20T01:15:00Z'), window, policy))
      .toEqual({ ok: true, status: 'hadir' });
  });

  it('menandai terlambat satu detik setelah batas toleransi', () => {
    expect(resolveScanResult(at('2026-11-20T01:15:01Z'), window, policy))
      .toEqual({ ok: true, status: 'terlambat' });
  });

  it('menerima scan tepat di jam selesai sebagai terlambat', () => {
    expect(resolveScanResult(at('2026-11-20T02:30:00Z'), window, policy))
      .toEqual({ ok: true, status: 'terlambat' });
  });

  it('menolak scan satu detik setelah jam selesai', () => {
    expect(resolveScanResult(at('2026-11-20T02:30:01Z'), window, policy))
      .toEqual({ ok: false, reason: 'expired' });
  });
});
