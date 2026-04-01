import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { HttpError } from './http.ts';

export function createSupabaseFunctionClients(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new HttpError(500, 'Supabase function env vars are missing.');
  }

  const authHeader = req.headers.get('Authorization') || '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  return {
    userClient,
    serviceClient,
  };
}

export async function requireAuthenticatedUser(
  userClient: ReturnType<typeof createClient>,
) {
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new HttpError(401, 'Unauthorized');
  }

  return user;
}
