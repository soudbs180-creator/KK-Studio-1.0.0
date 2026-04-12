import { Navigate, Outlet } from 'react-router-dom';

import { useAdminAuth } from '../context/AdminAuthContext';

export function RequireAdminRoute() {
  const { isAuthorized } = useAdminAuth();

  return isAuthorized ? <Outlet /> : <Navigate to="/login" replace />;
}
