import React, { useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw, Wallet } from 'lucide-react';
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
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
  SETTINGS_PANEL_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';

const currencies: SupportedRechargeCurrency[] = ['CNY', 'USD'];

const createEmptyRateState = (): Record<SupportedRechargeCurrency, CreditExchangeRate> => ({
  CNY: { ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY },
  USD: { ...DEFAULT_CREDIT_EXCHANGE_RATES.USD },
});

const formatAmountPreview = (amount: number, currency: SupportedRechargeCurrency) =>
  currency === 'CNY' ? `¥${amount}` : `$${amount}`;

const formatAmountRange = (rate: CreditExchangeRate, currency: SupportedRechargeCurrency) => {
  const parts: string[] = [];
  if (rate.minAmount !== null) {
    parts.push(`最低 ${formatAmountPreview(rate.minAmount, currency)}`);
  }
  if (rate.maxAmount !== null) {
    parts.push(`最高 ${formatAmountPreview(rate.maxAmount, currency)}`);
  }
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
    () => `¥1 = ${exchangeRates.CNY.creditsPerUnit} 积分 / $1 = ${exchangeRates.USD.creditsPerUnit} 积分`,
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
      const saved = await upsertCreditExchangeRate({
        ...rate,
        currencyCode: currency,
      });

      setExchangeRates((current) => ({
        ...current,
        [currency]: saved,
      }));
      notify.success('保存成功', `${currency} 汇率已更新。`);
    } catch (error: any) {
      notify.error('保存失败', error?.message || '请稍后再试。');
    } finally {
      setSavingCurrency(null);
    }
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        tone="indigo"
        icon={Coins}
        eyebrow="EXCHANGE RATE"
        title="汇率设置"
        description="统一维护人民币和美元的积分倍率、可用状态以及充值金额上下限，前台充值页会直接读取这里的规则。"
        badge={<SettingsBadge tone="indigo">{summaryLabel}</SettingsBadge>}
        actions={
          <SettingsActionButton icon={RefreshCw} onClick={() => void loadRates()} loading={loadingRates}>
            {loadingRates ? '正在刷新...' : '刷新汇率'}
          </SettingsActionButton>
        }
        metrics={
          <>
            <SettingsMetricCard
              label="已启用币种"
              value={`${activeCurrencies} / ${currencies.length}`}
              helper={activeCurrencies === currencies.length ? '前台可以同时展示两种币种。' : '已停用的币种不会显示在充值页。'}
              icon={Wallet}
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
              label="预览示例"
              value={`¥100 = ${exchangeRates.CNY.creditsPerUnit * 100}`}
              helper={`$10 = ${exchangeRates.USD.creditsPerUnit * 10} 积分`}
              icon={RefreshCw}
              tone="sky"
            />
          </>
        }
      />

      <SettingsSection
        title="币种规则"
        description="每张卡片只处理一个币种，方便单独保存、校对和停用。"
        action={<SettingsBadge tone="neutral">支持独立启停</SettingsBadge>}
      >
        <div className="settings-exchange-grid">
          {currencies.map((currency) => {
            const rate = exchangeRates[currency];
            const isSaving = savingCurrency === currency;
            const previewAmount = currency === 'CNY' ? 100 : 10;

            return (
              <article key={currency} className="settings-exchange-card" style={SETTINGS_ELEVATED_STYLE}>
                <div className="settings-exchange-card__header">
                  <div>
                    <div className="settings-exchange-card__title">
                      {currency === 'CNY' ? '人民币充值' : '美元充值'}
                    </div>
                    <div className="settings-exchange-card__subtitle">
                      当前显示为 {currency === 'CNY' ? '¥1' : '$1'} = {rate.creditsPerUnit} 积分
                    </div>
                  </div>
                  <SettingsBadge tone={rate.isActive ? 'emerald' : 'neutral'}>
                    {rate.isActive ? '已启用' : '已停用'}
                  </SettingsBadge>
                </div>

                <div className="settings-exchange-card__fields">
                  <label className="space-y-2">
                    <span className={SETTINGS_LABEL_CLASSNAME}>每 1 单位货币可得积分</span>
                    <input
                      type="number"
                      min={1}
                      value={rate.creditsPerUnit}
                      onChange={(event) => handleRateFieldChange(currency, 'creditsPerUnit', event.target.value)}
                      className={SETTINGS_INPUT_CLASSNAME}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={SETTINGS_LABEL_CLASSNAME}>最小充值金额</span>
                    <input
                      type="number"
                      min={0}
                      value={rate.minAmount ?? ''}
                      onChange={(event) => handleRateFieldChange(currency, 'minAmount', event.target.value)}
                      className={SETTINGS_INPUT_CLASSNAME}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={SETTINGS_LABEL_CLASSNAME}>最大充值金额</span>
                    <input
                      type="number"
                      min={0}
                      value={rate.maxAmount ?? ''}
                      onChange={(event) => handleRateFieldChange(currency, 'maxAmount', event.target.value)}
                      className={SETTINGS_INPUT_CLASSNAME}
                    />
                  </label>
                </div>

                <label className="settings-exchange-toggle" style={SETTINGS_PANEL_STYLE}>
                  <div>
                    <div className="settings-exchange-toggle__title">允许前台显示并使用该币种</div>
                    <div className="settings-exchange-toggle__hint">关闭后，充值页将隐藏该币种入口。</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={rate.isActive}
                    onChange={(event) => handleRateFieldChange(currency, 'isActive', event.target.checked)}
                  />
                </label>

                <div className="settings-exchange-preview" style={SETTINGS_PANEL_STYLE}>
                  <div className="settings-exchange-preview__row">
                    <span className="settings-exchange-preview__label">金额范围</span>
                    <span className="settings-exchange-preview__value">{formatAmountRange(rate, currency)}</span>
                  </div>
                  <div className="settings-exchange-preview__row">
                    <span className="settings-exchange-preview__label">充值预览</span>
                    <span className="settings-exchange-preview__value">
                      {formatAmountPreview(previewAmount, currency)} = {previewAmount * rate.creditsPerUnit} 积分
                    </span>
                  </div>
                </div>

                <div className="settings-exchange-card__actions">
                  <SettingsActionButton
                    icon={Coins}
                    tone="primary"
                    onClick={() => void handleSaveExchangeRate(currency)}
                    loading={isSaving}
                  >
                    {isSaving ? '保存中...' : `保存 ${currency} 汇率`}
                  </SettingsActionButton>
                </div>
              </article>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="使用说明"
        description="汇率卡片尽量只保留必要字段，减少误操作。"
        action={<SettingsBadge tone="neutral">iOS 风格简化说明</SettingsBadge>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border p-5" style={SETTINGS_ELEVATED_STYLE}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              推荐维护方式
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <div>优先确认积分倍率，再调整充值范围，最后决定是否对前台开放该币种。</div>
              <div>人民币和美元可以独立保存，不需要一次性修改全部配置。</div>
              <div>如果只是临时停用某个币种，直接关闭启用开关即可，不必删除历史数据。</div>
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={SETTINGS_PANEL_STYLE}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              当前生效规则
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <div>人民币：{formatAmountRange(exchangeRates.CNY, 'CNY')}</div>
              <div>美元：{formatAmountRange(exchangeRates.USD, 'USD')}</div>
              <div>汇率摘要：{summaryLabel}</div>
            </div>
          </div>
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default ExchangeRateSettingsView;
