import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock3,
  Coins,
  DollarSign,
  History,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';

import type { CreditTransactionLog } from '../context/BillingContext';
import { useBilling } from '../context/BillingContext';
import { useLocale } from '../context/LocaleContext';
import {
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
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
import { kkWebApiClient } from '../services/api/kkApiClient';
import { notify } from '../services/system/notificationService';
import useAdminRole from '../hooks/useAdminRole';

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

type RechargeReviewDecision = 'credit' | 'reject';

type AdminRechargeSubmissionView = {
  submission: {
    submissionId: string;
    userId?: string;
    amount: number;
    currencyCode: string;
    paymentChannel: string;
    transferReferenceLast4?: string | null;
    note?: string;
    status: string;
    submittedAt: string;
    reviewedAt?: string | null;
  };
  userId?: string;
  subjectId?: string;
  subjectEmail?: string;
  creditAmount?: number;
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
    aria-pressed={active}
    disabled={active}
    className="rounded-full px-4 py-2 text-sm font-medium transition-all disabled:cursor-default disabled:opacity-100"
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

const formatIsoDateTime = (value?: string | null, locale = 'zh-CN') => {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp)
    ? formatDateTime(timestamp, locale)
    : '--';
};

const getRechargeSubmissionStatusLabel = (
  status: string | null | undefined,
  pick: (zh: string, en: string) => string,
) => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'created':
      return pick('待付款', 'Awaiting payment');
    case 'pending':
      return pick('待核销', 'Pending review');
    case 'credited':
      return pick('已入账', 'Credited');
    case 'rejected':
      return pick('已驳回', 'Rejected');
    default:
      return String(status || '').trim() || pick('未知状态', 'Unknown');
  }
};

