import { randomUUID } from "node:crypto";

import {
  type AdminCreditAccountLookupDto,
  CreditTransactionType,
  type AdminRechargeCreditsResponseDto,
  type CreditBalanceDto,
  type CreditTransactionDto,
  type RefundCreditsResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { createCreditAccount, type CreditLedgerEntry } from "../domain/credit-account.ts";

export interface PersistedCreditMutation {
  account: CreditBalanceDto;
  ledger: CreditLedgerEntry;
}

export class CreditBalanceInsufficientError extends Error {
  readonly code = "CREDIT_BALANCE_INSUFFICIENT";
  readonly balance: number;

  constructor(balance: number) {
    super("The current credit balance is insufficient for this request.");
    this.balance = balance;
  }
}

export class CreditTransactionNotFoundError extends Error {
  readonly code = "CREDIT_TRANSACTION_NOT_FOUND";

  constructor(transactionId: string) {
    super(`No credit transaction matches ${transactionId}.`);
  }
}

export class CreditTransactionNotRefundableError extends Error {
  readonly code = "CREDIT_TRANSACTION_NOT_REFUNDABLE";

  constructor(transactionId: string) {
    super(`Credit transaction ${transactionId} cannot be refunded.`);
  }
}

interface StoredCreditTransaction {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  modelCode?: string;
  modelName?: string;
  providerCode?: string;
  description?: string;
  status: string;
  metadata?: Record<string, unknown>;
  businessRefType?: string;
  businessRefId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CreditAccountRepository {
  getOrCreate(userId: string): Promise<CreditBalanceDto>;
  findDebitByIdempotencyKey(userId: string, idempotencyKey: string): Promise<CreditLedgerEntry | undefined>;
  findRechargeByIdempotencyKey(userId: string, idempotencyKey: string): Promise<CreditLedgerEntry | undefined>;
  saveDebit(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation>;
  saveRecharge(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation>;
  listTransactions(
    userId: string,
    options?: { transactionType?: string; status?: string; limit?: number },
  ): Promise<CreditTransactionDto[]>;
  refundTransaction(
    userId: string,
    transactionId: string,
    reason?: string,
  ): Promise<RefundCreditsResponseDto>;
  adminRechargeByIdentity(
    identity: string,
    creditAmount: number,
    description?: string,
  ): Promise<AdminRechargeCreditsResponseDto>;
  adminGetAccountByIdentity(
    identity: string,
    limit?: number,
  ): Promise<AdminCreditAccountLookupDto>;
}

export class InMemoryCreditAccountRepository implements CreditAccountRepository {
  private readonly accounts = new Map<string, CreditBalanceDto>();
  private readonly debitsByIdempotencyKey = new Map<string, CreditLedgerEntry>();
  private readonly rechargesByIdempotencyKey = new Map<string, CreditLedgerEntry>();
  private readonly transactionsById = new Map<string, StoredCreditTransaction>();
  private readonly transactionsByUserId = new Map<string, string[]>();
  private readonly initialBalance: number;

  constructor(initialBalance = 0) {
    this.initialBalance = initialBalance;
  }

  async getOrCreate(userId: string): Promise<CreditBalanceDto> {
    const existing = this.accounts.get(userId);
    if (existing) {
      return { ...existing };
    }

    const created = createCreditAccount(userId, new Date().toISOString(), this.initialBalance);
    this.accounts.set(userId, created);
    return { ...created };
  }

  async findDebitByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CreditLedgerEntry | undefined> {
    const existing = this.debitsByIdempotencyKey.get(this.buildIdempotencyKey(userId, idempotencyKey));
    return existing ? { ...existing } : undefined;
  }

  async findRechargeByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<CreditLedgerEntry | undefined> {
    const existing = this.rechargesByIdempotencyKey.get(this.buildIdempotencyKey(userId, idempotencyKey));
    return existing ? { ...existing } : undefined;
  }

  async saveDebit(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation> {
    this.accounts.set(account.userId, { ...account });
    const persistedLedger = { ...ledger };
    this.debitsByIdempotencyKey.set(
      this.buildIdempotencyKey(account.userId, ledger.idempotencyKey),
      persistedLedger,
    );
    this.storeTransaction({
      id: persistedLedger.ledgerId,
      userId: persistedLedger.userId,
      transactionType: "consumption",
      amount: -persistedLedger.creditAmount,
      balanceAfter: persistedLedger.balanceAfter,
      modelCode: persistedLedger.modelCode,
      description: `Debit for ${persistedLedger.businessRefType}:${persistedLedger.businessRefId}`,
      status: "completed",
      metadata: {
        idempotency_key: persistedLedger.idempotencyKey,
      },
      businessRefType: persistedLedger.businessRefType,
      businessRefId: persistedLedger.businessRefId,
      createdAt: persistedLedger.createdAt,
      completedAt: persistedLedger.createdAt,
    });
    return {
      account: { ...account },
      ledger: persistedLedger,
    };
  }

  async saveRecharge(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation> {
    this.accounts.set(account.userId, { ...account });
    const persistedLedger = { ...ledger };
    this.rechargesByIdempotencyKey.set(
      this.buildIdempotencyKey(account.userId, ledger.idempotencyKey),
      persistedLedger,
    );
    this.storeTransaction({
      id: persistedLedger.ledgerId,
      userId: persistedLedger.userId,
      transactionType: "recharge",
      amount: persistedLedger.creditAmount,
      balanceAfter: persistedLedger.balanceAfter,
      description: `Recharge for ${persistedLedger.businessRefId}`,
      status: "completed",
      metadata: {
        idempotency_key: persistedLedger.idempotencyKey,
      },
      businessRefType: persistedLedger.businessRefType,
      businessRefId: persistedLedger.businessRefId,
      createdAt: persistedLedger.createdAt,
      completedAt: persistedLedger.createdAt,
    });
    return {
      account: { ...account },
      ledger: persistedLedger,
    };
  }

  async listTransactions(
    userId: string,
    options?: { transactionType?: string; status?: string; limit?: number },
  ): Promise<CreditTransactionDto[]> {
    const ids = this.transactionsByUserId.get(userId) || [];
    const items = ids
      .map((id) => this.transactionsById.get(id))
      .filter((value): value is StoredCreditTransaction => Boolean(value))
      .filter((transaction) => !options?.transactionType || transaction.transactionType === options.transactionType)
      .filter((transaction) => !options?.status || transaction.status === options.status)
      .slice(0, options?.limit || ids.length)
      .map((transaction) => this.toCreditTransactionDto(transaction));

    return items;
  }

  async refundTransaction(
    userId: string,
    transactionId: string,
    reason = "Refund issued by migrated billing API.",
  ): Promise<RefundCreditsResponseDto> {
    const sourceTransaction = this.transactionsById.get(transactionId);
    if (!sourceTransaction || sourceTransaction.userId !== userId) {
      throw new CreditTransactionNotFoundError(transactionId);
    }

    if (sourceTransaction.transactionType !== "consumption" || sourceTransaction.status !== "completed") {
      throw new CreditTransactionNotRefundableError(transactionId);
    }

    const account = await this.getOrCreate(userId);
    const now = new Date().toISOString();
    const refundedAmount = Math.abs(sourceTransaction.amount);
    const updatedAccount: CreditBalanceDto = {
      ...account,
      balance: account.balance + refundedAmount,
      updatedAt: now,
    };
    this.accounts.set(userId, updatedAccount);

    const refundedSource: StoredCreditTransaction = {
      ...sourceTransaction,
      status: "refunded",
    };
    this.transactionsById.set(transactionId, refundedSource);

    const refundLedgerId = randomUUID();
    this.storeTransaction({
      id: refundLedgerId,
      userId,
      transactionType: "refund",
      amount: refundedAmount,
      balanceAfter: updatedAccount.balance,
      modelCode: sourceTransaction.modelCode,
      modelName: sourceTransaction.modelName,
      providerCode: sourceTransaction.providerCode,
      description: reason,
      status: "completed",
      metadata: {
        source_transaction_id: transactionId,
      },
      businessRefType: sourceTransaction.businessRefType,
      businessRefId: sourceTransaction.businessRefId,
      createdAt: now,
      completedAt: now,
    });

    return {
      originalTransactionId: transactionId,
      refundedLedgerId: refundLedgerId,
      balanceAfter: updatedAccount.balance,
      transactionType: CreditTransactionType.Refund,
    };
  }

  async adminRechargeByIdentity(
    identity: string,
    creditAmount: number,
    description = "Admin recharge",
  ): Promise<AdminRechargeCreditsResponseDto> {
    const account = await this.getOrCreate(identity);
    const now = new Date().toISOString();
    const updatedAccount: CreditBalanceDto = {
      ...account,
      balance: account.balance + creditAmount,
      updatedAt: now,
    };
    this.accounts.set(identity, updatedAccount);

    this.storeTransaction({
      id: randomUUID(),
      userId: identity,
      transactionType: "recharge",
      amount: creditAmount,
      balanceAfter: updatedAccount.balance,
      description,
      status: "completed",
      createdAt: now,
      completedAt: now,
    });

    return {
      identity,
      subjectId: identity,
      balanceAfter: updatedAccount.balance,
      creditedAmount: creditAmount,
    };
  }

  async adminGetAccountByIdentity(
    identity: string,
    limit = 50,
  ): Promise<AdminCreditAccountLookupDto> {
    const trimmedIdentity = String(identity || '').trim();
    const account = await this.getOrCreate(trimmedIdentity);
    const transactions = await this.listTransactions(trimmedIdentity, { limit });

    return {
      identity: trimmedIdentity,
      subjectId: trimmedIdentity,
      balance: account.balance,
      frozenBalance: account.frozenBalance,
      transactions,
    };
  }

  private buildIdempotencyKey(userId: string, idempotencyKey: string): string {
    return `${userId}:${idempotencyKey}`;
  }

  private storeTransaction(transaction: StoredCreditTransaction): void {
    this.transactionsById.set(transaction.id, transaction);
    const current = this.transactionsByUserId.get(transaction.userId) || [];
    this.transactionsByUserId.set(transaction.userId, [transaction.id, ...current.filter((id) => id !== transaction.id)]);
  }

  private toCreditTransactionDto(transaction: StoredCreditTransaction): CreditTransactionDto {
    return {
      id: transaction.id,
      userId: transaction.userId,
      transactionType: transaction.transactionType,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      modelCode: transaction.modelCode,
      modelName: transaction.modelName,
      providerCode: transaction.providerCode,
      description: transaction.description,
      status: transaction.status,
      metadata: transaction.metadata,
      businessRefType: transaction.businessRefType,
      businessRefId: transaction.businessRefId,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
    };
  }
}
