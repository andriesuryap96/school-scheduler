import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { queryKeys } from '@/features/admin/queries';
import { supabase } from '@/lib/supabase';

interface SchoolFormProps {
  onDone: () => void;
}

interface CreateSchoolInput {
  name: string;
  address: string | null;
  timezone_offset_minutes: number;
}

async function createSchool(input: CreateSchoolInput): Promise<void> {
  const { error } = await supabase.from('schools').insert(input);
  if (error) throw error;
}

/** Form tambah sekolah (sheet). Timezone default WIB (+420). */
export function SchoolForm({ onDone }: SchoolFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schools });
      onDone();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate({
      name,
      address: address.trim() || null,
      timezone_offset_minutes: 420, // WIB (UTC+7)
    });
  };

  return (
    <FormDialog
      busy={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      onSubmit={onSubmit}
      submitLabel="Simpan Sekolah"
    >
      <label className="block text-sm font-medium text-slate-700">
        Nama Sekolah
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="SMA Negeri 1 Contoh"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Alamat (opsional)
        <input
          className={inputCls}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Jl. Pendidikan No. 1"
        />
      </label>
      <p className="text-xs text-slate-500">
        Zona waktu otomatis WIB (UTC+7) sesuai kebutuhan saat ini.
      </p>
    </FormDialog>
  );
}
