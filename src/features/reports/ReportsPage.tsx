import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useMonthlyReport } from './queries';
import { buildCsv } from './csv';
import type { ReportRow } from './csv';

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

/** Kunci bulan berjalan 'YYYY-MM' (WIB, konsisten dengan wibDateKey). */
function currentMonthKey(now: Date): string {
  const shifted = new Date(now.getTime() + 420 * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Label bulan Indonesia untuk judul. */
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1] ?? ''} ${y}`;
}

/** Persentase hadir (termasuk terlambat) dari total sesi terhitung. */
function percentage(row: ReportRow): string {
  const total = row.hadir + row.terlambat + row.tidakHadir;
  if (total === 0) return '—';
  const pct = ((row.hadir + row.terlambat) / total) * 100;
  return `${Math.round(pct)}%`;
}

/** Unduh CSV hasil buildCsv lewat Blob + URL.createObjectURL. */
function exportCsv(rows: ReportRow[], month: string) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-kehadiran-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Halaman "Laporan Kehadiran" (kepala sekolah): rekap bulanan per guru
 * + ekspor CSV + cetak. Route: /laporan
 */
export default function ReportsPage() {
  const { signOut } = useAuth();
  const [month, setMonth] = useState(() => currentMonthKey(new Date()));
  const reportQ = useMonthlyReport(month);
  const rows = useMemo(() => reportQ.data ?? [], [reportQ.data]);

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Laporan Kehadiran</h1>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 p-4 pb-24">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Bulan</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>

          <button
            type="button"
            onClick={() => exportCsv(rows, month)}
            disabled={!reportQ.data || rows.length === 0}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cetak
          </button>
        </div>

        <p className="text-sm text-slate-500">
          Rekap kehadiran guru: {monthLabel(month)}
        </p>

        {reportQ.isPending && <Spinner />}
        {reportQ.error && <ErrorBox message={reportQ.error.message} />}

        {reportQ.data && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
            Tidak ada data kehadiran pada bulan ini.
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">Guru</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">Hadir</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">Terlambat</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">Tidak Hadir</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.teacher} className="text-slate-900">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{r.teacher}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.hadir}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.terlambat}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.tidakHadir}</td>
                    <td className="whitespace-nowrap px-3 py-2">{percentage(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Sesi yang belum selesai dan belum diabsen belum dihitung.{' '}
          <Link to="/jadwal" className="text-sky-700 hover:text-sky-900">
            Jadwal
          </Link>
        </p>
      </div>
    </main>
  );
}
