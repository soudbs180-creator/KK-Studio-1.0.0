import path from "node:path";
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
import { FileBackedJsonStore } from "./file-backed-json-store.ts";
import {
  type CreditAccountRepository,
  CreditTransactionNotFoundError,
  CreditTransactionNotRefundableError,
  type PersistedCreditMutation,
} from "./in-memory-credit-account-repository.ts";

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

interface PersistedCreditAccountState {
  version: 1;
  initialBalance: number;
  accounts: Record<string, CreditBalanceDto>;
  debitsByIdempotencyKey: Record<string, CreditLedgerEntry>;
  rechargesByIdempotencyKey: Record<string, CreditLedgerEntry>;
  transactionsById: Record<string, StoredCreditTransaction>;
  transactionsByUserId: Record<string, string[]>;
}

export interface FileBackedCreditAccountRepositoryOptions {
  filePath?: string;
  initialBalance?: number;
}

function buildDefaultFilePath(): string {
  const configuredPath = String(process.env.KK_LOCAL_BILLING_DATA_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), ".kk-local", "billing", "credit-accounts.json");
}

function isPersistedState(value: unknown): value is PersistedCreditAccountState {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && typeof (value as { accounts?: unknown }).accounts === "object"
    && typeof (value as { debitsByIdempotencyKey?: unknown }).debitsByIdempotencyKey === "object"
    && typeof (value as { rechargesByIdempotencyKey?: unknown }).rechargesByIdempotencyKey === "object"
    && typeof (value as { transactionsById?: unknown }).transactionsById === "object"
    && typeof (value as { transactionsByUserId?: unknown }).transactionsByUserId === "object"
  );
}

function createEmptyState(initialBalance: number): PersistedCreditAccountState {
  return {
    version: 1,
    initialBalance,
    accounts: {},
    debitsByIdempotencyKey: {},
    rechargesByIdempotencyKey: {},
    transactionsById: {},
    transactionsByUserId: {},
  };
}

function cloneAccount(account: CreditBalanceDto): CreditBalanceDto {
  return { ...account };
}

function cloneLedger(ledger: CreditLedgerEntry): CreditLedgerEntry {
  return { ...ledger };
}

function cloneTransaction(transaction: StoredCreditTransaction): StoredCreditTransaction {
  return {
    ...transaction,
    metadata: transaction.metadata ? { ...transaction.metadata } : undefined,
  };
}

export class FileBackedCreditAccountRepository implements CreditAccountRepository {
  private readonly initialBalance: number;
  private readonly store: FileBackedJsonStore<PersistedCreditAccountState>;

  constructor(options: FileBackedCreditAccountRepositoryOptions = {}) {
    this.initialBalance = Number.isInteger(options.initialBalance) ? Number(options.initialBalance) : 100;
    this.store = new FileBackedJsonStore<PersistedCreditAccountState>({
      filePath: options.filePath?.trim() ? options.filePath.trim() : buildDefaultFilePath(),
      createEmptyState: () => createEmptyState(this.initialBalance),
      isState: isPersistedState,
    });
  }

  async getOrCreate(userId: string): Promise<CreditBalanceDto> {
    return this.store.withState(async (state) => {
      const existing = state.accounts[userId];
      if (existing) {
        return {
          state,
          result: cloneAccount(existing),
        };
      }

      const created = createCreditAccount(userId, new Date().toISOString(), state.initialBalance);
      return {
        state: {
          ...state,
          accounts: {
            ...state.accounts,
            [userId]: created,
          },
        },
        result: cloneAccount(created),
      };
    });
  }

  async findDebitByIdempotencyKey(userId: string, idempotencyKey: string): Promise<CreditLedgerEntry | undefined> {
    const state = await this.store.readState();
    const existing = state.debitsByIdempotencyKey[this.buildIdempotencyKey(userId, idempotencyKey)];
    return existing ? cloneLedger(existing) : undefined;
  }

  async findRechargeByIdempotencyKey(userId: string, idempotencyKey: string): Promise<CreditLedgerEntry | undefined> {
    const state = await this.store.readState();
    const existing = state.rechargesByIdempotencyKey[this.buildIdempotencyKey(userId, idempotencyKey)];
    return existing ? cloneLedger(existing) : undefined;
  }

