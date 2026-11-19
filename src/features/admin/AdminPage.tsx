import { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Sheet } from '@/features/admin/Sheet';
import { SchoolForm } from '@/features/admin/SchoolForm';
import { AcademicYearForm } from '@/features/admin/AcademicYearForm';
import { SubjectForm } from '@/features/admin/SubjectForm';
import { ClassForm } from '@/features/admin/ClassForm';
import { UserForm } from '@/features/admin/UserForm';
import {
  useSchools,
  useAcademicYears,
  useSubjects,
  useClasses,
  useUsers,
  useActivateAcademicYear,
} from '@/features/admin/queries';

const TABS = ['Sekolah', 'Tahun Ajaran', 'Mata Pelajaran', 'Kelas', 'Guru'] as const;
type Tab = (typeof TABS)[number];

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

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

const cardCls = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

/** Halaman data master Super Admin: tab Sekolah · Tahun Ajaran ·
 *  Mata Pelajaran · Kelas · Guru, mobile-first (360–430px). */
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('Sekolah');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { signOut } = useAuth();

  const schoolsQ = useSchools();
  // superadmin mengelola satu sekolah aktif pada satu waktu; MVP ini
  // memakai sekolah pertama — bila ada beberapa sekolah, pilihanya
  // mudah ditambah di tab Sekolah nanti.
  const schoolId = schoolsQ.data?.[0]?.id ?? '';
  const academicYearsQ = useAcademicYears(schoolId);
  const subjectsQ = useSubjects(schoolId);
  const classesQ = useClasses(schoolId);
  const usersQ = useUsers(schoolId);
  const activateYear = useActivateAcademicYear(schoolId);

  const closeSheet = () => setSheetOpen(false);

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-900">Data Master</h1>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Keluar
          </button>
        </div>
        <nav className="mx-auto max-w-md" aria-label="Tab data master">
          <div className="flex overflow-x-auto px-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-md space-y-3 p-4 pb-24">
        {tab === 'Sekolah' && (
          <section aria-label="Daftar sekolah" className="space-y-3">
            {schoolsQ.isPending && <Spinner />}
            {schoolsQ.error && <ErrorBox message={schoolsQ.error.message} />}
            {schoolsQ.data &&
              (schoolsQ.data.length === 0 ? (
                <EmptyCard text="Belum ada sekolah. Tambahkan sekolah pertama." />
              ) : (
                schoolsQ.data.map((s) => (
                  <div key={s.id} className={cardCls}>
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {s.address ?? 'Alamat belum diisi'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      UTC{Math.trunc(s.timezone_offset_minutes / 60) >= 0 ? '+' : ''}
                      {Math.trunc(s.timezone_offset_minutes / 60)} · dipakai untuk
                      tab lain
                    </p>
                  </div>
                ))
              ))}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white"
            >
              Tambah Sekolah
            </button>
          </section>
        )}

        {tab === 'Tahun Ajaran' && (
          <section aria-label="Daftar tahun ajaran" className="space-y-3">
            {academicYearsQ.isPending && <Spinner />}
            {academicYearsQ.error && <ErrorBox message={academicYearsQ.error.message} />}
            {academicYearsQ.data &&
              (academicYearsQ.data.length === 0 ? (
                <EmptyCard text="Belum ada tahun ajaran." />
              ) : (
                academicYearsQ.data.map((y) => (
                  <div key={y.id} className={cardCls}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{y.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {y.start_date} s/d {y.end_date}
                        </p>
                      </div>
                      {y.is_active ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Aktif
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => activateYear.mutate(y.id)}
                          disabled={activateYear.isPending}
                          className="rounded-lg border border-sky-600 px-3 py-1.5 text-xs font-medium text-sky-700 disabled:opacity-60"
                        >
                          Aktifkan
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ))}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white"
            >
              Tambah Tahun Ajaran
            </button>
          </section>
        )}

        {tab === 'Mata Pelajaran' && (
          <section aria-label="Daftar mata pelajaran" className="space-y-3">
            {subjectsQ.isPending && <Spinner />}
            {subjectsQ.error && <ErrorBox message={subjectsQ.error.message} />}
            {subjectsQ.data &&
              (subjectsQ.data.length === 0 ? (
                <EmptyCard text="Belum ada mata pelajaran." />
              ) : (
                subjectsQ.data.map((s) => (
                  <div key={s.id} className={cardCls}>
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {s.code ? `Kode: ${s.code}` : 'Tanpa kode'}
                    </p>
                  </div>
                ))
              ))}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white"
            >
              Tambah Mata Pelajaran
            </button>
          </section>
        )}

        {tab === 'Kelas' && (
          <section aria-label="Daftar kelas" className="space-y-3">
            {classesQ.isPending && <Spinner />}
            {classesQ.error && <ErrorBox message={classesQ.error.message} />}
            {classesQ.data &&
              (classesQ.data.length === 0 ? (
                <EmptyCard text="Belum ada kelas." />
              ) : (
                classesQ.data.map((c) => (
                  <div key={c.id} className={cardCls}>
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.level !== null && (
                      <p className="mt-1 text-sm text-slate-500">Tingkat {c.level}</p>
                    )}
                  </div>
                ))
              ))}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white"
            >
              Tambah Kelas
            </button>
          </section>
        )}

        {tab === 'Guru' && (
          <section aria-label="Daftar guru" className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Cara menambah guru:</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>
                  Buka dashboard Supabase → <strong>Authentication → Add user</strong>,
                  isi email + password.
                </li>
                <li>
                  Di detail user, isi <strong>app_metadata</strong>:
                  <code className="mt-1 block rounded bg-amber-100 px-2 py-1 text-xs">
                    {`{ "role": "guru", "school_id": "${schoolId || '<uuid sekolah>'}" }`}
                  </code>
                </li>
                <li>
                  Salin <strong>User ID</strong> (UUID) user tersebut, lalu isi form
                  &quot;Tambah Guru&quot; di bawah.
                </li>
              </ol>
              <p className="mt-2 text-xs">
                User auth tidak dibuat dari aplikasi ini karena butuh kunci
                service_role yang tidak boleh ada di browser.
              </p>
            </div>
            {usersQ.isPending && <Spinner />}
            {usersQ.error && <ErrorBox message={usersQ.error.message} />}
            {usersQ.data &&
              usersQ.data.map((u) => (
                <div key={u.id} className={cardCls}>
                  <p className="font-medium text-slate-900">{u.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{u.email}</p>
                  <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {u.role}
                  </span>
                </div>
              ))}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white"
            >
              Tambah Guru
            </button>
          </section>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={closeSheet} title={`Tambah ${tab}`}>
        {tab === 'Sekolah' && <SchoolForm onDone={closeSheet} />}
        {tab === 'Tahun Ajaran' && (
          <AcademicYearForm schoolId={schoolId} onDone={closeSheet} />
        )}
        {tab === 'Mata Pelajaran' && (
          <SubjectForm schoolId={schoolId} onDone={closeSheet} />
        )}
        {tab === 'Kelas' && <ClassForm schoolId={schoolId} onDone={closeSheet} />}
        {tab === 'Guru' && <UserForm schoolId={schoolId} onDone={closeSheet} />}
      </Sheet>
    </main>
  );
}
