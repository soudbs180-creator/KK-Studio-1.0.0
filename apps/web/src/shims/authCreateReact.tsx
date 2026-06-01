import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AuthCreateSessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  [key: string]: unknown;
};

export type AuthCreateSession = {
  user?: AuthCreateSessionUser;
  expires?: string;
  [key: string]: unknown;
};

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SessionContextValue = {
  data: AuthCreateSession | null;
  status: SessionStatus;
  update: () => Promise<AuthCreateSession | null>;
};

type SessionProviderProps = {
  children?: ReactNode;
  session?: AuthCreateSession | null;
};

type SignInOptions = Record<string, unknown> & {
  callbackUrl?: string;
  redirect?: boolean;
};

type SignInResult = {
  ok: boolean;
  status: number;
  error?: string;
  url: string | null;
};

const emptySessionContext: SessionContextValue = {
  data: null,
  status: 'unauthenticated',
  update: async () => null,
};

const SessionContext = createContext<SessionContextValue>(emptySessionContext);

function getCurrentUrl(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function resolveCallbackUrl(callbackUrl: unknown): string {
  return typeof callbackUrl === 'string' && callbackUrl.trim()
    ? callbackUrl
    : getCurrentUrl();
}

function appendFormValue(body: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || key === 'redirect' || key === 'callbackUrl') {
    return;
  }

  body.set(key, typeof value === 'string' ? value : String(value));
}

async function readSession(): Promise<AuthCreateSession | null> {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const session = await response.json().catch(() => null);
    if (!session || typeof session !== 'object' || !Object.keys(session).length) {
      return null;
    }

    return session as AuthCreateSession;
  } catch {
    return null;
  }
}

async function readResponseError(response: Response): Promise<string | undefined> {
  if (response.ok) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null);
    if (json && typeof json === 'object' && 'error' in json) {
      return String(json.error || '');
    }
  }

  const text = await response.text().catch(() => '');
  return text ? text.slice(0, 500) : response.statusText;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  const [data, setData] = useState<AuthCreateSession | null>(session ?? null);
  const [loading, setLoading] = useState(session === undefined);

  const update = useCallback(async () => {
    const nextSession = await readSession();
    setData(nextSession);
    setLoading(false);
    return nextSession;
  }, []);

  useEffect(() => {
    if (session !== undefined) {
      setData(session);
      setLoading(false);
      return;
    }

    let disposed = false;
    readSession().then((nextSession) => {
      if (disposed) {
        return;
      }

      setData(nextSession);
      setLoading(false);
    });

    return () => {
      disposed = true;
    };
  }, [session]);

  const value = useMemo<SessionContextValue>(() => ({
    data,
    status: loading ? 'loading' : data ? 'authenticated' : 'unauthenticated',
    update,
  }), [data, loading, update]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export async function signIn(provider = 'credentials', options: SignInOptions = {}): Promise<SignInResult> {
  const callbackUrl = resolveCallbackUrl(options.callbackUrl);
  const body = new URLSearchParams();
  body.set('callbackUrl', callbackUrl);

  Object.entries(options).forEach(([key, value]) => appendFormValue(body, key, value));

  const response = await fetch(`/api/auth/signin/${encodeURIComponent(provider)}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const url = response.url || callbackUrl;
  const error = await readResponseError(response);
  const result: SignInResult = {
    ok: response.ok,
    status: response.status,
    ...(error ? { error } : {}),
    url,
  };

  if (options.redirect !== false && typeof window !== 'undefined') {
    window.location.href = url;
  }

  return result;
}

export async function signOut(options: SignInOptions = {}): Promise<{ url: string | null }> {
  const callbackUrl = resolveCallbackUrl(options.callbackUrl);
  const body = new URLSearchParams();
  body.set('callbackUrl', callbackUrl);

  await fetch('/api/auth/signout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  }).catch(() => undefined);

  if (options.redirect !== false && typeof window !== 'undefined') {
    window.location.href = callbackUrl;
  }

  return { url: callbackUrl };
}
