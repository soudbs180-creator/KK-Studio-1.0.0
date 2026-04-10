import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLoginPage() {
  const { isAuthorized, signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isAuthorized) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await signIn({ email, password, adminPassword });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Admin login failed.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-login-card">
      <h1>KK Studio Admin</h1>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
      />
      <input
        value={adminPassword}
        onChange={(event) => setAdminPassword(event.target.value)}
        placeholder="Admin password"
        type="password"
      />
      {error ? <p>{error}</p> : null}
      <button type="submit">Sign in</button>
    </form>
  );
}
