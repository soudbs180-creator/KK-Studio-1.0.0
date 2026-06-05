function createFixedWindowRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs) > 0 ? Number(options.windowMs) : 60_000;
  const max = Number(options.max) > 0 ? Number(options.max) : 60;
  const maxKeys = Number(options.maxKeys) > 0 ? Number(options.maxKeys) : 10_000;
  const entries = new Map();

  function prune(now) {
    if (entries.size < maxKeys) {
      return;
    }
    for (const [key, value] of entries) {
      if (!value || now > value.resetTime) {
        entries.delete(key);
      }
    }
  }

  return {
    check(key, now = Date.now()) {
      const normalizedKey = String(key || 'anonymous').slice(0, 256);
      prune(now);

      let entry = entries.get(normalizedKey);
      if (!entry || now > entry.resetTime) {
        entry = { count: 1, resetTime: now + windowMs };
        entries.set(normalizedKey, entry);
        return {
          allowed: true,
          count: entry.count,
          retryAfter: 0,
          resetTime: entry.resetTime,
        };
      }

      entry.count += 1;
      const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      return {
        allowed: entry.count <= max,
        count: entry.count,
        retryAfter,
        resetTime: entry.resetTime,
      };
    },

    size() {
      return entries.size;
    },

    clear() {
      entries.clear();
    },
  };
}

module.exports = {
  createFixedWindowRateLimiter,
};
