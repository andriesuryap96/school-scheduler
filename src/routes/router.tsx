import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { RequireRole } from '@/auth/RequireRole';
import { useAuth } from '@/auth/useAuth';
import LoginPage from '@/auth/LoginPage';
import AdminPage from '@/features/admin/AdminPage';
import SchedulePage from '@/features/schedule/SchedulePage';
import ExceptionPage from '@/features/schedule/ExceptionPage';
import ReportsPage from '@/features/reports/ReportsPage';
import TodayPage from '@/features/attendance/TodayPage';
import ScanPage from '@/features/attendance/ScanPage';

/** Redirect `/` ke halaman pertama sesuai role. */
function HomeRedirect() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Memuat">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  switch (role) {
    case 'superadmin':
      return <Navigate to="/admin" replace />;
    case 'kepala_sekolah':
      return <Navigate to="/jadwal" replace />;
    case 'guru':
      return <Navigate to="/hari-ini" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <HomeRedirect />,
  },
  {
    path: '/admin',
    element: (
      <RequireRole allow={['superadmin']}>
        <AdminPage />
      </RequireRole>
    ),
  },
  {
    path: '/jadwal',
    element: (
      <RequireRole allow={['kepala_sekolah']}>
        <SchedulePage />
      </RequireRole>
    ),
  },
  {
    // Pengecualian jadwal (libur nasional, ulangan umum, event) —
    // satu tingkat dengan /jadwal, kepala_sekolah saja, di-link dari
    // header SchedulePage.
    path: '/pengecualian',
    element: (
      <RequireRole allow={['kepala_sekolah']}>
        <ExceptionPage />
      </RequireRole>
    ),
  },
  {
    path: '/laporan',
    element: (
      <RequireRole allow={['kepala_sekolah']}>
        <ReportsPage />
      </RequireRole>
    ),
  },
  {
    path: '/hari-ini',
    element: (
      <RequireRole allow={['guru']}>
        <TodayPage />
      </RequireRole>
    ),
  },
  {
    path: '/absen/:token',
    element: (
      <RequireRole allow={['guru']}>
        <ScanPage />
      </RequireRole>
    ),
  },
];

export const router = createBrowserRouter(routes);
