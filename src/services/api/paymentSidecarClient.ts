import {
  createKkApiClient,
  type KkApiClient,
} from "../../../packages/contracts/src/client/kk-api-client.ts";
import { getPreferredKkApiAccessToken } from "./authAccessToken";

function getWindowOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://127.0.0.1:8080";
}

function stripKnownPaymentPath(pathOrUrl: string): string {
  return pathOrUrl.replace(
    /\/(?:api\/pay(?:\/(?:qrcode|status))?|payment\/v1\/orders(?:\/.*)?|payment\/v1\/callbacks\/alipay(?:\/.*)?)\/?$/i,
    ""
  );
}

export function resolvePaymentSidecarBaseUrl(): string {
  const configured = String(import.meta.env.VITE_PAYMENT_GATEWAY_URL || "").trim();
  if (!configured) {
    return getWindowOrigin();
  }

  return new URL(stripKnownPaymentPath(configured) || "/", getWindowOrigin()).toString().replace(/\/$/, "");
}

export function buildPaymentSidecarAbsoluteUrl(path: string): string {
  return new URL(path, `${resolvePaymentSidecarBaseUrl()}/`).toString();
}

export function createLegacyWebPaymentSidecarClient(): KkApiClient {
  return createKkApiClient({
    baseUrl: resolvePaymentSidecarBaseUrl(),
    getAccessToken: getPreferredKkApiAccessToken,
    getClientVersion: () => "kk-legacy-payment-web",
  });
}

export const legacyWebPaymentSidecarClient = createLegacyWebPaymentSidecarClient();
