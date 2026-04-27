import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const BROWSER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_SESSION_COOKIE_NAME = 'kk_refresh_session';

export type BrowserSessionRole = 'user' | 'admin';
export type BrowserSessionSameSite = 'lax' | 'strict' | 'none';

interface BrowserRefreshTokenHeader {
  alg: 'HS256';
  typ: 'JWT';
  kid: 'kk-browser-session-v1';
}

interface BrowserRefreshTokenPayload {
  iss: 'kkai';
  aud: 'kk-browser-session';
  sid: string;
  sub: string;
  email?: string;
  role?: BrowserSessionRole;
  token_use: 'browser_refresh';
  iat: number;
  exp: number;
}

export interface BrowserSessionSubject {
  userId: string;
  email?: string;
  role?: BrowserSessionRole;
}

export interface BrowserSessionRequestContext {
  ip?: string;
  userAgent?: string;
}

export interface BrowserSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  rotatedFrom?: string;
  revokedAt?: string;
  createdAt: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface BrowserSessionRepository {
  insert(record: BrowserSessionRecord): Promise<void>;
  findActiveByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<BrowserSessionRecord | undefined>;
  revokeSession(id: string, revokedAt: string): Promise<void>;
  replaceRotatedSession(
    currentId: string,
    nextRecord: BrowserSessionRecord,
    revokedAt: string,
  ): Promise<void>;
}

export interface BrowserSessionCookieOptions {
  cookieName?: string;
  path?: string;
  sameSite?: BrowserSessionSameSite;
  secure?: boolean;
}

export interface CreateBrowserRefreshTokenOptions extends BrowserSessionSubject {
  expiresInSeconds: number;
  issuedAt?: Date;
}

export interface VerifiedBrowserRefreshToken extends BrowserSessionSubject {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

const defaultHeader: BrowserRefreshTokenHeader = {
  alg: 'HS256',
  typ: 'JWT',
  kid: 'kk-browser-session-v1',
};

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0
    ? ''
    : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function signBrowserRefreshToken(unsignedToken: string, sessionSigningSecret: string): Buffer {
  return createHmac('sha256', sessionSigningSecret)
    .update(unsignedToken)
    .digest();
}

function decodeSignatureSegment(segment: string): Buffer {
  const normalized = String(segment || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0
    ? ''
    : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function normalizeSameSite(value: string | undefined): BrowserSessionSameSite {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  return 'lax';
}

function parsePayload(token: string): BrowserRefreshTokenPayload | null {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Partial<BrowserRefreshTokenPayload>;
    if (
      payload.iss !== 'kkai'
      || payload.aud !== 'kk-browser-session'
      || typeof payload.sid !== 'string'
      || typeof payload.sub !== 'string'
      || payload.token_use !== 'browser_refresh'
      || !Number.isFinite(Number(payload.iat))
      || !Number.isFinite(Number(payload.exp))
    ) {
      return null;
    }

    return {
      iss: 'kkai',
      aud: 'kk-browser-session',
      sid: payload.sid,
      sub: payload.sub,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.role === 'admin' ? { role: 'admin' as const } : payload.role === 'user' ? { role: 'user' as const } : {}),
      token_use: 'browser_refresh',
      iat: Number(payload.iat),
      exp: Number(payload.exp),
    };
  } catch {
    return null;
  }
}

export function createBrowserRefreshToken(
  options: CreateBrowserRefreshTokenOptions,
  sessionSigningSecret: string,
): string {
  const normalizedSecret = String(sessionSigningSecret || '').trim();
  if (!normalizedSecret) {
    throw new Error('A browser-session signing secret is required.');
  }

  const issuedAt = options.issuedAt || new Date();
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
  const payload: BrowserRefreshTokenPayload = {
    iss: 'kkai',
    aud: 'kk-browser-session',
    sid: randomUUID(),
    sub: String(options.userId || '').trim(),
    ...(options.email ? { email: String(options.email).trim() } : {}),
    ...(options.role ? { role: options.role } : {}),
    token_use: 'browser_refresh',
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + Math.max(1, Math.floor(options.expiresInSeconds)),
  };
  const encodedHeader = toBase64Url(JSON.stringify(defaultHeader));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = signBrowserRefreshToken(unsignedToken, normalizedSecret)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${unsignedToken}.${signature}`;
}

export function verifyBrowserRefreshToken(
  token: string,
  sessionSigningSecret: string,
  nowMs: number = Date.now(),
): VerifiedBrowserRefreshToken | null {
  const normalizedToken = String(token || '').trim();
  const normalizedSecret = String(sessionSigningSecret || '').trim();
  const parts = normalizedToken.split('.');
  if (parts.length !== 3 || !normalizedSecret) {
    return null;
  }

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expectedSignature = signBrowserRefreshToken(unsignedToken, normalizedSecret);
  const providedSignature = decodeSignatureSegment(parts[2]);
  if (
    expectedSignature.length !== providedSignature.length
    || !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return null;
  }

  const payload = parsePayload(normalizedToken);
  if (!payload || (payload.exp * 1000) <= nowMs) {
    return null;
  }

  return {
    sessionId: payload.sid,
    userId: payload.sub,
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.role ? { role: payload.role } : {}),
    issuedAt: payload.iat * 1000,
    expiresAt: payload.exp * 1000,
  };
}

export function hashBrowserRefreshToken(token: string, sessionSigningSecret: string): string {
  const normalizedSecret = String(sessionSigningSecret || '').trim();
  if (!normalizedSecret) {
    throw new Error('A browser-session signing secret is required.');
  }

  return createHmac('sha256', normalizedSecret)
    .update(String(token || '').trim())
    .digest('hex');
}

export function buildBrowserSessionCookie(
  refreshToken: string,
  expiresAt: string,
  options: BrowserSessionCookieOptions = {},
): string {
  const cookieName = String(options.cookieName || DEFAULT_SESSION_COOKIE_NAME).trim() || DEFAULT_SESSION_COOKIE_NAME;
  const path = String(options.path || '/').trim() || '/';
  const sameSite = normalizeSameSite(options.sameSite);
  const parts = [
    `${cookieName}=${refreshToken}`,
    `Path=${path}`,
    'HttpOnly',
    `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
    `Max-Age=${BROWSER_SESSION_TTL_SECONDS}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildClearedBrowserSessionCookie(options: BrowserSessionCookieOptions = {}): string {
  const cookieName = String(options.cookieName || DEFAULT_SESSION_COOKIE_NAME).trim() || DEFAULT_SESSION_COOKIE_NAME;
  const path = String(options.path || '/').trim() || '/';
  const sameSite = normalizeSameSite(options.sameSite);
  const parts = [
    `${cookieName}=`,
    `Path=${path}`,
    'HttpOnly',
    `SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
