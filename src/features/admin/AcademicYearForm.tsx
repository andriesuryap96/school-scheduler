import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { useCreateAcademicYear } from '@/features/admin/queries';

interface AcademicYearFormProps {
  schoolId: string;
  onDone: () => void;
}

/** Form tambah tahun ajaran (sheet). is_active selalu false saat dibuat. */
export function AcademicYearForm({ schoolId, onDone }: AcademicYearFormProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const mutation = useCreateAcademicYear(schoolId);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(
      { school_id: schoolId, name, start_date: startDate, end_date: endDate },
      { onSuccess: onDone },
    );
  };

  return (
    <FormDialog
      busy={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      onSubmit={onSubmit}
      submitLabel="Simpan Tahun Ajaran"
    >
      <label className="block text-sm font-medium text-slate-700">
        Nama (mis. 2025/2026)
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="2025/2026"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Tanggal Mulai
        <input
          type="date"
          className={inputCls}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Tanggal Selesai
        <input
          type="date"
          className={inputCls}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
      </label>
      <p className="text-xs text-slate-500">
        Tahun ajaran baru dibuat tidak aktif. Aktifkan lewat tombol
        &quot;Aktifkan&quot; pada daftar.
      </p>
    </FormDialog>
  );
}
