import { supabase } from "../../lib/supabase.ts";

const accessTokenStorageKey = "kk.api.access_token";

export function getStoredKkApiAccessToken(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const token = window.localStorage.getItem(accessTokenStorageKey);
  return token || undefined;
}

export function setStoredKkApiAccessToken(token?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(accessTokenStorageKey);
    return;
  }

  window.localStorage.setItem(accessTokenStorageKey, token);
}

export async function getPreferredKkApiAccessToken(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    const sessionAccessToken = data.session?.access_token || undefined;
    if (sessionAccessToken) {
      if (sessionAccessToken !== getStoredKkApiAccessToken()) {
        setStoredKkApiAccessToken(sessionAccessToken);
      }
      return sessionAccessToken;
    }
  } catch {
    // Fall through to the stored compatibility token below.
  }

  return getStoredKkApiAccessToken();
}
