import { createHmac, timingSafeEqual } from "node:crypto";

export type KkSessionTokenType = "access" | "refresh";

interface SessionTokenHeader {
  alg: "HS256";
  typ: "JWT";
  kid: "kkai-v1";
}

interface SessionTokenPayload {
  iss: "kkai";
  aud: "kk-api";
  sub: string;
  email?: string;
  role?: string;
  token_use: KkSessionTokenType;
  iat: number;
  exp: number;
}

export interface CreateKkSessionTokenOptions {
  tokenType: KkSessionTokenType;
  userId: string;
  email?: string;
  role?: string;
  expiresInSeconds: number;
}

export interface VerifiedKkSessionToken {
  userId: string;
  email?: string;
  role?: string;
  tokenType: KkSessionTokenType;
  issuedAt: number;
  expiresAt: number;
}

const defaultHeader: SessionTokenHeader = {
  alg: "HS256",
  typ: "JWT",
  kid: "kkai-v1",
};

function resolveSessionSigningSecret(): string {
  const configuredSecret = String(process.env.KK_API_SESSION_SIGNING_SECRET || "").trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  throw new Error("KK_API_SESSION_SIGNING_SECRET is required for KK API session tokens.");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0
    ? ""
    : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signUnsignedToken(unsignedToken: string): Buffer {
  return createHmac("sha256", resolveSessionSigningSecret())
    .update(unsignedToken)
    .digest();
}

function decodeSignatureSegment(segment: string): Buffer {
  const normalized = String(segment || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0
    ? ""
    : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

export function createKkSessionToken(options: CreateKkSessionTokenOptions): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    iss: "kkai",
    aud: "kk-api",
    sub: String(options.userId || "").trim(),
    ...(options.email ? { email: String(options.email).trim() } : {}),
    ...(options.role ? { role: String(options.role).trim() } : {}),
    token_use: options.tokenType,
    iat: nowSeconds,
    exp: nowSeconds + Math.max(1, Math.floor(options.expiresInSeconds)),
  };
  const encodedHeader = toBase64Url(JSON.stringify(defaultHeader));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signUnsignedToken(unsignedToken)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${unsignedToken}.${signature}`;
}

function parsePayload(token: string): SessionTokenPayload | null {
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(parts[1])) as Partial<SessionTokenPayload>;
    if (
      payload.iss !== "kkai"
      || payload.aud !== "kk-api"
      || typeof payload.sub !== "string"
      || (payload.token_use !== "access" && payload.token_use !== "refresh")
      || !Number.isFinite(Number(payload.iat))
      || !Number.isFinite(Number(payload.exp))
    ) {
      return null;
    }

    return {
      iss: "kkai",
      aud: "kk-api",
      sub: payload.sub,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.role ? { role: payload.role } : {}),
      token_use: payload.token_use,
      iat: Number(payload.iat),
      exp: Number(payload.exp),
    };
  } catch {
    return null;
  }
}

export function verifyKkSessionToken(
  token: string,
  options: {
    tokenType?: KkSessionTokenType;
    nowMs?: number;
  } = {},
): VerifiedKkSessionToken | null {
  resolveSessionSigningSecret();

  const normalizedToken = String(token || "").trim();
  const parts = normalizedToken.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expectedSignature = signUnsignedToken(unsignedToken);
  const providedSignature = decodeSignatureSegment(parts[2]);
  if (
    expectedSignature.length !== providedSignature.length
    || !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return null;
  }

  const payload = parsePayload(normalizedToken);
  if (!payload) {
    return null;
  }

  if (options.tokenType && payload.token_use !== options.tokenType) {
    return null;
  }

  const nowMs = Number.isFinite(options.nowMs) ? Number(options.nowMs) : Date.now();
  if ((payload.exp * 1000) <= nowMs) {
    return null;
  }

  return {
    userId: payload.sub,
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.role ? { role: payload.role } : {}),
    tokenType: payload.token_use,
    issuedAt: payload.iat * 1000,
    expiresAt: payload.exp * 1000,
  };
}
