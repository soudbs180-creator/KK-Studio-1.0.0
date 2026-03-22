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
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_OVERLAY_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsMetricCard,
} from '../SettingsScaffold';
import { SettingInput, SettingToggle, StatusBadge } from '../ui/index';

const currencies: SupportedRechargeCurrency[] = ['CNY', 'USD'];

const createEmptyRateState = (): Record<SupportedRechargeCurrency, CreditExchangeRate> => ({
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
});

const formatAmountPreview = (amount: number, currency: SupportedRechargeCurrency) =>
  currency === 'CNY' ? `¥${amount}` : `$${amount}`;

const getCurrencyLabel = (currency: SupportedRechargeCurrency) => (currency === 'CNY' ? '人民币充值' : '美元充值');

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
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetricCard
          label="启用币种"
          value={`${activeCurrencies} / ${currencies.length}`}
          helper="前台充值页会读取这里的开关"
          icon={Coins}
          tone={activeCurrencies === currencies.length ? 'emerald' : 'amber'}
        />
        <SettingsMetricCard
          label="人民币汇率"
          value={`¥1 = ${exchangeRates.CNY.creditsPerUnit}`}
          helper={formatAmountRange(exchangeRates.CNY, 'CNY')}
          icon={Coins}
          tone={exchangeRates.CNY.isActive ? 'indigo' : 'neutral'}
        />
        <SettingsMetricCard
          label="美元汇率"
          value={`$1 = ${exchangeRates.USD.creditsPerUnit}`}
          helper={formatAmountRange(exchangeRates.USD, 'USD')}
          icon={Coins}
          tone={exchangeRates.USD.isActive ? 'indigo' : 'neutral'}
        />
        <SettingsMetricCard
          label="当前摘要"
          value={summaryLabel}
          helper="修改后前台充值页同步生效"
          icon={RefreshCw}
          tone="neutral"
        />
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border p-4"
        style={SETTINGS_OVERLAY_STYLE}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">充值汇率规则</div>
            <SettingsBadge tone="neutral">前台同步生效</SettingsBadge>
          </div>
          <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
            每个币种都支持独立设置兑换比例、金额范围和可见状态。保存后，充值页会立刻读取新规则。
          </div>
        </div>
        <SettingsActionButton icon={RefreshCw} loading={loadingRates} onClick={() => void loadRates()}>
          {loadingRates ? '刷新中...' : '刷新汇率'}
        </SettingsActionButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {currencies.map((currency) => {
          const rate = exchangeRates[currency];
          const isSaving = savingCurrency === currency;
          const previewAmount = currency === 'CNY' ? 100 : 10;

          return (
            <div key={currency} className="rounded-[24px] border p-5" style={SETTINGS_ELEVATED_STYLE}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[16px] font-semibold text-[var(--text-primary)]">
                      {getCurrencyLabel(currency)}
                    </div>
                    <SettingsBadge tone="neutral">{currency}</SettingsBadge>
                    <SettingsBadge tone={rate.isActive ? 'emerald' : 'neutral'}>
                      {rate.isActive ? '前台显示中' : '前台已隐藏'}
                    </SettingsBadge>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    {currency === 'CNY'
                      ? '控制人民币充值档位的积分换算与展示状态。'
                      : '控制美元充值档位的积分换算与展示状态。'}
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

              <div className="mt-4 rounded-[20px] border p-4 text-[13px] leading-6" style={SETTINGS_OVERLAY_STYLE}>
                <div>金额范围：{formatAmountRange(rate, currency)}</div>
                <div className="mt-2">
                  充值预览：{formatAmountPreview(previewAmount, currency)} = {previewAmount * rate.creditsPerUnit} 积分
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <SettingsActionButton
                  icon={Coins}
                  tone="primary"
                  loading={isSaving}
                  onClick={() => void handleSaveExchangeRate(currency)}
                >
                  {isSaving ? '保存中...' : `保存${currency === 'CNY' ? '人民币' : '美元'}规则`}
                </SettingsActionButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExchangeRateSettingsView;
