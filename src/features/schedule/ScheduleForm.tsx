import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { useCreateSchedule, useUpdateSchedule, DAY_NAMES, WEEK_ORDER } from './queries';
import type { ScheduleInput, ScheduleRow } from './queries';

interface ScheduleFormProps {
  academicYearId: string;
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  /** Jadwal yang diedit; undefined = tambah baru. */
  editing?: ScheduleRow | null;
  onDone: () => void;
}

/** Form tambah/ubah jadwal (sheet): guru, kelas, mapel, hari, jam mulai/selesai. */
export function ScheduleForm({
  academicYearId,
  teachers,
  classes,
  subjects,
  editing,
  onDone,
}: ScheduleFormProps) {
  const [teacherId, setTeacherId] = useState(editing?.teacher_id ?? '');
  const [classId, setClassId] = useState(editing?.class_id ?? '');
  const [subjectId, setSubjectId] = useState(editing?.subject_id ?? '');
  // Senin (1) sebagai default — hari pertama sekolah di Indonesia.
  const [day, setDay] = useState(editing ? String(editing.day_of_week) : '1');
  const [startTime, setStartTime] = useState(editing?.start_time.slice(0, 5) ?? '');
  const [endTime, setEndTime] = useState(editing?.end_time.slice(0, 5) ?? '');

  const create = useCreateSchedule(academicYearId);
  const update = useUpdateSchedule(academicYearId);
  const mutation = editing ? update : create;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: ScheduleInput = {
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
      academic_year_id: academicYearId,
    };
    if (editing) {
      update.mutate({ id: editing.id, input }, { onSuccess: onDone });
    } else {
      create.mutate(input, { onSuccess: onDone });
    }
  };

  return (
    <FormDialog
      busy={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      onSubmit={onSubmit}
      submitLabel={editing ? 'Simpan Perubahan' : 'Simpan Jadwal'}
    >
      <label className="block text-sm font-medium text-slate-700">
        Guru
        <select
          className={inputCls}
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          required
        >
          <option value="" disabled>
            Pilih guru…
          </option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Kelas
        <select
          className={inputCls}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          required
        >
          <option value="" disabled>
            Pilih kelas…
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Mata Pelajaran
        <select
          className={inputCls}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
        >
          <option value="" disabled>
            Pilih mata pelajaran…
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Hari
        <select className={inputCls} value={day} onChange={(e) => setDay(e.target.value)} required>
          {WEEK_ORDER.map((d) => (
            <option key={d} value={String(d)}>
              {DAY_NAMES[d]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Jam Mulai
          <input
            type="time"
            className={inputCls}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Jam Selesai
          <input
            type="time"
            className={inputCls}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
      </div>
    </FormDialog>
  );
}
