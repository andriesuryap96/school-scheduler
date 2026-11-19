import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';

/** Pesan error login Supabase → teks Indonesia siap tampil. */
function loginErrorMessage(message: string): string {
  if (message === 'Invalid login credentials') {
    return 'Email atau password salah';
  }
  return `Gagal masuk: ${message}`;
}

/**
 * Halaman Login (/login): form email + kata sandi (mobile-first).
 * Setelah signIn sukses, HomeRedirect di router yang menangani navigasi —
 * di sini TIDAK ada kode navigasi.
 */
export default function LoginPage() {
  const { user, signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = loading || submitting;

  // Login sukses → user terisi → alihkan ke '/', HomeRedirect di router
  // yang kemudian mengarahkan sesuai role (per-role redirect).
  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(loginErrorMessage(err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Absensi Guru</h1>
        <h2 className="mt-4 text-lg font-medium">Masuk</h2>

        <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Kata Sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? 'Masuk…' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
