import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { creditService } from '../services/billing/creditService';
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
  metadata?: Record<string, any> | null;
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

export const useBilling = () => useContext(BillingContext);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isTempUser } = useAuth();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [billingLogs, setBillingLogs] = useState<CreditTransactionLog[]>([]);
  const [usageLogs, setUsageLogs] = useState<CreditTransactionLog[]>([]);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!user || isTempUser) {
      setBalance(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { data: created, error: createError } = await supabase
            .from('user_credits')
            .insert([{ user_id: user.id, balance: 0 }])
            .select('balance')
            .single();

          if (!createError && created) {
            setBalance(Number(created.balance || 0));
          }
          return;
        }

        console.error('[BillingContext] 读取余额失败:', error);
        return;
      }

      setBalance(Number(data?.balance || 0));
    } catch (error) {
      console.error('[BillingContext] 读取余额异常:', error);
    }
  }, [user, isTempUser]);

  const fetchLogs = useCallback(async () => {
    if (!user || isTempUser) {
      setBillingLogs([]);
      setUsageLogs([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('[BillingContext] 读取交易记录失败:', error);
        return;
      }

      const rows = (data || []) as CreditTransactionLog[];
      const rechargeRows = rows.filter((row) => row.type === 'recharge');
      const usageRows = rows.filter((row) => row.type !== 'recharge');

      setBillingLogs(rechargeRows);
      setUsageLogs(usageRows);
    } catch (error) {
      console.error('[BillingContext] 读取交易记录异常:', error);
    }
  }, [user, isTempUser]);

  const refreshBilling = useCallback(async () => {
    await Promise.all([fetchBalance(), fetchLogs()]);
  }, [fetchBalance, fetchLogs]);

  const adjustBalanceOptimistically = useCallback((delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    setBalance((current) => Math.max(0, Number(current || 0) + delta));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!user) {
        setBalance(0);
        setBillingLogs([]);
        setUsageLogs([]);
        setLoading(false);
        return;
      }

      if (isTempUser) {
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

    if (!user || isTempUser) {
      return () => {
        cancelled = true;
      };
    }

    const balanceChannel = supabase
      .channel(`balance_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload?.new && typeof payload.new.balance !== 'undefined') {
            setBalance(Number(payload.new.balance || 0));
          }
        }
      )
      .subscribe();

    const transactionChannel = supabase
      .channel(`credit_transaction_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchLogs();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(balanceChannel);
      void supabase.removeChannel(transactionChannel);
    };
  }, [user, isTempUser, refreshBilling]);

  const consumeCreditsDetailed = useCallback(
    async (modelId: string, count: number, details: any = {}): Promise<CreditConsumeResult> => {
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      const needAmount = Math.max(0, Number(count || 0));
      if (needAmount <= 0) {
        return { success: true, message: 'No credits required' };
      }

      try {
        const { data: latestBalanceRow } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        const latestBalance = Number(latestBalanceRow?.balance ?? balance);
        if (latestBalance < needAmount) {
          return {
            success: false,
            newBalance: latestBalance,
            message: '积分不足',
          };
        }

        const result = await creditService.consumeCredits(
          user.id,
          needAmount,
          {
            model_id: String(details?.modelId || modelId || ''),
            model_name: String(details?.modelName || modelId || ''),
            provider_id: String(details?.providerId || details?.keySlotId || details?.provider || 'managed'),
          },
          details?.feature || `模型调用：${modelId}`
        );

        if (!result.success) {
          return {
            success: false,
            newBalance: result.newBalance,
            message: result.message || '扣减积分失败',
          };
        }

        await refreshBilling();
        return {
          success: true,
          transactionId: result.transactionId,
          newBalance: result.newBalance,
          message: result.message || '扣减积分成功',
        };
      } catch (error) {
        console.error('[BillingContext] 扣减积分失败:', error);
        return { success: false, message: '扣减积分失败' };
      }
    },
    [user, balance, refreshBilling]
  );

  const consumeCredits = useCallback(
    async (modelId: string, count: number, details: any = {}) => {
      const result = await consumeCreditsDetailed(modelId, count, details);
      return result.success;
    },
    [consumeCreditsDetailed]
  );

  const refundCredits = useCallback(
    async (amount: number, reason: string) => {
      void amount;
      console.warn('[BillingContext] Legacy amount-based refund is disabled:', reason);
      return false;
    },
    []
  );

  const refundCreditsByTransaction = useCallback(
    async (transactionId: string, reason: string): Promise<CreditRefundResult> => {
      const safeTransactionId = String(transactionId || '').trim();
      if (!user || safeTransactionId.length === 0) {
        return { success: false, message: 'Missing refund transaction' };
      }

      try {
        const result = await creditService.refundCredits(safeTransactionId, reason);

        if (result.success) {
          await refreshBilling();
        }

        return {
          success: result.success,
          newBalance: result.newBalance,
          message: result.message || (result.success ? '退款成功' : '退款失败'),
        };
      } catch (error) {
        console.error('[BillingContext] 按交易退款失败:', reason, error);
        return { success: false, message: '退款失败' };
      }
    },
    [user, refreshBilling]
  );

  const recharge = useCallback(
    async (amount: number, currency: 'CNY' | 'USD') => {
      void amount;
      void currency;
      void user;
      throw new Error('Direct client-side recharge is disabled. Use the payment gateway flow instead.');
    },
    [user]
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
