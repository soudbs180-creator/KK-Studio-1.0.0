import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { CreditTransactionDto } from '../../packages/contracts/src/dto/billing.ts';
import { supabase } from '../lib/supabase';
import { legacyWebApiClient } from '../services/api/kkApiClient';
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

interface UserCreditsBalanceRow {
  user_id: string;
  balance: number | string | null;
}

interface CreditTransactionFallbackRow {
  id: string;
  user_id: string;
  amount: number | string | null;
  type: string;
  balance_after?: number | string | null;
  model_id?: string | null;
  model_name?: string | null;
  provider_id?: string | null;
  description?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  completed_at?: string | null;
}

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

function extractBalanceFromErrorDetails(details: unknown): number | undefined {
  if (!Array.isArray(details)) {
    return undefined;
  }

  for (const item of details) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = (item as { balance?: unknown }).balance;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return undefined;
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

function mapCreditTransactionRow(row: CreditTransactionFallbackRow): CreditTransactionLog {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    amount: toDisplayNumber(row.amount),
    balance_after: row.balance_after == null ? null : toDisplayNumber(row.balance_after),
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

function splitCreditLogs(rows: CreditTransactionLog[]) {
  return {
    rechargeRows: rows.filter((row) => row.type === 'recharge'),
    usageRows: rows.filter((row) => row.type !== 'recharge'),
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

  const readBalanceFromSupabase = useCallback(async (): Promise<number | undefined> => {
    if (!user || isTempUser) {
      return 0;
    }

    const { data: creditRow, error: creditError } = await supabase
      .from('user_credits')
      .select('user_id, balance')
      .eq('user_id', user.id)
      .maybeSingle<UserCreditsBalanceRow>();

    if (creditError) {
      console.error('[BillingContext] Failed to query user_credits directly:', creditError);
      return undefined;
    }

    return toDisplayNumber(creditRow?.balance);
  }, [user, isTempUser]);

  const fetchBalanceFromSupabase = useCallback(async () => {
    const nextBalance = await readBalanceFromSupabase();
    if (typeof nextBalance === 'number') {
      setBalance(nextBalance);
    }
  }, [readBalanceFromSupabase]);

  const fetchLogsFromSupabase = useCallback(async () => {
    if (!user || isTempUser) {
      setBillingLogs([]);
      setUsageLogs([]);
      return;
    }

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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<CreditTransactionFallbackRow[]>();

    if (error) {
      console.error('[BillingContext] Failed to query credit transactions directly:', error);
      return;
    }

    applyTransactionRows((data || []).map((row) => mapCreditTransactionRow(row)));
  }, [user, isTempUser, applyTransactionRows]);

  const fetchBalance = useCallback(async () => {
    if (!user || isTempUser) {
      setBalance(0);
      return;
    }

    try {
      const response = await legacyWebApiClient.getCreditBalance(buildBillingRequestOptions(apiAccessToken));
      if (!response.success) {
        console.error('[BillingContext] Failed to load credit balance from API, falling back to Supabase:', response.error);
        await fetchBalanceFromSupabase();
        return;
      }

      const resolvedUserId = String(response.data.userId || '').trim();
      if (resolvedUserId && resolvedUserId !== user.id) {
        console.warn('[BillingContext] Credit balance API resolved a different user id, falling back to Supabase.', {
          expectedUserId: user.id,
          resolvedUserId,
        });
        await fetchBalanceFromSupabase();
        return;
      }

      const apiBalance = toDisplayNumber(response.data.balance);
      if (apiBalance === 0) {
        const supabaseBalance = await readBalanceFromSupabase();
        if (typeof supabaseBalance === 'number' && supabaseBalance !== apiBalance) {
          console.warn('[BillingContext] Credit balance API returned 0 while Supabase reported a different balance, using Supabase balance.', {
            expectedUserId: user.id,
            apiBalance,
            supabaseBalance,
          });
          setBalance(supabaseBalance);
          return;
        }
      }

      setBalance(apiBalance);
    } catch (error) {
      console.error('[BillingContext] Failed to load credit balance:', error);
      await fetchBalanceFromSupabase();
    }
  }, [user, isTempUser, apiAccessToken, fetchBalanceFromSupabase, readBalanceFromSupabase]);

  const fetchLogs = useCallback(async () => {
    if (!user || isTempUser) {
      setBillingLogs([]);
      setUsageLogs([]);
      return;
    }

    try {
      const response = await legacyWebApiClient.listCreditTransactions(
        { limit: 500 },
        buildBillingRequestOptions(apiAccessToken),
      );

      if (!response.success) {
        console.error('[BillingContext] Failed to load credit transactions from API, falling back to Supabase:', response.error);
        await fetchLogsFromSupabase();
        return;
      }

      const rows = (response.data.items || []).map((item) => mapCreditTransaction(item));
      const hasForeignRows = rows.some((row) => row.user_id && row.user_id !== user.id);
      if (hasForeignRows) {
        console.warn('[BillingContext] Credit transaction API returned rows for a different user, falling back to Supabase.', {
          expectedUserId: user.id,
          returnedUserIds: Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean))),
        });
        await fetchLogsFromSupabase();
        return;
      }

      applyTransactionRows(rows);
    } catch (error) {
      console.error('[BillingContext] Failed to load credit transactions:', error);
      await fetchLogsFromSupabase();
    }
  }, [user, isTempUser, apiAccessToken, fetchLogsFromSupabase, applyTransactionRows]);

  const refreshBilling = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = Promise.all([fetchBalance(), fetchLogs()])
      .then(() => undefined)
      .finally(() => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [fetchBalance, fetchLogs]);

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
        const response = await legacyWebApiClient.debitCredits(
          {
            businessRefType,
            businessRefId,
            creditAmount: needAmount,
            modelCode,
            idempotencyKey,
          },
          buildBillingRequestOptions(apiAccessToken),
        );

        if (!response.success) {
          return {
            success: false,
            newBalance: extractBalanceFromErrorDetails(response.error.details),
            message: response.error.message || 'Credit debit failed',
          };
        }

        setBalance(toDisplayNumber(response.data.balanceAfter));
        await fetchLogs();

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
    [user, isTempUser, apiAccessToken, fetchLogs],
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
        const response = await legacyWebApiClient.refundCredits(
          {
            transactionId: safeTransactionId,
            reason,
          },
          buildBillingRequestOptions(apiAccessToken),
        );

        if (!response.success) {
          return {
            success: false,
            message: response.error.message || 'Credit refund failed',
          };
        }

        setBalance(toDisplayNumber(response.data.balanceAfter));
        await fetchLogs();

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
    [user, isTempUser, apiAccessToken, fetchLogs],
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
