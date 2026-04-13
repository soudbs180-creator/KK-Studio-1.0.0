import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Wallet, X, Zap } from 'lucide-react';

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
  buildRechargeSubmissionRequestId,
  getRechargeSubmissionErrorMessage,
  getRechargeSubmissionStatusLabel,
  sanitizeTransferReferenceLast4,
  submitRechargeRequest,
  type RechargeSubmissionChannel,
} from '../../services/billing/rechargeSubmissionService';
import { notify } from '../../services/system/notificationService';
import { localizeUserFacingText } from '../../utils/localeText';

const INITIAL_RATE_MAP: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
};

const CHANNEL_OPTIONS: Array<{
  value: RechargeSubmissionChannel;
  label: string;
  hint: string;
}> = [
  { value: 'alipay', label: '支付宝', hint: '适合人民币静态码转账后提交。' },
  { value: 'wechat', label: '微信', hint: '适合移动端扫码转账后提交。' },
  { value: 'paypal', label: 'PayPal', hint: '适合国际付款后提交核销信息。' },
  { value: 'bank', label: '银行卡', hint: '适合线下或网银转账核销。' },
  { value: 'manual', label: '人工处理', hint: '联系管理员后人工核销。' },
];

const formatCurrencySymbol = (currency: SupportedRechargeCurrency) => (currency === 'CNY' ? '¥' : '$');

const CHANNEL_SELECTION_STYLES: Record<RechargeSubmissionChannel, React.CSSProperties> = {
  alipay: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#93c5fd',
    boxShadow: '0 16px 36px rgba(59, 130, 246, 0.18)',
  },
  wechat: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: '#86efac',
    boxShadow: '0 16px 36px rgba(34, 197, 94, 0.18)',
  },
  paypal: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#fcd34d',
    boxShadow: '0 16px 36px rgba(245, 158, 11, 0.18)',
  },
  bank: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    color: '#e2e8f0',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.2)',
  },
  manual: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    color: '#e2e8f0',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.2)',
  },
};

const formatRateValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const RechargeModal: React.FC = () => {
  const { showRechargeModal, setShowRechargeModal, refreshBilling } = useBilling();
  const { user } = useAuth();
  const { pick } = useLocale();

  const [exchangeRates, setExchangeRates] = useState<Record<SupportedRechargeCurrency, CreditExchangeRate>>(INITIAL_RATE_MAP);
  const [loadingRates, setLoadingRates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currency, setCurrency] = useState<SupportedRechargeCurrency>('CNY');
  const [amount, setAmount] = useState<number>(20);
  const [paymentChannel, setPaymentChannel] = useState<RechargeSubmissionChannel>('alipay');
  const [transferReferenceLast4, setTransferReferenceLast4] = useState('');
  const [note, setNote] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);

  const availableCurrencies = useMemo(
    () =>
      (['CNY', 'USD'] as SupportedRechargeCurrency[]).filter(
        (code) => (exchangeRates[code] || INITIAL_RATE_MAP[code]).isActive,
      ),
    [exchangeRates],
  );

  const currentRate = exchangeRates[currency] || INITIAL_RATE_MAP[currency];
  const minAmount = currentRate.minAmount ?? (currency === 'CNY' ? 5 : 1);
  const maxAmount = currentRate.maxAmount ?? (currency === 'CNY' ? 500 : 100);
  const estimatedCredits = Math.max(0, Math.round(Math.max(0, amount) * currentRate.creditsPerUnit));

  const channelOptions = useMemo(() => {
    if (currency === 'USD') {
      return CHANNEL_OPTIONS.filter((item) => item.value === 'paypal' || item.value === 'bank' || item.value === 'manual');
    }

    return CHANNEL_OPTIONS.filter((item) => item.value !== 'paypal');
  }, [currency]);

  useEffect(() => {
    let alive = true;

    if (!showRechargeModal) {
      return () => {
        alive = false;
      };
    }

    setLoadingRates(true);
    void getCreditExchangeRateMap()
      .then((nextRates) => {
        if (alive) {
          setExchangeRates(nextRates);
        }
      })
      .finally(() => {
        if (alive) {
          setLoadingRates(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [showRechargeModal]);

  useEffect(() => {
    if (!availableCurrencies.includes(currency) && availableCurrencies.length > 0) {
      setCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, currency]);

  useEffect(() => {
    setAmount((current) => Math.max(minAmount, Math.min(maxAmount, current)));
  }, [minAmount, maxAmount]);

  useEffect(() => {
    if (!channelOptions.some((item) => item.value === paymentChannel)) {
      setPaymentChannel(channelOptions[0]?.value || 'manual');
    }
  }, [channelOptions, paymentChannel]);

  useEffect(() => {
    if (showRechargeModal) {
      return;
    }

    setCurrency('CNY');
    setAmount(20);
    setPaymentChannel('alipay');
    setTransferReferenceLast4('');
    setNote('');
    setSubmitting(false);
    setSubmissionMessage('');
    setSubmissionStatus(null);
  }, [showRechargeModal]);

  const handleSubmit = async () => {
    if (!user?.id) {
      notify.error(
        pick('请先登录', 'Sign in required'),
        pick('登录后才能提交充值申请。', 'Sign in before submitting a recharge request.'),
      );
      return;
    }

    if (availableCurrencies.length === 0 || !currentRate.isActive) {
      notify.error(
        pick('当前不可充值', 'Recharge unavailable'),
        pick('当前没有可用的充值币种，请稍后再试。', 'No recharge currency is currently available.'),
      );
      return;
    }

    setSubmitting(true);
    setSubmissionMessage('');

    try {
      const response = await submitRechargeRequest(
        {
          amount,
          currencyCode: currency,
          paymentChannel,
          transferReferenceLast4,
          note,
        },
        {
          requestId: buildRechargeSubmissionRequestId(user.id),
        },
      );

      if (!response.success) {
        throw new Error(getRechargeSubmissionErrorMessage(response, '提交充值申请失败，请稍后重试。'));
      }

      const nextStatus = response.data.submission.status;
      setSubmissionStatus(nextStatus);
      setSubmissionMessage(`申请已提交，当前状态：${getRechargeSubmissionStatusLabel(nextStatus)}。`);
      notify.success(
        pick('提交成功', 'Submitted'),
        pick('充值申请已提交，等待管理员核销。', 'Your recharge request has been submitted for review.'),
      );
      await refreshBilling({ includeTransactions: true });
    } catch (error: any) {
      const message = localizeUserFacingText(error?.message) || error?.message || '提交充值申请失败，请稍后重试。';
      setSubmissionStatus(null);
      setSubmissionMessage(message);
      notify.error(pick('提交失败', 'Submit failed'), message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!showRechargeModal) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setShowRechargeModal(false)}
    >
      <div
        className="w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#0b1220] text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-2 text-sky-200">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">积分充值</h3>
              <p className="text-xs text-white/60">
                {pick('静态码转账后提交申请，等待人工核销。', 'Transfer with a static payment code, then submit for manual review.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRechargeModal(false)}
            className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">预计到账</div>
                <div className="mt-3 text-5xl font-black tracking-tight text-sky-200">{estimatedCredits}</div>
                <div className="mt-2 text-sm text-white/60">
                  支付金额 {formatCurrencySymbol(currency)}
                  {amount}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                {loadingRates ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    同步汇率中
                  </span>
                ) : (
                  <span>
                    {formatCurrencySymbol(currency)}1 = {formatRateValue(currentRate.creditsPerUnit)} 积分
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">充值币种</div>
            <div className="grid grid-cols-2 gap-3">
              {availableCurrencies.length > 0 ? (
                availableCurrencies.map((item) => {
                  const selected = item === currency;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrency(item)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                        selected
                          ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
                          : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {item === 'CNY' ? '人民币 (CNY)' : '美元 (USD)'}
                    </button>
                  );
                })
              ) : (
                <div className="col-span-2 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60">
                  当前没有启用中的充值币种，请联系管理员检查配置。
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/55">
              <span>充值金额</span>
              <span>
                最小 {formatCurrencySymbol(currency)}{minAmount} / 最大 {formatCurrencySymbol(currency)}{maxAmount}
              </span>
            </div>

            <input
              type="range"
              min={String(minAmount)}
              max={String(maxAmount)}
              step={currency === 'CNY' ? '5' : '1'}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full accent-sky-400"
            />

            <input
              type="number"
              min={minAmount}
              max={maxAmount}
              step={currency === 'CNY' ? 5 : 1}
              value={amount}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (Number.isFinite(nextValue)) {
                  setAmount(Math.max(minAmount, Math.min(maxAmount, nextValue)));
                }
              }}
              className="w-full rounded-2xl border border-white/10 bg-[#101726] px-4 py-3 text-sm text-white outline-none"
            />
          </section>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">支付方式</div>
            <div className="grid gap-3">
              {channelOptions.map((item) => {
                const selected = item.value === paymentChannel;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPaymentChannel(item.value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? ''
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-white/15 hover:bg-white/10'
                    }`}
                    style={selected ? CHANNEL_SELECTION_STYLES[item.value] : undefined}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs opacity-80">{item.hint}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">流水尾号 4 位</span>
              <input
                type="text"
                maxLength={4}
                value={transferReferenceLast4}
                onChange={(event) => setTransferReferenceLast4(sanitizeTransferReferenceLast4(event.target.value))}
                placeholder="例如 8X9Z"
                className="w-full rounded-2xl border border-white/10 bg-[#101726] px-4 py-3 text-sm uppercase text-white outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">备注</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="可选：付款时间或补充说明"
                className="w-full rounded-2xl border border-white/10 bg-[#101726] px-4 py-3 text-sm text-white outline-none"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-sky-200">
                <ShieldCheck size={16} />
              </div>
              <div className="space-y-2">
                <div className="font-medium text-white">提交说明</div>
                <p>
                  先使用管理员提供的静态收款码或固定收款方式完成转账，再填写本次转账流水尾号 4 位提交申请。
                  管理员核销后，积分会同步写入当前账户。
                </p>
                <p>
                  {pick(
                    '本页面不再创建在线支付订单，也不会轮询支付结果。',
                    'This modal no longer creates online payment orders or polls settlement status.',
                  )}
                </p>
                {submissionMessage ? (
                  <p className="text-emerald-200">
                    {submissionStatus ? `${getRechargeSubmissionStatusLabel(submissionStatus as any)}：` : ''}
                    {submissionMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || loadingRates || availableCurrencies.length === 0}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 text-lg font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
            {submitting ? '提交中...' : '提交充值申请'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
