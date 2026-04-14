import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Receipt, ShieldCheck, Wallet, X, Zap } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
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
      helperText: '若管理员暂未上传图片，请联系管理员获取收款二维码。',
    },
  },
  {
    channel: 'wechat',
    label: '微信',
    instructionText: '使用微信静态收款码完成转账后，再提交账单编号和流水尾号。',
    isActive: true,
    qrDisplay: {
      title: '微信静态码',
      helperText: '移动端可直接扫码，桌面端请联系管理员获取二维码。',
    },
  },
  {
    channel: 'paypal',
    label: 'PayPal',
    instructionText: '完成国际付款后，再提交账单编号和流水尾号。',
    isActive: false,
    qrDisplay: {
      title: 'PayPal',
      helperText: '默认未启用国际付款，请联系管理员确认渠道。',
    },
  },
  {
    channel: 'bank',
    label: '银行卡',
    instructionText: '线下或网银转账后，再提交账单编号和流水尾号。',
    isActive: false,
    qrDisplay: {
      title: '银行卡转账',
      helperText: '默认未启用银行卡静态配置，请联系管理员确认收款账户。',
    },
  },
  {
    channel: 'manual',
    label: '人工处理',
    instructionText: '联系管理员确认付款方式后，再按账单编号提交付款凭证。',
    isActive: true,
    qrDisplay: {
      title: '人工处理',
      helperText: '当静态码未配置时，请联系管理员获取当前收款方式。',
    },
  },
];

