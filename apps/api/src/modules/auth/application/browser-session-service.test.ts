import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  BROWSER_SESSION_TTL_SECONDS,
  type BrowserSessionRecord,
} from '../domain/browser-session.ts';
import { BrowserSessionService } from './browser-session-service.ts';

class InMemoryBrowserSessionRepository {
  private readonly rows = new Map<string, BrowserSessionRecord>();

  async insert(record: BrowserSessionRecord): Promise<void> {
    this.rows.set(record.id, { ...record });
  }

  async findActiveByRefreshTokenHash(
    refreshTokenHash: string,
    nowIso: string,
  ): Promise<BrowserSessionRecord | undefined> {
    return Array.from(this.rows.values()).find((record) =>
      record.refreshTokenHash === refreshTokenHash
      && !record.revokedAt
      && record.expiresAt > nowIso,
    );
  }

  async revokeSession(id: string, revokedAt: string): Promise<void> {
    const current = this.rows.get(id);
    if (!current) {
      return;
    }

    this.rows.set(id, {
      ...current,
      revokedAt,
    });
  }

  async replaceRotatedSession(
    currentId: string,
    nextRecord: BrowserSessionRecord,
    revokedAt: string,
  ): Promise<void> {
    await this.revokeSession(currentId, revokedAt);
    await this.insert(nextRecord);
  }
}

test('browser session rotation keeps 1h access tokens and 30d refresh sessions', async () => {
  const repository = new InMemoryBrowserSessionRepository();
  const service = new BrowserSessionService({
    repository,
    now: () => new Date('2026-04-27T00:00:00.000Z'),
    sessionSigningSecret: 'test-session-secret',
  });

  const issued = await service.issueSession({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    role: 'user',
  }, {
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.equal(issued.expiresIn, ACCESS_TOKEN_TTL_SECONDS);
  assert.equal(BROWSER_SESSION_TTL_SECONDS, 30 * 24 * 60 * 60);
  assert.ok(issued.sessionExpiresAt);
  assert.ok(issued.setCookie[0]?.includes('HttpOnly'));
});

test('refresh-token reuse is rejected after rotation', async () => {
  const repository = new InMemoryBrowserSessionRepository();
  const service = new BrowserSessionService({
    repository,
    now: () => new Date('2026-04-27T00:00:00.000Z'),
    sessionSigningSecret: 'test-session-secret',
  });

  const issued = await service.issueSession({
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    role: 'user',
  }, {
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  const rotated = await service.rotateSession(issued.rawRefreshToken, {
    ip: '127.0.0.1',
    userAgent: 'node-test',
  });

  assert.ok(rotated);

  await assert.rejects(
    () => service.rotateSession(issued.rawRefreshToken, {
      ip: '127.0.0.1',
      userAgent: 'node-test',
    }),
    /revoked|invalid|expired/i,
  );
});
