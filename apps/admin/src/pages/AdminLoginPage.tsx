import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import { useAdminAuth } from '../context/AdminAuthContext';

const LOGIN_CHECKPOINTS = [
  '账号权限校验',
  '管理员口令验证',
  '敏感操作审计',
];

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
    <main className="admin-login-page">
      <section className="admin-login-brand" aria-label="KK Studio 管理端">
        <div className="admin-login-mark" aria-hidden="true">
          <ShieldCheck size={28} strokeWidth={1.8} />
        </div>
        <p className="admin-login-kicker">KK Studio Admin</p>
        <h1>运营控制台</h1>
        <p className="admin-login-copy">
          管理模型路由、充值审核与用户积分。登录后所有高风险操作都会进入审计链路。
        </p>
        <div className="admin-login-checkpoints" aria-label="登录安全检查">
          {LOGIN_CHECKPOINTS.map((checkpoint) => (
            <span key={checkpoint}>
              <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
              {checkpoint}
            </span>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="admin-login-card">
        <div className="admin-login-card__header">
          <div>
            <p className="admin-login-eyebrow">Secure access</p>
            <h2>登录管理后台</h2>
          </div>
          <span className="admin-login-status">
            <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
            双重验证
          </span>
        </div>

        <div className="admin-login-form">
          <label className="admin-login-field" htmlFor="admin-login-email">
            <span>邮箱账号</span>
            <span className="admin-login-input">
              <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
              <input
                id="admin-login-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                type="email"
                autoComplete="email"
                aria-invalid={!!error}
              />
            </span>
          </label>

          <label className="admin-login-field" htmlFor="admin-login-password">
            <span>登录密码</span>
            <span className="admin-login-input">
              <LockKeyhole size={18} strokeWidth={1.8} aria-hidden="true" />
              <input
                id="admin-login-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入账号密码"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!error}
              />
            </span>
          </label>

          <label className="admin-login-field" htmlFor="admin-login-admin-password">
            <span>管理员口令</span>
            <span className="admin-login-input">
              <KeyRound size={18} strokeWidth={1.8} aria-hidden="true" />
              <input
                id="admin-login-admin-password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="输入管理员口令"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!error}
              />
            </span>
          </label>
        </div>

        {error ? (
          <p className="admin-login-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="admin-login-submit">
          <LogIn size={18} strokeWidth={1.8} aria-hidden="true" />
          登录管理后台
        </button>
      </form>
    </main>
  );
}
