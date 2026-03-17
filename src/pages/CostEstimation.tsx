import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Coins, DollarSign, History, RefreshCw, Wallet } from 'lucide-react';
import { useBilling, type CreditTransactionLog } from '../context/BillingContext';
import {
  getHistorySummary,
  getRecentEntries,
  parseModelSource,
  type CostBreakdownItem,
  type CostEntry,
} from '../services/billing/costService';
import { adminModelService } from '../services/model/adminModelService';
import {
  SETTINGS_ELEVATED_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../components/settings/SettingsScaffold';

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
  borderColor: 'var(--border-light)',
  backgroundColor: 'var(--bg-elevated)',
} as const;

const tableHeaderCellClassName =
  'px-4 py-2.5 text-left align-middle text-[11px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)] whitespace-nowrap';

const tableClassName = 'w-full min-w-[720px] table-fixed border-collapse';
const tableCellClassName = 'px-4 py-3.5 align-top text-sm';
const tableTextCellClassName = `${tableCellClassName} min-w-0`;
const tableNumberCellClassName = `${tableCellClassName} whitespace-nowrap text-right tabular-nums`;
const tableTimeCellClassName = `${tableCellClassName} whitespace-nowrap tabular-nums`;

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm leading-6"
    style={{
      borderColor: 'var(--border-light)',
      backgroundColor: 'var(--bg-elevated)',
      color: 'var(--text-tertiary)',
    }}
  >
    {children}
  </div>
);

const formatUsd = (value: number) => `$${Number(value || 0).toFixed(value >= 1 ? 2 : 4)}`;

const formatDateTime = (value: number) =>
  new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

const toConsumptionRecordFromCreditLog = (log: CreditTransactionLog): ConsumptionRecord => ({
  id: log.id,
  source: 'credits',
  modelId: log.model_id || log.model_name || log.description || '积分消耗',
  modelName: log.model_name || log.model_id || log.description || '积分消耗',
  providerId: log.provider_id || null,
  tokens: typeof log.metadata?.tokens === 'number' ? log.metadata.tokens : null,
  amountUsd: typeof log.metadata?.amountUsd === 'number' ? log.metadata.amountUsd : null,
  credits: Math.abs(Number(log.amount || 0)),
  timestamp: new Date(log.created_at).getTime(),
  description: log.description || null,
  status: log.status || null,
});

const buildCreditSummary = (logs: CreditTransactionLog[]): CreditConsumptionSummary[] => {
  const grouped = new Map<string, CreditConsumptionSummary>();

  logs
    .filter((log) => log.type === 'consumption')
    .forEach((log) => {
      const modelName = log.model_name || log.model_id || log.description || '积分消耗';
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
      current.latestTimestamp = Math.max(current.latestTimestamp, new Date(log.created_at).getTime());
      grouped.set(key, current);
    });

  return Array.from(grouped.values()).sort((left, right) => right.latestTimestamp - left.latestTimestamp);
};

