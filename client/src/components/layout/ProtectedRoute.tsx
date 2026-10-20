import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'CUSTOMER' ? '/dashboard' : '/admin'} replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (user) return <Navigate to={user.role === 'CUSTOMER' ? '/dashboard' : '/admin'} replace />;
  return <Outlet />;
}
