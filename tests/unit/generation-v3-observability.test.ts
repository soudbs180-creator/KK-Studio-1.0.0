import assert from 'node:assert/strict';
import test from 'node:test';

const loadGenerationMetrics = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/generationMetrics.js');
  return module.default || module;
};

const loadBillingSaga = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/billingSaga.js');
  return module.default || module;
};

const loadJobLifecycle = async () => {
  const module: any = await import('../../services/api/lib/generation-v3/jobLifecycle.js');
  return module.default || module;
};

test('generation metrics aggregate only known quote, billing, and terminal guard events', async () => {
  const { createGenerationV3Metrics } = await loadGenerationMetrics();
  const metrics = createGenerationV3Metrics({ now: () => 1_000 });

  metrics.recordEvent('quoteCreated');
  metrics.recordEvent('refundFailed');
  metrics.recordEvent('unknown-event');
  const snapshot = metrics.getSnapshot();
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.events.quoteCreated, 1);
  assert.equal(snapshot.events.refundFailed, 1);
  assert.equal(snapshot.events.unknown, 1);
  assert.doesNotMatch(serialized, /userId|jobId|itemId|quoteId|amount|errorMessage/);
});

test('billing metrics distinguish committed, failed, and duplicate settlement outcomes', async () => {
  const { generationV3Metrics } = await loadGenerationMetrics();
  generationV3Metrics.reset();
  const billingSaga = await loadBillingSaga();
  const creditsModule: any = await import('../../services/api/lib/credits.js');
  const credits = creditsModule.default || creditsModule;
  const originalDeduct = credits.deductCredits;
  const originalRefund = credits.refundCredits;
  let chargeUpdates = 0;
  const client = {
    async query(sql: string) {
      const normalized = sql.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalized.startsWith('insert into public.ledger_entries')) {
        return { rows: [{ ledger_id: normalized.includes("'refund'") ? 'refund-1' : 'reserve-1' }] };
      }
      if (normalized.includes("set type = 'charge'")) {
        chargeUpdates += 1;
        if (chargeUpdates === 3) throw new Error('charge unavailable');
        return { rows: chargeUpdates === 1 ? [{ ledger_id: 'reserve-1' }] : [] };
      }
      return { rows: [] };
    },
  };
  credits.deductCredits = async () => 90;
  credits.refundCredits = async () => {
    throw new Error('refund unavailable');
  };

  try {
    await billingSaga.reserveCredits({
      amount: 10,
      client,
      itemId: 'item-observability',
      jobId: 'job-observability',
      mediaType: 'image',
      quoteId: 'quote-observability',
      userId: 'user-observability',
    });
    await billingSaga.chargeFromReservation({ client, itemId: 'item-observability', ledgerId: 'reserve-1' });
    await billingSaga.chargeFromReservation({ client, itemId: 'item-observability', ledgerId: 'reserve-1' });
    await assert.rejects(
      () => billingSaga.chargeFromReservation({ client, itemId: 'item-observability', ledgerId: 'reserve-1' }),
      /charge unavailable/,
    );
    await assert.rejects(() => billingSaga.refundItem({
      amount: 10,
      client,
      itemId: 'item-observability',
      ledgerId: 'reserve-1',
      mediaType: 'image',
      reason: 'observability-test',
      userId: 'user-observability',
    }), /refund unavailable/);
  } finally {
    credits.deductCredits = originalDeduct;
    credits.refundCredits = originalRefund;
  }

  assert.deepEqual(generationV3Metrics.getSnapshot().events, {
    chargeCommitted: 1,
    chargeFailed: 1,
    chargeNoop: 1,
    duplicateCompletionPrevented: 0,
    quoteCreated: 0,
    quoteExpired: 0,
    refundCommitted: 0,
    refundFailed: 1,
    reserveCommitted: 1,
    reserveFailed: 0,
    staleRoute: 0,
    terminalConflictPrevented: 0,
    unknown: 0,
  });
});

test('expired quote reads increment the reconciliation signal before returning an error', async () => {
  const { generationV3Metrics } = await loadGenerationMetrics();
  generationV3Metrics.reset();
  const quoteEngineModule: any = await import('../../services/api/lib/generation-v3/quoteEngine.js');
  const quoteEngine = quoteEngineModule.default || quoteEngineModule;
  const client = {
    async query(sql: string) {
      if (/UPDATE public\.generation_quotes SET status = 'expired'/i.test(sql)) return { rows: [] };
      return {
        rows: [{
          channel: 'byok',
          cost_credits: null,
          cost_provider_quota: 1,
          count: 1,
          created_at: new Date(0),
          expires_at: new Date(1),
          media_type: 'image',
          model: 'expired-model',
          price_version: 'expired-v1',
          quote_id: 'expired-quote',
          route_snapshot_json: {},
          status: 'active',
          user_id: 'user',
        }],
      };
    },
  };

  await assert.rejects(
    () => quoteEngine.getActiveQuote('user', 'expired-quote', { client }),
    (error: any) => error.code === 'QUOTE_EXPIRED',
  );
  assert.equal(generationV3Metrics.getSnapshot().events.quoteExpired, 1);
});

test('terminal guards and frozen route mismatch increment safe reconciliation signals', async () => {
  const { generationV3Metrics } = await loadGenerationMetrics();
  generationV3Metrics.reset();
  const jobLifecycle = await loadJobLifecycle();
  const terminalClient = {
    async query(sql: string, params: string[]) {
      if (/SELECT \* FROM public\.generation_job_items/i.test(sql)) {
        return { rows: [{ item_id: params[0], status: params[0] === 'completed-item' ? 'completed' : 'failed' }] };
      }
      if (/FROM public\.generation_job_items ji/i.test(sql)) {
        return { rows: [{ item_id: params[0], status: 'completed' }] };
      }
      throw new Error('terminal guard should not write');
    },
  };

  await jobLifecycle.completeItem('user', 'completed-item', 'https://invalid.local/late.png', { client: terminalClient });
  await jobLifecycle.completeItem('user', 'failed-item', 'https://invalid.local/late.png', { client: terminalClient });
  await jobLifecycle.failItem('user', 'completed-item', 'late failure', { client: terminalClient });
  await assert.rejects(
    () => jobLifecycle.resolveFrozenProviderRoute('user', {
      channel: 'byok',
      mediaType: 'image',
      model: 'model',
      routeSnapshot: { adapterVersion: 'v1', connectionId: 'connection' },
    }, {
      selectRoute: () => ({ adapter: { adapterVersion: 'v2' } }),
    }),
    (error: any) => error.code === 'CONNECTION_ROUTE_STALE',
  );

  const events = generationV3Metrics.getSnapshot().events;
  assert.equal(events.duplicateCompletionPrevented, 1);
  assert.equal(events.terminalConflictPrevented, 2);
  assert.equal(events.staleRoute, 1);
});

test('existing telemetry envelope includes generation v3 reconciliation metrics', async () => {
  const { generationV3Metrics } = await loadGenerationMetrics();
  generationV3Metrics.reset();
  generationV3Metrics.recordEvent('quoteExpired');
  const telemetryModule: any = await import('../../services/api/routes/telemetry.js');
  const router = telemetryModule.default || telemetryModule;
  const metricsLayer = router.stack.find((layer: any) => layer.route?.path === '/v1/metrics');
  let payload: any;

  metricsLayer.route.stack[0].handle({}, {
    json(value: any) {
      payload = value;
      return value;
    },
  });

  assert.equal(payload.success, true);
  assert.equal(payload.data.generationV3.events.quoteExpired, 1);
  assert.ok(payload.data.imageDurableWorker);
});
