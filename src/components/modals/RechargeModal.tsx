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
  createRechargeBill,
  getRechargeSubmissionErrorMessage,
  getRechargeSubmissionStatusLabel,
  listRechargePaymentChannels,
  normalizeRechargeBillSnapshot,
  sanitizeTransferReferenceLast4,
  submitRechargeProof,
  type RechargeBillSnapshot,
  type RechargePaymentChannelConfig,
  type RechargeSubmissionChannel,
} from '../../services/billing/rechargeSubmissionService';
import { notify } from '../../services/system/notificationService';
import { localizeUserFacingText } from '../../utils/localeText';

const INITIAL_RATE_MAP: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
};

const FALLBACK_CHANNELS: RechargePaymentChannelConfig[] = [
  {
    channel: 'alipay',
    label: '支付宝',
    instructionText: '使用支付宝静态收款码完成转账后，再提交账单编号和流水尾号。',
    isActive: true,
    qrDisplay: {
      title: '支付宝静态码',
      helperText: '如果管理员还没有上传图片，这里会先显示文字占位。',
    },
  },
  {
    channel: 'wechat',
    label: '微信',
    instructionText: '使用微信静态收款码完成转账后，再提交账单编号和流水尾号。',
    isActive: true,
    qrDisplay: {
      title: '微信静态码',
      helperText: '请扫码或联系管理员确认收款方式。',
    },
  },
  {
    channel: 'paypal',
    label: 'PayPal',
    instructionText: '国际付款完成后，再提交账单编号和流水尾号。',
    isActive: false,
    qrDisplay: {
      title: 'PayPal',
      helperText: '当前默认未启用国际付款静态码。',
    },
  },
  {
    channel: 'bank',
    label: '银行卡',
    instructionText: '线下或网银转账后，再提交账单编号和流水尾号。',
    isActive: false,
    qrDisplay: {
      title: '银行卡转账',
      helperText: '当前默认未启用银行卡静态配置。',
    },
  },
  {
    channel: 'manual',
    label: '人工处理',
    instructionText: '联系管理员确认付款后，再按账单编号核销。',
    isActive: true,
    qrDisplay: {
      title: '人工处理',
      helperText: '当静态码未配置时，请联系管理员获取收款方式。',
    },
  },
];

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

