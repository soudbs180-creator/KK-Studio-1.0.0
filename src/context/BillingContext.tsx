import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { CreditTransactionDto } from '../../packages/contracts/src/index.ts';
import { supabase } from '../lib/supabase';
import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from '../services/api/kkApiClient';
import { isKkApiBillingPersistedViaSupabase } from '../services/api/kkApiServerHealth';
import { useAuth } from './AuthContext';

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

interface UserCreditsBalanceRow {
  user_id: string;
  balance: string | number | null;
}

interface SupabaseCreditTransactionRow {
  id: string;
  user_id: string;
  amount: string | number | null;
  type: string;
  balance_after: string | number | null;
  model_id?: string | null;
  model_name?: string | null;
  provider_id?: string | null;
  description?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  completed_at?: string | null;
}

interface SupabaseConsumeCreditsRpcRow {
  success?: boolean | null;
  new_balance?: string | number | null;
  transaction_id?: string | null;
  message?: string | null;
}

interface SupabaseRefundCreditsRpcRow {
  success?: boolean | null;
  new_balance?: string | number | null;
  message?: string | null;
}

interface BillingContextType {
  balance: number;
  loading: boolean;
  recharge: (amount: number, currency: 'CNY' | 'USD') => Promise<void>;
  consumeCredits: (modelId: string, count: number, details?: any) => Promise<boolean>;
  consumeCreditsDetailed: (modelId: string, count: number, details?: any) => Promise<CreditConsumeResult>;
  refundCredits: (amount: number, reason: string) => Promise<boolean>;
  refundCreditsByTransaction: (transactionId: string, reason: string) => Promise<CreditRefundResult>;
  refreshBilling: () => Promise<void>;
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

function extractLatestBalanceAfter(rows: CreditTransactionLog[]): number | undefined {
  for (const row of rows) {
    if (typeof row.balance_after === 'number' && Number.isFinite(row.balance_after)) {
      return toDisplayNumber(row.balance_after);
    }
  }

  return undefined;
}

function mapSupabaseCreditTransactionRow(row: SupabaseCreditTransactionRow): CreditTransactionLog {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    amount: toDisplayNumber(row.amount),
    balance_after: toDisplayNumber(row.balance_after),
    model_id: row.model_id ?? null,
    model_name: row.model_name ?? null,
    provider_id: row.provider_id ?? null,
    description: row.description ?? null,
    status: row.status ?? null,
    metadata: row.metadata ?? null,
    created_at: row.created_at,
    completed_at: row.completed_at ?? null,
  };
}

function getSupabaseRpcRow<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

async function fetchBalanceDirectlyFromSupabase(userId: string): Promise<number | undefined> {
  const { data, error } = await supabase
    .from('user_credits')
    .select('user_id, balance')
    .eq('user_id', userId)
    .maybeSingle<UserCreditsBalanceRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return 0;
  }

  return toDisplayNumber(data.balance);
}

async function loadCreditTransactionsDirectlyFromSupabase(
  userId: string,
): Promise<CreditTransactionLog[]> {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select([
      'id',
      'user_id',
      'amount',
      'type',
      'balance_after',
      'model_id',
      'model_name',
      'provider_id',
      'description',
      'status',
      'metadata',
      'created_at',
      'completed_at',
    ].join(', '))
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)
    .returns<SupabaseCreditTransactionRow[]>();

  if (error) {
    throw error;
  }

  return sortCreditLogs((data || []).map((row) => mapSupabaseCreditTransactionRow(row)));
}

async function consumeCreditsDirectlyViaSupabase(params: {
  userId: string;
  amount: number;
  modelId?: string;
  modelName?: string;
  providerId?: string;
  description?: string;
}): Promise<CreditConsumeResult> {
  const { data, error } = await supabase.rpc('consume_credits', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_model_id: params.modelId || null,
    p_model_name: params.modelName || params.modelId || null,
    p_provider_id: params.providerId || 'managed',
    p_description: params.description || '',
  });

  if (error) {
    throw error;
  }

  const row = getSupabaseRpcRow<SupabaseConsumeCreditsRpcRow>(data as SupabaseConsumeCreditsRpcRow[] | SupabaseConsumeCreditsRpcRow | null);
  if (!row || row.success !== true) {
    return {
      success: false,
      newBalance: typeof row?.new_balance !== 'undefined' ? toDisplayNumber(row.new_balance) : undefined,
      message: String(row?.message || 'Credit debit failed'),
    };
  }

  const transactionId = String(row.transaction_id || '').trim();
  if (!transactionId) {
    return {
      success: false,
      newBalance: typeof row.new_balance !== 'undefined' ? toDisplayNumber(row.new_balance) : undefined,
      message: 'Credit debit did not return a transaction id',
    };
  }

  return {
    success: true,
    transactionId,
    newBalance: toDisplayNumber(row.new_balance),
    message: String(row.message || 'Credit debit applied'),
  };
}

