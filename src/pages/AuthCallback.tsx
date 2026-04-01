import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  resolveBindCallbackProvider,
  resolveBindFailureMessage,
  resolveBindSuccessMessage,
} from '@/services/auth/identityLinking';

type CallbackStatus = 'processing' | 'success' | 'error';

const SESSION_FALLBACK_POLL_INTERVAL_MS = 1200;
const SESSION_FALLBACK_POLL_ATTEMPTS = 4;
const SESSION_WAIT_TIMEOUT_MS = 6500;

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

async function waitForSession(): Promise<boolean> {
  return await new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let fallbackAttempts = 0;
    let fallbackTimer: number | undefined;
    let timeoutTimer: number | undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        finish(true);
      }
    });

    function cleanup() {
      subscription.unsubscribe();
      if (typeof fallbackTimer === 'number') {
        window.clearTimeout(fallbackTimer);
      }
      if (typeof timeoutTimer === 'number') {
        window.clearTimeout(timeoutTimer);
      }
    }

    function finish(result: boolean) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    const pollForSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          fail(error);
          return;
        }

        if (session) {
          finish(true);
          return;
        }

        fallbackAttempts += 1;
        if (fallbackAttempts < SESSION_FALLBACK_POLL_ATTEMPTS) {
          fallbackTimer = window.setTimeout(() => {
            void pollForSession();
          }, SESSION_FALLBACK_POLL_INTERVAL_MS);
        }
      } catch (error) {
        fail(error);
      }
    };

    timeoutTimer = window.setTimeout(() => {
      finish(false);
    }, SESSION_WAIT_TIMEOUT_MS);

    fallbackTimer = window.setTimeout(() => {
      void pollForSession();
    }, SESSION_FALLBACK_POLL_INTERVAL_MS);
  });
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
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = parseHashParams();
      const bindProvider = resolveBindCallbackProvider(searchParams);
      const bindFlow = Boolean(bindProvider);

      try {
        if (searchParams.get('wechat_bind') === 'success') {
          finishWithRedirect('success', resolveBindSuccessMessage(bindProvider), 1200);
          return;
        }

        const error = searchParams.get('error') || hashParams.get('error');
        const errorDescription =
          searchParams.get('error_description') || hashParams.get('error_description');

        if (error) {
          finishWithRedirect(
            'error',
            errorDescription || (bindFlow ? resolveBindFailureMessage(bindProvider) : '登录失败，请稍后重试。'),
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
          finishWithRedirect(
            'success',
            bindFlow ? resolveBindSuccessMessage(bindProvider) : '登录成功。',
            900,
          );
          return;
        }

        if (!hasSessionHints(searchParams, hashParams)) {
          finishWithRedirect(
            'error',
            bindFlow ? resolveBindFailureMessage(bindProvider) : '无效的登录回调链接。',
            3000,
          );
          return;
        }

        const didResolveSession = await waitForSession();
        if (!didResolveSession) {
          finishWithRedirect(
            'error',
            bindFlow ? resolveBindFailureMessage(bindProvider) : '登录会话创建失败，请稍后重试。',
            3000,
          );
          return;
        }

        finishWithRedirect(
          'success',
          bindFlow ? resolveBindSuccessMessage(bindProvider) : '登录成功。',
          900,
        );
      } catch (error) {
        console.error('Auth callback error:', error);
        finishWithRedirect(
          'error',
          bindFlow ? resolveBindFailureMessage(bindProvider) : '登录处理出错，请稍后重试。',
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
