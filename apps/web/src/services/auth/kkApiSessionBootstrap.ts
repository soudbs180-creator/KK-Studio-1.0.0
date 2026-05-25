import {
  createKkApiClient,
  type AuthSessionDto,
  type ApiResponse,
  type LogoutResponseDto,
} from "@kk/shared";
import {
  setStoredKkApiAccessToken,
} from "../api/authAccessToken.ts";
import { resolveKkApiBaseUrl } from "../api/kkApiBaseUrl.ts";
import { emitAuthSessionChange } from "./authSessionEvents.ts";
import {
  clearPersistedRuntimeAuthState,
  type RuntimeAuthState,
  updateRuntimeAuthStateFromProfile,
} from "./runtimeAuthState.ts";

const cookieSessionClient = createKkApiClient({
  baseUrl: resolveKkApiBaseUrl(),
  getClientVersion: () => "kk-web-cookie-bootstrap",
});

export function applyHostedSessionToRuntime(session: AuthSessionDto): RuntimeAuthState {
  setStoredKkApiAccessToken(session.accessToken);
  const nextState = updateRuntimeAuthStateFromProfile(session.profile);
  emitAuthSessionChange({
    hasSession: true,
    userId: session.profile.id,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    isTempUser: false,
  });
  return nextState;
}

export function clearHostedSessionRuntime(): RuntimeAuthState {
  setStoredKkApiAccessToken(undefined);
  const nextState = clearPersistedRuntimeAuthState();
  emitAuthSessionChange({
    hasSession: false,
    userId: null,
    accessToken: undefined,
    refreshToken: undefined,
    isTempUser: false,
  });
  return nextState;
}

export async function fetchHostedSessionFromServer(): Promise<ApiResponse<AuthSessionDto>> {
  return cookieSessionClient.getSession();
}

export async function restoreHostedSessionFromServer(): Promise<AuthSessionDto | undefined> {
  const response = await fetchHostedSessionFromServer();
  if (!response.success) {
    return undefined;
  }

  applyHostedSessionToRuntime(response.data);
  return response.data;
}

export async function refreshHostedSessionFromServer(): Promise<ApiResponse<AuthSessionDto>> {
  return cookieSessionClient.refreshSession({});
}

export async function logoutHostedSessionFromServer(): Promise<ApiResponse<LogoutResponseDto>> {
  try {
    return await cookieSessionClient.logout();
  } finally {
    clearHostedSessionRuntime();
  }
}
