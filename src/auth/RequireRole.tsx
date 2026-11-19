import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@/domain/types';
import { useAuth } from '@/auth/useAuth';

interface RequireRoleProps {
  allow: Role[];
  children: ReactNode;
}

export function RequireRole({ allow, children }: RequireRoleProps) {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Memuat">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  if (!role || !allow.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
