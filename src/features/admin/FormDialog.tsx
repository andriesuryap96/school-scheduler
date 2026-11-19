import type { FormEvent, ReactNode } from 'react';

interface FormDialogProps {
  busy?: boolean;
  error?: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel: string;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none';

export { inputCls };

/**
 * Kerangka form di dalam Sheet: label + field + tombol simpan +
 * pesan error. Semua form master data memakai kerangka ini.
 */
export function FormDialog({ busy, error, onSubmit, children, submitLabel }: FormDialogProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {children}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Menyimpan…' : submitLabel}
      </button>
    </form>
  );
}
