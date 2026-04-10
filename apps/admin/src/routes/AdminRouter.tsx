import { Route, Routes } from 'react-router-dom';

import { AdminAuthProvider } from '../context/AdminAuthContext';
import AdminShell from '../components/layout/AdminShell';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import AdminLoginPage from '../pages/AdminLoginPage';
import { RequireAdminRoute } from './RequireAdminRoute';

export default function AdminRouter() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdminRoute />}>
          <Route element={<AdminShell />}>
            <Route path="/" element={<AdminDashboardPage />} />
          </Route>
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
