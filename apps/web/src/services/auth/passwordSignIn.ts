import { kkWebApiClient } from "../api/kkApiClient.ts";
import { setStoredKkApiAccessToken } from "../api/authAccessToken.ts";
import { emitAuthSessionChange } from "./authSessionEvents.ts";
import { updateRuntimeAuthStateFromProfile } from "./runtimeAuthState.ts";

export const HOSTED_PASSWORD_LOGIN_ROUTE_DISABLED_CODE = "HOSTED_PASSWORD_LOGIN_ROUTE_DISABLED";
export const HOSTED_PASSWORD_LOGIN_ROUTE_DISABLED_MESSAGE =
  "The hosted password login route is unavailable. Use the KK API auth route, or wait until the local runtime auth backend is ready.";

export type PasswordSignInParams = {
  email: string;
  password: string;
  captchaToken?: string;
};

export type PasswordSignInResult = {
  error: Error | null;
  usedProxy: boolean;
};

function createAuthError(code: string | undefined, message: string): Error {
  const normalizedCode = String(code || "").trim();
  return new Error(normalizedCode ? `${normalizedCode}: ${message}` : message);
}

export async function signInWithPasswordWithFallback(
  params: PasswordSignInParams,
): Promise<PasswordSignInResult> {
  const response = await kkWebApiClient.login({
    email: params.email,
    password: params.password,
    ...(params.captchaToken ? { turnstileToken: params.captchaToken } : {}),
  });

  if (!response.success) {
    return {
      error: createAuthError(response.error.code, response.error.message || "Password sign-in failed."),
      usedProxy: false,
    };
  }

  setStoredKkApiAccessToken(response.data.accessToken);
  if (response.data.profile) {
    updateRuntimeAuthStateFromProfile(response.data.profile);
  }
  emitAuthSessionChange({
    hasSession: true,
    userId: response.data.profile?.id || null,
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    isTempUser: false,
  });

  return {
    error: null,
    usedProxy: false,
  };
}