async function refundCreditsDirectlyViaSupabase(
  transactionId: string,
  reason: string,
): Promise<CreditRefundResult> {
  const { data, error } = await supabase.rpc('refund_credits', {
    p_transaction_id: transactionId,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }

  const row = getSupabaseRpcRow<SupabaseRefundCreditsRpcRow>(data as SupabaseRefundCreditsRpcRow[] | SupabaseRefundCreditsRpcRow | null);
  if (!row || row.success !== true) {
    return {
      success: false,
      newBalance: typeof row?.new_balance !== 'undefined' ? toDisplayNumber(row.new_balance) : undefined,
      message: String(row?.message || 'Credit refund failed'),
    };
  }

  return {
    success: true,
    newBalance: toDisplayNumber(row.new_balance),
    message: String(row.message || 'Credit refund applied'),
  };
}

export const useBilling = () => useContext(BillingContext);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, isTempUser } = useAuth();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [billingLogs, setBillingLogs] = useState<CreditTransactionLog[]>([]);
  const [usageLogs, setUsageLogs] = useState<CreditTransactionLog[]>([]);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const apiAccessToken = session?.access_token;
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const applyTransactionRows = useCallback((rows: CreditTransactionLog[]) => {
    const { rechargeRows, usageRows } = splitCreditLogs(rows);
    setBillingLogs(rechargeRows);
    setUsageLogs(usageRows);
  }, []);

  const fetchBalance = useCallback(async (): Promise<number | undefined> => {
    if (!user || isTempUser) {
      return 0;
    }

    try {
      if (shouldUseLegacyWebApiFallback()) {
        if (!(await isKkApiBillingPersistedViaSupabase())) {
          return fetchBalanceDirectlyFromSupabase(user.id);
        }

        const response = await legacyWebApiClient.getCreditBalance(buildBillingRequestOptions(apiAccessToken));
        if (!response.success) {
          console.error('[BillingContext] Failed to load credit balance from canonical API:', response.error);
          return fetchBalanceDirectlyFromSupabase(user.id);
        }

        const resolvedUserId = String(response.data.userId || '').trim();
        if (resolvedUserId && resolvedUserId !== user.id) {
          console.warn('[BillingContext] Credit balance API resolved a different user id, ignoring mismatched payload.', {
            expectedUserId: user.id,
            resolvedUserId,
          });
          return fetchBalanceDirectlyFromSupabase(user.id);
        }

        return toDisplayNumber(response.data.balance);
      }

      return fetchBalanceDirectlyFromSupabase(user.id);
    } catch (error) {
      console.error('[BillingContext] Failed to load credit balance from canonical API:', error);
      return fetchBalanceDirectlyFromSupabase(user.id);
    }
  }, [user, isTempUser, apiAccessToken]);

  const loadCreditTransactions = useCallback(async (updateBalance = true): Promise<number | undefined> => {
    if (!user || isTempUser) {
      setBillingLogs([]);
      setUsageLogs([]);
      return undefined;
    }

    try {
      if (shouldUseLegacyWebApiFallback()) {
        if (!(await isKkApiBillingPersistedViaSupabase())) {
          const rows = await loadCreditTransactionsDirectlyFromSupabase(user.id);
          applyTransactionRows(rows);
          const latestBalanceAfter = extractLatestBalanceAfter(rows);
          if (updateBalance && typeof latestBalanceAfter === 'number') {
            setBalance(latestBalanceAfter);
          }
          return latestBalanceAfter;
        }

        const response = await legacyWebApiClient.listCreditTransactions(
          { limit: 500 },
          buildBillingRequestOptions(apiAccessToken),
        );

        if (!response.success) {
          console.error('[BillingContext] Failed to load credit transactions from canonical API:', response.error);
          const rows = await loadCreditTransactionsDirectlyFromSupabase(user.id);
          applyTransactionRows(rows);
          const latestBalanceAfter = extractLatestBalanceAfter(rows);
          if (updateBalance && typeof latestBalanceAfter === 'number') {
            setBalance(latestBalanceAfter);
          }
          return latestBalanceAfter;
        }

        const rows = sortCreditLogs((response.data.items || []).map((item) => mapCreditTransaction(item)));
        const hasForeignRows = rows.some((row) => row.user_id && row.user_id !== user.id);
        if (hasForeignRows) {
          console.warn('[BillingContext] Credit transaction API returned rows for a different user, ignoring mismatched payload.', {
            expectedUserId: user.id,
            returnedUserIds: Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))),
          });
          const fallbackRows = await loadCreditTransactionsDirectlyFromSupabase(user.id);
          applyTransactionRows(fallbackRows);
          const latestBalanceAfter = extractLatestBalanceAfter(fallbackRows);
          if (updateBalance && typeof latestBalanceAfter === 'number') {
            setBalance(latestBalanceAfter);
          }
          return latestBalanceAfter;
        }

        applyTransactionRows(rows);
        const latestBalanceAfter = extractLatestBalanceAfter(rows);
        if (updateBalance && typeof latestBalanceAfter === 'number') {
          setBalance(latestBalanceAfter);
        }
        return latestBalanceAfter;
      }

      const rows = await loadCreditTransactionsDirectlyFromSupabase(user.id);
      applyTransactionRows(rows);
      const latestBalanceAfter = extractLatestBalanceAfter(rows);
      if (updateBalance && typeof latestBalanceAfter === 'number') {
        setBalance(latestBalanceAfter);
      }
      return latestBalanceAfter;
    } catch (error) {
      console.error('[BillingContext] Failed to load credit transactions from canonical API:', error);
      const rows = await loadCreditTransactionsDirectlyFromSupabase(user.id);
      applyTransactionRows(rows);
      const latestBalanceAfter = extractLatestBalanceAfter(rows);
      if (updateBalance && typeof latestBalanceAfter === 'number') {
        setBalance(latestBalanceAfter);
      }
      return latestBalanceAfter;
    }
  }, [user, isTempUser, apiAccessToken, applyTransactionRows]);

  const fetchLogs = useCallback(async () => {
    await loadCreditTransactions(true);
  }, [loadCreditTransactions]);

  const refreshBilling = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = Promise.all([fetchBalance(), loadCreditTransactions(false)])
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
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [fetchBalance, loadCreditTransactions]);

  const scheduleRealtimeRefresh = useCallback((delayMs = 120) => {
    if (!user || isTempUser || typeof window === 'undefined') {
      return;
    }

    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void refreshBilling();
    }, delayMs);
  }, [user, isTempUser, refreshBilling]);

  useEffect(() => {
    refreshPromiseRef.current = null;
  }, [user?.id, isTempUser]);

  const adjustBalanceOptimistically = useCallback((delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }

    setBalance((current) => Math.max(0, Number(current || 0) + delta));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!user || isTempUser) {
        setBalance(0);
        setBillingLogs([]);
        setUsageLogs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      await refreshBilling();

      if (!cancelled) {
        setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [user, isTempUser, refreshBilling]);

  useEffect(() => {
    const userId = String(user?.id || '').trim();
    if (!userId || isTempUser) {
      return;
    }

    const channel = supabase
      .channel(`billing-sync:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_credits',
        filter: `user_id=eq.${userId}`,
      }, () => {
        scheduleRealtimeRefresh(0);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'credit_transactions',
        filter: `user_id=eq.${userId}`,
      }, () => {
        scheduleRealtimeRefresh(80);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          scheduleRealtimeRefresh(0);
        }
      });

    return () => {
      if (realtimeRefreshTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isTempUser, scheduleRealtimeRefresh]);

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = null;
    }
  }, []);

  const consumeCreditsDetailed = useCallback(
    async (modelId: string, count: number, details: any = {}): Promise<CreditConsumeResult> => {
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
        const response = await consumeCreditsDirectlyViaSupabase({
          userId: user.id,
          amount: needAmount,
          modelId: modelCode,
          modelName: String(details?.modelName || details?.feature || modelCode || modelId || '').trim() || modelCode,
          providerId: String(details?.providerId || details?.provider || 'managed').trim() || 'managed',
          description: String(
            details?.description
              || `${businessRefType}:${businessRefId}#${idempotencyKey}`,
          ).trim(),
        });

        if (!response.success) {
          return response;
        }

        if (typeof response.newBalance === 'number') {
          setBalance(toDisplayNumber(response.newBalance));
        }
        await loadCreditTransactions(false);

        return {
          success: true,
          transactionId: response.transactionId,
          newBalance: response.newBalance,
          message: response.message,
        };
      } catch (error) {
        console.error('[BillingContext] Failed to debit credits:', error);
        return { success: false, message: 'Credit debit failed' };
      }
    },
    [user, isTempUser, loadCreditTransactions],
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
      const safeTransactionId = String(transactionId || '').trim();
      if (!user || isTempUser || safeTransactionId.length === 0) {
        return { success: false, message: 'Missing refund transaction' };
      }

      try {
        const response = await refundCreditsDirectlyViaSupabase(safeTransactionId, reason);
        if (!response.success) {
          return response;
        }

        if (typeof response.newBalance === 'number') {
          setBalance(toDisplayNumber(response.newBalance));
        }
        await loadCreditTransactions(false);

        return {
          success: true,
          newBalance: response.newBalance,
          message: response.message,
        };
      } catch (error) {
        console.error('[BillingContext] Failed to refund credits:', reason, error);
        return { success: false, message: 'Credit refund failed' };
      }
    },
    [user, isTempUser, loadCreditTransactions],
  );

  const recharge = useCallback(
    async (amount: number, currency: 'CNY' | 'USD') => {
      void amount;
      void currency;
      throw new Error('Direct client-side recharge is disabled. Use the payment gateway flow instead.');
    },
    [],
  );

  return (
    <BillingContext.Provider
      value={{
        balance,
        loading,
        recharge,
        consumeCredits,
        consumeCreditsDetailed,
        refundCredits,
        refundCreditsByTransaction,
        refreshBilling,
        adjustBalanceOptimistically,
        billingLogs,
        usageLogs,
        fetchLogs,
        showRechargeModal,
        setShowRechargeModal,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};
