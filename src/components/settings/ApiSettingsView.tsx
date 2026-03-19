
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shuffle,
  Trash2,
  XCircle,
} from 'lucide-react';
import keyManager, {
  autoDetectAndConfigureModels,
  type KeySlot,
  type ThirdPartyProvider,
} from '../../services/auth/keyManager';
import {
  buildProviderPricingSnapshot,
  type ProviderPricingSnapshot,
} from '../../services/auth/providerPricingSnapshot';
import { formatAuthorizationHeaderValue, type ApiProtocolFormat } from '../../services/api/apiConfig';
import { resolveProviderRuntime, type ProviderRuntime } from '../../services/api/providerStrategy';
import {
  extractWuyinAsyncEndpointDetails,
  extractWuyinModelIdFromBaseUrl,
  fetchRawPricingCatalog,
  fetchWuyinPricingCatalog,
  selectWuyinCatalogModels,
} from '../../services/billing/newApiPricingService';
import { supplierService, type Supplier as LegacySupplier } from '../../services/billing/supplierService';
import { notify } from '../../services/system/notificationService';
import { mergeModelPricingOverrides } from '../../services/model/modelPricing';
import { SettingsDangerZone } from './SettingsScaffold';
type CostMode = 'unlimited' | 'amount' | 'tokens';

type OfficialForm = {
  id?: string;
  name: string;
  key: string;
  costMode: CostMode;
  costValue: number;
};

type ProviderForm = {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  format: ApiProtocolFormat;
  group: string;
  costMode: CostMode;
  costValue: number;
  providerColor: string;
  isActive: boolean;
};

type AdvancedResult = {
  models: string[];
  apiType: string;
  pricingHint: string;
  fetchedAt: number;
  pricingData?: any[];
  groupRatio?: Record<string, number>;
  availableGroups?: string[];
};

type GroupPriceValue = {
  modelRatio?: number;
  completionRatio?: number;
  modelPrice?: number;
};

type AdvancedPricingRow = {
  model: string;
  provider?: string;
  providerLabel?: string;
  tokenGroup?: string;
  billingType?: string;
  quotaType?: number | string;
  basePrice?: number;
  modelRatio?: number;
  completionRatio?: number;
  inputPrice?: number;
  outputPrice?: number;
  cacheReadPrice?: number;
  cacheCreationPrice?: number;
  perRequestPrice?: number;
  groupRatio?: number;
  currency?: string;
  billingUnit?: string;
  displayPrice?: string;
  sizeRatioMap: Record<string, number>;
  groupModelRatioMap: Record<string, number>;
  groupSizeRatioMap: Record<string, Record<string, number>>;
  groupPriceMap: Record<string, GroupPriceValue>;
};

type ManualPricingRow = {
  id: string;
  model: string;
  modelName: string;
  endpointUrl?: string;
  price: string;
  unit: string;
  currency: 'CNY' | 'USD';
};

type SelectOption = {
  value: string;
  label: string;
};

type StatusTone = 'green' | 'amber' | 'red' | 'slate' | 'indigo' | 'sky';

type StatusMeta = {
  label: string;
  tone: StatusTone;
  helper: string;
};

type ProviderWorkbenchMode = 'pricing-sync' | 'model-detect' | 'endpoint-model';
type ApiWorkspaceMode = 'third-party' | 'official';

type ProviderActivitySummaryView = {
  text: string;
  updatedAtLabel: string;
};

const defaultOfficialForm: OfficialForm = {
  name: '',
  key: '',
  costMode: 'unlimited',
  costValue: 0,
};

const defaultProviderForm: ProviderForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  format: 'auto',
  group: '',
  costMode: 'unlimited',
  costValue: 0,
  providerColor: '#3B82F6',
  isActive: true,
};

const LEGACY_API_SETTINGS_MIGRATION_KEY = 'kk_api_settings_legacy_migration_v1';

const normalizeProviderSignaturePart = (value: string): string =>
  value.trim().replace(/\/+$/, '').toLowerCase();

const buildProviderSignature = (baseUrl: string, apiKey: string): string =>
  `${normalizeProviderSignaturePart(baseUrl)}|${apiKey.trim()}`;

const providerColorPalette = [
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#EC4899',
  '#F43F5E',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
];

const elevatedPanelStyle = {
  backgroundColor: 'var(--settings-surface-elevated)',
} as const;

const overlayPanelStyle = {
  backgroundColor: 'var(--settings-surface-overlay)',
} as const;

const sectionPanelStyle = {
  backgroundColor: 'var(--settings-section-bg)',
} as const;

const headerPanelStyle = {
  backgroundColor: 'var(--settings-shell-header-bg)',
} as const;

const formFieldStyle = {
  borderColor: 'var(--settings-input-border)',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--settings-input-bg)',
} as const;

const secondaryButtonStyle = {
  borderColor: 'transparent',
  color: 'var(--settings-button-secondary-text)',
  backgroundColor: 'var(--settings-button-secondary-bg)',
} as const;

const statusToneStyles: Record<StatusTone, { borderColor: string; backgroundColor: string; color: string }> = {
  green: {
    borderColor: 'var(--state-success-border)',
    backgroundColor: 'var(--state-success-bg)',
    color: 'var(--state-success-text)',
  },
  amber: {
    borderColor: 'var(--state-warning-border)',
    backgroundColor: 'var(--state-warning-bg)',
    color: 'var(--state-warning-text)',
  },
  red: {
    borderColor: 'var(--state-danger-border)',
    backgroundColor: 'var(--state-danger-bg)',
    color: 'var(--state-danger-text)',
  },
  slate: {
    borderColor: 'transparent',
    backgroundColor: 'var(--settings-surface-elevated)',
    color: 'var(--text-secondary)',
  },
  indigo: {
    borderColor: 'var(--state-info-border)',
    backgroundColor: 'var(--state-info-bg)',
    color: 'var(--state-info-text)',
  },
  sky: {
    borderColor: 'var(--state-info-border)',
    backgroundColor: 'var(--state-info-bg)',
    color: 'var(--state-info-text)',
  },
};

const MANUAL_PRICING_SOURCE = 'manual';

const hasNonManualPricingData = (pricingData: any[] = []) =>
  pricingData.some((item) => String(item?.source || '').trim().toLowerCase() !== MANUAL_PRICING_SOURCE);

const snapshotHasAutoPricingRows = (snapshot?: ProviderPricingSnapshot | null) => {
  if (Array.isArray(snapshot?._rawData) && hasNonManualPricingData(snapshot._rawData)) {
    return true;
  }

  return Boolean(
    snapshot?.rows?.some((row) => String(row.providerLabel || '').trim() !== '手动维护')
  );
};

const resolveProviderWorkbenchMode = (
  runtime: Pick<ProviderRuntime, 'pricingSupport' | 'strategyId'>,
  options: {
    endpointModelId?: string | null;
    hasAutoPricing?: boolean;
    isCatalogMode?: boolean;
  } = {}
): ProviderWorkbenchMode => {
  if (options.endpointModelId) {
    return 'endpoint-model';
  }

  if (options.isCatalogMode) {
    return 'pricing-sync';
  }

  if (runtime.strategyId === '12ai') {
    return 'pricing-sync';
  }

  if (options.hasAutoPricing || runtime.pricingSupport === 'native') {
    return 'pricing-sync';
  }

  return 'model-detect';
};

const providerWorkbenchCopy: Record<ProviderWorkbenchMode, { label: string; helper: string; tone: StatusTone }> = {
  'pricing-sync': {
    label: '价格可抓取',
    helper: '先同步价格，再检查模型和预算。',
    tone: 'green',
  },
  'model-detect': {
    label: '模型识别型',
    helper: '先识别模型，再手动维护价格。',
    tone: 'sky',
  },
  'endpoint-model': {
    label: '接口识别型',
    helper: '模型由接口地址决定，直接维护接口单价。',
    tone: 'amber',
  },
};

const getProviderWorkbenchMeta = (
  mode: ProviderWorkbenchMode,
  options: { isCatalogMode?: boolean; manualPricingOnly?: boolean } = {}
): { label: string; helper: string; tone: StatusTone } => {
  if (options.isCatalogMode && mode === 'pricing-sync') {
    return {
      label: '目录可读取',
      helper: '先读取目录价格，再补充具体接口单价。',
      tone: 'sky',
    };
  }

  if (options.manualPricingOnly && mode === 'pricing-sync') {
    return {
      label: '价格需校准',
      helper: '该供应商没有兼容的价格扫描接口，请以现有价格快照或手动维护结果为准。',
      tone: 'amber',
    };
  }

  return providerWorkbenchCopy[mode];
};

const createManualPricingRowId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeProviderColor = (value?: string) => String(value || '').trim().toUpperCase();

const pickRandomProviderColor = (usedColors: string[] = [], currentColor?: string) => {
  const normalizedUsed = usedColors.map((color) => normalizeProviderColor(color));
  const normalizedCurrent = normalizeProviderColor(currentColor);
  const preferred = providerColorPalette.filter((color) => !normalizedUsed.includes(normalizeProviderColor(color)));
  const fallback = providerColorPalette.filter((color) => normalizeProviderColor(color) !== normalizedCurrent);
  const candidates = preferred.length > 0 ? preferred : (fallback.length > 0 ? fallback : providerColorPalette);
  return candidates[Math.floor(Math.random() * candidates.length)] || providerColorPalette[0];
};

const collectProviderColors = (providers: ThirdPartyProvider[], excludeProviderId?: string) =>
  providers
    .filter((provider) => provider.id !== excludeProviderId)
    .map((provider) => provider.providerColor || provider.badgeColor || '')
    .filter(Boolean);

const FormSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}> = ({ value, onChange, options, disabled = false }) => (
  <div className="relative">
    <select
      className="h-10 w-full appearance-none rounded-[10px] bg-transparent pl-3 pr-10 text-sm outline-none"
      style={formFieldStyle}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--settings-input-bg)', color: 'var(--text-primary)' }}>
          {option.label}
        </option>
      ))}
    </select>
    <span className="pointer-events-none absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)]">
      <ChevronDown size={16} />
    </span>
  </div>
);

const ActionButtonIcon: React.FC<{
  children: React.ReactNode;
  compact?: boolean;
}> = ({ children, compact = false }) => (
  <span
    aria-hidden="true"
    className={`settings-button-icon-slot ${compact ? 'settings-button-icon-slot--sm' : ''}`.trim()}
  >
    {children}
  </span>
);

const StatusBadge: React.FC<{
  label: string;
  tone: StatusTone;
  helper?: string;
  compact?: boolean;
}> = ({ label, tone, helper, compact = false }) => (
  <span
    className={`api-settings-status-badge inline-flex max-w-full min-w-0 gap-1 rounded-full border font-medium text-left leading-[1.35] ${compact ? 'items-center px-2.5 py-1 text-[11px] sm:whitespace-nowrap' : 'flex-wrap items-start px-3 py-1.5 text-xs'}`}
    style={statusToneStyles[tone]}
  >
    <span>{label}</span>
    {helper ? <span className={`${compact ? 'hidden' : 'inline'} opacity-75`}>· {helper}</span> : null}
  </span>
);

const toProviderForm = (provider?: ThirdPartyProvider): ProviderForm => {
  if (!provider) return defaultProviderForm;

  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    format: provider.format || 'auto',
    group: provider.group || '',
    costMode: (provider.customCostMode as CostMode | undefined) || 'unlimited',
    costValue: Number(provider.customCostValue || 0),
    providerColor: provider.providerColor || provider.badgeColor || '#3B82F6',
    isActive: provider.isActive,
  };
};

const formatDate = (ts?: number) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
};

const formatCompactLatency = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '耗时未记录';
  }

  if (value < 1000) {
    return `耗时 ${Math.round(value)}ms`;
  }

  const seconds = value / 1000;
  return `耗时 ${seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1))}s`;
};

const formatCompactTokens = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  if (value >= 1_000_000) {
    return `令牌 ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `令牌 ${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return `令牌 ${Math.round(value)}`;
};

const formatCompactAmount = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return `金额 ${formatMoneyDisplay(value, '', 'USD') || `$${value.toFixed(2)}`}`;
};

const buildProviderActivitySummary = (provider: ThirdPartyProvider): ProviderActivitySummaryView => {
  const latencyLabel = formatCompactLatency(provider.activitySummary?.lastLatencyMs);
  const tokensLabel = formatCompactTokens(
    provider.activitySummary?.lastTokens ?? (provider.usage?.totalTokens > 0 ? provider.usage.totalTokens : null)
  );
  const amountLabel = formatCompactAmount(
    provider.activitySummary?.lastAmount ?? (provider.usage?.totalCost > 0 ? provider.usage.totalCost : null)
  );

  let text = latencyLabel;
  if (tokensLabel && amountLabel) {
    text = `${latencyLabel} / ${tokensLabel} / ${amountLabel}`;
  } else if (!tokensLabel && amountLabel) {
    text = `${latencyLabel} / ${amountLabel}`;
  } else if (tokensLabel && !amountLabel) {
    text = `${latencyLabel} / ${tokensLabel} / 金额未获取`;
  } else {
    text = `${latencyLabel} / 令牌金额未获取`;
  }

  const updatedAt =
    provider.activitySummary?.updatedAt ||
    provider.pricingSnapshot?.fetchedAt ||
    provider.lastChecked ||
    provider.updatedAt;

  return {
    text,
    updatedAtLabel: updatedAt ? `更新于 ${formatDate(updatedAt)}` : '暂无运行记录',
  };
};

const buildOfficialAutoName = (indexHint = 1) => `官方接口 ${Math.max(1, indexHint)}`;

const buildUpdatedProviderActivitySummary = (
  provider: ThirdPartyProvider,
  patch: Partial<NonNullable<ThirdPartyProvider['activitySummary']>> = {}
) => ({
  lastLatencyMs:
    patch.lastLatencyMs ??
    provider.activitySummary?.lastLatencyMs ??
    null,
  lastTokens:
    patch.lastTokens ??
    provider.activitySummary?.lastTokens ??
    (provider.usage?.totalTokens > 0 ? provider.usage.totalTokens : null),
  lastAmount:
    patch.lastAmount ??
    provider.activitySummary?.lastAmount ??
    (provider.usage?.totalCost > 0 ? provider.usage.totalCost : null),
  updatedAt: patch.updatedAt ?? Date.now(),
});

// Helper to format budget info for provider cards
const formatBudgetInfo = (provider: ThirdPartyProvider) => {
  const mode = provider.customCostMode || 'unlimited';
  
  if (mode === 'unlimited') {
    return {
      total: '∞',
      used: provider.usage?.totalCost ? `¥${provider.usage.totalCost.toFixed(2)}` : '¥0.00',
      remaining: '∞',
      unit: '',
    };
  }
  
  if (mode === 'amount') {
    const total = provider.budgetLimit || provider.customCostValue || 0;
    const used = provider.usage?.totalCost || 0;
    const remaining = Math.max(0, total - used);
    return {
      total: `¥${total.toFixed(2)}`,
      used: `¥${used.toFixed(2)}`,
      remaining: remaining > 0 ? `¥${remaining.toFixed(2)}` : '¥0.00',
      unit: '元',
    };
  }
  
  // mode === 'tokens'
  const total = provider.tokenLimit || provider.customCostValue || 0;
  const used = provider.usage?.totalTokens || 0;
  const remaining = Math.max(0, total - used);
  return {
    total: total.toLocaleString(),
    used: used.toLocaleString(),
    remaining: remaining > 0 ? remaining.toLocaleString() : '0',
    unit: 'tokens',
  };
};

const resolveCostModeFromLimits = (budgetLimit?: number, tokenLimit?: number): CostMode => {
  if ((tokenLimit || 0) > 0) return 'tokens';
  if ((budgetLimit || 0) > 0) return 'amount';
  return 'unlimited';
};

const formatOfficialBudgetInfo = (
  slot?: Pick<KeySlot, 'budgetLimit' | 'tokenLimit' | 'usedTokens' | 'totalCost'> | null
) => {
  const mode = resolveCostModeFromLimits(slot?.budgetLimit, slot?.tokenLimit);

  if (mode === 'unlimited') {
    return {
      mode,
      total: '∞',
      used: `¥${(slot?.totalCost || 0).toFixed(2)}`,
      remaining: '∞',
      unit: '',
    };
  }

  if (mode === 'amount') {
    const total = slot?.budgetLimit || 0;
    const used = slot?.totalCost || 0;
    const remaining = Math.max(0, total - used);
    return {
      mode,
      total: `¥${total.toFixed(2)}`,
      used: `¥${used.toFixed(2)}`,
      remaining: `¥${remaining.toFixed(2)}`,
      unit: '元',
    };
  }

  const total = slot?.tokenLimit || 0;
  const used = slot?.usedTokens || 0;
  const remaining = Math.max(0, total - used);
  return {
    mode,
    total: total.toLocaleString('zh-CN'),
    used: used.toLocaleString('zh-CN'),
    remaining: remaining.toLocaleString('zh-CN'),
    unit: 'tokens',
  };
};

const isBudgetDepleted = (value?: string | null) => value === '¥0.00' || value === '0';

const providerHasPricingSnapshot = (provider?: Pick<ThirdPartyProvider, 'pricingSnapshot'> | null) =>
  Boolean(provider?.pricingSnapshot?.rows?.length);

const isWuyinProvider = (baseUrl?: string) =>
  resolveProviderRuntime({ baseUrl, format: 'openai' }).strategyId === 'wuyinkeji';

const isWuyinCatalogProvider = (baseUrl?: string) =>
  isWuyinProvider(baseUrl) && !extractWuyinModelIdFromBaseUrl(baseUrl || '');

const getProviderStatusMeta = (
  provider?: ThirdPartyProvider | null,
  options: { hasPricingSnapshot?: boolean } = {}
): StatusMeta => {
  const hasPricingSnapshot = options.hasPricingSnapshot ?? providerHasPricingSnapshot(provider);

  if (!provider) {
    return hasPricingSnapshot
      ? { label: '待保存', tone: 'indigo', helper: '价格快照已准备好' }
      : { label: '草稿中', tone: 'indigo', helper: '保存后进入供应商队列' };
  }

  if (!provider.isActive) {
    return { label: '已停用', tone: 'slate', helper: '当前不会参与调度' };
  }

  const isCatalogOnlyProvider = isWuyinCatalogProvider(provider.baseUrl);

  if (provider.status === 'error') {
    return {
      label: '异常',
      tone: 'red',
      helper: isCatalogOnlyProvider
        ? (provider.lastError ? '最近一次目录读取失败' : '请重新检查目录地址或 API 密钥')
        : (provider.lastError ? '最近一次校验失败' : '需要重新检查连接'),
    };
  }

  if (provider.status === 'checking') {
    return {
      label: isCatalogOnlyProvider ? '读取中' : '校验中',
      tone: 'sky',
      helper: isCatalogOnlyProvider ? '正在读取产品目录' : '正在同步模型状态',
    };
  }

  if (!hasPricingSnapshot) {
    return {
      label: isCatalogOnlyProvider ? '待配置' : '待同步',
      tone: 'amber',
      helper: isCatalogOnlyProvider ? '目录型供应商需要先维护模型价格' : '建议拉取价格快照',
    };
  }

  return {
    label: '已就绪',
    tone: 'green',
    helper: isCatalogOnlyProvider ? '目录与手动价格已齐备' : '连接、模型与价格已齐备',
  };
};

