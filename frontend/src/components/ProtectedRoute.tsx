import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

export const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null; // The AuthProvider handles loading state overlay
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
