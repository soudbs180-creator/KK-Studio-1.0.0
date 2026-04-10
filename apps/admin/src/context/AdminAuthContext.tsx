import React, { createContext, useContext, useMemo, useState } from 'react';

import { createAdminApiClient } from '../services/adminApiClient';
import { canUseAdminRoute, performAdminLogin } from '../services/adminAuthFlow';
import { normalizeAdminBrowserSession, type AdminBrowserSession } from '../services/adminBrowserSession';

const STORAGE_KEY = 'kk_admin_browser_session';
const client = createAdminApiClient();

function readInitialSession(): AdminBrowserSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeAdminBrowserSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

type AdminAuthContextValue = {
  session: AdminBrowserSession | null;
  isAuthorized: boolean;
  signIn: (input: { email: string; password: string; adminPassword: string }) => Promise<void>;
  signOut: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminBrowserSession | null>(() => readInitialSession());

  const value = useMemo<AdminAuthContextValue>(() => ({
    session,
    isAuthorized: canUseAdminRoute(session),
    signIn: async (input) => {
      const nextSession = await performAdminLogin(input, { client });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      }
      setSession(nextSession);
    },
    signOut: () => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
      setSession(null);
    },
  }), [session]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('AdminAuthContext is missing');
  }

  return context;
}
