import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { resolveScanResult } from '@/domain/attendance';
import { useSessionByToken, useRecordAttendance, wibTime, toSessionWindow } from './queries';
import type { RecordAttendanceResult } from './queries';

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
      {message}
    </p>
  );
}

const cardCls = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

/**
 * Pratinjau status client-side (resolveScanResult) — hanya untuk UI
 * segera; penulisan tetap lewat RPC record_attendance (otoritatif).
 */
function ClientPreview({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const preview = resolveScanResult(
    new Date(),
    toSessionWindow({ startsAt, endsAt }),
    { earlyOpenMinutes: 15, lateThresholdMinutes: 15 },
  );
  const label = preview.ok
    ? `Jika absen sekarang: ${preview.status === 'hadir' ? 'Hadir' : 'Terlambat'}`
    : preview.reason === 'too_early'
      ? 'Sesi belum dibuka'
      : 'Sesi sudah berakhir';
  return <p className="text-xs text-slate-500">{label}</p>;
}

/**
 * Panel hasil setelah menekan "Konfirmasi Kehadiran".
 * ok → status (Huruf awal besar) + waktu scan WIB.
 * !ok → pesan error Indonesia dari RPC.
 */
function ResultPanel({ result }: { result: RecordAttendanceResult }) {
  if (result.ok) {
    const status = result.status === 'hadir' ? 'Hadir' : 'Terlambat';
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
        <p className="font-medium text-emerald-900">{result.message}</p>
        <p className="mt-1 text-sm text-emerald-800">
          Status: <span className="font-semibold">{status}</span> · Pukul{' '}
          {wibTime(result.scannedAt.toISOString())} WIB
        </p>
        {result.duplicate && (
          <p className="mt-1 text-xs text-emerald-700">
            Tidak ada record baru yang dibuat.
          </p>
        )}
      </div>
    );
  }
  return <ErrorBox message={result.message} />;
}

/**
 * Halaman scan/absen (guru): /absen/:token — detail sesi, tombol besar
 * "Konfirmasi Kehadiran" → recordAttendance (RPC otoritatif), hasil
 * sukses/error, plus QR code link sesi untuk Kepala Sekolah.
 */
export default function ScanPage() {
  const { token = '' } = useParams<{ token: string }>();
  const sessionQ = useSessionByToken(token);
  const record = useRecordAttendance();

  const [result, setResult] = useState<RecordAttendanceResult | null>(null);

  const onConfirm = () => {
    setResult(null);
    record.mutate(token, { onSuccess: setResult });
  };

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Absen Sesi</h1>
          <Link
            to="/hari-ini"
            className="text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            Kembali
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-3 p-4 pb-24">
        {sessionQ.isPending && <Spinner />}
        {sessionQ.error && <ErrorBox message={sessionQ.error.message} />}

        {sessionQ.data === null && !sessionQ.isPending && !sessionQ.error && (
          <ErrorBox message="Token absen tidak ditemukan atau tidak valid" />
        )}

        {sessionQ.data && (
          <>
            <div className={cardCls}>
              <p className="font-medium text-slate-900">
                {sessionQ.data.subjectName ?? 'Mapel'}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Kelas {sessionQ.data.className ?? '-'} ·{' '}
                {wibTime(sessionQ.data.startsAt)}–{wibTime(sessionQ.data.endsAt)} WIB
              </p>
              <div className="mt-2">
                <ClientPreview
                  startsAt={sessionQ.data.startsAt}
                  endsAt={sessionQ.data.endsAt}
                />
              </div>
              {sessionQ.data.record && (
                <p className="mt-2 text-sm text-emerald-700">
                  Kamu sudah tercatat hadir pukul{' '}
                  {wibTime(sessionQ.data.record.scannedAt)} WIB.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onConfirm}
              disabled={record.isPending}
              className="w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
            >
              {record.isPending ? 'Mencatat…' : 'Konfirmasi Kehadiran'}
            </button>

            {result && <ResultPanel result={result} />}

            <div className={`${cardCls} text-center`}>
              <p className="text-sm font-medium text-slate-700">
                QR Code Sesi Ini
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Untuk ditampilkan/dicetak Kepala Sekolah bila perlu.
              </p>
              <div className="mt-3 flex justify-center">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <QRCodeSVG
                    value={`${window.location.origin}/absen/${token}`}
                    size={180}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
