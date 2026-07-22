const EVENT_KEYS = Object.freeze([
  'chargeCommitted',
  'chargeFailed',
  'chargeNoop',
  'duplicateCompletionPrevented',
  'quoteCreated',
  'quoteExpired',
  'refundCommitted',
  'refundFailed',
  'reserveCommitted',
  'reserveFailed',
  'staleRoute',
  'terminalConflictPrevented',
  'unknown',
]);

function createEventCounters() {
  return Object.fromEntries(EVENT_KEYS.map((eventName) => [eventName, 0]));
}

class GenerationV3Metrics {
  constructor(options = {}) {
    this.now = options.now || Date.now;
    this.reset();
  }

  recordEvent(eventName) {
    const safeEventName = EVENT_KEYS.includes(eventName) ? eventName : 'unknown';
    this.events[safeEventName] += 1;
    this.lastEventAt = new Date(this.now()).toISOString();
  }

  getSnapshot() {
    return {
      schemaVersion: 1,
      startedAt: this.startedAt,
      lastEventAt: this.lastEventAt,
      events: { ...this.events },
    };
  }

  reset() {
    this.startedAt = new Date(this.now()).toISOString();
    this.lastEventAt = null;
    this.events = createEventCounters();
  }
}

/** Creates an aggregate-only Quote and billing reconciliation metrics collector. */
function createGenerationV3Metrics(options = {}) {
  return new GenerationV3Metrics(options);
}

const generationV3Metrics = createGenerationV3Metrics();

module.exports = { createGenerationV3Metrics, generationV3Metrics };
