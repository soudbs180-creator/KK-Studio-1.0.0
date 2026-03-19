import React, { useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import {
  DEFAULT_CREDIT_EXCHANGE_RATES,
  listCreditExchangeRates,
  type CreditExchangeRate,
  type SupportedRechargeCurrency,
  upsertCreditExchangeRate,
} from '../../../services/billing/creditExchangeRateService';
import { notify } from '../../../services/system/notificationService';
import {
  MetricCard,
  PrimaryButton,
  SecondaryButton,
  SettingCard,
  SettingInput,
  SettingToggle,
  StatusBadge,
} from '../ui/index';

const currencies: SupportedRechargeCurrency[] = ['CNY', 'USD'];

const createEmptyRateState = (): Record<SupportedRechargeCurrency, CreditExchangeRate> => ({
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
});

const formatAmountPreview = (amount: number, currency: SupportedRechargeCurrency) =>
  currency === 'CNY' ? `¥${amount}` : `$${amount}`;

const formatAmountRange = (rate: CreditExchangeRate, currency: SupportedRechargeCurrency) => {
  const parts: string[] = [];
  if (rate.minAmount !== null) parts.push(`最低 ${formatAmountPreview(rate.minAmount, currency)}`);
  if (rate.maxAmount !== null) parts.push(`最高 ${formatAmountPreview(rate.maxAmount, currency)}`);
  return parts.length > 0 ? parts.join(' / ') : '未限制金额范围';
};

export const ExchangeRateSettingsView: React.FC = () => {
  const [exchangeRates, setExchangeRates] = useState<Record<SupportedRechargeCurrency, CreditExchangeRate>>(createEmptyRateState);
  const [loadingRates, setLoadingRates] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState<SupportedRechargeCurrency | null>(null);

  const activeCurrencies = useMemo(
    () => currencies.filter((currency) => exchangeRates[currency].isActive).length,
    [exchangeRates]
  );

  const summaryLabel = useMemo(
    () => `¥1 = ${exchangeRates.CNY.creditsPerUnit} / $1 = ${exchangeRates.USD.creditsPerUnit}`,
    [exchangeRates]
  );

  const loadRates = async () => {
    setLoadingRates(true);
    try {
      const rates = await listCreditExchangeRates();
      const nextState = createEmptyRateState();
      rates.forEach((rate) => {
        nextState[rate.currencyCode] = rate;
      });
      setExchangeRates(nextState);
    } catch (error: any) {
      notify.error('加载汇率失败', error?.message || '已回退到默认汇率。');
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    void loadRates();
  }, []);

  const handleRateFieldChange = (
    currency: SupportedRechargeCurrency,
    field: keyof CreditExchangeRate,
    value: string | boolean
  ) => {
    setExchangeRates((current) => {
      const previous = current[currency];
      const nextValue =
        typeof value === 'boolean'
          ? value
          : value === ''
            ? null
            : field === 'creditsPerUnit' || field === 'minAmount' || field === 'maxAmount'
              ? Number(value)
              : value;

      return {
        ...current,
        [currency]: {
          ...previous,
          [field]: nextValue,
        },
      };
    });
  };

  const handleSaveExchangeRate = async (currency: SupportedRechargeCurrency) => {
    const rate = exchangeRates[currency];

    if (!Number.isFinite(rate.creditsPerUnit) || Number(rate.creditsPerUnit) <= 0) {
      notify.error('汇率无效', `${currency} 的积分汇率必须大于 0。`);
      return;
    }
    if (rate.minAmount !== null && (!Number.isFinite(rate.minAmount) || Number(rate.minAmount) < 0)) {
      notify.error('金额范围无效', `${currency} 的最低金额不能小于 0。`);
      return;
    }
    if (rate.maxAmount !== null && (!Number.isFinite(rate.maxAmount) || Number(rate.maxAmount) <= 0)) {
      notify.error('金额范围无效', `${currency} 的最高金额必须大于 0。`);
      return;
    }
    if (
      rate.minAmount !== null &&
      rate.maxAmount !== null &&
      Number.isFinite(rate.minAmount) &&
      Number.isFinite(rate.maxAmount) &&
      rate.minAmount > rate.maxAmount
    ) {
      notify.error('金额范围无效', `${currency} 的最低金额不能大于最高金额。`);
      return;
    }

    setSavingCurrency(currency);
    try {
      const saved = await upsertCreditExchangeRate({ ...rate, currencyCode: currency });
      setExchangeRates((current) => ({ ...current, [currency]: saved }));
      notify.success('保存成功', `${currency} 汇率已更新。`);
    } catch (error: any) {
      notify.error('保存失败', error?.message || '请稍后再试。');
    } finally {
      setSavingCurrency(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard value={`${activeCurrencies} / ${currencies.length}`} label="启用币种" helper="前台充值页会读取这里的状态" tone={activeCurrencies === currencies.length ? 'emerald' : 'amber'} />
        <MetricCard value={`¥1 = ${exchangeRates.CNY.creditsPerUnit}`} label="人民币汇率" helper={formatAmountRange(exchangeRates.CNY, 'CNY')} tone={exchangeRates.CNY.isActive ? 'indigo' : 'neutral'} />
        <MetricCard value={`$1 = ${exchangeRates.USD.creditsPerUnit}`} label="美元汇率" helper={formatAmountRange(exchangeRates.USD, 'USD')} tone={exchangeRates.USD.isActive ? 'indigo' : 'neutral'} />
        <MetricCard value={summaryLabel} label="当前摘要" helper="修改后充值页同步生效" tone="neutral" />
      </div>

      <SettingCard
        title="汇率规则"
        action={
          <SecondaryButton onClick={() => void loadRates()}>
            <RefreshCw size={14} className="mr-1 inline-block" />
            {loadingRates ? '正在刷新...' : '刷新汇率'}
          </SecondaryButton>
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {currencies.map((currency) => {
            const rate = exchangeRates[currency];
            const isSaving = savingCurrency === currency;
            const previewAmount = currency === 'CNY' ? 100 : 10;

            return (
              <div
                key={currency}
                className="rounded-xl border border-[var(--border-light)] p-4"
                style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-medium text-[var(--text-primary)]">
                      {currency === 'CNY' ? '人民币充值' : '美元充值'}
                    </div>
                    <div className="mt-1 text-[13px] text-[var(--text-secondary)]">
                      {currency === 'CNY' ? '¥1' : '$1'} = {rate.creditsPerUnit} 积分
                    </div>
                  </div>
                  <StatusBadge status={rate.isActive ? 'online' : 'paused'} label={rate.isActive ? '已启用' : '已停用'} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <SettingInput
                    label="每 1 单位货币可得积分"
                    type="number"
                    value={String(rate.creditsPerUnit)}
                    onChange={(value) => handleRateFieldChange(currency, 'creditsPerUnit', value)}
                  />
                  <SettingInput
                    label="最小充值金额"
                    type="number"
                    value={rate.minAmount === null ? '' : String(rate.minAmount)}
                    onChange={(value) => handleRateFieldChange(currency, 'minAmount', value)}
                  />
                  <SettingInput
                    label="最大充值金额"
                    type="number"
                    value={rate.maxAmount === null ? '' : String(rate.maxAmount)}
                    onChange={(value) => handleRateFieldChange(currency, 'maxAmount', value)}
                  />
                </div>

                <div className="mt-4">
                  <SettingToggle
                    label="允许前台显示并使用该币种"
                    helper="关闭后，充值页会隐藏该币种入口。"
                    checked={rate.isActive}
                    onChange={(checked) => handleRateFieldChange(currency, 'isActive', checked)}
                  />
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border-light)] p-3 text-[13px] text-[var(--text-secondary)]">
                  <div>金额范围：{formatAmountRange(rate, currency)}</div>
                  <div className="mt-1">
                    充值预览：{formatAmountPreview(previewAmount, currency)} = {previewAmount * rate.creditsPerUnit} 积分
                  </div>
                </div>

                <div className="mt-4">
                  <PrimaryButton onClick={() => void handleSaveExchangeRate(currency)} loading={isSaving}>
                    <Coins size={14} className="mr-1 inline-block" />
                    {isSaving ? '保存中...' : `保存 ${currency} 汇率`}
                  </PrimaryButton>
                </div>
              </div>
            );
          })}
        </div>
      </SettingCard>
    </div>
  );
};

export default ExchangeRateSettingsView;
