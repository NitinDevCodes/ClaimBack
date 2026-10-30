import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ErrorNotice, PageLoading } from './ui';

export function ProtectedRoute({ roles }) {
  const { user, loading, sessionError, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading />;
  if (sessionError) return <div className="container page-section"><ErrorNotice retry={refresh}>{sessionError}</ErrorNotice></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/account" replace />;
  return <Outlet />;
}
