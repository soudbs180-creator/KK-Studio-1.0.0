export interface RateLimitRule {
  max: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class InMemoryRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();

  consume(scope: string, key: string, rule: RateLimitRule): boolean {
    const now = Date.now();
    const compoundKey = `${scope}:${key}`;
    const record = this.store.get(compoundKey);

    if (!record || now > record.resetTime) {
      this.store.set(compoundKey, {
        count: 1,
        resetTime: now + rule.windowMs,
      });
      return true;
    }

    if (record.count >= rule.max) {
      return false;
    }

    record.count += 1;
    return true;
  }
}
