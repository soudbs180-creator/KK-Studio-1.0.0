import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Headphones,
  Loader2,
  MessageCircle,
  QrCode,
  ScanLine,
  WalletCards,
} from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { useBilling } from '../../../context/BillingContext';
import {
  DEFAULT_CREDIT_EXCHANGE_RATES,
  getCreditExchangeRateMap,
  type CreditExchangeRate,
  type SupportedRechargeCurrency,
} from '../../../services/billing/creditExchangeRateService';
import {
  buildRechargeSubmissionRequestId,
  createRechargeBill,
  getRechargeSubmissionErrorMessage,
  listRechargePaymentChannels,
  normalizeRechargeBillSnapshot,
  submitRechargeProof,
  type RechargeBillSnapshot,
  type RechargePaymentChannelConfig,
} from '../../../services/billing/rechargeSubmissionService';
import { formatRemainingCredits } from '../../../services/billing/remainingBalance';
import { notify } from '../../../services/system/notificationService';
import { localizeUserFacingText } from '../../../utils/localeText';
import { SettingsViewShell } from '../SettingsScaffold';

type RechargeChannel = 'alipay' | 'wechat' | 'international' | 'manual';

const INITIAL_RATE_MAP: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
};

const FALLBACK_CHANNELS: RechargePaymentChannelConfig[] = [
  { channel: 'alipay', label: '支付宝静态码', instructionText: '付款后提交完整转账流水号。', isActive: false, qrImageDataUrl: null, qrImagePath: null },
  { channel: 'wechat', label: '微信静态码', instructionText: '付款后提交完整转账流水号。', isActive: false, qrImageDataUrl: null, qrImagePath: null },
];

const CHANNELS: Array<{ id: RechargeChannel; label: string; helper: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'alipay', label: '支付宝', helper: '静态扫码对账', icon: ScanLine },
  { id: 'wechat', label: '微信支付', helper: '微信静态码对账', icon: MessageCircle },
  { id: 'international', label: '国际卡', helper: '通道准备中', icon: CreditCard },
  { id: 'manual', label: '人工客服', helper: '手动确认入账', icon: Headphones },
];

