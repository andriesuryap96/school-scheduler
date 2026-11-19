import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Sheet } from '@/features/admin/Sheet';
import { ExceptionForm } from './ExceptionForm';
import { useSchedulePageData } from './useSchedulePageData';
import { useSchedules, useExceptions, useDeleteException, EXCEPTION_TYPES, DAY_NAMES } from './queries';

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

function typeLabel(value: string): string {
  return EXCEPTION_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Label singkat jadwal untuk dropdown pengecualian: "Senin · 08:00 · Matematika". */
function shortScheduleLabel(
  s: { id: string; day_of_week: number; start_time: string; subject_id: string },
  subjectName: (id: string) => string | undefined,
): string {
  const jam = s.start_time.slice(0, 5);
  return `${DAY_NAMES[s.day_of_week]} · ${jam} · ${subjectName(s.subject_id) ?? 'Jadwal'}`;
}

/** Format tanggal lokal panjang: 25 Desember 2026 (Asia/Jakarta). */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Halaman Pengecualian (kepala_sekolah): daftar pengecualian + form
 * (tanggal, tipe, keterangan, toggle semua/satu jadwal).
 * Route: /pengecualian — diakses dari header SchedulePage.
 */
export default function ExceptionPage() {
  const { signOut } = useAuth();
  const data = useSchedulePageData();
  const yearId = data.activeYear?.id ?? '';
  // jadwal dipakai untuk pilihan "satu jadwal" pada form
  const schedulesQ = useSchedules(yearId);
  const exceptionsQ = useExceptions(data.schoolId);
  const delException = useDeleteException(data.schoolId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = () => setSheetOpen(false);

  const subjectName = (id: string) =>
    data.subjects.find((s) => s.id === id)?.name;

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Pengecualian</h1>
          <div className="flex items-center gap-4">
            <Link to="/jadwal" className="text-sm font-medium text-sky-700 hover:text-sky-900">
              Jadwal
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-3 p-4 pb-24">
        {data.error && <ErrorBox message={data.error} />}
        {data.loading && !data.error && <Spinner />}

        {!data.error && !data.loading && (
          <>
            {exceptionsQ.isPending && <Spinner />}
            {exceptionsQ.error && <ErrorBox message={exceptionsQ.error.message} />}
            {exceptionsQ.data &&
              (exceptionsQ.data.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                  Belum ada pengecualian.
                </div>
              ) : (
                exceptionsQ.data.map((x) => (
                  <div key={x.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{formatDate(x.date)}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {typeLabel(x.type)}
                          {x.description ? ` · ${x.description}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {x.affects_all
                            ? 'Berlaku untuk semua jadwal'
                            : `Berlaku untuk satu jadwal${
                                schedulesQ.data
                                  ? `: ${shortScheduleLabel(
                                      schedulesQ.data.find((s) => s.id === x.schedule_id) ?? {
                                        id: x.schedule_id ?? '',
                                        day_of_week: 0,
                                        start_time: '',
                                        subject_id: '',
                                      },
                                      subjectName,
                                    )}`
                                  : ''
                              }`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => delException.mutate(x.id)}
                        disabled={delException.isPending}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              ))}
            {delException.error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Gagal menghapus pengecualian: {delException.error.message}
              </p>
            )}

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={!data.schoolId}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white disabled:opacity-60 md:w-auto md:px-6"
            >
              Tambah Pengecualian
            </button>
            {!data.schoolId && !data.error && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Data sekolah belum tersedia.
              </p>
            )}
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={closeSheet} title="Tambah Pengecualian">
        <ExceptionForm
          schoolId={data.schoolId}
          schedules={schedulesQ.data ?? []}
          scheduleLabel={(s) => shortScheduleLabel(s, subjectName)}
          onDone={closeSheet}
        />
      </Sheet>
    </main>
  );
}
