import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock3,
  Coins,
  DollarSign,
  History,
  Layers3,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import type { CreditTransactionLog } from '../context/BillingContext';
import { useBilling } from '../context/BillingContext';
import { useLocale } from '../context/LocaleContext';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsViewShell,
} from '../components/settings/SettingsScaffold';
import {
  getHistorySummary,
  getRecentEntries,
  parseModelSource,
  type CostBreakdownItem,
  type CostEntry,
} from '../services/billing/costService';
import { formatRemainingCredits } from '../services/billing/remainingBalance';
import { adminModelService } from '../services/model/adminModelService';

interface CostEstimationProps {
  onBack?: () => void;
  embedded?: boolean;
}

type ConsumptionTab = 'api' | 'credits';

export interface ConsumptionRecord {
  id: string;
  source: 'api' | 'credits';
  modelId: string;
  modelName: string;
  providerId?: string | null;
  tokens?: number | null;
  amountUsd?: number | null;
  credits?: number | null;
  timestamp: number;
  status?: string | null;
  description?: string | null;
}

type CreditConsumptionSummary = {
  key: string;
  modelName: string;
  providerId?: string | null;
  totalCredits: number;
  totalCount: number;
  latestTimestamp: number;
};

const tableWrapperStyle = {
  borderColor: 'var(--settings-border-subtle)',
  background: 'var(--settings-surface-overlay)',
} as const;

const tableClassName = 'w-full min-w-[720px] table-fixed border-collapse';
const tableHeaderCellClassName =
  'px-4 py-3 text-left align-middle text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)] whitespace-nowrap';
const tableCellClassName = 'px-4 py-3.5 align-top text-sm';
const tableTextCellClassName = `${tableCellClassName} min-w-0`;
const tableNumberCellClassName = `${tableCellClassName} whitespace-nowrap text-right tabular-nums`;
const tableTimeCellClassName = `${tableCellClassName} whitespace-nowrap tabular-nums`;

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="rounded-[22px] border border-dashed px-4 py-10 text-center text-sm leading-6"
    style={{
      borderColor: 'var(--settings-border-subtle)',
      background:
        'linear-gradient(180deg, rgb(255 255 255 / 0.02) 0%, transparent 100%), var(--settings-surface-overlay)',
      color: 'var(--text-secondary)',
    }}
  >
    {children}
  </div>
);

const ConsumptionMetricCard: React.FC<{
  label: string;
  value: string;
  helper: string;
  badge?: React.ReactNode;
}> = ({ label, value, helper, badge }) => (
  <section className="settings-reference-card settings-reference-card--elevated">
    <div className="settings-reference-card__header">
      <div>
        <div className="settings-reference-card__eyebrow">{label}</div>
        <div className="settings-reference-card__title">{value}</div>
        <div className="settings-reference-card__meta">{helper}</div>
      </div>
      {badge}
    </div>
  </section>
);

const ConsumptionModeButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-full px-4 py-2 text-sm font-medium transition-all"
    style={
      active
        ? {
            border: '1px solid var(--settings-nav-active-border)',
            background: 'var(--settings-nav-active-bg)',
            color: 'var(--text-primary)',
            boxShadow: '0 18px 32px rgb(var(--settings-accent-rgb) / 0.14)',
          }
        : {
            border: '1px solid var(--settings-border-subtle)',
            background: 'var(--settings-surface-overlay)',
            color: 'var(--text-secondary)',
          }
    }
  >
    {label}
  </button>
);

const formatUsd = (value: number, locale = 'zh-CN') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(Number(value || 0));

const formatNumber = (value: number, maximumFractionDigits = 0, locale = 'zh-CN') =>
  new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);

const formatDateTime = (value: number, locale = 'zh-CN') =>
  new Date(value).toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const toConsumptionRecordFromApi = (entry: CostEntry): ConsumptionRecord => {
  const parsed = parseModelSource(entry.model);
  return {
    id: entry.id,
    source: 'api',
    modelId: parsed.modelId,
    modelName: parsed.modelId,
    providerId: parsed.source,
    tokens: entry.tokens || 0,
    amountUsd: entry.costUsd || 0,
    credits: null,
    timestamp: entry.timestamp,
    description: entry.details || null,
    status: 'completed',
  };
};

