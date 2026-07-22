import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test, before, beforeEach } from 'node:test';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// In-memory PostgreSQL mock for the generation-v3 billing lifecycle.
// This is intentionally simple: it only understands the exact statements
// issued by quoteEngine, jobLifecycle, billingSaga and credits.js.
// ---------------------------------------------------------------------------

class FakeDatabase {
  users = new Map<string, number>();
  costConfigs = new Map<string, { cost: number; is_active: boolean }>();
  quotes = new Map<string, any>();
  jobs = new Map<string, any>();
  items = new Map<string, any>();
  ledger = new Map<string, any>();
  creditLogs: any[] = [];
  private ledgerSeq = 1;

  reset() {
    this.users.clear();
    this.costConfigs.clear();
    this.quotes.clear();
    this.jobs.clear();
    this.items.clear();
    this.ledger.clear();
    this.creditLogs = [];
    this.ledgerSeq = 1;
  }

  seedUser(userId: string, credits: number) {
    this.users.set(userId, credits);
  }

  seedCost(operationKey: string, cost: number) {
    this.costConfigs.set(operationKey, { cost, is_active: true });
  }

  pool() {
    return {
      query: (sql: string, params?: any[]) => this.exec(sql, params),
      connect: async () => ({
        query: (sql: string, params?: any[]) => this.exec(sql, params),
        release: () => {},
      }),
    };
  }

