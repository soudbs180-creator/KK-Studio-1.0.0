import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { supabase } from '@/lib/supabase';

type CallbackStatus = 'processing' | 'success' | 'error';

const SESSION_POLL_INTERVAL_MS = 350;
const SESSION_POLL_ATTEMPTS = 18;

function parseHashParams(): URLSearchParams {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
}

function hasSessionHints(searchParams: URLSearchParams, hashParams: URLSearchParams): boolean {
  return (
    Boolean(searchParams.get('code')) ||
    Boolean(searchParams.get('token_hash')) ||
    Boolean(searchParams.get('type')) ||
    Boolean(hashParams.get('access_token')) ||
    Boolean(hashParams.get('refresh_token')) ||
    Boolean(hashParams.get('token_hash')) ||
    Boolean(hashParams.get('type'))
  );
}

function isWechatBindCallback(searchParams: URLSearchParams): boolean {
  return searchParams.get('mode') === 'wechat-bind' || Boolean(searchParams.get('wechat_bind'));
}

async function waitForSession(): Promise<boolean> {
  for (let attempt = 0; attempt < SESSION_POLL_ATTEMPTS; attempt += 1) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (session) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, SESSION_POLL_INTERVAL_MS));
  }

  return false;
}

export default function AuthCallback() {
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [message, setMessage] = useState('正在处理登录...');

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
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = parseHashParams();
        const bindFlow = isWechatBindCallback(searchParams);

        if (searchParams.get('wechat_bind') === 'success') {
          finishWithRedirect('success', '微信绑定成功。', 1200);
          return;
        }

        const error = searchParams.get('error') || hashParams.get('error');
        const errorDescription =
          searchParams.get('error_description') || hashParams.get('error_description');

        if (error) {
          finishWithRedirect(
            'error',
            errorDescription || (bindFlow ? '微信绑定失败，请稍后重试。' : '登录失败，请稍后重试。'),
            3000,
          );
          return;
        }

        const {
          data: { session: immediateSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (immediateSession) {
          finishWithRedirect('success', bindFlow ? '微信绑定成功。' : '登录成功。', 900);
          return;
        }

        if (bindFlow) {
          finishWithRedirect('error', '微信绑定回调无效，请重新发起绑定。', 3000);
          return;
        }

        if (!hasSessionHints(searchParams, hashParams)) {
          finishWithRedirect('error', '无效的登录回调链接。', 3000);
          return;
        }

        const didResolveSession = await waitForSession();
        if (!didResolveSession) {
          finishWithRedirect('error', '登录会话创建失败，请稍后重试。', 3000);
          return;
        }

        finishWithRedirect('success', '登录成功。', 900);
      } catch (error) {
        console.error('Auth callback error:', error);
        finishWithRedirect('error', '登录处理出错，请稍后重试。', 3000);
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
