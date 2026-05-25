import { resolveAuthRedirectOrigin } from "../../config/authRedirect.ts";
import { kkWebApiClient } from "../api/kkApiClient.ts";
import { getLatestRuntimeAuthState } from "./runtimeAuthState.ts";

export type BindableAuthProvider = "google" | "wechat";
export type BindCallbackMode = `${BindableAuthProvider}-bind`;

type IdentityLike = {
  provider?: string | null;
};

type RuntimeLinkedUserLike = {
  app_metadata?: {
    provider?: string | null;
    providers?: string[] | null;
  } | null;
  identities?: IdentityLike[] | null;
};

function resolveBrowserOrigin(): string {
  return resolveAuthRedirectOrigin();
}

function normalizeProviderName(provider: unknown): string | undefined {
  if (typeof provider !== "string") {
    return undefined;
  }

  const normalized = provider.trim().toLowerCase();
  return normalized || undefined;
}

export function buildBindCallbackUrl(
  provider: BindableAuthProvider,
  origin = resolveBrowserOrigin(),
): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("mode", `${provider}-bind`);
  return callbackUrl.toString();
}

export function collectLinkedAuthProviders(
  user?: RuntimeLinkedUserLike | null,
  identities?: IdentityLike[] | null,
): string[] {
  const providers = [
    ...((user?.app_metadata?.providers as string[] | undefined) || []),
    user?.app_metadata?.provider,
    ...(user?.identities?.map((identity) => identity.provider) || []),
    ...((identities || []).map((identity) => identity.provider)),
  ]
    .map(normalizeProviderName)
    .filter((provider): provider is string => Boolean(provider));

  return Array.from(new Set(providers));
}

export function resolveBindCallbackProvider(
  searchParams: URLSearchParams,
): BindableAuthProvider | undefined {
  if (searchParams.get("wechat_bind") === "success") {
    return "wechat";
  }

  const mode = searchParams.get("mode");
  if (mode === "google-bind") {
    return "google";
  }

  if (mode === "wechat-bind") {
    return "wechat";
  }

  return undefined;
}

export function resolveBindSuccessMessage(
  provider?: BindableAuthProvider,
): string {
  if (provider === "google") {
    return "Google 绑定成功。";
  }

  if (provider === "wechat") {
    return "微信绑定成功。";
  }

  return "账号绑定成功。";
}

export function resolveBindFailureMessage(
  provider?: BindableAuthProvider,
): string {
  if (provider === "google") {
    return "Google 绑定失败，请稍后重试。";
  }

  if (provider === "wechat") {
    return "微信绑定失败，请稍后重试。";
  }

  return "账号绑定失败，请稍后重试。";
}

type GoogleBindClient = Pick<typeof kkWebApiClient, "startGoogleBind">;

export async function startGoogleBind(
  client: GoogleBindClient = kkWebApiClient,
  origin = resolveBrowserOrigin(),
): Promise<string> {
  const redirectTo = buildBindCallbackUrl("google", origin);
  const response = await client.startGoogleBind(redirectTo);
  if (!response.success) {
    throw new Error(response.error.message || "无法发起 Google 绑定，请稍后重试。");
  }

  const authorizationUrl = String(response.data.authorizationUrl || "").trim();
  if (!authorizationUrl) {
    throw new Error("Google 绑定授权地址不可用。");
  }

  return authorizationUrl;
}

export async function listLinkedAuthProviders(): Promise<string[]> {
  const runtimeState = getLatestRuntimeAuthState();
  return collectLinkedAuthProviders(runtimeState.user);
}
