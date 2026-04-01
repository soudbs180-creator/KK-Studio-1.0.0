import { env } from "../../../../packages/shared/src/index.ts";

export interface ServerSupabaseConfig {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  authKey?: string;
  userApiEncryptionSecret?: string;
  usingPublicUrlFallback: boolean;
}

const obviousPlaceholderPatterns = [
  /^replace-with-/i,
  /^your[-_]/i,
  /^changeme$/i,
  /^todo$/i,
  /^你的/i,
  /^请填写/i,
];

function normalizeOptionalEnvValue(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized ? normalized : undefined;
}

function isObviousPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return obviousPlaceholderPatterns.some((pattern) => pattern.test(value));
}

function resolveServiceRoleKey(): string | undefined {
  const serviceRoleKey =
    normalizeOptionalEnvValue(env.get("SUPABASE_SERVICE_ROLE_KEY"))
    || normalizeOptionalEnvValue(env.get("SUPABASE_SECRET_KEY"));

  if (!serviceRoleKey || isObviousPlaceholder(serviceRoleKey)) {
    return undefined;
  }

  return serviceRoleKey;
}

export function resolveServerSupabaseConfig(): ServerSupabaseConfig {
  const explicitSupabaseUrl = normalizeOptionalEnvValue(env.get("SUPABASE_URL"));
  const fallbackSupabaseUrl = normalizeOptionalEnvValue(env.get("VITE_SUPABASE_URL"));
  const serviceRoleKey = resolveServiceRoleKey();
  const authKey =
    serviceRoleKey
    || normalizeOptionalEnvValue(env.get("SUPABASE_ANON_KEY"))
    || normalizeOptionalEnvValue(env.get("VITE_SUPABASE_ANON_KEY"));
  const userApiEncryptionSecret =
    normalizeOptionalEnvValue(env.get("USER_API_ENCRYPTION_SECRET"))
    || normalizeOptionalEnvValue(env.get("PROFILE_USER_APIS_ENCRYPTION_SECRET"));

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