const toConsumptionRecordFromCreditLog = (
  log: CreditTransactionLog,
  fallbackLabel: string,
): ConsumptionRecord => ({
  id: log.id,
  source: 'credits',
  modelId: log.model_id || log.model_name || log.description || fallbackLabel,
  modelName: log.model_name || log.model_id || log.description || fallbackLabel,
  providerId: log.provider_id || null,
  tokens: typeof log.metadata?.tokens === 'number' ? log.metadata.tokens : null,
  amountUsd:
    typeof log.metadata?.amountUsd === 'number' ? log.metadata.amountUsd : null,
  credits: Math.abs(Number(log.amount || 0)),
  timestamp: new Date(log.created_at).getTime(),
  description: log.description || null,
  status: log.status || null,
});

const buildCreditSummary = (
  logs: CreditTransactionLog[],
  fallbackLabel: string,
): CreditConsumptionSummary[] => {
  const grouped = new Map<string, CreditConsumptionSummary>();

  logs
    .filter((log) => log.type === 'consumption')
    .forEach((log) => {
      const modelName =
        log.model_name || log.model_id || log.description || fallbackLabel;
      const key = `${modelName}::${log.provider_id || ''}`;
      const current = grouped.get(key) || {
        key,
        modelName,
        providerId: log.provider_id || null,
        totalCredits: 0,
        totalCount: 0,
        latestTimestamp: 0,
      };

      current.totalCredits += Math.abs(Number(log.amount || 0));
      current.totalCount += 1;
      current.latestTimestamp = Math.max(
        current.latestTimestamp,
        new Date(log.created_at).getTime(),
      );
      grouped.set(key, current);
    });

  return Array.from(grouped.values()).sort(
    (left, right) => right.latestTimestamp - left.latestTimestamp,
  );
};

