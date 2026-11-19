import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { resolveFinalStatus } from '@/domain/attendance';
import {
  useTodaySessions,
  wibDateKey,
  wibTime,
  toSessionWindow,
} from './queries';
import type { TodaySession } from './queries';
import type { AttendanceStatus } from '@/domain/types';

function Spinner() {
  return (
    <div role="status" aria-label="Memuat" className="flex justify-center py-8">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      Gagal memuat data: {message}
    </p>
  );
}

const cardCls = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

/** Format tanggal kalender (YYYY-MM-DD) panjang: "25 Desember 2026". */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Warna badge per status kehadiran. */
const STATUS_STYLES: Record<string, string> = {
  Hadir: 'bg-emerald-100 text-emerald-800',
  Terlambat: 'bg-amber-100 text-amber-800',
  'Tidak Hadir': 'bg-red-100 text-red-800',
  'Belum absen': 'bg-slate-100 text-slate-600',
};

function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[label] ?? 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Kartu satu sesi hari ini.
 *
 * Status badge:
 * - sudah absen → status record (Hadir / Terlambat) via resolveFinalStatus
 * - belum absen & sesi sudah lewat → Tidak Hadir via resolveFinalStatus
 * - belum absen & sesi masih berjalan → Belum absen
 *
 * Tombol "Absen Sekarang" menuju /absen/:token; bila sesi sudah lewat
 * diganti teks "Sesi sudah berakhir".
 */
function SessionCard({ session, now }: { session: TodaySession; now: Date }) {
  const window = toSessionWindow(session);
  const expired = now.getTime() > window.endsAt.getTime();

  let statusLabel: AttendanceStatus | 'Belum absen';
  if (session.record) {
    statusLabel = resolveFinalStatus(session.record, window, now);
  } else {
    statusLabel = expired ? resolveFinalStatus(null, window, now) : 'Belum absen';
  }

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">
            {session.subjectName ?? 'Mapel'}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            Kelas {session.className ?? '-'} ·{' '}
            {wibTime(session.startsAt)}–{wibTime(session.endsAt)} WIB
          </p>
        </div>
        <StatusBadge label={statusLabel} />
      </div>

      <div className="mt-3">
        {expired ? (
          <p className="text-sm text-slate-400">Sesi sudah berakhir</p>
        ) : session.record ? (
          <p className="text-sm text-emerald-700">
            Absen pukul {wibTime(session.record.scannedAt)} WIB
          </p>
        ) : (
          <Link
            to={`/absen/${session.token}`}
            className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Absen Sekarang
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Halaman "Jadwal Hari Ini" (guru): daftar sesi absen hari ini milik
 * guru yang login (difilter RLS), dengan status kehadiran.
 * Route: /hari-ini
 */
export default function TodayPage() {
  const { signOut } = useAuth();
  const sessionsQ = useTodaySessions();
  const now = new Date();
  const todayKey = wibDateKey(now);

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Jadwal Hari Ini</h1>
            <p className="text-xs text-slate-500">{formatDate(todayKey)}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-3 p-4 pb-24">
        {sessionsQ.isPending && <Spinner />}
        {sessionsQ.error && <ErrorBox message={sessionsQ.error.message} />}

        {sessionsQ.data &&
          (sessionsQ.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
              Tidak ada jadwal mengajar hari ini.
            </div>
          ) : (
            sessionsQ.data.map((s) => <SessionCard key={s.id} session={s} now={now} />)
          ))}
      </div>
    </main>
  );
}
