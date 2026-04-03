export const config = { runtime: 'edge' };

type PasswordLoginRequest = {
  email?: unknown;
  password?: unknown;
  captchaToken?: unknown;
};

const jsonResponse = (body: Record<string, unknown>, status: number, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(headers || {}),
    },
  });

const readEnv = (...names: string[]) => {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
};

const parseBody = async (request: Request): Promise<PasswordLoginRequest> => {
  try {
    return (await request.json()) as PasswordLoginRequest;
  } catch {
    throw new Error('Invalid JSON payload.');
  }
};

const normalizeOrigin = (value: string | null | undefined) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

const resolveCorsHeaders = (request: Request) => {
  const requestOrigin = normalizeOrigin(request.url);
  const callerOrigin = normalizeOrigin(request.headers.get('origin'));
  const configuredOrigin = normalizeOrigin(readEnv('VITE_AUTH_REDIRECT_ORIGIN'));

  if (!callerOrigin) {
    return null;
  }

  if (callerOrigin !== requestOrigin && callerOrigin !== configuredOrigin) {
    return false;
  }

  return {
    'Access-Control-Allow-Origin': callerOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
};

export default async function handler(request: Request) {
  const corsHeaders = resolveCorsHeaders(request);
  if (corsHeaders === false) {
    return jsonResponse({ error: 'Origin is not allowed.' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders || {},
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405, corsHeaders || undefined);
  }

  const supabaseUrl = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/+$/, '');
  const supabaseAnonKey = readEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      {
        error: 'Supabase auth proxy is missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.',
      },
      500,
      corsHeaders || undefined,
    );
  }

  try {
    const payload = await parseBody(request);
    const email = String(payload.email || '').trim();
    const password = String(payload.password || '');
    const captchaToken = String(payload.captchaToken || '').trim();

    if (!email || !password) {
      return jsonResponse({ error: 'Email and password are required.' }, 400, corsHeaders || undefined);
    }

    const upstreamBody: Record<string, unknown> = {
      email,
      password,
    };

    if (captchaToken) {
      upstreamBody.gotrue_meta_security = { captcha_token: captchaToken };
    }

    const upstreamResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'kk-studio-auth-proxy/1.0.0',
      },
      body: JSON.stringify(upstreamBody),
    });

    const responseText = await upstreamResponse.text();

    return new Response(responseText || '{}', {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
        ...(corsHeaders || {}),
      },
    });
  } catch (error: any) {
    return jsonResponse(
      {
        error: error?.message || 'Password sign-in proxy failed.',
      },
      500,
      corsHeaders || undefined,
    );
  }
}