export const CostEstimation: React.FC<CostEstimationProps> = ({
  onBack,
  embedded = false,
}) => {
  const { pick, locale } = useLocale();
  const { balance, loading: billingLoading, usageLogs, refreshBilling, fetchLogs } = useBilling();
  const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);

  const [activeTab, setActiveTab] = useState<ConsumptionTab>('api');
  const [summaryRows, setSummaryRows] = useState<CostBreakdownItem[]>([]);
  const [recentRows, setRecentRows] = useState<CostEntry[]>([]);
  const [creditModelCount, setCreditModelCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setSummaryRows(getHistorySummary(30));
    setRecentRows(getRecentEntries(50));
  }, [refreshTick]);

  useEffect(() => {
    const updateAdminModels = () => {
      const models = adminModelService
        .getModels()
        .filter((item) => item.creditCost !== undefined && item.creditCost > 0);
      setCreditModelCount(models.length);
    };

    updateAdminModels();
    void adminModelService.loadAdminModels().then(updateAdminModels);

    const unsubscribe = adminModelService.subscribe(updateAdminModels);
    return unsubscribe;
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      setRefreshTick((value) => value + 1);
      await refreshBilling();
    } finally {
      setRefreshing(false);
    }
  };

  const apiRecords = useMemo(
    () => recentRows.map(toConsumptionRecordFromApi),
    [recentRows],
  );
  const creditLogs = useMemo(
    () => usageLogs.filter((log) => log.type === 'consumption'),
    [usageLogs],
  );
  const creditFallbackLabel = pick('积分消耗', 'Credit consumption');
  const creditRecords = useMemo(
    () => creditLogs.map((log) => toConsumptionRecordFromCreditLog(log, creditFallbackLabel)),
    [creditFallbackLabel, creditLogs],
  );
  const creditSummaryRows = useMemo(
    () => buildCreditSummary(creditLogs, creditFallbackLabel),
    [creditFallbackLabel, creditLogs],
  );

  const apiOverview = useMemo(() => {
    const totalCost = summaryRows.reduce((sum, item) => sum + (item.cost || 0), 0);
    const totalTokens = summaryRows.reduce(
      (sum, item) => sum + (item.tokens || 0),
      0,
    );
    const totalCount = summaryRows.reduce((sum, item) => sum + (item.count || 0), 0);

    return {
      totalCost,
      totalTokens,
      totalCount,
    };
  }, [summaryRows]);

  const creditOverview = useMemo(() => {
    const totalCredits = creditRecords.reduce(
      (sum, item) => sum + Math.abs(Number(item.credits || 0)),
      0,
    );
    const totalCount = creditRecords.length;
    const totalAmountUsd = creditRecords.reduce(
      (sum, item) => sum + Number(item.amountUsd || 0),
      0,
    );

    return {
      totalCredits,
      totalCount,
      totalAmountUsd,
    };
  }, [creditRecords]);

  const topApiModel = useMemo(
    () =>
      summaryRows
        .slice()
        .sort((left, right) => (right.cost || 0) - (left.cost || 0))[0] || null,
    [summaryRows],
  );

  const topCreditModel = useMemo(
    () =>
      creditSummaryRows
        .slice()
        .sort(
          (left, right) => right.totalCredits - left.totalCredits,
        )[0] || null,
    [creditSummaryRows],
  );

  const latestApiRecord = apiRecords[0] || null;
  const latestCreditRecord = creditRecords[0] || null;

  const content = (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">
              {pick('高级设置', 'Advanced Settings')}
            </div>
            <h2>{pick('计费中心', 'Consumption Center')}</h2>
            <p>
              {pick(
                '这里统一查看 API 账单和积分消耗，界面与仪表盘和 API 页面保持同一套深色控制台结构。通过模式切换，你可以直接比较上游 API 花费和站内积分消耗。',
                'Billing and credit history now follow the same dark control-console structure as the dashboard and API pages. Use the mode switch to compare direct API spend against internal credit consumption.'
              )}
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={activeTab === 'api' ? 'amber' : 'emerald'}>
              {activeTab === 'api'
                ? pick('API 消耗视图', 'API Spend View')
                : pick('积分消耗视图', 'Credit Consumption View')}
            </SettingsBadge>
            {!embedded && onBack ? (
              <SettingsActionButton icon={ArrowLeft} onClick={onBack}>
                {pick('返回', 'Back')}
              </SettingsActionButton>
            ) : null}
            <SettingsActionButton
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => void refreshAll()}
            >
              {pick('刷新', 'Refresh')}
            </SettingsActionButton>
          </div>
        </div>

        <section className="settings-reference-card settings-reference-card--soft">
          <div className="settings-reference-card__header">
            <div>
              <div className="settings-reference-card__eyebrow">
                {pick('查看模式', 'View Mode')}
              </div>
              <div className="settings-reference-card__title">
                {activeTab === 'api'
                  ? pick('API 消耗台账', 'API Spend Ledger')
                  : pick('积分台账', 'Credit Ledger')}
              </div>
              <div className="settings-reference-card__meta">
                {pick(
                  '在上游 API 成本记录和站内积分消耗记录之间切换，统一查看两套账本。',
                  'Switch between raw upstream API cost history and the internal credit-based consumption stream.'
                )}
              </div>
            </div>
            <SettingsBadge tone="neutral">
              {pick('统一计费界面', 'Unified Billing UI')}
            </SettingsBadge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ConsumptionModeButton
              active={activeTab === 'api'}
              label={pick('API 消耗', 'API Spend')}
              onClick={() => setActiveTab('api')}
            />
            <ConsumptionModeButton
              active={activeTab === 'credits'}
              label={pick('积分消耗', 'Credit Consumption')}
              onClick={() => setActiveTab('credits')}
            />
          </div>
        </section>

        {activeTab === 'api' ? (
          <>
            <div className="settings-reference-grid-4">
              <ConsumptionMetricCard
                label={pick('30 天花费', '30-Day Spend')}
                value={formatUsd(apiOverview.totalCost, locale)}
                helper={pick('最近 API 台账中累计记录的上游成本。', 'Aggregated upstream cost captured in the recent API ledger.')}
                badge={<DollarSign size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('请求次数', 'Request Count')}
                value={formatNumber(apiOverview.totalCount, 0, locale)}
                helper={pick('当前窗口内记录到的 API 计费事件总数。', 'Total recorded API charge events in the current window.')}
                badge={<History size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('词元总量', 'Token Volume')}
                value={formatNumber(apiOverview.totalTokens, 0, locale)}
                helper={pick('最近 API 记录中的词元使用总量。', 'Combined token activity across the recent API records.')}
                badge={<Wallet size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('最近计费', 'Latest Charge')}
                value={latestApiRecord ? formatDateTime(latestApiRecord.timestamp, locale) : pick('暂无记录', 'No record')}
                helper={pick('本地最近一次写入的 API 计费时间。', 'Timestamp of the latest API billing event written locally.')}
                badge={<Clock3 size={18} className="text-[var(--text-primary)]" />}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
              <section className="settings-reference-card">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">
                      {pick('模型汇总', 'Model Summary')}
                    </div>
                    <div className="settings-reference-card__title">
                      {pick('30 天花费矩阵', '30-Day Spend Matrix')}
                    </div>
                    <div className="settings-reference-card__meta">
                      {pick(
                        '用统一矩阵对比模型成本、请求次数和词元量，更适合现在的控制台布局。',
                        'Compare model cost, request count, and token volume using a flatter grid that fits the new control-console layout.'
                      )}
                    </div>
                  </div>
                  <SettingsBadge tone="neutral">
                    {pick('滚动 30 天', 'Rolling 30 days')}
                  </SettingsBadge>
                </div>

                {summaryRows.length > 0 ? (
                  <div className="mt-5 overflow-hidden rounded-[22px] border" style={tableWrapperStyle}>
                    <div className="overflow-x-auto">
                      <table className={tableClassName}>
                        <colgroup>
                          <col style={{ width: '34%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                        </colgroup>
                        <thead style={{ background: 'rgb(255 255 255 / 0.03)' }}>
                          <tr>
                            <th className={tableHeaderCellClassName}>{pick('模型', 'Model')}</th>
                            <th className={tableHeaderCellClassName}>{pick('来源', 'Source')}</th>
                            <th className={`${tableHeaderCellClassName} text-right`}>{pick('调用次数', 'Calls')}</th>
                            <th className={`${tableHeaderCellClassName} text-right`}>{pick('词元数', 'Tokens')}</th>
                            <th className={`${tableHeaderCellClassName} text-right`}>{pick('花费', 'Spend')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryRows.map((item, index) => {
                            const parsed = parseModelSource(item.model);
                            return (
                              <tr
                                key={`${item.model}_${item.imageSize}_${index}`}
                                className="border-t"
                                style={{ borderColor: 'var(--settings-border-subtle)' }}
                              >
                                <td className={tableTextCellClassName}>
                                  <div
                                    className="min-w-0 break-words font-medium"
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {parsed.modelId}
                                  </div>
                                  <div
                                    className="mt-1 break-words text-xs"
                                    style={{ color: 'var(--text-tertiary)' }}
                                  >
                                    {item.imageSize}
                                  </div>
                                </td>
                                <td className={tableTextCellClassName}>
                                  <SettingsBadge tone="neutral">{parsed.source}</SettingsBadge>
                                </td>
                                <td
                                  className={tableNumberCellClassName}
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {formatNumber(item.count, 0, locale)}
                                </td>
                                <td
                                  className={tableNumberCellClassName}
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {formatNumber(item.tokens, 0, locale)}
                                </td>
                                <td
                                  className={`${tableNumberCellClassName} font-semibold`}
                                  style={{ color: 'var(--state-success-text)' }}
                                >
                                  {formatUsd(item.cost, locale)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyState>
                      {pick('暂时还没有 API 消耗记录。', 'No API consumption records have been written yet.')}
                    </EmptyState>
                  </div>
                )}
              </section>

              <section className="settings-reference-card">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">
                      {pick('花费快照', 'Spend Snapshot')}
                    </div>
                    <div className="settings-reference-card__title">
                      {pick('计费信号', 'Billing Signal')}
                    </div>
                    <div className="settings-reference-card__meta">
                      {pick(
                        '不用先打开详细表格，也能快速了解当前 API 花费结构。',
                        'Quick context for the current API-spend shape without opening the detailed table first.'
                      )}
                    </div>
                  </div>
                  <Layers3 size={18} className="text-[var(--text-primary)]" />
                </div>

                <div className="mt-5 settings-reference-list">
                  <div className="settings-reference-list-item">
                    <div className="min-w-0 flex-1">
                      <div className="settings-reference-list-item__title">
                        {pick('最高消耗模型', 'Top Model')}
                      </div>
                      <div className="settings-reference-list-item__meta">
                        {pick('30 天窗口内累计花费最高的模型。', 'Highest recorded spend in the 30-day window.')}
                      </div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {topApiModel ? parseModelSource(topApiModel.model).modelId : pick('无', 'None')}
                    </div>
                  </div>
                  <div className="settings-reference-list-item">
                    <div className="min-w-0 flex-1">
                      <div className="settings-reference-list-item__title">
                        {pick('最高花费', 'Top Spend')}
                      </div>
                      <div className="settings-reference-list-item__meta">
                        {pick('当前视图里花费最高的模型行。', 'Cost tied to the heaviest model line in the current view.')}
                      </div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {topApiModel ? formatUsd(topApiModel.cost, locale) : formatUsd(0, locale)}
                    </div>
                  </div>
                  <div className="settings-reference-list-item">
                    <div className="min-w-0 flex-1">
                      <div className="settings-reference-list-item__title">
                        {pick('平均事件成本', 'Average Event')}
                      </div>
                      <div className="settings-reference-list-item__meta">
                        {pick('本地记录的 API 计费事件平均成本。', 'Mean cost across the locally recorded API billing events.')}
                      </div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {apiOverview.totalCount > 0
                        ? formatUsd(apiOverview.totalCost / apiOverview.totalCount, locale)
                        : formatUsd(0, locale)}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="settings-reference-card">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">
                    {pick('最近计费', 'Recent Charges')}
                  </div>
                  <div className="settings-reference-card__title">
                    {pick('最新 API 计费记录', 'Latest API Billing Events')}
                  </div>
                  <div className="settings-reference-card__meta">
                    {pick(
                      '这里直接展示本地计费服务最近记录的 API 计费明细。',
                      'A direct ledger of the most recent API charge rows recorded by the local billing service.'
                    )}
                  </div>
                </div>
                <SettingsBadge tone="indigo">
                  {pick(`${apiRecords.length} 行`, `${apiRecords.length} rows`)}
                </SettingsBadge>
              </div>

              {apiRecords.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-[22px] border" style={tableWrapperStyle}>
                  <div className="overflow-x-auto">
                    <table className={tableClassName}>
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                      </colgroup>
                      <thead style={{ background: 'rgb(255 255 255 / 0.03)' }}>
                        <tr>
                          <th className={tableHeaderCellClassName}>{pick('时间', 'Time')}</th>
                          <th className={tableHeaderCellClassName}>{pick('模型', 'Model')}</th>
                          <th className={`${tableHeaderCellClassName} text-right`}>{pick('词元数', 'Tokens')}</th>
                          <th className={`${tableHeaderCellClassName} text-right`}>{pick('花费', 'Spend')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiRecords.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-t"
                            style={{ borderColor: 'var(--settings-border-subtle)' }}
                          >
                            <td
                              className={tableTimeCellClassName}
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {formatDateTime(entry.timestamp, locale)}
                            </td>
                            <td className={tableTextCellClassName}>
                              <div
                                className="min-w-0 break-words font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {entry.modelName}
                              </div>
                              <div
                                className="mt-1 break-words text-xs"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                {entry.providerId || pick('自定义接口', 'Custom API')}
                              </div>
                            </td>
                            <td
                              className={tableNumberCellClassName}
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {formatNumber(entry.tokens || 0, 0, locale)}
                            </td>
                            <td
                              className={`${tableNumberCellClassName} font-semibold`}
                              style={{ color: 'var(--state-success-text)' }}
                            >
                              {formatUsd(entry.amountUsd || 0, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState>{pick('当前还没有 API 计费记录。', 'No API charge rows are currently available.')}</EmptyState>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="settings-reference-grid-4">
              <ConsumptionMetricCard
                label={pick('当前余额', 'Current Balance')}
                value={remainingBalanceDisplay}
                helper={pick('当前工作区可立即使用的积分。', 'Credits immediately available to the current workspace.')}
                badge={<Coins size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('积分模型数', 'Credit Models')}
                value={formatNumber(creditModelCount, 0, locale)}
                helper={pick('当前可参与调度且启用了积分定价的模型数量。', 'Pricing-enabled admin models currently available for dispatch.')}
                badge={<Wallet size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('已消耗积分', 'Credits Consumed')}
                value={formatNumber(creditOverview.totalCredits, 0, locale)}
                helper={pick('当前积分消耗台账中的累计用量。', 'Total credit usage across the recorded consumption ledger.')}
                badge={<History size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('最近扣减', 'Latest Deduction')}
                value={
                  latestCreditRecord
                    ? formatDateTime(latestCreditRecord.timestamp, locale)
                    : pick('暂无记录', 'No record')
                }
                helper={pick('最近一次写入日志的积分扣减时间。', 'Most recent credit-consumption event written to the log.')}
                badge={<Clock3 size={18} className="text-[var(--text-primary)]" />}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
              <section className="settings-reference-card">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">
                      {pick('积分汇总', 'Credit Summary')}
                    </div>
                    <div className="settings-reference-card__title">
                      {pick('模型消耗矩阵', 'Model Consumption Matrix')}
                    </div>
                    <div className="settings-reference-card__meta">
                      {pick(
                        '按模型和供应商分组，快速看出哪些积分链路承担了最多消耗。',
                        'Grouped by model and provider so you can quickly spot which credit routes are absorbing the most demand.'
                      )}
                    </div>
                  </div>
                  <SettingsBadge tone="neutral">
                    {pick(`${creditOverview.totalCount} 行`, `${creditOverview.totalCount} rows`)}
                  </SettingsBadge>
                </div>

                {creditSummaryRows.length > 0 ? (
                  <div className="mt-5 overflow-hidden rounded-[22px] border" style={tableWrapperStyle}>
                    <div className="overflow-x-auto">
                      <table className={tableClassName}>
                        <colgroup>
                          <col style={{ width: '30%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '14%' }} />
                          <col style={{ width: '20%' }} />
                        </colgroup>
                        <thead style={{ background: 'rgb(255 255 255 / 0.03)' }}>
                          <tr>
                            <th className={tableHeaderCellClassName}>{pick('模型', 'Model')}</th>
                            <th className={tableHeaderCellClassName}>{pick('供应商', 'Provider')}</th>
                            <th className={`${tableHeaderCellClassName} text-right`}>{pick('积分', 'Credits')}</th>
                            <th className={`${tableHeaderCellClassName} text-right`}>{pick('次数', 'Calls')}</th>
                            <th className={`${tableHeaderCellClassName} text-right`}>{pick('最近时间', 'Latest')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditSummaryRows.map((item) => (
                            <tr
                              key={item.key}
                              className="border-t"
                              style={{ borderColor: 'var(--settings-border-subtle)' }}
                            >
                              <td className={tableTextCellClassName}>
                                <div
                                  className="min-w-0 break-words font-medium"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {item.modelName}
                                </div>
                              </td>
                              <td className={tableTextCellClassName}>
                                <SettingsBadge tone="neutral">
                                  {item.providerId || pick('系统路由', 'System route')}
                                </SettingsBadge>
                              </td>
                              <td
                                className={`${tableNumberCellClassName} font-semibold`}
                                style={{ color: 'var(--state-warning-text)' }}
                              >
                                {formatNumber(item.totalCredits, 0, locale)}
                              </td>
                              <td
                                className={tableNumberCellClassName}
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {formatNumber(item.totalCount, 0, locale)}
                              </td>
                              <td
                                className={tableTimeCellClassName}
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {formatDateTime(item.latestTimestamp, locale)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyState>
                      {pick('暂时还没有积分消耗汇总记录。', 'No credit-consumption summary rows are available yet.')}
                    </EmptyState>
                  </div>
                )}
              </section>

              <section className="settings-reference-card">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">
                      {pick('积分快照', 'Credit Snapshot')}
                    </div>
                    <div className="settings-reference-card__title">
                      {pick('消耗信号', 'Consumption Signal')}
                    </div>
                    <div className="settings-reference-card__meta">
                      {pick(
                        '快速查看余额压力和当前最活跃的积分模型链路。',
                        'A compact read on balance pressure and the most active internal model routes.'
                      )}
                    </div>
                  </div>
                  <Layers3 size={18} className="text-[var(--text-primary)]" />
                </div>

                <div className="mt-5 settings-reference-list">
                  <div className="settings-reference-list-item">
                    <div className="min-w-0 flex-1">
                      <div className="settings-reference-list-item__title">
                        {pick('最高消耗模型', 'Top Model')}
                      </div>
                      <div className="settings-reference-list-item__meta">
                        {pick('当前视图中累计积分消耗最高的模型。', 'Highest aggregated credit consumption in the current view.')}
                      </div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {topCreditModel?.modelName || pick('无', 'None')}
                    </div>
                  </div>
                  <div className="settings-reference-list-item">
                    <div className="min-w-0 flex-1">
                      <div className="settings-reference-list-item__title">
                        {pick('最高扣减', 'Top Deduction')}
                      </div>
                      <div className="settings-reference-list-item__meta">
                        {pick('当前最高消耗模型对应的积分扣减。', 'Credits consumed by the current top model line.')}
                      </div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {topCreditModel ? formatNumber(topCreditModel.totalCredits, 0, locale) : formatNumber(0, 0, locale)}
                    </div>
                  </div>
                  <div className="settings-reference-list-item">
                    <div className="min-w-0 flex-1">
                      <div className="settings-reference-list-item__title">
                        {pick('美元元数据', 'USD Metadata')}
                      </div>
                      <div className="settings-reference-list-item__meta">
                        {pick('积分日志元数据里映射的美元金额汇总。', 'Sum of any mapped USD amounts attached to credit log metadata.')}
                      </div>
                    </div>
                    <div className="settings-reference-list-item__value">
                      {formatUsd(creditOverview.totalAmountUsd, locale)}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="settings-reference-card">
              <div className="settings-reference-card__header">
                <div>
                  <div className="settings-reference-card__eyebrow">
                    {pick('最近扣减', 'Recent Deductions')}
                  </div>
                  <div className="settings-reference-card__title">
                    {pick('最新积分事件', 'Latest Credit Events')}
                  </div>
                  <div className="settings-reference-card__meta">
                    {pick(
                      '这里展示积分账本的逐条明细，和设置台里的数据面板风格保持一致。',
                      'Detailed per-event rows for the internal credit ledger, aligned with the darker reference data surface used across the settings console.'
                    )}
                  </div>
                </div>
                <SettingsBadge tone="emerald">
                  {pick(`${creditRecords.length} 行`, `${creditRecords.length} rows`)}
                </SettingsBadge>
              </div>

              {creditRecords.length > 0 ? (
                <div className="mt-5 overflow-hidden rounded-[22px] border" style={tableWrapperStyle}>
                  <div className="overflow-x-auto">
                    <table className={tableClassName}>
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '26%' }} />
                        <col style={{ width: '34%' }} />
                        <col style={{ width: '20%' }} />
                      </colgroup>
                      <thead style={{ background: 'rgb(255 255 255 / 0.03)' }}>
                        <tr>
                          <th className={tableHeaderCellClassName}>{pick('时间', 'Time')}</th>
                          <th className={tableHeaderCellClassName}>{pick('模型', 'Model')}</th>
                          <th className={tableHeaderCellClassName}>{pick('说明', 'Description')}</th>
                          <th className={`${tableHeaderCellClassName} text-right`}>{pick('积分', 'Credits')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditRecords.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-t"
                            style={{ borderColor: 'var(--settings-border-subtle)' }}
                          >
                            <td
                              className={tableTimeCellClassName}
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {formatDateTime(entry.timestamp, locale)}
                            </td>
                            <td className={tableTextCellClassName}>
                              <div
                                className="min-w-0 break-words font-medium"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {entry.modelName}
                              </div>
                              <div
                                className="mt-1 break-words text-xs"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                {entry.providerId || pick('系统路由', 'System route')}
                              </div>
                            </td>
                            <td
                              className={tableTextCellClassName}
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {entry.description || pick('站内积分模型消耗', 'Internal credit model consumption')}
                            </td>
                            <td
                              className={`${tableNumberCellClassName} font-semibold`}
                              style={{ color: 'var(--state-warning-text)' }}
                            >
                              {formatNumber(Math.abs(Number(entry.credits || 0)), 0, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState>{pick('当前还没有积分扣减记录。', 'No credit-deduction rows are currently available.')}</EmptyState>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SettingsViewShell>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="apple-page-shell">
      <main className="apple-shell py-6">{content}</main>
    </div>
  );
};

export default CostEstimation;
