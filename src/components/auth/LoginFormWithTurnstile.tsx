import React, { useState } from 'react';

import { legacyWebApiClient, setKkApiAccessToken } from '../../services/api/kkApiClient';
import { notify } from '../../services/system/notificationService';
import { TurnstileWidget, useTurnstile } from './TurnstileWidget';

interface LoginFormProps {
  onLogin?: (credentials: { email: string; password: string }) => void;
}

export const LoginFormWithTurnstile: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    token: turnstileToken,
    isVerified,
    error: turnstileError,
    handleVerify,
    handleError,
    handleExpire,
    reset: resetTurnstile,
  } = useTurnstile();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      notify.error('缺少登录信息', '请输入邮箱和密码。');
      return;
    }

    if (!isVerified || !turnstileToken) {
      notify.error('请先完成人机验证', '验证通过后才能继续登录。');
      return;
    }

    setIsLoading(true);

    try {
      const response = await legacyWebApiClient.login({
        email,
        password,
        turnstileToken,
      });

      if (response.success) {
        setKkApiAccessToken(response.data.accessToken);
        notify.success('登录成功', '欢迎回来。');
        onLogin?.({ email, password });
        return;
      }

      notify.error('登录失败', response.error.message || '请检查账号和密码。');
      resetTurnstile();
    } catch (error: any) {
      notify.error('登录失败', error?.message || '网络异常，请稍后重试。');
      resetTurnstile();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 p-6">
      <h2 className="text-center text-xl font-bold">登录</h2>

      <div>
        <label className="mb-1 block text-sm font-medium">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">密码</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="py-2">
        <TurnstileWidget
          onVerify={handleVerify}
          onError={handleError}
          onExpire={handleExpire}
          theme="auto"
        />
        {turnstileError && (
          <p className="mt-1 text-sm text-red-500">{turnstileError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isVerified || isLoading}
        className={`w-full rounded-lg py-2 font-medium transition-colors ${
          isVerified && !isLoading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'cursor-not-allowed bg-gray-300 text-gray-500'
        }`}
      >
        {isLoading ? '登录中...' : '登录'}
      </button>

      <p className="text-center text-xs text-gray-500">
        当前登录请求会通过 Cloudflare Turnstile 做风险校验。
      </p>
    </form>
  );
};

export default LoginFormWithTurnstile;
