import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Receipt, ShieldCheck, Wallet, X, Zap } from 'lucide-react';

import alipayIcon from '../../assets/payment/alipay.png';
import cardIcon from '../../assets/payment/card.png';
import wechatIcon from '../../assets/payment/wechat.png';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useLocale } from '../../context/LocaleContext';
import { useTheme } from '../../context/ThemeContext';
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

const CHANNEL_ARTWORK: Partial<Record<RechargeSubmissionChannel, string>> = {
  alipay: alipayIcon,
  wechat: wechatIcon,
  paypal: cardIcon,
  bank: cardIcon,
  manual: cardIcon,
};

const formatCurrencySymbol = (currency: SupportedRechargeCurrency) => (currency === 'CNY' ? '¥' : '$');
const formatRateValue = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const RechargeModal: React.FC = () => {
  const { showRechargeModal, setShowRechargeModal, refreshBilling } = useBilling();
  const { user } = useAuth();
  const { pick } = useLocale();
  const { isDarkMode } = useTheme();

  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const hasAvailableCurrency = availableCurrencies.length > 0;

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

  const displayChannel = billSnapshot?.paymentChannel ?? selectedChannelConfig?.channel ?? 'manual';
  const displayChannelConfig = useMemo(
    () =>
      paymentChannels.find((channel) => channel.channel === displayChannel)
      || FALLBACK_CHANNELS.find((channel) => channel.channel === displayChannel)
      || selectedChannelConfig
      || FALLBACK_CHANNELS[0],
    [displayChannel, paymentChannels, selectedChannelConfig],
  );

  const selectedThemeChannel = displayChannelConfig?.channel === 'wechat'
    ? 'wechat'
    : displayChannelConfig?.channel === 'paypal' || currency === 'USD'
      ? 'paypal'
      : 'alipay';

  const theme = useMemo(() => {
    if (selectedThemeChannel === 'paypal') {
      return {
        text: isDarkMode ? '#fbbf24' : '#b45309',
        border: isDarkMode ? 'rgba(245, 158, 11, 0.32)' : 'rgba(245, 158, 11, 0.24)',
        light: isDarkMode
          ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.08) 100%)'
          : 'linear-gradient(180deg, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.06) 100%)',
        gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
        shadow: isDarkMode
          ? '0 20px 44px rgba(245, 158, 11, 0.26)'
          : '0 18px 36px rgba(245, 158, 11, 0.2)',
        accent: '#f59e0b',
        via: 'rgba(245, 158, 11, 0.36)',
      };
    }

    if (selectedThemeChannel === 'wechat') {
      return {
        text: isDarkMode ? '#6ee7b7' : '#047857',
        border: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.24)',
        light: isDarkMode
          ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0.08) 100%)'
          : 'linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%)',
        gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        shadow: isDarkMode
          ? '0 20px 44px rgba(16, 185, 129, 0.24)'
          : '0 18px 36px rgba(16, 185, 129, 0.18)',
        accent: '#10b981',
        via: 'rgba(16, 185, 129, 0.34)',
      };
    }

    return {
      text: isDarkMode ? '#93c5fd' : '#2563eb',
      border: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.24)',
      light: isDarkMode
        ? 'linear-gradient(180deg, rgba(59, 130, 246, 0.18) 0%, rgba(59, 130, 246, 0.08) 100%)'
        : 'linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.05) 100%)',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      shadow: isDarkMode
        ? '0 20px 44px rgba(59, 130, 246, 0.24)'
        : '0 18px 36px rgba(59, 130, 246, 0.18)',
      accent: '#3b82f6',
      via: 'rgba(59, 130, 246, 0.34)',
    };
  }, [isDarkMode, selectedThemeChannel]);

  const palette = useMemo(
    () => ({
      modalBg: isDarkMode
        ? 'linear-gradient(180deg, rgba(8, 12, 19, 0.98) 0%, rgba(5, 8, 14, 1) 100%)'
        : '#ffffff',
      modalBorder: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)',
      modalShadow: isDarkMode ? '0 40px 96px rgba(0, 0, 0, 0.56)' : '0 36px 88px rgba(15, 23, 42, 0.18)',
      cardBg: isDarkMode ? 'rgba(15, 23, 42, 0.76)' : '#ffffff',
      cardBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.1)',
      cardShadow: isDarkMode
        ? '0 18px 40px rgba(0, 0, 0, 0.24)'
        : '0 16px 36px rgba(15, 23, 42, 0.08)',
      cardShadowStrong: isDarkMode
        ? '0 24px 54px rgba(0, 0, 0, 0.34)'
        : '0 24px 52px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.05)',
      sectionBg: isDarkMode
        ? 'linear-gradient(180deg, rgba(17, 24, 39, 0.84) 0%, rgba(10, 14, 22, 0.94) 100%)'
        : '#ffffff',
      segmentBg: isDarkMode
        ? 'rgba(15, 23, 42, 0.92)'
        : 'linear-gradient(180deg, #f3f4f6 0%, #eef2f7 100%)',
      segmentBorder: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.1)',
      inputBg: isDarkMode ? '#10151e' : '#ffffff',
      inputBorder: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.12)',
      inputShadow: isDarkMode
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.03)'
        : '0 1px 0 rgba(255, 255, 255, 0.96), 0 10px 22px rgba(15, 23, 42, 0.06)',
      textPrimary: isDarkMode ? '#ffffff' : '#0f172a',
      textSecondary: isDarkMode ? 'rgba(226, 232, 240, 0.82)' : 'rgba(55, 65, 81, 0.92)',
      textMuted: isDarkMode ? 'rgba(148, 163, 184, 0.78)' : 'rgba(107, 114, 128, 0.92)',
      strongBorder: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.14)',
      sliderTrack: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
      closeHoverBg: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.04)',
      disabledButtonBg: isDarkMode ? '#1f2937' : '#d1d5db',
      disabledButtonText: isDarkMode ? 'rgba(226, 232, 240, 0.5)' : 'rgba(17, 24, 39, 0.55)',
    }),
    [isDarkMode],
  );

  const getSegmentButtonStyle = (selected: boolean) => ({
    background: selected ? theme.gradient : 'transparent',
    color: selected ? '#ffffff' : palette.textMuted,
    borderColor: selected ? theme.border : palette.cardBorder,
    boxShadow: selected ? theme.shadow : 'none',
  });

  const getSelectableCardStyle = (selected: boolean) => ({
    background: selected ? theme.light : palette.cardBg,
    borderColor: selected ? theme.border : palette.cardBorder,
    color: selected ? theme.text : palette.textSecondary,
    boxShadow: selected ? theme.shadow : 'none',
  });

  const getChannelArtwork = (channel?: RechargeSubmissionChannel) => CHANNEL_ARTWORK[channel || 'alipay'] || alipayIcon;

  const getChannelSupportText = (channel?: RechargeSubmissionChannel) => {
    switch (channel) {
      case 'alipay':
        return pick('适合支付宝静态码转账', 'Best for Alipay static transfers');
      case 'wechat':
        return pick('适合移动端扫码转账', 'Best for mobile scan transfers');
      case 'paypal':
        return pick('适合国际支付与海外卡', 'Best for international payments');
      case 'bank':
        return pick('适合线下或网银转账', 'Best for bank transfers');
      case 'manual':
        return pick('适合人工确认当前收款方式', 'Confirm the current payment method with admin');
      default:
        return pick('适合当前渠道的静态收款流程', 'Best for the current static payment flow');
    }
  };

  const clampAmount = (value: number) => Math.max(minAmount, Math.min(maxAmount, value));

  const submissionId = billSnapshot?.submissionId || '--';
  const billNumber = billSnapshot?.billNumber || '--';
  const statusLabel = billSnapshot?.statusLabel || getRechargeSubmissionStatusLabel('draft');
  const qrDisplay = billSnapshot?.qrDisplay || selectedChannelConfig?.qrDisplay;
  const displayedCredits = billSnapshot?.estimatedCredits ?? estimatedCredits;
  const displayedAmount = billSnapshot?.amount ?? amount;
  const heroStatusLabel = billSnapshot ? statusLabel : pick('待创建账单', 'Create a bill first');
  const amountProgress = Math.max(0, Math.min(100, ((amount - minAmount) / Math.max(1, maxAmount - minAmount)) * 100));
  const isBusy = creatingBill || submittingProof;
  const canCreateBill = !isBusy && hasAvailableCurrency && !!selectedChannelConfig;
  const canSubmitProof = !isBusy && !!billSnapshot;
  const inputStyle = {
    borderColor: palette.inputBorder,
    background: palette.inputBg,
    color: palette.textPrimary,
    boxShadow: palette.inputShadow,
  };

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
    setAmount((currentAmount) => clampAmount(currentAmount));
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

    if (!hasAvailableCurrency || !currentRate.isActive || !selectedChannelConfig) {
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
        status: 'created',
        qrDisplay: selectedChannelConfig.qrDisplay,
      });

      setBillSnapshot(nextBillSnapshot);
      setSubmissionMessage(
        pick(
          '账单已创建，请完成转账后提交流水尾号。',
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

    if (!selectedChannelConfig || !billSnapshot?.submissionId || !billSnapshot?.billNumber) {
      notify.error(
        pick('请先创建账单', 'Create a bill first'),
        pick('请先创建账单，再提交付款流水尾号。', 'Create a bill before submitting the transfer reference tail.'),
      );
      return;
    }

    if (!/^[A-Z0-9]{4}$/.test(sanitizeTransferReferenceLast4(transferReferenceLast4))) {
      notify.error(
        pick('流水尾号无效', 'Invalid transfer tail'),
        pick('请输入 4 位字母或数字的流水尾号。', 'Enter a valid 4-character transfer reference tail.'),
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
        throw new Error(getRechargeSubmissionErrorMessage(response, '提交付款凭证失败，请稍后重试。'));
      }

      const nextBillSnapshot = normalizeRechargeBillSnapshot(response.data, {
        submissionId: billSnapshot.submissionId,
        billNumber: billSnapshot.billNumber,
        amount: billSnapshot.amount,
        currencyCode: billSnapshot.currencyCode,
        paymentChannel: billSnapshot.paymentChannel,
        estimatedCredits: billSnapshot.estimatedCredits,
        note,
        transferReferenceLast4,
        status: 'pending',
        qrDisplay: billSnapshot.qrDisplay || selectedChannelConfig.qrDisplay,
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
      className={`fixed inset-0 z-[10020] flex justify-center bg-black/60 backdrop-blur-sm ${isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-center p-4'}`}
      onClick={closeModal}
    >
      <div
        className={`w-full overflow-hidden border animate-in fade-in zoom-in-95 duration-300 ${isMobile ? 'ios-mobile-sheet mobile-sheet-viewport flex min-h-0 max-w-[760px] flex-col rounded-t-[26px] rounded-b-none' : 'max-w-[480px] rounded-[30px]'}`}
        style={{
          background: palette.modalBg,
          borderColor: palette.modalBorder,
          boxShadow: palette.modalShadow,
          color: palette.textPrimary,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`relative flex items-center justify-between border-b ${isMobile ? 'mobile-sheet-header-safe px-4 pb-3 pt-4' : 'px-5 pb-4 pt-5'}`} style={{ borderColor: palette.cardBorder }}>
          <div
            className="absolute left-0 top-0 h-1 w-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${theme.via} 50%, transparent 100%)`,
            }}
          />
          <div className="flex items-center gap-3">
            <div
              className="rounded-2xl p-2"
              style={{
                background: theme.light,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold leading-tight">{pick('积分充值', 'Balance recharge')}</h3>
              <p className="mt-1 max-w-[34ch] text-xs leading-4" style={{ color: palette.textMuted }}>
                {pick('先创建账单，再按静态码转账并提交付款凭证。', 'Create a bill first, then transfer with the static channel and submit payment proof.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-full p-2 transition"
            style={{ color: palette.textMuted, background: palette.closeHoverBg }}
          >
            <X size={18} />
          </button>
        </div>

        <div className={`${isMobile ? 'mobile-sheet-scroll flex-1 px-4 py-3 pb-4' : 'max-h-[82vh] overflow-y-auto px-5 py-4 pb-5'} ${isMobile ? 'space-y-4' : 'space-y-5'}`}>
          <div className={isMobile ? 'space-y-4' : 'space-y-5'}>
            <section
              className="rounded-[26px] px-5 py-5 sm:px-6 sm:py-6"
              style={{
                background: palette.sectionBg,
                border: `1px solid ${palette.cardBorder}`,
                boxShadow: palette.cardShadowStrong,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>
                    {pick('预计到账', 'Estimated credits')}
                  </div>
                  <div className="mt-2 text-5xl font-black tracking-tight" style={{ color: theme.text }}>
                    {displayedCredits}
                  </div>
                  <div className="mt-1 text-xs leading-4" style={{ color: palette.textMuted }}>
                    {pick('支付金额', 'Payment amount')} {formatCurrencySymbol(currency)}
                    {displayedAmount}
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <div
                    className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold"
                    style={{
                      background: theme.light,
                      borderColor: theme.border,
                      color: theme.text,
                      boxShadow: theme.shadow,
                    }}
                  >
                    {loadingRates ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        {pick('同步中', 'Syncing')}
                      </>
                    ) : (
                      <span>
                        {formatCurrencySymbol(currency)}1 = {formatRateValue(currentRate.creditsPerUnit)} {pick('积分', 'credits')}
                      </span>
                    )}
                  </div>
                  {billSnapshot ? (
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: palette.textMuted }}>
                      {heroStatusLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>
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
                  disabled={isBusy}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    accentColor: theme.accent,
                    backgroundColor: palette.sliderTrack,
                    backgroundImage: `linear-gradient(to right, ${theme.accent} 0%, ${theme.accent} ${amountProgress}%, ${palette.sliderTrack} ${amountProgress}%, ${palette.sliderTrack} 100%)`,
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <div className="text-xs leading-5" style={{ color: palette.textMuted }}>
                    {pick('汇率、最小金额和最大金额会在打开充值页时自动同步。', 'Rates and amount limits are synced when the recharge sheet opens.')}
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
                        setAmount(clampAmount(nextValue));
                      }
                    }}
                    disabled={isBusy}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    style={inputStyle}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('充值币种', 'Recharge currency')}</div>
              <div
                className="flex rounded-xl border p-1"
                style={{
                  background: palette.segmentBg,
                  borderColor: palette.segmentBorder,
                  boxShadow: palette.cardShadow,
                }}
              >
                {availableCurrencies.length > 0 ? (
                  availableCurrencies.map((item) => {
                    const selected = item === currency;

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrency(item)}
                        disabled={isBusy}
                        className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={getSegmentButtonStyle(selected)}
                      >
                        {item === 'CNY' ? '人民币 (CNY)' : '美元 (USD)'}
                      </button>
                    );
                  })
                ) : (
                  <div
                    className="col-span-2 rounded-2xl border border-dashed px-4 py-3 text-sm"
                    style={{
                      borderColor: palette.cardBorder,
                      background: palette.sectionBg,
                      color: palette.textMuted,
                    }}
                  >
                    {pick('当前没有启用中的充值币种，请联系管理员检查配置。', 'No active recharge currency is available right now.')}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>
                <span>{pick('支付方式', 'Payment channel')}</span>
                {loadingChannels ? (
                  <span className="inline-flex items-center gap-1" style={{ color: palette.textMuted }}>
                    <Loader2 size={12} className="animate-spin" />
                    {pick('同步中', 'Syncing')}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {channelOptions.map((channel) => {
                  const selected = channel.channel === paymentChannel;
                  const artwork = CHANNEL_ARTWORK[channel.channel] || cardIcon;

                  return (
                    <button
                      key={channel.channel}
                      type="button"
                      onClick={() => setPaymentChannel(channel.channel)}
                      disabled={isBusy}
                      className="flex items-start gap-4 rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60"
                      style={getSelectableCardStyle(selected)}
                    >
                      <img src={artwork} className="h-10 w-10 rounded-lg object-contain" alt={channel.label} />
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-semibold">{channel.label}</div>
                        <div className="text-xs leading-5 text-current/70">{getChannelSupportText(channel.channel)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('流水尾号 4 位', 'Last 4 transfer chars')}</span>
                <input
                  type="text"
                  maxLength={4}
                  value={transferReferenceLast4}
                  onChange={(event) => setTransferReferenceLast4(sanitizeTransferReferenceLast4(event.target.value))}
                  placeholder={pick('例如 8X9Z', 'Example 8X9Z')}
                  className="w-full rounded-xl border px-3 py-3 text-sm uppercase outline-none"
                  style={inputStyle}
                />
              </label>

              <label className="space-y-2">
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('备注', 'Note')}</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={pick('可选：付款时间或补充说明', 'Optional: payment time or extra context')}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none"
                  style={inputStyle}
                />
              </label>
            </section>

            {billSnapshot ? (
              <section
                className="rounded-xl border border-dashed px-4 py-3 text-xs"
                style={{
                  background: palette.sectionBg,
                  borderColor: palette.strongBorder,
                  color: palette.textMuted,
                }}
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck size={14} style={{ color: theme.text }} />
                  <div className="space-y-1">
                    <div className="font-medium" style={{ color: palette.textPrimary }}>{pick('流程说明', 'Flow')}</div>
                    <p>{pick('先按当前静态码转账，再填写流水尾号并提交凭证。', 'Complete the transfer with the current static code, then submit the transfer tail and proof.')}</p>
                    {submissionMessage ? <p style={{ color: theme.text }}>{submissionMessage}</p> : null}
                  </div>
                </div>
              </section>
            ) : null}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={billSnapshot ? handleSubmitProof : handleCreateBill}
                disabled={billSnapshot ? !canSubmitProof : !canCreateBill}
                className="flex h-14 w-full min-w-0 items-center justify-center gap-3 overflow-hidden whitespace-nowrap rounded-2xl text-lg font-semibold transition-all disabled:cursor-not-allowed"
                style={{
                  background: billSnapshot
                    ? (!canSubmitProof ? palette.disabledButtonBg : theme.gradient)
                    : (!canCreateBill ? palette.disabledButtonBg : theme.gradient),
                  color: billSnapshot
                    ? (!canSubmitProof ? palette.disabledButtonText : '#ffffff')
                    : (!canCreateBill ? palette.disabledButtonText : '#ffffff'),
                  boxShadow: billSnapshot
                    ? (!canSubmitProof ? 'none' : theme.shadow)
                    : (!canCreateBill ? 'none' : theme.shadow),
                }}
              >
                {billSnapshot ? (
                  submittingProof ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <CreditCard size={18} className="shrink-0" />
                ) : (
                  creatingBill ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <Receipt size={18} className="shrink-0" />
                )}
                {billSnapshot ? pick('提交付款凭证', 'Submit payment proof') : pick('创建账单', 'Create bill')}
              </button>

              {billSnapshot ? (
                <button
                  type="button"
                  onClick={handleCreateBill}
                  disabled={!canCreateBill}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-4 text-[11px] font-medium uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: canCreateBill ? 'transparent' : palette.cardBg,
                    borderColor: canCreateBill ? palette.strongBorder : palette.cardBorder,
                    color: canCreateBill ? palette.textMuted : palette.disabledButtonText,
                    boxShadow: 'none',
                  }}
                >
                  {creatingBill ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                  {pick('重新创建账单', 'Create bill again')}
                </button>
              ) : null}
            </div>
          </div>

          <section className="space-y-4">
            {billSnapshot ? (
              <div
                className="rounded-[26px] p-4"
                style={{
                  background: palette.sectionBg,
                  border: `1px solid ${palette.cardBorder}`,
                  boxShadow: palette.cardShadow,
                }}
              >
                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="flex justify-center">
                    {qrDisplay?.imageUrl ? (
                      <div className="rounded-2xl bg-white p-3" style={{ boxShadow: palette.cardShadow }}>
                        <img
                          src={qrDisplay.imageUrl}
                          alt={qrDisplay.title || 'Recharge QR'}
                          className="h-40 w-40 rounded-xl object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-2xl border text-center text-xs"
                        style={{
                          borderColor: palette.cardBorder,
                          background: theme.light,
                          color: theme.text,
                        }}
                      >
                        <img
                          src={getChannelArtwork(displayChannelConfig?.channel)}
                          className="h-12 w-12 rounded-xl object-contain"
                          alt={displayChannelConfig?.label || 'channel'}
                        />
                        {qrDisplay?.title || pick('等待管理员配置静态码', 'Waiting for the admin to configure the static code')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={getChannelArtwork(displayChannelConfig?.channel)}
                        className="h-11 w-11 rounded-xl object-contain"
                        alt={displayChannelConfig?.label || 'channel'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('当前账单', 'Current bill')}</div>
                            <div className="mt-1 text-base font-semibold" style={{ color: palette.textPrimary }}>{displayChannelConfig?.label || pick('静态收款', 'Static payment')}</div>
                          </div>
                          <div
                            className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              background: theme.light,
                              borderColor: theme.border,
                              color: theme.text,
                            }}
                          >
                            {statusLabel}
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-5" style={{ color: palette.textMuted }}>
                          {getChannelSupportText(displayChannelConfig?.channel)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('提交单号', 'Submission ID')}</div>
                        <div className="break-all font-medium" style={{ color: palette.textPrimary }}>{submissionId}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('账单编号', 'Bill number')}</div>
                        <div className="break-all font-medium" style={{ color: palette.textPrimary }}>{billNumber}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('预计到账', 'Estimated credits')}</div>
                        <div className="font-medium" style={{ color: palette.textPrimary }}>{displayedCredits}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('流水尾号', 'Transfer tail')}</div>
                        <div className="font-medium" style={{ color: palette.textPrimary }}>{transferReferenceLast4 || '--'}</div>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2 text-xs" style={{ color: palette.textMuted }}>
                      <div className="font-medium" style={{ color: palette.textPrimary }}>{qrDisplay?.title || displayChannelConfig?.label}</div>
                      {qrDisplay?.subtitle ? <div>{qrDisplay.subtitle}</div> : null}
                      {qrDisplay?.helperText ? <div>{qrDisplay.helperText}</div> : null}
                      {qrDisplay?.codeValue ? (
                        <div
                          className="break-all rounded-xl border px-3 py-2 text-[11px]"
                          style={{
                            borderColor: theme.border,
                            background: theme.light,
                            color: theme.text,
                          }}
                        >
                          {qrDisplay.codeValue}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl border border-dashed px-4 py-3 text-xs"
                style={{
                  background: palette.cardBg,
                  borderColor: palette.cardBorder,
                  boxShadow: 'none',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <img
                    src={getChannelArtwork(displayChannelConfig?.channel)}
                    className="h-9 w-9 rounded-lg object-contain opacity-70"
                    alt={displayChannelConfig?.label || 'channel'}
                  />
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: palette.textMuted }}>{pick('账单参考区', 'Bill reference')}</div>
                    <div className="text-sm font-medium" style={{ color: palette.textSecondary }}>{pick('创建账单后，这里会展示收款码和账单摘要。', 'Create a bill to reveal the payment code and bill summary here.')}</div>
                    <div className="text-[11px] leading-4" style={{ color: palette.textMuted }}>
                      {getChannelSupportText(displayChannelConfig?.channel)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default RechargeModal;