interface ApiSettingsViewProps {
  initialSupplier?: LegacySupplier | null;
}

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatMultiplier = (value: unknown, currency = '', suffix = '') => {
  const num = toFiniteNumber(value);
  if (num === undefined) return null;
  if (currency === 'CNY') {
    return `¥${num.toFixed(num >= 1 ? 2 : 3)}${suffix}`;
  }
  return `$${num.toFixed(4)}${suffix}`;
  return num === undefined ? '-' : `×${num}`;
};

const normalizeRatioMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, raw]) => {
    const num = toFiniteNumber(raw);
    if (num !== undefined) {
      acc[String(key)] = num;
    }
    return acc;
  }, {});
};

const normalizeNestedRatioMap = (value: unknown): Record<string, Record<string, number>> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, Record<string, number>>>((acc, [key, raw]) => {
    const ratioMap = normalizeRatioMap(raw);
    if (Object.keys(ratioMap).length > 0) {
      acc[String(key)] = ratioMap;
    }
    return acc;
  }, {});
};

const normalizeGroupPriceMap = (value: unknown): Record<string, GroupPriceValue> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, GroupPriceValue>>((acc, [key, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return acc;
    const item = raw as Record<string, unknown>;
    const modelRatio = toFiniteNumber(item.modelRatio ?? item.model_ratio);
    const completionRatio = toFiniteNumber(item.completionRatio ?? item.completion_ratio);
    const modelPrice = toFiniteNumber(item.modelPrice ?? item.model_price ?? item.price);

    if (modelRatio !== undefined || completionRatio !== undefined || modelPrice !== undefined) {
      acc[String(key)] = { modelRatio, completionRatio, modelPrice };
    }

    return acc;
  }, {});
};

const formatPricingAmount = (value: unknown, suffix = '', currency = 'USD') => {
  const num = toFiniteNumber(value);
  return num === undefined ? null : `¥${num.toFixed(4)}${suffix}`;
};

const formatMoneyDisplay = (value: unknown, suffix = '', currency = 'USD') => {
  const num = toFiniteNumber(value);
  if (num === undefined) return null;
  if (currency === 'CNY') {
    return `¥${num.toFixed(num >= 1 ? 2 : 3)}${suffix}`;
  }
  return `$${num.toFixed(4)}${suffix}`;
};

const formatRatioDisplay = (value: unknown) => {
  const num = toFiniteNumber(value);
  return num === undefined ? '-' : `×${num}`;
};

const resolveBillingLabel = (billingType?: string, quotaType?: number | string, perRequestPrice?: number) => {
  const normalized = String(billingType || '').trim().toLowerCase();
  if (
    normalized.includes('request') ||
    normalized.includes('per_request') ||
    normalized.includes('image') ||
    quotaType === 1 ||
    quotaType === 'per_request' ||
    perRequestPrice !== undefined
  ) {
    return '按次';
  }
  return '按量';
};

const sortRatioEntries = (ratioMap: Record<string, number>) =>
  Object.entries(ratioMap).sort(([left], [right]) => {
    if (left === '1K') return -1;
    if (right === '1K') return 1;
    if (left === '4K') return 1;
    if (right === '4K') return -1;
    return left.localeCompare(right, 'zh-CN');
  });

const restorePricingDataFromSnapshot = (snapshot?: ProviderPricingSnapshot) => {
  if (!snapshot) return undefined;
  if (Array.isArray(snapshot._rawData) && snapshot._rawData.length > 0) {
    return snapshot._rawData;
  }

  if (!Array.isArray(snapshot.rows) || snapshot.rows.length === 0) {
    return undefined;
  }

  return snapshot.rows
    .map((item) => {
      const model = String(item.model || '').trim();
      if (!model) return null;
      return {
        model,
        provider: item.provider,
        provider_label: item.providerLabel,
        provider_logo: item.providerLogo,
        tags: item.tags,
        token_group: item.tokenGroup,
        billing_type: item.billingType,
        endpoint_type: item.endpointType,
        endpoint_url: item.endpointUrl,
        endpoint_path: item.endpointPath,
        model_name: model,
        model_ratio: item.modelRatio,
        model_price: item.modelPrice,
        per_request_price: item.perRequestPrice,
        currency: item.currency,
        pay_unit: item.billingUnit,
        display_price: item.displayPrice,
        completion_ratio: item.completionRatio,
        quota_type: item.quotaType,
        size_ratio: item.sizeRatio,
        group_model_ratio: item.groupModelRatio,
        group_size_ratio: item.groupSizeRatio,
        group_model_price: item.groupModelPrice,
      };
    })
    .filter(Boolean);
};

const guessManualBillingUnit = (modelId?: string) => {
  const normalized = String(modelId || '').trim().toLowerCase();
  if (!normalized) return '张';
  if (normalized.includes('video') || normalized.includes('digital_humans')) return '秒';
  if (normalized.includes('audio') || normalized.includes('tts') || normalized.includes('voice')) return '次';
  return '张';
};

const createManualPricingRow = (initial: Partial<ManualPricingRow> = {}): ManualPricingRow => {
  const endpointUrl = String(initial.endpointUrl || '').trim();
  const endpoint = endpointUrl ? extractWuyinAsyncEndpointDetails(endpointUrl) : null;
  const model = String(initial.model || endpoint?.modelId || '').trim();
  return {
    id: initial.id || createManualPricingRowId(),
    model,
    modelName: String(initial.modelName || model).trim(),
    endpointUrl: endpoint?.endpointUrl || endpointUrl || undefined,
    price: String(initial.price ?? '').trim(),
    unit: String(initial.unit || guessManualBillingUnit(model)).trim() || '张',
    currency: initial.currency === 'USD' ? 'USD' : 'CNY',
  };
};

const getPricingModelId = (item: any) => String(item?.model || item?.model_name || '').trim();

const formatPerRequestDisplay = (value: unknown, unit: string, currency = 'USD') => {
  const num = toFiniteNumber(value);
  if (num === undefined) return null;
  if (currency === 'CNY') {
    return `${Number(num.toFixed(6))}元/${unit}`;
  }
  return formatMoneyDisplay(num, `/${unit}`, currency) || `${num}/${unit}`;
};

const extractPricingModelIds = (pricingData: any[] = []) =>
  Array.from(
    new Set(
      pricingData
        .map((item) => getPricingModelId(item))
        .filter(Boolean)
    )
  );

const buildManualPricingEntry = (row: ManualPricingRow) => {
  const endpoint = row.endpointUrl ? extractWuyinAsyncEndpointDetails(row.endpointUrl) : null;
  const model = String(row.model || endpoint?.modelId || '').trim();
  const price = toFiniteNumber(row.price);
  if (!model || price === undefined) return null;

  const unit = String(row.unit || guessManualBillingUnit(model)).trim() || '次';
  const currency = row.currency || 'CNY';
  const displayPrice = formatPerRequestDisplay(price, unit, currency) || `${price}/${unit}`;

  return {
    source: MANUAL_PRICING_SOURCE,
    provider: 'manual',
    provider_label: '手动维护',
    model,
    model_name: String(row.modelName || model).trim() || model,
    billing_type: 'per_request',
    quota_type: 'per_request',
    per_request_price: price,
    model_price: price,
    price_per_image: price,
    currency,
    pay_unit: unit,
    display_price: displayPrice,
    endpoint_url: endpoint?.endpointUrl || row.endpointUrl,
    endpoint_path: endpoint?.endpointPath,
  };
};

const extractManualPricingRowsFromSnapshot = (snapshot?: ProviderPricingSnapshot): ManualPricingRow[] => {
  const restored = restorePricingDataFromSnapshot(snapshot);
  if (!Array.isArray(restored) || restored.length === 0) return [];

  return restored
    .filter((item) => {
      const source = String(item?.source || '').trim().toLowerCase();
      const providerLabel = String(item?.provider_label || '').trim();
      return source === MANUAL_PRICING_SOURCE || providerLabel === '手动维护';
    })
    .map((item) =>
      createManualPricingRow({
        model: getPricingModelId(item),
        modelName: String(item?.model_name || item?.model || '').trim(),
        endpointUrl: String(item?.endpoint_url || item?.endpointUrl || '').trim(),
        price: String(item?.per_request_price ?? item?.model_price ?? item?.price_per_image ?? ''),
        unit: String(item?.pay_unit || item?.billing_unit || '').trim(),
        currency: item?.currency === 'USD' ? 'USD' : 'CNY',
      })
    )
    .filter((item) => !!item.model);
};

const mergePricingDataByModel = (pricingData: any[] = []) => {
  const merged = new Map<string, any>();

  pricingData.forEach((item) => {
    const model = getPricingModelId(item);
    if (!model) return;
    merged.set(model.toLowerCase(), {
      ...merged.get(model.toLowerCase()),
      ...item,
      model,
      model_name: String(item?.model_name || model).trim() || model,
    });
  });

  return Array.from(merged.values());
};

const costModeText: Record<CostMode, string> = {
  unlimited: '无限',
  amount: '金额',
  tokens: 'Tokens',
};

const getDefaultGroupRatio = (groupRatio?: Record<string, number>) => {
  if (!groupRatio) return 1;
  return (
    groupRatio.default ??
    groupRatio.Default ??
    groupRatio.DEFAULT ??
    Object.values(groupRatio).find((value) => Number.isFinite(value)) ??
    1
  );
};

const isNoGroupProvider = (baseUrl?: string) => isWuyinProvider(baseUrl);

const extractAvailableGroups = (pricingData?: any[], groupRatio?: Record<string, number>, baseUrl?: string) => {
  if (isNoGroupProvider(baseUrl)) return [];
  const groups = new Set<string>();

  Object.keys(groupRatio || {}).forEach((group) => {
    if (group) groups.add(String(group).trim());
  });

  for (const item of Array.isArray(pricingData) ? pricingData : []) {
    const enableGroups = Array.isArray(item?.enable_groups) ? item.enable_groups : [];
    enableGroups.forEach((group: unknown) => {
      const value = String(group || '').trim();
      if (value) groups.add(value);
    });

    const nestedGroupMaps = [
      item?.group_size_ratio,
      item?.group_model_price,
      item?.group_model_ratio,
    ];

    nestedGroupMaps.forEach((groupMap) => {
      if (!groupMap || typeof groupMap !== 'object' || Array.isArray(groupMap)) return;
      Object.keys(groupMap).forEach((group) => {
        const value = String(group || '').trim();
        if (value) groups.add(value);
      });
    });
  }

  return Array.from(groups).sort((left, right) => {
    if (left === 'default') return -1;
    if (right === 'default') return 1;
    return left.localeCompare(right, 'zh-CN');
  });
};

