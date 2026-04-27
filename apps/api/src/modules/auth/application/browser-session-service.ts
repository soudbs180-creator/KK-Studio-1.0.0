import { randomUUID } from 'node:crypto';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  BROWSER_SESSION_TTL_SECONDS,
  buildBrowserSessionCookie,
  buildClearedBrowserSessionCookie,
  createBrowserRefreshToken,
  hashBrowserRefreshToken,
  type BrowserSessionCookieOptions,
  type BrowserSessionRecord,
  type BrowserSessionRepository,
  type BrowserSessionRequestContext,
  type BrowserSessionRole,
  type BrowserSessionSubject,
  verifyBrowserRefreshToken,
} from '../domain/browser-session.ts';
import { createKkSessionToken } from '../infrastructure/kk-session-token.ts';

export interface BrowserSessionServiceDependencies extends BrowserSessionCookieOptions {
  repository: BrowserSessionRepository;
  sessionSigningSecret: string;
  now?: () => Date;
}

export interface BrowserSessionIssueResult {
  accessToken: string;
  rawRefreshToken: string;
  expiresIn: number;
  sessionExpiresAt: string;
  setCookie: string[];
}

export class BrowserSessionError extends Error {
  readonly code: 'invalid_session' | 'expired_session';

  constructor(code: 'invalid_session' | 'expired_session', message: string) {
    super(message);
    this.name = 'BrowserSessionError';
    this.code = code;
  }
}

export class BrowserSessionService {
  private readonly repository: BrowserSessionRepository;
  private readonly sessionSigningSecret: string;
  private readonly now: () => Date;
  private readonly cookieOptions: BrowserSessionCookieOptions;

  constructor(dependencies: BrowserSessionServiceDependencies) {
    const normalizedSecret = String(dependencies.sessionSigningSecret || '').trim();
    if (!normalizedSecret) {
      throw new Error('BrowserSessionService requires a non-empty session signing secret.');
    }

    this.repository = dependencies.repository;
    this.sessionSigningSecret = normalizedSecret;
    this.now = dependencies.now || (() => new Date());
    this.cookieOptions = {
      cookieName: dependencies.cookieName,
      path: dependencies.path,
      sameSite: dependencies.sameSite,
      secure: dependencies.secure,
    };
  }

  async issueSession(
    subject: BrowserSessionSubject,
    context: BrowserSessionRequestContext = {},
  ): Promise<BrowserSessionIssueResult> {
    const issuedAt = this.now();
    const rawRefreshToken = this.createRefreshToken(subject, issuedAt);
    const sessionRecord = this.createSessionRecord(subject.userId, rawRefreshToken, issuedAt, context);
    await this.repository.insert(sessionRecord);
    return this.buildIssueResult(subject, rawRefreshToken, sessionRecord.expiresAt);
  }

  async resolveSession(
    rawRefreshToken: string,
  ): Promise<BrowserSessionIssueResult> {
    const session = await this.requireActiveSession(rawRefreshToken);
    return this.buildIssueResult(session.subject, rawRefreshToken, session.record.expiresAt, []);
  }

  async rotateSession(
    rawRefreshToken: string,
    context: BrowserSessionRequestContext = {},
  ): Promise<BrowserSessionIssueResult> {
    const current = await this.requireActiveSession(rawRefreshToken);
    const issuedAt = this.now();
    const nextRefreshToken = this.createRefreshToken(current.subject, issuedAt);
    const nextRecord = this.createSessionRecord(
      current.subject.userId,
      nextRefreshToken,
      issuedAt,
      context,
      current.record.id,
    );

    await this.repository.replaceRotatedSession(current.record.id, nextRecord, issuedAt.toISOString());
    return this.buildIssueResult(current.subject, nextRefreshToken, nextRecord.expiresAt);
  }

  async revokeSession(rawRefreshToken: string): Promise<boolean> {
    try {
      const current = await this.requireActiveSession(rawRefreshToken);
      await this.repository.revokeSession(current.record.id, this.now().toISOString());
      return true;
    } catch {
      return false;
    }
  }

  buildClearedSessionCookie(): string[] {
    return [buildClearedBrowserSessionCookie(this.cookieOptions)];
  }

  private buildIssueResult(
    subject: BrowserSessionSubject,
    rawRefreshToken: string,
    sessionExpiresAt: string,
    setCookie: string[] = [buildBrowserSessionCookie(rawRefreshToken, sessionExpiresAt, this.cookieOptions)],
  ): BrowserSessionIssueResult {
    return {
      accessToken: createKkSessionToken({
        tokenType: 'access',
        userId: subject.userId,
        email: subject.email,
        role: this.normalizeRole(subject.role),
        expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      }),
      rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      sessionExpiresAt,
      setCookie,
    };
  }

  private createRefreshToken(subject: BrowserSessionSubject, issuedAt: Date): string {
    return createBrowserRefreshToken({
      userId: subject.userId,
      email: subject.email,
      role: this.normalizeRole(subject.role),
      expiresInSeconds: BROWSER_SESSION_TTL_SECONDS,
      issuedAt,
    }, this.sessionSigningSecret);
  }

  private createSessionRecord(
    userId: string,
    rawRefreshToken: string,
    issuedAt: Date,
    context: BrowserSessionRequestContext,
    rotatedFrom?: string,
  ): BrowserSessionRecord {
    return {
      id: randomUUID(),
      userId,
      refreshTokenHash: hashBrowserRefreshToken(rawRefreshToken, this.sessionSigningSecret),
      expiresAt: new Date(issuedAt.getTime() + (BROWSER_SESSION_TTL_SECONDS * 1000)).toISOString(),
      ...(rotatedFrom ? { rotatedFrom } : {}),
      createdAt: issuedAt.toISOString(),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      ...(context.ip ? { ipAddress: context.ip } : {}),
    };
  }

  private async requireActiveSession(rawRefreshToken: string): Promise<{
    record: BrowserSessionRecord;
    subject: BrowserSessionSubject;
  }> {
    const issuedAt = this.now();
    const verified = verifyBrowserRefreshToken(rawRefreshToken, this.sessionSigningSecret, issuedAt.getTime());
    if (!verified) {
      throw new BrowserSessionError('expired_session', 'Browser session is invalid or expired.');
    }

    const refreshTokenHash = hashBrowserRefreshToken(rawRefreshToken, this.sessionSigningSecret);
    const record = await this.repository.findActiveByRefreshTokenHash(refreshTokenHash, issuedAt.toISOString());
    if (!record) {
      throw new BrowserSessionError('invalid_session', 'Browser session is invalid, revoked, or expired.');
    }

    return {
      record,
      subject: {
        userId: verified.userId,
        ...(verified.email ? { email: verified.email } : {}),
        ...(verified.role ? { role: verified.role } : {}),
      },
    };
  }

  private normalizeRole(role: BrowserSessionRole | undefined): BrowserSessionRole {
    return role === 'admin' ? 'admin' : 'user';
  }
}
