import { createClient } from '@supabase/supabase-js';
import { readRuntimeEnv } from '../utils/runtimeEnv.ts';

const DISABLED_SUPABASE_URL = 'https://disabled.invalid';
const DISABLED_SUPABASE_ANON_KEY = 'sb_publishable_disabled';

const envSupabaseUrl = readRuntimeEnv('VITE_SUPABASE_URL') || '';
const envSupabaseAnonKey = readRuntimeEnv('VITE_SUPABASE_ANON_KEY') || '';
const hasExplicitSupabaseConfig = Boolean(envSupabaseUrl && envSupabaseAnonKey);

const missingEnvKeys = [
  !envSupabaseUrl ? 'VITE_SUPABASE_URL' : null,
  !envSupabaseAnonKey ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter(Boolean) as string[];

const supabaseUrl = hasExplicitSupabaseConfig ? envSupabaseUrl : DISABLED_SUPABASE_URL;
const supabaseAnonKey = hasExplicitSupabaseConfig ? envSupabaseAnonKey : DISABLED_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = hasExplicitSupabaseConfig;
export const isUsingBuiltinSupabaseConfig = false;
export const supabaseConfigIssue = hasSupabaseConfig
  ? null
  : `Missing Supabase public config (${missingEnvKeys.join(', ')}). Auth and cloud sync are disabled.`;
export { supabaseUrl, supabaseAnonKey };

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