const ApiSettingsModal: React.FC<{
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}> = ({ children, onClose, title, subtitle }) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[10020] flex justify-center overflow-y-auto bg-black/60 backdrop-blur-md ${isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-center px-4 py-5 sm:px-6 sm:py-6'}`}
      onClick={onClose}
    >
      <div
        className={`flex min-h-0 w-full flex-col overflow-hidden border ${isMobile ? 'ios-mobile-sheet mobile-sheet-viewport rounded-t-[28px] rounded-b-none' : 'max-w-[920px] rounded-[28px]'}`}
        style={{
          background: 'linear-gradient(180deg, var(--settings-section-bg) 0%, var(--settings-surface-elevated) 100%)',
          boxShadow: 'var(--settings-shell-shadow), var(--settings-inset-shadow)',
          maxHeight: isMobile
            ? 'calc(100dvh - max(8px, env(safe-area-inset-top, 0px)) - max(8px, env(safe-area-inset-bottom, 0px)))'
            : 'calc(100vh - 24px)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || subtitle) && (
          <div
            className={`flex items-start justify-between border-b ${isMobile ? 'mobile-sheet-header-safe p-4' : 'p-5 sm:p-6'}`}
            style={{
              backgroundColor: 'var(--settings-shell-header-bg)',
            }}
          >
            <div>
              {title && <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>}
              {subtitle && <div className="mt-1 text-xs text-[var(--text-tertiary)]">{subtitle}</div>}
            </div>
            <button 
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs transition-colors hover:bg-white/5"
              style={secondaryButtonStyle}
              onClick={onClose}
            >
              <XCircle size={12} />关闭
            </button>
          </div>
        )}
        <div className={`min-h-0 flex-1 ${isMobile ? 'mobile-sheet-scroll p-4 pb-6' : 'overflow-y-auto p-5 pb-6 sm:p-6 sm:pb-7'}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

const ApiSettingsView: React.FC<ApiSettingsViewProps> = ({ initialSupplier = null }) => {
  const [slots, setSlots] = useState<KeySlot[]>([]);
  const [providers, setProviders] = useState<ThirdPartyProvider[]>([]);

  const [officialForm, setOfficialForm] = useState<OfficialForm>(defaultOfficialForm);
  const [providerForm, setProviderForm] = useState<ProviderForm>(defaultProviderForm);

  const [showOfficialCreateForm, setShowOfficialCreateForm] = useState(false);
  const [showProviderCreateForm, setShowProviderCreateForm] = useState(false);
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<ApiWorkspaceMode>('third-party');
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );

  const [advancedResult, setAdvancedResult] = useState<AdvancedResult | null>(null);
  const [manualPricingRows, setManualPricingRows] = useState<ManualPricingRow[]>([]);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [providerSearch, setProviderSearch] = useState('');
  const [pricingSearch, setPricingSearch] = useState('');
  const providerEditorRef = useRef<HTMLDivElement | null>(null);
  const providerEditorBodyRef = useRef<HTMLDivElement | null>(null);
  const appliedInitialSupplierRef = useRef<string | null>(null);

  const [detectingProviderId, setDetectingProviderId] = useState<string | null>(null);
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [highlightedProviderId, setHighlightedProviderId] = useState<string | null>(null);
  const providerListRef = useRef<HTMLDivElement | null>(null);

  const dedupeProvidersIfNeeded = () => {
    const seen = new Set<string>();
    const duplicateIds: string[] = [];

    keyManager.getProviders().forEach((provider) => {
      if (!provider.baseUrl || !provider.apiKey) return;

      const signature = buildProviderSignature(provider.baseUrl, provider.apiKey);
      if (seen.has(signature)) {
        duplicateIds.push(provider.id);
        return;
      }

      seen.add(signature);
    });

    duplicateIds.forEach((id) => keyManager.removeProvider(id));

    if (duplicateIds.length > 0) {
      notify.success('已清理重复配置', `已移除 ${duplicateIds.length} 条旧版重复供应商。`);
    }
  };

  const migrateLegacyDataIfNeeded = () => {
    const legacySuppliers = supplierService.getAll();

    try {
      if (localStorage.getItem(LEGACY_API_SETTINGS_MIGRATION_KEY) === 'done') {
        if (legacySuppliers.length > 0) {
          supplierService.clearLegacyStorage();
        }
        return;
      }
    } catch (error) {
      console.warn('[ApiSettingsView] Failed to read migration flag:', error);
    }

    const existingProviders = keyManager.getProviders();
    const existingSignature = new Set(
      existingProviders.map((item) => buildProviderSignature(item.baseUrl, item.apiKey))
    );
    let migratedCount = 0;

    legacySuppliers.forEach((supplier) => {
      if (!supplier.name || !supplier.baseUrl || !supplier.apiKey) return;
      const signature = buildProviderSignature(supplier.baseUrl, supplier.apiKey);
      if (existingSignature.has(signature)) return;

      keyManager.addProvider({
        name: supplier.name,
        baseUrl: supplier.baseUrl,
        apiKey: supplier.apiKey,
        group: (supplier as any).group || undefined,
        models: (supplier.models || []).map((model) => model.id).filter(Boolean),
        format: supplier.format || 'auto',
        isActive: true,
        providerColor: '#3B82F6',
        badgeColor: '#3B82F6',
        identityKey: (supplier as any).systemToken || undefined,
        pricingSnapshot: supplier.models?.length
          ? {
              fetchedAt: Date.now(),
              note: '旧版供应商数据自动迁移',
              rows: supplier.models.map((model) => ({ model: model.id })),
            }
          : undefined,
      } as any);

      existingSignature.add(signature);
      migratedCount += 1;
    });

    const legacySlots = keyManager.getSlots().filter((slot) => !!slot.baseUrl && !!slot.key);
    legacySlots.forEach((slot) => {
      const name = slot.name || slot.provider || '第三方供应商';
      const baseUrl = slot.baseUrl || '';
      if (!baseUrl) return;

      const signature = buildProviderSignature(baseUrl, slot.key);
      if (existingSignature.has(signature)) return;

      keyManager.addProvider({
        name,
        baseUrl,
        apiKey: slot.key,
        group: slot.group || undefined,
        models: slot.supportedModels || [],
        format: slot.format || 'auto',
        isActive: !slot.disabled,
        providerColor: '#3B82F6',
        badgeColor: '#3B82F6',
      } as any);

      existingSignature.add(signature);
      migratedCount += 1;
    });

    try {
      localStorage.setItem(LEGACY_API_SETTINGS_MIGRATION_KEY, 'done');
    } catch (error) {
      console.warn('[ApiSettingsView] Failed to persist migration flag:', error);
    }

    if (legacySuppliers.length > 0) {
      supplierService.clearLegacyStorage();
    }

    if (migratedCount > 0) {
      notify.success('历史数据已恢复', `已自动迁移 ${migratedCount} 条旧接口配置。`);
    }
  };

  const refresh = () => {
    setSlots(keyManager.getSlots());
    setProviders(keyManager.getProviders());
  };

  useEffect(() => {
    dedupeProvidersIfNeeded();
    migrateLegacyDataIfNeeded();
    refresh();
    const unsubscribe = keyManager.subscribe(() => refresh());
    return unsubscribe;
  }, []);

  useEffect(() => {
    const onResize = () => setIsNarrowViewport(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showProviderCreateForm) return;
    let frameB = 0;

    const scrollEditorIntoView = () => {
      const editorCard = providerEditorRef.current;
      if (!editorCard) return;

      providerEditorBodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });

      let scrollParent: HTMLElement | null = editorCard.parentElement;
      while (scrollParent) {
        const style = window.getComputedStyle(scrollParent);
        const canScroll =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          scrollParent.scrollHeight > scrollParent.clientHeight + 8;

        if (canScroll) {
          const targetTop =
            editorCard.getBoundingClientRect().top -
            scrollParent.getBoundingClientRect().top +
            scrollParent.scrollTop -
            20;
          scrollParent.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'auto',
          });
          return;
        }

        scrollParent = scrollParent.parentElement;
      }

      const absoluteTop = editorCard.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: Math.max(0, absoluteTop), behavior: 'auto' });
    };

    const frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(scrollEditorIntoView);
    });

    return () => {
      window.cancelAnimationFrame(frameA);
      if (frameB) {
        window.cancelAnimationFrame(frameB);
      }
    };
  }, [showProviderCreateForm, providerForm.id]);

  const officialEntries = useMemo(
    () =>
      slots.filter((slot) => {
        if (!slot.key) return false;
        if (slot.baseUrl) return false;
        if (slot.provider === 'SystemProxy') return false;
        return slot.type === 'official' || slot.provider === 'Google' || slot.provider === 'OpenAI';
      }),
    [slots]
  );
  const officialKeys = useMemo(
    () => officialEntries.filter((slot) => !slot.disabled),
    [officialEntries]
  );

  const summary = useMemo(() => {
    const activeProviders = providers.filter((item) => item.isActive);
    const modelCount = providers.reduce((sum, item) => sum + (item.models?.length || 0), 0);
    const totalTokens = providers.reduce((sum, item) => sum + (item.usage?.totalTokens || 0), 0);
    const totalCost = providers.reduce((sum, item) => sum + (item.usage?.totalCost || 0), 0);

    return {
      officialCount: officialEntries.length,
      activeOfficialCount: officialKeys.length,
      providerCount: providers.length,
      activeProviderCount: activeProviders.length,
      modelCount,
      totalTokens,
      totalCost,
    };
  }, [officialEntries.length, officialKeys.length, providers]);
  const officialWorkspaceSummary = useMemo(() => {
    const limitedCount = officialEntries.filter((slot) => resolveCostModeFromLimits(slot.budgetLimit, slot.tokenLimit) !== 'unlimited').length;
    const tokenManagedCount = officialEntries.filter((slot) => resolveCostModeFromLimits(slot.budgetLimit, slot.tokenLimit) === 'tokens').length;
    const pausedCount = officialEntries.filter((slot) => slot.disabled).length;
    const totalCost = officialEntries.reduce((sum, slot) => sum + (slot.totalCost || 0), 0);

    return {
      limitedCount,
      tokenManagedCount,
      pausedCount,
      totalCost,
    };
  }, [officialEntries]);
  const providerWorkspaceSummary = useMemo(() => {
    const syncedCount = providers.filter((item) => providerHasPricingSnapshot(item)).length;
    const errorCount = providers.filter((item) => item.status === 'error' || Boolean(item.lastError)).length;
    const limitedCount = providers.filter((item) => (item.customCostMode || 'unlimited') !== 'unlimited').length;
    const pendingSyncCount = providers.filter((item) => item.isActive && !providerHasPricingSnapshot(item)).length;

    return {
      syncedCount,
      errorCount,
      limitedCount,
      pendingSyncCount,
    };
  }, [providers]);
  const currentOfficialSlot = useMemo(
    () => officialEntries.find((slot) => slot.id === officialForm.id),
    [officialEntries, officialForm.id]
  );
  const currentOfficialBudgetPreview = useMemo(
    () => formatOfficialBudgetInfo(currentOfficialSlot),
    [currentOfficialSlot]
  );
  const currentEditingProvider = useMemo(
    () => providers.find((item) => item.id === providerForm.id),
    [providers, providerForm.id]
  );
  const currentProviderRuntime = useMemo(
    () => resolveProviderRuntime({ baseUrl: providerForm.baseUrl, format: providerForm.format || 'auto' }),
    [providerForm.baseUrl, providerForm.format]
  );
  const isCurrentProviderWuyin = currentProviderRuntime.strategyId === 'wuyinkeji';
  const currentWuyinEndpointModelId = useMemo(
    () => extractWuyinModelIdFromBaseUrl(providerForm.baseUrl),
    [providerForm.baseUrl]
  );
  const isCurrentWuyinCatalogMode = isCurrentProviderWuyin && !currentWuyinEndpointModelId;
  const currentProviderHasAutoPricing = useMemo(
    () =>
      hasNonManualPricingData(Array.isArray(advancedResult?.pricingData) ? advancedResult.pricingData : []) ||
      snapshotHasAutoPricingRows(currentEditingProvider?.pricingSnapshot),
    [advancedResult?.pricingData, currentEditingProvider?.pricingSnapshot]
  );
  const currentProviderWorkbenchMode = useMemo(
    () =>
      resolveProviderWorkbenchMode(currentProviderRuntime, {
        endpointModelId: currentWuyinEndpointModelId,
        hasAutoPricing: currentProviderHasAutoPricing,
        isCatalogMode: isCurrentWuyinCatalogMode,
      }),
    [currentProviderHasAutoPricing, currentProviderRuntime, currentWuyinEndpointModelId, isCurrentWuyinCatalogMode]
  );
  const currentProviderWorkbenchMeta = getProviderWorkbenchMeta(currentProviderWorkbenchMode, {
    isCatalogMode: isCurrentWuyinCatalogMode,
    manualPricingOnly: false,
  });
  const currentProviderUsesEndpointPricingRows = isCurrentProviderWuyin;
  const isCurrentManualPricingOnlyProvider = false;
  const currentProviderCanScanPricing = currentProviderWorkbenchMode === 'pricing-sync';
  const currentProviderCanValidateModels =
    currentProviderWorkbenchMode !== 'endpoint-model' && currentProviderRuntime.strategyId !== 'wuyinkeji';
  const manualPricingData = useMemo(
    () => manualPricingRows.map(buildManualPricingEntry).filter(Boolean) as any[],
    [manualPricingRows]
  );
  const effectivePricingData = useMemo(() => {
    const scannedPricingData = Array.isArray(advancedResult?.pricingData)
      ? advancedResult.pricingData.filter((item) => String(item?.source || '').trim().toLowerCase() !== MANUAL_PRICING_SOURCE)
      : [];
    return mergePricingDataByModel([...scannedPricingData, ...manualPricingData]);
  }, [advancedResult, manualPricingData]);
  const effectivePricingModels = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(advancedResult?.models || []),
            ...manualPricingRows.map((item) => item.model),
          ]
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        )
      ),
    [advancedResult, manualPricingRows]
  );
  const currentProviderSnapshotCount =
    effectivePricingData.length || currentEditingProvider?.pricingSnapshot?.rows?.length || 0;
  const currentProviderModelCount =
    currentEditingProvider?.models?.length || effectivePricingModels.length || 0;
  const currentProviderSupportsGroups = !isNoGroupProvider(providerForm.baseUrl);
  const currentProviderGroupCount =
    currentProviderSupportsGroups ? (advancedResult?.availableGroups?.length || (providerForm.group.trim() ? 1 : 0)) : 0;
  const currentProviderLastSync = advancedResult?.fetchedAt || currentEditingProvider?.pricingSnapshot?.fetchedAt;
  const currentProviderStatus = useMemo(
    () => getProviderStatusMeta(currentEditingProvider, { hasPricingSnapshot: currentProviderSnapshotCount > 0 }),
    [currentEditingProvider, currentProviderSnapshotCount]
  );
  const hasProviderConnection = Boolean(
    providerForm.name.trim() && providerForm.baseUrl.trim() && providerForm.apiKey.trim()
  );
  const providerWorkflowSteps = useMemo(
    () => {
      if (currentProviderWorkbenchMode === 'endpoint-model') {
        return [
          {
            key: 'connection',
            label: '接口地址',
            description: hasProviderConnection ? '接口地址与 API Key 已填写' : '补齐名称、接口地址与 API Key',
            complete: hasProviderConnection,
          },
          {
            key: 'saved',
            label: '保存配置',
            description: providerForm.id ? '当前接口型供应商已保存' : '保存后才会出现在正式供应商列表',
            complete: Boolean(providerForm.id),
          },
          {
            key: 'endpoint',
            label: '接口识别',
            description: currentWuyinEndpointModelId
              ? `当前接口模型为 ${currentWuyinEndpointModelId}`
              : '填写完整 async 接口地址后即可识别模型',
            complete: Boolean(currentWuyinEndpointModelId),
          },
          {
            key: 'pricing',
            label: '接口单价',
            description:
              currentProviderSnapshotCount > 0
                ? `已准备 ${currentProviderSnapshotCount} 条接口价格`
                : manualPricingRows.length > 0
                  ? `当前已维护 ${manualPricingRows.length} 个接口单价`
                  : '下方可维护接口单价',
            complete: currentProviderSnapshotCount > 0 || manualPricingRows.length > 0,
          },
        ];
      }

      if (currentProviderWorkbenchMode === 'model-detect') {
        return [
          {
            key: 'connection',
            label: '连接信息',
            description: hasProviderConnection ? '名称、地址与 API Key 已填写' : '补齐名称、基础地址与 API Key',
            complete: hasProviderConnection,
          },
          {
            key: 'saved',
            label: '保存配置',
            description: providerForm.id ? '当前供应商已进入调度队列' : '保存后才会出现在正式供应商列表',
            complete: Boolean(providerForm.id),
          },
          {
            key: 'models',
            label: '模型识别',
            description: currentEditingProvider?.lastChecked
              ? `最近识别 ${formatDate(currentEditingProvider.lastChecked)}`
              : currentProviderModelCount > 0
                ? `当前已记录 ${currentProviderModelCount} 个模型`
                : '保存后可执行模型识别',
            complete: Boolean(currentEditingProvider?.lastChecked || currentProviderModelCount > 0),
          },
          {
            key: 'pricing',
            label: '手动定价',
            description:
              currentProviderSnapshotCount > 0
                ? `已准备 ${currentProviderSnapshotCount} 条手动价格`
                : manualPricingRows.length > 0
                  ? `当前已维护 ${manualPricingRows.length} 个模型单价`
                  : '下方手动维护模型价格',
            complete: currentProviderSnapshotCount > 0 || manualPricingRows.length > 0,
          },
        ];
      }

      if (isCurrentWuyinCatalogMode) {
        return [
          {
            key: 'connection',
            label: '连接信息',
            description: hasProviderConnection ? '名称、目录地址与 API Key 已填写' : '补齐名称、目录地址与 API Key',
            complete: hasProviderConnection,
          },
          {
            key: 'saved',
            label: '保存配置',
            description: providerForm.id ? '当前目录型供应商已保存' : '保存后才会出现在正式供应商列表',
            complete: Boolean(providerForm.id),
          },
          {
            key: 'catalog',
            label: '模型价格',
            description:
              currentProviderSnapshotCount > 0
                ? `已准备 ${currentProviderSnapshotCount} 条模型价格`
                : manualPricingRows.length > 0
                  ? `当前已手动维护 ${manualPricingRows.length} 个模型`
                  : '下方可读取产品目录或手动维护模型价格',
            complete: currentProviderSnapshotCount > 0 || manualPricingRows.length > 0,
          },
        ];
      }

      return [
        {
          key: 'connection',
          label: '连接信息',
          description: hasProviderConnection ? '名称、地址与 API Key 已填写' : '补齐名称、基础地址与 API Key',
          complete: hasProviderConnection,
        },
        {
          key: 'saved',
          label: '保存配置',
          description: providerForm.id ? '当前供应商已进入调度队列' : '保存后才会出现在正式供应商列表',
          complete: Boolean(providerForm.id),
        },
        {
          key: 'models',
          label: '模型校验',
          description: currentEditingProvider?.lastChecked
            ? `最近校验 ${formatDate(currentEditingProvider.lastChecked)}`
            : currentProviderModelCount > 0
              ? `当前已记录 ${currentProviderModelCount} 个模型`
              : '保存后可执行模型校验',
          complete: Boolean(currentEditingProvider?.lastChecked || currentProviderModelCount > 0),
        },
        {
          key: 'pricing',
          label: '价格同步',
          description:
            currentProviderSnapshotCount > 0
              ? `已准备 ${currentProviderSnapshotCount} 条价格记录`
              : '建议同步价格快照与分组倍率',
          complete: currentProviderSnapshotCount > 0,
        },
      ];
    },
    [
      currentEditingProvider?.lastChecked,
      currentProviderWorkbenchMode,
      currentProviderModelCount,
      currentProviderSnapshotCount,
      currentWuyinEndpointModelId,
      hasProviderConnection,
      isCurrentWuyinCatalogMode,
      manualPricingRows.length,
      providerForm.id,
    ]
  );
  const currentProviderBudgetPreview = useMemo(() => {
    if (currentEditingProvider) {
      return formatBudgetInfo(currentEditingProvider);
    }

    if (providerForm.costMode === 'unlimited') {
      return {
        total: '∞',
        used: providerForm.id ? '¥0.00' : '未开始',
        remaining: '∞',
        unit: '',
      };
    }

    if (providerForm.costMode === 'amount') {
      const value = Math.max(0, providerForm.costValue || 0);
      return {
        total: `¥${value.toFixed(2)}`,
        used: '¥0.00',
        remaining: `¥${value.toFixed(2)}`,
        unit: '元',
      };
    }

    const value = Math.max(0, providerForm.costValue || 0);
    return {
      total: value.toLocaleString('zh-CN'),
      used: '0',
      remaining: value.toLocaleString('zh-CN'),
      unit: 'tokens',
    };
  }, [currentEditingProvider, providerForm.costMode, providerForm.costValue, providerForm.id]);
  const applyRandomProviderColor = (excludeProviderId?: string) => {
    setProviderForm((prev) => ({
      ...prev,
      providerColor: pickRandomProviderColor(collectProviderColors(providers, excludeProviderId), prev.providerColor),
    }));
  };
  const editingProviderName = providerForm.name.trim() || currentEditingProvider?.name || '未命名供应商';
  const editingProviderBaseUrl = providerForm.baseUrl.trim() || currentEditingProvider?.baseUrl || '';
  // 🚀 [Fix] 改进搜索逻辑：优先搜索名字，然后是地址
  const searchResult = useMemo(() => {
    const keyword = providerSearch.trim().toLowerCase();
    if (!keyword) return { providers, highlightId: null as string | null };

    // 首先按名字搜索
    const nameMatches = providers.filter((provider) => 
      provider.name?.toLowerCase().includes(keyword)
    );
    
    // 然后按地址搜索（排除已匹配的）
    const nameMatchIds = new Set(nameMatches.map(p => p.id));
    const urlMatches = providers.filter((provider) => 
      !nameMatchIds.has(provider.id) && 
      provider.baseUrl?.toLowerCase().includes(keyword)
    );
    
    // 合并结果：名字匹配优先
    const result = [...nameMatches, ...urlMatches];
    
    // 第一个匹配项作为高亮目标
    const highlightId = result.length > 0 ? result[0].id : null;
    
    return { providers: result, highlightId };
  }, [providerSearch, providers]);
  
  const filteredProviders = searchResult.providers;

  // 🚀 [Fix] 搜索后自动滚动并高亮
  useEffect(() => {
    if (searchResult.highlightId && providerSearch.trim()) {
      setHighlightedProviderId(searchResult.highlightId);
      
      // 延迟滚动，等待渲染完成
      setTimeout(() => {
        const element = document.querySelector(`[data-provider-id="${searchResult.highlightId}"]`);
        if (element && providerListRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      // 3秒后取消高亮
      const timer = setTimeout(() => {
        setHighlightedProviderId(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [searchResult.highlightId, providerSearch]);
  const advancedPricingRows = useMemo(() => {
    if (!effectivePricingData.length) return [];

    return effectivePricingData
      .map((item: any) => {
        const model = getPricingModelId(item);
        if (!model) return null;

        return {
          model,
          provider: typeof item.provider === 'string' ? item.provider.trim() : undefined,
          providerLabel: typeof item.provider_label === 'string' ? item.provider_label.trim() : undefined,
          tokenGroup: typeof item.token_group === 'string' ? item.token_group.trim() : undefined,
          billingType:
            typeof item.billing_type === 'string'
              ? item.billing_type.trim()
              : typeof item.type === 'string'
                ? item.type.trim()
                : undefined,
          quotaType: item.quota_type,
          basePrice: item.model_price,
          modelRatio: item.model_ratio,
          completionRatio: item.completion_ratio,
          inputPrice: toFiniteNumber(item.input_price ?? item.inputPrice ?? item.input_per_million_tokens),
          outputPrice: toFiniteNumber(item.output_price ?? item.outputPrice ?? item.output_per_million_tokens),
          cacheReadPrice: toFiniteNumber(item.cache_read_price ?? item.cacheReadPrice ?? item.cached_input_price),
          cacheCreationPrice: toFiniteNumber(item.cache_creation_price ?? item.cacheCreationPrice ?? item.cached_output_price),
          perRequestPrice: toFiniteNumber(item.per_request_price ?? item.perRequestPrice ?? item.price_per_image ?? item.pricePerImage),
          groupRatio: toFiniteNumber(item.group_ratio ?? item.groupMultiplier),
          currency: typeof item.currency === 'string' ? item.currency.trim() : undefined,
          billingUnit: typeof item.pay_unit === 'string' ? item.pay_unit.trim() : undefined,
          displayPrice: typeof item.display_price === 'string' ? item.display_price.trim() : undefined,
          sizeRatioMap: normalizeRatioMap(item.size_ratio ?? item.sizeRatio),
          groupModelRatioMap: normalizeRatioMap(item.group_model_ratio ?? item.groupModelRatio),
          groupSizeRatioMap: normalizeNestedRatioMap(item.group_size_ratio ?? item.groupSizeRatio),
          groupPriceMap: normalizeGroupPriceMap(item.group_model_price ?? item.groupModelPrice),
        };
      })
      .filter(Boolean) as AdvancedPricingRow[];
  }, [effectivePricingData]);

  const filteredAdvancedPricingRows = useMemo(() => {
    const keyword = pricingSearch.trim().toLowerCase();
    if (!keyword) return advancedPricingRows;

    return advancedPricingRows.filter((row) => {
      const haystack = [
        row.model,
        row.provider,
        row.providerLabel,
        row.tokenGroup,
        row.billingType,
        row.quotaType,
        ...Object.keys(row.sizeRatioMap),
        ...Object.keys(row.groupModelRatioMap),
        ...Object.keys(row.groupSizeRatioMap),
        ...Object.keys(row.groupPriceMap),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [advancedPricingRows, pricingSearch]);
  const defaultScannedGroupRatio = getDefaultGroupRatio(advancedResult?.groupRatio);
  const renderPricingDetailBadges = (row: AdvancedPricingRow) => {
    const billingLabel = resolveBillingLabel(row.billingType, row.quotaType, row.perRequestPrice);
    const detailBadges: Array<{ label: string; value: string; accent?: boolean }> = [];

    if (billingLabel === '按量') {
      const directPriceBadges = [
        row.inputPrice ? { label: '输入', value: formatMoneyDisplay(row.inputPrice, '/1M Tokens', row.currency) } : null,
        row.outputPrice ? { label: '补全', value: formatMoneyDisplay(row.outputPrice, '/1M Tokens', row.currency) } : null,
        row.cacheReadPrice ? { label: '缓存读取', value: formatMoneyDisplay(row.cacheReadPrice, '/1M Tokens', row.currency) } : null,
        row.cacheCreationPrice ? { label: '缓存创建', value: formatMoneyDisplay(row.cacheCreationPrice, '/1M Tokens', row.currency) } : null,
      ].filter(Boolean) as Array<{ label: string; value: string | null }>;

      if (directPriceBadges.length > 0) {
        return directPriceBadges
          .filter((item): item is { label: string; value: string } => Boolean(item.value))
          .map((item, index) => ({
            label: item.label,
            value: item.value,
            accent: index === 0,
          }));
      }

      const activeGroup = row.tokenGroup || providerForm.group || 'default';
      const fallbackGroupRatio =
        row.groupRatio ??
        advancedResult?.groupRatio?.[activeGroup] ??
        advancedResult?.groupRatio?.default ??
        defaultScannedGroupRatio;
      const groupOverride = activeGroup ? row.groupPriceMap[activeGroup] : undefined;
      const effectiveModelRatio = groupOverride?.modelRatio ?? row.modelRatio;
      const effectiveCompletionRatio = groupOverride?.completionRatio ?? row.completionRatio;

      if (fallbackGroupRatio !== undefined) {
        detailBadges.push({
          label: '分组倍率',
          value: `${activeGroup} ${formatRatioDisplay(fallbackGroupRatio)}`,
          accent: true,
        });
      }
      if (effectiveModelRatio !== undefined) {
        detailBadges.push({ label: '模型倍率', value: formatRatioDisplay(effectiveModelRatio) });
      }
      if (effectiveCompletionRatio !== undefined) {
        detailBadges.push({ label: '补全倍率', value: formatRatioDisplay(effectiveCompletionRatio) });
      }

      return detailBadges;
    }

    const activeGroup = row.tokenGroup || providerForm.group || 'default';
    const explicitGroupPrice = activeGroup ? row.groupPriceMap[activeGroup]?.modelPrice : undefined;
    const basePrice = explicitGroupPrice ?? row.perRequestPrice ?? row.basePrice;
    const scopedGroupSizeRatios =
      row.groupSizeRatioMap[activeGroup] ||
      row.groupSizeRatioMap.default ||
      row.groupSizeRatioMap.Default ||
      row.groupSizeRatioMap.DEFAULT ||
      {};
    const mergedSizeRatios =
      Object.keys(scopedGroupSizeRatios).length > 0 ? scopedGroupSizeRatios : row.sizeRatioMap;
    const activeSizeRatio = mergedSizeRatios[activeGroup] ?? row.sizeRatioMap[activeGroup];

    if (basePrice !== undefined) {
      detailBadges.push({
        label: '基础单价',
        value: row.displayPrice || formatMoneyDisplay(basePrice, `/${row.billingUnit || '次'}`, row.currency) || '-',
        accent: true,
      });
    }

    const ratioEntries = sortRatioEntries(mergedSizeRatios);
    ratioEntries.forEach(([size, ratio]) => {
      if (basePrice === undefined) {
        detailBadges.push({
          label: size,
          value: formatRatioDisplay(ratio),
          accent: size === activeGroup,
        });
        return;
      }

      detailBadges.push({
        label: size,
        value: `${formatRatioDisplay(ratio)} = ${formatMoneyDisplay(basePrice * ratio, `/${row.billingUnit || '次'}`, row.currency)}`,
        accent: size === activeGroup,
      });
    });

    if (!ratioEntries.length && activeSizeRatio !== undefined && basePrice !== undefined) {
      detailBadges.push({
        label: activeGroup,
        value: `${formatRatioDisplay(activeSizeRatio)} = ${formatMoneyDisplay(basePrice * activeSizeRatio, `/${row.billingUnit || '次'}`, row.currency)}`,
        accent: true,
      });
    }

    if (!detailBadges.length && row.groupRatio !== undefined) {
      detailBadges.push({
        label: '分组倍率',
        value: `${activeGroup} ${formatRatioDisplay(row.groupRatio)}`,
        accent: true,
      });
    }

    return detailBadges;
  };

  const parseCost = (mode: CostMode, value: number) => {
    if (mode === 'unlimited') return { budgetLimit: -1, tokenLimit: -1 };
    if (mode === 'amount') return { budgetLimit: Math.max(0, value), tokenLimit: -1 };
    return { budgetLimit: -1, tokenLimit: Math.max(0, value) };
  };

  const resetOfficialForm = (closeCreate = true) => {
    setOfficialForm(defaultOfficialForm);
    if (closeCreate) setShowOfficialCreateForm(false);
  };

  const resetThirdPartyForm = (closeCreate = true) => {
    setProviderForm({
      ...defaultProviderForm,
      providerColor: pickRandomProviderColor(collectProviderColors(providers)),
    });
    setAdvancedResult(null);
    setManualPricingRows([]);
    setPricingSearch('');
    setShowAdvancedMode(false);
    if (closeCreate) {
      setShowProviderCreateForm(false);
    }
  };

  useEffect(() => {
    if (initialSupplier) return;
    resetThirdPartyForm(true);
    appliedInitialSupplierRef.current = '';
    setActiveWorkspace('third-party');
  }, [initialSupplier]);

  const loadOfficialToForm = (slot: KeySlot) => {
    setActiveWorkspace('official');
    setOfficialForm({
      id: slot.id,
      name: slot.name,
      key: slot.key,
      costMode:
        slot.tokenLimit && slot.tokenLimit > 0
          ? 'tokens'
          : slot.budgetLimit && slot.budgetLimit > 0
            ? 'amount'
            : 'unlimited',
      costValue:
        slot.tokenLimit && slot.tokenLimit > 0
          ? slot.tokenLimit
          : slot.budgetLimit && slot.budgetLimit > 0
            ? slot.budgetLimit
            : 0,
    });
    setShowOfficialCreateForm(true);
  };

  const loadProviderToForm = (provider: ThirdPartyProvider) => {
    setActiveWorkspace('third-party');
    setProviderForm(toProviderForm(provider));
    setPricingSearch('');
    const snapshot = provider.pricingSnapshot;
    setManualPricingRows(extractManualPricingRowsFromSnapshot(snapshot));

    if (snapshot && snapshot.rows && snapshot.rows.length > 0) {
      const restoredPricingData = restorePricingDataFromSnapshot(snapshot);
      const restoredGroupRatio =
        snapshot.groupRatioMap ||
        (typeof snapshot.groupRatio === 'number' ? { default: snapshot.groupRatio } : undefined);

      const modelNames = restoredPricingData?.length
        ? extractPricingModelIds(restoredPricingData)
        : snapshot.rows
            .map((item) => String(item.model || '').trim())
            .filter(Boolean);

      setAdvancedResult({
        models: modelNames,
        apiType: provider.format || 'auto',
        pricingHint: snapshot.note || `已保存 ${modelNames.length} 个模型的价格配置`,
        fetchedAt: snapshot.fetchedAt || Date.now(),
        pricingData: restoredPricingData,
        groupRatio: restoredGroupRatio,
        availableGroups: extractAvailableGroups(restoredPricingData, restoredGroupRatio, provider.baseUrl),
      });
      setShowAdvancedMode(true);
    } else {
      setAdvancedResult(null);
      setShowAdvancedMode(false);
    }

    setShowProviderCreateForm(true);
  };

  useEffect(() => {
    if (!initialSupplier) return;

    const supplierSignature = [
      initialSupplier.id,
      initialSupplier.name,
      initialSupplier.baseUrl,
      initialSupplier.apiKey,
    ].join('|');

    if (appliedInitialSupplierRef.current === supplierSignature) return;

    const matchedProvider =
      providers.find((item) => item.id === initialSupplier.id) ||
      providers.find(
        (item) =>
          item.baseUrl.trim() === initialSupplier.baseUrl.trim() &&
          item.name.trim() === initialSupplier.name.trim()
      );

    appliedInitialSupplierRef.current = supplierSignature;

    if (matchedProvider) {
      loadProviderToForm(matchedProvider);
      return;
    }

    setProviderForm({
      id: undefined,
      name: initialSupplier.name || '',
      baseUrl: initialSupplier.baseUrl || '',
      apiKey: initialSupplier.apiKey || '',
      format: initialSupplier.format || 'auto',
      group: '',
      costMode:
        typeof initialSupplier.budgetLimit === 'number' && initialSupplier.budgetLimit > 0 ? 'amount' : 'unlimited',
      costValue:
        typeof initialSupplier.budgetLimit === 'number' && initialSupplier.budgetLimit > 0 ? initialSupplier.budgetLimit : 0,
      providerColor: pickRandomProviderColor(collectProviderColors(providers)),
      isActive: true,
    });
    setAdvancedResult(null);
    setManualPricingRows([]);
    setPricingSearch('');
    setShowAdvancedMode(false);
    setShowProviderCreateForm(true);
    setActiveWorkspace('third-party');
  }, [initialSupplier, providers]);

  const handleSaveOfficial = async () => {
    const key = officialForm.key.trim();
    const name =
      officialForm.name.trim() ||
      currentOfficialSlot?.name ||
      buildOfficialAutoName(officialEntries.length + (officialForm.id ? 0 : 1));

    if (!key) {
      notify.error('保存失败', '请填写 API Key。');
      return;
    }

    const { budgetLimit, tokenLimit } = parseCost(officialForm.costMode, officialForm.costValue);

    try {
      if (officialForm.id) {
        await keyManager.updateKey(officialForm.id, {
          name,
          key,
          budgetLimit,
          tokenLimit,
        });
        notify.success('保存成功', '官方接口已更新。');
      } else {
        const result = await keyManager.addKey(key, {
          name,
          provider: 'Google',
          type: 'official',
          budgetLimit,
          tokenLimit,
        });

        if (!result.success) {
          notify.error('添加失败', result.error || '无法保存官方接口。');
          return;
        }

        notify.success('添加成功', '官方接口已添加。');
      }

      resetOfficialForm(true);
      refresh();
    } catch (error: any) {
      notify.error('保存失败', error?.message || '无法保存官方接口。');
    }
  };

  const fetchPricingFromUrl = async (baseUrl: string, apiKey?: string): Promise<AdvancedResult | null> => {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const runtime = resolveProviderRuntime({ baseUrl: cleanUrl, format: providerForm.format || 'auto' });

    if (runtime.strategyId === '12ai') {
      try {
        const proxyResponse = await fetch('/api/pricing-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl: cleanUrl, apiKey }),
        });

        if (proxyResponse.ok) {
          const proxyData = await proxyResponse.json();
          if (!proxyData.error) {
            const pricingList: any[] = Array.isArray(proxyData.data) ? proxyData.data : [];
            const groupRatio = (proxyData.group_ratio || {}) as Record<string, number>;

            if (pricingList.length > 0) {
              return {
                models: extractPricingModelIds(pricingList),
                apiType: '12ai-pricing-page',
                pricingHint: `已从 ${cleanUrl}/pricing 提取 ${pricingList.length} 条模型价格。`,
                fetchedAt: Date.now(),
                pricingData: pricingList,
                groupRatio,
                availableGroups: extractAvailableGroups(pricingList, groupRatio, cleanUrl),
              };
            }
          }
        }
      } catch (error) {
        console.warn('[ApiSettings] 12AI pricing proxy failed:', error);
      }
    }

    try {
      const directPricing = await fetchRawPricingCatalog(cleanUrl, apiKey, providerForm.format || 'auto');
      if (directPricing) {
        return {
          models: extractPricingModelIds(directPricing.pricingData),
          apiType: directPricing.source,
          pricingHint: directPricing.source === 'wuyinkeji'
            ? `已从 ${directPricing.endpointUrl} 读取 ${directPricing.pricingData.length} 条目录价格配置。`
            : `已从 ${directPricing.endpointUrl} 同步 ${directPricing.pricingData.length} 条价格配置。`,
          fetchedAt: Date.now(),
          pricingData: directPricing.pricingData,
          groupRatio: directPricing.groupRatio,
          availableGroups: directPricing.supportsGroups
            ? extractAvailableGroups(directPricing.pricingData, directPricing.groupRatio, cleanUrl)
            : [],
        };
      }
    } catch (error) {
      console.warn('[ApiSettings] direct pricing fetch failed:', error);
    }

    if (isNoGroupProvider(cleanUrl)) {
      try {
        const pricingList = selectWuyinCatalogModels(cleanUrl, await fetchWuyinPricingCatalog(cleanUrl));
        return {
          models: pricingList.map((item) => item.modelId).filter(Boolean),
          apiType: 'wuyinkeji',
          pricingHint: `已从五音科技产品目录读取 ${pricingList.length} 个计费项，按供应商原始单位展示（如 元/张、元/次、元/秒）。`,
          fetchedAt: Date.now(),
          pricingData: pricingList.map((item) => ({
            model: item.modelId,
            model_name: item.modelName,
            billing_type: 'per_request',
            quota_type: 'per_request',
            per_request_price: item.inputPrice,
            price_per_image: item.inputPrice,
            currency: item.currency,
            pay_unit: item.billingUnit,
            display_price: item.displayPrice,
            endpoint_url: item.endpointUrl,
            endpoint_path: item.endpointPath,
          })),
          groupRatio: {},
          availableGroups: [],
        };
      } catch (error) {
        console.warn('[ApiSettings] wuyinkeji pricing fetch failed:', error);
      }
    }

    // 🚀 [Fix] 尝试多个可能的价格接口路径
    const endpoints = ['/api/pricing', '/pricing', '/v1/pricing', '/api/price', '/price'];
    
    for (const endpoint of endpoints) {
      try {
        const headers: Record<string, string> = { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        
        // 如果有 API Key，添加到请求头
        if (apiKey) {
          const runtime = resolveProviderRuntime({ baseUrl: cleanUrl, format: 'openai' });
          headers['Authorization'] = formatAuthorizationHeaderValue(apiKey, runtime.authorizationValueFormat);
        }
        
        const response = await fetch(`${cleanUrl}${endpoint}`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          console.warn(`[ApiSettings] pricing endpoint ${endpoint} returned ${response.status}`);
          continue;
        }
        
        const text = await response.text();
        if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
          console.warn(`[ApiSettings] pricing endpoint ${endpoint} returned HTML`);
          continue;
        }

        const data = JSON.parse(text);
        
        // 🚀 [Fix] 支持多种价格数据格式
        const pricingList: any[] = Array.isArray(data.data) ? data.data : 
                                  Array.isArray(data.prices) ? data.prices :
                                  Array.isArray(data.models) ? data.models : [];
        
        const groupRatio = (data.group_ratio || data.groupRatio || {}) as Record<string, number>;
        
        if (!pricingList.length) {
          console.warn(`[ApiSettings] pricing endpoint ${endpoint} returned empty list`);
          continue;
        }

        console.log(`[ApiSettings] Successfully fetched pricing from ${endpoint}: ${pricingList.length} models`);

        return {
          models: extractPricingModelIds(pricingList),
          apiType: 'direct',
          pricingHint: `已从供应商价格接口抓取 ${pricingList.length} 个模型的基础价与倍率。`,
          fetchedAt: Date.now(),
          pricingData: pricingList,
          groupRatio,
          availableGroups: extractAvailableGroups(pricingList, groupRatio, cleanUrl),
        };
      } catch (error) {
        console.warn(`[ApiSettings] pricing endpoint ${endpoint} failed:`, error);
      }
    }

    // 如果所有端点都失败，尝试代理
    try {
      const proxyResponse = await fetch('/api/pricing-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: cleanUrl }),
      });

      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        if (proxyData.error) return null;

        const pricingList: any[] = Array.isArray(proxyData.data) ? proxyData.data : [];
        const groupRatio = (proxyData.group_ratio || {}) as Record<string, number>;
        if (!pricingList.length) return null;

        return {
          models: extractPricingModelIds(pricingList),
          apiType: 'proxy',
          pricingHint: `已从供应商价格页抓取 ${pricingList.length} 个模型的基础价与倍率。`,
          fetchedAt: Date.now(),
          pricingData: pricingList,
          groupRatio,
          availableGroups: extractAvailableGroups(pricingList, groupRatio, cleanUrl),
        };
      }
    } catch (error) {
      console.warn('[ApiSettings] pricing proxy failed', error);
    }

    return null;
  };

  const handleDetectAdvanced = async () => {
    const baseUrl = providerForm.baseUrl.trim();
    if (!baseUrl) {
      notify.error('扫描失败', '请先填写供应商基础地址。');
      return;
    }

    setAdvancedLoading(true);
    try {
      // 🚀 [Fix] 传递 API Key 以支持需要认证的接口
      const result = await fetchPricingFromUrl(baseUrl, providerForm.apiKey);
      if (!result) {
        setAdvancedResult({
          models: [],
          apiType: 'proxy',
          pricingHint: '该供应商暂未返回价格数据。',
          fetchedAt: Date.now(),
          availableGroups: [],
        });
        notify.error(isCurrentWuyinCatalogMode ? '读取失败' : '扫描失败', isCurrentWuyinCatalogMode ? '未从产品目录读取到有效计费项。' : '未从价格页获取到基础价和倍率信息。');
        return;
      }

      setAdvancedResult(result);
      setShowAdvancedMode(true);
      if (isNoGroupProvider(baseUrl)) {
        setProviderForm((prev) => ({ ...prev, group: '' }));
      }
      notify.success(isCurrentWuyinCatalogMode ? '读取成功' : '扫描成功', isCurrentWuyinCatalogMode ? `已读取 ${result.models.length} 个目录计费项。` : `已识别 ${result.models.length} 个模型价格配置。`);
    } finally {
      setAdvancedLoading(false);
    }
  };

  const handleAddManualPricingRow = (preset: Partial<ManualPricingRow> = {}) => {
    setManualPricingRows((prev) => [...prev, createManualPricingRow(preset)]);
    setShowAdvancedMode(true);
  };

  const handleUseEndpointModelAsManual = () => {
    if (!currentWuyinEndpointModelId) {
      notify.error('无法提取模型', '当前接口地址里没有识别到五音模型路径。');
      return;
    }

    const matchedPricing = effectivePricingData.find(
      (item) => getPricingModelId(item).trim().toLowerCase() === currentWuyinEndpointModelId.toLowerCase()
    );
    const presetPrice = matchedPricing?.per_request_price ?? matchedPricing?.model_price ?? matchedPricing?.price_per_image;
    const presetUnit = String(matchedPricing?.pay_unit || matchedPricing?.billing_unit || '').trim();
    const presetCurrency = matchedPricing?.currency === 'USD' ? 'USD' : 'CNY';

    setManualPricingRows((prev) => {
      if (prev.some((item) => item.model.trim().toLowerCase() === currentWuyinEndpointModelId.toLowerCase())) {
        return prev;
      }

      return [
        ...prev,
        createManualPricingRow({
          model: currentWuyinEndpointModelId,
          modelName: currentWuyinEndpointModelId,
          endpointUrl: providerForm.baseUrl.trim(),
          price: presetPrice !== undefined ? String(presetPrice) : '',
          unit: presetUnit || guessManualBillingUnit(currentWuyinEndpointModelId),
          currency: presetCurrency,
        }),
      ];
    });
    setShowAdvancedMode(true);
  };

  const handleUpdateManualPricingRow = (rowId: string, patch: Partial<ManualPricingRow>) => {
    setManualPricingRows((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;

        const next = { ...item, ...patch, id: item.id } as Partial<ManualPricingRow>;
        if (typeof patch.endpointUrl === 'string') {
          const endpoint = extractWuyinAsyncEndpointDetails(patch.endpointUrl);
          if (endpoint) {
            next.endpointUrl = endpoint.endpointUrl;
            next.model = endpoint.modelId;
            next.modelName = endpoint.modelId;
            if (!String(next.unit || '').trim()) {
              next.unit = guessManualBillingUnit(endpoint.modelId);
            }
          } else if (isCurrentWuyinCatalogMode) {
            next.model = '';
            next.modelName = '';
          }
        }

        return createManualPricingRow(next);
      })
    );
  };

  const handleRemoveManualPricingRow = (rowId: string) => {
    setManualPricingRows((prev) => prev.filter((item) => item.id !== rowId));
  };

  const injectPricingOverrides = (pricingSnapshot?: ProviderPricingSnapshot, sourceData?: any[]) => {
    const rawPricingData = sourceData || pricingSnapshot?._rawData;
    if (!rawPricingData?.length) return;

    const groupRatioMap = pricingSnapshot?.groupRatioMap || {};
    const defaultGroupRatio =
      getDefaultGroupRatio(groupRatioMap) ||
      (typeof pricingSnapshot?.groupRatio === 'number' ? pricingSnapshot.groupRatio : 1);

    const enrichedData = rawPricingData.map((item: any) => ({
      ...item,
      model: getPricingModelId(item),
      group_ratio: item.group_ratio ?? defaultGroupRatio,
    }));

    mergeModelPricingOverrides(enrichedData);
  };
  const handleSaveProvider = async () => {
    const name = providerForm.name.trim();
    const baseUrl = providerForm.baseUrl.trim();
    const apiKey = providerForm.apiKey.trim();
    const existingProvider = providerForm.id ? providers.find((item) => item.id === providerForm.id) : undefined;

    if (!name || !baseUrl || !apiKey) {
      notify.error('保存失败', '请填写供应商名称、基础地址和 API Key。');
      return;
    }

    setSavingProviderId(providerForm.id || 'new');

    const { budgetLimit, tokenLimit } = parseCost(providerForm.costMode, providerForm.costValue);

    let models: string[] = [];
    let pricingModelNames: string[] = effectivePricingModels
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    try {
      const detect = await autoDetectAndConfigureModels(apiKey, baseUrl, providerForm.format);
      models = detect.models || [];
    } catch (error) {
      console.warn('[ApiSettings] detect models before save failed', error);
      models = existingProvider?.models || [];
    }

    if ((!models || models.length === 0) && pricingModelNames.length > 0) {
      models = pricingModelNames;
    }

    if ((!models || models.length === 0) && currentWuyinEndpointModelId) {
      models = [currentWuyinEndpointModelId];
    }

    if ((!models || models.length === 0) && existingProvider?.models?.length) {
      models = existingProvider.models;
    }

    let pricingSnapshot: ProviderPricingSnapshot | undefined;
    const sourcePricingData = effectivePricingData;

    // Keep pricing sync manual so saving stays fast and avoids pricing fetch errors.
    if (sourcePricingData.length) {
      pricingSnapshot = buildProviderPricingSnapshot(sourcePricingData, advancedResult?.groupRatio, {
        fetchedAt: advancedResult?.fetchedAt || Date.now(),
        note: advancedResult?.pricingHint || (manualPricingRows.length > 0 ? `已手动维护 ${manualPricingRows.length} 个模型价格` : undefined),
      });
    }

    if (!pricingSnapshot && existingProvider?.pricingSnapshot) {
      pricingSnapshot = existingProvider.pricingSnapshot;
    }

    const snapshotModelNames = (pricingSnapshot?.rows || [])
      .map((item) => String(item?.model || '').trim())
      .filter(Boolean);

    const mergedModels = Array.from(new Set(
      [...models, ...pricingModelNames, ...snapshotModelNames]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    ));

    if (mergedModels.length > 0) {
      models = mergedModels;
    }

    const payload = {
      name,
      baseUrl,
      apiKey,
      group: currentProviderSupportsGroups ? (providerForm.group.trim() || undefined) : undefined,
      models,
      format: providerForm.format,
      isActive: providerForm.isActive,
      budgetLimit,
      tokenLimit,
      customCostMode: providerForm.costMode,
      customCostValue: providerForm.costValue,
      providerColor: providerForm.providerColor,
      badgeColor: providerForm.providerColor,
      pricingSnapshot,
    };

    try {
      let persistedProviderId = providerForm.id;

      if (providerForm.id) {
        const ok = keyManager.updateProvider(providerForm.id, payload);
        if (!ok) {
          notify.error('保存失败', '供应商更新失败。');
          return;
        }
        notify.success('保存成功', '供应商配置已更新。');
      } else {
        const createdProvider = keyManager.addProvider(payload as any);
        persistedProviderId = createdProvider.id;
        setHighlightedProviderId(createdProvider.id);
        window.setTimeout(() => {
          setHighlightedProviderId((prev) => (prev === createdProvider.id ? null : prev));
        }, 2400);
        notify.success('添加成功', '供应商配置已保存。');
      }

      injectPricingOverrides(pricingSnapshot, sourcePricingData);

      refresh();

      if (persistedProviderId) {
        const persistedProvider = keyManager.getProviders().find((item) => item.id === persistedProviderId);
        if (persistedProvider) {
          setProviderForm(toProviderForm(persistedProvider));
          setShowProviderCreateForm(true);
        }
      }
    } catch (error: any) {
      notify.error('保存失败', error?.message || '无法保存供应商配置。');
    } finally {
      setSavingProviderId(null);
    }
  };

  const handleDeleteOfficial = (id: string) => {
    if (!window.confirm('确认删除该官方接口吗？')) return;
    keyManager.removeKey(id);
    if (officialForm.id === id) resetOfficialForm(true);
    notify.success('删除成功', '官方接口已删除。');
    refresh();
  };

  const handleToggleOfficial = async (slot: KeySlot) => {
    const nextDisabled = !slot.disabled;

    try {
      await keyManager.updateKey(slot.id, { disabled: nextDisabled });
      const nextSlot = keyManager.getSlots().find((item) => item.id === slot.id);
      refresh();

      if (nextSlot && officialForm.id === slot.id) {
        loadOfficialToForm(nextSlot);
      }

      notify.success(nextDisabled ? '已暂停' : '已启用', `${slot.name || '官方接口'} 状态已更新。`);
    } catch (error: any) {
      notify.error('状态更新失败', error?.message || '无法更新官方接口状态。');
    }
  };

  const handleDeleteProvider = (id: string) => {
    if (!window.confirm('确认删除该供应商吗？')) return;
    const ok = keyManager.removeProvider(id);
    if (!ok) {
      notify.error('删除失败', '供应商删除失败。');
      return;
    }
    if (providerForm.id === id) resetThirdPartyForm(true);
    notify.success('删除成功', '供应商已删除。');
    refresh();
  };

  const handleRefreshProvider = (provider: ThirdPartyProvider) => {
    refresh();

    if (providerForm.id === provider.id && showProviderCreateForm) {
      const latestProvider = keyManager.getProviders().find((item) => item.id === provider.id);
      if (latestProvider) {
        loadProviderToForm(latestProvider);
      }
    }

    setHighlightedProviderId(provider.id);
    window.setTimeout(() => {
      setHighlightedProviderId((prev) => (prev === provider.id ? null : prev));
    }, 1400);
    notify.success('已刷新', `${provider.name} 的最新状态已载入。`);
  };

  const handleToggleProvider = (provider: ThirdPartyProvider) => {
    const nextActive = !provider.isActive;
    keyManager.updateProvider(provider.id, { isActive: nextActive });
    if (providerForm.id === provider.id) {
      setProviderForm((prev) => ({ ...prev, isActive: nextActive }));
    }
    notify.success(provider.isActive ? '已停用' : '已启用', `${provider.name} 状态已更新。`);
    refresh();
  };

  const handleValidateProvider = async (provider: ThirdPartyProvider) => {
    setDetectingProviderId(provider.id);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const detect = await autoDetectAndConfigureModels(provider.apiKey, provider.baseUrl, provider.format);
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = Math.max(1, Math.round(endedAt - startedAt));

      if (detect.success) {
        keyManager.updateProvider(provider.id, {
          models: detect.models,
          status: 'active',
          lastChecked: Date.now(),
          lastError: undefined,
          activitySummary: buildUpdatedProviderActivitySummary(provider, {
            lastLatencyMs: latencyMs,
          }),
        } as any);
        notify.success('校验成功', `已获取 ${detect.models.length} 个模型。`);
      } else {
        keyManager.updateProvider(provider.id, {
          status: 'error',
          lastChecked: Date.now(),
          lastError: '模型获取失败，已保留原有列表。',
          activitySummary: buildUpdatedProviderActivitySummary(provider, {
            lastLatencyMs: latencyMs,
          }),
        } as any);
        notify.error('校验失败', '无法获取模型列表，已保留原有配置。');
      }
      refresh();
    } catch (error: any) {
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = Math.max(1, Math.round(endedAt - startedAt));
      keyManager.updateProvider(provider.id, {
        status: 'error',
        lastChecked: Date.now(),
        lastError: error?.message || '连接失败',
        activitySummary: buildUpdatedProviderActivitySummary(provider, {
          lastLatencyMs: latencyMs,
        }),
      } as any);
      notify.error('校验失败', error?.message || '供应商连接失败。');
      refresh();
    } finally {
      setDetectingProviderId(null);
    }
  };

  const handleSyncPricing = async (provider: ThirdPartyProvider) => {
    setSyncingProviderId(provider.id);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      // 🚀 [Fix] 传递 API Key 以支持需要认证的接口
      const result = await fetchPricingFromUrl(provider.baseUrl, provider.apiKey);
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = Math.max(1, Math.round(endedAt - startedAt));
      if (!result?.pricingData?.length) {
        keyManager.updateProvider(provider.id, {
          activitySummary: buildUpdatedProviderActivitySummary(provider, {
            lastLatencyMs: latencyMs,
          }),
        });
        notify.error('同步失败', '未从价格页获取到基础价和倍率。请检查供应商地址和 API Key 是否正确。');
        return;
      }

      const pricingSnapshot = buildProviderPricingSnapshot(result.pricingData, result.groupRatio, {
        fetchedAt: result.fetchedAt,
        note: result.pricingHint,
      });

      keyManager.updateProvider(provider.id, {
        pricingSnapshot,
        models: result.models.length ? result.models : provider.models,
        activitySummary: buildUpdatedProviderActivitySummary(provider, {
          lastLatencyMs: latencyMs,
        }),
      });

      injectPricingOverrides(pricingSnapshot, result.pricingData);
      notify.success('同步成功', `已更新 ${result.models.length} 个模型价格。`);

      if (providerForm.id === provider.id) {
        setAdvancedResult(result);
        setShowAdvancedMode(true);
        if (isNoGroupProvider(provider.baseUrl)) {
          setProviderForm((prev) => ({ ...prev, group: '' }));
        } else if (!providerForm.group && result.availableGroups?.length) {
          setProviderForm((prev) => ({ ...prev, group: prev.group || result.availableGroups?.[0] || '' }));
        }
      }
      refresh();
    } catch (error: any) {
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const latencyMs = Math.max(1, Math.round(endedAt - startedAt));
      keyManager.updateProvider(provider.id, {
        status: 'error',
        lastError: error?.message || '价格同步失败',
        activitySummary: buildUpdatedProviderActivitySummary(provider, {
          lastLatencyMs: latencyMs,
        }),
      } as any);
      notify.error('同步失败', error?.message || '价格同步失败。');
      refresh();
    } finally {
      setSyncingProviderId(null);
    }
  };

  const handleFetchAndSyncPricing = async () => {
    if (currentEditingProvider) {
      await handleSyncPricing(currentEditingProvider);
      return;
    }

    await handleDetectAdvanced();
  };

  const renderCostEditor = (
    costMode: CostMode,
    costValue: number,
    onModeChange: (mode: CostMode) => void,
    onValueChange: (value: number) => void
  ) => (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <div className="mb-1 text-xs text-[var(--text-tertiary)]">计费模式</div>
        <FormSelect
          value={costMode}
          onChange={(value) => onModeChange(value as CostMode)}
          options={[
            { value: 'unlimited', label: '无限' },
            { value: 'amount', label: '金额' },
            { value: 'tokens', label: 'Tokens' },
          ]}
        />
      </div>

      <div>
        <div className="mb-1 text-xs text-[var(--text-tertiary)]">
          {costMode === 'amount' ? '金额额度' : costMode === 'tokens' ? 'Token 额度' : '额度'}
        </div>
        <input
          className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
          style={formFieldStyle}
          type="number"
          min={0}
          disabled={costMode === 'unlimited'}
          value={costMode === 'unlimited' ? 0 : costValue}
          onChange={(event) => onValueChange(Number(event.target.value || 0))}
        />
      </div>
    </div>
  );

  const renderOfficialDetailCard = () => {
    if (!showOfficialCreateForm) {
      return (
        <div className="api-settings-editor-card overflow-hidden rounded-[10px]" style={elevatedPanelStyle}>
          <div className="border-b px-5 py-4" style={headerPanelStyle}>
            <div className="text-base font-semibold text-[var(--text-primary)]">官方接口工作区</div>
            <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              左侧选择接口，右侧统一处理名称、Key、预算和暂停操作。
            </div>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              <div className="rounded-[10px] p-5" style={overlayPanelStyle}>
                <div className="text-sm font-semibold text-[var(--text-primary)]">未选择官方接口</div>
                <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  官方接口的模型地址和价格是内置的，所以这里只保留最必要的配置项。
                </div>
              </div>

              <button
                className="apple-button-primary h-10 w-full text-sm"
                onClick={() => {
                  setOfficialForm(defaultOfficialForm);
                  setShowOfficialCreateForm(true);
                }}
              >
                <Plus size={14} />新增官方接口
              </button>
            </div>
          </div>
        </div>
      );
    }

    const mode = officialForm.id ? 'edit' : 'create';
    const officialStatusLabel = currentOfficialSlot
      ? (currentOfficialSlot.disabled ? '已暂停' : '已启用')
      : '待保存';
    const officialStatusTone: StatusTone = currentOfficialSlot
      ? (currentOfficialSlot.disabled ? 'slate' : 'green')
      : 'indigo';
    const officialAutoName =
      officialForm.name.trim() || currentOfficialSlot?.name || buildOfficialAutoName(officialEntries.length + (officialForm.id ? 0 : 1));

    return (
      <div className="settings-section-card space-y-4 rounded-[24px] p-5" style={elevatedPanelStyle}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-[var(--text-primary)]">
              {mode === 'edit' ? '编辑官方接口' : '新增官方接口'}
            </div>
            <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              {mode === 'edit'
                ? '这里保留名称、API Key、预算和暂停状态，模型地址与价格继续使用内置配置。'
                : '创建时只需录入 API Key 即可启用，名称会自动生成，后续如有需要再进入详情调整。'}
            </div>
            <div className="mt-3 settings-quiet-meta">
              <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                {mode === 'edit' ? '已选择已保存接口' : '正在创建新接口'}
              </span>
              <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                额度模式 {costModeText[officialForm.costMode]}
              </span>
              <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                {mode === 'edit' ? officialStatusLabel : `默认名称 ${officialAutoName}`}
              </span>
            </div>
          </div>

          <StatusBadge label={officialStatusLabel} tone={officialStatusTone} compact />
        </div>

        <div className="grid gap-4 rounded-[10px] p-4" style={overlayPanelStyle}>
          {mode === 'edit' ? (
            <div>
              <div className="mb-1 text-xs text-[var(--text-tertiary)]">名称</div>
              <input
                className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                style={formFieldStyle}
                value={officialForm.name}
                onChange={(event) => setOfficialForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="例如：主账号"
              />
            </div>
          ) : (
            <div className="rounded-[10px] px-3 py-3 text-sm" style={elevatedPanelStyle}>
              <div className="text-[11px] text-[var(--text-tertiary)]">默认名称</div>
              <div className="mt-1 font-medium text-[var(--text-primary)]">{officialAutoName}</div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs text-[var(--text-tertiary)]">API Key</div>
            <input
              className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
              style={formFieldStyle}
              value={officialForm.key}
              onChange={(event) => setOfficialForm((prev) => ({ ...prev, key: event.target.value }))}
              placeholder="输入官方 API Key"
            />
          </div>

          {currentOfficialSlot ? (
            <div className="rounded-[10px] p-3" style={elevatedPanelStyle}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">运行状态</div>
                  <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                    暂停后不会参与调度，但会保留当前 Key、预算和历史消耗。
                  </div>
                </div>
                <button
                  type="button"
                  className="apple-button-secondary h-9 px-4 text-sm"
                  style={secondaryButtonStyle}
                  onClick={() => void handleToggleOfficial(currentOfficialSlot)}
                >
                  {currentOfficialSlot.disabled ? <Play size={14} /> : <Pause size={14} />}
                  {currentOfficialSlot.disabled ? '恢复使用' : '暂停接口'}
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">额度与预算</div>
            {renderCostEditor(
              officialForm.costMode,
              officialForm.costValue,
              (costMode) => setOfficialForm((prev) => ({ ...prev, costMode })),
              (costValue) => setOfficialForm((prev) => ({ ...prev, costValue }))
            )}
          </div>

          {currentOfficialSlot ? (
            <div className="api-settings-summary-list rounded-[10px] p-3" style={elevatedPanelStyle}>
              <div className="api-settings-summary-item">
                <span className="api-settings-summary-item__label">当前总额度</span>
                <span className="api-settings-summary-item__value">{currentOfficialBudgetPreview.total}</span>
              </div>
              <div className="api-settings-summary-item">
                <span className="api-settings-summary-item__label">当前已使用</span>
                <span className="api-settings-summary-item__value" style={{ color: 'var(--state-warning-text)' }}>
                  {currentOfficialBudgetPreview.used}
                </span>
              </div>
              <div className="api-settings-summary-item">
                <span className="api-settings-summary-item__label">当前剩余</span>
                <span
                  className="api-settings-summary-item__value"
                  style={{
                    color:
                      isBudgetDepleted(currentOfficialBudgetPreview.remaining)
                        ? 'var(--state-danger-text)'
                        : 'var(--state-success-text)',
                  }}
                >
                  {currentOfficialBudgetPreview.remaining}
                </span>
              </div>
            </div>
          ) : null}

          <div className="settings-action-row">
            <button className="apple-button-primary h-9 px-4 text-sm" onClick={() => void handleSaveOfficial()}>
              <Save size={14} />{mode === 'edit' ? '保存修改' : '添加接口'}
            </button>
            <button className="apple-button-secondary h-9 px-4 text-sm" style={secondaryButtonStyle} onClick={() => resetOfficialForm(true)}>
              <XCircle size={14} />取消
            </button>
          </div>
        </div>

        {currentOfficialSlot ? (
          <SettingsDangerZone
            title="危险操作"
            description="删除后会立即移除这条官方接口配置，已保存的 Key 不可恢复。"
            action={(
              <button className="apple-button-danger h-9 px-4 text-sm" onClick={() => handleDeleteOfficial(currentOfficialSlot.id)}>
                <Trash2 size={14} />删除接口
              </button>
            )}
          />
        ) : null}
      </div>
    );
  };

  const renderProviderForm = () => {
    const mode = providerForm.id ? 'edit' : 'create';
    const canOperateOnCurrentProvider = Boolean(currentEditingProvider);
    const isPricingSyncMode = currentProviderWorkbenchMode === 'pricing-sync';
    const isModelDetectMode = currentProviderWorkbenchMode === 'model-detect';
    const isEndpointModelMode = currentProviderWorkbenchMode === 'endpoint-model';
    const workbenchPriceStatus: StatusMeta =
      currentProviderSnapshotCount > 0
        ? {
            label: isEndpointModelMode ? '接口价格已就绪' : isModelDetectMode ? '手动价格已就绪' : isCurrentManualPricingOnlyProvider ? '价格快照已就绪' : '已准备价格',
            tone: 'green',
            helper: isCurrentManualPricingOnlyProvider
              ? `当前已保存 ${currentProviderSnapshotCount} 条价格快照记录，不支持直接扫描供应商价格接口。`
              : `当前已准备 ${currentProviderSnapshotCount} 条价格记录`,
          }
        : isPricingSyncMode
          ? {
              label: isCurrentWuyinCatalogMode ? '待读取目录' : isCurrentManualPricingOnlyProvider ? '待维护价格' : '待同步价格',
              tone: 'amber',
              helper: isCurrentWuyinCatalogMode
                ? '先读取目录价格，再补充具体接口单价。'
                : isCurrentManualPricingOnlyProvider
                  ? '该供应商没有兼容的价格扫描接口，请手动维护或导入价格快照。'
                  : '先同步价格，再确认分组和预算。',
            }
          : isModelDetectMode
            ? {
                label: manualPricingRows.length > 0 ? '已手动定价' : '需手动定价',
                tone: manualPricingRows.length > 0 ? 'green' : 'amber',
                helper: manualPricingRows.length > 0 ? '价格将以手动维护结果为准。' : '该供应商没有可直接读取的价格接口。',
              }
            : {
                label: currentWuyinEndpointModelId ? '接口已识别模型' : '待识别接口',
                tone: currentWuyinEndpointModelId ? 'indigo' : 'amber',
                helper: currentWuyinEndpointModelId
                  ? `当前接口模型为 ${currentWuyinEndpointModelId}`
                  : '请填写完整 async 接口地址，让系统识别模型。',
              };
    const nextPendingStep = providerWorkflowSteps.find((step) => !step.complete);
    const priceSyncStatus = workbenchPriceStatus;
    const workbenchLead = isEndpointModelMode
      ? (mode === 'edit'
        ? '当前供应商会直接从 async 接口地址识别模型，界面会收敛成接口地址、单价和预算，不再展示通用模型校验与分组流程。'
        : '先填写完整的 async 接口地址与 API Key，保存后即可按接口识别模型并维护单价。')
      : isModelDetectMode
        ? (mode === 'edit'
          ? '当前供应商没有稳定的价格接口，建议先通过接口识别模型，再在下方手动维护价格。'
          : '先补齐基础连接并保存，随后通过接口识别模型，再手动补齐价格。')
        : (mode === 'edit'
          ? (isCurrentWuyinCatalogMode
            ? '当前供应商支持读取目录价格；如果后续要直接生成，可在下方继续补充具体 async 接口单价。'
            : isCurrentManualPricingOnlyProvider
              ? '当前供应商没有兼容的价格扫描接口，这里展示的是现有价格快照与分组定价；实际生成会按当前生效分组计费。'
              : '当前供应商支持直接抓取价格与分组，连接、模型校验和价格同步统一在这里处理。')
          : '先补齐基础连接并保存，然后同步价格与模型。');
    const workbenchReadyText = nextPendingStep
      ? `下一步：${nextPendingStep.label}`
      : (isEndpointModelMode
        ? '接口地址与单价已就绪'
        : isModelDetectMode
          ? '模型识别与手动价格已就绪'
          : '价格与模型同步已就绪');
    const workbenchSummaryCards = [
      { label: '基础地址', value: editingProviderBaseUrl || '待填写' },
      {
        label: isEndpointModelMode ? '接口模型' : isModelDetectMode ? '工作方式' : '价格能力',
        value: isEndpointModelMode
          ? (currentWuyinEndpointModelId || '待从接口识别')
          : isModelDetectMode
            ? (canOperateOnCurrentProvider ? '接口识别 / 手动定价' : '保存后通过接口识别')
            : (isCurrentWuyinCatalogMode ? '目录读取 / 接口补充' : '自动抓取 / 分组同步'),
      },
      { label: '模型 / 价格', value: `${currentProviderModelCount} / ${currentProviderSnapshotCount}` },
      {
        label: isEndpointModelMode ? '最近维护' : isModelDetectMode ? '最近识别' : (isCurrentWuyinCatalogMode ? '最近读取' : '最近价格'),
        value: isModelDetectMode
          ? (currentEditingProvider?.lastChecked ? formatDate(currentEditingProvider.lastChecked) : '未识别')
          : (currentProviderLastSync ? formatDate(currentProviderLastSync) : (isEndpointModelMode ? '未维护' : (isCurrentWuyinCatalogMode ? '未读取' : '未同步'))),
      },
    ];
    const workbenchSummaryRows = isPricingSyncMode
      ? [
          { label: isCurrentWuyinCatalogMode ? '目录状态' : isCurrentManualPricingOnlyProvider ? '快照状态' : '价格状态', value: workbenchPriceStatus.label },
          { label: '可用分组', value: String(currentProviderGroupCount) },
          {
            label: isCurrentWuyinCatalogMode ? '最近读取' : isCurrentManualPricingOnlyProvider ? '最近校准' : '最近同步',
            value: currentProviderLastSync
              ? formatDate(currentProviderLastSync)
              : (isCurrentWuyinCatalogMode ? '未读取' : isCurrentManualPricingOnlyProvider ? '未校准' : '未同步'),
          },
        ]
      : isModelDetectMode
        ? [
            { label: '模型识别', value: canOperateOnCurrentProvider ? '可调用接口识别' : '保存后可识别' },
            { label: '已识别模型', value: String(currentProviderModelCount) },
            { label: '最近识别', value: currentEditingProvider?.lastChecked ? formatDate(currentEditingProvider.lastChecked) : '未识别' },
          ]
        : [
            { label: '接口模型', value: currentWuyinEndpointModelId || '待识别' },
            { label: '价格记录', value: String(currentProviderSnapshotCount) },
            { label: '最近维护', value: currentProviderLastSync ? formatDate(currentProviderLastSync) : '未维护' },
          ];
    const connectionAddressLabel = isEndpointModelMode ? '接口地址' : isCurrentWuyinCatalogMode ? '目录地址' : '基础地址';
    const connectionAddressPlaceholder = isCurrentProviderWuyin
      ? (isCurrentWuyinCatalogMode ? 'https://api.wuyinkeji.com' : 'https://api.wuyinkeji.com/api/async/image_nanoBanana2')
      : 'https://example.com/v1';
    const connectionSectionDescription = isEndpointModelMode
      ? '名称、颜色、async 接口地址和 API Key 在这里统一维护。'
      : isModelDetectMode
        ? '名称、颜色、基础地址和 API Key 先补齐，后续通过接口识别模型。'
        : '名称、颜色、基础地址和 API Key 都在这里统一维护。';
    const connectionAddressHint = isEndpointModelMode
      ? '填写完整的 async 接口地址。模型会直接从接口路径识别，保存后可继续维护接口单价。'
      : isCurrentWuyinCatalogMode
        ? '当前是五音目录型地址，不显示协议和通用校验。你可以先读取目录价格，再补充具体 async 接口单价。'
        : isCurrentProviderWuyin
          ? '五音科技可填写根地址或具体 async 接口地址。填入 async 接口后，系统会按单接口识别模型并发起请求。'
          : isModelDetectMode
            ? '该供应商没有稳定的价格接口，保存后会优先通过接口识别模型，再在下方手动维护价格。'
            : '填写供应商的基础调用地址，保存后用于模型校验、价格同步与实际生成请求。';
    const connectionFootnote = isEndpointModelMode
      ? '接口识别型供应商固定走 async 单接口，不使用 `/v1/models` 和分组。'
      : isCurrentWuyinCatalogMode
        ? '目录型地址只用于识别五音厂商和维护目录价格，不直接承担生成请求。'
        : isCurrentProviderWuyin
          ? '五音科技为异步厂商：图片会调用你填写的 async 接口，结果查询固定走 `/api/async/detail?id=...`。'
          : isModelDetectMode
          ? '该类供应商优先使用接口识别模型，不依赖价格页或目录接口。'
          : 'OpenAI 兼容会调用 `/v1/chat/completions`；Gemini 原生会调用 `/v1beta/models/...:generateContent?key=...`。';
    const workbenchSectionTitle = isPricingSyncMode
      ? (isCurrentWuyinCatalogMode
        ? '目录读取与接口补价'
        : isCurrentManualPricingOnlyProvider
          ? '价格快照与手动校准'
          : '价格抓取与校验')
      : isModelDetectMode
        ? '模型识别'
        : '接口识别';
    const workbenchSectionDescription = isPricingSyncMode
      ? (isCurrentWuyinCatalogMode
        ? '这里不是通用价格抓取模块。目录型供应商会先读取目录价格，再按需补充具体 async 接口单价。'
        : isCurrentManualPricingOnlyProvider
          ? '该供应商没有兼容的价格扫描接口。这里展示的是你当前保存的价格快照与分组价格，实际生成会按当前生效分组计费。'
          : '这类供应商支持直接拉价格，先同步价格，再决定是否补充模型校验。')
      : isModelDetectMode
        ? '这类供应商没有稳定的价格接口，流程先落在模型识别，价格交给下方手动维护。'
        : '这类供应商的模型由接口地址直接决定，因此这里不再展示通用模型校验和价格同步按钮。';
    const supportsProtocolSelection = !isCurrentProviderWuyin;
    const advancedPanelTitle = isPricingSyncMode
      ? (isCurrentWuyinCatalogMode ? '目录价格与接口单价' : '价格同步与快照')
      : isModelDetectMode
        ? '模型识别与手动定价'
        : '接口识别与单价';
    const advancedPanelDescription = isPricingSyncMode
      ? (isCurrentWuyinCatalogMode
        ? '先读取目录价格，再补充具体 async 接口单价，目录类供应商和普通手动定价彻底分开。'
        : '把价格扫描、分组倍率和最终价格明细收在同一个区域，避免在列表和表单之间来回跳。')
      : isModelDetectMode
        ? '先识别模型，再按模型手动维护价格。不会再展示抓价型供应商的同步说明。'
        : '模型由接口地址直接决定，这里只保留接口识别和接口单价，不再显示通用模型校验与价格同步。';
    const advancedBadgeLabel = isEndpointModelMode
      ? (currentWuyinEndpointModelId ? '已识别接口' : '待识别接口')
      : isModelDetectMode
        ? (currentProviderModelCount > 0 ? '已识别模型' : '待识别模型')
        : (isCurrentWuyinCatalogMode
          ? (currentProviderSnapshotCount > 0 ? '已读取目录' : '待读取目录')
          : (currentProviderSnapshotCount > 0 ? '已同步价格' : '待同步价格'));
    const fetchPricingActionLabel = syncingProviderId === currentEditingProvider?.id || advancedLoading
      ? (isCurrentWuyinCatalogMode ? '读取中...' : '获取中...')
      : (isCurrentWuyinCatalogMode
        ? (currentProviderSnapshotCount > 0 ? '重新读取目录价格' : '读取目录价格')
        : (currentProviderSnapshotCount > 0 ? '重新获取价格' : '获取价格'));
    const validateActionLabel = detectingProviderId === currentEditingProvider?.id
      ? (isModelDetectMode ? '识别中...' : '校验中...')
      : (isModelDetectMode
        ? (currentProviderModelCount > 0 ? '重新识别模型' : '识别模型')
        : '重新校验模型');
    const scanActionLabel = advancedLoading
      ? (isCurrentWuyinCatalogMode ? '读取中...' : '获取中...')
      : (isCurrentWuyinCatalogMode ? '读取产品目录' : (currentProviderSnapshotCount > 0 ? '重新获取价格' : '获取价格'));
    const manualAddLabel = currentProviderUsesEndpointPricingRows ? '手动添加接口' : '手动添加模型';
    const manualSummaryLabel = advancedResult?.fetchedAt
      ? `${isCurrentWuyinCatalogMode ? '最近读取' : isModelDetectMode ? '最近识别' : isEndpointModelMode ? '最近维护' : '最近扫描'}：${formatDate(advancedResult.fetchedAt)}`
      : manualPricingRows.length > 0
        ? `当前已手动维护 ${manualPricingRows.length} 个${currentProviderUsesEndpointPricingRows ? '接口' : '模型'}`
        : '';
    const pricingLeadText = advancedResult?.pricingHint || (
      manualPricingRows.length > 0
        ? (
          currentProviderUsesEndpointPricingRows
            ? `已维护 ${manualPricingRows.length} 个接口价格，保存后会按对应 async 接口发起生成。`
            : `已手动维护 ${manualPricingRows.length} 个模型价格，可直接填写每张、每秒或每次费用。`
        )
        : (isModelDetectMode
          ? '先识别模型，再在下方补齐手动价格。'
          : isEndpointModelMode
            ? '先识别接口模型，再维护接口单价。'
            : '当前没有可展示的价格信息。')
    );
    const pricingSourceLabel = isCurrentWuyinCatalogMode ? '目录来源' : isEndpointModelMode ? '接口来源' : isModelDetectMode ? '识别来源' : '扫描来源';
    const pricingSourceValue = advancedResult?.apiType || (isCurrentWuyinCatalogMode ? 'catalog' : isEndpointModelMode ? 'endpoint' : 'manual');
    const manualPricingTitle = currentProviderUsesEndpointPricingRows ? '手动接口价格' : '手动模型单价';
    const manualPricingDescription = currentProviderUsesEndpointPricingRows
      ? (isEndpointModelMode
        ? '填写当前接口地址、单价和单位。保存后生成时会优先按这里记录的 async 接口请求。'
        : '填写五音 async 接口地址、单价和单位。目录读取之外的直连接口价格，都在这里补齐。')
      : isModelDetectMode
        ? '适合没有稳定价格页、只能先识别模型的供应商。识别完成后在这里手动维护单价。'
        : '当自动同步没有覆盖全部模型时，可在这里补充或覆盖具体模型价格。';
    const manualPricingEmptyText = currentProviderUsesEndpointPricingRows
      ? '还没有手动接口。点击“手动添加接口”后填写完整的 async 接口地址，例如 https://api.wuyinkeji.com/api/async/image_nanoBanana2。'
      : isModelDetectMode
        ? '还没有手动模型。先执行“识别模型”，再点击“手动添加模型”补齐价格。'
        : '还没有手动模型。你可以点击“手动添加模型”，补充自动同步未覆盖的价格。';
    const manualPricingGridClass = currentProviderUsesEndpointPricingRows
      ? 'sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr),120px,120px,110px,96px]'
      : 'sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr),minmax(0,1.1fr),120px,120px,96px]';

    return (
      <div className="space-y-4">
        <div className="rounded-[10px] p-4" style={overlayPanelStyle}>
          <div className="flex flex-col gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: providerForm.providerColor }} />
                <div className="min-w-0 break-words text-lg font-semibold text-[var(--text-primary)]">{editingProviderName}</div>
                <StatusBadge label={currentProviderStatus.label} tone={currentProviderStatus.tone} compact />
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {isEndpointModelMode
                  ? (mode === 'edit'
                    ? '当前是接口识别型供应商，详情页只保留接口地址、预算与接口单价。'
                    : '先保存接口识别型供应商，再按接口模型维护单价。')
                  : isCurrentWuyinCatalogMode
                    ? (mode === 'edit'
                      ? '当前是五音目录型供应商，只维护目录地址、API Key、目录价格和额度。'
                      : '先保存五音目录型供应商，再在下方维护目录价格与接口单价。')
                  : isModelDetectMode
                    ? (mode === 'edit'
                      ? '当前供应商没有稳定的价格接口，详情页会先引导识别模型，再单独维护价格。'
                      : '先补齐基础连接并保存，再继续识别模型和维护价格。')
                  : mode === 'edit'
                    ? '当前供应商的连接、校验和价格同步都集中在这里处理。'
                    : '先补齐基础连接并保存，再继续校验模型和同步价格。'}
              </div>

              <div className="mt-3 rounded-[10px] px-3 py-3 text-xs leading-5 text-[var(--text-secondary)]" style={elevatedPanelStyle}>
                {workbenchLead}
              </div>

              <div className="mt-3 settings-quiet-meta">
                <StatusBadge label={currentProviderWorkbenchMeta.label} tone={currentProviderWorkbenchMeta.tone} compact />
                <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                  额度模式 {costModeText[providerForm.costMode]}
                </span>
                <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                  {providerForm.apiKey.trim() ? 'API Key 已填写' : 'API Key 待填写'}
                </span>
                <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                  {providerForm.isActive ? '当前启用' : '当前停用'}
                </span>
                <span className="settings-inline-chip rounded-full border px-3 py-1.5 text-xs text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                  {nextPendingStep ? `下一步：${nextPendingStep.label}` : workbenchReadyText}
                </span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {workbenchSummaryCards.map((row) => (
                <div key={row.label} className="rounded-[10px] p-3" style={elevatedPanelStyle}>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{row.label}</div>
                  <div className="mt-1 min-w-0 break-words text-sm font-medium text-[var(--text-primary)]">{row.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4">
            <div className="rounded-[10px] p-4" style={overlayPanelStyle}>
              <div className="mb-3">
                <div className="text-sm font-semibold text-[var(--text-primary)]">基础连接</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{connectionSectionDescription}</div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),minmax(280px,0.9fr)]">
                <div>
                  <div className="mb-1 text-xs text-[var(--text-tertiary)]">供应商名称</div>
                  <input className="h-10 w-full rounded-[10px] px-3 text-sm outline-none" style={formFieldStyle} value={providerForm.name} onChange={(event) => setProviderForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="例如：12AI" />
                </div>

                <div>
                  <div className="mb-1 text-xs text-[var(--text-tertiary)]">供应商颜色</div>
                  <div className="grid gap-3 sm:grid-cols-[72px,minmax(0,1fr),auto]">
                    <input className="h-10 w-16 rounded-[10px] p-1" style={{ borderColor: 'var(--settings-input-border)', backgroundColor: 'var(--settings-input-bg)' }} type="color" value={providerForm.providerColor} onChange={(event) => setProviderForm((prev) => ({ ...prev, providerColor: event.target.value }))} />
                    <input className="h-10 flex-1 rounded-[10px] px-3 text-sm outline-none" style={formFieldStyle} value={providerForm.providerColor} onChange={(event) => setProviderForm((prev) => ({ ...prev, providerColor: event.target.value }))} />
                    <button
                      type="button"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3 text-sm"
                      style={secondaryButtonStyle}
                      onClick={() => applyRandomProviderColor(providerForm.id)}
                      title="随机分配一个和其他供应商尽量不重复的颜色"
                    >
                      <Shuffle size={14} />随机
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <div className="mb-1 text-xs text-[var(--text-tertiary)]">{connectionAddressLabel}</div>
                  <input
                    className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                    style={formFieldStyle}
                    value={providerForm.baseUrl}
                    onChange={(event) => setProviderForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
                    placeholder={connectionAddressPlaceholder}
                  />
                  <div className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                    {connectionAddressHint}
                    {currentWuyinEndpointModelId ? ` 当前已识别接口模型：${currentWuyinEndpointModelId}。` : ''}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs text-[var(--text-tertiary)]">API Key</div>
                  <input className="h-10 w-full rounded-[10px] px-3 text-sm outline-none" style={formFieldStyle} value={providerForm.apiKey} onChange={(event) => setProviderForm((prev) => ({ ...prev, apiKey: event.target.value }))} placeholder="输入第三方供应商 API Key" />
                </div>

                {supportsProtocolSelection && mode === 'edit' ? (
                  <div>
                    <div className="mb-1 text-xs text-[var(--text-tertiary)]">协议格式</div>
                    <select
                      className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                      style={formFieldStyle}
                      value={providerForm.format}
                      onChange={(event) => setProviderForm((prev) => ({ ...prev, format: event.target.value as ApiProtocolFormat }))}
                    >
                      <option value="openai">OpenAI 兼容</option>
                      <option value="gemini">Gemini 原生</option>
                      <option value="auto">自动检测</option>
                    </select>
                  </div>
                ) : null}
              </div>
              {supportsProtocolSelection && mode === 'create' ? (
                <div className="mt-3 rounded-[10px] border border-dashed px-3 py-3 text-xs leading-5 text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                  创建时会先自动识别协议格式，保存后再开放协议调整，避免在首轮录入时出现多余选项。
                </div>
              ) : null}
              <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                {connectionFootnote}
              </div>
            </div>

            <div className="rounded-[10px] p-4" style={overlayPanelStyle}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {workbenchSectionTitle}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {workbenchSectionDescription}
                  </div>
                </div>
                <StatusBadge
                  label={workbenchPriceStatus.label}
                  tone={workbenchPriceStatus.tone}
                  helper={workbenchPriceStatus.helper}
                  compact
                />
              </div>

              <div className={`grid gap-2 ${isEndpointModelMode ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
                {currentProviderCanScanPricing ? (
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    style={secondaryButtonStyle}
                    onClick={() => void handleFetchAndSyncPricing()}
                    disabled={advancedLoading || syncingProviderId === currentEditingProvider?.id}
                  >
                    <ActionButtonIcon>
                      <RefreshCw size={14} className={advancedLoading || syncingProviderId === currentEditingProvider?.id ? 'animate-spin' : ''} />
                    </ActionButtonIcon>
                    {fetchPricingActionLabel}
                  </button>
                ) : null}

                {currentProviderCanValidateModels ? (
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    style={secondaryButtonStyle}
                    onClick={() => currentEditingProvider && void handleValidateProvider(currentEditingProvider)}
                    disabled={!canOperateOnCurrentProvider || detectingProviderId === currentEditingProvider?.id}
                  >
                    <ActionButtonIcon>
                      <CheckCircle2 size={14} />
                    </ActionButtonIcon>
                    {validateActionLabel}
                  </button>
                ) : null}

                {isEndpointModelMode && currentWuyinEndpointModelId ? (
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3 text-sm"
                    style={secondaryButtonStyle}
                    onClick={handleUseEndpointModelAsManual}
                  >
                    <Edit3 size={14} />使用当前接口模型
                  </button>
                ) : null}
              </div>

              <div className="api-settings-summary-list mt-3 rounded-[10px] p-3" style={elevatedPanelStyle}>
                <div className={`grid gap-2 ${workbenchSummaryRows.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {workbenchSummaryRows.map((row) => (
                    <div key={row.label} className="rounded-[10px] px-3 py-3" style={overlayPanelStyle}>
                      <div className="text-[11px] text-[var(--text-tertiary)]">{row.label}</div>
                      <div className="mt-1 min-w-0 break-words text-sm font-medium text-[var(--text-primary)]">{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {!canOperateOnCurrentProvider ? (
                <div className="mt-3 rounded-[10px] border border-dashed px-3 py-3 text-xs leading-5 text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                  {isPricingSyncMode
                    ? '新供应商在保存前可以先尝试读取价格，但模型识别会在保存后解锁。'
                    : isModelDetectMode
                      ? '先保存供应商，再通过接口识别模型；价格维护会保留在下方单独处理。'
                      : '先保存接口地址，后续会按接口模型和手动单价执行，不再开放通用校验流程。'}
                </div>
              ) : currentEditingProvider?.status === 'error' && currentEditingProvider.lastError ? (
                <div
                  className="mt-3 rounded-[10px] px-3 py-3 text-xs leading-5"
                  style={{
                    borderColor: 'var(--state-danger-border)',
                    backgroundColor: 'var(--state-danger-bg)',
                    color: 'var(--state-danger-text)',
                  }}
                >
                  最近错误：{currentEditingProvider.lastError}
                </div>
              ) : (
                <div className="mt-3 rounded-[10px] px-3 py-3 text-xs leading-5 text-[var(--text-tertiary)]" style={elevatedPanelStyle}>
                  {workbenchPriceStatus.helper} {workbenchReadyText}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[10px] p-4" style={overlayPanelStyle}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{currentProviderSupportsGroups ? '分组、额度与启用状态' : '额度与启用状态'}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {currentProviderSupportsGroups
                    ? '默认分组、额度模式和启用状态会直接影响调度与计费。'
                    : '该供应商没有分组能力，这里只维护额度模式和启用状态。'}
                </div>
              </div>
              <StatusBadge label={currentProviderStatus.label} tone={currentProviderStatus.tone} compact />
            </div>

            {currentProviderSupportsGroups ? (
              <>
                <div>
                  <div className="mb-1 text-xs text-[var(--text-tertiary)]">默认分组</div>
                  <input
                    className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                    style={formFieldStyle}
                    value={providerForm.group}
                    onChange={(event) => setProviderForm((prev) => ({ ...prev, group: event.target.value }))}
                    placeholder="例如：default"
                  />
                </div>

                {advancedResult?.availableGroups?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {advancedResult.availableGroups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        className="rounded-full border px-3 py-1.5 text-left text-xs transition-colors"
                        style={providerForm.group === group
                          ? {
                              borderColor: 'rgb(var(--settings-accent-rgb) / 0.28)',
                              backgroundColor: 'rgb(var(--settings-accent-rgb) / 0.10)',
                              color: 'rgb(var(--settings-accent-rgb))',
                            }
                          : {
                              color: 'var(--text-secondary)',
                            }}
                        onClick={() => setProviderForm((prev) => ({ ...prev, group }))}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[10px] border border-dashed px-3 py-3 text-xs text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                    暂未扫描到可选分组，可以先手动填写默认分组。
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[10px] border border-dashed px-3 py-3 text-xs text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                当前供应商不使用分组，保存后会按单接口或手动模型价格直接计费。
              </div>
            )}

            <div className="mt-4 rounded-[10px] p-3" style={elevatedPanelStyle}>
              <div className="mb-3 text-xs text-[var(--text-tertiary)]">额度设置</div>
              {renderCostEditor(providerForm.costMode, providerForm.costValue, (costMode) => setProviderForm((prev) => ({ ...prev, costMode })), (costValue) => setProviderForm((prev) => ({ ...prev, costValue })))}
            </div>

            <label className="mt-4 flex items-center justify-between rounded-[10px] px-3 py-3 text-sm text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: providerForm.isActive ? 'var(--state-success-text)' : 'var(--text-tertiary)' }} />
                启用该供应商
              </span>
              <input type="checkbox" checked={providerForm.isActive} onChange={(event) => setProviderForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
            </label>

            <div className="api-settings-summary-list mt-4 rounded-[10px] p-3" style={elevatedPanelStyle}>
              <div className="api-settings-summary-item">
                <span className="api-settings-summary-item__label">总额度</span>
                <span className="api-settings-summary-item__value">{currentProviderBudgetPreview.total}</span>
              </div>
              <div className="api-settings-summary-item">
                <span className="api-settings-summary-item__label">已使用</span>
                <span className="api-settings-summary-item__value" style={{ color: 'var(--state-warning-text)' }}>{currentProviderBudgetPreview.used}</span>
              </div>
              <div className="api-settings-summary-item">
                <span className="api-settings-summary-item__label">剩余</span>
                <span className="api-settings-summary-item__value" style={{ color: 'var(--state-success-text)' }}>{currentProviderBudgetPreview.remaining}</span>
              </div>
            </div>

            <div className="mt-3 rounded-[10px] px-3 py-3 text-xs leading-6 text-[var(--text-tertiary)]" style={elevatedPanelStyle}>
              {currentProviderStatus.helper}
              {currentProviderBudgetPreview.unit ? ` 当前额度单位为 ${currentProviderBudgetPreview.unit}。` : ''}
            </div>
          </div>
        </div>

        <div className="rounded-[10px] p-4" style={overlayPanelStyle}>
            <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setShowAdvancedMode((prev) => !prev)}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{advancedPanelTitle}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{advancedPanelDescription}</div>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2 self-start leading-none">
                <StatusBadge
                  label={advancedBadgeLabel}
                  tone={priceSyncStatus.tone}
                  compact
                />
                {showAdvancedMode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {showAdvancedMode && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {currentProviderCanScanPricing ? (
                    <button className="inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-sm" style={secondaryButtonStyle} onClick={() => void handleDetectAdvanced()} disabled={advancedLoading}>
                      <RefreshCw size={14} className={advancedLoading ? 'animate-spin' : ''} />{scanActionLabel}
                    </button>
                  ) : null}
                  {currentProviderCanValidateModels ? (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      style={secondaryButtonStyle}
                      onClick={() => currentEditingProvider && void handleValidateProvider(currentEditingProvider)}
                      disabled={!canOperateOnCurrentProvider || detectingProviderId === currentEditingProvider?.id}
                    >
                      <ActionButtonIcon compact>
                        <CheckCircle2 size={14} className={detectingProviderId === currentEditingProvider?.id ? 'animate-spin' : ''} />
                      </ActionButtonIcon>
                      {validateActionLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-sm"
                    style={secondaryButtonStyle}
                    onClick={() => handleAddManualPricingRow({
                      model: isEndpointModelMode ? (currentWuyinEndpointModelId || '') : '',
                      modelName: isEndpointModelMode ? (currentWuyinEndpointModelId || '') : '',
                      endpointUrl: currentProviderUsesEndpointPricingRows
                        ? (isEndpointModelMode ? providerForm.baseUrl.trim() : '')
                        : '',
                      unit: guessManualBillingUnit(currentWuyinEndpointModelId || undefined),
                      currency: 'CNY',
                    })}
                  >
                    <Plus size={14} />{manualAddLabel}
                  </button>
                  {isCurrentProviderWuyin && currentWuyinEndpointModelId ? (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-sm"
                      style={secondaryButtonStyle}
                      onClick={handleUseEndpointModelAsManual}
                    >
                      <Edit3 size={14} />使用当前接口模型
                    </button>
                  ) : null}
                  {manualSummaryLabel ? <span className="text-xs text-[var(--text-tertiary)]">{manualSummaryLabel}</span> : null}
                </div>

                {(advancedResult || manualPricingRows.length > 0) ? (
                  <div className="space-y-4 rounded-[10px] p-4" style={elevatedPanelStyle}>
                    <div className="rounded-[10px] px-3 py-3 text-xs leading-5 text-[var(--text-tertiary)]" style={overlayPanelStyle}>
                      {pricingLeadText}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[10px] p-3" style={overlayPanelStyle}>
                        <div className="text-[11px] text-[var(--text-tertiary)]">{pricingSourceLabel}</div>
                        <div className="mt-1 min-w-0 break-words text-sm font-medium text-[var(--text-primary)]">{pricingSourceValue}</div>
                      </div>
                      <div className="rounded-[10px] p-3" style={overlayPanelStyle}>
                        <div className="text-[11px] text-[var(--text-tertiary)]">模型数量</div>
                        <div className="mt-1 text-sm font-medium text-[var(--text-primary)]">{effectivePricingModels.length}</div>
                      </div>
                      <div className="rounded-[10px] p-3" style={overlayPanelStyle}>
                        <div className="text-[11px] text-[var(--text-tertiary)]">{isCurrentProviderWuyin ? '供应商模式' : '默认分组倍率'}</div>
                        <div className="mt-1 min-w-0 break-words text-sm font-medium text-[var(--text-primary)]">
                          {isCurrentProviderWuyin ? '无分组 / 异步单接口' : formatRatioDisplay(defaultScannedGroupRatio)}
                        </div>
                      </div>
                    </div>

                    {currentProviderSupportsGroups && advancedResult?.availableGroups && advancedResult.availableGroups.length > 0 ? (
                      <div className="rounded-[10px] p-3" style={overlayPanelStyle}>
                        <div className="text-xs font-medium text-[var(--text-primary)]">扫描到的可用分组</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {advancedResult.availableGroups.map((group) => (
                            <button
                              key={group}
                              type="button"
                              className="rounded-full border px-2 py-1 text-[11px]"
                              style={providerForm.group === group
                                ? {
                                    borderColor: 'rgb(var(--settings-accent-rgb) / 0.28)',
                                    backgroundColor: 'rgb(var(--settings-accent-rgb) / 0.10)',
                                    color: 'rgb(var(--settings-accent-rgb))',
                                  }
                                : {
                                    color: 'var(--text-secondary)',
                                  }}
                              onClick={() => setProviderForm((prev) => ({ ...prev, group }))}
                            >
                              {group}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[10px] p-3" style={overlayPanelStyle}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[var(--text-primary)]">{manualPricingTitle}</div>
                          <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{manualPricingDescription}</div>
                        </div>
                        {isCurrentProviderWuyin && currentWuyinEndpointModelId ? (
                          <span className="settings-inline-chip rounded-full border px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" style={{ }}>
                            当前接口模型 {currentWuyinEndpointModelId}
                          </span>
                        ) : null}
                      </div>

                      {manualPricingRows.length === 0 ? (
                        <div className="mt-3 rounded-[10px] border border-dashed p-4 text-xs leading-5 text-[var(--text-tertiary)]" style={{ }}>
                          {manualPricingEmptyText}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {manualPricingRows.map((row) => (
                            <div
                              key={row.id}
                              className={`grid gap-3 rounded-[10px] p-3 ${manualPricingGridClass}`}
                              style={elevatedPanelStyle}
                            >
                              {currentProviderUsesEndpointPricingRows ? (
                                <div className="space-y-1">
                                  <input
                                    className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                                    style={formFieldStyle}
                                    value={row.endpointUrl || ''}
                                    onChange={(event) => handleUpdateManualPricingRow(row.id, { endpointUrl: event.target.value })}
                                    placeholder="完整 async 接口地址，例如 https://api.wuyinkeji.com/api/async/image_nanoBanana2"
                                  />
                                  <div className="text-[11px]" style={{ color: row.model ? 'var(--text-tertiary)' : 'var(--state-warning-text)' }}>
                                    {row.model ? `模型 ID: ${row.model}` : '将从接口地址自动识别模型 ID'}
                                  </div>
                                </div>
                              ) : (
                                <input
                                  className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                                  style={formFieldStyle}
                                  value={row.model}
                                  onChange={(event) => handleUpdateManualPricingRow(row.id, {
                                    model: event.target.value,
                                    modelName: row.modelName || event.target.value,
                                    unit: row.unit || guessManualBillingUnit(event.target.value),
                                  })}
                                  placeholder="模型 ID，例如 image_nanoBanana2"
                                />
                              )}
                              <input
                                className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                                style={formFieldStyle}
                                value={row.price}
                                onChange={(event) => handleUpdateManualPricingRow(row.id, { price: event.target.value })}
                                placeholder="单价，例如 0.1"
                              />
                              <input
                                className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                                style={formFieldStyle}
                                value={row.unit}
                                onChange={(event) => handleUpdateManualPricingRow(row.id, { unit: event.target.value })}
                                placeholder="单位：张 / 秒 / 次"
                              />
                              <select
                                className="h-10 w-full rounded-[10px] px-3 text-sm outline-none"
                                style={formFieldStyle}
                                value={row.currency}
                                onChange={(event) => handleUpdateManualPricingRow(row.id, { currency: event.target.value as 'CNY' | 'USD' })}
                              >
                                <option value="CNY">CNY</option>
                                <option value="USD">USD</option>
                              </select>
                              <button
                                type="button"
                                className="apple-button-danger h-10 w-full px-3 text-xs"
                                onClick={() => handleRemoveManualPricingRow(row.id)}
                              >
                                <Trash2 size={12} />删除
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[var(--text-primary)]">价格明细</div>
                          <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">只展示品牌供应商、分组、计费方式，以及最终价格或倍率。</div>
                        </div>
                        <div className="relative w-full shrink-0 sm:w-80">
                          <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)]">
                            <Search size={15} />
                          </span>
                          <input
                            value={pricingSearch}
                            onChange={(event) => setPricingSearch(event.target.value)}
                            placeholder="搜索模型 / 分组 / 供应商"
                            className="h-9 w-full rounded-[10px] pl-10 pr-3 text-xs text-[var(--text-primary)] outline-none transition"
                            style={formFieldStyle}
                          />
                        </div>
                      </div>

                      {filteredAdvancedPricingRows.length === 0 ? (
                        <div className="rounded-[10px] border border-dashed p-4 text-xs text-[var(--text-tertiary)]" style={{ }}>当前没有可展示的价格明细。</div>
                      ) : (
                        <div className="space-y-3">
                          {filteredAdvancedPricingRows.map((row) => {
                            const billingLabel = resolveBillingLabel(row.billingType, row.quotaType, row.perRequestPrice);
                            const detailBadges = renderPricingDetailBadges(row);

                            return (
                              <div key={row.model} className="rounded-[10px] p-4" style={overlayPanelStyle}>
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.model}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className="rounded-full border px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" style={{ }}>
                                        品牌 {row.providerLabel || row.provider || '未标注'}
                                      </span>
                                      <span className="rounded-full border px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" style={{ }}>
                                        分组 {row.tokenGroup || providerForm.group || 'default'}
                                      </span>
                                      <span className="rounded-full border px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" style={{ }}>
                                        计费 {billingLabel}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: `${providerForm.providerColor}22`, color: providerForm.providerColor }}>
                                    {providerForm.group || row.tokenGroup || 'default'}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {detailBadges.length > 0 ? (
                                    detailBadges.map((item) => (
                                      <div
                                        key={`${row.model}-${item.label}-${item.value}`}
                                        className="rounded-full border px-3 py-1.5 text-[11px]"
                                        style={{
                                          borderColor: item.accent ? `${providerForm.providerColor}55` : 'var(--settings-border-subtle)',
                                          backgroundColor: item.accent ? `${providerForm.providerColor}12` : 'var(--settings-surface-elevated)',
                                          color: item.accent ? providerForm.providerColor : 'var(--text-secondary)',
                                        }}
                                      >
                                        <span className="mr-1 opacity-70">{item.label}</span>
                                        <span className="font-medium">{item.value}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-full border px-3 py-1.5 text-[11px] text-[var(--text-tertiary)]" style={{ }}>
                                      当前模型未返回可直接展示的价格字段
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[10px] border border-dashed p-4 text-sm leading-6 text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                    {isModelDetectMode
                      ? '识别模型后，这里会展示已识别模型和你手动维护的价格，方便继续确认保存内容。'
                      : isEndpointModelMode
                        ? '识别接口模型后，这里会展示当前接口对应的价格记录，方便继续维护单接口成本。'
                        : isCurrentWuyinCatalogMode
                          ? '读取目录后，这里会展示目录返回的型号、品牌和基础价格；如果某个 async 接口需要单独计费，可继续在下方补充接口单价。'
                          : isCurrentManualPricingOnlyProvider
                            ? '该供应商没有兼容的价格扫描接口。这里会展示你已经保存的价格快照或手动维护结果，方便核对当前生效分组的计费。'
                          : '扫描价格后，这里会展示供应商返回的品牌、分组、计费方式和最终价格，方便你直接确认同步内容。'}
                  </div>
                )}
              </div>
            )}
        </div>

        {currentEditingProvider ? (
          <SettingsDangerZone
            title="危险操作"
            description="删除供应商会同时移除它的连接信息、预算配置和本地价格快照。"
            action={(
              <button className="apple-button-danger h-9 px-4 text-sm" onClick={() => handleDeleteProvider(currentEditingProvider.id)}>
                <Trash2 size={14} />删除供应商
              </button>
            )}
          />
        ) : null}
      </div>
    );
  };

  const renderProviderEditorCard = () => (
    <div ref={providerEditorRef} className="api-settings-editor-card overflow-hidden rounded-[10px] scroll-mt-6" style={elevatedPanelStyle}>
      {showProviderCreateForm ? (
        <>
          <div className="border-b px-5 py-4" style={headerPanelStyle}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-[var(--text-primary)]">
                    {providerForm.id ? `正在编辑：${editingProviderName}` : '新增供应商'}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                    {providerForm.id
                      ? editingProviderBaseUrl || '请完善供应商基础地址，保存后会作为当前供应商的识别地址。'
                      : '填写名称、基础地址和 API Key 后即可保存为新的第三方供应商。'}
                  </div>
                </div>
                <div className="api-settings-editor-toolbar flex flex-wrap gap-2 overflow-visible pb-1">
                  <button
                    className="apple-button-primary h-9 px-4 text-sm transition-all active:scale-95 disabled:opacity-70 whitespace-nowrap"
                    onClick={() => void handleSaveProvider()}
                    disabled={savingProviderId === (providerForm.id || 'new')}
                  >
                    <ActionButtonIcon compact>
                      <Save size={14} />
                    </ActionButtonIcon>
                    {savingProviderId === (providerForm.id || 'new') ? '保存中...' : (providerForm.id ? '保存供应商' : '添加供应商')}
                  </button>
                  <button className="apple-button-secondary h-9 px-4 text-sm transition-all active:scale-95 whitespace-nowrap" style={secondaryButtonStyle} onClick={() => resetThirdPartyForm(true)}>
                    <XCircle size={14} />关闭
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div ref={providerEditorBodyRef} className="p-5">
            {renderProviderForm()}
          </div>
        </>
      ) : (
        <>
          <div className="border-b px-5 py-4" style={headerPanelStyle}>
            <div className="text-base font-semibold text-[var(--text-primary)]">供应商工作区</div>
            <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
              先从左侧选择一个供应商，再在这里继续编辑和同步。
            </div>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              <div className="rounded-[10px] p-5" style={overlayPanelStyle}>
                <div className="text-sm font-semibold text-[var(--text-primary)]">未选择供应商</div>
                <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  左侧列表只负责定位对象；选中后，这里再显示连接、预算、校准和危险操作。
                </div>
              </div>

              <button
                className="apple-button-primary h-10 w-full text-sm"
                onClick={() => {
                  setShowProviderCreateForm(true);
                  resetThirdPartyForm(false);
                }}
              >
                <Plus size={14} />新增供应商
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="api-settings-view space-y-4 pb-8">
      <section className="rounded-[24px] p-5 md:p-6" style={sectionPanelStyle}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            
            <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">API 管理</h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--text-tertiary)]">
              用更简单的左右工作区整理第三方供应商和官方接口，左侧浏览，右侧编辑。
            </p>
          </div>

          {activeWorkspace === 'third-party' ? (
            <button
              className="apple-button-primary h-10 px-4 text-sm"
              onClick={() => {
                resetThirdPartyForm(false);
                setShowProviderCreateForm(true);
              }}
            >
              <Plus size={14} />新增供应商
            </button>
          ) : (
            <button
              className="apple-button-primary h-10 px-4 text-sm"
              onClick={() => {
                setOfficialForm(defaultOfficialForm);
                setShowOfficialCreateForm(true);
              }}
            >
              <Plus size={14} />新增官方接口
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
            第三方 {summary.providerCount}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
            官方 {summary.officialCount}
          </span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--text-tertiary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
            待处理 {providerWorkspaceSummary.pendingSyncCount + providerWorkspaceSummary.errorCount}
          </span>
        </div>
      </section>

      <div className="api-settings-secondary-nav rounded-[10px] p-3" style={sectionPanelStyle}>
        <div className="api-settings-secondary-nav__inner">
          <button
            type="button"
            className={`api-settings-secondary-nav__button ${activeWorkspace === 'third-party' ? 'is-active' : ''}`}
            onClick={() => setActiveWorkspace('third-party')}
          >
            <span className="api-settings-secondary-nav__label">第三方供应商</span>
            <span className="api-settings-secondary-nav__meta">
              {summary.providerCount} 个供应商 / 在线 {summary.activeProviderCount}
            </span>
          </button>
          <button
            type="button"
            className={`api-settings-secondary-nav__button ${activeWorkspace === 'official' ? 'is-active' : ''}`}
            onClick={() => setActiveWorkspace('official')}
          >
            <span className="api-settings-secondary-nav__label">官方接口</span>
            <span className="api-settings-secondary-nav__meta">
              {summary.officialCount} 个配置 / 暂停 {officialWorkspaceSummary.pausedCount}
            </span>
          </button>
        </div>
      </div>

      {activeWorkspace === 'third-party' ? (
      <section className="rounded-[24px] p-4 md:p-5" style={sectionPanelStyle}>
        <div className="mb-4">
          <div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">第三方供应商</div>
            <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              列表只保留必要摘要和快捷动作，详细配置放到右侧。
            </div>
          </div>
        </div>

        <div className={`api-settings-layout ${showProviderCreateForm ? 'is-editing' : 'is-browsing'}`}>
          {!isNarrowViewport || !showProviderCreateForm ? (
          <aside className="api-settings-list-panel min-w-0">
            <div className="overflow-hidden rounded-[10px]" style={elevatedPanelStyle}>
              <div className="border-b px-4 py-4 md:px-5 md:py-5" style={headerPanelStyle}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">PROVIDER QUEUE</div>
                      <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">供应商队列</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                        {showProviderCreateForm
                          ? '在这里筛选和切换供应商对象，右侧详情区负责连续编辑与同步。'
                          : '先浏览对象，再进入详情区处理连接、预算和价格同步。'}
                      </div>
                    </div>
                    <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                      {providerSearch.trim() ? `${filteredProviders.length}/${providers.length}` : providers.length}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)]">
                      <Search size={15} />
                    </span>
                    <input
                      value={providerSearch}
                      onChange={(event) => setProviderSearch(event.target.value)}
                      placeholder="搜索供应商名称或地址..."
                      className="h-11 w-full rounded-[10px] pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none"
                      style={formFieldStyle}
                    />
                  </div>
                </div>
              </div>

              <div ref={providerListRef} className="api-settings-provider-list space-y-3 p-3 md:p-4">
                {filteredProviders.length === 0 ? (
                  <div className="apple-empty-state rounded-[10px] border border-dashed p-6 text-left text-sm text-[var(--text-tertiary)]" style={{ }}>
                    {providers.length === 0 ? '暂无第三方供应商配置，使用右上角“新增供应商”开始添加。' : '没有匹配到供应商，请换个关键词试试。'}
                  </div>
                ) : (
                  filteredProviders.map((provider) => {
                    const isSelected = providerForm.id === provider.id && showProviderCreateForm;
                    const isHighlighted = highlightedProviderId === provider.id;
                    const isWuyinCatalogMode = isWuyinCatalogProvider(provider.baseUrl);
                    const providerRuntime = resolveProviderRuntime({ baseUrl: provider.baseUrl, format: provider.format || 'auto' });
                    const providerEndpointModelId = extractWuyinModelIdFromBaseUrl(provider.baseUrl);
                    const providerWorkbenchMode = resolveProviderWorkbenchMode(providerRuntime, {
                      endpointModelId: providerEndpointModelId,
                      hasAutoPricing: snapshotHasAutoPricingRows(provider.pricingSnapshot),
                      isCatalogMode: isWuyinCatalogMode,
                    });
                    const providerWorkbenchMeta = getProviderWorkbenchMeta(providerWorkbenchMode, {
                      isCatalogMode: isWuyinCatalogMode,
                      manualPricingOnly: false,
                    });
                    const providerCanScanPricing =
                      providerWorkbenchMode === 'pricing-sync' && !isWuyinCatalogMode;
                    const providerCanValidateModels =
                      providerWorkbenchMode !== 'endpoint-model' && providerRuntime.strategyId !== 'wuyinkeji';
                    const providerModelActionLabel =
                      providerWorkbenchMode === 'model-detect'
                        ? '校准模型'
                        : '刷新模型';
                    const providerPriceActionLabel = provider.pricingSnapshot?.rows?.length ? '校准价格' : '获取价格';
                    const providerValidateActionLabel = providerModelActionLabel;
                    const providerColor = provider.providerColor || provider.badgeColor || '#3B82F6';
                    const providerStatus = getProviderStatusMeta(provider);
                    const providerPricingCount = provider.pricingSnapshot?.rows?.length || 0;
                    const runtimeSummary = buildProviderActivitySummary(provider);
                    const latestActivity = provider.pricingSnapshot?.fetchedAt || provider.lastChecked;
                    const latestActivityLabel = providerWorkbenchMode === 'endpoint-model'
                      ? (latestActivity ? `最近维护 ${formatDate(latestActivity)}` : '待识别接口')
                      : providerWorkbenchMode === 'model-detect'
                        ? (latestActivity ? `最近识别 ${formatDate(latestActivity)}` : '未识别模型')
                        : isWuyinCatalogMode
                          ? (latestActivity ? `最近读取 ${formatDate(latestActivity)}` : '未读取目录')
                          : (latestActivity ? `最近价格 ${formatDate(latestActivity)}` : '未同步价格');
                    const providerMetaItems = [
                      `预设价格 ${providerPricingCount}`,
                      `模型 ${provider.models?.length || 0}`,
                      !isNoGroupProvider(provider.baseUrl) && provider.group ? `分组 ${provider.group}` : null,
                      latestActivityLabel,
                    ].filter(Boolean) as string[];

                    return (
                      <article
                        key={provider.id}
                        data-provider-id={provider.id}
                        role="button"
                        tabIndex={0}
                        className={`api-settings-provider-item api-settings-provider-item--provider w-full cursor-pointer overflow-hidden rounded-[10px] p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${isHighlighted ? 'animate-pulse-highlight' : ''}`}
                        style={isSelected
                          ? {
                              borderColor: `${providerColor}88`,
                              backgroundColor: `${providerColor}12`,
                              boxShadow: `0 0 0 1px ${providerColor}33`,
                            }
                          : isHighlighted
                            ? {
                                borderColor: 'var(--state-success-border)',
                                backgroundColor: 'var(--state-success-bg)',
                                boxShadow: '0 0 0 1px var(--state-success-border)',
                              }
                            : {
                                backgroundColor: 'var(--settings-section-bg)',
                              }}
                        onClick={() => loadProviderToForm(provider)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            loadProviderToForm(provider);
                          }
                        }}
                        aria-label={`编辑供应商 ${provider.name}`}
                      >
                        <div className="space-y-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: providerColor }} />
                                <span className="api-settings-provider-name text-sm font-semibold text-[var(--text-primary)]">{provider.name}</span>
                                {isSelected ? (
                                  <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: `${providerColor}18`, color: providerColor }}>
                                    当前详情
                                  </span>
                                ) : null}
                              </div>
                              <div className="api-settings-provider-url mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{provider.baseUrl}</div>
                            </div>

                            <StatusBadge label={providerStatus.label} tone={providerStatus.tone} compact />
                          </div>

                          <div className="api-settings-provider-runtime-card rounded-[10px] px-3 py-3" style={elevatedPanelStyle}>
                            <div className="api-settings-provider-runtime text-sm font-medium text-[var(--text-primary)]">
                              {runtimeSummary.text}
                            </div>
                            <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                              {runtimeSummary.updatedAtLabel}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="api-settings-provider-meta">
                              {providerMetaItems.map((item) => (
                                <span key={`${provider.id}-${item}`}>{item}</span>
                              ))}
                            </div>

                            <div className="api-settings-provider-action-row">
                              <button
                                type="button"
                                className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                                style={secondaryButtonStyle}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRefreshProvider(provider);
                                }}
                              >
                                <ActionButtonIcon compact>
                                  <RefreshCw size={12} />
                                </ActionButtonIcon>
                                刷新
                              </button>
                              <button
                                type="button"
                                className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                                style={secondaryButtonStyle}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleProvider(provider);
                                }}
                              >
                                <ActionButtonIcon compact>
                                  {provider.isActive ? <Pause size={12} /> : <Play size={12} />}
                                </ActionButtonIcon>
                                {provider.isActive ? '暂停' : '恢复'}
                              </button>
                              {providerCanScanPricing ? (
                                <button
                                  type="button"
                                  className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                                  style={secondaryButtonStyle}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleSyncPricing(provider);
                                  }}
                                >
                                  <ActionButtonIcon compact>
                                    <RefreshCw size={12} className={syncingProviderId === provider.id ? 'animate-spin' : ''} />
                                  </ActionButtonIcon>
                                  {syncingProviderId === provider.id ? '校准中...' : providerPriceActionLabel}
                                </button>
                              ) : null}
                              {providerCanValidateModels ? (
                                <button
                                  type="button"
                                  className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                                  style={secondaryButtonStyle}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleValidateProvider(provider);
                                  }}
                                >
                                  <ActionButtonIcon compact>
                                    <CheckCircle2 size={12} className={detectingProviderId === provider.id ? 'animate-spin' : ''} />
                                  </ActionButtonIcon>
                                  {detectingProviderId === provider.id ? '校准中...' : providerValidateActionLabel}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
          ) : null}

          {!isNarrowViewport || showProviderCreateForm ? (
            <aside className="api-settings-editor-panel min-w-0">
              {renderProviderEditorCard()}
            </aside>
          ) : null}
        </div>
      </section>
      ) : null}

      {activeWorkspace === 'official' ? (
      <section className="rounded-[24px] p-4 md:p-5" style={sectionPanelStyle}>
        <div className="mb-4">
          <div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">官方接口</div>
            <div className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              官方 API Key 统一走列表选择和详情编辑模式，删除动作只保留在详情危险区。
            </div>
          </div>
        </div>

        <div className={`api-settings-layout ${showOfficialCreateForm ? 'is-editing' : 'is-browsing'}`}>
          {!isNarrowViewport || !showOfficialCreateForm ? (
          <aside className="api-settings-list-panel min-w-0">
            <div className="overflow-hidden rounded-[10px]" style={elevatedPanelStyle}>
              <div className="border-b px-4 py-4 md:px-5 md:py-5" style={headerPanelStyle}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">OFFICIAL KEYS</div>
                      <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">官方接口列表</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">
                        选择一个官方接口进入详情页统一编辑名称、Key 和额度配置。
                      </div>
                    </div>
                    <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]" style={{ backgroundColor: 'var(--settings-surface-elevated)' }}>
                      已配置 {summary.officialCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-3 md:p-4">
                {officialEntries.length === 0 ? (
                  <div className="apple-empty-state rounded-[10px] border border-dashed p-6 text-sm text-[var(--text-tertiary)]" style={{ }}>
                    暂无官方接口配置，使用右上角“新增官方接口”开始添加。
                  </div>
                ) : (
                  officialEntries.map((slot) => {
                    const budget = formatOfficialBudgetInfo(slot);
                    const costMode = resolveCostModeFromLimits(slot.budgetLimit, slot.tokenLimit);
                    const isSelected = officialForm.id === slot.id && showOfficialCreateForm;
                    const isPaused = Boolean(slot.disabled);
                    const slotColor = '#3B82F6';
                    
                    // 计算预算使用百分比
                    let budgetPercent = 0;
                    let isDepleted = false;
                    if (costMode === 'amount') {
                      const total = slot.budgetLimit || 0;
                      const used = slot.totalCost || 0;
                      budgetPercent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                      isDepleted = total > 0 && used >= total;
                    } else if (costMode === 'tokens') {
                      const total = slot.tokenLimit || 0;
                      const used = slot.usedTokens || 0;
                      budgetPercent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                      isDepleted = total > 0 && used >= total;
                    }

                    return (
                        <article
                          key={slot.id}
                          role="button"
                          tabIndex={0}
                          className="api-settings-provider-item api-settings-provider-item--official w-full cursor-pointer overflow-hidden rounded-[10px] p-4 text-left transition-[border-color,background-color,box-shadow] duration-200"
                          style={isSelected
                            ? {
                                borderColor: 'rgb(var(--settings-accent-rgb) / 0.28)',
                              backgroundColor: 'rgb(var(--settings-accent-rgb) / 0.08)',
                              boxShadow: '0 0 0 1px rgb(var(--settings-accent-rgb) / 0.10)',
                            }
                          : {
                              backgroundColor: 'var(--settings-section-bg)',
                            }}
                        onClick={() => loadOfficialToForm(slot)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            loadOfficialToForm(slot);
                          }
                        }}
                        aria-label={`编辑官方接口 ${slot.name}`}
                      >
                        <div className="space-y-3">
                          {/* 第一排：彩色圆点 + 名称 + 状态徽章 */}
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slotColor }} />
                                <span className="api-settings-provider-name text-sm font-semibold text-[var(--text-primary)]">{slot.name}</span>
                                {isSelected ? (
                                  <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium" style={{ backgroundColor: 'rgb(var(--settings-accent-rgb) / 0.12)', color: 'rgb(var(--settings-accent-rgb))' }}>
                                    当前详情
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <StatusBadge label={isPaused ? '已暂停' : '已启用'} tone={isPaused ? 'slate' : 'green'} compact />
                          </div>

                          {/* 第二排：预算信息（已用/限额 + 进度条） */}
                          {costMode !== 'unlimited' ? (
                            <div className="api-settings-provider-runtime-card rounded-[10px] px-3 py-3" style={elevatedPanelStyle}>
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-[var(--text-primary)]">
                                  已用 {budget.used} / 限额 {budget.total}
                                </span>
                                <span className={isDepleted ? 'text-[var(--state-danger-text)]' : 'text-[var(--text-secondary)]'}>
                                  剩余 {budget.remaining}
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--settings-border-subtle)]">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${budgetPercent}%`,
                                    backgroundColor: isDepleted ? 'var(--state-danger-text)' : 'rgb(var(--settings-accent-rgb))',
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="api-settings-provider-runtime-card rounded-[10px] px-3 py-3" style={elevatedPanelStyle}>
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-[var(--text-primary)]">
                                  无限额度
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  已用 {budget.used}
                                </span>
                              </div>
                              <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                                当前保持无限额度，可直接投入使用
                              </div>
                            </div>
                          )}

                          {/* 第三排：快捷操作按钮（编辑、刷新、暂停/恢复） */}
                          <div className="api-settings-provider-action-row">
                            <button
                              type="button"
                              className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                              style={secondaryButtonStyle}
                              onClick={(event) => {
                                event.stopPropagation();
                                loadOfficialToForm(slot);
                              }}
                            >
                              <ActionButtonIcon compact>
                                <Edit3 size={12} />
                              </ActionButtonIcon>
                              编辑
                            </button>
                            <button
                              type="button"
                              className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                              style={secondaryButtonStyle}
                              onClick={(event) => {
                                event.stopPropagation();
                                refresh();
                              }}
                            >
                              <ActionButtonIcon compact>
                                <RefreshCw size={12} />
                              </ActionButtonIcon>
                              刷新
                            </button>
                            <button
                              type="button"
                              className="apple-button-secondary h-8 px-3 text-xs transition-all active:scale-95"
                              style={secondaryButtonStyle}
                              onClick={(event) => {
                                event.stopPropagation();
                                void keyManager.updateKey(slot.id, { disabled: !slot.disabled });
                                refresh();
                              }}
                            >
                              <ActionButtonIcon compact>
                                {isPaused ? <Play size={12} /> : <Pause size={12} />}
                              </ActionButtonIcon>
                              {isPaused ? '恢复' : '暂停'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
          ) : null}

          {!isNarrowViewport || showOfficialCreateForm ? (
            <aside className="api-settings-editor-panel min-w-0">
              {renderOfficialDetailCard()}
            </aside>
          ) : null}
        </div>
      </section>
      ) : null}
    </div>
  );
};

export default ApiSettingsView;
