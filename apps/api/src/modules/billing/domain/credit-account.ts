import { randomUUID } from "node:crypto";

import {
  CreditTransactionType,
  domainEventNames,
  type AdminRechargeCreditsResponseDto,
  type ApplyPaymentSettlementRequestDto,
  type ApplyPaymentSettlementResponseDto,
  type CreditBalanceDto,
  type DebitCreditsRequestDto,
  type DebitCreditsResponseDto,
  type DomainEvent,
} from "../../../../../../packages/contracts/src/index.ts";

export interface CreditLedgerEntry extends DebitCreditsResponseDto {
  userId: string;
  businessRefType: string;
  businessRefId: string;
  creditAmount: number;
  modelCode?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface CreditDebitResult {
  account: CreditBalanceDto;
  ledger: CreditLedgerEntry;
}

export interface CreditRechargeResult {
  account: CreditBalanceDto;
  ledger: CreditLedgerEntry;
}

export function createCreditAccount(
  userId: string,
  now: string,
  initialBalance = 100,
): CreditBalanceDto {
  return {
    accountId: randomUUID(),
    userId,
    balance: initialBalance,
    frozenBalance: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function applyDebitCredits(
  account: CreditBalanceDto,
  input: DebitCreditsRequestDto,
  now: string,
): CreditDebitResult {
  const nextBalance = account.balance - input.creditAmount;

  return {
    account: {
      ...account,
      balance: nextBalance,
      updatedAt: now,
    },
    ledger: {
      ledgerId: randomUUID(),
      userId: account.userId,
      businessRefType: input.businessRefType,
      businessRefId: input.businessRefId,
      creditAmount: input.creditAmount,
      modelCode: input.modelCode,
      idempotencyKey: input.idempotencyKey,
      balanceAfter: nextBalance,
      transactionType: CreditTransactionType.Debit,
      createdAt: now,
    },
  };
}

export function buildBillingCreditDebitedEvent(entry: CreditLedgerEntry): DomainEvent<{
  userId: string;
  businessRefType: string;
  businessRefId: string;
  creditAmount: number;
  balanceAfter: number;
  transactionType: string;
}> {
  return {
    id: randomUUID(),
    name: domainEventNames.billingCreditDebited,
    aggregateId: entry.ledgerId,
    occurredAt: entry.createdAt,
    payload: {
      userId: entry.userId,
      businessRefType: entry.businessRefType,
      businessRefId: entry.businessRefId,
      creditAmount: entry.creditAmount,
      balanceAfter: entry.balanceAfter,
      transactionType: entry.transactionType,
    },
    metadata: entry.modelCode ? { modelCode: entry.modelCode } : undefined,
  };
}

export function applyPaymentSettlementCredits(
  account: CreditBalanceDto,
  input: ApplyPaymentSettlementRequestDto,
  now: string,
): CreditRechargeResult {
  const nextBalance = account.balance + input.creditAmount;

  return {
    account: {
      ...account,
      balance: nextBalance,
      updatedAt: now,
    },
    ledger: {
      ledgerId: randomUUID(),
      userId: account.userId,
      businessRefType: "payment_order",
      businessRefId: input.paymentOrderId,
      creditAmount: input.creditAmount,
      idempotencyKey: input.callbackId,
      balanceAfter: nextBalance,
      transactionType: CreditTransactionType.Recharge,
      createdAt: now,
    },
  };
}

export function applyManualRechargeCredits(
  account: CreditBalanceDto,
  input: {
    submissionId: string;
    creditAmount: number;
  },
  now: string,
): CreditRechargeResult {
  const nextBalance = account.balance + input.creditAmount;

  return {
    account: {
      ...account,
      balance: nextBalance,
      updatedAt: now,
    },
    ledger: {
      ledgerId: randomUUID(),
      userId: account.userId,
      businessRefType: "manual_recharge",
      businessRefId: input.submissionId,
      creditAmount: input.creditAmount,
      idempotencyKey: input.submissionId,
      balanceAfter: nextBalance,
      transactionType: CreditTransactionType.Recharge,
      createdAt: now,
    },
  };
}

export function buildManualRechargeApplied(
  identity: string,
  creditAmount: number,
  recharge: CreditRechargeResult | CreditLedgerEntry,
): AdminRechargeCreditsResponseDto {
  const balanceAfter = "ledger" in recharge ? recharge.ledger.balanceAfter : recharge.balanceAfter;
  return {
    identity,
    subjectId: identity,
    balanceAfter,
    creditedAmount: creditAmount,
  };
}

export function buildPaymentSettlementApplied(
  input: ApplyPaymentSettlementRequestDto,
  recharge: CreditRechargeResult,
): ApplyPaymentSettlementResponseDto {
  return {
    ledgerId: recharge.ledger.ledgerId,
    balanceAfter: recharge.ledger.balanceAfter,
    paymentOrderId: input.paymentOrderId,
    merchantOrderNo: input.merchantOrderNo,
  };
}
