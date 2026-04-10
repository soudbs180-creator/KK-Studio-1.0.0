import { Route, Routes } from 'react-router-dom';

import { AdminAuthProvider } from '../context/AdminAuthContext';
import AdminShell from '../components/layout/AdminShell';
import AdminProvidersPage from '../pages/AdminProvidersPage';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import ExchangeRatesPage from '../pages/ExchangeRatesPage';
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
            <Route path="/exchange-rates" element={<ExchangeRatesPage />} />
            <Route path="/providers" element={<AdminProvidersPage />} />
          </Route>
        </Route>
      </Routes>
    </AdminAuthProvider>
  );
}
