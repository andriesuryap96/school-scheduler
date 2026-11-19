import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormDialog, inputCls } from '@/features/admin/FormDialog';
import { createUser, queryKeys } from '@/features/admin/queries';
import type { Role } from '@/domain/types';

interface UserFormProps {
  schoolId: string;
  onDone: () => void;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'guru', label: 'Guru' },
  { value: 'kepala_sekolah', label: 'Kepala Sekolah' },
  { value: 'superadmin', label: 'Super Admin' },
];

/**
 * Form baris tabel public.users. Pembuatan auth user TIDAK dari sini
 * (butuh service_role) — lihat instruksi di tab Guru pada AdminPage.
 * `id` harus sama dengan UUID user dari dashboard Supabase Authentication.
 */
export function UserForm({ schoolId, onDone }: UserFormProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('guru');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(schoolId) });
      onDone();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate({ id: id.trim(), school_id: schoolId, name, email, role });
  };

  return (
    <FormDialog
      busy={mutation.isPending}
      error={mutation.error ? mutation.error.message : null}
      onSubmit={onSubmit}
      submitLabel="Simpan Data Guru"
    >
      <label className="block text-sm font-medium text-slate-700">
        User ID (UUID dari Supabase Auth)
        <input
          className={inputCls}
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Nama
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Budi Santoso"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="budi@sekolah.id"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Peran
        <select
          className={inputCls}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-slate-500">
        Buat user-nya dulu lewat dashboard Supabase (Authentication → Add
        user), salin UUID-nya ke kolom User ID, lalu isi form ini.
      </p>
    </FormDialog>
  );
}
