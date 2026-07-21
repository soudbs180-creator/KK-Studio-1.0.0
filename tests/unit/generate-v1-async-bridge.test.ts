import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test, beforeEach } from 'node:test';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// In-memory PostgreSQL mock reused from generation-v3-billing-lifecycle.
// Only understands statements issued by quoteEngine, jobLifecycle, billingSaga
// and credits.js. Intentionally minimal.
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

    if (n.startsWith('select cost from public.api_cost_config')) {
      const key = params[0];
      const cfg = this.costConfigs.get(key);
      if (!cfg) return { rows: [] };
      return { rows: [{ cost: cfg.cost }] };
    }

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
          let paramIdx = 1;
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

    if (n.startsWith("update public.ledger_entries set status = 'committed'")) {
      const row = this.ledger.get(params[0]);
      if (row) row.status = 'committed';
      return { rows: [] };
    }

    if (n.startsWith("update public.ledger_entries set status = 'failed'")) {
      const row = this.ledger.get(params[0]);
      if (row) {
        row.status = 'failed';
        Object.assign(row.metadata_json, this.parseJson(params[1]));
      }
      return { rows: [] };
    }

    if (n.startsWith("update public.ledger_entries set type = 'charge'")) {
      const row = this.ledger.get(params[0]);
      if (row) {
        row.type = 'charge';
        row.item_id = params[1];
        row.status = 'committed';
        Object.assign(row.metadata_json, this.parseJson(params[2]));
      }
      return { rows: [] };
    }

    if (n.startsWith("select amount from public.ledger_entries where ledger_id = $1 and type = 'reserve'")) {
      const row = this.ledger.get(params[0]);
      return row && row.type === 'reserve' ? { rows: [{ amount: row.amount }] } : { rows: [] };
    }

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

// Patch getPool BEFORE requiring modules that destructure it at load time.
const db = require('../../services/api/lib/db.js');
db.getPool = () => fakeDb.pool();

const { _helpers } = require('../../services/api/routes/generate-v1.js');
const { clearFakeTasks } = require('../../services/api/lib/generation-v3/fakeProviderAdapter.js');

beforeEach(() => {
  fakeDb.reset();
  clearFakeTasks();
});

const TEST_USER = 'user-async-bridge';

function seedStandardUser() {
  fakeDb.seedUser(TEST_USER, 100);
  fakeDb.seedCost('image_generation', 10);
}

function makeSubmitReq(overrides: any = {}) {
  return {
    body: {
      mode: 'image',
      model: 'unknown-test-model',
      prompt: 'a cyberpunk cat',
      count: 1,
      ...overrides,
    },
    headers: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('submitAsyncViaGenerationV3 creates quote, job and submits via platform-credits', async () => {
  seedStandardUser();

  const result = await _helpers.submitAsyncViaGenerationV3(TEST_USER, makeSubmitReq());

  assert.equal(result.success, true);
  assert.equal(result.data.status, 'success');
  assert.ok(result.data.taskId);
  assert.ok(result.data.quoteId);
  assert.ok(result.data.jobId);
  assert.ok(result.data.url);
  assert.equal(result.data.modelId, 'unknown-test-model');
  assert.equal(result.data.endpointType, 'generation-v3-image');

  // Credits deducted and converted to charge.
  assert.equal(fakeDb.users.get(TEST_USER), 90);
  const charges = [...fakeDb.ledger.values()].filter((l) => l.type === 'charge' && l.status === 'committed');
  assert.equal(charges.length, 1);
});

test('submitAsyncViaGenerationV3 rejects insufficient credits', async () => {
  fakeDb.seedUser(TEST_USER, 5);
  fakeDb.seedCost('image_generation', 10);

  await assert.rejects(
    () => _helpers.submitAsyncViaGenerationV3(TEST_USER, makeSubmitReq()),
    (err: any) => err.code === 'INSUFFICIENT_CREDITS' && err.statusCode === 402,
  );
});

test('queryAsyncStatusViaGenerationV3 reads job status by taskId', async () => {
  seedStandardUser();

  const submitResult = await _helpers.submitAsyncViaGenerationV3(TEST_USER, makeSubmitReq());
  const taskId = submitResult.data.taskId;

  const statusReq = {
    body: { mode: 'task_status', taskId },
    headers: {},
  };

  const result = await _helpers.queryAsyncStatusViaGenerationV3(TEST_USER, statusReq);
  assert.equal(result.success, true);
  assert.equal(result.data.status, 'success');
  assert.equal(result.data.taskId, taskId);
  assert.ok(result.data.url);
});
