import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { CreditTransactionDto } from '../../packages/contracts/src/index.ts';
import { resolveBillingRefreshMode } from '../services/billing/billingRefreshMode';
import { kkWebApiClient } from '../services/api/kkApiClient';
import { isKkApiBillingPersistedInCloud } from '../services/api/kkApiServerHealth';
import {
  createBillingDisabledConsumeResult,
  createBillingDisabledRefundResult,
  createBillingRuntimeGuard,
} from './billingRuntimeGuard';
import { useAuth } from './AuthContext';
import { useAppStartup } from './AppStartupContext';

export interface CreditTransactionLog {
  id: string;
  user_id?: string;
  type: 'recharge' | 'consumption' | 'refund' | 'freeze' | 'unfreeze' | string;
  amount: number;
  balance_after?: number | null;
  model_id?: string | null;
  model_name?: string | null;
  provider_id?: string | null;
  description?: string | null;
  status?: 'pending' | 'completed' | 'failed' | 'refunded' | string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  completed_at?: string | null;
}

export interface CreditConsumeResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  message: string;
}

export interface CreditRefundResult {
  success: boolean;
  newBalance?: number;
  message: string;
}

interface BillingSnapshot {
  balance: number;
  billingLogs: CreditTransactionLog[];
  usageLogs: CreditTransactionLog[];
  logsLoaded: boolean;
  updatedAt: number;
}

interface RefreshBillingOptions {
  includeTransactions?: boolean;
  silent?: boolean;
}

const BILLING_SNAPSHOT_PREFIX = 'kk_billing_snapshot:';
const BILLING_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const CREDIT_TRANSACTIONS_FETCH_LIMIT = 120;
const BILLING_SYNC_POLL_MS = 30_000;

interface BillingContextType {
  balance: number;
  loading: boolean;
  refreshing: boolean;
  recharge: (amount: number, currency: 'CNY' | 'USD') => Promise<void>;
  consumeCredits: (modelId: string, count: number, details?: any) => Promise<boolean>;
  consumeCreditsDetailed: (modelId: string, count: number, details?: any) => Promise<CreditConsumeResult>;
  refundCredits: (amount: number, reason: string) => Promise<boolean>;
  refundCreditsByTransaction: (transactionId: string, reason: string) => Promise<CreditRefundResult>;
  refreshBilling: (options?: RefreshBillingOptions) => Promise<void>;
  adjustBalanceOptimistically: (delta: number) => void;
  billingLogs: CreditTransactionLog[];
  usageLogs: CreditTransactionLog[];
  fetchLogs: () => Promise<void>;
  showRechargeModal: boolean;
  setShowRechargeModal: (show: boolean) => void;
}

const BillingContext = createContext<BillingContextType>({
  balance: 0,
  loading: true,
  refreshing: false,
  recharge: async () => {},
  consumeCredits: async () => false,
  consumeCreditsDetailed: async () => ({ success: false, message: 'Billing context not ready' }),
  refundCredits: async () => false,
  refundCreditsByTransaction: async () => ({ success: false, message: 'Billing context not ready' }),
  refreshBilling: async () => {},
  adjustBalanceOptimistically: () => {},
  billingLogs: [],
  usageLogs: [],
  fetchLogs: async () => {},
  showRechargeModal: false,
  setShowRechargeModal: () => {},
});

function buildBillingRequestOptions(accessToken?: string) {
  return accessToken ? { accessToken } : {};
}

