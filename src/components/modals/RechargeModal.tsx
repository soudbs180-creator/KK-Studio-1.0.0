import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, Wallet, X, Zap } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useBilling } from '../../context/BillingContext';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  DEFAULT_CREDIT_EXCHANGE_RATES,
  getCreditExchangeRateMap,
  type CreditExchangeRate,
  type SupportedRechargeCurrency,
} from '../../services/billing/creditExchangeRateService';
import {
  buildPaymentSidecarAbsoluteUrl,
  legacyWebPaymentSidecarClient,
} from '../../services/api/paymentSidecarClient';
import { notify } from '../../services/system/notificationService';
import alipayIcon from '../../assets/payment/alipay.png';
import cardIcon from '../../assets/payment/card.png';
import wechatIcon from '../../assets/payment/wechat.png';

const initialRateMap: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
};

const PAYMENT_STATUS_LABELS = {
  idle: '待发起',
  pending: '等待支付',
  success: '支付成功',
  failed: '支付失败',
  closed: '订单关闭',
} as const;

const formatCurrencySymbol = (currency: SupportedRechargeCurrency) => (currency === 'CNY' ? '¥' : '$');
const formatRateValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

function buildReturnUrl(): string {
  if (typeof window !== 'undefined') {
    return new URL('/pay/success', window.location.origin).toString();
  }

  return 'https://kkai.plus/pay/success';
}

