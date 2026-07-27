import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { setStoredKkApiAccessToken, setStoredKkApiRefreshToken } from '@/services/api/authAccessToken';
import { kkWebApiClient } from '@/services/api/kkApiClient';
import { emitAuthSessionChange } from '@/services/auth/authSessionEvents';
import { restoreHostedSessionFromServer } from '@/services/auth/kkApiSessionBootstrap.ts';
import {
  resolveBindCallbackProvider,
  resolveBindFailureMessage,
  resolveBindSuccessMessage,
} from '@/services/auth/identityLinking';
import {
  updateRuntimeAuthStateFromProfile,
  updateRuntimeUserMetadata,
} from '@/services/auth/runtimeAuthState';

type CallbackStatus = 'processing' | 'success' | 'error';

function parseHashParams(): URLSearchParams {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
}

async function hydrateRuntimeProfileFromHash(hashParams: URLSearchParams): Promise<boolean> {
  const accessToken = String(hashParams.get('access_token') || '').trim();
  const refreshToken = String(hashParams.get('refresh_token') || '').trim() || undefined;
  const provider = String(hashParams.get('provider') || '').trim().toLowerCase();
  if (!accessToken) {
    return false;
  }

  setStoredKkApiAccessToken(accessToken);
  setStoredKkApiRefreshToken(refreshToken);
  const response = await kkWebApiClient.getProfile({ accessToken });
  if (!response.success) {
    return false;
  }

  updateRuntimeAuthStateFromProfile(response.data);
  if (provider === 'google' || provider === 'wechat') {
    updateRuntimeUserMetadata({
      authProvider: provider,
      addProvider: provider,
    });
  }
  emitAuthSessionChange({
    hasSession: true,
    userId: response.data.id,
    accessToken,
    refreshToken,
    isTempUser: false,
  });
  return true;
}

export default function AuthCallback() {
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('正在处理认证回调...');

  useEffect(() => {
    let active = true;
    let redirectTimer: number | undefined;

    const finishWithRedirect = (
      nextStatus: CallbackStatus,
      nextMessage: string,
      delayMs: number,
      redirectTo = '/',
    ) => {
      if (!active) return;

      setStatus(nextStatus);
      setMessage(nextMessage);

      redirectTimer = window.setTimeout(() => {
        if (active) {
          window.location.href = redirectTo;
        }
      }, delayMs);
    };

    const handleCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = parseHashParams();
      const bindProvider = resolveBindCallbackProvider(searchParams);
      const bindFlow = Boolean(bindProvider);
      const callbackProvider = String(searchParams.get('provider') || '').trim().toLowerCase();

      try {
        if (searchParams.get('wechat_bind') === 'success') {
          updateRuntimeUserMetadata({ authProvider: 'wechat', addProvider: 'wechat' });
          finishWithRedirect('success', resolveBindSuccessMessage(bindProvider), 1200);
          return;
        }

        const error = searchParams.get('error') || hashParams.get('error');
        const errorDescription =
          searchParams.get('error_description') || hashParams.get('error_description');

        if (error) {
          finishWithRedirect(
            'error',
            errorDescription || (bindFlow ? resolveBindFailureMessage(bindProvider) : '认证回调失败，请稍后重试。'),
            3000,
          );
          return;
        }

        const hydratedFromHash = await hydrateRuntimeProfileFromHash(hashParams);
        if (hydratedFromHash) {
          finishWithRedirect(
            'success',
            bindFlow ? resolveBindSuccessMessage(bindProvider) : '认证回调已完成，已切换到 KK API 本地运行时会话。',
            1200,
          );
          return;
        }

        const restoredHostedSession = await restoreHostedSessionFromServer();
        if (restoredHostedSession) {
          if (callbackProvider === 'google' || callbackProvider === 'wechat') {
            updateRuntimeUserMetadata({
              authProvider: callbackProvider,
              addProvider: callbackProvider,
            });
          }
          finishWithRedirect(
            'success',
            bindFlow ? resolveBindSuccessMessage(bindProvider) : 'Authentication callback completed and the VPS session was restored.',
            1200,
          );
          return;
        }

        if (searchParams.get('code')) {
          finishWithRedirect(
            'error',
            bindFlow
              ? resolveBindFailureMessage(bindProvider)
              : '认证回调已收到，但当前 KK API 需要由服务器端完成授权码交换。',
            3200,
          );
          return;
        }

        if (searchParams.get('auth') === 'success') {
          finishWithRedirect(
            'error',
            bindFlow
              ? resolveBindFailureMessage(bindProvider)
              : '登录已完成，但无法恢复服务器会话，请确认浏览器允许站点 Cookie 后重试。',
            3200,
          );
          return;
        }

        finishWithRedirect(
          'success',
          bindFlow
            ? resolveBindSuccessMessage(bindProvider)
            : '当前回调没有携带可继续处理的会话信息，已返回工作区。',
          1200,
        );
      } catch (error) {
        console.error('Auth callback error:', error);
        finishWithRedirect(
          'error',
          bindFlow ? resolveBindFailureMessage(bindProvider) : '认证回调处理出错，请稍后重试。',
          3000,
        );
      }
    };

    void handleCallback();

    return () => {
      active = false;
      if (typeof redirectTimer === 'number') {
        window.clearTimeout(redirectTimer);
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f]">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <Loader2 size={48} className="mx-auto mb-4 animate-spin text-blue-400" />
            <p className="text-lg text-white">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
            <p className="text-lg text-white">{message}</p>
            <p className="mt-2 text-sm text-gray-400">正在跳转...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-400" />
            <p className="text-lg text-white">{message}</p>
            <p className="mt-2 text-sm text-gray-400">即将返回首页...</p>
          </>
        )}
      </div>
    </div>
  );
}
