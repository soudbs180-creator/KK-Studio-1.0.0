import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Clock3,
  Edit3,
  Globe,
  Key,
  Layers3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Provider } from '../../types';
import type { ApiProtocolFormat } from '../../services/api/apiConfig';
import { useLocale } from '../../context/LocaleContext';
import keyManager, {
  autoDetectAndConfigureModels,
  type KeySlot,
  type ThirdPartyProvider,
} from '../../services/auth/keyManager';
import type { Supplier } from '../../services/billing/supplierService';
import { notify } from '../../services/system/notificationService';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_OVERLAY_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from './SettingsScaffold';
import {
  DangerButton,
  EmptyState,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SegmentedControl,
  SegmentedControlMulti,
  SettingInput,
  SettingSelect,
  SettingToggle,
  StatusBadge,
} from './ui/index';

type CostMode = 'unlimited' | 'amount' | 'tokens';
type OfficialProvider = 'Google' | 'OpenAI';
type TabType = 'official' | 'third-party';
type EditorMode = TabType | null;
type EditorSource = 'route' | 'local' | null;

const TOKEN_UNIT_LABEL = '词元';
const TOKEN_LIMIT_LABEL = '词元上限';
const LEGACY_TOKEN_LIMIT_LABEL = '令牌上限';

type OfficialForm = {
  id?: string;
  name: string;
  provider: OfficialProvider;
  key: string;
  mode: CostMode;
  value: string;
};

type ProviderForm = {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  format: ApiProtocolFormat;
  group: string;
  color: string;
  isActive: boolean;
  mode: CostMode;
  value: string;
};

const BUDGET_OPTIONS = ['不限额', '金额预算', TOKEN_LIMIT_LABEL] as const;

const officialDefaults: OfficialForm = {
  name: '',
  provider: 'Google',
  key: '',
  mode: 'unlimited',
  value: '',
};

const providerDefaults: ProviderForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  format: 'auto',
  group: '',
  color: '#60A5FA',
  isActive: true,
  mode: 'unlimited',
  value: '',
};

const API_MANAGEMENT_HOME_PATH = '/settings/api-management';
const ROUTE_NEW_ITEM = 'new';

const buildOfficialEditorPath = (officialId?: string | null) =>
  officialId
    ? `/settings/api-management/official/${encodeURIComponent(officialId)}`
    : '/settings/api-management/official/new';

const buildProviderEditorPath = (providerId?: string | null) =>
  providerId
    ? `/settings/api-management/provider/${encodeURIComponent(providerId)}`
    : '/settings/api-management/provider/new';

const decodeRouteParam = (value?: string) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeRouteMatchValue = (value?: string | null) => decodeRouteParam(String(value || '')).trim().toLowerCase();

const formatUsd = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const compactNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatTokens = (value: number) => `${compactNumber(value)} ${TOKEN_UNIT_LABEL}`;