const RechargeModal: React.FC = () => {
  const { showRechargeModal, setShowRechargeModal, refreshBilling } = useBilling();
  const { user } = useAuth();
  const { pick } = useLocale();

  const [currency, setCurrency] = useState<SupportedRechargeCurrency>('CNY');
  const [amount, setAmount] = useState<number>(20);
  const [selectedChannel, setSelectedChannel] = useState<'alipay' | 'wechat' | 'paypal'>('alipay');
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [loadingRates, setLoadingRates] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<SupportedRechargeCurrency, CreditExchangeRate>>(initialRateMap);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [paymentOrderNo, setPaymentOrderNo] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<keyof typeof PAYMENT_STATUS_LABELS>('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [pendingCredits, setPendingCredits] = useState<number | null>(null);

  const currentRate = exchangeRates[currency] || initialRateMap[currency];
  const minAmount = currentRate.minAmount ?? (currency === 'CNY' ? 5 : 1);
  const maxAmount = currentRate.maxAmount ?? (currency === 'CNY' ? 500 : 100);
  const isCny = currency === 'CNY';

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let alive = true;

    const loadRates = async () => {
      setLoadingRates(true);
      try {
        const rateMap = await getCreditExchangeRateMap();
        if (alive) {
          setExchangeRates(rateMap);
        }
      } finally {
        if (alive) {
          setLoadingRates(false);
        }
      }
    };

    if (showRechargeModal) {
      void loadRates();
    }

    return () => {
      alive = false;
    };
  }, [showRechargeModal]);

  useEffect(() => {
    setAmount((current) => {
      if (current < minAmount) return minAmount;
      if (current > maxAmount) return maxAmount;
      return current;
    });
  }, [minAmount, maxAmount]);

  const credits = useMemo(
    () => Math.max(0, Math.round(Math.max(0, amount) * currentRate.creditsPerUnit)),
    [amount, currentRate.creditsPerUnit]
  );

  const availableCurrencies = useMemo(
    () =>
      (['CNY', 'USD'] as SupportedRechargeCurrency[]).filter(
        (code) => (exchangeRates[code] || initialRateMap[code]).isActive
      ),
    [exchangeRates]
  );

  const hasAvailableCurrency = availableCurrencies.length > 0;

  useEffect(() => {
    if (showRechargeModal) return;

    setIsSubmittingPayment(false);
    setPaymentLink(null);
    setPaymentOrderNo(null);
    setPaymentStatus('idle');
    setPaymentMessage('');
    setPendingCredits(null);
  }, [showRechargeModal]);

  useEffect(() => {
    if (!showRechargeModal || !paymentOrderNo || paymentStatus === 'success' || paymentStatus === 'closed') {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const pollStatus = async () => {
      try {
        const response = await legacyWebPaymentSidecarClient.getPaymentOrderStatus(paymentOrderNo, {
          requestId: `recharge-status-${paymentOrderNo}`,
        });

        if (cancelled) return;

        if (!response.success) {
          throw new Error(response.error.message || '支付状态查询失败。');
        }

        if (response.data.paymentOrderStatus === 'paid' && response.data.settlementApplied) {
          setPaymentStatus('success');
          setPaymentMessage('支付成功，积分已经同步到当前余额。');
          await refreshBilling();
          notify.success('充值成功', pendingCredits ? `已到账 ${pendingCredits} 积分` : '积分已同步到余额。');
          return;
        }

        if (response.data.paymentOrderStatus === 'cancelled') {
          setPaymentStatus('closed');
          setPaymentMessage('订单已关闭，请重新发起充值。');
          return;
        }

        if (response.data.paymentOrderStatus === 'failed' || response.data.paymentOrderStatus === 'refunded') {
          setPaymentStatus('failed');
          setPaymentMessage('支付未完成或已退款，请稍后重试。');
          return;
        }

        setPaymentStatus('pending');
        setPaymentMessage(
          response.data.settlementApplied
            ? '订单已创建，等待支付完成。'
            : '支付状态已更新，系统正在同步积分余额。'
        );
      } catch (error: any) {
        if (cancelled) return;
        setPaymentStatus('failed');
        setPaymentMessage(error?.message || '支付状态查询失败，请稍后重试。');
      }

      if (!cancelled) {
        timer = window.setTimeout(pollStatus, 4000);
      }
    };

    void pollStatus();

    return () => {
      cancelled = true;
      if (typeof timer === 'number') {
        window.clearTimeout(timer);
      }
    };
  }, [showRechargeModal, paymentOrderNo, paymentStatus, refreshBilling, pendingCredits]);

  const theme = useMemo(() => {
    if (currency === 'USD') {
      return {
        primary: 'bg-amber-500',
        text: 'text-amber-500',
        border: 'border-amber-500',
        light: 'bg-amber-500/10',
        gradient: 'from-amber-600 to-amber-500',
        shadow: 'shadow-amber-500/40',
        accent: '#f59e0b',
        via: 'via-amber-500/40',
      };
    }

    if (selectedChannel === 'wechat') {
      return {
        primary: 'bg-emerald-500',
        text: 'text-emerald-500',
        border: 'border-emerald-500',
        light: 'bg-emerald-500/10',
        gradient: 'from-emerald-600 to-emerald-500',
        shadow: 'shadow-emerald-500/40',
        accent: '#10b981',
        via: 'via-emerald-500/40',
      };
    }

    return {
      primary: 'bg-blue-600',
      text: 'text-blue-600',
      border: 'border-blue-500',
      light: 'bg-blue-500/10',
      gradient: 'from-blue-600 to-blue-500',
      shadow: 'shadow-blue-500/40',
      accent: '#3b82f6',
      via: 'via-blue-500/40',
    };
  }, [currency, selectedChannel]);

  const handleCurrencyChange = (nextCurrency: SupportedRechargeCurrency) => {
    const rate = exchangeRates[nextCurrency] || initialRateMap[nextCurrency];
    setCurrency(nextCurrency);
    setSelectedChannel(nextCurrency === 'CNY' ? 'alipay' : 'paypal');
    setAmount(
      Math.min(
        rate.maxAmount ?? (nextCurrency === 'CNY' ? 500 : 100),
        Math.max(rate.minAmount ?? (nextCurrency === 'CNY' ? 5 : 1), nextCurrency === 'CNY' ? 20 : 5)
      )
    );
  };

  useEffect(() => {
    if (!hasAvailableCurrency) return;
    if (!availableCurrencies.includes(currency)) {
      handleCurrencyChange(availableCurrencies[0]);
    }
  }, [availableCurrencies, currency, hasAvailableCurrency]);

  const handleRecharge = async () => {
    if (!user) {
      notify.error('请先登录', '登录后才能发起充值。');
      return;
    }

    if (!hasAvailableCurrency || !currentRate.isActive) {
      notify.error('充值暂不可用', '当前没有启用中的充值币种，请稍后重试或联系管理员。');
      return;
    }

    const paymentChannel = isCny ? selectedChannel : 'paypal';
    if (paymentChannel === 'wechat') {
      notify.wechat('微信支付维护中', '当前暂未开放在线支付，请联系管理员处理。');
      return;
    }

    if (paymentChannel !== 'alipay') {
      notify.paypal('国际支付维护中', '当前暂未开放在线支付，请联系管理员处理。');
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentStatus('pending');
    setPaymentMessage('正在创建支付订单...');
    setPendingCredits(credits);

    try {
      const response = await legacyWebPaymentSidecarClient.createPaymentOrder({
        providerCode: 'alipay',
        amount: amount.toFixed(2),
        currency,
        returnUrl: buildReturnUrl(),
        notifyUrl: buildPaymentSidecarAbsoluteUrl('/payment/v1/callbacks/alipay'),
        idempotencyKey: `recharge-${user.id}-${currency}-${amount}-${Date.now()}`,
        userId: user.id,
      }, {
        requestId: `recharge-create-${user.id}-${Date.now()}`,
      });

      if (!response.success) {
        throw new Error(response.error.message || '支付订单创建失败。');
      }

      setPaymentLink(response.data.paymentUrl);
      setPaymentOrderNo(response.data.merchantOrderNo);
      setPendingCredits(response.data.creditAmount);
      setPaymentStatus('pending');
      setPaymentMessage('订单已创建，请完成支付，系统会自动同步积分余额。');
      notify.alipay('订单已创建', '请扫码或打开支付链接完成支付，到账后会自动刷新余额。');
    } catch (error: any) {
      const message = error?.message || '支付订单创建失败，请稍后重试。';
      setPaymentStatus('failed');
      setPaymentMessage(message);
      notify.error('创建充值订单失败', message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (!showRechargeModal) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[10020] flex justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 ${
        isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-center p-4'
      }`}
      onClick={() => setShowRechargeModal(false)}
    >
      <div
        className={`w-full overflow-hidden border border-gray-200 shadow-2xl animate-in zoom-in-95 duration-300 dark:border-white/10 ${
          isMobile
            ? 'ios-mobile-sheet mobile-sheet-viewport flex min-h-0 max-w-[760px] flex-col rounded-t-[26px] rounded-b-none'
            : 'max-w-[460px] rounded-[30px]'
        }`}
        style={{ backgroundColor: 'var(--bg-surface, #ffffff)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`${isMobile ? 'mobile-sheet-header-safe p-4 pb-3' : 'p-6 pb-4'} relative`}>
          <div className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent ${theme.via} to-transparent`} />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${theme.light} ${theme.text}`}>
                <Zap size={18} fill="currentColor" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">积分充值</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                  {pick('后台汇率联动', 'Managed Exchange Rate')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRechargeModal(false)}
              className="rounded-full p-2 text-gray-500 transition hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={`${isMobile ? 'mobile-sheet-scroll flex-1 px-4 py-2 pb-4' : 'overflow-y-auto px-6 py-2 pb-6'} space-y-5`}>
          {availableCurrencies.length > 0 ? (
            <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-white/5 dark:bg-zinc-900">
              {availableCurrencies.map((code) => (
                <button
                  key={code}
                  onClick={() => handleCurrencyChange(code)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    currency === code
                      ? `${theme.primary} text-white shadow-lg`
                      : 'text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                  }`}
                >
                  {code === 'CNY' ? '人民币 (CNY)' : '美元 (USD)'}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 dark:border-white/10 dark:text-zinc-400">
              当前没有启用中的充值币种，请先在管理后台检查汇率配置。
            </div>
          )}

          <div className="rounded-[26px] border border-gray-200 bg-gray-50 px-6 py-6 dark:border-white/5 dark:bg-zinc-900/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                  预计到账
                </div>
                <div className={`mt-3 text-5xl font-black tracking-tight ${theme.text}`}>{credits}</div>
                <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                  支付金额 {formatCurrencySymbol(currency)}
                  {amount}
                </div>
              </div>

              <div className={`rounded-2xl border px-3 py-2 text-xs ${theme.light} ${theme.border} ${theme.text}`}>
                {loadingRates ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    同步中
                  </span>
                ) : (
                  <span>
                    {formatCurrencySymbol(currency)}1 = {formatRateValue(currentRate.creditsPerUnit)} 积分
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                <span>{pick('充值金额', 'Amount')}</span>
                <span>
                  {pick(`最小 ¥${minAmount}`, `MIN $${minAmount}`)} / {pick(`最大 ¥${maxAmount}`, `MAX $${maxAmount}`)}
                </span>
              </div>

              <input
                type="range"
                min={String(minAmount)}
                max={String(maxAmount)}
                step={isCny ? '5' : '1'}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 dark:bg-zinc-800"
                style={{
                  accentColor: theme.accent,
                  backgroundImage: `linear-gradient(to right, ${theme.accent} 0%, ${theme.accent} ${
                    ((amount - minAmount) / Math.max(1, maxAmount - minAmount)) * 100
                  }%, var(--border-default, #e5e5e5) ${
                    ((amount - minAmount) / Math.max(1, maxAmount - minAmount)) * 100
                  }%, var(--border-default, #e5e5e5) 100%)`,
                }}
              />

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <div className="text-xs leading-5 text-gray-500 dark:text-zinc-400">
                  汇率、最小金额和最大金额由管理员统一配置，充值页会自动同步显示。
                </div>
                <input
                  type="number"
                  min={minAmount}
                  max={maxAmount}
                  step={isCny ? 5 : 1}
                  value={amount}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    if (!Number.isFinite(nextValue)) return;
                    setAmount(Math.min(maxAmount, Math.max(minAmount, nextValue)));
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="ml-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
              {pick('支付方式', 'Payment Method')}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {isCny ? (
                <>
                  <button
                    onClick={() => setSelectedChannel('alipay')}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                      selectedChannel === 'alipay'
                        ? `${theme.light} ${theme.border} ${theme.text} shadow-[0_10px_24px_rgba(59,130,246,0.12)]`
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/10'
                    }`}
                  >
                    <img src={alipayIcon} className="h-8 w-8 object-contain" alt="alipay" />
                    <div>
                      <div className="text-sm font-semibold">支付宝</div>
                      <div className="mt-1 text-xs text-current/70">适合人民币充值</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedChannel('wechat')}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                      selectedChannel === 'wechat'
                        ? `${theme.light} ${theme.border} ${theme.text} shadow-[0_10px_24px_rgba(16,185,129,0.12)]`
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/10'
                    }`}
                  >
                    <img src={wechatIcon} className="h-8 w-8 object-contain" alt="wechat" />
                    <div>
                      <div className="text-sm font-semibold">微信支付</div>
                      <div className="mt-1 text-xs text-current/70">适合移动端扫码</div>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedChannel('paypal')}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                    selectedChannel === 'paypal'
                      ? `${theme.light} ${theme.border} ${theme.text} shadow-[0_10px_24px_rgba(245,158,11,0.12)]`
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-white/5 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/10'
                  }`}
                >
                  <img src={cardIcon} className="h-8 w-8 object-contain" alt="card" />
                  <div>
                    <div className="text-sm font-semibold">{pick('银行卡 / PayPal', 'Card / PayPal')}</div>
                    <div className="mt-1 text-xs text-current/70">{pick('适合国际支付', 'Best for international payments')}</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {paymentLink && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/5 dark:bg-zinc-900/50">
              <div className={`inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${theme.light} ${theme.text}`}>
                {paymentStatus === 'success'
                  ? <CheckCircle2 size={14} className="shrink-0" />
                  : <Loader2 size={14} className={`${paymentStatus === 'pending' ? 'animate-spin' : ''} shrink-0`} />}
                {PAYMENT_STATUS_LABELS[paymentStatus]}
              </div>

              <div className={`mt-4 grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-[180px_minmax(0,1fr)]'}`}>
                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <QRCodeCanvas value={paymentLink} size={isMobile ? 160 : 180} includeMargin />
                  </div>
                </div>

                <div className="space-y-3 text-sm text-gray-600 dark:text-zinc-300">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">{pick('订单号', 'Order')}</div>
                    <div className="mt-1 break-all font-medium text-gray-900 dark:text-white">{paymentOrderNo}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">{pick('支付状态', 'Status')}</div>
                    <div className="mt-1">{paymentMessage || '请使用支付工具完成支付，成功后会自动刷新余额。'}</div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400">
                    {pendingCredits ? `本次预计到账 ${pendingCredits} 积分。` : '到账积分将按当前汇率同步。'}
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open(paymentLink, '_blank', 'noopener,noreferrer')}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${theme.border} ${theme.text} ${theme.light}`}
                  >
                    <ExternalLink size={14} />
                    打开支付页
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600 dark:border-white/5 dark:bg-zinc-900/50 dark:text-zinc-400">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl p-2 ${theme.light} ${theme.text}`}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">当前充值说明</div>
                <div className="mt-1">
                  汇率和金额范围直接来自后台配置。支付成功后，支付边车会把结算结果回写到主 API，积分余额会自动同步。
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleRecharge}
            className={`flex h-14 w-full min-w-0 items-center justify-center gap-3 overflow-hidden whitespace-nowrap rounded-2xl text-lg font-semibold text-white shadow-xl transition-all ${
              loadingRates || !hasAvailableCurrency || isSubmittingPayment
                ? 'cursor-not-allowed bg-gray-300 dark:bg-zinc-800'
                : `bg-gradient-to-r ${theme.gradient} ${theme.shadow} hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]`
            }`}
            disabled={loadingRates || !hasAvailableCurrency || isSubmittingPayment}
          >
            {loadingRates || isSubmittingPayment ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <Wallet size={18} className="shrink-0" />}
            {loadingRates ? '同步汇率中...' : hasAvailableCurrency ? '发起充值' : '当前不可充值'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
