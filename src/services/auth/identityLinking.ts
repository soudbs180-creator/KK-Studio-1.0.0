import type { User } from '@supabase/supabase-js';
import { resolveAuthRedirectOrigin } from '../../config/authRedirect.ts';

export type BindableAuthProvider = 'google' | 'wechat';
export type BindCallbackMode = `${BindableAuthProvider}-bind`;

type IdentityLike = {
  provider?: string | null;
};

function resolveBrowserOrigin(): string {
  return resolveAuthRedirectOrigin();
}

function normalizeProviderName(provider: unknown): string | undefined {
  if (typeof provider !== 'string') {
    return undefined;
  }

  const normalized = provider.trim().toLowerCase();
  return normalized || undefined;
}

async function getSupabaseClient() {
  const module = await import('../../lib/supabase.ts');
  return module.supabase;
}

export function buildBindCallbackUrl(
  provider: BindableAuthProvider,
  origin = resolveBrowserOrigin(),
): string {
  const callbackUrl = new URL('/auth/callback', origin);
  callbackUrl.searchParams.set('mode', `${provider}-bind`);
  return callbackUrl.toString();
}

export function collectLinkedAuthProviders(
  user?: Pick<User, 'app_metadata' | 'identities'> | null,
  identities?: IdentityLike[] | null,
): string[] {
  const providers = [
    ...((user?.app_metadata?.providers as string[] | undefined) || []),
    user?.app_metadata?.provider,
    ...(user?.identities?.map((identity) => identity.provider) || []),
    ...((identities || []).map((identity) => identity.provider)),
  ]
    .map(normalizeProviderName)
    .filter((provider): provider is string => Boolean(provider));

  return Array.from(new Set(providers));
}

export function resolveBindCallbackProvider(
  searchParams: URLSearchParams,
): BindableAuthProvider | undefined {
  if (searchParams.get('wechat_bind') === 'success') {
    return 'wechat';
  }

  const mode = searchParams.get('mode');
  if (mode === 'google-bind') {
    return 'google';
  }

  if (mode === 'wechat-bind') {
    return 'wechat';
  }

  return undefined;
}

export function resolveBindSuccessMessage(
  provider?: BindableAuthProvider,
): string {
  if (provider === 'google') {
    return 'Google 绑定成功。';
  }

  if (provider === 'wechat') {
    return '微信绑定成功。';
  }

  return '账号绑定成功。';
}

export function resolveBindFailureMessage(
  provider?: BindableAuthProvider,
): string {
  if (provider === 'google') {
    return 'Google 绑定失败，请稍后重试。';
  }

  if (provider === 'wechat') {
    return '微信绑定失败，请稍后重试。';
  }

  return '账号绑定失败，请稍后重试。';
}

export async function startGoogleBind(): Promise<string> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: buildBindCallbackUrl('google'),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url || typeof data.url !== 'string') {
    throw new Error('Google 绑定未返回授权地址，请稍后重试。');
  }

  return data.url;
}

export async function listLinkedAuthProviders(): Promise<string[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.getUserIdentities();

  if (error) {
    throw error;
  }

  return collectLinkedAuthProviders(undefined, data?.identities || []);
}
