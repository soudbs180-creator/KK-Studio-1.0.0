import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  type AdminCreditAccountLookupDto,
  CreditTransactionType,
  type AdminRechargeCreditsResponseDto,
  type CreditBalanceDto,
  type CreditTransactionDto,
  type RefundCreditsResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { CreditLedgerEntry } from "../domain/credit-account.ts";
import {
  CreditBalanceInsufficientError,
  type CreditAccountRepository,
  CreditTransactionNotFoundError,
  CreditTransactionNotRefundableError,
  type PersistedCreditMutation,
} from "./in-memory-credit-account-repository.ts";

interface UserCreditsRow {
  user_id: string;
  balance: string | number;
  email?: string | null;
  total_earned?: string | number | null;
  version?: number | null;
  frozen: string | number;
  created_at: string | null;
  updated_at: string | null;
}

interface CreditTransactionRow {
  id: string;
  user_id: string;
  amount: string | number;
  type: string;
  balance_after: number;
  model_id: string | null;
  metadata: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
  idempotency_key: string | null;
  business_ref_type: string | null;
  business_ref_id: string | null;
  status: string | null;
  description: string | null;
  model_name: string | null;
  provider_id: string | null;
}

interface PersistedAccountPayload {
  account_id: string;
  user_id: string;
  balance: number;
  frozen_balance: number;
  created_at: string;
  updated_at: string;
}

interface PersistedLedgerPayload {
  ledger_id: string;
  user_id: string;
  business_ref_type: string;
  business_ref_id: string;
  credit_amount: number;
  model_code?: string;
  idempotency_key: string;
  balance_after: number;
  transaction_type: string;
  created_at: string;
}

interface PersistedMutationPayload {
  success: boolean;
  code?: string;
  message?: string;
  balance?: number;
  account?: PersistedAccountPayload;
  ledger?: PersistedLedgerPayload;
}

interface RefundCreditsRpcRow {
  success: boolean;
  new_balance: number | null;
  message: string | null;
}

export interface SupabaseCreditAccountRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function toCreditBalanceDto(row: UserCreditsRow | PersistedAccountPayload, userId?: string): CreditBalanceDto {
  const accountUserId = "user_id" in row ? row.user_id : (userId || "");
  const createdAt = "created_at" in row && row.created_at ? row.created_at : buildFallbackTimestamp();
  const updatedAt = "updated_at" in row && row.updated_at ? row.updated_at : createdAt;
  const balance = "balance" in row ? parseInteger(row.balance) : 0;
  const frozenBalance = "frozen_balance" in row
    ? parseInteger(row.frozen_balance)
    : parseInteger((row as UserCreditsRow).frozen);

  return {
    accountId: "account_id" in row ? row.account_id : accountUserId,
    userId: accountUserId,
    balance,
    frozenBalance,
    createdAt,
    updatedAt,
  };
}

function toCreditLedgerEntry(row: CreditTransactionRow): CreditLedgerEntry {
  const metadata = row.metadata || {};
  const businessRefType = row.business_ref_type
    || String(metadata.business_ref_type || "");
  const businessRefId = row.business_ref_id
    || String(metadata.business_ref_id || "");
  const idempotencyKey = row.idempotency_key
    || String(metadata.idempotency_key || "");
  const modelCode = row.model_id
    || (typeof metadata.model_code === "string" ? metadata.model_code : undefined);
  const transactionType = row.type === "recharge"
    ? CreditTransactionType.Recharge
    : CreditTransactionType.Debit;

  return {
    ledgerId: row.id,
    userId: row.user_id,
    businessRefType,
    businessRefId,
    creditAmount: Math.abs(parseInteger(row.amount)),
    modelCode,
    idempotencyKey,
    balanceAfter: parseInteger(row.balance_after),
    transactionType,
    createdAt: row.completed_at || row.created_at,
  };
}

function toPersistedMutation(payload: PersistedMutationPayload): PersistedCreditMutation {
  if (!payload.account || !payload.ledger) {
    throw new Error("The Supabase billing RPC did not return a persisted account and ledger payload.");
  }

  return {
    account: toCreditBalanceDto(payload.account),
    ledger: {
      ledgerId: payload.ledger.ledger_id,
      userId: payload.ledger.user_id,
      businessRefType: payload.ledger.business_ref_type,
      businessRefId: payload.ledger.business_ref_id,
      creditAmount: payload.ledger.credit_amount,
      modelCode: payload.ledger.model_code,
      idempotencyKey: payload.ledger.idempotency_key,
      balanceAfter: payload.ledger.balance_after,
      transactionType: payload.ledger.transaction_type as CreditLedgerEntry["transactionType"],
      createdAt: payload.ledger.created_at,
    },
  };
}

