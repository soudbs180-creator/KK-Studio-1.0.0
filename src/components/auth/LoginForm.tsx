import React, { useState } from 'react';
import { ArrowRight, Loader2, Lock, Mail, Shield } from 'lucide-react';

import type { LoginResponseDto } from '../../../packages/contracts/src/dto/auth.ts';
import { legacyWebApiClient, setKkApiAccessToken } from '../../services/api/kkApiClient';
import { notify } from '../../services/system/notificationService';
import { useLocale } from '../../context/LocaleContext';
import { TurnstileWidget, useTurnstile } from './TurnstileWidget';

interface LoginFormProps {
  onSuccess?: (session: LoginResponseDto) => void;
  onRegisterClick?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onRegisterClick,
}) => {
  const { pick } = useLocale();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const {
    token: turnstileToken,
    isVerified,
    error: turnstileError,
    handleVerify,
    handleError,
    handleExpire,
    reset: resetTurnstile,
  } = useTurnstile();

  const requiresTurnstile = showTurnstile || failedAttempts >= 2;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.email || !formData.password) {
      notify.error('请填写账号信息', '邮箱和密码不能为空。');
      return;
    }

    if (requiresTurnstile && (!isVerified || !turnstileToken)) {
      setShowTurnstile(true);
      notify.error('请先完成安全验证', '连续失败后需要先通过 Turnstile 验证。');
      return;
    }

    setIsLoading(true);

    try {
      const response = await legacyWebApiClient.login({
        email: formData.email,
        password: formData.password,
        ...(turnstileToken ? { turnstileToken } : {}),
      });

      if (response.success) {
        setKkApiAccessToken(response.data.accessToken);
        setFailedAttempts(0);
        setShowTurnstile(false);
        notify.success('登录成功', '欢迎回来。');
        onSuccess?.(response.data);
        return;
      }

      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setShowTurnstile(nextAttempts >= 2);
      resetTurnstile();
      notify.error('登录失败', response.error.message || '请检查账号和密码。');
    } catch (error: any) {
      notify.error('登录失败', error?.message || '网络异常，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">欢迎回来</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          登录你的 KK Studio 账号
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            邮箱地址
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={pick('请输入邮箱地址', 'Enter your email')}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-gray-900 transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="输入密码"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-gray-900 transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              required
            />
          </div>
        </div>

        {requiresTurnstile && (
          <div className="animate-fadeIn py-3">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-600">
                检测到多次尝试，请先完成安全验证
              </span>
            </div>
            <TurnstileWidget
              onVerify={handleVerify}
              onError={handleError}
              onExpire={handleExpire}
              theme="auto"
            />
            {turnstileError && (
              <p className="mt-2 text-sm text-red-500">{turnstileError}</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">记住我</span>
          </label>
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={() =>
              notify.info(
                '找回密码',
                '请联系管理员，或接入后续 reset-password 流程。',
              )
            }
          >
            忘记密码？
          </button>
        </div>

        <button
          type="submit"
          disabled={isLoading || (requiresTurnstile && !isVerified)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              登录中...
            </>
          ) : (
            <>
              登录
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
        还没有账号？
        <button
          type="button"
          onClick={onRegisterClick}
          className="ml-1 font-medium text-blue-600 hover:underline"
        >
          立即注册
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