  async saveDebit(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation> {
    return this.store.withState(async (state) => ({
      state: this.storeAccountAndTransaction(state, account, ledger, {
        transactionType: "consumption",
        amount: -ledger.creditAmount,
        description: `Debit for ${ledger.businessRefType}:${ledger.businessRefId}`,
      }, "debit"),
      result: {
        account: cloneAccount(account),
        ledger: cloneLedger(ledger),
      },
    }));
  }

  async saveRecharge(account: CreditBalanceDto, ledger: CreditLedgerEntry): Promise<PersistedCreditMutation> {
    return this.store.withState(async (state) => ({
      state: this.storeAccountAndTransaction(state, account, ledger, {
        transactionType: "recharge",
        amount: ledger.creditAmount,
        description: `Recharge for ${ledger.businessRefId}`,
      }, "recharge"),
      result: {
        account: cloneAccount(account),
        ledger: cloneLedger(ledger),
      },
    }));
  }

  async listTransactions(
    userId: string,
    options?: { transactionType?: string; status?: string; limit?: number },
  ): Promise<CreditTransactionDto[]> {
    const state = await this.store.readState();
    const ids = state.transactionsByUserId[userId] || [];
    return ids
      .map((id) => state.transactionsById[id])
      .filter((value): value is StoredCreditTransaction => Boolean(value))
      .filter((transaction) => !options?.transactionType || transaction.transactionType === options.transactionType)
      .filter((transaction) => !options?.status || transaction.status === options.status)
      .slice(0, options?.limit || ids.length)
      .map((transaction) => this.toCreditTransactionDto(transaction));
  }

  async refundTransaction(
    userId: string,
    transactionId: string,
    reason = "Refund issued by migrated billing API.",
  ): Promise<RefundCreditsResponseDto> {
    return this.store.withState(async (state) => {
      const sourceTransaction = state.transactionsById[transactionId];
      if (!sourceTransaction || sourceTransaction.userId !== userId) {
        throw new CreditTransactionNotFoundError(transactionId);
      }

      if (sourceTransaction.transactionType !== "consumption" || sourceTransaction.status !== "completed") {
        throw new CreditTransactionNotRefundableError(transactionId);
      }

      const account = state.accounts[userId]
        ? cloneAccount(state.accounts[userId])
        : createCreditAccount(userId, new Date().toISOString(), state.initialBalance);
      const now = new Date().toISOString();
      const refundedAmount = Math.abs(sourceTransaction.amount);
      const updatedAccount: CreditBalanceDto = {
        ...account,
        balance: account.balance + refundedAmount,
        updatedAt: now,
      };
      const refundLedgerId = randomUUID();

      return {
        state: this.storeTransactionState({
          ...state,
          accounts: {
            ...state.accounts,
            [userId]: updatedAccount,
          },
          transactionsById: {
            ...state.transactionsById,
            [transactionId]: {
              ...cloneTransaction(sourceTransaction),
              status: "refunded",
            },
          },
        }, {
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
        }),
        result: {
          originalTransactionId: transactionId,
          refundedLedgerId: refundLedgerId,
          balanceAfter: updatedAccount.balance,
          transactionType: CreditTransactionType.Refund,
        },
      };
    });
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

    return this.store.withState(async (state) => {
      const account = state.accounts[trimmedIdentity]
        ? cloneAccount(state.accounts[trimmedIdentity])
        : createCreditAccount(trimmedIdentity, new Date().toISOString(), state.initialBalance);
      const now = new Date().toISOString();
      const updatedAccount: CreditBalanceDto = {
        ...account,
        balance: account.balance + creditAmount,
        updatedAt: now,
      };

      return {
        state: this.storeTransactionState({
          ...state,
          accounts: {
            ...state.accounts,
            [trimmedIdentity]: updatedAccount,
          },
        }, {
          id: randomUUID(),
          userId: trimmedIdentity,
          transactionType: "recharge",
          amount: creditAmount,
          balanceAfter: updatedAccount.balance,
          description,
          status: "completed",
          createdAt: now,
          completedAt: now,
        }),
        result: {
          identity: trimmedIdentity,
          subjectId: trimmedIdentity,
          balanceAfter: updatedAccount.balance,
          creditedAmount: creditAmount,
        },
      };
    });
  }

  async adminGetAccountByIdentity(
    identity: string,
    limit = 50,
  ): Promise<AdminCreditAccountLookupDto> {
    const trimmedIdentity = String(identity || "").trim();
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

  private storeAccountAndTransaction(
    state: PersistedCreditAccountState,
    account: CreditBalanceDto,
    ledger: CreditLedgerEntry,
    transaction: { transactionType: string; amount: number; description: string },
    kind: "debit" | "recharge",
  ): PersistedCreditAccountState {
    const nextState = {
      ...state,
      accounts: {
        ...state.accounts,
        [account.userId]: cloneAccount(account),
      },
      debitsByIdempotencyKey: {
        ...state.debitsByIdempotencyKey,
      },
      rechargesByIdempotencyKey: {
        ...state.rechargesByIdempotencyKey,
      },
    };
    const persistedLedger = cloneLedger(ledger);

    if (kind === "debit") {
      nextState.debitsByIdempotencyKey[this.buildIdempotencyKey(account.userId, ledger.idempotencyKey)] = persistedLedger;
    } else {
      nextState.rechargesByIdempotencyKey[this.buildIdempotencyKey(account.userId, ledger.idempotencyKey)] = persistedLedger;
    }

    return this.storeTransactionState(nextState, {
      id: persistedLedger.ledgerId,
      userId: persistedLedger.userId,
      transactionType: transaction.transactionType,
      amount: transaction.amount,
      balanceAfter: persistedLedger.balanceAfter,
      modelCode: persistedLedger.modelCode,
      description: transaction.description,
      status: "completed",
      metadata: {
        idempotency_key: persistedLedger.idempotencyKey,
      },
      businessRefType: persistedLedger.businessRefType,
      businessRefId: persistedLedger.businessRefId,
      createdAt: persistedLedger.createdAt,
      completedAt: persistedLedger.createdAt,
    });
  }

  private storeTransactionState(
    state: PersistedCreditAccountState,
    transaction: StoredCreditTransaction,
  ): PersistedCreditAccountState {
    return {
      ...state,
      transactionsById: {
        ...state.transactionsById,
        [transaction.id]: cloneTransaction(transaction),
      },
      transactionsByUserId: {
        ...state.transactionsByUserId,
        [transaction.userId]: [
          transaction.id,
          ...(state.transactionsByUserId[transaction.userId] || []).filter((id) => id !== transaction.id),
        ],
      },
    };
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