const formatDateTime = (value?: number | string | null) => {
  if (!value) return '暂无记录';
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return '暂无记录';
  return target.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatLatency = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return '暂无';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}s`;
  return `${Math.round(value)}ms`;
};

const extractDomain = (url: string) => {
  if (!url.trim()) return '未填写基础地址';
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
};

const maskSecret = (value: string) => {
  if (!value.trim()) return '尚未填写';
  if (value.length <= 10) return '已填写';
  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
};

const positive = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isOfficialSlot = (slot: KeySlot) =>
  slot.type === 'official' || (!slot.baseUrl && (slot.provider === 'Google' || slot.provider === 'OpenAI'));

const getMode = (budget?: number, tokenLimit?: number, fallback: CostMode = 'unlimited'): CostMode => {
  if (typeof tokenLimit === 'number' && tokenLimit > -1) return 'tokens';
  if (typeof budget === 'number' && budget > -1) return 'amount';
  return fallback;
};

const getModeLabel = (mode: CostMode) => {
  if (mode === 'amount') return '金额预算';
  if (mode === 'tokens') return TOKEN_LIMIT_LABEL;
  return '不限额';
};

const getModeOption = (mode: CostMode) => {
  if (mode === 'amount') return '金额预算';
  if (mode === 'tokens') return TOKEN_LIMIT_LABEL;
  return '不限额';
};

const parseModeOption = (value: string): CostMode => {
  if (value === '金额预算') return 'amount';
  if (value === TOKEN_LIMIT_LABEL || value === LEGACY_TOKEN_LIMIT_LABEL) return 'tokens';
  return 'unlimited';
};

const getProtocolLabel = (format: ApiProtocolFormat) => {
  if (format === 'openai') return 'OpenAI 协议';
  if (format === 'gemini') return 'Gemini 协议';
  if (format === 'claude') return 'Claude 协议';
  return '自动识别';
};

const getOfficialProviderLabel = (provider: OfficialProvider) =>
  provider === 'Google' ? '谷歌官方接口' : 'OpenAI 官方接口';

const getOfficialStatus = (slot: KeySlot) => {
  if (slot.disabled) return { badge: 'neutral' as const, status: 'paused' as const, label: '已暂停' };
  if (slot.status === 'valid') return { badge: 'emerald' as const, status: 'online' as const, label: '运行中' };
  if (slot.status === 'rate_limited') return { badge: 'amber' as const, status: 'warning' as const, label: '限流中' };
  if (slot.status === 'invalid') return { badge: 'rose' as const, status: 'error' as const, label: '异常' };
  return { badge: 'neutral' as const, status: 'offline' as const, label: '待检测' };
};

const getProviderStatus = (provider: ThirdPartyProvider) => {
  if (!provider.isActive) return { badge: 'neutral' as const, status: 'paused' as const, label: '已暂停' };
  if (provider.status === 'active') return { badge: 'emerald' as const, status: 'online' as const, label: '运行中' };
  if (provider.status === 'error') return { badge: 'rose' as const, status: 'error' as const, label: '异常' };
  return { badge: 'amber' as const, status: 'warning' as const, label: '检测中' };
};

const getLimitValueLabel = (mode: CostMode, value?: number) => {
  if (mode === 'amount' && typeof value === 'number' && value > -1) return formatUsd(value);
  if (mode === 'tokens' && typeof value === 'number' && value > -1) return formatTokens(value);
  return '未设置';
};

const getProgress = (mode: CostMode, usage: number, budgetLimit?: number, tokenLimit?: number) => {
  if (mode === 'amount' && typeof budgetLimit === 'number' && budgetLimit > 0) {
    return Math.min(100, Math.max(0, (usage / budgetLimit) * 100));
  }
  if (mode === 'tokens' && typeof tokenLimit === 'number' && tokenLimit > 0) {
    return Math.min(100, Math.max(0, (usage / tokenLimit) * 100));
  }
  return 0;
};

const getOfficialUsageSummary = (slot: KeySlot) => {
  const mode = getMode(slot.budgetLimit, slot.tokenLimit);
  if (mode === 'amount' && typeof slot.budgetLimit === 'number' && slot.budgetLimit > -1) {
    return `已用 ${formatUsd(slot.totalCost)} / 预算 ${formatUsd(slot.budgetLimit)}`;
  }
  if (mode === 'tokens' && typeof slot.tokenLimit === 'number' && slot.tokenLimit > -1) {
    return `已用 ${formatTokens(slot.usedTokens || 0)} / 上限 ${formatTokens(slot.tokenLimit)}`;
  }
  return `累计消耗 ${formatUsd(slot.totalCost)}`;
};

const getProviderUsageSummary = (provider: ThirdPartyProvider) => {
  const mode = getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited');
  if (mode === 'amount' && typeof provider.budgetLimit === 'number' && provider.budgetLimit > -1) {
    return `已用 ${formatUsd(provider.usage.totalCost)} / 预算 ${formatUsd(provider.budgetLimit)}`;
  }
  if (mode === 'tokens' && typeof provider.tokenLimit === 'number' && provider.tokenLimit > -1) {
    return `已用 ${formatTokens(provider.usage.totalTokens)} / 上限 ${formatTokens(provider.tokenLimit)}`;
  }
  return `累计消耗 ${formatUsd(provider.usage.totalCost)}`;
};

const getProviderActivityLine = (provider: ThirdPartyProvider) => {
  const summary = provider.activitySummary;
  if (!summary?.lastLatencyMs) return '暂无最近调用数据';
  const items = [`延迟 ${formatLatency(summary.lastLatencyMs)}`];
  if (typeof summary.lastTokens === 'number' && summary.lastTokens > 0) {
    items.push(formatTokens(summary.lastTokens));
  }
  if (typeof summary.lastAmount === 'number' && summary.lastAmount >= 0) {
    items.push(formatUsd(summary.lastAmount));
  }
  return items.join(' · ');
};

const toOfficialForm = (slot: KeySlot): OfficialForm => ({
  id: slot.id,
  name: slot.provider === 'OpenAI' ? 'OpenAI' : 'Google',
  provider: slot.provider === 'OpenAI' ? 'OpenAI' : 'Google',
  key: slot.key,
  mode: getMode(slot.budgetLimit, slot.tokenLimit),
  value:
    typeof slot.tokenLimit === 'number' && slot.tokenLimit > -1
      ? String(slot.tokenLimit)
      : typeof slot.budgetLimit === 'number' && slot.budgetLimit > -1
        ? String(slot.budgetLimit)
        : '',
});

const toProviderForm = (provider: ThirdPartyProvider): ProviderForm => ({
  id: provider.id,
  name: provider.name,
  baseUrl: provider.baseUrl,
  apiKey: provider.apiKey,
  format: provider.format,
  group: provider.group || '',
  color: provider.providerColor || '#60A5FA',
  isActive: provider.isActive,
  mode: getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited'),
  value:
    typeof provider.tokenLimit === 'number' && provider.tokenLimit > -1
      ? String(provider.tokenLimit)
      : typeof provider.budgetLimit === 'number' && provider.budgetLimit > -1
        ? String(provider.budgetLimit)
        : provider.customCostValue && provider.customCostValue > 0
          ? String(provider.customCostValue)
          : '',
});

const toProviderFormFromSupplier = (supplier: Supplier): ProviderForm => ({
  ...providerDefaults,
  name: supplier.name,
  baseUrl: supplier.baseUrl,
  apiKey: supplier.apiKey,
  format: supplier.format,
  mode: getMode(supplier.budgetLimit, undefined),
  value: typeof supplier.budgetLimit === 'number' && supplier.budgetLimit > -1 ? String(supplier.budgetLimit) : '',
});

const InfoCell: React.FC<{ label: string; value: string; helper?: string }> = ({ label, value, helper }) => (
  <div className="rounded-[18px] border p-3" style={SETTINGS_OVERLAY_STYLE}>
    <div className="text-[11px] font-medium tracking-[0.12em] text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 text-[15px] font-semibold text-[var(--text-primary)]">{value}</div>
    {helper ? <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{helper}</div> : null}
  </div>
);

type EndpointStatusVariant = 'online' | 'offline' | 'warning' | 'error' | 'paused';

type ConsoleEndpointCardMetric = {
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
};

type ConsoleEndpointCardProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  avatar: React.ReactNode;
  badges?: React.ReactNode;
  status: { status: EndpointStatusVariant; label: string };
  metrics: ConsoleEndpointCardMetric[];
  progress?: { summary: string; percentage: number };
  error?: string | null;
  actions: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const ConsoleEndpointCard: React.FC<ConsoleEndpointCardProps> = ({
  title,
  subtitle,
  meta,
  avatar,
  badges,
  status,
  metrics,
  progress,
  error,
  actions,
  footer,
  className = '',
}) => {
  const cardClass = ['settings-provider-card', className].filter(Boolean).join(' ');
  const progressPercentage = progress?.percentage ?? 0;
  const progressTone = progressPercentage >= 90 ? 'rose' : progressPercentage >= 70 ? 'amber' : 'indigo';

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="settings-provider-card__avatar">{avatar}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[18px] font-semibold text-[var(--text-primary)]">{title}</div>
              {badges}
            </div>
            {subtitle ? <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{subtitle}</div> : null}
            {meta ? <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">{meta}</div> : null}
          </div>
        </div>
        <StatusBadge status={status.status} label={status.label} />
      </div>

      <div className="settings-provider-card__metrics">
        {metrics.map((metric, index) => (
          <div key={`${metric.label}-${index}`} className="settings-provider-card__metric">
            <div className="settings-provider-card__metric-label">{metric.label}</div>
            <div className="settings-provider-card__metric-value">{metric.value}</div>
            {metric.helper ? <div className="settings-provider-card__metric-helper">{metric.helper}</div> : null}
          </div>
        ))}
      </div>

      {footer ? <div className="mt-2">{footer}</div> : null}

      {progress ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
            <span>{progress.summary}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <ProgressBar progress={progressPercentage} tone={progressTone} showLabel={false} />
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-4 rounded-[18px] border px-4 py-3 text-[13px] leading-6"
          style={{ borderColor: 'var(--state-danger-border)', backgroundColor: 'var(--state-danger-bg)', color: 'var(--state-danger-text)' }}
        >
          {error}
        </div>
      ) : null}

      <div className="settings-provider-card__actions">{actions}</div>
    </article>
  );
};

const ApiSettingsView: React.FC<{ initialSupplier?: Supplier | null }> = ({ initialSupplier = null }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pick } = useLocale();
  const getOfficialDisplayName = useCallback(
    (provider: OfficialProvider) => (provider === 'Google' ? pick('谷歌', 'Google') : 'OpenAI'),
    [pick]
  );
  const { supplierId: legacySupplierId, officialId, providerId } = useParams<{
    supplierId?: string;
    officialId?: string;
    providerId?: string;
  }>();
  const [slots, setSlots] = useState<KeySlot[]>(() => keyManager.getSlots());
  const [providers, setProviders] = useState<ThirdPartyProvider[]>(() => keyManager.getProviders());
  const [activeTab, setActiveTab] = useState<TabType>('official');
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [officialForm, setOfficialForm] = useState<OfficialForm>(officialDefaults);
  const [providerForm, setProviderForm] = useState<ProviderForm>(providerDefaults);
  const [editingOfficialId, setEditingOfficialId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editorSource, setEditorSource] = useState<EditorSource>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const officialSlots = useMemo(() => slots.filter(isOfficialSlot), [slots]);
  const thirdPartyProviders = useMemo(() => [...providers].sort((a, b) => b.updatedAt - a.updatedAt), [providers]);
  const routeOfficialId = useMemo(() => decodeRouteParam(officialId), [officialId]);
  const routeProviderId = useMemo(() => decodeRouteParam(providerId || legacySupplierId), [legacySupplierId, providerId]);
  const selectedOfficialSlot = useMemo(
    () => officialSlots.find((slot) => normalizeRouteMatchValue(slot.id) === normalizeRouteMatchValue(routeOfficialId)) || null,
    [officialSlots, routeOfficialId]
  );
  const selectedProvider = useMemo(() => {
    const routeValue = normalizeRouteMatchValue(routeProviderId);
    if (!routeValue) return null;

    return (
      thirdPartyProviders.find((provider) =>
        [
          provider.id,
          provider.name,
          provider.baseUrl,
        ].some((candidate) => normalizeRouteMatchValue(candidate) === routeValue)
      ) || null
    );
  }, [routeProviderId, thirdPartyProviders]);
  const isOfficialEditorRoute = Boolean(routeOfficialId);
  const isProviderEditorRoute = Boolean(routeProviderId);
  const isCreatingOfficial = routeOfficialId === ROUTE_NEW_ITEM;
  const isCreatingProvider = routeProviderId === ROUTE_NEW_ITEM;
  const providerRouteMissing = isProviderEditorRoute && !isCreatingProvider && !selectedProvider && !initialSupplier;
  const officialRouteMissing = isOfficialEditorRoute && !isCreatingOfficial && !selectedOfficialSlot;
  const activeProviders = thirdPartyProviders.filter((item) => item.isActive).length;
  const budgetCount =
    officialSlots.filter((slot) => getMode(slot.budgetLimit, slot.tokenLimit) !== 'unlimited').length +
    thirdPartyProviders.filter((provider) => getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited') !== 'unlimited').length;
  const attentionCount =
    officialSlots.filter((slot) => slot.disabled || slot.status === 'invalid' || slot.status === 'rate_limited').length +
    thirdPartyProviders.filter((provider) => !provider.isActive || provider.status === 'error').length;
  const connectedChannels = officialSlots.filter((slot) => !slot.disabled).length + activeProviders;
  const showInlineOfficialCreate = editorMode === null && activeTab === 'official';
  const showInlineProviderCreate = editorMode === null && activeTab === 'third-party';
  const showOfficialEditor = editorMode === 'official' || showInlineOfficialCreate;
  const showProviderEditor = editorMode === 'third-party' || showInlineProviderCreate;

  const latencyCards = useMemo(() => {
    const officialItems = officialSlots
      .map((slot) => ({
        id: slot.id,
        label: getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google'),
        helper: slot.provider === 'OpenAI' ? '官方直连' : 'Gemini 官方直连',
        latency: slot.lastResponseTime ?? slot.avgResponseTime ?? null,
      }))
      .filter((item) => typeof item.latency === 'number' && item.latency > 0);

    const providerItems = thirdPartyProviders
      .map((provider) => ({
        id: provider.id,
        label: provider.name,
        helper: extractDomain(provider.baseUrl),
        latency: provider.activitySummary?.lastLatencyMs ?? null,
      }))
      .filter((item) => typeof item.latency === 'number' && item.latency > 0);

    return [...officialItems, ...providerItems]
      .sort((a, b) => Number(a.latency) - Number(b.latency))
      .slice(0, 4);
  }, [getOfficialDisplayName, officialSlots, thirdPartyProviders]);

  const refresh = () => {
    setSlots(keyManager.getSlots());
    setProviders(keyManager.getProviders());
  };

  useEffect(() => {
    refresh();
    return keyManager.subscribe(refresh);
  }, []);

  useEffect(() => {
    if (isOfficialEditorRoute) {
      setActiveTab('official');
      setEditorMode('official');
      setEditorSource('route');

      if (isCreatingOfficial) {
        setEditingOfficialId(null);
        setEditingProviderId(null);
        setOfficialForm(officialDefaults);
        return;
      }

      if (selectedOfficialSlot) {
        setEditingOfficialId(selectedOfficialSlot.id);
        setEditingProviderId(null);
        setOfficialForm(toOfficialForm(selectedOfficialSlot));
      }
      return;
    }

    if (isProviderEditorRoute) {
      setActiveTab('third-party');
      setEditorMode('third-party');
      setEditorSource('route');

      if (isCreatingProvider) {
        setEditingProviderId(null);
        setEditingOfficialId(null);
        setProviderForm(initialSupplier ? toProviderFormFromSupplier(initialSupplier) : providerDefaults);
        return;
      }

      if (selectedProvider) {
        setEditingProviderId(selectedProvider.id);
        setEditingOfficialId(null);
        setProviderForm(toProviderForm(selectedProvider));
        return;
      }

      if (initialSupplier) {
        setEditingProviderId(null);
        setEditingOfficialId(null);
        setProviderForm(toProviderFormFromSupplier(initialSupplier));
      }
      return;
    }

    if (editorSource === 'route' && location.pathname === API_MANAGEMENT_HOME_PATH) {
      setEditorMode(null);
      setEditingOfficialId(null);
      setEditingProviderId(null);
      setOfficialForm(officialDefaults);
      setProviderForm(providerDefaults);
      setEditorSource(null);
    }
  }, [
    editorSource,
    initialSupplier,
    isCreatingOfficial,
    isCreatingProvider,
    isOfficialEditorRoute,
    isProviderEditorRoute,
    location.pathname,
    selectedOfficialSlot?.id,
    selectedProvider?.id,
  ]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
      refresh();
    } finally {
      setBusy((current) => (current === key ? null : current));
    }
  };

  const beginCreateOfficial = () => {
    setActiveTab('official');
    setEditorMode('official');
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(officialDefaults);
    setEditorSource('local');
    navigate(buildOfficialEditorPath());
  };

  const beginCreateProvider = () => {
    setActiveTab('third-party');
    setEditorMode('third-party');
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setProviderForm(initialSupplier ? toProviderFormFromSupplier(initialSupplier) : providerDefaults);
    setEditorSource('local');
    navigate(buildProviderEditorPath());
  };

  const startEditOfficial = (slot: KeySlot) => {
    setActiveTab('official');
    setEditorMode('official');
    setEditingOfficialId(slot.id);
    setEditingProviderId(null);
    setOfficialForm(toOfficialForm(slot));
    setEditorSource('local');
    navigate(buildOfficialEditorPath(slot.id));
  };

  const startEditProvider = (provider: ThirdPartyProvider) => {
    setActiveTab('third-party');
    setEditorMode('third-party');
    setEditingOfficialId(null);
    setEditingProviderId(provider.id);
    setProviderForm(toProviderForm(provider));
    setEditorSource('local');
    navigate(buildProviderEditorPath(provider.id));
  };

  const cancelEdit = () => {
    setEditorMode(null);
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(officialDefaults);
    setProviderForm(providerDefaults);
    setEditorSource(null);
    navigate(API_MANAGEMENT_HOME_PATH);
  };

  const saveOfficial = async () => {
    const value = officialForm.mode === 'unlimited' ? null : positive(officialForm.value);
    if (!officialForm.key.trim()) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('请填写有效的 API Key。', 'Enter a valid API key.')
      );
      return;
    }
    if (officialForm.mode !== 'unlimited' && !value) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('预算或词元上限必须大于 0。', 'Budget or token limit must be greater than 0.')
      );
      return;
    }

    const payload = {
      budgetLimit: officialForm.mode === 'amount' ? value ?? -1 : -1,
      tokenLimit: officialForm.mode === 'tokens' ? value ?? -1 : -1,
    };

    await run(`official-save:${officialForm.id || 'new'}`, async () => {
      if (officialForm.id) {
        await keyManager.updateKey(officialForm.id, {
          name: officialForm.provider,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: '',
          key: officialForm.key.trim(),
          ...payload,
        });
        notify.success(
          pick('保存成功', 'Saved'),
          pick('官方接口配置已更新。', 'Official endpoint settings have been updated.')
        );
      } else {
        const result = await keyManager.addKey(officialForm.key.trim(), {
          name: officialForm.provider,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: '',
          ...payload,
        });
        if (!result.success) {
          notify.error(
            pick('新增失败', 'Creation failed'),
            result.error || pick('无法创建官方接口。', 'Unable to create the official endpoint.')
          );
          return;
        }
        notify.success(
          pick('新增成功', 'Created'),
          pick('官方接口已加入当前链路。', 'The official endpoint has been added to the current routing chain.')
        );
      }
      cancelEdit();
    });
  };

  const saveProvider = async () => {
    const value = providerForm.mode === 'unlimited' ? null : positive(providerForm.value);
    if (!providerForm.name.trim() || !providerForm.baseUrl.trim() || !providerForm.apiKey.trim()) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('请完整填写供应商名称、基础地址和 API Key。', 'Enter the provider name, base URL, and API key.')
      );
      return;
    }
    if (providerForm.mode !== 'unlimited' && !value) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('预算或词元上限必须大于 0。', 'Budget or token limit must be greater than 0.')
      );
      return;
    }

    const payload = {
      budgetLimit: providerForm.mode === 'amount' ? value ?? -1 : -1,
      tokenLimit: providerForm.mode === 'tokens' ? value ?? -1 : -1,
      customCostMode: providerForm.mode,
      customCostValue: value ?? undefined,
    };

    await run(`provider-save:${providerForm.id || 'new'}`, async () => {
      if (providerForm.id) {
        keyManager.updateProvider(providerForm.id, {
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: providerForm.apiKey.trim(),
          format: providerForm.format,
          group: providerForm.group.trim() || undefined,
          providerColor: providerForm.color,
          isActive: providerForm.isActive,
          ...payload,
        });
        await keyManager.syncToCloudNow();
        notify.success(
          pick('保存成功', 'Saved'),
          pick('供应商配置已更新。', 'Provider settings have been updated.')
        );
      } else {
        keyManager.addProvider({
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: providerForm.apiKey.trim(),
          models: [],
          format: providerForm.format,
          group: providerForm.group.trim() || undefined,
          providerColor: providerForm.color,
          isActive: providerForm.isActive,
          ...payload,
        });
        await keyManager.syncToCloudNow();
        notify.success(
          pick('新增成功', 'Created'),
          pick('供应商已加入当前调度池。', 'The provider has been added to the routing pool.')
        );
      }
      cancelEdit();
    });
  };

  const deleteOfficial = async (id: string) => {
    await run(`official-delete:${id}`, async () => {
      keyManager.removeKey(id);
      await keyManager.syncToCloudNow();
      notify.success(
        pick('删除成功', 'Deleted'),
        pick('官方接口已移除。', 'The official endpoint has been removed.')
      );
      if (editingOfficialId === id) cancelEdit();
    });
  };

  const deleteProvider = async (id: string) => {
    await run(`provider-delete:${id}`, async () => {
      keyManager.removeProvider(id);
      await keyManager.syncToCloudNow();
      notify.success(
        pick('删除成功', 'Deleted'),
        pick('供应商配置已移除。', 'The provider configuration has been removed.')
      );
      if (editingProviderId === id) cancelEdit();
    });
  };

  const toggleOfficial = async (slot: KeySlot) => {
    const nextDisabled = !slot.disabled;
    await run(`official-toggle:${slot.id}`, async () => {
      await keyManager.updateKey(slot.id, { disabled: nextDisabled });
      notify.success(
        nextDisabled ? pick('已暂停', 'Paused') : pick('已启用', 'Enabled'),
        pick(`${slot.name} 的调度状态已更新。`, `${slot.name} scheduling status has been updated.`)
      );
    });
  };

  const toggleProvider = async (provider: ThirdPartyProvider) => {
    const nextActive = !provider.isActive;
    await run(`provider-toggle:${provider.id}`, async () => {
      keyManager.updateProvider(provider.id, { isActive: nextActive });
      notify.success(
        nextActive ? pick('已启用', 'Enabled') : pick('已暂停', 'Paused'),
        pick(`${provider.name} 的调度状态已更新。`, `${provider.name} scheduling status has been updated.`)
      );
    });
  };

  const refreshOfficial = async (slot: KeySlot) => {
    await run(`official-check:${slot.id}`, async () => {
      const provider = slot.provider === 'OpenAI' ? 'OpenAI' : 'Google';
      const baseUrl = provider === 'Google' ? 'https://generativelanguage.googleapis.com' : 'https://api.openai.com';
      const check = await keyManager.testChannel(
        baseUrl,
        slot.key,
        provider,
        slot.authMethod,
        slot.headerName,
        provider === 'Google' ? 'gemini' : 'openai'
      );
      const models = check.success ? await autoDetectAndConfigureModels(slot.key, baseUrl, provider === 'Google' ? 'gemini' : 'openai') : null;
      await keyManager.updateKey(slot.id, {
        status: check.success ? 'valid' : 'invalid',
        lastError: check.success ? null : check.message || '连接失败',
        supportedModels: models?.success ? models.models : slot.supportedModels,
      });
      if (check.success) {
        notify.success(
          pick('刷新成功', 'Refreshed'),
          pick(`${slot.name} 已完成连通检测。`, `${slot.name} connectivity check is complete.`)
        );
      } else {
        notify.warning(
          pick('检测失败', 'Check failed'),
          check.message || pick('请检查密钥和网络连通性。', 'Check the key and network connectivity.')
        );
      }
    });
  };

  const refreshProvider = async (provider: ThirdPartyProvider) => {
    await run(`provider-check:${provider.id}`, async () => {
      const check = await keyManager.testChannel(provider.baseUrl, provider.apiKey, provider.name, undefined, undefined, provider.format);
      const models = check.success ? await autoDetectAndConfigureModels(provider.apiKey, provider.baseUrl, provider.format) : null;
      keyManager.updateProvider(provider.id, {
        status: check.success ? 'active' : 'error',
        lastChecked: Date.now(),
        lastError: check.success ? undefined : check.message || '连接失败',
        models: models?.success ? models.models : provider.models,
      });
      if (check.success) {
        notify.success(
          pick('刷新成功', 'Refreshed'),
          pick(`${provider.name} 已完成连通检测。`, `${provider.name} connectivity check is complete.`)
        );
      } else {
        notify.warning(
          pick('检测失败', 'Check failed'),
          check.message || pick('请检查基础地址和密钥。', 'Check the base URL and key.')
        );
      }
    });
  };

  const syncPricing = async (provider: ThirdPartyProvider) => {
    await run(`provider-price:${provider.id}`, async () => {
      const result = await keyManager.syncProviderPricingDetailed(provider.id);
      if (result.ok) {
        notify.success(
          pick('同步成功', 'Synced'),
          result.message || pick('价格信息已更新。', 'Pricing information has been updated.')
        );
      } else {
        notify.warning(
          pick('同步失败', 'Sync failed'),
          result.message || pick('当前没有可用的价格数据返回。', 'No pricing data is available right now.')
        );
      }
    });
  };

  if (officialRouteMissing) {
    return (
      <SettingsViewShell>
        <SettingsHero
          eyebrow={pick('接口编辑', 'Endpoint editor')}
          title={pick('找不到接口', 'Endpoint not found')}
          description={pick(
            '当前要编辑的官方接口已经不存在了，先回到列表重新选择。',
            'The official endpoint you are editing no longer exists. Return to the list and pick another one.'
          )}
          icon={Shield}
          tone="amber"
          actions={
            <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>
              {pick('返回接口列表', 'Back to endpoints')}
            </SettingsActionButton>
          }
        />

        <SettingsSection title={pick('接口不存在', 'Endpoint missing')} eyebrow={pick('无法继续编辑', 'Cannot continue')}>
          <EmptyState
            title={pick('这条官方接口可能已经被删除', 'This official endpoint may have been removed')}
            description={pick(
              '返回 API 管理列表后重新选择要编辑的接口。',
              'Return to API Management and choose another endpoint to edit.'
            )}
            action={
              <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>
                {pick('返回接口列表', 'Back to endpoints')}
              </SettingsActionButton>
            }
          />
        </SettingsSection>
      </SettingsViewShell>
    );
  }

  if (providerRouteMissing) {
    return (
      <SettingsViewShell>
        <SettingsHero
          eyebrow={pick('供应商编辑', 'Provider editor')}
          title={pick('找不到供应商', 'Provider not found')}
          description={pick(
            '当前要编辑的供应商已经不存在了，先回到列表重新选择。',
            'The provider you are editing no longer exists. Return to the list and pick another one.'
          )}
          icon={Globe}
          tone="amber"
          actions={
            <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>
              {pick('返回供应商列表', 'Back to providers')}
            </SettingsActionButton>
          }
        />

        <SettingsSection title={pick('供应商不存在', 'Provider missing')} eyebrow={pick('无法继续编辑', 'Cannot continue')}>
          <EmptyState
            title={pick('目标供应商不存在或已被移除', 'The target provider is missing or has been removed')}
            description={pick(
              '返回 API 管理列表后重新选择要编辑的供应商。',
              'Return to API Management and choose another provider to edit.'
            )}
            action={
              <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>
                {pick('返回供应商列表', 'Back to providers')}
              </SettingsActionButton>
            }
          />
        </SettingsSection>
      </SettingsViewShell>
    );
  }

  return (
    <SettingsViewShell>
      {editorMode === 'official' ? (
        <SettingsHero
          eyebrow={pick('接口编辑', 'Endpoint editor')}
          title={editingOfficialId ? getOfficialDisplayName(officialForm.provider) : pick('新增官方接口', 'New official endpoint')}
          description={
            editingOfficialId
              ? pick('当前页面只修改这一条官方接口，保存后返回列表。', 'This page edits one official endpoint at a time and returns to the list after saving.')
              : pick('在独立页面创建官方接口，避免和列表卡片混在一起。', 'Create official endpoints in a focused editor instead of mixing them with the list.')
          }
          icon={Shield}
          tone={selectedOfficialSlot ? getOfficialStatus(selectedOfficialSlot).badge : 'indigo'}
          badge={
            <SettingsBadge tone={editingOfficialId ? 'indigo' : 'emerald'}>
              {editingOfficialId ? pick('编辑模式', 'Edit mode') : pick('新增模式', 'Create mode')}
            </SettingsBadge>
          }
          actions={
            <>
              <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>
                {pick('返回接口列表', 'Back to endpoints')}
              </SettingsActionButton>
              {selectedOfficialSlot ? (
                <SettingsActionButton
                  icon={RefreshCw}
                  loading={busy === `official-check:${selectedOfficialSlot.id}`}
                  onClick={() => void refreshOfficial(selectedOfficialSlot)}
                >
                  {pick('刷新连通性', 'Refresh connectivity')}
                </SettingsActionButton>
              ) : null}
            </>
          }
          metrics={
            <>
              <SettingsMetricCard
                label={pick('当前接口', 'Current endpoint')}
                value={getOfficialDisplayName(officialForm.provider)}
                helper={editingOfficialId ? pick('你现在编辑的是这一条接口', 'You are editing this endpoint now') : pick('保存后会加入官方接口列表', 'After saving it will join the endpoint list')}
                icon={Key}
                tone="indigo"
              />
              <SettingsMetricCard
                label={pick('服务商', 'Provider')}
                value={getOfficialDisplayName(officialForm.provider)}
                helper={getOfficialProviderLabel(officialForm.provider)}
                icon={Shield}
                tone="indigo"
              />
              <SettingsMetricCard
                label={pick('预算策略', 'Budget rule')}
                value={getModeLabel(officialForm.mode)}
                helper={getLimitValueLabel(officialForm.mode, positive(officialForm.value) ?? undefined)}
                icon={Layers3}
                tone={officialForm.mode === 'unlimited' ? 'neutral' : 'amber'}
              />
              <SettingsMetricCard
                label={pick('最近检测', 'Latest check')}
                value={selectedOfficialSlot ? formatLatency(selectedOfficialSlot.lastResponseTime ?? selectedOfficialSlot.avgResponseTime ?? null) : pick('待保存', 'Not saved yet')}
                helper={selectedOfficialSlot ? formatDateTime(selectedOfficialSlot.lastUsed || selectedOfficialSlot.updatedAt || selectedOfficialSlot.createdAt) : pick('新增后可进行连通检测', 'Connectivity checks are available after creation')}
                icon={Clock3}
                tone={selectedOfficialSlot ? getOfficialStatus(selectedOfficialSlot).badge : 'neutral'}
              />
            </>
          }
        />
      ) : null}

      {editorMode === 'third-party' ? (
        <SettingsHero
          eyebrow={pick('供应商编辑', 'Provider editor')}
          title={editingProviderId ? providerForm.name.trim() || pick('未命名供应商', 'Unnamed provider') : pick('新增供应商', 'New provider')}
          description={
            editingProviderId
              ? pick('当前页面只修改这一家供应商，保存后返回列表。', 'This page edits one provider at a time and returns to the list after saving.')
              : pick('在独立页面创建供应商，编辑时不会再和卡片列表混在一起。', 'Create providers in a focused editor instead of mixing them with the list.')
          }
          icon={Globe}
          tone={selectedProvider ? getProviderStatus(selectedProvider).badge : providerForm.isActive ? 'emerald' : 'neutral'}
          badge={
            <SettingsBadge tone={editingProviderId ? 'indigo' : 'emerald'}>
              {editingProviderId ? pick('编辑模式', 'Edit mode') : pick('新增模式', 'Create mode')}
            </SettingsBadge>
          }
          actions={
            <>
              <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>
                {pick('返回供应商列表', 'Back to providers')}
              </SettingsActionButton>
              {selectedProvider ? (
                <>
                  <SettingsActionButton
                    icon={RefreshCw}
                    loading={busy === `provider-check:${selectedProvider.id}`}
                    onClick={() => void refreshProvider(selectedProvider)}
                  >
                    {pick('刷新连通性', 'Refresh connectivity')}
                  </SettingsActionButton>
                  <SettingsActionButton
                    icon={Wand2}
                    loading={busy === `provider-price:${selectedProvider.id}`}
                    onClick={() => void syncPricing(selectedProvider)}
                  >
                    {pick('自动获取价格', 'Sync pricing')}
                  </SettingsActionButton>
                </>
              ) : null}
            </>
          }
          metrics={
            <>
              <SettingsMetricCard
                label={pick('当前供应商', 'Current provider')}
                value={providerForm.name.trim() || pick('未命名供应商', 'Unnamed provider')}
                helper={editingProviderId ? pick('你现在编辑的是这一家供应商', 'You are editing this provider now') : pick('保存后会加入供应商列表', 'After saving it will join the provider list')}
                icon={Globe}
                tone="indigo"
              />
              <SettingsMetricCard
                label={pick('基础地址', 'Base URL')}
                value={extractDomain(providerForm.baseUrl)}
                helper={pick('连通检测、模型拉取和价格同步都会使用这里', 'Connectivity checks, model sync, and pricing sync all use this URL')}
                icon={Key}
                tone="neutral"
              />
              <SettingsMetricCard
                label={pick('通信协议', 'Protocol')}
                value={getProtocolLabel(providerForm.format)}
                helper={pick('决定请求结构、模型识别和价格同步方式', 'Determines request shape, model detection, and pricing sync behavior')}
                icon={Layers3}
                tone="indigo"
              />
              <SettingsMetricCard
                label={pick('调度状态', 'Scheduling')}
                value={providerForm.isActive ? pick('参与调度', 'Included in routing') : pick('暂停调度', 'Routing paused')}
                helper={selectedProvider ? formatDateTime(selectedProvider.lastChecked || selectedProvider.updatedAt) : pick('保存后可继续做检测和价格同步', 'Checks and pricing sync are available after saving')}
                icon={Clock3}
                tone={providerForm.isActive ? 'emerald' : 'neutral'}
              />
            </>
          }
        />
      ) : null}

      {editorMode === null ? (
        <>
          <SettingsHero
        eyebrow={pick('高级设置', 'Advanced settings')}
        title={pick('API 管理', 'API management')}
        description={pick(
          '统一管理官方接口、第三方供应商、通信协议和预算策略。这里所有按钮都只表达一个真实动作，不再混用保存、刷新和同步语义。',
          'Manage official endpoints, third-party providers, protocols, and budgets in one place. Each action now maps to one clear behavior.'
        )}
        icon={Key}
        tone={attentionCount > 0 ? 'amber' : connectedChannels > 0 ? 'emerald' : 'neutral'}
        badge={
          <SettingsBadge tone={attentionCount > 0 ? 'amber' : connectedChannels > 0 ? 'emerald' : 'neutral'}>
            {connectedChannels > 0
              ? pick(`已接入 ${connectedChannels} 条链路`, `${connectedChannels} routes connected`)
              : pick('尚未接入链路', 'No routes connected yet')}
          </SettingsBadge>
        }
        actions={
          <>
            <SettingsActionButton icon={RefreshCw} onClick={refresh}>{pick('刷新数据', 'Refresh data')}</SettingsActionButton>
            <SettingsActionButton icon={Plus} tone="primary" onClick={activeTab === 'official' ? beginCreateOfficial : beginCreateProvider}>
              {activeTab === 'official' ? pick('新增官方接口', 'New official endpoint') : pick('新增供应商', 'New provider')}
            </SettingsActionButton>
          </>
        }
        metrics={
          <>
            <SettingsMetricCard
              label={pick('官方接口', 'Official endpoints')}
              value={`${officialSlots.length}`}
              helper={pick(
                `${officialSlots.filter((slot) => !slot.disabled).length} 条当前可参与调度`,
                `${officialSlots.filter((slot) => !slot.disabled).length} currently available for routing`
              )}
              icon={Shield}
              tone={officialSlots.length > 0 ? 'indigo' : 'neutral'}
            />
            <SettingsMetricCard
              label={pick('在线供应商', 'Active providers')}
              value={`${activeProviders}/${thirdPartyProviders.length}`}
              helper={thirdPartyProviders.length > 0
                ? pick(
                    `${thirdPartyProviders.filter((provider) => provider.status === 'error').length} 个存在异常`,
                    `${thirdPartyProviders.filter((provider) => provider.status === 'error').length} with issues`
                  )
                : pick('尚未配置第三方供应商', 'No third-party providers configured yet')}
              icon={Globe}
              tone={activeProviders > 0 ? 'emerald' : 'neutral'}
            />
            <SettingsMetricCard
              label={pick('预算策略', 'Budget rules')}
              value={`${budgetCount}`}
              helper={pick('已设置预算或词元上限的链路数量', 'Routes with a budget or token limit')}
              icon={Layers3}
              tone={budgetCount > 0 ? 'amber' : 'neutral'}
            />
            <SettingsMetricCard
              label={pick('待处理项', 'Needs attention')}
              value={`${attentionCount}`}
              helper={attentionCount > 0
                ? pick('建议优先排查异常与暂停链路', 'Review failed or paused routes first')
                : pick('当前没有待优先处理的问题', 'No urgent routing issues right now')}
              icon={Activity}
              tone={attentionCount > 0 ? 'rose' : 'emerald'}
            />
          </>
        }
      />

      <SettingsSection
        title={pick('运行视图', 'Runtime view')}
        eyebrow={pick('链路面板', 'Routing panel')}
        description={pick(
          '先决定你当前要看的是官方接口还是第三方供应商，再进入对应的卡片和编辑器。',
          'Choose whether you want to inspect official endpoints or third-party providers, then move into the matching cards and editor.'
        )}
        action={
          <SettingsBadge tone={activeTab === 'official' ? 'indigo' : 'emerald'}>
            {activeTab === 'official' ? pick('官方接口视图', 'Official endpoint view') : pick('第三方供应商视图', 'Third-party provider view')}
          </SettingsBadge>
        }
      >
        <div className="space-y-4">
          <SegmentedControl
            options={[
              { value: 'official', label: pick('官方接口', 'Official endpoints') },
              { value: 'third-party', label: pick('第三方供应商', 'Third-party providers') },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as TabType)}
          />

          {latencyCards.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {latencyCards.map((item) => (
                <InfoCell key={item.id} label={item.label} value={formatLatency(item.latency)} helper={item.helper} />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                {pick('全局延迟概览', 'Global latency summary')}
              </div>
              <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                {pick(
                  '暂无最近一次的延迟检测结果。你可以点击任意卡片上的“刷新”来重新检测连通状态、模型列表和延迟。',
                  'No recent latency checks are available yet. Use Refresh on any card to re-check connectivity, models, and latency.'
                )}
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {activeTab === 'official' ? (
        <SettingsSection
          title={pick('官方接口', 'Official endpoints')}
          eyebrow={pick('官方渠道', 'Official channels')}
          description={pick(
            '适合直连 OpenAI 和 Gemini 官方接口，用于承担稳定、核心的生产流量。',
            'Best for direct OpenAI and Gemini traffic that needs a stable primary route.'
          )}
          action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateOfficial}>{pick('新增官方接口', 'New official endpoint')}</SettingsActionButton>}
        >
          {officialSlots.length === 0 ? (
            <EmptyState
              title={pick('当前还没有官方接口', 'No official endpoints yet')}
              description={pick(
                '先添加 OpenAI 或 Gemini 官方接口，再让它们进入调度。',
                'Add an OpenAI or Gemini endpoint first, then bring it into routing.'
              )}
              action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateOfficial}>{pick('新增官方接口', 'New official endpoint')}</SettingsActionButton>}
            />
          ) : (
            <div className="settings-provider-grid">
              {officialSlots.map((slot) => {
                const mode = getMode(slot.budgetLimit, slot.tokenLimit);
                const status = getOfficialStatus(slot);
                const progress = getProgress(mode, mode === 'amount' ? slot.totalCost : slot.usedTokens || 0, slot.budgetLimit, slot.tokenLimit);
                const usageSummary = getOfficialUsageSummary(slot);
                const progressData = mode !== 'unlimited' ? { summary: usageSummary, percentage: progress } : undefined;

                const metrics: ConsoleEndpointCardMetric[] = [
                  {
                    label: pick('预算策略', 'Budget rule'),
                    value: getModeLabel(mode),
                    helper: getLimitValueLabel(mode, mode === 'amount' ? slot.budgetLimit : slot.tokenLimit),
                  },
                  {
                    label: pick('累计消耗', 'Total usage'),
                    value: mode === 'tokens' ? formatTokens(slot.usedTokens || 0) : formatUsd(slot.totalCost),
                    helper: usageSummary,
                  },
                  {
                    label: pick('支持模型', 'Supported models'),
                    value: `${slot.supportedModels.length}`,
                    helper: slot.supportedModels.length > 0 ? pick('已自动识别模型列表', 'Auto detected models list') : pick('点击刷新后自动拉取', 'Refresh to fetch models'),
                  },
                  {
                    label: pick('最近延迟', 'Latest latency'),
                    value: formatLatency(slot.lastResponseTime ?? slot.avgResponseTime ?? null),
                    helper: formatDateTime(slot.lastUsed || slot.updatedAt || slot.createdAt),
                  },
                ];

                const avatar = (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border" style={SETTINGS_OVERLAY_STYLE}>
                    <Shield size={18} className="text-[var(--text-primary)]" />
                  </div>
                );

                return (
                  <ConsoleEndpointCard
                    key={slot.id}
                    title={getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google')}
                    subtitle={slot.provider === 'OpenAI' ? pick('OpenAI 官方接口', 'OpenAI official endpoint') : pick('谷歌官方接口', 'Google official endpoint')}
                    meta={pick('Key 预览：', 'Key preview:') + maskSecret(slot.key)}
                    avatar={avatar}
                    status={status}
                    metrics={metrics}
                    progress={progressData}
                    error={slot.lastError}
                    actions={
                      <>
                        <SettingsActionButton icon={Edit3} size="sm" onClick={() => startEditOfficial(slot)}>{pick('编辑', 'Edit')}</SettingsActionButton>
                        <SettingsActionButton icon={RefreshCw} size="sm" loading={busy === `official-check:${slot.id}`} onClick={() => void refreshOfficial(slot)}>{pick('刷新', 'Refresh')}</SettingsActionButton>
                        <SettingsActionButton icon={slot.disabled ? Play : Pause} size="sm" onClick={() => void toggleOfficial(slot)}>
                          {slot.disabled ? pick('启用', 'Enable') : pick('暂停', 'Pause')}
                        </SettingsActionButton>
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </SettingsSection>
      ) : (
        <SettingsSection
          title={pick('第三方供应商', 'Third-party providers')}
          eyebrow={pick('第三方渠道', 'Third-party channels')}
          description={pick(
            '这里重点处理供应商列表、通信协议和自动价格同步，适合做扩容和多源调度。',
            'This view focuses on provider lists, protocol settings, and pricing sync for scale-out and multi-source routing.'
          )}
          action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateProvider}>{pick('新增供应商', 'New provider')}</SettingsActionButton>}
        >
          {thirdPartyProviders.length === 0 ? (
            <EmptyState
              title={pick('当前还没有第三方供应商', 'No third-party providers yet')}
              description={pick(
                '先添加一个供应商，再配置协议、预算和自动价格同步。',
                'Add a provider first, then configure its protocol, budget, and pricing sync.'
              )}
              action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateProvider}>{pick('新增供应商', 'New provider')}</SettingsActionButton>}
            />
          ) : (
            <div className="settings-provider-grid">
              {thirdPartyProviders.map((provider) => {
                const mode = getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited');
                const status = getProviderStatus(provider);
                const progress = getProgress(mode, mode === 'amount' ? provider.usage.totalCost : provider.usage.totalTokens, provider.budgetLimit, provider.tokenLimit);
                const usageSummary = getProviderUsageSummary(provider);
                const progressData = mode !== 'unlimited' ? { summary: usageSummary, percentage: progress } : undefined;

                const metrics: ConsoleEndpointCardMetric[] = [
                  {
                    label: pick('预算策略', 'Budget rule'),
                    value: getModeLabel(mode),
                    helper: getLimitValueLabel(mode, mode === 'amount' ? provider.budgetLimit : provider.tokenLimit),
                  },
                  {
                    label: pick('总使用', 'Total usage'),
                    value: mode === 'tokens' ? formatTokens(provider.usage.totalTokens) : formatUsd(provider.usage.totalCost),
                    helper: usageSummary,
                  },
                  {
                    label: pick('支持模型', 'Supported models'),
                    value: `${provider.models.length}`,
                    helper:
                      provider.models.length > 0
                        ? pick('自动识别的模型典藏', 'Auto detected models list')
                        : pick('刷新以提取模型', 'Refresh to fetch models'),
                  },
                  {
                    label: pick('最近检测', 'Latest latency'),
                    value: formatLatency(provider.activitySummary?.lastLatencyMs ?? null),
                    helper: formatDateTime(provider.lastChecked || provider.updatedAt),
                  },
                ];

                const avatar = (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border text-[14px] font-semibold" style={{ ...SETTINGS_OVERLAY_STYLE, color: provider.providerColor || '#60A5FA' }}>
                    {provider.name.charAt(0).toUpperCase()}
                  </div>
                );

                const activityLine = getProviderActivityLine(provider);

                return (
                  <ConsoleEndpointCard
                    key={provider.id}
                    title={provider.name}
                    subtitle={getProtocolLabel(provider.format)}
                    meta={<div className="text-[13px] text-[var(--text-secondary)]">{extractDomain(provider.baseUrl)}</div>}
                    avatar={avatar}
                    badges={provider.group ? <SettingsBadge tone="neutral">{provider.group}</SettingsBadge> : null}
                    status={status}
                    metrics={metrics}
                    progress={progressData}
                    error={provider.lastError || null}
                    footer={activityLine ? <div className="text-[13px] text-[var(--text-secondary)]">{activityLine}</div> : null}
                    actions={
                      <>
                        <SettingsActionButton icon={Edit3} size="sm" onClick={() => startEditProvider(provider)}>
                          {pick('编辑', 'Edit')}
                        </SettingsActionButton>
                        <SettingsActionButton icon={RefreshCw} size="sm" loading={busy === `provider-check:${provider.id}`} onClick={() => void refreshProvider(provider)}>
                          {pick('刷新', 'Refresh')}
                        </SettingsActionButton>
                        <SettingsActionButton icon={Wand2} size="sm" loading={busy === `provider-price:${provider.id}`} onClick={() => void syncPricing(provider)}>
                          {pick('自动获取价格', 'Sync pricing')}
                        </SettingsActionButton>
                        <SettingsActionButton icon={provider.isActive ? Pause : Play} size="sm" onClick={() => void toggleProvider(provider)}>
                          {provider.isActive ? pick('暂停', 'Pause') : pick('启用', 'Enable')}
                        </SettingsActionButton>
                      </>
                    }
                    className="settings-reference-card--soft"
                  />
                );
              })}
            </div>
          )}
        </SettingsSection>
      )}
        </>
      ) : null}

      {showOfficialEditor ? (
        <SettingsSection
          title={pick('官方接口编辑器', 'Official endpoint editor')}
          eyebrow={
            editingOfficialId
              ? pick('编辑官方接口', 'Edit official endpoint')
              : showInlineOfficialCreate
                ? pick('快速新增官方接口', 'Quick create official endpoint')
                : pick('新增官方接口', 'Create official endpoint')
          }
          description={pick(
            showInlineOfficialCreate
              ? '如果上方“新增官方接口”按钮没有反应，也可以直接在这里填写并保存。'
              : '保存只负责提交当前表单；刷新和启用状态请在上面的接口卡片里单独操作。',
            showInlineOfficialCreate
              ? 'If the New official endpoint button above does not respond, you can fill out this form here and save directly.'
              : 'Save only submits this form. Refresh and enable states are still managed from the endpoint cards above.'
          )}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCell
                label={pick('当前对象', 'Current object')}
                value={getOfficialDisplayName(officialForm.provider)}
                helper={editingOfficialId ? pick('正在编辑已有接口', 'Editing an existing endpoint') : pick('准备新增一条官方链路', 'Preparing a new official route')}
              />
              <InfoCell
                label={pick('服务商', 'Provider')}
                value={getOfficialDisplayName(officialForm.provider)}
                helper={getOfficialProviderLabel(officialForm.provider)}
              />
              <InfoCell
                label={pick('预算策略', 'Budget rule')}
                value={getModeLabel(officialForm.mode)}
                helper={
                  officialForm.mode === 'unlimited'
                    ? pick('当前不限制累计消耗', 'There is no cumulative usage limit right now')
                    : officialForm.mode === 'amount'
                      ? pick('按累计金额控制预算', 'Budget is controlled by cumulative amount')
                      : pick('按累计词元量控制预算', 'Budget is controlled by cumulative tokens')
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label={pick('接口名称', 'Endpoint name')}
                value={getOfficialDisplayName(officialForm.provider)}
                onChange={() => setOfficialForm((current) => ({ ...current, name: current.provider }))}
                placeholder={pick('会根据提供商自动固定', 'Automatically fixed by provider')}
                helper={pick('官方接口名称固定按提供商显示；谷歌会跟随语言显示为“谷歌”或“Google”。', 'Official endpoint names are fixed by provider; Google follows the current language.')}
              />
              <SettingSelect
                label={pick('服务商', 'Provider')}
                value={officialForm.provider}
                options={[
                  { value: 'Google', label: pick('谷歌', 'Google') },
                  { value: 'OpenAI', label: 'OpenAI' },
                ]}
                onChange={(value) => setOfficialForm((current) => ({ ...current, provider: value as OfficialProvider, name: value as OfficialProvider }))}
              />
            </div>

            <SettingInput
              label="API Key"
              value={officialForm.key}
              onChange={(value) => setOfficialForm((current) => ({ ...current, key: value }))}
              placeholder={pick('输入官方接口的 API Key', 'Enter the official endpoint API key')}
              type="password"
              helper={pick('这里只保存当前接口使用的密钥，不会和刷新动作混用。', 'This field only saves the key for this endpoint and does not trigger refresh behavior.')}
            />

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">{pick('预算策略', 'Budget rule')}</div>
              <SegmentedControlMulti options={[...BUDGET_OPTIONS]} value={getModeOption(officialForm.mode)} onChange={(value) => setOfficialForm((current) => ({ ...current, mode: parseModeOption(value) }))} />
              {officialForm.mode !== 'unlimited' ? (
                <div className="mt-3">
                  <SettingInput
                    label={officialForm.mode === 'amount' ? pick('预算上限', 'Budget limit') : pick('词元上限', 'Token limit')}
                    value={officialForm.value}
                    onChange={(value) => setOfficialForm((current) => ({ ...current, value }))}
                    type="number"
                    placeholder={officialForm.mode === 'amount' ? pick('例如：100', 'For example: 100') : pick('例如：1000000', 'For example: 1000000')}
                    helper={officialForm.mode === 'amount' ? pick('金额预算按累计成本统计。', 'Amount budgets are tracked by cumulative cost.') : pick('词元上限按累计词元量统计。', 'Token limits are tracked by cumulative token usage.')}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton onClick={() => void saveOfficial()} loading={busy === `official-save:${officialForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingOfficialId ? pick('保存变更', 'Save changes') : pick('新增官方接口', 'Create endpoint')}
              </PrimaryButton>
              <SecondaryButton onClick={cancelEdit}>
                {editingOfficialId ? pick('取消', 'Cancel') : pick('清空', 'Reset')}
              </SecondaryButton>
              {editingOfficialId ? (
                <DangerButton onClick={() => void deleteOfficial(editingOfficialId)} className="ml-auto">
                  <Trash2 size={16} className="mr-1" />
                  {pick('删除接口', 'Delete endpoint')}
                </DangerButton>
              ) : null}
            </div>
          </div>
        </SettingsSection>
      ) : null}

      {showProviderEditor ? (
        <SettingsSection
          title={pick('供应商编辑器', 'Provider editor')}
          eyebrow={
            editingProviderId
              ? pick('编辑供应商', 'Edit provider')
              : showInlineProviderCreate
                ? pick('快速新增供应商', 'Quick create provider')
                : pick('新增供应商', 'Create provider')
          }
          description={pick(
            showInlineProviderCreate
              ? '如果上方“新增供应商”按钮没有反应，也可以直接在这里填写并保存。'
              : '“自动获取价格”只负责同步价格数据，不负责保存当前表单；保存按钮才会提交供应商配置。',
            showInlineProviderCreate
              ? 'If the New provider button above does not respond, you can fill out this form here and save directly.'
              : 'Sync pricing only pulls pricing data. It does not save this form; only Save submits the provider configuration.'
          )}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCell
                label={pick('当前对象', 'Current object')}
                value={providerForm.name.trim() || pick('未命名供应商', 'Unnamed provider')}
                helper={editingProviderId ? pick('正在编辑已有供应商', 'Editing an existing provider') : pick('准备新增一个供应商', 'Preparing a new provider')}
              />
              <InfoCell
                label={pick('通信协议', 'Protocol')}
                value={getProtocolLabel(providerForm.format)}
                helper={pick('决定请求结构、模型识别和价格拉取方式', 'Determines request shape, model detection, and pricing sync behavior')}
              />
              <InfoCell
                label={pick('调度状态', 'Scheduling')}
                value={providerForm.isActive ? pick('参与调度', 'Included in routing') : pick('暂停调度', 'Routing paused')}
                helper={providerForm.mode === 'unlimited' ? pick('当前不限制预算', 'There is no budget limit right now') : getModeLabel(providerForm.mode)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label={pick('供应商名称', 'Provider name')}
                value={providerForm.name}
                onChange={(value) => setProviderForm((current) => ({ ...current, name: value }))}
                placeholder={pick('例如：SiliconFlow', 'For example: SiliconFlow')}
                helper={pick('建议写成你在团队里常用的供应商名称。', 'Use the provider name your team already recognizes.')}
              />
              <SettingInput
                label={pick('主题颜色', 'Theme color')}
                value={providerForm.color}
                onChange={(value) => setProviderForm((current) => ({ ...current, color: value }))}
                placeholder="#60A5FA"
                helper={pick('用于列表卡片的识别色，不影响真实请求。', 'Used as the list accent color and does not affect real requests.')}
              />
            </div>

            <SettingInput
              label={pick('基础地址', 'Base URL')}
              value={providerForm.baseUrl}
              onChange={(value) => setProviderForm((current) => ({ ...current, baseUrl: value }))}
              placeholder="https://api.example.com/v1"
              helper={pick('通信检测、模型拉取和价格同步都会基于这里的地址。', 'Connectivity checks, model sync, and pricing sync all use this URL.')}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label="API Key"
                value={providerForm.apiKey}
                onChange={(value) => setProviderForm((current) => ({ ...current, apiKey: value }))}
                placeholder={pick('输入供应商 API Key', 'Enter the provider API key')}
                type="password"
              />
              <SettingSelect
                label={pick('通信协议', 'Protocol')}
                value={providerForm.format}
                options={[
                  { value: 'auto', label: pick('自动识别', 'Auto detect') },
                  { value: 'openai', label: pick('OpenAI 协议', 'OpenAI protocol') },
                  { value: 'gemini', label: pick('Gemini 协议', 'Gemini protocol') },
                  { value: 'claude', label: pick('Claude 协议', 'Claude protocol') },
                ]}
                onChange={(value) => setProviderForm((current) => ({ ...current, format: value as ApiProtocolFormat }))}
                helper={pick('默认推荐自动识别，必要时再手动固定协议。', 'Auto detect is recommended unless you need to lock the protocol manually.')}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label={pick('分组', 'Group')}
                value={providerForm.group}
                onChange={(value) => setProviderForm((current) => ({ ...current, group: value }))}
                placeholder={pick('例如：国内通道', 'For example: CN route')}
                helper={pick('用于组织和筛选供应商，不影响请求协议。', 'Used for organization and filtering, without affecting request behavior.')}
              />
              <div className="rounded-[22px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
                <SettingToggle
                  label={pick('参与调度', 'Include in routing')}
                  helper={pick('关闭后，供应商会保留配置，但不会再参与自动调度。', 'When disabled, the provider stays configured but is removed from automatic routing.')}
                  checked={providerForm.isActive}
                  onChange={(checked) => setProviderForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>

            <div className="rounded-[24px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">{pick('自动获取价格', 'Sync pricing')}</div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    {pick(
                      '这个动作只会尝试从供应商价格端点同步价格数据，不会保存表单。如果当前供应商还没落库，请先点击“保存变更”或“新增供应商”。',
                      'This action only pulls pricing data from the provider endpoint and does not save the form. Save the provider first before syncing pricing.'
                    )}
                  </div>
                </div>
                {editingProviderId ? (
                  <SettingsActionButton
                    icon={Wand2}
                    loading={busy === `provider-price:${editingProviderId}`}
                    onClick={() => {
                      const matched = thirdPartyProviders.find((item) => item.id === editingProviderId);
                      if (matched) void syncPricing(matched);
                    }}
                  >
                    {pick('自动获取价格', 'Sync pricing')}
                  </SettingsActionButton>
                ) : (
                  <SettingsBadge tone="neutral">{pick('需先保存后可同步', 'Save before syncing')}</SettingsBadge>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">{pick('预算策略', 'Budget rule')}</div>
              <SegmentedControlMulti options={[...BUDGET_OPTIONS]} value={getModeOption(providerForm.mode)} onChange={(value) => setProviderForm((current) => ({ ...current, mode: parseModeOption(value) }))} />
              {providerForm.mode !== 'unlimited' ? (
                <div className="mt-3">
                  <SettingInput
                    label={providerForm.mode === 'amount' ? pick('预算上限', 'Budget limit') : pick('词元上限', 'Token limit')}
                    value={providerForm.value}
                    onChange={(value) => setProviderForm((current) => ({ ...current, value }))}
                    type="number"
                    placeholder={providerForm.mode === 'amount' ? pick('例如：100', 'For example: 100') : pick('例如：1000000', 'For example: 1000000')}
                    helper={providerForm.mode === 'amount' ? pick('金额预算按累计成本统计。', 'Amount budgets are tracked by cumulative cost.') : pick('词元上限按累计词元量统计。', 'Token limits are tracked by cumulative token usage.')}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton onClick={() => void saveProvider()} loading={busy === `provider-save:${providerForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingProviderId ? pick('保存变更', 'Save changes') : pick('新增供应商', 'Create provider')}
              </PrimaryButton>
              <SecondaryButton onClick={cancelEdit}>
                {editingProviderId ? pick('取消', 'Cancel') : pick('清空', 'Reset')}
              </SecondaryButton>
              {editingProviderId ? (
                <DangerButton onClick={() => void deleteProvider(editingProviderId)} className="ml-auto">
                  <Trash2 size={16} className="mr-1" />
                  {pick('删除供应商', 'Delete provider')}
                </DangerButton>
              ) : null}
            </div>
          </div>
        </SettingsSection>
      ) : null}
    </SettingsViewShell>
  );
};

export default ApiSettingsView;
