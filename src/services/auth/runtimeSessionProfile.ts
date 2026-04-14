import { getStoredKkApiAccessToken } from "../api/authAccessToken.ts";
import { getLatestAuthSessionChange } from "./authSessionEvents.ts";
import { getLatestRuntimeAuthState } from "./runtimeAuthState.ts";

export interface RuntimeAuthenticatedProfileContext {
  userId: string;
  email: string | null;
  isTempUser: boolean;
}

function normalizeUserId(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

export function getRuntimeOwnerId(): string {
  return resolveRuntimeAuthenticatedProfileContext()?.userId || "local_user";
}

export function resolveRuntimeAuthenticatedProfileContext(
  expectedUserId?: string,
): RuntimeAuthenticatedProfileContext | null {
  const runtimeState = getLatestRuntimeAuthState();
  const latestSessionChange = getLatestAuthSessionChange();
  const storedAccessToken = getStoredKkApiAccessToken();
  const runtimeUserId = normalizeUserId(runtimeState.user?.id);
  const sessionUserId = normalizeUserId(latestSessionChange?.userId);
  const isTempUser = runtimeState.isTempUser || latestSessionChange?.isTempUser === true;
  const userId = sessionUserId || runtimeUserId;

  if (!userId && !storedAccessToken) {
    return null;
  }

  if (!userId) {
    return null;
  }

  if (expectedUserId && expectedUserId !== userId) {
    return null;
  }

  return {
    userId,
    email: normalizeEmail(runtimeState.user?.email),
    isTempUser,
  };
}
