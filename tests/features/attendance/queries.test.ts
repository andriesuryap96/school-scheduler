import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modul supabase: queries.ts memakai `rpc` (recordAttendance) dan
// `from` (listTodaySessions / getSessionByToken).
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc, from },
}));

import {
  recordAttendance,
  listTodaySessions,
  getSessionByToken,
  wibDateKey,
  wibTime,
} from '@/features/attendance/queries';

// =====================================================================
// Builder query Supabase palsu (pola tests/features/admin/queries.test.ts)
// =====================================================================

/**
 * Builder untuk SELECT berantai:
 * `.select(...).eq(...).order(...)` (await di akhir) atau
 * `.select(...).eq(...).single()`.
 */
function makeSelectBuilder(opts: { awaited?: { data: unknown; error: unknown } } = {}) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() =>
    Promise.resolve(opts.awaited ?? { data: [] as unknown[], error: null }),
  );
  b.single = vi.fn(() => Promise.resolve(opts.awaited ?? { data: null, error: null }));
  return b as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

// Row mentah seperti yang dikembalikan PostgREST untuk listTodaySessions.
const RAW_SESSION_ROW = {
  id: 'sesi-1',
  teacher_id: 'guru-1',
  date: '2026-11-19',
  token: 'tok-1',
  starts_at: '2026-11-19T00:00:00.000Z', // 07:00 WIB
  ends_at: '2026-11-19T01:30:00.000Z', // 08:30 WIB
  schedules: {
    start_time: '07:00:00',
    end_time: '08:30:00',
    subjects: { name: 'Matematika' },
    classes: { name: '7A' },
  },
  attendance_records: [{ status: 'hadir', scanned_at: '2026-11-19T00:02:00.000Z' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// =====================================================================
// recordAttendance
// =====================================================================

describe('recordAttendance', () => {
  it('memanggil supabase.rpc("record_attendance", { p_token: token })', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, status: 'hadir', duplicate: false },
      error: null,
    });

    await recordAttendance('tok-123');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_attendance', { p_token: 'tok-123' });
  });

  it('melempar error bila rpc gagal', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'koneksi gagal' } });

    await expect(recordAttendance('tok-1')).rejects.toThrow('koneksi gagal');
  });

  it('memetakan { ok: false, reason: "expired" } ke "Sesi sudah berakhir"', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'expired' }, error: null });

    const res = await recordAttendance('tok-1');

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('expired');
    expect(res.message).toBe('Sesi sudah berakhir');
  });

  it('memetakan { ok: true, duplicate: true } ke "Kamu sudah tercatat hadir"', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, status: 'hadir', duplicate: true },
      error: null,
    });

    const res = await recordAttendance('tok-1');

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.duplicate).toBe(true);
    expect(res.message).toBe('Kamu sudah tercatat hadir');
  });

  it('memetakan { ok: false, reason: "not_yours" } ke "Link ini bukan untuk jadwal mengajar kamu"', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'not_yours' }, error: null });

    const res = await recordAttendance('tok-guru-lain');

    expect(res.ok).toBe(false);
    expect(res.message).toBe('Link ini bukan untuk jadwal mengajar kamu');
  });

  it('memetakan ok hadir (bukan duplicate) ke pesan Hadir', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, status: 'hadir', duplicate: false },
      error: null,
    });

    const res = await recordAttendance('tok-1');

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.status).toBe('hadir');
    expect(res.message).toBe('Kehadiran tercatat sebagai Hadir');
  });

  it('memetakan ok terlambat (bukan duplicate) ke pesan Terlambat', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, status: 'terlambat', duplicate: false },
      error: null,
    });

    const res = await recordAttendance('tok-1');

    expect(res.message).toBe('Kehadiran tercatat sebagai Terlambat');
  });

  it('memetakan { ok: false, reason: "too_early" } ke pesan sesi belum dibuka', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'too_early' }, error: null });

    const res = await recordAttendance('tok-1');

    expect(res.ok).toBe(false);
    expect(res.message).toBe('Sesi belum dibuka. Coba lagi mendekati jam mulai.');
  });

  it('memetakan { ok: false, reason: "not_found" } ke pesan token tidak ditemukan', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'not_found' }, error: null });

    const res = await recordAttendance('tok-tak-dikenal');

    expect(res.ok).toBe(false);
    expect(res.message).toBe('Token absen tidak ditemukan atau tidak valid');
  });

  it('mengembalikan data null tanpa error sebagai not_found', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await recordAttendance('tok-1');

    expect(res.ok).toBe(false);
    expect(res.message).toBe('Token absen tidak ditemukan atau tidak valid');
  });

  it('mencatat waktu scan (client) untuk scan baru yang berhasil', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, status: 'hadir', duplicate: false },
      error: null,
    });

    const res = await recordAttendance('tok-1');

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.scannedAt).toBeInstanceOf(Date);
  });
});