const formatCurrencySymbol = (currency: SupportedRechargeCurrency) => (currency === 'CNY' ? '¥' : '$');
const formatRateValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const RechargeModal: React.FC = () => {
  const { showRechargeModal, setShowRechargeModal, refreshBilling } = useBilling();
  const { user } = useAuth();
  const { pick } = useLocale();

  const [exchangeRates, setExchangeRates] = useState<Record<SupportedRechargeCurrency, CreditExchangeRate>>(INITIAL_RATE_MAP);
  const [paymentChannels, setPaymentChannels] = useState<RechargePaymentChannelConfig[]>(FALLBACK_CHANNELS);
  const [loadingRates, setLoadingRates] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [creatingBill, setCreatingBill] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [currency, setCurrency] = useState<SupportedRechargeCurrency>('CNY');
  const [amount, setAmount] = useState<number>(20);
  const [paymentChannel, setPaymentChannel] = useState<RechargeSubmissionChannel>('alipay');
  const [transferReferenceLast4, setTransferReferenceLast4] = useState('');
  const [note, setNote] = useState('');
  const [billSnapshot, setBillSnapshot] = useState<RechargeBillSnapshot | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState('');

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
    const items = paymentChannels.filter((item) => item.isActive !== false);
    if (currency === 'USD') {
      return items.filter((item) => item.channel === 'paypal' || item.channel === 'bank' || item.channel === 'manual');
    }
    return items.filter((item) => item.channel !== 'paypal');
  }, [currency, paymentChannels]);

  const selectedChannelConfig = useMemo(
    () => channelOptions.find((item) => item.channel === paymentChannel) || channelOptions[0] || FALLBACK_CHANNELS[0],
    [channelOptions, paymentChannel],
  );

  const qrDisplay = billSnapshot?.qrDisplay || selectedChannelConfig?.qrDisplay;
  const submissionId = billSnapshot?.submissionId || '--';
  const billNumber = billSnapshot?.billNumber || submissionId;
  const statusLabel = billSnapshot?.statusLabel || getRechargeSubmissionStatusLabel('draft');
  const billEstimatedCredits = billSnapshot?.estimatedCredits ?? estimatedCredits;

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

    setLoadingChannels(true);
    void listRechargePaymentChannels({ requestId: `recharge-payment-channels-${Date.now()}` })
      .then((response) => {
        if (alive && response.success && Array.isArray(response.data.items) && response.data.items.length > 0) {
          setPaymentChannels(response.data.items as RechargePaymentChannelConfig[]);
        }
      })
      .finally(() => {
        if (alive) {
          setLoadingChannels(false);
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
    if (!channelOptions.some((item) => item.channel === paymentChannel)) {
      setPaymentChannel(channelOptions[0]?.channel || 'manual');
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
    setCreatingBill(false);
    setSubmittingProof(false);
    setBillSnapshot(null);
    setSubmissionMessage('');
  }, [showRechargeModal]);

  const handleCreateBill = async () => {
    if (!user?.id) {
      notify.error(
        pick('请先登录', 'Sign in required'),
        pick('登录后才能创建充值账单。', 'Sign in before creating a recharge bill.'),
      );
      return;
    }

    if (availableCurrencies.length === 0 || !currentRate.isActive || !selectedChannelConfig) {
      notify.error(
        pick('当前不可充值', 'Recharge unavailable'),
        pick('当前没有可用的充值币种或支付渠道，请稍后再试。', 'No active recharge currency or payment channel is available right now.'),
      );
      return;
    }

    setCreatingBill(true);
    setSubmissionMessage('');

    try {
      const response = await createRechargeBill(
        {
          amount,
          currencyCode: currency,
          paymentChannel,
          note,
        },
        {
          requestId: buildRechargeSubmissionRequestId(user.id, 'bill'),
        },
      );

      if (!response.success) {
        throw new Error(getRechargeSubmissionErrorMessage(response, '创建账单失败，请稍后重试。'));
      }

      const nextBill = normalizeRechargeBillSnapshot(response.data, {
        amount,
        currencyCode: currency,
        paymentChannel,
        estimatedCredits,
        note,
        status: 'bill_created',
        qrDisplay,
      });
      setBillSnapshot(nextBill);
      setSubmissionMessage(
        pick(
          `账单已创建，请先完成转账。账单编号：${nextBill.billNumber}`,
          `Bill created. Complete the transfer first. Bill number: ${nextBill.billNumber}`,
        ),
      );
      notify.success(
        pick('账单已创建', 'Bill created'),
        pick('请使用静态码完成付款后，再提交付款信息。', 'Use the static payment code, then submit your payment proof.'),
      );
    } catch (error: any) {
      const message = localizeUserFacingText(error?.message) || error?.message || '创建账单失败，请稍后重试。';
      setSubmissionMessage(message);
      notify.error(pick('创建失败', 'Create failed'), message);
    } finally {
      setCreatingBill(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!user?.id) {
      notify.error(
        pick('请先登录', 'Sign in required'),
        pick('登录后才能提交付款信息。', 'Sign in before submitting payment proof.'),
      );
      return;
    }

    if (!billSnapshot?.submissionId) {
      notify.error(
        pick('请先创建账单', 'Create a bill first'),
        pick('请先创建账单，再提交付款流水尾号。', 'Create a bill before submitting the transfer reference tail.'),
      );
      return;
    }

    setSubmittingProof(true);
    setSubmissionMessage('');

    try {
      const response = await submitRechargeProof(
        {
          submissionId: billSnapshot.submissionId,
          billNumber: billSnapshot.billNumber,
          amount: billSnapshot.amount,
          currencyCode: billSnapshot.currencyCode,
          paymentChannel: billSnapshot.paymentChannel,
          transferReferenceLast4,
          note,
        },
        {
          requestId: buildRechargeSubmissionRequestId(user.id, 'proof'),
        },
      );

      if (!response.success) {
        throw new Error(getRechargeSubmissionErrorMessage(response, '提交付款信息失败，请稍后重试。'));
      }

      const nextBill = normalizeRechargeBillSnapshot(response.data, {
        submissionId: billSnapshot.submissionId,
        billNumber: billSnapshot.billNumber,
        amount: billSnapshot.amount,
        currencyCode: billSnapshot.currencyCode,
        paymentChannel: billSnapshot.paymentChannel,
        estimatedCredits: billSnapshot.estimatedCredits,
        transferReferenceLast4,
        note,
        status: 'pending',
        qrDisplay,
        submittedAt: billSnapshot.submittedAt,
      });
      setBillSnapshot(nextBill);
      setSubmissionMessage(
        pick(
          `付款信息已提交，当前状态：${nextBill.statusLabel}。`,
          `Payment proof submitted. Current status: ${nextBill.statusLabel}.`,
        ),
      );
      notify.success(
        pick('提交成功', 'Submitted'),
        pick('充值申请已提交，等待管理员核销。', 'Your recharge request has been submitted for review.'),
      );
      await refreshBilling({ includeTransactions: true });
    } catch (error: any) {
      const message = localizeUserFacingText(error?.message) || error?.message || '提交付款信息失败，请稍后重试。';
      setSubmissionMessage(message);
      notify.error(pick('提交失败', 'Submit failed'), message);
    } finally {
      setSubmittingProof(false);
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
        className="w-full max-w-[560px] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,19,0.98)_0%,rgba(5,8,14,1)_100%)] text-white shadow-[0_40px_96px_rgba(0,0,0,0.56)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-white/10 px-6 py-5">
          <div className="absolute left-0 top-0 h-1 w-full bg-[linear-gradient(90deg,transparent_0%,rgba(59,130,246,0.45)_50%,transparent_100%)]" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-2 text-sky-200 shadow-[0_20px_44px_rgba(59,130,246,0.24)]">
                <Zap size={18} />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{pick('积分充值', 'Recharge credits')}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/55">
                  {pick('旧界面壳 + 静态码账单流', 'Classic shell + static bill flow')}
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
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {availableCurrencies.map((item) => {
              const selected = item === currency;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrency(item)}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition"
                  style={selected
                    ? {
                        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                        color: '#ffffff',
                        boxShadow: '0 18px 36px rgba(59, 130, 246, 0.18)',
                      }
                    : { color: 'rgba(226, 232, 240, 0.72)' }}
                >
                  {item === 'CNY' ? '人民币 (CNY)' : '美元 (USD)'}
                </button>
              );
            })}
          </div>

          <section className="rounded-[26px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_22px_48px_rgba(0,0,0,0.32)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('预计到账', 'Estimated credits')}</div>
                <div className="mt-3 text-5xl font-black tracking-tight text-sky-200">{billEstimatedCredits}</div>
                <div className="mt-2 text-sm text-white/60">
                  {pick('支付金额', 'Amount')} {formatCurrencySymbol(currency)}
                  {amount}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs text-sky-100">
                {loadingRates ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    {pick('同步汇率中', 'Syncing')}
                  </span>
                ) : (
                  <span>
                    {formatCurrencySymbol(currency)}1 = {formatRateValue(currentRate.creditsPerUnit)} {pick('积分', 'credits')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/55">
                <span>{pick('充值金额', 'Recharge amount')}</span>
                <span>
                  {pick('最小', 'Min')} {formatCurrencySymbol(currency)}
                  {minAmount} / {pick('最大', 'Max')} {formatCurrencySymbol(currency)}
                  {maxAmount}
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
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <div className="text-xs leading-5 text-white/60">
                  {pick(
                    '汇率、最小金额和最大金额仍然直接来自当前账本配置。创建账单后不会跳转支付页，只会保留账单编号和静态收款码。',
                    'Rates and amount limits still come from the current ledger config. Creating a bill does not open a payment page.',
                  )}
                </div>
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
                  className="w-full rounded-xl border border-white/10 bg-[#10151e] px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('支付方式', 'Payment method')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {channelOptions.map((item) => {
                const selected = item.channel === paymentChannel;
                return (
                  <button
                    key={item.channel}
                    type="button"
                    onClick={() => setPaymentChannel(item.channel)}
                    className="rounded-2xl border p-4 text-left transition"
                    style={selected ? CHANNEL_SELECTION_STYLES[item.channel] : {
                      borderColor: 'rgba(255,255,255,0.08)',
                      backgroundColor: 'rgba(15,23,42,0.76)',
                      color: 'rgba(226,232,240,0.82)',
                      boxShadow: '0 18px 40px rgba(0,0,0,0.24)',
                    }}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs opacity-80">
                      {item.instructionText || pick('按账单号完成后续核销。', 'Follow the bill number for review.')}
                    </div>
                  </button>
                );
              })}
            </div>
            {loadingChannels ? (
              <div className="text-xs text-white/55">{pick('正在读取本地静态码配置...', 'Loading local static payment channels...')}</div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.68)] p-4 text-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('账单信息', 'Bill info')}</div>
                <div className="mt-2 text-lg font-semibold text-white">{pick('账单编号', 'Bill number')}: {billNumber}</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                {statusLabel}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">submissionId</div>
                <div className="mt-1 break-all font-medium text-white">{submissionId}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">billNumber</div>
                <div className="mt-1 break-all font-medium text-white">{billNumber}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('支付渠道', 'Channel')}</div>
                <div className="mt-1 text-white">{selectedChannelConfig?.label || paymentChannel}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">estimatedCredits</div>
                <div className="mt-1 font-semibold text-white">{billEstimatedCredits}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('静态收款码', 'Static payment code')}</div>
              <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0f172a] p-3">
                {qrDisplay?.imageUrl ? (
                  <img
                    src={qrDisplay.imageUrl}
                    alt={qrDisplay.title || 'static payment code'}
                    className="max-h-[160px] w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="text-center text-xs leading-6 text-white/60">
                    <div className="font-semibold text-white/85">{qrDisplay?.title || selectedChannelConfig?.label || 'Static QR'}</div>
                    <div className="mt-2">{qrDisplay?.helperText || pick('管理员尚未上传二维码图片。', 'No QR image has been configured yet.')}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">qrDisplay</div>
                <div className="mt-2 text-sm font-medium text-white">
                  {qrDisplay?.title || selectedChannelConfig?.label || pick('静态收款码', 'Static payment code')}
                </div>
                <div className="mt-2 text-sm text-white/65">
                  {qrDisplay?.helperText || selectedChannelConfig?.instructionText || pick('创建账单后按账单编号提交付款信息。', 'Create a bill, then submit payment proof by bill number.')}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">transferReferenceLast4</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={transferReferenceLast4}
                    onChange={(event) => setTransferReferenceLast4(sanitizeTransferReferenceLast4(event.target.value))}
                    placeholder={pick('例如 8X9Z', 'For example 8X9Z')}
                    className="w-full rounded-xl border border-white/10 bg-[#101726] px-4 py-3 text-sm uppercase text-white outline-none"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('备注', 'Note')}</span>
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={pick('可选：付款时间或补充说明', 'Optional: payment time or note')}
                    className="w-full rounded-xl border border-white/10 bg-[#101726] px-4 py-3 text-sm text-white outline-none"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/55">statusLabel</div>
                <div className="font-medium text-white">{statusLabel}</div>
                {submissionMessage ? (
                  <div className="mt-2 text-emerald-200">{submissionMessage}</div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-sky-200">
                <ShieldCheck size={16} />
              </div>
              <div className="space-y-2">
                <div className="font-medium text-white">{pick('操作说明', 'Instructions')}</div>
                <p>
                  {pick(
                    '先点击创建账单，获取账单编号并使用静态收款码完成转账；付款完成后，再填写流水尾号并提交付款信息。',
                    'Create a bill first, complete the transfer with the static code, then submit the transfer reference tail.',
                  )}
                </p>
                <p>
                  {pick(
                    '该页面不会创建在线订单，也不会轮询支付状态。',
                    'This modal does not create online orders and does not poll payment status.',
                  )}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleCreateBill()}
              disabled={creatingBill || loadingRates || loadingChannels || availableCurrencies.length === 0 || channelOptions.length === 0}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-sky-300/20 bg-[linear-gradient(135deg,#2563eb_0%,#3b82f6_100%)] text-lg font-semibold text-white shadow-[0_18px_36px_rgba(59,130,246,0.18)] transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
            >
              {creatingBill ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
              {pick('创建账单', 'Create bill')}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitProof()}
              disabled={submittingProof || !billSnapshot?.submissionId}
              className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-emerald-300/20 bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] text-lg font-semibold text-white shadow-[0_18px_36px_rgba(16,185,129,0.18)] transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
            >
              {submittingProof ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              {pick('提交付款信息', 'Submit payment proof')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
