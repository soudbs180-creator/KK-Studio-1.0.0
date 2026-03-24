import { env } from "../../../../packages/shared/src/index.ts";

export interface ServerSupabaseConfig {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  authKey?: string;
  userApiEncryptionSecret?: string;
  usingPublicUrlFallback: boolean;
}

export function resolveServerSupabaseConfig(): ServerSupabaseConfig {
  const explicitSupabaseUrl = env.get("SUPABASE_URL");
  const fallbackSupabaseUrl = env.get("VITE_SUPABASE_URL");
  const serviceRoleKey = env.get("SUPABASE_SERVICE_ROLE_KEY") || env.get("SUPABASE_SECRET_KEY");
  const authKey = serviceRoleKey || env.get("SUPABASE_ANON_KEY") || env.get("VITE_SUPABASE_ANON_KEY");
  const userApiEncryptionSecret =
    env.get("USER_API_ENCRYPTION_SECRET")
    || env.get("PROFILE_USER_APIS_ENCRYPTION_SECRET")
    || serviceRoleKey;

  return {
    supabaseUrl: explicitSupabaseUrl || fallbackSupabaseUrl,
    serviceRoleKey,
    authKey,
    userApiEncryptionSecret,
    usingPublicUrlFallback: !explicitSupabaseUrl && Boolean(fallbackSupabaseUrl),
  };
}

export function summarizeServerSupabaseConfig(config: ServerSupabaseConfig) {
  return {
    hasSupabaseUrl: Boolean(config.supabaseUrl),
    hasServiceRoleKey: Boolean(config.serviceRoleKey),
    hasAuthKey: Boolean(config.authKey),
    hasUserApiEncryptionSecret: Boolean(config.userApiEncryptionSecret),
    usingPublicUrlFallback: config.usingPublicUrlFallback,
  };
}
