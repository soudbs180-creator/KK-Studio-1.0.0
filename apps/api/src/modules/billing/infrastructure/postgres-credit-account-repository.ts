import { randomUUID } from "node:crypto";

import {
  type AdminCreditAccountLookupDto,
  CreditTransactionType,
  type AdminRechargeCreditsResponseDto,
  type CreditBalanceDto,
  type CreditTransactionDto,
  type RefundCreditsResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import type { Pool, PoolClient } from "pg";
import type { CreditLedgerEntry } from "../domain/credit-account.ts";
import {
  CreditBalanceInsufficientError,
  CreditTransactionNotFoundError,
  CreditTransactionNotRefundableError,
  InMemoryCreditAccountRepository,
  type CreditAccountRepository,
  type PersistedCreditMutation,
} from "./in-memory-credit-account-repository.ts";

interface UserCreditsRow {
  user_id: string;
  email?: string | null;
  balance: string | number;
  frozen: string | number;
  created_at: string | null;
  updated_at: string | null;
}

interface CreditTransactionRow {
  id: string;
  user_id: string;
  amount: string | number;
  type: string;
  balance_after: string | number;
  model_id?: string | null;
  model_name?: string | null;
  provider_id?: string | null;
  description?: string | null;
  status?: string | null;
  metadata_json?: Record<string, unknown> | null;
  completed_at?: string | null;
  created_at: string;
  idempotency_key?: string | null;
  business_ref_type?: string | null;
  business_ref_id?: string | null;
}

function parseInteger(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    return Math.trunc(Number(value));
  }
  return 0;
}

function buildFallbackTimestamp(): string {
  return new Date().toISOString();
}

