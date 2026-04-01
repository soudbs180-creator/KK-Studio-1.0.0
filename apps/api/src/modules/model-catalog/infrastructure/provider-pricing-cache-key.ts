import { createHash } from "node:crypto";

const MARKETING_PAGE_SUFFIX_RE = /(\/(pricing|models))(\/.*)?$/i;

export function normalizeSharedPricingBaseUrl(baseUrl: string): string {
  const raw = String(baseUrl || "").trim();
  if (!raw) {
    return "";
  }

  const trimmed = raw.replace(/\/+$/, "").replace(MARKETING_PAGE_SUFFIX_RE, "");
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return trimmed;
  }
}

export function buildSharedPricingCacheProviderId(baseUrl: string): string {
  const normalizedBaseUrl = normalizeSharedPricingBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return "";
  }

  const digest = createHash("sha256")
    .update(normalizedBaseUrl, "utf8")
    .digest("hex")
    .slice(0, 24);

  return `shared:${digest}`;
}
