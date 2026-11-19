import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { useCreateSubject } from '@/features/admin/queries';

interface SubjectFormProps {
  schoolId: string;
  onDone: () => void;
}

/** Form tambah mata pelajaran (sheet). */
export function SubjectForm({ schoolId, onDone }: SubjectFormProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const mutation = useCreateSubject(schoolId);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate(
      { school_id: schoolId, name, code: code.trim() || null },
      { onSuccess: onDone },
    );
  };

  return (
    <FormDialog
      busy={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      onSubmit={onSubmit}
      submitLabel="Simpan Mata Pelajaran"
    >
      <label className="block text-sm font-medium text-slate-700">
        Nama Mata Pelajaran
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Matematika"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Kode (opsional)
        <input
          className={inputCls}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="MTK"
        />
      </label>
    </FormDialog>
  );
}
