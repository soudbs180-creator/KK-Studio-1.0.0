import {
  createKkApiClient,
  type KkApiClient,
} from "../../../packages/contracts/src/index.ts";
import { readRuntimeEnv, readRuntimeOrigin } from "../../utils/runtimeEnv.ts";
import { getPreferredKkApiAccessToken } from "./authAccessToken.ts";

function getWindowOrigin(): string {
  const runtimeOrigin = readRuntimeOrigin();
  if (runtimeOrigin) {
    return runtimeOrigin;
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
  const configured = readRuntimeEnv("VITE_PAYMENT_GATEWAY_URL") || "";
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
