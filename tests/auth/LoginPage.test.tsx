import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '@/auth/LoginPage';

// State auth yang di-mock; signIn direset per test.
const authState = vi.hoisted(() => ({
  user: null,
  role: null,
  loading: false,
  signIn: vi.fn<(email: string, password: string) => Promise<void>>(),
  signOut: vi.fn(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => authState,
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.user = null;
  authState.role = null;
  authState.loading = false;
  authState.signIn.mockReset();
});

describe('LoginPage', () => {
  it('merender form login (email, kata sandi, tombol Masuk)', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/kata sandi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument();
  });

  it('memanggil signIn dengan email dan password yang dimasukkan', async () => {
    authState.signIn.mockResolvedValue(undefined);
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'guru@sekolah.id');
    await userEvent.type(screen.getByLabelText(/kata sandi/i), 'rahasia123');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    expect(authState.signIn).toHaveBeenCalledWith('guru@sekolah.id', 'rahasia123');
  });

  it('menampilkan pesan Indonesia "Email atau password salah" untuk kredensial salah', async () => {
    authState.signIn.mockRejectedValue(new Error('Invalid login credentials'));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'guru@sekolah.id');
    await userEvent.type(screen.getByLabelText(/kata sandi/i), 'salah');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email atau password salah');
  });

  it('menampilkan fallback "Gagal masuk: …" untuk error lain', async () => {
    authState.signIn.mockRejectedValue(new Error('Network request failed'));
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'guru@sekolah.id');
    await userEvent.type(screen.getByLabelText(/kata sandi/i), 'rahasia123');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gagal masuk: Network request failed');
  });
});