function getSecondsLeft(expiresAt?: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function formatMoney(value: number, currency: SupportedRechargeCurrency): string {
  return `${currency === 'CNY' ? '¥' : '$'}${Number(value || 0).toFixed(2)}`;
}

const RechargeView: React.FC = () => {
  const { user } = useAuth();
  const { balance, refreshBilling } = useBilling();
  const [exchangeRates, setExchangeRates] = useState(INITIAL_RATE_MAP);
  const [paymentChannels, setPaymentChannels] = useState(FALLBACK_CHANNELS);
  const [currency, setCurrency] = useState<SupportedRechargeCurrency>('CNY');
  const [amount, setAmount] = useState(20);
  const [channel, setChannel] = useState<RechargeChannel>('alipay');
  const [bill, setBill] = useState<RechargeBillSnapshot | null>(null);
  const [providerTransactionId, setProviderTransactionId] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [creating, setCreating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void getCreditExchangeRateMap().then((rates) => active && setExchangeRates(rates));
    void listRechargePaymentChannels({ requestId: `recharge-payment-channels-${Date.now()}` }).then((response) => {
      if (active && response.success && response.data.items.length > 0) {
        setPaymentChannels(response.data.items as RechargePaymentChannelConfig[]);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!bill?.expiresAt) {
      setSecondsLeft(0);
      return undefined;
    }
    const update = () => setSecondsLeft(getSecondsLeft(bill.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [bill?.expiresAt]);

  const rate = exchangeRates[currency] || INITIAL_RATE_MAP[currency];
  const minAmount = rate.minAmount ?? (currency === 'CNY' ? 5 : 1);
  const maxAmount = rate.maxAmount ?? (currency === 'CNY' ? 500 : 100);
  const previewCredits = Math.max(0, Math.round(amount * rate.creditsPerUnit));
  const selectedProvider = bill?.manualProvider || (channel === 'wechat' ? 'wechat' : 'alipay');
  const selectedChannel = useMemo(
    () => paymentChannels.find((item) => item.channel === selectedProvider)
      || FALLBACK_CHANNELS.find((item) => item.channel === selectedProvider)
      || FALLBACK_CHANNELS[0],
    [paymentChannels, selectedProvider],
  );
  const qrSource = selectedChannel.qrImageDataUrl || selectedChannel.qrImagePath || '';
  const isExpired = Boolean(bill?.expiresAt && secondsLeft <= 0 && bill.status !== 'credited');

  const clampAmount = (value: number) => Math.max(minAmount, Math.min(maxAmount, Number.isFinite(value) ? value : minAmount));

  const createOrder = async () => {
    if (!user?.id) {
      notify.error('请先登录', '登录后才能创建充值订单。');
      return;
    }
    if (channel === 'international' || channel === 'manual') {
      const text = channel === 'international' ? '国际支付通道暂未配置。' : '人工充值请联系管理员。';
      setMessage(text);
      notify.info('通道说明', text);
      return;
    }
    if (!selectedChannel.isActive || !qrSource) {
      const text = '当前支付通道尚未配置收款码，请联系管理员。';
      setMessage(text);
      notify.warning('通道未配置', text);
      return;
    }
    setCreating(true);
    setMessage('');
    try {
      const response = await createRechargeBill(
        { amount, currencyCode: currency, paymentChannel: 'manual', manualProvider: channel },
        { requestId: buildRechargeSubmissionRequestId(user.id, 'bill') },
      );
      if (!response.success) throw new Error(getRechargeSubmissionErrorMessage(response, '创建订单失败。'));
      const snapshot = normalizeRechargeBillSnapshot(response.data, {
        amount,
        currencyCode: currency,
        paymentChannel: 'manual',
        manualProvider: channel,
        baseCredits: previewCredits,
        estimatedCredits: previewCredits,
        status: 'paying',
      });
      setBill(snapshot);
      setSecondsLeft(getSecondsLeft(snapshot.expiresAt));
      setMessage('订单已创建，请按实付金额完成付款。');
    } catch (error) {
      const text = localizeUserFacingText(error instanceof Error ? error.message : '') || '创建订单失败。';
      setMessage(text);
      notify.error('创建失败', text);
    } finally {
      setCreating(false);
    }
  };

  const markPaid = async () => {
    if (!bill?.submissionId || isExpired) return;
    const normalizedTransactionId = providerTransactionId.trim().toUpperCase();
    if (!/^[0-9A-Z](?:[0-9A-Z-]{6,62})[0-9A-Z]$/.test(normalizedTransactionId)) {
      setMessage('请填写 8-64 位完整转账流水号。');
      return;
    }
    setMarkingPaid(true);
    try {
      const response = await submitRechargeProof(
        {
          submissionId: bill.submissionId,
          amount: bill.amount,
          currencyCode: bill.currencyCode,
          paymentChannel: bill.paymentChannel,
          providerTransactionId: normalizedTransactionId,
          note: bill.note,
        },
        { requestId: buildRechargeSubmissionRequestId(user?.id || 'anonymous', 'proof') },
      );
      if (!response.success) throw new Error(getRechargeSubmissionErrorMessage(response, '提交支付凭证失败。'));
      setBill(normalizeRechargeBillSnapshot(
        { submission: response.data.submission },
        { ...bill, providerTransactionId: normalizedTransactionId },
      ));
      setMessage('支付凭证已提交，到账后余额会自动刷新。');
      await refreshBilling({ includeTransactions: true });
    } catch (error) {
      const text = localizeUserFacingText(error instanceof Error ? error.message : '') || '提交失败。';
      setMessage(text);
      notify.error('提交失败', text);
    } finally {
      setMarkingPaid(false);
    }
  };

  const displayedAmount = bill?.payableAmount ?? bill?.amount ?? amount;
  const displayedCredits = bill?.creditAmount ?? bill?.estimatedCredits ?? previewCredits;
  return (
    <SettingsViewShell className="console-recharge-page">
      <header className="console-page-header">
        <div>
          <span className="console-eyebrow">Billing</span>
          <h2>充值积分</h2>
          <p>选择支付通道和金额，创建订单后跟踪到账状态。</p>
        </div>
        <div className="console-balance-chip"><WalletCards size={15} /><span>余额 {formatRemainingCredits(balance, 'zh-CN')}</span></div>
      </header>

      <div className="console-recharge-layout">
        <section className="console-card console-recharge-channels">
          <div className="console-card-heading"><div><h3>支付通道</h3><p>创建订单后支付通道将锁定。</p></div></div>
          <div className="console-channel-grid">
            {CHANNELS.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" className="console-channel-button" data-selected={channel === item.id} disabled={Boolean(bill)} onClick={() => setChannel(item.id)}>
                  <Icon size={17} />
                  <span><strong>{item.label}</strong><small>{item.helper}</small></span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="console-card console-recharge-order">
          {!bill ? (
            <>
              <div className="console-card-heading"><div><h3>充值金额</h3><p>当前汇率：1 {currency} = {rate.creditsPerUnit} 积分</p></div></div>
              <div className="console-segmented" role="radiogroup" aria-label="充值币种">
                {(['CNY', 'USD'] as SupportedRechargeCurrency[]).map((item) => <button key={item} type="button" role="radio" aria-checked={currency === item} data-selected={currency === item} onClick={() => { setCurrency(item); setAmount(item === 'CNY' ? 20 : 5); }}>{item}</button>)}
              </div>
              <label className="console-field"><span>充值金额 <strong>{formatMoney(amount, currency)}</strong></span><input type="range" min={minAmount} max={maxAmount} step={currency === 'CNY' ? 5 : 1} value={amount} onChange={(event) => setAmount(clampAmount(Number(event.target.value)))} /></label>
              <label className="console-field"><span>精确金额</span><input type="number" min={minAmount} max={maxAmount} value={amount} onChange={(event) => setAmount(clampAmount(Number(event.target.value)))} /></label>
              <div className="console-credit-preview"><span>预计到账</span><strong>{previewCredits} 积分</strong></div>
              {message ? <div className="console-notice" data-tone="warning"><AlertCircle size={15} /><span>{message}</span></div> : null}
              <button type="button" className="console-primary-button" disabled={creating} onClick={() => void createOrder()}>{creating ? <Loader2 size={15} className="animate-spin" /> : <WalletCards size={15} />}<span>{creating ? '正在创建订单' : '创建充值订单'}</span></button>
            </>
          ) : (
            <>
              <div className="console-card-heading"><div><h3>订单支付</h3><p>订单号 {bill.submissionId}</p></div><span className="console-status" data-tone={isExpired ? 'danger' : 'pending'}>{isExpired ? '已过期' : formatCountdown(secondsLeft)}</span></div>
              <div className="console-order-summary"><div><span>实付金额</span><strong>{formatMoney(displayedAmount, bill.currencyCode || currency)}</strong></div><div><span>到账积分</span><strong>{displayedCredits}</strong></div></div>
              <div className="console-qr-area">{qrSource ? <img src={qrSource} alt={`${selectedProvider} 收款二维码`} /> : <><QrCode size={44} /><span>支付二维码暂未配置</span></>}</div>
              <p className="console-payment-instruction">{selectedChannel.instructionText || '完成付款后提交完整转账流水号。'}</p>
              <label className="console-field"><span>完整转账流水号</span><input value={providerTransactionId} maxLength={64} onChange={(event) => setProviderTransactionId(event.target.value.replace(/[^0-9a-z-]/gi, '').toUpperCase())} placeholder="请输入支付平台显示的完整流水号" /></label>
              {message ? <div className="console-notice"><Clock3 size={15} /><span>{message}</span></div> : null}
              <div className="console-button-row"><button type="button" className="console-secondary-button" onClick={() => { setBill(null); setProviderTransactionId(''); setMessage(''); }}>重新选择</button><button type="button" className="console-primary-button" disabled={markingPaid || isExpired} onClick={() => void markPaid()}>{markingPaid ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}<span>{markingPaid ? '正在提交' : '我已支付'}</span></button></div>
            </>
          )}
        </section>
      </div>
    </SettingsViewShell>
  );
};

export default RechargeView;