const getRechargeSubmissionStatusTone = (
  status: string | null | undefined,
): 'neutral' | 'amber' | 'emerald' | 'rose' => {
  switch (String(status || '').trim().toLowerCase()) {
    case 'created':
      return 'neutral';
    case 'pending':
      return 'amber';
    case 'credited':
      return 'emerald';
    case 'rejected':
      return 'rose';
    default:
      return 'neutral';
  }
};

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
  const { authLoading: adminAuthLoading, checkingAdmin, isAdmin, adminSessionActive } = useAdminRole();
  const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, locale);
  const canManageRechargeSubmissions = isAdmin && adminSessionActive;

  const [activeTab, setActiveTab] = useState<ConsumptionTab>('api');
  const [summaryRows, setSummaryRows] = useState<CostBreakdownItem[]>([]);
  const [recentRows, setRecentRows] = useState<CostEntry[]>([]);
  const [creditModelCount, setCreditModelCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [adminLookupSubmissionId, setAdminLookupSubmissionId] = useState('');
  const [adminLookupLoading, setAdminLookupLoading] = useState(false);
  const [adminReviewLoading, setAdminReviewLoading] = useState<RechargeReviewDecision | null>(null);
  const [adminReviewNote, setAdminReviewNote] = useState('');
  const [adminLookupResult, setAdminLookupResult] = useState<AdminRechargeSubmissionView | null>(null);
  const [adminLookupError, setAdminLookupError] = useState('');

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

  const loadAdminRechargeSubmission = async () => {
    const submissionId = adminLookupSubmissionId.trim();
    if (!submissionId) {
      notify.error(
        pick('请输入账单编号', 'Bill number required'),
        pick('管理员查询前需要先填写账单编号。', 'Enter a bill number before searching.'),
      );
      return;
    }

    setAdminLookupLoading(true);
    setAdminLookupError('');

    try {
      const response = await kkWebApiClient.getAdminRechargeSubmission(submissionId);
      if (!response.success) {
        throw new Error(
          response.error.message || pick('账单查询失败', 'Failed to load the bill.'),
        );
      }

      setAdminLookupResult(response.data as AdminRechargeSubmissionView);
    } catch (error: any) {
      const message = error?.message || pick('账单查询失败', 'Failed to load the bill.');
      setAdminLookupResult(null);
      setAdminLookupError(message);
      notify.error(pick('查询失败', 'Lookup failed'), message);
    } finally {
      setAdminLookupLoading(false);
    }
  };

  const reviewAdminRechargeSubmission = async (decision: RechargeReviewDecision) => {
    const submissionId = String(adminLookupResult?.submission?.submissionId || '').trim();
    if (!submissionId) {
      return;
    }

    setAdminReviewLoading(decision);
    setAdminLookupError('');

    try {
      const response = await kkWebApiClient.reviewRechargeSubmission(submissionId, {
        decision,
      });
      if (!response.success) {
        throw new Error(
          response.error.message || pick('账单操作失败', 'Failed to review the bill.'),
        );
      }

      setAdminLookupResult(response.data as AdminRechargeSubmissionView);
      notify.success(
        decision === 'credit'
          ? pick('核销成功', 'Recharge credited')
          : pick('驳回成功', 'Bill rejected'),
        decision === 'credit'
          ? pick('该账单已完成入账。', 'The selected bill has been credited.')
          : pick('该账单已被驳回。', 'The selected bill has been rejected.'),
      );
      await refreshBilling({ includeTransactions: true });
      setRefreshTick((value) => value + 1);
    } catch (error: any) {
      const message = error?.message || pick('账单操作失败', 'Failed to review the bill.');
      setAdminLookupError(message);
      notify.error(pick('操作失败', 'Review failed'), message);
    } finally {
      setAdminReviewLoading(null);
    }
  };

  const heroMetrics = activeTab === 'api' ? (
    <>
      <SettingsMetricCard
        label={pick('30 \u5929\u82b1\u8d39', '30-Day Spend')}
        value={formatUsd(apiOverview.totalCost, locale)}
        helper={pick('\u6700\u8fd1 30 \u5929 API \u6210\u672c\u3002', 'API spend in the last 30 days.')}
        icon={DollarSign}
        tone="emerald"
      />
      <SettingsMetricCard
        label={pick('\u8bf7\u6c42\u6b21\u6570', 'Request Count')}
        value={formatNumber(apiOverview.totalCount, 0, locale)}
        helper={pick('\u6700\u8fd1 30 \u5929\u8ba1\u8d39\u4e8b\u4ef6\u6570\u3002', 'Billing events in the last 30 days.')}
        icon={History}
        tone="neutral"
      />
      <SettingsMetricCard
        label={pick('\u8bcd\u5143\u603b\u91cf', 'Token Volume')}
        value={formatNumber(apiOverview.totalTokens, 0, locale)}
        helper={pick('\u6700\u8fd1 30 \u5929\u8bcd\u5143\u603b\u91cf\u3002', 'Token volume in the last 30 days.')}
        icon={Layers3}
        tone="indigo"
      />
      <SettingsMetricCard
        label={pick('\u6700\u8fd1\u8ba1\u8d39', 'Latest Charge')}
        value={latestApiRecord ? formatDateTime(latestApiRecord.timestamp, locale) : pick('\u6682\u65e0\u8bb0\u5f55', 'No record')}
        helper={pick('\u6700\u8fd1\u4e00\u6761 API \u8ba1\u8d39\u8bb0\u5f55\u3002', 'Most recent API billing record.')}
        icon={Clock3}
        tone="neutral"
      />
    </>
  ) : (
    <>
      <SettingsMetricCard
        label={pick('\u5f53\u524d\u4f59\u989d', 'Current Balance')}
        value={remainingBalanceDisplay}
        helper={pick('\u5f53\u524d\u53ef\u7528\u79ef\u5206\u3002', 'Credits currently available.')}
        icon={Coins}
        tone="emerald"
      />
      <SettingsMetricCard
        label={pick('\u79ef\u5206\u6a21\u578b\u6570', 'Credit Models')}
        value={formatNumber(creditModelCount, 0, locale)}
        helper={pick('\u5f53\u524d\u542f\u7528\u79ef\u5206\u5b9a\u4ef7\u7684\u6a21\u578b\u6570\u3002', 'Models currently using credit pricing.')}
        icon={Wallet}
        tone="indigo"
      />
      <SettingsMetricCard
        label={pick('\u5df2\u6d88\u8017\u79ef\u5206', 'Credits Consumed')}
        value={formatNumber(creditOverview.totalCredits, 0, locale)}
        helper={pick('\u5f53\u524d\u7d2f\u8ba1\u79ef\u5206\u6d88\u8017\u3002', 'Total recorded credit usage.')}
        icon={History}
        tone="amber"
      />
      <SettingsMetricCard
        label={pick('\u6700\u8fd1\u6263\u51cf', 'Latest Deduction')}
        value={latestCreditRecord ? formatDateTime(latestCreditRecord.timestamp, locale) : pick('\u6682\u65e0\u8bb0\u5f55', 'No record')}
        helper={pick('\u6700\u8fd1\u4e00\u6761\u79ef\u5206\u6263\u51cf\u8bb0\u5f55\u3002', 'Most recent credit deduction record.')}
        icon={Clock3}
        tone="neutral"
      />
    </>
  );

  const content = (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <SettingsHero
          eyebrow={pick('\u9ad8\u7ea7\u8bbe\u7f6e', 'Advanced Settings')}
          title={pick('\u8ba1\u8d39\u4e2d\u5fc3', 'Billing Ledger')}
          description={pick(
            '\u7edf\u4e00\u67e5\u770b API \u82b1\u8d39\u548c\u79ef\u5206\u6d88\u8017\u3002',
            'Review API spend and internal credit usage in one place.'
          )}
          icon={activeTab === 'api' ? DollarSign : Coins}
          tone={activeTab === 'api' ? 'indigo' : 'emerald'}
          badge={(
            <SettingsBadge tone={activeTab === 'api' ? 'amber' : 'emerald'}>
              {activeTab === 'api'
                ? pick('API \u6d88\u8017\u89c6\u56fe', 'API Spend View')
                : pick('\u79ef\u5206\u6d88\u8017\u89c6\u56fe', 'Credit Consumption View')}
            </SettingsBadge>
          )}
          actions={(
            <>
              {!embedded && onBack ? (
                <SettingsActionButton icon={ArrowLeft} onClick={onBack}>
                  {pick('\u8fd4\u56de', 'Back')}
                </SettingsActionButton>
              ) : null}
              <SettingsActionButton
                icon={RefreshCw}
                loading={refreshing}
                onClick={() => void refreshAll()}
              >
                {pick('\u5237\u65b0', 'Refresh')}
              </SettingsActionButton>
            </>
          )}
          metrics={heroMetrics}
        />

        <SettingsSection
          title={pick('\u67e5\u770b\u6a21\u5f0f', 'View mode')}
          eyebrow={pick('\u4e3b\u5de5\u5177', 'Primary tool')}
          description={pick(
            '\u5728 API \u82b1\u8d39\u548c\u79ef\u5206\u8d26\u672c\u4e4b\u95f4\u5207\u6362\u3002',
            'Switch between API spend and the internal credit ledger.'
          )}
          action={<SettingsBadge tone="neutral">{pick('\u7edf\u4e00\u8ba1\u8d39\u754c\u9762', 'Unified Billing Ledger')}</SettingsBadge>}
        >
          <div className="flex flex-wrap gap-2">
            <ConsumptionModeButton
              active={activeTab === 'api'}
              label={pick('API \u6d88\u8017', 'API Spend')}
              onClick={() => setActiveTab('api')}
            />
            <ConsumptionModeButton
              active={activeTab === 'credits'}
              label={pick('\u79ef\u5206\u6d88\u8017', 'Credit Consumption')}
              onClick={() => setActiveTab('credits')}
            />
          </div>
        </SettingsSection>

        <div className="hidden">
          <div className="hidden">
            <div className="hidden">
              {pick('\u9ad8\u7ea7\u8bbe\u7f6e', 'Advanced Settings')}
            </div>
            <h2>{pick('\u8ba1\u8d39\u4e2d\u5fc3', 'Billing Ledger')}</h2>
            <p>
              {pick(
                '这里统一查看 API 账单和积分消耗，界面与仪表盘和 API 页面保持同一套深色控制台结构。通过模式切换，你可以直接比较上游 API 花费和站内积分消耗。',
                'Review direct API spend and internal credit usage from one Apple-style billing ledger with a shared settings surface.'
              )}
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={activeTab === 'api' ? 'amber' : 'emerald'}>
              {activeTab === 'api'
                ? pick('API \u6d88\u8017\u89c6\u56fe', 'API Spend View')
                : pick('\u79ef\u5206\u6d88\u8017\u89c6\u56fe', 'Credit Consumption View')}
            </SettingsBadge>
            {!embedded && onBack ? (
              <SettingsActionButton icon={ArrowLeft} onClick={onBack}>
                {pick('\u8fd4\u56de', 'Back')}
              </SettingsActionButton>
            ) : null}
            <SettingsActionButton
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => void refreshAll()}
            >
              {pick('\u5237\u65b0', 'Refresh')}
            </SettingsActionButton>
          </div>
        </div>

        <section className="hidden">
          <div className="settings-reference-card__header">
            <div>
              <div className="settings-reference-card__eyebrow">
                {pick('\u67e5\u770b\u6a21\u5f0f', 'View Mode')}
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
              {pick('\u7edf\u4e00\u8ba1\u8d39\u754c\u9762', 'Unified Billing Ledger')}
            </SettingsBadge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <ConsumptionModeButton
              active={activeTab === 'api'}
              label={pick('API \u6d88\u8017', 'API Spend')}
              onClick={() => setActiveTab('api')}
            />
            <ConsumptionModeButton
              active={activeTab === 'credits'}
              label={pick('\u79ef\u5206\u6d88\u8017', 'Credit Consumption')}
              onClick={() => setActiveTab('credits')}
            />
          </div>
        </section>

        {activeTab === 'api' ? (
          <>
            <div className="hidden">
              <ConsumptionMetricCard
                label={pick('30 \u5929\u82b1\u8d39', '30-Day Spend')}
                value={formatUsd(apiOverview.totalCost, locale)}
                helper={pick('\u6700\u8fd1 API \u53f0\u8d26\u4e2d\u7d2f\u8ba1\u8bb0\u5f55\u7684\u4e0a\u6e38\u6210\u672c\u3002', 'Aggregated upstream cost captured in the recent API ledger.')}
                badge={<DollarSign size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('\u8bf7\u6c42\u6b21\u6570', 'Request Count')}
                value={formatNumber(apiOverview.totalCount, 0, locale)}
                helper={pick('\u5f53\u524d\u7a97\u53e3\u5185\u8bb0\u5f55\u5230\u7684 API \u8ba1\u8d39\u4e8b\u4ef6\u603b\u6570\u3002', 'Total recorded API charge events in the current window.')}
                badge={<History size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('\u8bcd\u5143\u603b\u91cf', 'Token Volume')}
                value={formatNumber(apiOverview.totalTokens, 0, locale)}
                helper={pick('最近 API 记录中的词元使用总量。', 'Combined token activity across the recent API records.')}
                badge={<Wallet size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('\u6700\u8fd1\u8ba1\u8d39', 'Latest Charge')}
                value={latestApiRecord ? formatDateTime(latestApiRecord.timestamp, locale) : pick('\u6682\u65e0\u8bb0\u5f55', 'No record')}
                helper={pick('本地最近一次写入的 API 计费时间。', 'Timestamp of the latest API billing event written locally.')}
                badge={<Clock3 size={18} className="text-[var(--text-primary)]" />}
              />
            </div>

            // 只有在管理员身份且会话激活（可操作）时才显示核销台，避免在用户账单中多余渲染
            {canManageRechargeSubmissions ? (
              <section className="settings-reference-card settings-reference-card--soft">
                <div className="settings-reference-card__header">
                  <div>
                    <div className="settings-reference-card__eyebrow">
                      {pick('管理员核销', 'Admin review')}
                    </div>
                    <div className="settings-reference-card__title">
                      {pick('静态码账单核销台', 'Static recharge review desk')}
                    </div>
                    <div className="settings-reference-card__meta">
                      {pick(
                        '按账单编号查询充值单，并执行核销或驳回。该入口只在管理员会话激活时可操作。',
                        'Search a recharge bill by bill number, then credit or reject it while the admin session is active.',
                      )}
                    </div>
                  </div>
                  <SettingsBadge tone={canManageRechargeSubmissions ? 'emerald' : 'amber'}>
                    {canManageRechargeSubmissions
                      ? pick('管理员会话已激活', 'Admin session active')
                      : pick('管理员会话未激活', 'Admin session inactive')}
                  </SettingsBadge>
                </div>

                {adminAuthLoading || checkingAdmin ? (
                  <div className="mt-5 rounded-[22px] border px-4 py-4" style={tableWrapperStyle}>
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>{pick('正在检查管理员权限...', 'Checking administrator access...')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="space-y-2">
                        <span className="settings-reference-card__eyebrow">{pick('账单编号', 'Bill number')}</span>
                        <input
                          type="text"
                          value={adminLookupSubmissionId}
                          onChange={(event) => setAdminLookupSubmissionId(event.target.value)}
                          placeholder={pick('输入 submissionId / 账单编号', 'Enter submissionId / bill number')}
                          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                          style={{
                            borderColor: 'var(--settings-input-border)',
                            background: 'var(--settings-input-bg)',
                            color: 'var(--text-primary)',
                          }}
                          disabled={!canManageRechargeSubmissions || adminLookupLoading || adminReviewLoading !== null}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void loadAdminRechargeSubmission()}
                        disabled={!canManageRechargeSubmissions || adminLookupLoading || adminReviewLoading !== null}
                        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                        style={{
                          border: '1px solid var(--settings-button-primary-border, transparent)',
                          background: canManageRechargeSubmissions
                            ? 'var(--settings-button-primary-bg)'
                            : 'var(--settings-button-secondary-bg)',
                          color: canManageRechargeSubmissions
                            ? 'var(--settings-button-primary-text)'
                            : 'var(--settings-button-secondary-text)',
                          boxShadow: canManageRechargeSubmissions
                            ? 'var(--settings-button-primary-shadow)'
                            : 'none',
                        }}
                      >
                        {adminLookupLoading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                        {adminLookupLoading ? pick('查询中...', 'Searching...') : pick('查询账单', 'Lookup bill')}
                      </button>
                    </div>

                    {!canManageRechargeSubmissions ? (
                      <div
                        className="rounded-[22px] border px-4 py-4 text-sm"
                        style={{
                          borderColor: 'var(--settings-state-warning-border)',
                          background: 'var(--settings-state-warning-bg)',
                          color: 'var(--settings-state-warning-text)',
                        }}
                      >
                        {pick(
                          '当前账号已识别为管理员，但管理员会话尚未激活，暂时不能执行核销或驳回。',
                          'This account is an administrator, but the elevated admin session is not active yet.',
                        )}
                      </div>
                    ) : null}

                    {adminLookupError ? (
                      <div
                        className="rounded-[22px] border px-4 py-4 text-sm"
                        style={{
                          borderColor: 'var(--settings-state-danger-border)',
                          background: 'var(--settings-state-danger-bg)',
                          color: 'var(--settings-state-danger-text)',
                        }}
                      >
                        {adminLookupError}
                      </div>
                    ) : null}

                    {adminLookupResult ? (
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                        <section className="rounded-[22px] border p-4" style={tableWrapperStyle}>
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="settings-reference-card__eyebrow">{pick('账单详情', 'Bill details')}</div>
                              <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {adminLookupResult.submission.submissionId}
                              </div>
                            </div>
                            <SettingsBadge tone={getRechargeSubmissionStatusTone(adminLookupResult.submission.status)}>
                              {getRechargeSubmissionStatusLabel(adminLookupResult.submission.status, pick)}
                            </SettingsBadge>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('支付金额', 'Amount')}</div>
                              <div className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {adminLookupResult.submission.currencyCode} {formatNumber(adminLookupResult.submission.amount, 2, locale)}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('预计到账积分', 'Credit amount')}</div>
                              <div className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {formatNumber(Number(adminLookupResult.creditAmount || 0), 0, locale)}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('支付渠道', 'Channel')}</div>
                              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                                {adminLookupResult.submission.paymentChannel}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('流水尾号', 'Transfer tail')}</div>
                              <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {adminLookupResult.submission.transferReferenceLast4 || '--'}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('提交时间', 'Submitted at')}</div>
                              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                                {formatIsoDateTime(adminLookupResult.submission.submittedAt, locale)}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('复核时间', 'Reviewed at')}</div>
                              <div className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                                {formatIsoDateTime(adminLookupResult.submission.reviewedAt, locale)}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3 md:col-span-2" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('用户标识', 'User identity')}</div>
                              <div className="mt-1 break-all text-sm" style={{ color: 'var(--text-primary)' }}>
                                {adminLookupResult.subjectEmail || adminLookupResult.userId || adminLookupResult.submission.userId || '--'}
                              </div>
                            </div>
                            <div className="rounded-xl border p-3 md:col-span-2" style={{ borderColor: 'var(--settings-border-subtle)' }}>
                              <div className="settings-reference-card__eyebrow">{pick('备注', 'Note')}</div>
                              <div className="mt-1 break-words text-sm" style={{ color: 'var(--text-primary)' }}>
                                {adminLookupResult.submission.note || pick('无备注', 'No note')}
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-[22px] border p-4" style={tableWrapperStyle}>
                          <div className="mb-4 flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-xl border"
                              style={{
                                borderColor: 'var(--settings-state-info-border)',
                                background: 'var(--settings-state-info-bg)',
                                color: 'var(--settings-state-info-text)',
                              }}
                            >
                              <ShieldCheck size={16} />
                            </div>
                            <div>
                              <div className="settings-reference-card__title">{pick('管理员操作', 'Admin actions')}</div>
                              <div className="settings-reference-card__meta">
                                {pick(
                                  '核销会立即写积分账本；驳回不会变更余额。',
                                  'Credit writes the ledger immediately; reject leaves the balance unchanged.',
                                )}
                              </div>
                            </div>
                          </div>

                          <label className="space-y-2">
                            <span className="settings-reference-card__eyebrow">{pick('复核备注', 'Review note')}</span>
                            <textarea
                              value={adminReviewNote}
                              onChange={(event) => setAdminReviewNote(event.target.value)}
                              placeholder={pick('可选：补充核销说明或驳回原因', 'Optional note for credit or rejection')}
                              className="min-h-[120px] w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                              style={{
                                borderColor: 'var(--settings-input-border)',
                                background: 'var(--settings-input-bg)',
                                color: 'var(--text-primary)',
                                resize: 'vertical',
                              }}
                              disabled={adminReviewLoading !== null}
                            />
                          </label>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => void reviewAdminRechargeSubmission('credit')}
                              disabled={
                                adminReviewLoading !== null
                                || !canManageRechargeSubmissions
                                || adminLookupResult.submission.status === 'credited'
                                || adminLookupResult.submission.status === 'rejected'
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition"
                              style={{
                                border: '1px solid var(--settings-state-success-border)',
                                background: 'var(--settings-state-success-bg)',
                                color: 'var(--settings-state-success-text)',
                              }}
                            >
                              {adminReviewLoading === 'credit'
                                ? <RefreshCw size={15} className="animate-spin" />
                                : <ShieldCheck size={15} />}
                              {pick('核销充值', 'Credit recharge')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void reviewAdminRechargeSubmission('reject')}
                              disabled={
                                adminReviewLoading !== null
                                || !canManageRechargeSubmissions
                                || adminLookupResult.submission.status === 'credited'
                                || adminLookupResult.submission.status === 'rejected'
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition"
                              style={{
                                border: '1px solid var(--settings-state-danger-border)',
                                background: 'var(--settings-state-danger-bg)',
                                color: 'var(--settings-state-danger-text)',
                              }}
                            >
                              {adminReviewLoading === 'reject'
                                ? <RefreshCw size={15} className="animate-spin" />
                                : <XCircle size={15} />}
                              {pick('驳回账单', 'Reject bill')}
                            </button>
                          </div>
                        </section>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            ) : null}

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
            <div className="hidden">
              <ConsumptionMetricCard
                label={pick('\u5f53\u524d\u4f59\u989d', 'Current Balance')}
                value={remainingBalanceDisplay}
                helper={pick('\u5f53\u524d\u5de5\u4f5c\u533a\u53ef\u7acb\u5373\u4f7f\u7528\u7684\u79ef\u5206\u3002', 'Credits immediately available to the current workspace.')}
                badge={<Coins size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('\u79ef\u5206\u6a21\u578b\u6570', 'Credit Models')}
                value={formatNumber(creditModelCount, 0, locale)}
                helper={pick('\u5f53\u524d\u53ef\u53c2\u4e0e\u8c03\u5ea6\u4e14\u542f\u7528\u4e86\u79ef\u5206\u5b9a\u4ef7\u7684\u6a21\u578b\u6570\u91cf\u3002', 'Pricing-enabled admin models currently available for dispatch.')}
                badge={<Wallet size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('\u5df2\u6d88\u8017\u79ef\u5206', 'Credits Consumed')}
                value={formatNumber(creditOverview.totalCredits, 0, locale)}
                helper={pick('\u5f53\u524d\u79ef\u5206\u6d88\u8017\u53f0\u8d26\u4e2d\u7684\u7d2f\u8ba1\u7528\u91cf\u3002', 'Total credit usage across the recorded consumption ledger.')}
                badge={<History size={18} className="text-[var(--text-primary)]" />}
              />
              <ConsumptionMetricCard
                label={pick('\u6700\u8fd1\u6263\u51cf', 'Latest Deduction')}
                value={
                  latestCreditRecord
                    ? formatDateTime(latestCreditRecord.timestamp, locale)
                    : pick('\u6682\u65e0\u8bb0\u5f55', 'No record')
                }
                helper={pick('\u6700\u8fd1\u4e00\u6b21\u5199\u5165\u65e5\u5fd7\u7684\u79ef\u5206\u6263\u51cf\u65f6\u95f4\u3002', 'Most recent credit-consumption event written to the log.')}
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
