const OUTCOME_KEYS = Object.freeze([
  'selected',
  'fallbackNoMatch',
  'fallbackStorageUnavailable',
  'fallbackUnsupportedRoute',
  'blockedSecretUnavailable',
]);

function createOutcomeCounters() {
  return Object.fromEntries(OUTCOME_KEYS.map((outcome) => [outcome, 0]));
}

class ProviderConnectionDualReadMetrics {
  constructor(options = {}) {
    this.now = options.now || Date.now;
    this.reset();
  }

  /** Records only a bounded rollout result and never retains request identity. */
  recordOutcome(outcome) {
    if (!OUTCOME_KEYS.includes(outcome)) return;
    this.outcomes[outcome] += 1;
    this.lastEventAt = new Date(this.now()).toISOString();
  }

  getSnapshot() {
    return {
      schemaVersion: 1,
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      outcomes: { ...this.outcomes },
    };
  }

  reset() {
    this.startedAt = new Date(this.now()).toISOString();
    this.lastEventAt = null;
    this.outcomes = createOutcomeCounters();
  }
}

/** Creates an isolated aggregate-only Provider Connection dual-read collector. */
function createProviderConnectionDualReadMetrics(options = {}) {
  return new ProviderConnectionDualReadMetrics(options);
}

const providerConnectionDualReadMetrics = createProviderConnectionDualReadMetrics();

module.exports = {
  createProviderConnectionDualReadMetrics,
  providerConnectionDualReadMetrics,
};
