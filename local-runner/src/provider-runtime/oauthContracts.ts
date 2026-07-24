import { z } from 'zod';

export const PROVIDER_OAUTH_PROVIDERS = [
  'codex',
  'claude',
  'antigravity',
  'xai',
  'kimi',
] as const;

export const ProviderOAuthProviderSchema = z.enum(PROVIDER_OAUTH_PROVIDERS);

export const ProviderOAuthSessionStatusSchema = z.enum([
  'not_installed',
  'disabled',
  'ready',
  'login_required',
  'connected',
  'expired',
  'error',
]);

export const ProviderOAuthSessionSchema = z.object({
  provider: ProviderOAuthProviderSchema,
  status: ProviderOAuthSessionStatusSchema,
}).strict();

export const ProviderOAuthSessionListSchema = z.array(ProviderOAuthSessionSchema)
  .max(PROVIDER_OAUTH_PROVIDERS.length);

export const ProviderOAuthDisconnectSchema = z.object({
  provider: ProviderOAuthProviderSchema,
}).strict();

export type ProviderOAuthProvider = z.infer<typeof ProviderOAuthProviderSchema>;
export type ProviderOAuthSession = z.infer<typeof ProviderOAuthSessionSchema>;