function toCreditTransactionDto(row: CreditTransactionRow): CreditTransactionDto {
  return {
    id: row.id,
    userId: row.user_id,
    transactionType: row.type,
    amount: parseInteger(row.amount),
    balanceAfter: parseInteger(row.balance_after),
    modelCode: row.model_id,
    modelName: row.model_name,
    providerCode: row.provider_id,
    description: row.description,
    status: row.status,
    metadata: row.metadata || undefined,
    businessRefType: row.business_ref_type || undefined,
    businessRefId: row.business_ref_id || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export class SupabaseCreditAccountRepository implements CreditAccountRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseCreditAccountRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async getOrCreate(userId: string): Promise<CreditBalanceDto> {
    this.assertUserId(userId);

    const existing = await this.getExistingAccount(userId);
    if (existing) {
      return toCreditBalanceDto(existing);
    }

    const { error: insertError } = await this.client
      .from("user_credits")
      .insert({
        user_id: userId,
        balance: 0,
      });

    if (insertError) {
      // Another request may have created the row after our existence check.
      if (String(insertError.code || "") !== "23505") {
        throw insertError;
      }
    }

    const created = await this.getExistingAccount(userId);
    if (created) {
      return toCreditBalanceDto(created);
    }

    return {
      accountId: userId,
      userId,
      balance: 0,
      frozenBalance: 0,
      createdAt: buildFallbackTimestamp(),
      updatedAt: buildFallbackTimestamp(),
    };
  }

  async findDebitByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CreditLedgerEntry | undefined> {
    return this.findByTypeAndIdempotencyKey(userId, "consumption", idempotencyKey);
  }

  async findRechargeByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CreditLedgerEntry | undefined> {
    return this.findByTypeAndIdempotencyKey(userId, "recharge", idempotencyKey);
  }

  async saveDebit(
    account: CreditBalanceDto,
    ledger: CreditLedgerEntry,
  ): Promise<PersistedCreditMutation> {
    const payload = await this.runMutationRpc("api_record_credit_debit_v1", {
      p_user_id: account.userId,
      p_ledger_id: ledger.ledgerId,
      p_business_ref_type: ledger.businessRefType,
      p_business_ref_id: ledger.businessRefId,
      p_credit_amount: ledger.creditAmount,
      p_idempotency_key: ledger.idempotencyKey,
      p_model_code: ledger.modelCode || null,
    });

    if (!payload.success) {
      if (payload.code === "CREDIT_BALANCE_INSUFFICIENT") {
        throw new CreditBalanceInsufficientError(parseInteger(payload.balance));
      }

      throw new Error(payload.message || "Supabase debit RPC failed.");
    }

    return toPersistedMutation(payload);
  }

  async saveRecharge(
    account: CreditBalanceDto,
    ledger: CreditLedgerEntry,
  ): Promise<PersistedCreditMutation> {
    const payload = await this.runMutationRpc("api_record_payment_settlement_v1", {
      p_user_id: account.userId,
      p_ledger_id: ledger.ledgerId,
      p_payment_order_id: ledger.businessRefId,
      p_credit_amount: ledger.creditAmount,
      p_callback_id: ledger.idempotencyKey,
    });

    if (!payload.success) {
      throw new Error(payload.message || "Supabase payment settlement RPC failed.");
    }

    return toPersistedMutation(payload);
  }

  async listTransactions(
    userId: string,
    options?: { transactionType?: string; status?: string; limit?: number },
  ): Promise<CreditTransactionDto[]> {
    this.assertUserId(userId);

    let query = this.client
      .from("credit_transactions")
      .select([
        "id",
        "user_id",
        "amount",
        "type",
        "balance_after",
        "model_id",
        "model_name",
        "provider_id",
        "description",
        "status",
        "metadata",
        "completed_at",
        "created_at",
        "idempotency_key",
        "business_ref_type",
        "business_ref_id",
      ].join(", "))
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(options?.limit || 100, 500)));

    if (options?.transactionType) {
      query = query.eq("type", options.transactionType);
    }

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query.returns<CreditTransactionRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map((row) => toCreditTransactionDto(row));
  }

  async refundTransaction(
    userId: string,
    transactionId: string,
    reason = "Refund issued by migrated billing API.",
  ): Promise<RefundCreditsResponseDto> {
    this.assertUserId(userId);

    const sourceTransaction = await this.findTransactionById(userId, transactionId);
    if (!sourceTransaction) {
      throw new CreditTransactionNotFoundError(transactionId);
    }

    if (sourceTransaction.transactionType !== "consumption" || sourceTransaction.status !== "completed") {
      throw new CreditTransactionNotRefundableError(transactionId);
    }

    const { data, error } = await this.client.rpc("refund_credits", {
      p_transaction_id: transactionId,
      p_reason: reason,
    });

    if (error) {
      throw error;
    }

    const payload = Array.isArray(data)
      ? (data[0] as RefundCreditsRpcRow | undefined)
      : (data as RefundCreditsRpcRow | undefined);

    if (!payload?.success) {
      throw new CreditTransactionNotRefundableError(transactionId);
    }

    const { data: refundRows, error: refundLookupError } = await this.client
      .from("credit_transactions")
      .select([
        "id",
        "user_id",
        "amount",
        "type",
        "balance_after",
        "model_id",
        "model_name",
        "provider_id",
        "description",
        "status",
        "metadata",
        "completed_at",
        "created_at",
        "idempotency_key",
        "business_ref_type",
        "business_ref_id",
      ].join(", "))
      .eq("user_id", userId)
      .eq("type", "refund")
      .eq("metadata->>source_transaction_id", transactionId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<CreditTransactionRow[]>();

    if (refundLookupError) {
      throw refundLookupError;
    }

    return {
      originalTransactionId: transactionId,
      refundedLedgerId: refundRows?.[0]?.id,
      balanceAfter: parseInteger(payload.new_balance),
      transactionType: CreditTransactionType.Refund,
    };
  }

  async adminRechargeByIdentity(
    identity: string,
    creditAmount: number,
    description = "Admin recharge",
  ): Promise<AdminRechargeCreditsResponseDto> {
    const trimmedIdentity = String(identity || "").trim();
    if (!trimmedIdentity) {
      throw new Error("identity is required for admin recharge.");
    }

    if (!Number.isInteger(creditAmount) || creditAmount < 1) {
      throw new Error("creditAmount must be a positive integer.");
    }

    const resolvedUser = await this.resolveUserByIdentity(trimmedIdentity);
    if (!resolvedUser) {
      throw new Error("The requested recharge target could not be resolved.");
    }

    const now = new Date().toISOString();
    const existingAccount = await this.getExistingAccount(resolvedUser.subjectId);
    const nextBalance = parseInteger(existingAccount?.balance) + creditAmount;
    const nextTotalEarned = parseInteger(existingAccount?.total_earned) + creditAmount;
    const nextVersion = parseInteger(existingAccount?.version) + (existingAccount ? 1 : 1);

    if (existingAccount) {
      const { error: updateError } = await this.client
        .from("user_credits")
        .update({
          balance: nextBalance,
          total_earned: nextTotalEarned,
          version: nextVersion,
          last_transaction_at: now,
          updated_at: now,
          email: resolvedUser.email || existingAccount.email || null,
        })
        .eq("user_id", resolvedUser.subjectId);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await this.client
        .from("user_credits")
        .insert({
          user_id: resolvedUser.subjectId,
          email: resolvedUser.email || null,
          balance: nextBalance,
          total_earned: creditAmount,
          version: 1,
          last_transaction_at: now,
          updated_at: now,
        });

      if (insertError) {
        throw insertError;
      }
    }

    const { error: transactionError } = await this.client
      .from("credit_transactions")
      .insert({
        user_id: resolvedUser.subjectId,
        email: resolvedUser.email || null,
        type: "recharge",
        amount: creditAmount,
        balance_after: nextBalance,
        description,
        status: "completed",
        completed_at: now,
        business_ref_type: "admin_recharge",
        business_ref_id: resolvedUser.subjectId,
        metadata: {
          source: "api_admin_recharge",
          identity: trimmedIdentity,
        },
      });

    if (transactionError) {
      throw transactionError;
    }

    return {
      identity: trimmedIdentity,
      subjectId: resolvedUser.subjectId,
      balanceAfter: nextBalance,
      creditedAmount: creditAmount,
      subjectEmail: resolvedUser.email,
    };
  }

  async adminGetAccountByIdentity(
    identity: string,
    limit = 50,
  ): Promise<AdminCreditAccountLookupDto> {
    const trimmedIdentity = String(identity || "").trim();
    const resolvedUser = await this.resolveUserByIdentity(trimmedIdentity);
    if (!resolvedUser) {
      throw new Error("The requested credit account could not be resolved.");
    }

    const account = await this.getOrCreate(resolvedUser.subjectId);
    const transactions = await this.listTransactions(resolvedUser.subjectId, { limit });

    return {
      identity: trimmedIdentity,
      subjectId: resolvedUser.subjectId,
      subjectEmail: resolvedUser.email,
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
    this.assertUserId(userId);

    const { data, error } = await this.client
      .from("credit_transactions")
      .select([
        "id",
        "user_id",
        "amount",
        "type",
        "balance_after",
        "model_id",
        "metadata",
        "completed_at",
        "created_at",
        "idempotency_key",
        "business_ref_type",
        "business_ref_id",
      ].join(", "))
      .eq("user_id", userId)
      .eq("type", type)
      .eq("idempotency_key", idempotencyKey)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<CreditTransactionRow>();

    if (error) {
      throw error;
    }

    return data ? toCreditLedgerEntry(data) : undefined;
  }

  private async findTransactionById(
    userId: string,
    transactionId: string,
  ): Promise<CreditTransactionDto | undefined> {
    const { data, error } = await this.client
      .from("credit_transactions")
      .select([
        "id",
        "user_id",
        "amount",
        "type",
        "balance_after",
        "model_id",
        "model_name",
        "provider_id",
        "description",
        "status",
        "metadata",
        "completed_at",
        "created_at",
        "idempotency_key",
        "business_ref_type",
        "business_ref_id",
      ].join(", "))
      .eq("id", transactionId)
      .eq("user_id", userId)
      .maybeSingle<CreditTransactionRow>();

    if (error) {
      throw error;
    }

    return data ? toCreditTransactionDto(data) : undefined;
  }

  private async getExistingAccount(userId: string): Promise<UserCreditsRow | undefined> {
    const { data, error } = await this.client
      .from("user_credits")
      .select("user_id, balance, email, total_earned, version, frozen, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle<UserCreditsRow>();

    if (error) {
      throw error;
    }

    return data || undefined;
  }

  private async runMutationRpc(
    procedure: "api_record_credit_debit_v1" | "api_record_payment_settlement_v1",
    params: Record<string, unknown>,
  ): Promise<PersistedMutationPayload> {
    const { data, error } = await this.client.rpc(procedure, params);

    if (error) {
      throw error;
    }

    return (data || {}) as PersistedMutationPayload;
  }

  private async resolveUserByIdentity(
    identity: string,
  ): Promise<{ subjectId: string; email?: string } | undefined> {
    const trimmedIdentity = identity.trim();
    if (!trimmedIdentity) {
      return undefined;
    }

    if (isUuid(trimmedIdentity)) {
      const profileById = await this.client
        .from("profiles")
        .select("id, email")
        .eq("id", trimmedIdentity)
        .maybeSingle<{ id: string; email: string | null }>();

      if (profileById.error) {
        throw profileById.error;
      }

      if (profileById.data) {
        return {
          subjectId: profileById.data.id,
          email: profileById.data.email || undefined,
        };
      }

      const accountById = await this.client
        .from("user_credits")
        .select("user_id, email")
        .eq("user_id", trimmedIdentity)
        .maybeSingle<{ user_id: string; email: string | null }>();

      if (accountById.error) {
        throw accountById.error;
      }

      if (accountById.data) {
        return {
          subjectId: accountById.data.user_id,
          email: accountById.data.email || undefined,
        };
      }

      const authLookup = await this.client.auth.admin.getUserById(trimmedIdentity);
      if (!authLookup.error && authLookup.data.user) {
        return {
          subjectId: authLookup.data.user.id,
          email: authLookup.data.user.email,
        };
      }
    }

    const profileByEmail = await this.client
      .from("profiles")
      .select("id, email")
      .eq("email", trimmedIdentity)
      .maybeSingle<{ id: string; email: string | null }>();

    if (profileByEmail.error) {
      throw profileByEmail.error;
    }

    if (profileByEmail.data) {
      return {
        subjectId: profileByEmail.data.id,
        email: profileByEmail.data.email || undefined,
      };
    }

    const accountByEmail = await this.client
      .from("user_credits")
      .select("user_id, email")
      .eq("email", trimmedIdentity)
      .maybeSingle<{ user_id: string; email: string | null }>();

    if (accountByEmail.error) {
      throw accountByEmail.error;
    }

    if (accountByEmail.data) {
      return {
        subjectId: accountByEmail.data.user_id,
        email: accountByEmail.data.email || undefined,
      };
    }

    return this.findAuthUserByEmail(trimmedIdentity);
  }

  private async findAuthUserByEmail(
    email: string,
  ): Promise<{ subjectId: string; email?: string } | undefined> {
    let page = 1;

    while (page <= 20) {
      const result = await this.client.auth.admin.listUsers({
        page,
        perPage: 200,
      });

      if (result.error) {
        throw result.error;
      }

      const users = result.data?.users || [];
      const matched = users.find((user) => String(user.email || "").toLowerCase() === email.toLowerCase());
      if (matched) {
        return {
          subjectId: matched.id,
          email: matched.email,
        };
      }

      if (users.length < 200) {
        break;
      }

      page += 1;
    }

    return undefined;
  }

  private assertUserId(userId: string): void {
    if (!isUuid(userId)) {
      throw new Error("Supabase billing repository requires a UUID user identity.");
    }
  }
}
