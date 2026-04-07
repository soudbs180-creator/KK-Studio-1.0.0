import { supabase } from '../../lib/supabase.ts';
import { readRuntimeOrigin } from '../../utils/runtimeEnv.ts';
import { shouldUseLegacyWebApiFallback } from '../api/kkApiClient.ts';

const PASSWORD_SIGN_IN_PROXY_PATH = '/api/auth-password-login';
export const HOSTED_PASSWORD_PROXY_DISABLED_CODE = 'HOSTED_PASSWORD_PROXY_DISABLED';
export const HOSTED_PASSWORD_PROXY_DISABLED_MESSAGE =
  'Hosted runtime does not allow the legacy password-login proxy fallback. Check Supabase Auth reachability and hosted environment alignment.';

export type PasswordSignInParams = {
  email: string;
  password: string;
  captchaToken?: string;
};

export type PasswordSignInResult = {
  error: Error | null;
  usedProxy: boolean;
};

type PasswordSignInProxyPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  error?: unknown;
  msg?: unknown;
  message?: unknown;
};

function isNetworkErrorLike(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return [
    'failed to fetch',
    'fetch failed',
    'load failed',
    'network',
    'network request failed',
    'timeout',
    'timed out',
    'offline',
  ].some((fragment) => message.includes(fragment));
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const message = String((error as { message?: string })?.message || error || 'Unknown auth error');
  return new Error(message);
}

function canUseHostedPasswordProxy(): boolean {
  const origin = readRuntimeOrigin();
  if (!origin) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && shouldUseLegacyWebApiFallback();
  } catch {
    return false;
  }
}

function buildPasswordSignInPayload(params: PasswordSignInParams) {
  return {
    email: params.email,
    password: params.password,
    ...(params.captchaToken ? { options: { captchaToken: params.captchaToken } } : {}),
  };
}

async function signInDirect(params: PasswordSignInParams): Promise<PasswordSignInResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword(buildPasswordSignInPayload(params));
    return {
      error: error ? toError(error) : null,
      usedProxy: false,
    };
  } catch (error) {
    return {
      error: toError(error),
      usedProxy: false,
    };
  }
}

async function readProxyPayload(response: Response): Promise<PasswordSignInProxyPayload> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText) as PasswordSignInProxyPayload;
  } catch {
    return { message: rawText };
  }
}

function resolveProxyErrorMessage(payload: PasswordSignInProxyPayload, status: number): string {
  const message = [payload.error, payload.msg, payload.message]
    .map((value) => String(value || '').trim())
    .find(Boolean);

  return message || `Password sign-in proxy failed (${status}).`;
}

async function signInViaHostedProxy(params: PasswordSignInParams): Promise<PasswordSignInResult> {
  try {
    const response = await fetch(PASSWORD_SIGN_IN_PROXY_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        ...(params.captchaToken ? { captchaToken: params.captchaToken } : {}),
      }),
    });

    const payload = await readProxyPayload(response);
    if (!response.ok) {
      return {
        error: new Error(resolveProxyErrorMessage(payload, response.status)),
        usedProxy: true,
      };
    }

    const accessToken = String(payload.access_token || '').trim();
    const refreshToken = String(payload.refresh_token || '').trim();

    if (!accessToken || !refreshToken) {
      return {
        error: new Error('Password sign-in proxy returned an incomplete session.'),
        usedProxy: true,
      };
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return {
      error: error ? toError(error) : null,
      usedProxy: true,
    };
  } catch (error) {
    return {
      error: toError(error),
      usedProxy: true,
    };
  }
}

export async function signInWithPasswordWithFallback(
  params: PasswordSignInParams,
): Promise<PasswordSignInResult> {
  const directResult = await signInDirect(params);
  if (!directResult.error) {
    return directResult;
  }

  if (!isNetworkErrorLike(directResult.error)) {
    return directResult;
  }

  if (!canUseHostedPasswordProxy()) {
    return {
      error: new Error(`${HOSTED_PASSWORD_PROXY_DISABLED_CODE}: ${HOSTED_PASSWORD_PROXY_DISABLED_MESSAGE}`),
      usedProxy: false,
    };
  }

  const proxyResult = await signInViaHostedProxy(params);
  if (proxyResult.error && isNetworkErrorLike(proxyResult.error)) {
    return directResult;
  }

  return proxyResult;
}