  private exec(sql: string, params: any[] = []): { rows: any[] } {
    const lower = sql.toLowerCase().trim();
    const n = lower.replace(/\s+/g, ' ');

    if (n === 'begin' || n === 'commit' || n === 'rollback') {
      return { rows: [] };
    }

    // api_cost_config --------------------------------------------------------
    if (n.startsWith('select cost from public.api_cost_config')) {
      const key = params[0];
      const cfg = this.costConfigs.get(key);
      if (!cfg) return { rows: [] };
      return { rows: [{ cost: cfg.cost }] };
    }

    // users ------------------------------------------------------------------
    if (n.startsWith('select credits from public.users where id = $1')) {
      const balance = this.users.get(params[0]);
      return balance === undefined ? { rows: [] } : { rows: [{ credits: balance }] };
    }

    if (n.startsWith('update public.users set credits = credits -')) {
      const [amount, userId] = params;
      const current = this.users.get(userId) ?? 0;
      if (current < amount) return { rows: [] };
      const next = current - amount;
      this.users.set(userId, next);
      return { rows: [{ credits: next }] };
    }

    if (n.startsWith('update public.users set credits = credits +')) {
      const [amount, userId] = params;
      const next = (this.users.get(userId) ?? 0) + amount;
      this.users.set(userId, next);
      return { rows: [{ credits: next }] };
    }

    // credit_logs ------------------------------------------------------------
    if (n.startsWith('insert into public.credit_logs')) {
      this.creditLogs.push({
        user_id: params[0],
        delta: params[1],
        reason: params[2],
        operation_key: params[3],
        balance_after: params[4],
        actor_id: params[5],
      });
      return { rows: [] };
    }

    // generation_quotes ------------------------------------------------------
    if (n.startsWith('insert into public.generation_quotes')) {
      const parsed = this.parseInsert(sql, params);
      const row = {
        quote_id: parsed.quote_id,
        user_id: parsed.user_id,
        media_type: parsed.media_type,
        model: parsed.model,
        count: parsed.count,
        channel: parsed.channel,
        cost_credits: parsed.cost_credits,
        cost_provider_quota: parsed.cost_provider_quota,
        price_version: parsed.price_version,
        route_snapshot_json: this.parseJson(parsed.route_snapshot_json),
        expires_at: parsed.expires_at,
        created_at: parsed.created_at,
        updated_at: parsed.updated_at,
        status: parsed.status,
      };
      this.quotes.set(parsed.quote_id, row);
      return { rows: [] };
    }

    if (n.startsWith('select * from public.generation_quotes where quote_id = $1 and user_id = $2')) {
      const row = this.quotes.get(params[0]);
      return row && row.user_id === params[1] ? { rows: [this.serializeQuote(row)] } : { rows: [] };
    }

    if (n.startsWith("update public.generation_quotes set status = 'expired'")) {
      const row = this.quotes.get(params[0]);
      if (row) row.status = 'expired';
      return { rows: [] };
    }

    if (n.startsWith("update public.generation_quotes set status = 'consumed'")) {
      const row = this.quotes.get(params[0]);
      if (row) row.status = 'consumed';
      return { rows: [] };
    }

    // generation_jobs --------------------------------------------------------
    if (n.startsWith('insert into public.generation_jobs')) {
      const parsed = this.parseInsert(sql, params);
      this.jobs.set(parsed.job_id, {
        job_id: parsed.job_id,
        user_id: parsed.user_id,
        workspace_id: parsed.workspace_id,
        task_type: parsed.task_type,
        provider: parsed.provider,
        status: parsed.status,
        schema_version: parsed.schema_version,
        quote_id: parsed.quote_id,
        channel: parsed.channel,
        model_code: parsed.model_code,
        capability_version: parsed.capability_version,
        anonymous_key_slot_id: parsed.anonymous_key_slot_id,
        total_cost_credits: parsed.total_cost_credits,
        total_cost_provider_quota: parsed.total_cost_provider_quota,
        payload_json: this.parseJson(parsed.payload_json),
        created_at: parsed.created_at,
        updated_at: parsed.updated_at,
      });
      return { rows: [] };
    }

    if (n.startsWith('select * from public.generation_jobs where job_id = $1 and user_id = $2')) {
      const row = this.jobs.get(params[0]);
      return row && row.user_id === params[1] ? { rows: [this.serializeJob(row)] } : { rows: [] };
    }

    if (n.startsWith('update public.generation_jobs set status = $2')) {
      const row = this.jobs.get(params[0]);
      if (row) row.status = params[1];
      return { rows: [] };
    }

    // generation_job_items ---------------------------------------------------
    if (n.startsWith('insert into public.generation_job_items')) {
      const parsed = this.parseInsert(sql, params);
      this.items.set(parsed.item_id, {
        item_id: parsed.item_id,
        job_id: parsed.job_id,
        sequence: parsed.sequence,
        status: parsed.status,
        payload_json: this.parseJson(parsed.payload_json),
        canvas_node_id: parsed.canvas_node_id,
        reconciliation_status: 'pending',
      });
      return { rows: [] };
    }

    if (n.startsWith('select * from public.generation_job_items where job_id = $1 order by sequence')) {
      const rows = [...this.items.values()]
        .filter((it) => it.job_id === params[0])
        .sort((a, b) => a.sequence - b.sequence)
        .map((it) => this.serializeItem(it));
      return { rows };
    }

    if (n.startsWith('select * from public.generation_job_items where item_id = $1')) {
      const row = this.items.get(params[0]);
      return row ? { rows: [this.serializeItem(row)] } : { rows: [] };
    }

    if (n.startsWith('select status from public.generation_job_items where job_id = $1')) {
      const rows = [...this.items.values()]
        .filter((it) => it.job_id === params[0])
        .map((it) => ({ status: it.status }));
      return { rows };
    }

    if (n.startsWith('update public.generation_job_items set reservation_id = $2')) {
      const row = this.items.get(params[0]);
      if (row) row.reservation_id = params[1];
      return { rows: [] };
    }

    if (n.startsWith('update public.generation_job_items set ledger_id = $2')) {
      const row = this.items.get(params[0]);
      if (row) row.ledger_id = params[1];
      return { rows: [] };
    }

    if (n.startsWith('update public.generation_job_items set')) {
      const row = this.items.get(params[0]);
      if (row) {
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
          const assignments = setMatch[1].split(',').map((s) => s.trim());
          let paramIdx = 1; // placeholders start at $2 => params[1]
          for (const assignment of assignments) {
            if (assignment.toLowerCase().includes('= now()')) continue;
            const field = assignment.split('=')[0].trim().toLowerCase();
            const value = assignment.split('=')[1].trim();
            if (value.startsWith('$')) {
              if (field === 'status') row.status = params[paramIdx];
              else if (field === 'provider_task_id') row.provider_task_id = params[paramIdx];
              else if (field === 'asset_id') row.asset_id = params[paramIdx];
              else if (field === 'error_code') row.error_code = params[paramIdx];
              else if (field === 'error_message') row.error_message = params[paramIdx];
              paramIdx += 1;
            }
          }
        }
      }
      return { rows: [] };
    }

    // ledger_entries ---------------------------------------------------------
    if (n.startsWith('insert into public.ledger_entries')) {
      const parsed = this.parseInsert(sql, params);
      const id = `ledger-${this.ledgerSeq++}`;
      this.ledger.set(id, {
        ledger_id: id,
        user_id: parsed.user_id,
        quote_id: parsed.quote_id ?? null,
        job_id: parsed.job_id ?? null,
        item_id: parsed.item_id ?? null,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        status: parsed.status,
        metadata_json: this.parseJson(parsed.metadata_json),
      });
      return { rows: [{ ledger_id: id }] };
    }