export const CostEstimation: React.FC<CostEstimationProps> = ({ onBack, embedded = false }) => {
  const { balance, usageLogs, fetchLogs } = useBilling();

  const [activeTab, setActiveTab] = useState<ConsumptionTab>('api');
  const [summaryRows, setSummaryRows] = useState<CostBreakdownItem[]>([]);
  const [recentRows, setRecentRows] = useState<CostEntry[]>([]);
  const [creditModelCount, setCreditModelCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setSummaryRows(getHistorySummary(30));
    setRecentRows(getRecentEntries(50));
  }, [refreshTick]);

  useEffect(() => {
    const updateAdminModels = () => {
      const models = adminModelService.getModels().filter((item) => item.creditCost !== undefined && item.creditCost > 0);
      setCreditModelCount(models.length);
    };

    updateAdminModels();
    void adminModelService.loadAdminModels().then(updateAdminModels);

    const unsubscribe = adminModelService.subscribe(updateAdminModels);
    return unsubscribe;
  }, []);

  const refreshAll = async () => {
    setRefreshTick((value) => value + 1);
    await fetchLogs();
  };

  const apiRecords = useMemo(() => recentRows.map(toConsumptionRecordFromApi), [recentRows]);
  const creditLogs = useMemo(() => usageLogs.filter((log) => log.type === 'consumption'), [usageLogs]);
  const creditRecords = useMemo(() => creditLogs.map(toConsumptionRecordFromCreditLog), [creditLogs]);
  const creditSummaryRows = useMemo(() => buildCreditSummary(creditLogs), [creditLogs]);

  const apiOverview = useMemo(() => {
    const totalCost = summaryRows.reduce((sum, item) => sum + (item.cost || 0), 0);
    const totalTokens = summaryRows.reduce((sum, item) => sum + (item.tokens || 0), 0);
    const totalCount = summaryRows.reduce((sum, item) => sum + (item.count || 0), 0);

    return {
      totalCost,
      totalTokens,
      totalCount,
    };
  }, [summaryRows]);

  const creditOverview = useMemo(() => {
    const totalCredits = creditRecords.reduce((sum, item) => sum + Math.abs(Number(item.credits || 0)), 0);
    const totalCount = creditRecords.length;
    const totalAmountUsd = creditRecords.reduce((sum, item) => sum + Number(item.amountUsd || 0), 0);

    return {
      totalCredits,
      totalCount,
      totalAmountUsd,
    };
  }, [creditRecords]);

  const heroMetrics =
    activeTab === 'api' ? (
      <>
        <SettingsMetricCard
          label="累计 API 花费"
          value={formatUsd(apiOverview.totalCost)}
          helper="近 30 天本地记录汇总。"
          icon={DollarSign}
          tone="amber"
        />
        <SettingsMetricCard
          label="累计调用"
          value={apiOverview.totalCount.toLocaleString('zh-CN')}
          helper="仅统计已写入消费记录的调用。"
          icon={History}
          tone="indigo"
        />
        <SettingsMetricCard
          label="累计 Tokens"
          value={apiOverview.totalTokens.toLocaleString('zh-CN')}
          helper="用于识别高消耗模型。"
          icon={Wallet}
          tone="sky"
        />
        <SettingsMetricCard
          label="最近一笔"
          value={apiRecords.length > 0 ? formatDateTime(apiRecords[0].timestamp) : '暂无'}
          helper="最近一次 API 价格消费。"
          icon={RefreshCw}
          tone="neutral"
        />
      </>
    ) : (
      <>
        <SettingsMetricCard
          label="当前积分"
          value={balance.toLocaleString('zh-CN')}
          helper="当前账号可直接使用的积分余额。"
          icon={Coins}
          tone="emerald"
        />
        <SettingsMetricCard
          label="积分模型"
          value={creditModelCount.toLocaleString('zh-CN')}
          helper="后台统一维护、前台直接使用。"
          icon={Wallet}
          tone="indigo"
        />
        <SettingsMetricCard
          label="累计积分消耗"
          value={creditOverview.totalCredits.toLocaleString('zh-CN')}
          helper="按消费流水聚合的积分总消耗。"
          icon={Coins}
          tone="amber"
        />
        <SettingsMetricCard
          label="最近一笔"
          value={creditRecords.length > 0 ? formatDateTime(creditRecords[0].timestamp) : '暂无'}
          helper="最近一次积分模型消费。"
          icon={RefreshCw}
          tone="neutral"
        />
      </>
    );

  const content = (
    <SettingsViewShell>
      <SettingsHero
        tone={activeTab === 'api' ? 'indigo' : 'emerald'}
        icon={activeTab === 'api' ? DollarSign : Coins}
        eyebrow="CONSUMPTION CENTER"
        title="消费记录"
        description={
          activeTab === 'api'
            ? '聚合用户自定义 API 的费用记录、模型累计花费与最近调用明细。'
            : '聚合系统积分模型的消费流水、模型总消耗与最近扣费记录。'
        }
        badge={<SettingsBadge tone={activeTab === 'api' ? 'amber' : 'emerald'}>{activeTab === 'api' ? 'API 消费' : '积分消耗'}</SettingsBadge>}
        actions={(
          <>
            {!embedded && onBack ? (
              <SettingsActionButton icon={ArrowLeft} onClick={onBack}>
                返回
              </SettingsActionButton>
            ) : null}
            <SettingsActionButton icon={RefreshCw} onClick={() => void refreshAll()}>
              刷新
            </SettingsActionButton>
            <div className="apple-pill-group consumption-pill-group">
              <button
                onClick={() => setActiveTab('api')}
                className={`apple-pill-button ${activeTab === 'api' ? 'active' : ''}`}
              >
                <DollarSign className="h-4 w-4" />
                API 消费
              </button>
              <button
                onClick={() => setActiveTab('credits')}
                className={`apple-pill-button ${activeTab === 'credits' ? 'active' : ''}`}
              >
                <Coins className="h-4 w-4" />
                积分消耗
              </button>
            </div>
          </>
        )}
        metrics={heroMetrics}
      />

      {activeTab === 'api' ? (
        <>
          <SettingsSection
            eyebrow="MODEL SUMMARY"
            title="模型总消耗"
            description="查看近 30 天内每个模型的累计调用、Tokens 和费用。"
            action={<SettingsBadge tone="neutral">近 30 天</SettingsBadge>}
          >
            {summaryRows.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border" style={tableWrapperStyle}>
                <div className="overflow-x-auto">
                  <table className={tableClassName}>
                    <colgroup>
                      <col style={{ width: '34%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      <tr>
                        <th className={tableHeaderCellClassName}>模型</th>
                        <th className={tableHeaderCellClassName}>来源</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>累计调用</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>累计 Tokens</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>累计费用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((item, index) => {
                        const parsed = parseModelSource(item.model);
                        return (
                          <tr key={`${item.model}_${item.imageSize}_${index}`} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                            <td className={tableTextCellClassName}>
                              <div className="min-w-0 break-words font-medium" style={{ color: 'var(--text-primary)' }}>
                                {parsed.modelId}
                              </div>
                              <div className="mt-1 break-words text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {item.imageSize}
                              </div>
                            </td>
                            <td className={tableTextCellClassName}>
                              <SettingsBadge tone="neutral">{parsed.source}</SettingsBadge>
                            </td>
                            <td className={tableNumberCellClassName} style={{ color: 'var(--text-secondary)' }}>
                              {item.count.toLocaleString('zh-CN')}
                            </td>
                            <td className={tableNumberCellClassName} style={{ color: 'var(--text-secondary)' }}>
                              {item.tokens.toLocaleString('zh-CN')}
                            </td>
                            <td className={`${tableNumberCellClassName} font-semibold`} style={{ color: 'var(--state-success-text)' }}>
                              {formatUsd(item.cost)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState>暂无 API 消费记录，完成生成后这里会逐步汇总各模型的费用。</EmptyState>
            )}
          </SettingsSection>

          <SettingsSection
            eyebrow="RECENT RECORDS"
            title="最近消费"
            description="保留最近 50 条单次 API 消费记录，方便快速回看和排查。"
          >
            {apiRecords.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border" style={tableWrapperStyle}>
                <div className="overflow-x-auto">
                  <table className={tableClassName}>
                    <colgroup>
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      <tr>
                        <th className={tableHeaderCellClassName}>时间</th>
                        <th className={tableHeaderCellClassName}>模型</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>本次 Tokens</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>本次费用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiRecords.map((entry) => (
                        <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                          <td className={tableTimeCellClassName} style={{ color: 'var(--text-secondary)' }}>
                            {formatDateTime(entry.timestamp)}
                          </td>
                          <td className={tableTextCellClassName}>
                            <div className="min-w-0 break-words font-medium" style={{ color: 'var(--text-primary)' }}>
                              {entry.modelName}
                            </div>
                            <div className="mt-1 break-words text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {entry.providerId || '自定义 API'}
                            </div>
                          </td>
                          <td className={tableNumberCellClassName} style={{ color: 'var(--text-secondary)' }}>
                            {(entry.tokens || 0).toLocaleString('zh-CN')}
                          </td>
                          <td className={`${tableNumberCellClassName} font-semibold`} style={{ color: 'var(--state-success-text)' }}>
                            {formatUsd(entry.amountUsd || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState>暂无 API 消费明细。</EmptyState>
            )}
          </SettingsSection>
        </>
      ) : (
        <>
          <SettingsSection
            eyebrow="CREDIT SUMMARY"
            title="模型总消耗"
            description="按积分模型聚合最近的扣费流水，查看累计积分消耗和调用次数。"
            action={<SettingsBadge tone="neutral">{creditOverview.totalCount} 条流水</SettingsBadge>}
          >
            {creditSummaryRows.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border" style={tableWrapperStyle}>
                <div className="overflow-x-auto">
                  <table className={tableClassName}>
                    <colgroup>
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      <tr>
                        <th className={tableHeaderCellClassName}>模型</th>
                        <th className={tableHeaderCellClassName}>供应商</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>累计扣费</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>调用次数</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>最近时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditSummaryRows.map((item) => (
                        <tr key={item.key} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                          <td className={tableTextCellClassName}>
                            <div className="min-w-0 break-words font-medium" style={{ color: 'var(--text-primary)' }}>
                              {item.modelName}
                            </div>
                          </td>
                          <td className={tableTextCellClassName}>
                            <SettingsBadge tone="neutral">{item.providerId || '系统路由'}</SettingsBadge>
                          </td>
                          <td className={`${tableNumberCellClassName} font-semibold`} style={{ color: 'var(--state-warning-text)' }}>
                            {item.totalCredits.toLocaleString('zh-CN')} 积分
                          </td>
                          <td className={tableNumberCellClassName} style={{ color: 'var(--text-secondary)' }}>
                            {item.totalCount.toLocaleString('zh-CN')}
                          </td>
                          <td className={tableTimeCellClassName} style={{ color: 'var(--text-secondary)' }}>
                            {formatDateTime(item.latestTimestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState>暂无积分消费流水。</EmptyState>
            )}
          </SettingsSection>

          <SettingsSection
            eyebrow="RECENT RECORDS"
            title="最近消费"
            description="按积分流水展示最近一次次扣费，帮助确认最新消耗和模型来源。"
          >
            {creditRecords.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border" style={tableWrapperStyle}>
                <div className="overflow-x-auto">
                  <table className={tableClassName}>
                    <colgroup>
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '34%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead style={{ backgroundColor: 'var(--bg-overlay)' }}>
                      <tr>
                        <th className={tableHeaderCellClassName}>时间</th>
                        <th className={tableHeaderCellClassName}>模型</th>
                        <th className={tableHeaderCellClassName}>说明</th>
                        <th className={`${tableHeaderCellClassName} text-right`}>积分</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditRecords.map((entry) => (
                        <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                          <td className={tableTimeCellClassName} style={{ color: 'var(--text-secondary)' }}>
                            {formatDateTime(entry.timestamp)}
                          </td>
                          <td className={tableTextCellClassName}>
                            <div className="min-w-0 break-words font-medium" style={{ color: 'var(--text-primary)' }}>
                              {entry.modelName}
                            </div>
                            <div className="mt-1 break-words text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {entry.providerId || '系统路由'}
                            </div>
                          </td>
                          <td className={tableTextCellClassName} style={{ color: 'var(--text-secondary)' }}>
                            {entry.description || '系统积分模型消费'}
                          </td>
                          <td className={`${tableNumberCellClassName} font-semibold`} style={{ color: 'var(--state-warning-text)' }}>
                            {Math.abs(Number(entry.credits || 0)).toLocaleString('zh-CN')} 积分
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState>暂无积分消费明细。</EmptyState>
            )}
          </SettingsSection>
        </>
      )}
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
