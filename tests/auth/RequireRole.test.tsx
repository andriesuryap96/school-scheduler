import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequireRole } from '@/auth/RequireRole';
import type { Role } from '@/domain/types';

// State auth yang di-mock; dimodifikasi per test.
const authState = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'guru@sekolah.id' } as unknown,
  role: 'guru' as Role | null,
  loading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => authState,
}));

function renderGuard(allow: Role[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireRole allow={allow}>
              <div>rahasia</div>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.user = { id: 'user-1', email: 'guru@sekolah.id' };
  authState.loading = false;
});

describe('RequireRole', () => {
  it('mengalihkan guru dari halaman admin', () => {
    authState.role = 'guru';
    renderGuard(['superadmin']);
    expect(screen.queryByText('rahasia')).not.toBeInTheDocument();
  });

  it('mengizinkan superadmin', () => {
    authState.role = 'superadmin';
    renderGuard(['superadmin']);
    expect(screen.getByText('rahasia')).toBeInTheDocument();
  });

  it('menampilkan spinner saat masih loading', () => {
    authState.role = 'superadmin';
    authState.loading = true;
    renderGuard(['superadmin']);
    expect(screen.queryByText('rahasia')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: /memuat/i })).toBeInTheDocument();
  });
});
