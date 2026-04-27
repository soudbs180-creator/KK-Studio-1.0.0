import type { BrowserSessionRecord, BrowserSessionRepository } from '../domain/browser-session.ts';

export class InMemoryBrowserSessionRepository implements BrowserSessionRepository {
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
