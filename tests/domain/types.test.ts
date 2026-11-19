// Compile-time only test: ensures domain types compile under Vitest/tsc.
import { describe, it, expect } from 'vitest';
import type {
  Role,
  AttendanceStatus,
  ExceptionType,
  SessionWindow,
  AttendancePolicy,
  ScanResult,
} from '@/domain/types';

describe('domain types', () => {
  it('compiles and can be used at type level only', () => {
    const role: Role = 'guru';
    const status: AttendanceStatus = 'hadir';
    const exception: ExceptionType = 'event';
    const session: SessionWindow = { startsAt: new Date(), endsAt: new Date() };
    const policy: AttendancePolicy = { earlyOpenMinutes: 15, lateThresholdMinutes: 15 };
    const ok: ScanResult = { ok: true, status: 'terlambat', duplicate: false };
    const err: ScanResult = { ok: false, reason: 'too_early' };

    expect([role, status, exception, session, policy, ok, err]).toBeDefined();
  });
});