function buildClientRequestId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid || Date.now()}`;
}

function getResponseErrorMessage(response: { error?: { message?: string | null } } | null | undefined, fallback: string): string {
  const message = String(response?.error?.message || '').trim();
  return message || fallback;
}

function toDisplayNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function mapCreditTransaction(dto: CreditTransactionDto): CreditTransactionLog {
  return {
    id: dto.id,
    user_id: dto.userId,
    type: dto.transactionType,
    amount: toDisplayNumber(dto.amount),
    balance_after: typeof dto.balanceAfter === 'number' ? dto.balanceAfter : null,
    model_id: dto.modelCode ?? null,
    model_name: dto.modelName ?? null,
    provider_id: dto.providerCode ?? null,
    description: dto.description ?? null,
    status: dto.status ?? null,
    metadata: dto.metadata ?? null,
    created_at: dto.createdAt,
    completed_at: dto.completedAt ?? null,
  };
}

function splitCreditLogs(rows: CreditTransactionLog[]) {
  return {
    rechargeRows: rows.filter((row) => row.type === 'recharge'),
    usageRows: rows.filter((row) => row.type !== 'recharge'),
  };
}

function sortCreditLogs(rows: CreditTransactionLog[]): CreditTransactionLog[] {
  return [...rows].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

function cloneCreditLog(row: CreditTransactionLog): CreditTransactionLog {
  return {
    ...row,
    metadata: row.metadata ? { ...row.metadata } : null,
  };
}

function getBillingSnapshotKey(userId: string): string {
  return `${BILLING_SNAPSHOT_PREFIX}${userId}`;
}

function readBillingSnapshotFromStorage(
  storage: Storage,
  userId: string,
  removeOnExpire: boolean,
): BillingSnapshot | null {
  const snapshotKey = getBillingSnapshotKey(userId);

  try {
    const raw = storage.getItem(snapshotKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BillingSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
    if (!updatedAt || Date.now() - updatedAt > BILLING_SNAPSHOT_TTL_MS) {
      if (removeOnExpire) {
        storage.removeItem(snapshotKey);
      }
      return null;
    }

    return {
      balance: toDisplayNumber(parsed.balance),
      billingLogs: Array.isArray(parsed.billingLogs)
        ? parsed.billingLogs.map((row) => cloneCreditLog(row as CreditTransactionLog))
        : [],
      usageLogs: Array.isArray(parsed.usageLogs)
        ? parsed.usageLogs.map((row) => cloneCreditLog(row as CreditTransactionLog))
        : [],
      logsLoaded: parsed.logsLoaded === true,
      updatedAt,
    };
  } catch (error) {
    if (removeOnExpire) {
      try {
        storage.removeItem(snapshotKey);
      } catch {
        // ignore cleanup failures
      }
    }
    console.warn('[BillingContext] Failed to restore billing snapshot:', error);
    return null;
  }
}

function peekBillingSnapshot(userId: string): BillingSnapshot | null {
  if (typeof window === 'undefined' || !userId) {
    return null;
  }

  return readBillingSnapshotFromStorage(window.sessionStorage, userId, false)
    || readBillingSnapshotFromStorage(window.localStorage, userId, false);
}

function readBillingSnapshot(userId: string): BillingSnapshot | null {
  if (typeof window === 'undefined' || !userId) {
    return null;
  }

  return readBillingSnapshotFromStorage(window.sessionStorage, userId, true)
    || readBillingSnapshotFromStorage(window.localStorage, userId, true);
}

function writeBillingSnapshot(userId: string, snapshot: BillingSnapshot): void {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  const payload = JSON.stringify({
    balance: toDisplayNumber(snapshot.balance),
    billingLogs: snapshot.billingLogs.slice(0, CREDIT_TRANSACTIONS_FETCH_LIMIT).map(cloneCreditLog),
    usageLogs: snapshot.usageLogs.slice(0, CREDIT_TRANSACTIONS_FETCH_LIMIT).map(cloneCreditLog),
    logsLoaded: snapshot.logsLoaded,
    updatedAt: snapshot.updatedAt,
  } satisfies BillingSnapshot);

  try {
    window.sessionStorage.setItem(getBillingSnapshotKey(userId), payload);
    window.localStorage.setItem(getBillingSnapshotKey(userId), payload);
  } catch (error) {
    console.warn('[BillingContext] Failed to persist billing snapshot:', error);
  }
}

function extractLatestBalanceAfter(rows: CreditTransactionLog[]): number | undefined {
  for (const row of rows) {
    if (typeof row.balance_after === 'number' && Number.isFinite(row.balance_after)) {
      return toDisplayNumber(row.balance_after);
    }
  }

  return undefined;
}

export const useBilling = () => useContext(BillingContext);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, isTempUser } = useAuth();
  const { isStageReady } = useAppStartup();
  const billingRuntime = createBillingRuntimeGuard({
    userId: user?.id,
    isTempUser,
  });

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [billingLogs, setBillingLogs] = useState<CreditTransactionLog[]>([]);
  const [usageLogs, setUsageLogs] = useState<CreditTransactionLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const apiAccessToken = session?.access_token;
  const activeBillingUserId = billingRuntime.activeBillingUserId;
  const hasVisibleBillingSeed = Boolean(activeBillingUserId) && hydratedUserId === activeBillingUserId;
  const canStartBillingBootstrap = isStageReady('background_ready');
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const balanceRefreshPromiseRef = useRef<Promise<number | undefined> | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const logsLoadedRef = useRef(false);
  const hasVisibleBillingSeedRef = useRef(false);

  useEffect(() => {
    logsLoadedRef.current = logsLoaded;
  }, [logsLoaded]);

  useEffect(() => {
    hasVisibleBillingSeedRef.current = Boolean(activeBillingUserId) && hydratedUserId === activeBillingUserId;
  }, [activeBillingUserId, hydratedUserId]);

  const applyTransactionRows = useCallback((rows: CreditTransactionLog[]) => {
    const { rechargeRows, usageRows } = splitCreditLogs(rows);
    setBillingLogs(rechargeRows);
    setUsageLogs(usageRows);
    setLogsLoaded(true);
  }, []);

  const fetchBalance = useCallback(async (): Promise<number | undefined> => {
    if (!billingRuntime.shouldBootstrapBilling) {
      return undefined;
    }

    if (!user || isTempUser) {
      return 0;
    }

    if (!canStartBillingBootstrap) {
      return undefined;
    }

    if (!(await isKkApiBillingPersistedInCloud())) {
      return undefined;
    }

    try {
      const response = await kkWebApiClient.getCreditBalance(buildBillingRequestOptions(apiAccessToken));
      if (!response.success) {
        console.error('[BillingContext] Failed to load credit balance from canonical API:', response.error);
        return undefined;
      }

      const resolvedUserId = String(response.data.userId || '').trim();
      if (resolvedUserId && resolvedUserId !== user.id) {
        console.warn('[BillingContext] Credit balance API resolved a different user id, ignoring mismatched payload.', {
          expectedUserId: user.id,
          resolvedUserId,
        });
        return undefined;
      }

      return toDisplayNumber(response.data.balance);
    } catch (error) {
      console.error('[BillingContext] Failed to load credit balance from canonical API:', error);
      return undefined;
    }
  }, [billingRuntime.shouldBootstrapBilling, user, isTempUser, apiAccessToken, canStartBillingBootstrap]);

  const loadCreditTransactions = useCallback(async (updateBalance = true): Promise<number | undefined> => {
    if (!billingRuntime.shouldBootstrapBilling) {
      setBillingLogs([]);
      setUsageLogs([]);
      setLogsLoaded(false);
      return undefined;
    }

    if (!user || isTempUser) {
      setBillingLogs([]);
      setUsageLogs([]);
      setLogsLoaded(false);
      return undefined;
    }

    if (!canStartBillingBootstrap) {
      return undefined;
    }

    if (!(await isKkApiBillingPersistedInCloud())) {
      return undefined;
    }

    try {
      const response = await kkWebApiClient.listCreditTransactions(
        { limit: CREDIT_TRANSACTIONS_FETCH_LIMIT },
        buildBillingRequestOptions(apiAccessToken),
      );

      if (!response.success) {
        console.error('[BillingContext] Failed to load credit transactions from canonical API:', response.error);
        return undefined;
      }

      const rows = sortCreditLogs((response.data.items || []).map((item) => mapCreditTransaction(item)));
      const hasForeignRows = rows.some((row) => row.user_id && row.user_id !== user.id);
      if (hasForeignRows) {
        console.warn('[BillingContext] Credit transaction API returned rows for a different user, ignoring mismatched payload.', {
          expectedUserId: user.id,
          returnedUserIds: Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))),
        });
        return undefined;
      }

      applyTransactionRows(rows);
      const latestBalanceAfter = extractLatestBalanceAfter(rows);
      if (updateBalance && typeof latestBalanceAfter === 'number') {
        setBalance(latestBalanceAfter);
      }
      return latestBalanceAfter;
    } catch (error) {
      console.error('[BillingContext] Failed to load credit transactions from canonical API:', error);
      return undefined;
    }
  }, [billingRuntime.shouldBootstrapBilling, user, isTempUser, apiAccessToken, applyTransactionRows, canStartBillingBootstrap]);

  const refreshBalanceOnly = useCallback(async (): Promise<number | undefined> => {
    if (balanceRefreshPromiseRef.current) {
      return balanceRefreshPromiseRef.current;
    }

    const balancePromise = fetchBalance()
      .then((canonicalBalance) => {
        if (typeof canonicalBalance === 'number') {
          setBalance(canonicalBalance);
        }

        return canonicalBalance;
      })
      .finally(() => {
        if (balanceRefreshPromiseRef.current === balancePromise) {
          balanceRefreshPromiseRef.current = null;
        }
      });

    balanceRefreshPromiseRef.current = balancePromise;
    return balancePromise;
  }, [fetchBalance]);

  const refreshBilling = useCallback(async (options?: RefreshBillingOptions) => {
    if (!billingRuntime.shouldBootstrapBilling) {
      return;
    }
    if (!canStartBillingBootstrap) {
      return;
    }
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const includeTransactions = options?.includeTransactions !== false;
    const refreshMode = resolveBillingRefreshMode({
      silent: options?.silent === true,
      hasVisibleBillingSeed,
    });

    if (refreshMode.showBlockingLoading) {
      setLoading(true);
    }

    if (refreshMode.markRefreshing) {
      setRefreshing(true);
    }
    const refreshPromise = (includeTransactions
      ? Promise.all([refreshBalanceOnly(), loadCreditTransactions(false)])
      : refreshBalanceOnly().then((canonicalBalance) => [canonicalBalance, undefined] as const))
      .then(([canonicalBalance, latestBalanceAfter]) => {
        const resolvedBalance = typeof canonicalBalance === 'number'
          ? canonicalBalance
          : latestBalanceAfter;

        if (typeof resolvedBalance === 'number') {
          setBalance(resolvedBalance);
        }
      })
      .finally(() => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
        if (refreshMode.showBlockingLoading) {
          setLoading(false);
        }
        if (refreshMode.markRefreshing) {
          setRefreshing(false);
        }
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [billingRuntime.shouldBootstrapBilling, refreshBalanceOnly, loadCreditTransactions, canStartBillingBootstrap, hasVisibleBillingSeed]);

  const fetchLogs = useCallback(async () => {
    if (!billingRuntime.shouldBootstrapBilling || !user || isTempUser) {
      setBillingLogs([]);
      setUsageLogs([]);
      setLogsLoaded(false);
      return;
    }

    await refreshBilling({ includeTransactions: true });
  }, [billingRuntime.shouldBootstrapBilling, user, isTempUser, refreshBilling]);

  const scheduleRealtimeRefresh = useCallback((delayMs = 120, mode: 'balance' | 'full' = 'balance') => {
    if (!billingRuntime.shouldBootstrapBilling || !user || isTempUser || typeof window === 'undefined') {
      return;
    }

    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      if (!canStartBillingBootstrap) {
        return;
      }

      if (mode === 'full' && logsLoadedRef.current) {
        void refreshBilling({
          includeTransactions: true,
          silent: true,
        });
        return;
      }

      void refreshBilling({
        includeTransactions: false,
        silent: true,
      });
    }, delayMs);
  }, [billingRuntime.shouldBootstrapBilling, user, isTempUser, refreshBilling, canStartBillingBootstrap]);

  useEffect(() => {
    refreshPromiseRef.current = null;
    balanceRefreshPromiseRef.current = null;
    if (realtimeRefreshTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = null;
    }
    setRefreshing(false);
    setShowRechargeModal(false);

    if (!activeBillingUserId) {
      setHydratedUserId(null);
      setBalance(0);
      setBillingLogs([]);
      setUsageLogs([]);
      setLogsLoaded(false);
      setLoading(false);
      return;
    }

    const cachedSnapshot = readBillingSnapshot(activeBillingUserId);
    if (!cachedSnapshot) {
      setHydratedUserId(null);
      setBalance(0);
      setBillingLogs([]);
      setUsageLogs([]);
      setLogsLoaded(false);
      setLoading(true);
      return;
    }

    setBalance(cachedSnapshot.balance);
    setBillingLogs(cachedSnapshot.billingLogs);
    setUsageLogs(cachedSnapshot.usageLogs);
    setLogsLoaded(cachedSnapshot.logsLoaded);
    setHydratedUserId(activeBillingUserId);
    setLoading(false);
  }, [activeBillingUserId]);

  useEffect(() => {
    if (!activeBillingUserId || hydratedUserId !== activeBillingUserId) {
      return;
    }

    writeBillingSnapshot(activeBillingUserId, {
      balance,
      billingLogs,
      usageLogs,
      logsLoaded,
      updatedAt: Date.now(),
    });
  }, [activeBillingUserId, hydratedUserId, balance, billingLogs, usageLogs, logsLoaded]);

  const adjustBalanceOptimistically = useCallback((delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }

    setBalance((current) => Math.max(0, Number(current || 0) + delta));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!billingRuntime.shouldBootstrapBilling || !user || isTempUser) {
        setHydratedUserId(null);
        setBalance(0);
        setBillingLogs([]);
        setUsageLogs([]);
        setLogsLoaded(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!canStartBillingBootstrap) {
        return;
      }

      const cachedSnapshot = activeBillingUserId ? readBillingSnapshot(activeBillingUserId) : null;
      if (!cachedSnapshot) {
        setLoading(true);
      }

      try {
        await refreshBilling({ silent: Boolean(cachedSnapshot) });
      } finally {
        if (!cancelled) {
          setHydratedUserId(activeBillingUserId);
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [billingRuntime.shouldBootstrapBilling, activeBillingUserId, user, isTempUser, refreshBilling, canStartBillingBootstrap]);

  useEffect(() => {
    const userId = String(user?.id || '').trim();
    if (
      !billingRuntime.shouldBootstrapBilling
      || !userId
      || isTempUser
      || typeof window === 'undefined'
      || !canStartBillingBootstrap
    ) {
      return;
    }

    const triggerRefresh = () => {
      scheduleRealtimeRefresh(0);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    const intervalId = window.setInterval(() => {
      triggerRefresh();
    }, BILLING_SYNC_POLL_MS);

    window.addEventListener('focus', triggerRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    triggerRefresh();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', triggerRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
    };
  }, [billingRuntime.shouldBootstrapBilling, user?.id, isTempUser, scheduleRealtimeRefresh, canStartBillingBootstrap]);

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = null;
    }
  }, []);

  const consumeCreditsDetailed = useCallback(
    async (modelId: string, count: number, details: any = {}): Promise<CreditConsumeResult> => {
      if (!billingRuntime.billingEnabled) {
        const needAmount = Math.max(0, Number(count || 0));
        return createBillingDisabledConsumeResult(needAmount);
      }

      if (!user || isTempUser) {
        return { success: false, message: 'User not authenticated' };
      }

      const needAmount = Math.max(0, Number(count || 0));
      if (needAmount <= 0) {
        return { success: true, message: 'No credits required' };
      }

      const businessRefType = String(details?.businessRefType || 'generation_task').trim() || 'generation_task';
      const businessRefId = String(
        details?.businessRefId
          || details?.requestId
          || details?.taskId
          || details?.generationId
          || modelId,
      ).trim() || modelId;
      const modelCode = String(details?.modelId || modelId || '').trim() || undefined;
      const idempotencyKey = String(details?.idempotencyKey || buildClientRequestId('credit-debit')).trim();

      try {
        const response = await kkWebApiClient.debitCredits({
          businessRefType,
          businessRefId,
          creditAmount: needAmount,
          modelCode,
          idempotencyKey,
        }, buildBillingRequestOptions(apiAccessToken));
        if (!response.success) {
          return {
            success: false,
            message: getResponseErrorMessage(response, 'Credit debit failed'),
          };
        }

        if (typeof response.data.balanceAfter === 'number') {
          setBalance(toDisplayNumber(response.data.balanceAfter));
        }
        if (logsLoadedRef.current) {
          await loadCreditTransactions(false);
        }

        return {
          success: true,
          transactionId: response.data.ledgerId,
          newBalance: response.data.balanceAfter,
          message: 'Credit debit applied',
        };
      } catch (error) {
        console.error('[BillingContext] Failed to debit credits:', error);
        return { success: false, message: 'Credit debit failed' };
      }
    },
    [billingRuntime.billingEnabled, user, isTempUser, apiAccessToken, loadCreditTransactions],
  );

  const consumeCredits = useCallback(
    async (modelId: string, count: number, details: any = {}) => {
      const result = await consumeCreditsDetailed(modelId, count, details);
      return result.success;
    },
    [consumeCreditsDetailed],
  );

  const refundCredits = useCallback(
    async (amount: number, reason: string) => {
      void amount;
      console.warn('[BillingContext] Legacy amount-based refund is disabled:', reason);
      return false;
    },
    [],
  );

  const refundCreditsByTransaction = useCallback(
    async (transactionId: string, reason: string): Promise<CreditRefundResult> => {
      if (!billingRuntime.billingEnabled) {
        return createBillingDisabledRefundResult();
      }

      const safeTransactionId = String(transactionId || '').trim();
      if (!user || isTempUser || safeTransactionId.length === 0) {
        return { success: false, message: 'Missing refund transaction' };
      }

      try {
        const response = await kkWebApiClient.refundCredits({
          transactionId: safeTransactionId,
          reason,
        }, buildBillingRequestOptions(apiAccessToken));
        if (!response.success) {
          return {
            success: false,
            message: getResponseErrorMessage(response, 'Credit refund failed'),
          };
        }

        if (typeof response.data.balanceAfter === 'number') {
          setBalance(toDisplayNumber(response.data.balanceAfter));
        }
        if (logsLoadedRef.current) {
          await loadCreditTransactions(false);
        }

        return {
          success: true,
          newBalance: response.data.balanceAfter,
          message: 'Credit refund applied',
        };
      } catch (error) {
        console.error('[BillingContext] Failed to refund credits:', reason, error);
        return { success: false, message: 'Credit refund failed' };
      }
    },
    [billingRuntime.billingEnabled, user, isTempUser, apiAccessToken, loadCreditTransactions],
  );

  const recharge = useCallback(
    async (amount: number, currency: 'CNY' | 'USD') => {
      if (!billingRuntime.billingEnabled) {
        return;
      }

      void amount;
      void currency;
      throw new Error('Direct client-side recharge is disabled. Use the payment gateway flow instead.');
    },
    [billingRuntime.billingEnabled],
  );

  const hasHydratedCurrentBillingScope = Boolean(activeBillingUserId) && hydratedUserId === activeBillingUserId;
  const renderCachedSnapshot = !hasHydratedCurrentBillingScope && activeBillingUserId
    ? peekBillingSnapshot(activeBillingUserId)
    : null;
  const visibleBalance = hasHydratedCurrentBillingScope
    ? balance
    : (renderCachedSnapshot?.balance ?? 0);
  const visibleBillingLogs = hasHydratedCurrentBillingScope
    ? billingLogs
    : (renderCachedSnapshot?.billingLogs ?? []);
  const visibleUsageLogs = hasHydratedCurrentBillingScope
    ? usageLogs
    : (renderCachedSnapshot?.usageLogs ?? []);
  const visibleLoading = activeBillingUserId
    ? ((!hasHydratedCurrentBillingScope && !renderCachedSnapshot) || loading || !canStartBillingBootstrap)
    : false;

  return (
    <BillingContext.Provider
      value={{
        balance: visibleBalance,
        loading: visibleLoading,
        refreshing,
        recharge,
        consumeCredits,
        consumeCreditsDetailed,
        refundCredits,
        refundCreditsByTransaction,
        refreshBilling,
        adjustBalanceOptimistically,
        billingLogs: visibleBillingLogs,
        usageLogs: visibleUsageLogs,
        fetchLogs,
        showRechargeModal,
        setShowRechargeModal,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};
