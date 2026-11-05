import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../hooks/useAuth';
import { PageLoader } from './ui';

/** Only lets users with `role` through; everyone else goes to the matching login page. */
export default function ProtectedRoute({ role }) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) return <PageLoader label="Checking your session…" />;

  if (!me) {
    return <Navigate to={role === 'ADMIN' ? '/admin/login' : '/login'} replace state={{ from: location.pathname }} />;
  }
  if (me.role !== role) {
    // Logged in with the other role — send them to their own dashboard
    return <Navigate to={me.role === 'ADMIN' ? '/admin' : '/tasks'} replace />;
  }
  return <Outlet />;
}