    if (n.startsWith('update public.ledger_entries set status = \'committed\'')) {
      const row = this.ledger.get(params[0]);
      if (row) row.status = 'committed';
      return { rows: [] };
    }

    if (n.startsWith('update public.ledger_entries set status = \'failed\'')) {
      const row = this.ledger.get(params[0]);
      if (row) {
        row.status = 'failed';
        Object.assign(row.metadata_json, this.parseJson(params[1]));
      }
      return { rows: [] };
    }

    if (n.startsWith('update public.ledger_entries set type = \'charge\'')) {
      const row = this.ledger.get(params[0]);
      if (row && row.type === 'reserve' && row.status === 'committed') {
        row.type = 'charge';
        row.item_id = params[1];
        row.status = 'committed';
        Object.assign(row.metadata_json, this.parseJson(params[2]));
        return { rows: [{ ledger_id: row.ledger_id }] };
      }
      return { rows: [] };
    }

    if (n.startsWith('select amount from public.ledger_entries where ledger_id = $1 and type = \'reserve\'')) {
      const row = this.ledger.get(params[0]);
      return row && row.type === 'reserve' ? { rows: [{ amount: row.amount }] } : { rows: [] };
    }

    // failItem join select ----------------------------------------------------
    if (lower.includes('from public.generation_job_items ji')) {
      const item = this.items.get(params[0]);
      if (!item) return { rows: [] };
      const job = this.jobs.get(item.job_id);
      if (!job || job.user_id !== params[1]) return { rows: [] };
      const quote = this.quotes.get(job.quote_id);
      const reserve = this.ledger.get(item.reservation_id);
      return {
        rows: [
          {
            item_id: item.item_id,
            job_id: item.job_id,
            sequence: item.sequence,
            status: item.status,
            payload_json: item.payload_json,
            canvas_node_id: item.canvas_node_id,
            reservation_id: item.reservation_id,
            ledger_id: item.ledger_id,
            provider_task_id: item.provider_task_id,
            asset_id: item.asset_id,
            error_code: item.error_code,
            error_message: item.error_message,
            reconciliation_status: item.reconciliation_status,
            quote_id: job.quote_id,
            channel: job.channel,
            model_code: job.model_code,
            media_type: quote?.media_type,
            cost_credits: quote?.cost_credits,
            reserved_amount: reserve?.amount ?? 0,
          },
        ],
      };
    }