const CHANNEL_SELECTION_STYLES: Record<RechargeSubmissionChannel, React.CSSProperties> = {
  alipay: {
    borderColor: 'rgba(59, 130, 246, 0.35)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
  },
  wechat: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: '#bbf7d0',
  },
  paypal: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#fde68a',
  },
  bank: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    color: '#e2e8f0',
  },
  manual: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    color: '#e2e8f0',
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
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [billSnapshot, setBillSnapshot] = useState<RechargeBillSnapshot | null>(null);

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
    const activeChannels = paymentChannels.filter((channel) => channel.isActive !== false);

    if (currency === 'USD') {
      return activeChannels.filter(
        (channel) => channel.channel === 'paypal' || channel.channel === 'bank' || channel.channel === 'manual',
      );
    }

    return activeChannels.filter((channel) => channel.channel !== 'paypal');
  }, [currency, paymentChannels]);

  const selectedChannelConfig = useMemo(
    () => channelOptions.find((channel) => channel.channel === paymentChannel) || channelOptions[0] || FALLBACK_CHANNELS[0],
    [channelOptions, paymentChannel],
  );

  const submissionId = billSnapshot?.submissionId || '--';
  const billNumber = billSnapshot?.billNumber || '--';
  const statusLabel = billSnapshot?.statusLabel || getRechargeSubmissionStatusLabel('draft');
  const qrDisplay = billSnapshot?.qrDisplay || selectedChannelConfig?.qrDisplay;

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
    void listRechargePaymentChannels({
      requestId: `recharge-payment-channels-${Date.now()}`,
    })
      .then((response) => {
        if (!alive || !response.success || !Array.isArray(response.data.items) || response.data.items.length === 0) {
          return;
        }

        setPaymentChannels(response.data.items as RechargePaymentChannelConfig[]);
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
    setAmount((currentAmount) => Math.max(minAmount, Math.min(maxAmount, currentAmount)));
  }, [maxAmount, minAmount]);

  useEffect(() => {
    if (!channelOptions.some((channel) => channel.channel === paymentChannel)) {
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
    setSubmissionMessage('');
    setBillSnapshot(null);
    setCreatingBill(false);
    setSubmittingProof(false);
  }, [showRechargeModal]);

  const closeModal = () => {
    setShowRechargeModal(false);
  };

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
          paymentChannel: selectedChannelConfig.channel,
          note,
        },
        {
          requestId: buildRechargeSubmissionRequestId(user.id, 'bill'),
        },
      );

      if (!response.success) {
        throw new Error(getRechargeSubmissionErrorMessage(response, '创建充值账单失败，请稍后重试。'));
      }

      const nextBillSnapshot = normalizeRechargeBillSnapshot(response.data, {
        amount,
        currencyCode: currency,
        paymentChannel: selectedChannelConfig.channel,
        estimatedCredits,
        note,
        status: 'bill_created',
        qrDisplay: selectedChannelConfig.qrDisplay,
      });

      setBillSnapshot(nextBillSnapshot);
      setSubmissionMessage(
        pick(
          `账单已创建，请完成转账后提交流水尾号。`,
          'Bill created. Complete the transfer, then submit the payment proof.',
        ),
      );
      notify.success(
        pick('账单已创建', 'Bill created'),
        pick('请按当前渠道完成转账，然后提交付款凭证。', 'Complete the transfer using the selected channel, then submit payment proof.'),
      );
    } catch (error) {
      const message = localizeUserFacingText(error instanceof Error ? error.message : '') || '创建充值账单失败，请稍后重试。';
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
        pick('登录后才能提交付款凭证。', 'Sign in before submitting payment proof.'),
      );
      return;
    }

    if (!selectedChannelConfig) {
      notify.error(
        pick('渠道不可用', 'Channel unavailable'),
        pick('当前支付渠道不可用，请重新创建账单。', 'The payment channel is unavailable. Create a new bill first.'),
      );
      return;
    }

    setSubmittingProof(true);
    setSubmissionMessage('');

    try {
      const response = await submitRechargeProof(
        {
          submissionId: billSnapshot?.submissionId,
          billNumber: billSnapshot?.billNumber,
          amount: billSnapshot?.amount ?? amount,
          currencyCode: billSnapshot?.currencyCode ?? currency,
          paymentChannel: billSnapshot?.paymentChannel ?? selectedChannelConfig.channel,
          transferReferenceLast4,
          note,
        },
        {
          requestId: buildRechargeSubmissionRequestId(user.id, 'proof'),
        },
      );

      if (!response.success) {
        throw new Error(getRechargeSubmissionErrorMessage(response, '提交付款凭证失败，请稍后重试。'));
      }

      const nextBillSnapshot = normalizeRechargeBillSnapshot(response.data, {
        submissionId: billSnapshot?.submissionId,
        billNumber: billSnapshot?.billNumber,
        amount: billSnapshot?.amount ?? amount,
        currencyCode: billSnapshot?.currencyCode ?? currency,
        paymentChannel: billSnapshot?.paymentChannel ?? selectedChannelConfig.channel,
        estimatedCredits: billSnapshot?.estimatedCredits ?? estimatedCredits,
        note,
        transferReferenceLast4,
        status: 'proof_submitted',
        qrDisplay: billSnapshot?.qrDisplay || selectedChannelConfig.qrDisplay,
      });

      setBillSnapshot(nextBillSnapshot);
      setSubmissionMessage(
        pick(
          `付款凭证已提交，当前状态：${nextBillSnapshot.statusLabel}。`,
          `Payment proof submitted. Current status: ${nextBillSnapshot.statusLabel}.`,
        ),
      );
      await refreshBilling({ includeTransactions: true });
      notify.success(
        pick('提交成功', 'Submitted'),
        pick('付款凭证已提交，等待管理员审核。', 'Your payment proof has been submitted for review.'),
      );
    } catch (error) {
      const message = localizeUserFacingText(error instanceof Error ? error.message : '') || '提交付款凭证失败，请稍后重试。';
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
      className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-2 text-sky-200">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{pick('积分充值', 'Balance recharge')}</h3>
              <p className="text-xs text-white/60">
                {pick('先创建账单，再按静态码转账并提交付款凭证。', 'Create a bill first, then transfer with the static channel and submit payment proof.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('预计到账', 'Estimated credits')}</div>
                  <div className="mt-3 text-5xl font-black tracking-tight text-sky-200">{billSnapshot?.estimatedCredits ?? estimatedCredits}</div>
                  <div className="mt-2 text-sm text-white/60">
                    {pick('支付金额', 'Payment amount')} {formatCurrencySymbol(currency)}
                    {billSnapshot?.amount ?? amount}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                  {loadingRates ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      {pick('同步汇率中', 'Syncing rates')}
                    </span>
                  ) : (
                    <span>
                      {formatCurrencySymbol(currency)}1 = {formatRateValue(currentRate.creditsPerUnit)} {pick('积分', 'credits')}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('充值币种', 'Recharge currency')}</div>
              <div className="grid grid-cols-2 gap-3">
                {availableCurrencies.length > 0 ? (
                  availableCurrencies.map((item) => {
                    const selected = item === currency;

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrency(item)}
                        disabled={creatingBill || submittingProof}
                        className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                          selected
                            ? 'border-sky-400/40 bg-sky-400/15 text-sky-100'
                            : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {item === 'CNY' ? '人民币 (CNY)' : '美元 (USD)'}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-white/60">
                    {pick('当前没有启用中的充值币种，请联系管理员检查配置。', 'No active recharge currency is available right now.')}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/55">
                <span>{pick('充值金额', 'Amount')}</span>
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
                disabled={creatingBill || submittingProof}
                className="h-2 w-full cursor-pointer appearance-none rounded-full accent-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
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
                disabled={creatingBill || submittingProof}
                className="w-full rounded-2xl border border-white/10 bg-[#101726] px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/55">
                <span>{pick('支付方式', 'Payment channel')}</span>
                {loadingChannels ? (
                  <span className="inline-flex items-center gap-1 text-white/55">
                    <Loader2 size={12} className="animate-spin" />
                    {pick('同步中', 'Syncing')}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3">
                {channelOptions.map((channel) => {
                  const selected = channel.channel === paymentChannel;

                  return (
                    <button
                      key={channel.channel}
                      type="button"
                      onClick={() => setPaymentChannel(channel.channel)}
                      disabled={creatingBill || submittingProof}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? ''
                          : 'border-white/10 bg-white/5 text-white/80 hover:border-white/15 hover:bg-white/10'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      style={selected ? CHANNEL_SELECTION_STYLES[channel.channel] : undefined}
                    >
                      <div className="text-sm font-semibold">{channel.label}</div>
                      <div className="mt-1 text-xs opacity-80">{channel.instructionText || pick('按当前渠道说明完成转账。', 'Follow the current channel instructions to complete the transfer.')}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('流水尾号 4 位', 'Last 4 transfer chars')}</span>
                <input
                  type="text"
                  maxLength={4}
                  value={transferReferenceLast4}
                  onChange={(event) => setTransferReferenceLast4(sanitizeTransferReferenceLast4(event.target.value))}
                  placeholder={pick('例如 8X9Z', 'Example 8X9Z')}
                  className="w-full rounded-2xl border border-white/10 bg-[#101726] px-4 py-3 text-sm uppercase text-white outline-none"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/55">{pick('备注', 'Note')}</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={pick('可选：付款时间或补充说明', 'Optional: payment time or extra context')}
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
                  <div className="font-medium text-white">{pick('流程说明', 'Flow')}</div>
                  <p>{pick('1. 先创建账单并记录账单编号。2. 按右侧静态渠道完成转账。3. 回到这里填写流水尾号并提交付款凭证。', '1. Create a bill and keep the bill number. 2. Complete the transfer using the static channel on the right. 3. Come back here, enter the transfer tail, and submit the payment proof.')}</p>
                  {submissionMessage ? <p className="text-emerald-200">{submissionMessage}</p> : null}
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCreateBill}
                disabled={creatingBill || submittingProof || availableCurrencies.length === 0 || !selectedChannelConfig}
                className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-sky-400/35 bg-sky-500/15 px-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingBill ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
                {pick('创建账单', 'Create bill')}
              </button>

              <button
                type="button"
                onClick={handleSubmitProof}
                disabled={creatingBill || submittingProof || !billSnapshot}
                className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {submittingProof ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                {pick('提交付款凭证', 'Submit payment proof')}
              </button>
            </div>
          </div>

          <aside className="space-y-4 rounded-3xl border border-white/10 bg-[#111b2f] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wallet size={16} className="text-sky-200" />
              {pick('当前账单', 'Current bill')}
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">submissionId</div>
                <div className="break-all font-medium text-white/90">{submissionId}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">billNumber</div>
                <div className="break-all font-medium text-white/90">{billNumber}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">statusLabel</div>
                <div className="font-medium text-emerald-200">{statusLabel}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">estimatedCredits</div>
                <div className="font-medium text-white/90">{billSnapshot?.estimatedCredits ?? estimatedCredits}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">transferReferenceLast4</div>
                <div className="font-medium text-white/90">{transferReferenceLast4 || '--'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-4">
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/45">qrDisplay</div>
              {qrDisplay?.imageUrl ? (
                <img
                  src={qrDisplay.imageUrl}
                  alt={qrDisplay.title || 'Recharge QR'}
                  className="h-44 w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-44 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-center text-xs text-white/55">
                  {qrDisplay?.title || pick('等待管理员配置静态码', 'Waiting for the admin to configure the static code')}
                </div>
              )}

              <div className="mt-3 space-y-1 text-xs text-white/70">
                <div className="font-medium text-white/90">{qrDisplay?.title || selectedChannelConfig?.label}</div>
                {qrDisplay?.subtitle ? <div>{qrDisplay.subtitle}</div> : null}
                {qrDisplay?.helperText ? <div>{qrDisplay.helperText}</div> : null}
                {qrDisplay?.codeValue ? (
                  <div className="break-all rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-[11px] text-white/80">
                    {qrDisplay.codeValue}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              <div className="mb-2 flex items-center gap-2 font-medium text-white">
                <ShieldCheck size={14} className="text-sky-200" />
                {pick('审核说明', 'Review note')}
              </div>
              <p>{pick('平台不会在这里创建在线支付订单，也不会轮询支付状态；当前仅保留静态收款码 + 人工核销流程。', 'The app does not create online payment orders or poll payment status here. Only the static payment channel plus manual review flow remains.')}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
