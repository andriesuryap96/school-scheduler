import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { useCreateException, EXCEPTION_TYPES } from './queries';
import type { ScheduleRow } from './queries';

interface ExceptionFormProps {
  schoolId: string;
  /** Jadwal pada tahun ajaran aktif — pilihan "satu jadwal". */
  schedules: ScheduleRow[];
  /** Label pendek tiap jadwal, mis. "Senin · 08:00–09:30 · Matematika". */
  scheduleLabel: (s: ScheduleRow) => string;
  onDone: () => void;
}

/** Form tambah pengecualian: tanggal, tipe, keterangan, toggle semua/satu jadwal. */
export function ExceptionForm({
  schoolId,
  schedules,
  scheduleLabel,
  onDone,
}: ExceptionFormProps) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'libur_nasional' | 'ulangan_umum' | 'event'>('libur_nasional');
  const [description, setDescription] = useState('');
  const [affectsAll, setAffectsAll] = useState(true);
  const [scheduleId, setScheduleId] = useState('');

  const create = useCreateException(schoolId);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      {
        school_id: schoolId,
        date,
        type,
        description: description.trim() || null,
        affects_all: affectsAll,
        // bila berlaku semua jadwal, server-side constraint menghendaki null.
        schedule_id: affectsAll ? null : scheduleId,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <FormDialog
      busy={create.isPending}
      error={create.error ? create.error.message : null}
      onSubmit={onSubmit}
      submitLabel="Simpan Pengecualian"
    >
      <label className="block text-sm font-medium text-slate-700">
        Tanggal
        <input
          type="date"
          className={inputCls}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Tipe
        <select
          className={inputCls}
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          required
        >
          {EXCEPTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Keterangan (opsional)
        <input
          className={inputCls}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="mis. Hari Raya Natal"
        />
      </label>

      <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Berlaku untuk</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="affects"
            checked={affectsAll}
            onChange={() => setAffectsAll(true)}
            className="h-4 w-4"
          />
          Semua jadwal
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="affects"
            checked={!affectsAll}
            onChange={() => setAffectsAll(false)}
            disabled={schedules.length === 0}
            className="h-4 w-4"
          />
          Satu jadwal saja
        </label>
        {!affectsAll && (
          <label className="block text-sm font-medium text-slate-700">
            Pilih Jadwal
            <select
              className={inputCls}
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              required
            >
              <option value="" disabled>
                Pilih jadwal…
              </option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {scheduleLabel(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        {schedules.length === 0 && (
          <p className="text-xs text-slate-400">
            Belum ada jadwal — pengecualian hanya bisa berlaku untuk semua jadwal.
          </p>
        )}
      </fieldset>
      <p className="text-xs text-slate-400">
        Pengecualian menonaktifkan sesi absensi pada tanggal tersebut.
      </p>
    </FormDialog>
  );
}
