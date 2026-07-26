import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test, beforeEach } from 'node:test';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// In-memory PostgreSQL mock for the dispatcher billing saga + reconciliation.
// It only understands the exact statements issued by credits.js and
// dispatcher/reconciliation.js.
// ---------------------------------------------------------------------------

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// 与 services/api/lib/dispatcher/reconciliation.js 的 STALE_JOB_INTERVAL 保持一致。
// 该阈值必须大于异步媒体 Provider 的最坏轮询时长，否则会误退在途请求。
const STALE_MINUTES = 60;

class FakeDatabase {
  users = new Map<string, number>();
  jobs = new Map<string, { id: string; user_id: string; operation_key: string; required_credits: number; status: string; updatedAt: number }>();
  costConfigs = new Map<string, number>();
  creditLogs: any[] = [];
  failUserCreditUpdateFor: string | null = null;

  reset() {
    this.users.clear();
    this.jobs.clear();
    this.costConfigs.clear();
    this.creditLogs = [];
    this.failUserCreditUpdateFor = null;
  }

  seedUser(userId: string, credits: number) {
    this.users.set(userId, credits);
  }

  seedCost(operationKey: string, cost: number) {
    this.costConfigs.set(operationKey, cost);
  }

  seedJob(id: string, userId: string, status: string, requiredCredits: number, ageMs: number) {
    this.jobs.set(id, {
      id,
      user_id: userId,
      operation_key: `op:${id}`,
      required_credits: requiredCredits,
      status,
      updatedAt: Date.now() - ageMs,
    });
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

  private snapshot: { users: Map<string, number>; jobs: Map<string, any>; creditLogs: any[] } | null = null;

  private exec(sql: string, params: any[] = []): { rows: any[]; rowCount: number } {
    const n = sql.toLowerCase().trim().replace(/\s+/g, ' ');

    const result = (rows: any[]): { rows: any[]; rowCount: number } => ({ rows, rowCount: rows.length });

    // 简易事务：BEGIN 建快照，ROLLBACK 恢复，COMMIT 丢弃。用于验证
    // “抢占任务单 + 退款 + 审计日志”确实在同一事务内原子生效/回滚。
    if (n === 'begin') {
      this.snapshot = {
        users: new Map(this.users),
        jobs: new Map([...this.jobs.entries()].map(([key, job]) => [key, { ...job }])),
        creditLogs: this.creditLogs.map((log) => ({ ...log })),
      };
      return result([]);
    }
    if (n === 'rollback') {
      if (this.snapshot) {
        this.users = this.snapshot.users;
        this.jobs = this.snapshot.jobs;
        this.creditLogs = this.snapshot.creditLogs;
        this.snapshot = null;
      }
      return result([]);
    }
    if (n === 'commit') {
      this.snapshot = null;
      return result([]);
    }

    // api_cost_config --------------------------------------------------------
    if (n.startsWith('select cost from public.api_cost_config')) {
      const cost = this.costConfigs.get(params[0]);
      return cost === undefined ? result([]) : result([{ cost }]);
    }

    // users ------------------------------------------------------------------
    if (n.startsWith('select credits from public.users where id = $1')) {
      const balance = this.users.get(params[0]);
      return balance === undefined ? result([]) : result([{ credits: balance }]);
    }

    if (n.startsWith('update public.users set credits = credits -')) {
      const [amount, userId] = params;
      const current = this.users.get(userId) ?? 0;
      if (current < amount) return result([]);
      const next = current - amount;
      this.users.set(userId, next);
      return result([{ credits: next }]);
    }

    if (n.startsWith('update public.users set credits = credits +')) {
      const [amount, userId] = params;
      if (this.failUserCreditUpdateFor === userId) {
        throw new Error('simulated user credit update failure');
      }
      const next = (this.users.get(userId) ?? 0) + amount;
      this.users.set(userId, next);
      return result([{ credits: next }]);
    }

    // credit_logs ------------------------------------------------------------
    if (n.startsWith('insert into public.credit_logs')) {
      this.creditLogs.push({
        user_id: params[0],
        delta: params[1],
        reason: params[2],
        operation_key: params[3],
        balance_after: params[4],
      });
      return result([]);
    }

    // billing_jobs -----------------------------------------------------------
    if (n.startsWith('insert into public.billing_jobs')) {
      const [id, userId, operationKey, requiredCredits] = params;
      if (this.jobs.has(id)) {
        return result([]); // ON CONFLICT (id) DO NOTHING
      }
      this.jobs.set(id, {
        id,
        user_id: userId,
        operation_key: operationKey,
        required_credits: Number(requiredCredits),
        status: 'draft',
        updatedAt: Date.now(),
      });
      return result([{ id }]);
    }

    if (n.startsWith("update public.billing_jobs set status = 'completed'")) {
      const job = this.jobs.get(params[0]);
      if (!job || job.status !== 'pending_deducted') return result([]);
      job.status = 'completed';
      job.updatedAt = Date.now();
      return result([{ id: job.id }]);
    }

    if (n.startsWith("update public.billing_jobs set status = 'pending_deducted'")) {
      const job = this.jobs.get(params[0]);
      if (!job) return result([]);
      job.status = 'pending_deducted';
      job.updatedAt = Date.now();
      return result([]);
    }

    if (n.startsWith("update public.billing_jobs set status = 'refunded'")) {
      const job = this.jobs.get(params[0]);
      if (!job || job.status !== 'pending_deducted') return result([]);
      job.status = 'refunded';
      job.updatedAt = Date.now();
      return result([{ id: job.id }]);
    }

    if (n.startsWith("update public.billing_jobs set status = 'failed'") && n.includes("where status = 'draft'")) {
      const stale = [...this.jobs.values()].filter(
        (job) => job.status === 'draft' && job.updatedAt < Date.now() - DAY
      );
      for (const job of stale) {
        job.status = 'failed';
        job.updatedAt = Date.now();
      }
      return result(stale.map((job) => ({ id: job.id })));
    }

    if (n.startsWith("update public.billing_jobs set status = 'failed'") && n.includes('where id = $1')) {
      const job = this.jobs.get(params[0]);
      if (!job || (n.includes("status = 'pending_deducted'") && job.status !== 'pending_deducted')) {
        return result([]);
      }
      job.status = 'failed';
      job.updatedAt = Date.now();
      return result([{ id: job.id }]);
    }

    if (n.startsWith('select id, user_id, operation_key, required_credits from public.billing_jobs')) {
      const rows = [...this.jobs.values()]
        .filter((job) => job.status === 'pending_deducted' && job.updatedAt < Date.now() - STALE_MINUTES * MINUTE)
        .slice(0, 50)
        .map((job) => ({
          id: job.id,
          user_id: job.user_id,
          operation_key: job.operation_key,
          required_credits: job.required_credits,
        }));
      return result(rows);
    }

    // reconciliation audit cleanup ------------------------------------------
    if (n.startsWith('delete from public.recharge_submissions') || n.startsWith('delete from public.credit_transactions')) {
      return result([]);
    }

    throw new Error(`FakeDatabase does not understand statement: ${sql}`);
  }
}

const fakeDb = new FakeDatabase();

// Patch getPool BEFORE requiring any module that destructures it at load time.
const db = require('../../services/api/lib/db.js');
db.getPool = () => fakeDb.pool();

const credits = require('../../services/api/lib/credits.js');
const { reconcilePendingJobs } = require('../../services/api/lib/dispatcher/reconciliation.js');
const generationBillingSaga = require('../../services/api/lib/generation/generationBillingSaga.js');

beforeEach(() => {
  fakeDb.reset();
});

test('deductCredits with billingJobId marks the billing job pending_deducted in the same transaction', async () => {
  fakeDb.seedUser('u1', 100);
  fakeDb.seedJob('job-1', 'u1', 'draft', 10, 0);

  const remaining = await credits.deductCredits('u1', 10, 'op:test', { billingJobId: 'job-1' });

  assert.equal(remaining, 90);
  assert.equal(fakeDb.jobs.get('job-1')!.status, 'pending_deducted');
  assert.equal(fakeDb.creditLogs.length, 1);
  assert.equal(fakeDb.creditLogs[0].reason, 'ai_deduct');
});

test('deductCredits keeps the billing job in draft when the balance is insufficient', async () => {
  fakeDb.seedUser('u1', 5);
  fakeDb.seedJob('job-1', 'u1', 'draft', 10, 0);

  await assert.rejects(
    () => credits.deductCredits('u1', 10, 'op:test', { billingJobId: 'job-1' }),
    (err: any) => err.code === 'INSUFFICIENT_CREDITS'
  );

  assert.equal(fakeDb.jobs.get('job-1')!.status, 'draft');
  assert.equal(fakeDb.users.get('u1'), 5);
});

test('refundCredits with billingJobId claims pending_deducted atomically and is idempotent', async () => {
  fakeDb.seedUser('u1', 90);
  fakeDb.seedJob('job-1', 'u1', 'pending_deducted', 10, 0);

  const first = await credits.refundCredits('u1', 10, 'op:test', 0, { billingJobId: 'job-1' });
  assert.equal(first, 100);
  assert.equal(fakeDb.jobs.get('job-1')!.status, 'refunded');

  // Second refund attempt must be skipped: the claim fails, no credits move.
  const second = await credits.refundCredits('u1', 10, 'op:test', 0, { billingJobId: 'job-1' });
  assert.equal(second, null);
  assert.equal(fakeDb.users.get('u1'), 100);
  assert.equal(fakeDb.creditLogs.filter((log) => log.reason === 'ai_refund').length, 1);
});

test('refundCredits with billingJobId skips jobs that already reached a terminal state', async () => {
  fakeDb.seedUser('u1', 90);
  fakeDb.seedJob('job-1', 'u1', 'completed', 10, 0);

  const outcome = await credits.refundCredits('u1', 10, 'op:test', 0, { billingJobId: 'job-1' });
  assert.equal(outcome, null);
  assert.equal(fakeDb.users.get('u1'), 90);
});

test('reconcilePendingJobs refunds stale pending_deducted jobs and leaves fresh ones alone', async () => {
  fakeDb.seedUser('u1', 90);
  fakeDb.seedJob('stale-job', 'u1', 'pending_deducted', 10, 90 * MINUTE);
  // 25 分钟已超过视频轮询上限（180 × 5s = 15 分钟），但仍在阈值内：
  // 守护绝不能退款，否则慢媒体请求会变成“免费生成 + 假退款”。
  fakeDb.seedJob('inflight-job', 'u1', 'pending_deducted', 10, 25 * MINUTE);

  await reconcilePendingJobs();

  assert.equal(fakeDb.jobs.get('stale-job')!.status, 'refunded');
  assert.equal(fakeDb.jobs.get('inflight-job')!.status, 'pending_deducted');
  assert.equal(fakeDb.users.get('u1'), 100);
});

test('reconcilePendingJobs expires stale drafts without refunding them', async () => {
  fakeDb.seedUser('u1', 100);
  fakeDb.seedJob('old-draft', 'u1', 'draft', 10, 2 * DAY);
  fakeDb.seedJob('new-draft', 'u1', 'draft', 10, 1 * MINUTE);

  await reconcilePendingJobs();

  assert.equal(fakeDb.jobs.get('old-draft')!.status, 'failed');
  assert.equal(fakeDb.jobs.get('new-draft')!.status, 'draft');
  assert.equal(fakeDb.users.get('u1'), 100);
  assert.equal(fakeDb.creditLogs.length, 0);
});

test('reconcilePendingJobs marks jobs failed for manual review when the refund itself fails', async () => {
  fakeDb.seedUser('u1', 90);
  fakeDb.seedJob('doomed-job', 'u1', 'pending_deducted', 10, 90 * MINUTE);
  fakeDb.failUserCreditUpdateFor = 'u1';

  await reconcilePendingJobs();

  assert.equal(fakeDb.jobs.get('doomed-job')!.status, 'failed');
  assert.equal(fakeDb.users.get('u1'), 90);
});

// ---------------------------------------------------------------------------
// v1 图像生成链路（generationBillingSaga）：此前完全不写持久化任务单，
// 扣款后进程崩溃将留下无法被任何守护发现的空扣积分。
// ---------------------------------------------------------------------------

test('generation saga creates a durable billing job and settles it on success', async () => {
  fakeDb.seedUser('u1', 100);
  fakeDb.seedCost('image_generation', 10);

  let statusDuringProviderCall: string | undefined;
  const result = await generationBillingSaga.execute(
    'u1',
    'image_generation',
    { requestId: 'req-1' },
    async () => {
      // 关键断言：Provider 调用期间任务单必须已处于 pending_deducted。
      // 若此刻进程崩溃，对账守护能凭该状态发现并退款。
      statusDuringProviderCall = fakeDb.jobs.get('req-1')?.status;
      return { urls: ['https://example.test/a.png'] };
    }
  );

  assert.equal(statusDuringProviderCall, 'pending_deducted');
  assert.equal(fakeDb.jobs.get('req-1')!.status, 'completed');
  assert.equal(fakeDb.users.get('u1'), 90);
  assert.equal(result.billing.refundApplied, false);
});

test('generation saga refunds and marks the job refunded when generation fails', async () => {
  fakeDb.seedUser('u1', 100);
  fakeDb.seedCost('image_generation', 10);

  await assert.rejects(
    () => generationBillingSaga.execute('u1', 'image_generation', { requestId: 'req-2' }, async () => {
      throw new Error('provider exploded');
    }),
    (err: any) => err.code === 'AI_GENERATION_FAILED' && err.billing?.refundApplied === true
  );

  assert.equal(fakeDb.jobs.get('req-2')!.status, 'refunded');
  assert.equal(fakeDb.users.get('u1'), 100);
});

test('generation saga refuses to charge twice for a replayed requestId', async () => {
  fakeDb.seedUser('u1', 100);
  fakeDb.seedCost('image_generation', 10);

  await generationBillingSaga.execute('u1', 'image_generation', { requestId: 'req-3' }, async () => ({
    urls: ['https://example.test/a.png'],
  }));
  assert.equal(fakeDb.users.get('u1'), 90);

  let generateCalled = false;
  await assert.rejects(
    () => generationBillingSaga.execute('u1', 'image_generation', { requestId: 'req-3' }, async () => {
      generateCalled = true;
      return { urls: [] };
    }),
    (err: any) => err.code === 'DUPLICATE_REQUEST' && err.statusCode === 409
  );

  assert.equal(generateCalled, false, '重放请求不得再次调用 Provider');
  assert.equal(fakeDb.users.get('u1'), 90, '重放请求不得重复扣费');
});

test('generation saga leaves a crashed job discoverable by the reconciliation daemon', async () => {
  fakeDb.seedUser('u1', 100);
  fakeDb.seedCost('image_generation', 10);

  // 模拟进程在 Provider 调用期间死亡：扣款已提交，任务单停在 pending_deducted，
  // 后续的退款逻辑从未执行（用 reject 之外的方式跳出，避免走 saga 的退款分支）。
  await assert.rejects(
    () => generationBillingSaga.execute('u1', 'image_generation', { requestId: 'req-4' }, async () => {
      fakeDb.failUserCreditUpdateFor = 'u1'; // 让 saga 自身的退款补偿也失败，等价于崩溃后无人收尾
      throw new Error('process died mid-flight');
    }),
    (err: any) => err.code === 'REFUND_FAILED'
  );

  assert.equal(fakeDb.users.get('u1'), 90, '积分此刻仍处于被扣状态');
  assert.equal(fakeDb.jobs.get('req-4')!.status, 'failed');

  // 恢复退款能力后，把任务单放回 pending_deducted 并调老，验证守护能兜底退款。
  fakeDb.failUserCreditUpdateFor = null;
  const job = fakeDb.jobs.get('req-4')!;
  job.status = 'pending_deducted';
  job.updatedAt = Date.now() - 90 * MINUTE;

  await reconcilePendingJobs();

  assert.equal(fakeDb.jobs.get('req-4')!.status, 'refunded');
  assert.equal(fakeDb.users.get('u1'), 100, '守护补偿后积分已归还');
});

test('reconcilePendingJobs keeps compensating the batch after one job fails', async () => {
  // 坏任务属于退款必然失败的 u1，好任务属于 u2；坏任务排在前面，
  // 用于确认单个失败不会中断整批补偿（此前的实现会整批中断）。
  fakeDb.seedUser('u1', 90);
  fakeDb.seedUser('u2', 50);
  fakeDb.seedJob('doomed-job', 'u1', 'pending_deducted', 10, 90 * MINUTE);
  fakeDb.seedJob('healthy-job', 'u2', 'pending_deducted', 10, 90 * MINUTE);
  fakeDb.failUserCreditUpdateFor = 'u1';

  await reconcilePendingJobs();

  assert.equal(fakeDb.jobs.get('doomed-job')!.status, 'failed');
  assert.equal(fakeDb.jobs.get('healthy-job')!.status, 'refunded');
  assert.equal(fakeDb.users.get('u2'), 60);
});