// =====================================================================
// listTodaySessions
// =====================================================================

describe('listTodaySessions', () => {
  it('memfilter attendance_sessions berdasarkan tanggal WIB', async () => {
    const b = makeSelectBuilder({ awaited: { data: [], error: null } });
    from.mockReturnValue(b);

    await listTodaySessions('2026-11-19');

    expect(from).toHaveBeenCalledWith('attendance_sessions');
    expect(b.eq).toHaveBeenCalledWith('date', '2026-11-19');
  });

  it('memakai join schedules/subjects/classes dan attendance_records', async () => {
    const b = makeSelectBuilder({ awaited: { data: [], error: null } });
    from.mockReturnValue(b);

    await listTodaySessions('2026-11-19');

    const selectArg = b.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('schedules');
    expect(selectArg).toContain('subjects');
    expect(selectArg).toContain('classes');
    expect(selectArg).toContain('attendance_records');
    expect(selectArg).toContain('token');
  });

  it('meratakan row nested jadi TodaySession (mapel, kelas, record)', async () => {
    const b = makeSelectBuilder({ awaited: { data: [RAW_SESSION_ROW], error: null } });
    from.mockReturnValue(b);

    const sessions = await listTodaySessions('2026-11-19');

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({
      id: 'sesi-1',
      token: 'tok-1',
      date: '2026-11-19',
      startsAt: '2026-11-19T00:00:00.000Z',
      endsAt: '2026-11-19T01:30:00.000Z',
      subjectName: 'Matematika',
      className: '7A',
      startTime: '07:00:00',
      endTime: '08:30:00',
      record: { status: 'hadir', scannedAt: '2026-11-19T00:02:00.000Z' },
    });
  });

  it('record null bila belum ada attendance_records', async () => {
    const b = makeSelectBuilder({
      awaited: { data: [{ ...RAW_SESSION_ROW, attendance_records: [] }], error: null },
    });
    from.mockReturnValue(b);

    const sessions = await listTodaySessions('2026-11-19');

    expect(sessions[0].record).toBeNull();
  });

  it('melempar error bila query gagal', async () => {
    const b = makeSelectBuilder({
      awaited: { data: null, error: { message: 'RLS menolak' } },
    });
    from.mockReturnValue(b);

    await expect(listTodaySessions('2026-11-19')).rejects.toThrow('RLS menolak');
  });
});

// =====================================================================
// getSessionByToken
// =====================================================================

describe('getSessionByToken', () => {
  it('query attendance_sessions berdasarkan token + single', async () => {
    const b = makeSelectBuilder({
      awaited: { data: RAW_SESSION_ROW, error: null },
    });
    from.mockReturnValue(b);

    await getSessionByToken('tok-1');

    expect(from).toHaveBeenCalledWith('attendance_sessions');
    expect(b.eq).toHaveBeenCalledWith('token', 'tok-1');
    expect(b.single).toHaveBeenCalledTimes(1);
  });

  it('mengembalikan sesi terpetakan bila ditemukan', async () => {
    const b = makeSelectBuilder({ awaited: { data: RAW_SESSION_ROW, error: null } });
    from.mockReturnValue(b);

    const session = await getSessionByToken('tok-1');

    expect(session?.token).toBe('tok-1');
    expect(session?.subjectName).toBe('Matematika');
    expect(session?.className).toBe('7A');
  });

  it('mengembalikan null bila token tidak ditemukan', async () => {
    const b = makeSelectBuilder({
      awaited: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    });
    from.mockReturnValue(b);

    const session = await getSessionByToken('tok-hantu');

    expect(session).toBeNull();
  });
});

// =====================================================================
// Helper waktu WIB
// =====================================================================

describe('wibDateKey', () => {
  it('mengembalikan tanggal kalender WIB (UTC+7)', () => {
    // 18 Nov 2026 18:30 UTC = 19 Nov 2026 01:30 WIB
    expect(wibDateKey(new Date(Date.UTC(2026, 10, 18, 18, 30)))).toBe('2026-11-19');
    // 18 Nov 2026 16:59 UTC = 18 Nov 2026 23:59 WIB
    expect(wibDateKey(new Date(Date.UTC(2026, 10, 18, 16, 59)))).toBe('2026-11-18');
  });
});

describe('wibTime', () => {
  it('memformat instant UTC menjadi jam WIB HH:MM', () => {
    // 00:05 UTC = 07:05 WIB
    expect(wibTime('2026-11-19T00:05:00.000Z')).toBe('07:05');
    // 16:59:30 UTC = 23:59 WIB
    expect(wibTime('2026-11-19T16:59:30.000Z')).toBe('23:59');
  });
});