    throw new Error(`FakeDatabase: unhandled SQL: ${sql}`);
  }

  private parseInsert(sql: string, params: any[]) {
    const match = sql.match(/insert into\s+(?:public\.)?(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (!match) throw new Error(`Failed to parse INSERT: ${sql}`);
    const columns = match[2].split(',').map((s) => s.trim());
    const values = match[3].split(',').map((s) => s.trim());
    const row: Record<string, any> = {};
    values.forEach((v, i) => {
      const col = columns[i];
      if (v.startsWith('$')) {
        row[col] = params[parseInt(v.slice(1), 10) - 1];
      } else if (v.startsWith("'") && v.endsWith("'")) {
        row[col] = v.slice(1, -1);
      } else {
        row[col] = v;
      }
    });
    return row;
  }

  private parseJson(value: any) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private serializeQuote(row: any) {
    return {
      quote_id: row.quote_id,
      user_id: row.user_id,
      media_type: row.media_type,
      model: row.model,
      count: row.count,
      channel: row.channel,
      cost_credits: row.cost_credits,
      cost_provider_quota: row.cost_provider_quota,
      price_version: row.price_version,
      route_snapshot_json: row.route_snapshot_json,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.status,
    };
  }

  private serializeJob(row: any) {
    return {
      job_id: row.job_id,
      user_id: row.user_id,
      workspace_id: row.workspace_id,
      task_type: row.task_type,
      provider: row.provider,
      status: row.status,
      schema_version: row.schema_version,
      quote_id: row.quote_id,
      channel: row.channel,
      model_code: row.model_code,
      capability_version: row.capability_version,
      anonymous_key_slot_id: row.anonymous_key_slot_id,
      total_cost_credits: row.total_cost_credits,
      total_cost_provider_quota: row.total_cost_provider_quota,
      payload_json: row.payload_json,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private serializeItem(row: any) {
    return {
      item_id: row.item_id,
      job_id: row.job_id,
      sequence: row.sequence,
      status: row.status,
      payload_json: row.payload_json,
      canvas_node_id: row.canvas_node_id,
      reservation_id: row.reservation_id,
      ledger_id: row.ledger_id,
      provider_task_id: row.provider_task_id,
      asset_id: row.asset_id,
      error_code: row.error_code,
      error_message: row.error_message,
      reconciliation_status: row.reconciliation_status,
    };
  }
}

const fakeDb = new FakeDatabase();

// Patch getPool BEFORE requiring any module that destructures it at load time.
const db = require('../../services/api/lib/db.js');
db.getPool = () => fakeDb.pool();

const quoteEngine = require('../../services/api/lib/generation-v3/quoteEngine.js');
const jobLifecycle = require('../../services/api/lib/generation-v3/jobLifecycle.js');
const { fakeProviderAdapter, clearFakeTasks } = require('../../services/api/lib/generation-v3/fakeProviderAdapter.js');

beforeEach(() => {
  fakeDb.reset();
  clearFakeTasks();
});

const TEST_USER = 'user-billing-lifecycle';

function seedStandardUser() {
  fakeDb.seedUser(TEST_USER, 100);
  fakeDb.seedCost('image_generation', 10);
}

function makeQuoteRequest(overrides: any = {}) {
  return {
    mediaType: 'image',
    model: 'unknown-test-model',
    count: 2,
    preferredChannel: 'platform-credits',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('quote -> job creation reserves credits per item', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 3 }));
  assert.equal(quote.cost.credits, 30);
  assert.equal(quote.channel, 'platform-credits');
  assert.equal(quote.routeSnapshot.adapterId, 'fake-provider');
  assert.ok(quote.cost.priceVersion);

  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  assert.equal(job.status, 'reserved');
  assert.equal(job.items.length, 3);

  // Each item must hold its own reservation in the DB (DTO projection gaps are ok in Phase 1).
  const dbItems = [...fakeDb.items.values()].filter((it) => it.job_id === job.jobId);
  assert.equal(dbItems.length, 3);
  for (const item of dbItems) {
    assert.ok(item.reservation_id, 'item should have a reservation_id');
    assert.match(item.reservation_id, /^ledger-/);
  }

  assert.equal(fakeDb.users.get(TEST_USER), 70);
  assert.equal([...fakeDb.ledger.values()].filter((l) => l.type === 'reserve' && l.status === 'committed').length, 3);

  const storedQuote = fakeDb.quotes.get(quote.quoteId);
  assert.equal(storedQuote.status, 'consumed');
});

test('successful submit charges each reservation exactly once', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 2 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  assert.equal(fakeDb.users.get(TEST_USER), 80);

  const submitted = await jobLifecycle.submitJob(TEST_USER, job.jobId);
  assert.equal(submitted.status, 'completed');
  for (const item of submitted.items) {
    assert.equal(item.status, 'completed');
    assert.ok(item.assetId);
    assert.ok(item.providerTaskId);
  }

  // Credits stay deducted; reservations are converted to charges in-place.
  assert.equal(fakeDb.users.get(TEST_USER), 80);
  const ledger = [...fakeDb.ledger.values()];
  assert.equal(ledger.filter((l) => l.type === 'reserve').length, 0);
  assert.equal(ledger.filter((l) => l.type === 'charge' && l.status === 'committed').length, 2);
  assert.equal(ledger.filter((l) => l.type === 'refund').length, 0);
});

test('failed submit refunds the exact reserved amount per item', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 2 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  assert.equal(fakeDb.users.get(TEST_USER), 80);

  const originalSubmit = fakeProviderAdapter.submit.bind(fakeProviderAdapter);
  fakeProviderAdapter.submit = async () => ({
    status: 'failed',
    errorMessage: 'mock provider failure',
  });

  try {
    const submitted = await jobLifecycle.submitJob(TEST_USER, job.jobId);
    assert.equal(submitted.status, 'failed');
    for (const item of submitted.items) {
      assert.equal(item.status, 'failed');
      assert.equal(item.errorCode, 'PROVIDER_ERROR');
      assert.ok(item.errorMessage);
    }

    // Full refund restores the original balance.
    assert.equal(fakeDb.users.get(TEST_USER), 100);
    const ledger = [...fakeDb.ledger.values()];
    assert.equal(ledger.filter((l) => l.type === 'reserve' && l.status === 'committed').length, 2);
    assert.equal(ledger.filter((l) => l.type === 'refund' && l.status === 'committed').length, 2);
    assert.equal(ledger.filter((l) => l.type === 'charge').length, 0);
  } finally {
    fakeProviderAdapter.submit = originalSubmit;
  }
});

