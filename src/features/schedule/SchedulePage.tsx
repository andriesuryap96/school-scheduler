import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Sheet } from '@/features/admin/Sheet';
import { ScheduleForm } from './ScheduleForm';
import { useSchedulePageData } from './useSchedulePageData';
import { useSchedules, useDeleteSchedule, DAY_NAMES, WEEK_ORDER } from './queries';
import type { ScheduleRow } from './queries';

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

const cardCls = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm';

function jam(t: string): string {
  return t.slice(0, 5); // '08:00:00' → '08:00'
}

/** Judul kartu jadwal: nama mapel; subjudul guru + kelas + jam. */
function ScheduleCard({
  s,
  teacher,
  cls,
  subject,
  onEdit,
  onDelete,
  busy,
}: {
  s: ScheduleRow;
  teacher?: string;
  cls?: string;
  subject?: string;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className={cardCls}>
      <p className="font-medium text-slate-900">{subject ?? s.subject_id}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {jam(s.start_time)}–{jam(s.end_time)} · {teacher ?? s.teacher_id} · {cls ?? s.class_id}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-sky-600 px-3 py-1.5 text-xs font-medium text-sky-700"
        >
          Ubah
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

interface Master {
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}

function labelOf(list: { id: string; name: string }[], id: string): string | undefined {
  return list.find((x) => x.id === id)?.name;
}

/** Daftar hari dalam urutan Senin–Minggu; hari tanpa jadwal dilewati. */
function daysInOrder(schedules: ScheduleRow[]): number[] {
  return WEEK_ORDER.filter((d) => schedules.some((s) => s.day_of_week === d));
}

/** Header mobile + section per hari (heading hari, kartu vertikal). */
function DayList({
  schedules,
  master,
  onEdit,
  onDelete,
  busy,
}: {
  schedules: ScheduleRow[];
  master: Master;
  onEdit: (s: ScheduleRow) => void;
  onDelete: (s: ScheduleRow) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      {daysInOrder(schedules).map((d) => (
        <section key={d} aria-label={DAY_NAMES[d]} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {DAY_NAMES[d]}
          </h2>
          {schedules
            .filter((s) => s.day_of_week === d)
            .map((s) => (
              <ScheduleCard
                key={s.id}
                s={s}
                teacher={labelOf(master.teachers, s.teacher_id)}
                cls={labelOf(master.classes, s.class_id)}
                subject={labelOf(master.subjects, s.subject_id)}
                onEdit={() => onEdit(s)}
                onDelete={() => onDelete(s)}
                busy={busy}
              />
            ))}
        </section>
      ))}
    </div>
  );
}

/** Grid mingguan desktop: 7 kolom Senin–Minggu. */
function WeekGrid({
  schedules,
  master,
  onEdit,
  onDelete,
  busy,
}: {
  schedules: ScheduleRow[];
  master: Master;
  onEdit: (s: ScheduleRow) => void;
  onDelete: (s: ScheduleRow) => void;
  busy: boolean;
}) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {WEEK_ORDER.map((d) => (
        <section key={d} aria-label={DAY_NAMES[d]} className="space-y-2">
          <h2 className="border-b border-slate-200 pb-1 text-center text-sm font-semibold text-slate-700">
            {DAY_NAMES[d]}
          </h2>
          {schedules
            .filter((s) => s.day_of_week === d)
            .map((s) => (
              <ScheduleCard
                key={s.id}
                s={s}
                teacher={labelOf(master.teachers, s.teacher_id)}
                cls={labelOf(master.classes, s.class_id)}
                subject={labelOf(master.subjects, s.subject_id)}
                onEdit={() => onEdit(s)}
                onDelete={() => onDelete(s)}
                busy={busy}
              />
            ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Halaman Jadwal (kepala_sekolah): grid mingguan 7 kolom Senin–Minggu
 * di desktop, daftar hari vertikal dengan heading di mobile.
 */
export default function SchedulePage() {
  const { signOut } = useAuth();
  const data = useSchedulePageData();
  const yearId = data.activeYear?.id ?? '';
  const schedulesQ = useSchedules(yearId);
  const delSchedule = useDeleteSchedule(yearId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (s: ScheduleRow) => {
    setEditing(s);
    setSheetOpen(true);
  };
  const closeSheet = () => setSheetOpen(false);

  const canAdd = !!data.schoolId && !!data.activeYear;

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Jadwal</h1>
          <div className="flex items-center gap-4">
            <Link
              to="/pengecualian"
              className="text-sm font-medium text-sky-700 hover:text-sky-900"
            >
              Pengecualian
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
            {data.activeYear && (
              <p className="text-sm text-slate-500">
                Tahun ajaran aktif: <span className="font-medium text-slate-700">{data.activeYear.name}</span>
              </p>
            )}
            {data.schoolId && !data.activeYear && data.hasYears && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Belum ada tahun ajaran aktif. Aktifkan lewat Data Master (superadmin).
              </p>
            )}

            {schedulesQ.isPending && <Spinner />}
            {schedulesQ.error && <ErrorBox message={schedulesQ.error.message} />}
            {schedulesQ.data && schedulesQ.data.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                Belum ada jadwal pada tahun ajaran aktif.
              </div>
            )}
            {schedulesQ.data && schedulesQ.data.length > 0 && (
              /* mobile: daftar vertikal; md+: grid 7 kolom */
              <div className="md:hidden">
                <DayList
                  schedules={schedulesQ.data}
                  master={data}
                  onEdit={openEdit}
                  onDelete={(s) => delSchedule.mutate(s.id)}
                  busy={delSchedule.isPending}
                />
              </div>
            )}
            {schedulesQ.data && schedulesQ.data.length > 0 && (
              <div className="hidden md:block">
                <WeekGrid
                  schedules={schedulesQ.data}
                  master={data}
                  onEdit={openEdit}
                  onDelete={(s) => delSchedule.mutate(s.id)}
                  busy={delSchedule.isPending}
                />
              </div>
            )}
            {delSchedule.error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Gagal menghapus jadwal: {delSchedule.error.message}
              </p>
            )}

            <button
              type="button"
              onClick={openAdd}
              disabled={!canAdd}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white disabled:opacity-60 md:w-auto md:px-6"
            >
              Tambah Jadwal
            </button>
            {!canAdd && !data.error && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {!data.activeYear
                  ? 'Jadwal membutuhkan tahun ajaran aktif — buat/aktifkan dulu di Data Master.'
                  : 'Data sekolah belum tersedia.'}
              </p>
            )}
          </>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? 'Ubah Jadwal' : 'Tambah Jadwal'}
      >
        <ScheduleForm
          schoolId={data.schoolId}
          academicYearId={yearId}
          teachers={data.teachers}
          classes={data.classes}
          subjects={data.subjects}
          editing={editing}
          onDone={closeSheet}
        />
      </Sheet>
    </main>
  );
}
