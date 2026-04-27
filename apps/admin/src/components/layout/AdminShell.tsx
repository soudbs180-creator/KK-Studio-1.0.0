import { Link, Outlet } from 'react-router-dom';

import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminShell() {
  const { signOut } = useAdminAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-shell__nav">
        <Link to="/">Dashboard</Link>
        <Link to="/exchange-rates">Exchange Rates</Link>
        <Link to="/providers">Providers</Link>
        <Link to="/recharge-submissions">Recharge Submissions</Link>
        <Link to="/users/credits">User Credits</Link>
        <button type="button" onClick={signOut}>Sign out</button>
      </aside>
      <main className="admin-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