test('quote rejects platform-credits when balance is insufficient', async () => {
  fakeDb.seedUser(TEST_USER, 5);
  fakeDb.seedCost('image_generation', 10);

  await assert.rejects(
    () => quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 1 })),
    (err: any) => err.code === 'INSUFFICIENT_CREDITS' && err.statusCode === 402,
  );
});

test('setup-required channel is rejected at quote time', async () => {
  seedStandardUser();

  await assert.rejects(
    () => quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ preferredChannel: 'setup-required' })),
    (err: any) => err.code === 'SETUP_REQUIRED',
  );
});

test('completed item is idempotent and does not double-charge', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 1 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  const item = job.items[0];

  const url = 'https://fake-provider.kkstudio.local/artifacts/once.png';
  const pool = fakeDb.pool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await jobLifecycle.completeItem(TEST_USER, item.itemId, url, { client });
    await jobLifecycle.completeItem(TEST_USER, item.itemId, url, { client });
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const ledger = [...fakeDb.ledger.values()];
  assert.equal(ledger.filter((l) => l.type === 'charge').length, 1);
  assert.equal(fakeDb.users.get(TEST_USER), 90);
});

test('failed item is idempotent and does not double-refund', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 1 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  const item = job.items[0];

  const pool = fakeDb.pool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await jobLifecycle.failItem(TEST_USER, item.itemId, 'first failure', { client, errorCode: 'ERR_1' });
    await jobLifecycle.failItem(TEST_USER, item.itemId, 'second failure', { client, errorCode: 'ERR_2' });
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const stored = fakeDb.items.get(item.itemId);
  assert.equal(stored.status, 'failed');
  assert.equal(stored.error_code, 'ERR_1');
  assert.equal(fakeDb.users.get(TEST_USER), 100);
  const ledger = [...fakeDb.ledger.values()];
  assert.equal(ledger.filter((l) => l.type === 'refund').length, 1);
});

test('failed item cannot be resurrected and charged by a late completion', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 1 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  const item = job.items[0];
  const client = await fakeDb.pool().connect();
  try {
    await client.query('BEGIN');
    await jobLifecycle.failItem(TEST_USER, item.itemId, 'terminal failure', { client, errorCode: 'TERMINAL' });
    await jobLifecycle.completeItem(
      TEST_USER,
      item.itemId,
      'https://fake-provider.kkstudio.local/artifacts/late.png',
      { client },
    );
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const stored = fakeDb.items.get(item.itemId);
  assert.equal(stored.status, 'failed');
  assert.equal(stored.asset_id, undefined);
  const ledger = [...fakeDb.ledger.values()];
  assert.equal(ledger.filter((entry) => entry.type === 'charge').length, 0);
  assert.equal(ledger.filter((entry) => entry.type === 'refund').length, 1);
});

test('completed item cannot be downgraded by a late provider failure', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 1 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  const item = job.items[0];
  const client = await fakeDb.pool().connect();
  try {
    await client.query('BEGIN');
    await jobLifecycle.completeItem(
      TEST_USER,
      item.itemId,
      'https://fake-provider.kkstudio.local/artifacts/final.png',
      { client },
    );
    await jobLifecycle.failItem(TEST_USER, item.itemId, 'late failure', { client, errorCode: 'LATE' });
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  const stored = fakeDb.items.get(item.itemId);
  assert.equal(stored.status, 'completed');
  assert.equal(stored.error_code, undefined);
  const ledger = [...fakeDb.ledger.values()];
  assert.equal(ledger.filter((entry) => entry.type === 'charge').length, 1);
  assert.equal(ledger.filter((entry) => entry.type === 'refund').length, 0);
});

test('item cannot complete when its reservation is no longer chargeable', async () => {
  seedStandardUser();

  const quote = await quoteEngine.createQuote(TEST_USER, makeQuoteRequest({ count: 1 }));
  const job = await jobLifecycle.createJobFromQuote(TEST_USER, { quoteId: quote.quoteId });
  const item = job.items[0];
  const storedItem = fakeDb.items.get(item.itemId);
  const reservation = fakeDb.ledger.get(storedItem.reservation_id);
  reservation.type = 'charge';
  const client = await fakeDb.pool().connect();

  await assert.rejects(
    () => jobLifecycle.completeItem(
      TEST_USER,
      item.itemId,
      'https://fake-provider.kkstudio.local/artifacts/unpaid.png',
      { client },
    ),
    (error: any) => error.code === 'BILLING_SETTLEMENT_CONFLICT' && error.retryable === false,
  );

  assert.equal(fakeDb.items.get(item.itemId).status, 'pending');
  assert.equal(fakeDb.items.get(item.itemId).asset_id, undefined);
});