function toCreditBalanceDto(row: UserCreditsRow | undefined, userId: string, initialBalance = 0): CreditBalanceDto {
  if (!row) {
    const now = buildFallbackTimestamp();
    return {
      accountId: userId,
      userId,
      balance: initialBalance,
      frozenBalance: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    accountId: row.user_id,
    userId: row.user_id,
    balance: parseInteger(row.balance),
    frozenBalance: parseInteger(row.frozen),
    createdAt: row.created_at || buildFallbackTimestamp(),
    updatedAt: row.updated_at || row.created_at || buildFallbackTimestamp(),
  };
}

function toCreditLedgerEntry(row: CreditTransactionRow): CreditLedgerEntry {
  const metadata = row.metadata_json || {};
  return {
    ledgerId: row.id,
    userId: row.user_id,
    businessRefType: row.business_ref_type || String(metadata.business_ref_type || ""),
    businessRefId: row.business_ref_id || String(metadata.business_ref_id || ""),
    creditAmount: Math.abs(parseInteger(row.amount)),
    modelCode: row.model_id || (typeof metadata.model_code === "string" ? metadata.model_code : undefined),
    idempotencyKey: row.idempotency_key || String(metadata.idempotency_key || ""),
    balanceAfter: parseInteger(row.balance_after),
    transactionType: row.type === "recharge" ? CreditTransactionType.Recharge : CreditTransactionType.Debit,
    createdAt: row.completed_at || row.created_at,
  };
}

function toCreditTransactionDto(row: CreditTransactionRow): CreditTransactionDto {
  return {
    id: row.id,
    userId: row.user_id,
    transactionType: row.type,
    amount: parseInteger(row.amount),
    balanceAfter: parseInteger(row.balance_after),
    modelCode: row.model_id || undefined,
    modelName: row.model_name || undefined,
    providerCode: row.provider_id || undefined,
    description: row.description || undefined,
    status: row.status || undefined,
    metadata: row.metadata_json || undefined,
    businessRefType: row.business_ref_type || undefined,
    businessRefId: row.business_ref_id || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  };
}

export class PostgresCreditAccountRepository implements CreditAccountRepository {
  private readonly queryable: PostgresQueryable;
  private readonly initialBalance: number;

  constructor(queryable: PostgresQueryable, initialBalance = 0) {
    this.queryable = queryable;
    this.initialBalance = initialBalance;
  }

  /**
   * 在事务中执行回调。如果 queryable 是 Pool，则从池中获取客户端并用
   * BEGIN/COMMIT/ROLLBACK 包裹；否则降级为直接执行（兼容内存仓库测试场景）。
   */
  private async withTransaction<T>(fn: (client: PostgresQueryable) => Promise<T>): Promise<T> {
    const pool = this.queryable as unknown as Pool;
    if (typeof pool.connect !== 'function') {
      // 非 Pool 场景（如测试），直接执行
      return fn(this.queryable);
    }
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getOrCreate(userId: string): Promise<CreditBalanceDto> {
    const existing = await this.getExistingAccount(userId);
    if (existing) {
      return toCreditBalanceDto(existing, userId);
    }

    const now = new Date().toISOString();
    const profile = await this.findProfileByIdentity(userId);
    await this.queryable.query(
      `insert into user_credits (
         user_id, email, balance, frozen, created_at, updated_at
       ) values (
         $1, $2, $3, 0, $4, $4
       )
       on conflict (user_id) do nothing`,
      [userId, profile?.email || null, this.initialBalance, now],
    );

    return toCreditBalanceDto(await this.getExistingAccount(userId), userId, this.initialBalance);
  }

  async findDebitByIdempotencyKey(userId: string, idempotencyKey: string): Promise<CreditLedgerEntry | undefined> {
    return this.findByTypeAndIdempotencyKey(userId, "consumption", idempotencyKey);
  }

  async findRechargeByIdempotencyKey(userId: string, idempotencyKey: string): Promise<CreditLedgerEntry | undefined> {
    return this.findByTypeAndIdempotencyKey(userId, "recharge", idempotencyKey);
  }

  async saveDebit(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation> {
    return this.withTransaction(async (tx) => {
      // 使用 SELECT ... FOR UPDATE 行级锁，防止并发扣费竞态
      const lockResult = await tx.query(
        `SELECT balance, frozen FROM user_credits WHERE user_id = $1 FOR UPDATE`,
        [account.userId],
      );
      let currentBalance: number;
      let currentFrozen: number;
      if (lockResult.rows.length === 0) {
        // 用户不存在，创建账户
        const created = await this.getOrCreate(account.userId);
        currentBalance = created.balance;
        currentFrozen = created.frozenBalance;
      } else {
        currentBalance = parseInteger(lockResult.rows[0].balance);
        currentFrozen = parseInteger(lockResult.rows[0].frozen);
      }

      if (currentBalance < ledger.creditAmount) {
        throw new CreditBalanceInsufficientError(currentBalance);
      }

      const now = ledger.createdAt || new Date().toISOString();
      const nextBalance = currentBalance - ledger.creditAmount;
      await this.upsertAccountWithQueryable(tx, account.userId, nextBalance, currentFrozen, now);
      await this.insertTransactionWithQueryable(tx, {
        id: ledger.ledgerId,
        userId: account.userId,
        type: "consumption",
        amount: -ledger.creditAmount,
        balanceAfter: nextBalance,
        modelId: ledger.modelCode,
        description: `Debit for ${ledger.businessRefType}:${ledger.businessRefId}`,
        status: "completed",
        metadata: { idempotency_key: ledger.idempotencyKey },
        businessRefType: ledger.businessRefType,
        businessRefId: ledger.businessRefId,
        createdAt: now,
        completedAt: now,
        idempotencyKey: ledger.idempotencyKey,
      });

      return {
        account: {
          accountId: account.userId,
          userId: account.userId,
          balance: nextBalance,
          frozenBalance: currentFrozen,
          createdAt: account.createdAt || now,
          updatedAt: now,
        },
        ledger: {
          ...ledger,
          balanceAfter: nextBalance,
        },
      };
    });
  }

  async saveRecharge(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation> {
    const current = await this.getOrCreate(account.userId);
    const now = ledger.createdAt || new Date().toISOString();
    const nextBalance = current.balance + ledger.creditAmount;
    await this.upsertAccount(account.userId, nextBalance, current.frozenBalance, now);
    await this.insertTransaction({
      id: ledger.ledgerId,
      userId: account.userId,
      type: "recharge",
      amount: ledger.creditAmount,
      balanceAfter: nextBalance,
      description: `Recharge for ${ledger.businessRefId}`,
      status: "completed",
      metadata: { idempotency_key: ledger.idempotencyKey },
      businessRefType: ledger.businessRefType,
      businessRefId: ledger.businessRefId,
      createdAt: now,
      completedAt: now,
      idempotencyKey: ledger.idempotencyKey,
    });

    return {
      account: {
        ...current,
        balance: nextBalance,
        updatedAt: now,
      },
      ledger: {
        ...ledger,
        balanceAfter: nextBalance,
      },
    };
  }

  async listTransactions(
    userId: string,
    options?: { transactionType?: string; status?: string; limit?: number },
  ): Promise<CreditTransactionDto[]> {
    const filters: string[] = [`user_id = $1`];
    const values: unknown[] = [userId];

    if (options?.transactionType) {
      values.push(options.transactionType);
      filters.push(`type = $${values.length}`);
    }
    if (options?.status) {
      values.push(options.status);
      filters.push(`status = $${values.length}`);
    }

    const limit = Math.max(1, Math.min(options?.limit || 100, 500));
    values.push(limit);
    const result = await this.queryable.query(
      `select *
         from credit_transactions
        where ${filters.join(" and ")}
        order by created_at desc
        limit $${values.length}`,
      values,
    );

    return (result.rows as CreditTransactionRow[]).map((row) => toCreditTransactionDto(row));
  }

  async refundTransaction(
    userId: string,
    transactionId: string,
    reason = "Refund issued by migrated billing API.",
  ): Promise<RefundCreditsResponseDto> {
    // 先在事务外做只读检查，快速失败
    const source = await this.findTransactionById(userId, transactionId);
    if (!source) {
      throw new CreditTransactionNotFoundError(transactionId);
    }
    if (source.transactionType !== "consumption" || source.status !== "completed") {
      throw new CreditTransactionNotRefundableError(transactionId);
    }

    return this.withTransaction(async (tx) => {
      // 在事务中锁定用户余额行
      const lockResult = await tx.query(
        `SELECT balance, frozen FROM user_credits WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const currentBalance = lockResult.rows.length > 0 ? parseInteger(lockResult.rows[0].balance) : 0;
      const currentFrozen = lockResult.rows.length > 0 ? parseInteger(lockResult.rows[0].frozen) : 0;

      // 在事务中再次确认交易状态，防止并发重复退款
      const txCheck = await tx.query(
        `SELECT status FROM credit_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [transactionId, userId],
      );
      if (!txCheck.rows[0] || txCheck.rows[0].status !== 'completed') {
        throw new CreditTransactionNotRefundableError(transactionId);
      }

      const refundedAmount = Math.abs(source.amount);
      const now = new Date().toISOString();
      const nextBalance = currentBalance + refundedAmount;
      await this.upsertAccountWithQueryable(tx, userId, nextBalance, currentFrozen, now);
      await tx.query(
        `UPDATE credit_transactions SET status = 'refunded' WHERE id = $1`,
        [transactionId],
      );

      const refundLedgerId = randomUUID();
      await this.insertTransactionWithQueryable(tx, {
        id: refundLedgerId,
        userId,
        type: "refund",
        amount: refundedAmount,
        balanceAfter: nextBalance,
        modelId: source.modelCode || undefined,
        modelName: source.modelName || undefined,
        providerId: source.providerCode || undefined,
        description: reason,
        status: "completed",
        metadata: { source_transaction_id: transactionId },
        businessRefType: source.businessRefType || undefined,
        businessRefId: source.businessRefId || undefined,
        createdAt: now,
        completedAt: now,
      });

      return {
        originalTransactionId: transactionId,
        refundedLedgerId: refundLedgerId,
        balanceAfter: nextBalance,
        transactionType: CreditTransactionType.Refund,
      };
    });
  }

  async adminRechargeByIdentity(
    identity: string,
    creditAmount: number,
    description = "Admin recharge",
  ): Promise<AdminRechargeCreditsResponseDto> {
    const normalizedIdentity = String(identity || "").trim();
    const profile = await this.findProfileByIdentity(normalizedIdentity);
    const subjectId = profile?.id || normalizedIdentity;
    const current = await this.getOrCreate(subjectId);
    const now = new Date().toISOString();
    const nextBalance = current.balance + creditAmount;
    await this.upsertAccount(subjectId, nextBalance, current.frozenBalance, now, profile?.email);
    await this.insertTransaction({
      id: randomUUID(),
      userId: subjectId,
      type: "recharge",
      amount: creditAmount,
      balanceAfter: nextBalance,
      description,
      status: "completed",
      metadata: { source: "api_admin_recharge", identity: normalizedIdentity },
      businessRefType: "admin_recharge",
      businessRefId: subjectId,
      createdAt: now,
      completedAt: now,
    });

    return {
      identity: normalizedIdentity,
      subjectId,
      balanceAfter: nextBalance,
      creditedAmount: creditAmount,
    };
  }

  async adminGetAccountByIdentity(
    identity: string,
    limit = 50,
  ): Promise<AdminCreditAccountLookupDto> {
    const normalizedIdentity = String(identity || "").trim();
    const profile = await this.findProfileByIdentity(normalizedIdentity);
    const subjectId = profile?.id || normalizedIdentity;
    const account = await this.getOrCreate(subjectId);
    const transactions = await this.listTransactions(subjectId, { limit });
    return {
      identity: normalizedIdentity,
      subjectId,
      balance: account.balance,
      frozenBalance: account.frozenBalance,
      transactions,
    };
  }

  private async findByTypeAndIdempotencyKey(
    userId: string,
    type: "consumption" | "recharge",
    idempotencyKey: string,
  ): Promise<CreditLedgerEntry | undefined> {
    const result = await this.queryable.query(
      `select *
         from credit_transactions
        where user_id = $1
          and type = $2
          and idempotency_key = $3
        order by created_at desc
        limit 1`,
      [userId, type, idempotencyKey],
    );
    const row = result.rows[0] as CreditTransactionRow | undefined;
    return row ? toCreditLedgerEntry(row) : undefined;
  }

  private async findTransactionById(userId: string, transactionId: string): Promise<CreditTransactionDto | undefined> {
    const result = await this.queryable.query(
      `select *
         from credit_transactions
        where id = $1
          and user_id = $2
        limit 1`,
      [transactionId, userId],
    );
    const row = result.rows[0] as CreditTransactionRow | undefined;
    return row ? toCreditTransactionDto(row) : undefined;
  }

  private async getExistingAccount(userId: string): Promise<UserCreditsRow | undefined> {
    const result = await this.queryable.query(
      `select user_id, email, balance, frozen, created_at, updated_at
         from user_credits
        where user_id = $1
        limit 1`,
      [userId],
    );
    return result.rows[0] as UserCreditsRow | undefined;
  }

  private async upsertAccount(
    userId: string,
    balance: number,
    frozen: number,
    updatedAt: string,
    email?: string | null,
  ): Promise<void> {
    await this.upsertAccountWithQueryable(this.queryable, userId, balance, frozen, updatedAt, email);
  }

  private async upsertAccountWithQueryable(
    q: PostgresQueryable,
    userId: string,
    balance: number,
    frozen: number,
    updatedAt: string,
    email?: string | null,
  ): Promise<void> {
    await q.query(
      `insert into user_credits (
         user_id, email, balance, frozen, created_at, updated_at
       ) values (
         $1, $2, $3, $4, $5, $5
       )
       on conflict (user_id) do update
         set email = coalesce(excluded.email, user_credits.email),
             balance = excluded.balance,
             frozen = excluded.frozen,
             updated_at = excluded.updated_at`,
      [userId, email || null, balance, frozen, updatedAt],
    );
  }

  private async findProfileByIdentity(identity: string): Promise<{ id: string; email?: string | null } | undefined> {
    const normalizedIdentity = String(identity || "").trim();
    if (!normalizedIdentity) {
      return undefined;
    }

    const result = await this.queryable.query(
      `select id, email
         from profiles
        where id = $1
           or lower(email) = lower($1)
        order by case when id = $1 then 0 else 1 end
        limit 1`,
      [normalizedIdentity],
    );

    return result.rows[0] as { id: string; email?: string | null } | undefined;
  }

  private async insertTransaction(input: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    modelId?: string;
    modelName?: string;
    providerId?: string;
    description?: string;
    status: string;
    metadata?: Record<string, unknown>;
    businessRefType?: string;
    businessRefId?: string;
    createdAt: string;
    completedAt?: string;
    idempotencyKey?: string;
  }): Promise<void> {
    await this.insertTransactionWithQueryable(this.queryable, input);
  }

  private async insertTransactionWithQueryable(q: PostgresQueryable, input: {
    id: string;
    userId: string;
    type: string;
    amount: number;
    balanceAfter: number;
    modelId?: string;
    modelName?: string;
    providerId?: string;
    description?: string;
    status: string;
    metadata?: Record<string, unknown>;
    businessRefType?: string;
    businessRefId?: string;
    createdAt: string;
    completedAt?: string;
    idempotencyKey?: string;
  }): Promise<void> {
    await q.query(
      `insert into credit_transactions (
         id, user_id, amount, type, balance_after, model_id, model_name, provider_id,
         description, status, metadata_json, completed_at, created_at, idempotency_key,
         business_ref_type, business_ref_id
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11::jsonb, $12, $13, $14,
         $15, $16
       )
       on conflict (id) do update
         set amount = excluded.amount,
             type = excluded.type,
             balance_after = excluded.balance_after,
             model_id = excluded.model_id,
             model_name = excluded.model_name,
             provider_id = excluded.provider_id,
             description = excluded.description,
             status = excluded.status,
             metadata_json = excluded.metadata_json,
             completed_at = excluded.completed_at,
             created_at = excluded.created_at,
             idempotency_key = excluded.idempotency_key,
             business_ref_type = excluded.business_ref_type,
             business_ref_id = excluded.business_ref_id`,
      [
        input.id,
        input.userId,
        input.amount,
        input.type,
        input.balanceAfter,
        input.modelId || null,
        input.modelName || null,
        input.providerId || null,
        input.description || null,
        input.status,
        JSON.stringify(input.metadata || {}),
        input.completedAt || null,
        input.createdAt,
        input.idempotencyKey || null,
        input.businessRefType || null,
        input.businessRefId || null,
      ],
    );
  }
}

export function createCreditAccountRepositoryFromEnv(): CreditAccountRepository | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  return new PostgresCreditAccountRepository(getSharedPostgresPool());
}
