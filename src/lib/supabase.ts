import { createClient } from '@supabase/supabase-js';

const BUILTIN_SUPABASE_URL = 'https://ovdjhdofjysanamgkfng.supabase.co';
const BUILTIN_SUPABASE_ANON_KEY = 'sb_publishable_UvP5c6ShzuoYDtnZppd1yA_3L_m13l0';

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabaseUrl = envSupabaseUrl || BUILTIN_SUPABASE_URL;
const supabaseAnonKey = envSupabaseAnonKey || BUILTIN_SUPABASE_ANON_KEY;
const missingEnvKeys = [
  !envSupabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !envSupabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter(Boolean) as string[];

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const hasExplicitSupabaseConfig = Boolean(envSupabaseUrl && envSupabaseAnonKey);
export const isUsingBuiltinSupabaseConfig = hasSupabaseConfig && missingEnvKeys.length > 0;
export const supabaseConfigIssue = hasSupabaseConfig
  ? null
  : 'Missing Supabase public config. Auth and sync are disabled.';

if (isUsingBuiltinSupabaseConfig) {
  console.warn(
    `[Supabase] Missing ${missingEnvKeys.join(', ')} in deployment env. Falling back to built-in public client config.`
  );
}

if (!hasSupabaseConfig) {
  console.error('[Supabase] Public client config is unavailable.');
  console.error('[Supabase]', supabaseConfigIssue);
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: hasSupabaseConfig,
      autoRefreshToken: hasSupabaseConfig,
      detectSessionInUrl: hasSupabaseConfig
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          signal: init?.signal || undefined
        });
      }
    }
  }
);
