import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { useCreateClass } from '@/features/admin/queries';

interface ClassFormProps {
  schoolId: string;
  onDone: () => void;
}

/** Form tambah kelas (sheet). */
export function ClassForm({ schoolId, onDone }: ClassFormProps) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const mutation = useCreateClass(schoolId);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(
      { school_id: schoolId, name, level: level ? Number(level) : null },
      { onSuccess: onDone },
    );
  };

  return (
    <FormDialog
      busy={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      onSubmit={onSubmit}
      submitLabel="Simpan Kelas"
    >
      <label className="block text-sm font-medium text-slate-700">
        Nama Kelas
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="X IPA 1"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Tingkat (opsional, angka)
        <input
          type="number"
          min={1}
          max={13}
          className={inputCls}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          placeholder="10"
        />
      </label>
    </FormDialog>
  );
}
