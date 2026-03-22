import React, { useEffect, useMemo, useState } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import type { Provider } from '../../types';
import type { ApiProtocolFormat } from '../../services/api/apiConfig';
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

const BUDGET_OPTIONS = ['不限额', '金额预算', '令牌上限'] as const;

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

const formatTokens = (value: number) => `${compactNumber(value)} 令牌`;

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
  if (mode === 'tokens') return '令牌上限';
  return '不限额';
};

const getModeOption = (mode: CostMode) => {
  if (mode === 'amount') return '金额预算';
  if (mode === 'tokens') return '令牌上限';
  return '不限额';
};

const parseModeOption = (value: string): CostMode => {
  if (value === '金额预算') return 'amount';
  if (value === '令牌上限') return 'tokens';
  return 'unlimited';
};

const getProtocolLabel = (format: ApiProtocolFormat) => {
  if (format === 'openai') return 'OpenAI 协议';
  if (format === 'gemini') return 'Gemini 协议';
  if (format === 'claude') return 'Claude 协议';
  return '自动识别';
};

const getOfficialProviderLabel = (provider: OfficialProvider) =>
  provider === 'Google' ? 'Google Gemini 官方接口' : 'OpenAI 官方接口';

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
    items.push(`令牌 ${formatTokens(summary.lastTokens)}`);
  }
  if (typeof summary.lastAmount === 'number' && summary.lastAmount >= 0) {
    items.push(formatUsd(summary.lastAmount));
  }
  return items.join(' · ');
};

const toOfficialForm = (slot: KeySlot): OfficialForm => ({
  id: slot.id,
  name: slot.name,
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

const EndpointSurface: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-[26px] border p-5" style={SETTINGS_ELEVATED_STYLE}>
    {children}
  </div>
);

const ApiSettingsView: React.FC<{ initialSupplier?: Supplier | null }> = ({ initialSupplier = null }) => {
  const navigate = useNavigate();
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

  const latencyCards = useMemo(() => {
    const officialItems = officialSlots
      .map((slot) => ({
        id: slot.id,
        label: slot.name || getOfficialProviderLabel(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google'),
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
  }, [officialSlots, thirdPartyProviders]);

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

      if (isCreatingOfficial) {
        setEditingOfficialId(null);
        setOfficialForm(officialDefaults);
        return;
      }

      if (selectedOfficialSlot) {
        setEditingOfficialId(selectedOfficialSlot.id);
        setOfficialForm(toOfficialForm(selectedOfficialSlot));
      }
      return;
    }

    if (isProviderEditorRoute) {
      setActiveTab('third-party');
      setEditorMode('third-party');

      if (isCreatingProvider) {
        setEditingProviderId(null);
        setProviderForm(initialSupplier ? toProviderFormFromSupplier(initialSupplier) : providerDefaults);
        return;
      }

      if (selectedProvider) {
        setEditingProviderId(selectedProvider.id);
        setProviderForm(toProviderForm(selectedProvider));
        return;
      }

      if (initialSupplier) {
        setEditingProviderId(null);
        setProviderForm(toProviderFormFromSupplier(initialSupplier));
      }
      return;
    }

    setEditorMode(null);
    setEditingOfficialId(null);
    setEditingProviderId(null);
  }, [
    initialSupplier,
    isCreatingOfficial,
    isCreatingProvider,
    isOfficialEditorRoute,
    isProviderEditorRoute,
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
    navigate(buildOfficialEditorPath());
  };

  const beginCreateProvider = () => {
    navigate(buildProviderEditorPath());
  };

  const startEditOfficial = (slot: KeySlot) => {
    navigate(buildOfficialEditorPath(slot.id));
  };

  const startEditProvider = (provider: ThirdPartyProvider) => {
    navigate(buildProviderEditorPath(provider.id));
  };

  const cancelEdit = () => {
    navigate(API_MANAGEMENT_HOME_PATH);
    setOfficialForm(officialDefaults);
    setProviderForm(providerDefaults);
  };

  const saveOfficial = async () => {
    const value = officialForm.mode === 'unlimited' ? null : positive(officialForm.value);
    if (!officialForm.key.trim()) {
      notify.error('保存失败', '请填写有效的 API Key。');
      return;
    }
    if (officialForm.mode !== 'unlimited' && !value) {
      notify.error('保存失败', '预算或令牌上限必须大于 0。');
      return;
    }

    const payload = {
      budgetLimit: officialForm.mode === 'amount' ? value ?? -1 : -1,
      tokenLimit: officialForm.mode === 'tokens' ? value ?? -1 : -1,
    };

    await run(`official-save:${officialForm.id || 'new'}`, async () => {
      if (officialForm.id) {
        await keyManager.updateKey(officialForm.id, {
          name: officialForm.name.trim() || `${officialForm.provider} 官方接口`,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: '',
          key: officialForm.key.trim(),
          ...payload,
        });
        notify.success('保存成功', '官方接口配置已更新。');
      } else {
        const result = await keyManager.addKey(officialForm.key.trim(), {
          name: officialForm.name.trim() || `${officialForm.provider} 官方接口`,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: '',
          ...payload,
        });
        if (!result.success) {
          notify.error('新增失败', result.error || '无法创建官方接口。');
          return;
        }
        notify.success('新增成功', '官方接口已加入当前链路。');
      }
      cancelEdit();
    });
  };

  const saveProvider = async () => {
    const value = providerForm.mode === 'unlimited' ? null : positive(providerForm.value);
    if (!providerForm.name.trim() || !providerForm.baseUrl.trim() || !providerForm.apiKey.trim()) {
      notify.error('保存失败', '请完整填写供应商名称、基础地址和 API Key。');
      return;
    }
    if (providerForm.mode !== 'unlimited' && !value) {
      notify.error('保存失败', '预算或令牌上限必须大于 0。');
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
        notify.success('保存成功', '供应商配置已更新。');
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
        notify.success('新增成功', '供应商已加入当前调度池。');
      }
      cancelEdit();
    });
  };

  const deleteOfficial = async (id: string) => {
    await run(`official-delete:${id}`, async () => {
      keyManager.removeKey(id);
      notify.success('删除成功', '官方接口已移除。');
      if (editingOfficialId === id) cancelEdit();
    });
  };

  const deleteProvider = async (id: string) => {
    await run(`provider-delete:${id}`, async () => {
      keyManager.removeProvider(id);
      notify.success('删除成功', '供应商配置已移除。');
      if (editingProviderId === id) cancelEdit();
    });
  };

  const toggleOfficial = async (slot: KeySlot) => {
    const nextDisabled = !slot.disabled;
    await run(`official-toggle:${slot.id}`, async () => {
      await keyManager.updateKey(slot.id, { disabled: nextDisabled });
      notify.success(nextDisabled ? '已暂停' : '已启用', `${slot.name} 的调度状态已更新。`);
    });
  };

  const toggleProvider = async (provider: ThirdPartyProvider) => {
    const nextActive = !provider.isActive;
    await run(`provider-toggle:${provider.id}`, async () => {
      keyManager.updateProvider(provider.id, { isActive: nextActive });
      notify.success(nextActive ? '已启用' : '已暂停', `${provider.name} 的调度状态已更新。`);
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
      if (check.success) notify.success('刷新成功', `${slot.name} 已完成连通检测。`);
      else notify.warning('检测失败', check.message || '请检查密钥和网络连通性。');
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
      if (check.success) notify.success('刷新成功', `${provider.name} 已完成连通检测。`);
      else notify.warning('检测失败', check.message || '请检查基础地址和密钥。');
    });
  };

  const syncPricing = async (provider: ThirdPartyProvider) => {
    await run(`provider-price:${provider.id}`, async () => {
      const result = await keyManager.syncProviderPricingDetailed(provider.id);
      if (result.ok) notify.success('同步成功', result.message || '价格信息已更新。');
      else notify.warning('同步失败', result.message || '当前没有可用的价格数据返回。');
    });
  };

  if (officialRouteMissing) {
    return (
      <SettingsViewShell>
        <SettingsHero
          eyebrow="接口编辑"
          title="找不到接口"
          description="当前要编辑的官方接口已经不存在了，先回到列表重新选择。"
          icon={Shield}
          tone="amber"
          actions={<SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>返回接口列表</SettingsActionButton>}
        />

        <SettingsSection title="接口不存在" eyebrow="无法继续编辑">
          <EmptyState
            title="这条官方接口可能已经被删除"
            description="返回 API 管理列表后重新选择要编辑的接口。"
            action={<SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>返回接口列表</SettingsActionButton>}
          />
        </SettingsSection>
      </SettingsViewShell>
    );
  }

  if (providerRouteMissing) {
    return (
      <SettingsViewShell>
        <SettingsHero
          eyebrow="供应商编辑"
          title="找不到供应商"
          description="当前要编辑的供应商已经不存在了，先回到列表重新选择。"
          icon={Globe}
          tone="amber"
          actions={<SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>返回供应商列表</SettingsActionButton>}
        />

        <SettingsSection title="供应商不存在" eyebrow="无法继续编辑">
          <EmptyState
            title="目标供应商不存在或已被移除"
            description="返回 API 管理列表后重新选择要编辑的供应商。"
            action={<SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>返回供应商列表</SettingsActionButton>}
          />
        </SettingsSection>
      </SettingsViewShell>
    );
  }

  return (
    <SettingsViewShell>
      {editorMode === 'official' ? (
        <SettingsHero
          eyebrow="接口编辑"
          title={editingOfficialId ? officialForm.name.trim() || `${officialForm.provider} 官方接口` : '新增官方接口'}
          description={editingOfficialId ? '当前页面只修改这一条官方接口，保存后返回列表。' : '在独立页面创建官方接口，避免和列表卡片混在一起。'}
          icon={Shield}
          tone={selectedOfficialSlot ? getOfficialStatus(selectedOfficialSlot).badge : 'indigo'}
          badge={<SettingsBadge tone={editingOfficialId ? 'indigo' : 'emerald'}>{editingOfficialId ? '编辑模式' : '新增模式'}</SettingsBadge>}
          actions={
            <>
              <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>返回接口列表</SettingsActionButton>
              {selectedOfficialSlot ? (
                <SettingsActionButton
                  icon={RefreshCw}
                  loading={busy === `official-check:${selectedOfficialSlot.id}`}
                  onClick={() => void refreshOfficial(selectedOfficialSlot)}
                >
                  刷新连通性
                </SettingsActionButton>
              ) : null}
            </>
          }
          metrics={
            <>
              <SettingsMetricCard
                label="当前接口"
                value={officialForm.name.trim() || `${officialForm.provider} 官方接口`}
                helper={editingOfficialId ? '你现在编辑的是这一条接口' : '保存后会加入官方接口列表'}
                icon={Key}
                tone="indigo"
              />
              <SettingsMetricCard
                label="服务商"
                value={officialForm.provider === 'Google' ? 'Google Gemini' : 'OpenAI'}
                helper={getOfficialProviderLabel(officialForm.provider)}
                icon={Shield}
                tone="indigo"
              />
              <SettingsMetricCard
                label="预算策略"
                value={getModeLabel(officialForm.mode)}
                helper={getLimitValueLabel(officialForm.mode, positive(officialForm.value) ?? undefined)}
                icon={Layers3}
                tone={officialForm.mode === 'unlimited' ? 'neutral' : 'amber'}
              />
              <SettingsMetricCard
                label="最近检测"
                value={selectedOfficialSlot ? formatLatency(selectedOfficialSlot.lastResponseTime ?? selectedOfficialSlot.avgResponseTime ?? null) : '待保存'}
                helper={selectedOfficialSlot ? formatDateTime(selectedOfficialSlot.lastUsed || selectedOfficialSlot.updatedAt || selectedOfficialSlot.createdAt) : '新增后可进行连通检测'}
                icon={Clock3}
                tone={selectedOfficialSlot ? getOfficialStatus(selectedOfficialSlot).badge : 'neutral'}
              />
            </>
          }
        />
      ) : null}

      {editorMode === 'third-party' ? (
        <SettingsHero
          eyebrow="供应商编辑"
          title={editingProviderId ? providerForm.name.trim() || '未命名供应商' : '新增供应商'}
          description={editingProviderId ? '当前页面只修改这一家供应商，保存后返回列表。' : '在独立页面创建供应商，编辑时不会再和卡片列表混在一起。'}
          icon={Globe}
          tone={selectedProvider ? getProviderStatus(selectedProvider).badge : providerForm.isActive ? 'emerald' : 'neutral'}
          badge={<SettingsBadge tone={editingProviderId ? 'indigo' : 'emerald'}>{editingProviderId ? '编辑模式' : '新增模式'}</SettingsBadge>}
          actions={
            <>
              <SettingsActionButton icon={ArrowLeft} onClick={cancelEdit}>返回供应商列表</SettingsActionButton>
              {selectedProvider ? (
                <>
                  <SettingsActionButton
                    icon={RefreshCw}
                    loading={busy === `provider-check:${selectedProvider.id}`}
                    onClick={() => void refreshProvider(selectedProvider)}
                  >
                    刷新连通性
                  </SettingsActionButton>
                  <SettingsActionButton
                    icon={Wand2}
                    loading={busy === `provider-price:${selectedProvider.id}`}
                    onClick={() => void syncPricing(selectedProvider)}
                  >
                    自动获取价格
                  </SettingsActionButton>
                </>
              ) : null}
            </>
          }
          metrics={
            <>
              <SettingsMetricCard
                label="当前供应商"
                value={providerForm.name.trim() || '未命名供应商'}
                helper={editingProviderId ? '你现在编辑的是这一家供应商' : '保存后会加入供应商列表'}
                icon={Globe}
                tone="indigo"
              />
              <SettingsMetricCard
                label="基础地址"
                value={extractDomain(providerForm.baseUrl)}
                helper="连通检测、模型拉取和价格同步都会使用这里"
                icon={Key}
                tone="neutral"
              />
              <SettingsMetricCard
                label="通信协议"
                value={getProtocolLabel(providerForm.format)}
                helper="决定请求结构、模型识别和价格同步方式"
                icon={Layers3}
                tone="indigo"
              />
              <SettingsMetricCard
                label="调度状态"
                value={providerForm.isActive ? '参与调度' : '暂停调度'}
                helper={selectedProvider ? formatDateTime(selectedProvider.lastChecked || selectedProvider.updatedAt) : '保存后可继续做检测和价格同步'}
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
        eyebrow="高级设置"
        title="API 管理"
        description="统一管理官方接口、第三方供应商、通信协议和预算策略。这里所有按钮都只表达一个真实动作，不再混用保存、刷新和同步语义。"
        icon={Key}
        tone={attentionCount > 0 ? 'amber' : connectedChannels > 0 ? 'emerald' : 'neutral'}
        badge={
          <SettingsBadge tone={attentionCount > 0 ? 'amber' : connectedChannels > 0 ? 'emerald' : 'neutral'}>
            {connectedChannels > 0 ? `已接入 ${connectedChannels} 条链路` : '尚未接入链路'}
          </SettingsBadge>
        }
        actions={
          <>
            <SettingsActionButton icon={RefreshCw} onClick={refresh}>刷新数据</SettingsActionButton>
            <SettingsActionButton icon={Plus} tone="primary" onClick={activeTab === 'official' ? beginCreateOfficial : beginCreateProvider}>
              {activeTab === 'official' ? '新增官方接口' : '新增供应商'}
            </SettingsActionButton>
          </>
        }
        metrics={
          <>
            <SettingsMetricCard
              label="官方接口"
              value={`${officialSlots.length}`}
              helper={`${officialSlots.filter((slot) => !slot.disabled).length} 条当前可参与调度`}
              icon={Shield}
              tone={officialSlots.length > 0 ? 'indigo' : 'neutral'}
            />
            <SettingsMetricCard
              label="在线供应商"
              value={`${activeProviders}/${thirdPartyProviders.length}`}
              helper={thirdPartyProviders.length > 0 ? `${thirdPartyProviders.filter((provider) => provider.status === 'error').length} 个存在异常` : '尚未配置第三方供应商'}
              icon={Globe}
              tone={activeProviders > 0 ? 'emerald' : 'neutral'}
            />
            <SettingsMetricCard
              label="预算策略"
              value={`${budgetCount}`}
              helper="已设置预算或令牌上限的链路数量"
              icon={Layers3}
              tone={budgetCount > 0 ? 'amber' : 'neutral'}
            />
            <SettingsMetricCard
              label="待处理项"
              value={`${attentionCount}`}
              helper={attentionCount > 0 ? '建议优先排查异常与暂停链路' : '当前没有待优先处理的问题'}
              icon={Activity}
              tone={attentionCount > 0 ? 'rose' : 'emerald'}
            />
          </>
        }
      />

      <SettingsSection
        title="运行视图"
        eyebrow="链路面板"
        description="先决定你当前要看的是官方接口还是第三方供应商，再进入对应的卡片和编辑器。"
        action={<SettingsBadge tone={activeTab === 'official' ? 'indigo' : 'emerald'}>{activeTab === 'official' ? '官方接口视图' : '第三方供应商视图'}</SettingsBadge>}
      >
        <div className="space-y-4">
          <SegmentedControl
            options={[
              { value: 'official', label: '官方接口' },
              { value: 'third-party', label: '第三方供应商' },
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
              <div className="text-[15px] font-semibold text-[var(--text-primary)]">全局延迟概览</div>
              <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                暂无最近一次的延迟检测结果。你可以点击任意卡片上的“刷新”来重新检测连通状态、模型列表和延迟。
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {activeTab === 'official' ? (
        <SettingsSection
          title="官方接口"
          eyebrow="官方渠道"
          description="适合直连 OpenAI 和 Gemini 官方接口，用于承担稳定、核心的生产流量。"
          action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateOfficial}>新增官方接口</SettingsActionButton>}
        >
          {officialSlots.length === 0 ? (
            <EmptyState
              title="当前还没有官方接口"
              description="先添加 OpenAI 或 Gemini 官方接口，再让它们进入调度。"
              action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateOfficial}>新增官方接口</SettingsActionButton>}
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {officialSlots.map((slot) => {
                const mode = getMode(slot.budgetLimit, slot.tokenLimit);
                const status = getOfficialStatus(slot);
                const progress = getProgress(mode, mode === 'amount' ? slot.totalCost : slot.usedTokens || 0, slot.budgetLimit, slot.tokenLimit);

                return (
                  <EndpointSurface key={slot.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[var(--text-primary)]" style={SETTINGS_OVERLAY_STYLE}>
                          <Shield size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-[18px] font-semibold text-[var(--text-primary)]">
                              {slot.name || getOfficialProviderLabel(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google')}
                            </div>
                            <SettingsBadge tone={status.badge}>{status.label}</SettingsBadge>
                          </div>
                          <div className="mt-1 text-[13px] text-[var(--text-secondary)]">
                            {slot.provider === 'OpenAI' ? 'OpenAI 官方接口' : 'Google Gemini 官方接口'}
                          </div>
                          <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">Key 预览：{maskSecret(slot.key)}</div>
                        </div>
                      </div>
                      <StatusBadge status={status.status} label={status.label} />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoCell label="预算策略" value={getModeLabel(mode)} helper={getLimitValueLabel(mode, mode === 'amount' ? slot.budgetLimit : slot.tokenLimit)} />
                      <InfoCell label="累计消耗" value={mode === 'tokens' ? formatTokens(slot.usedTokens || 0) : formatUsd(slot.totalCost)} helper={getOfficialUsageSummary(slot)} />
                      <InfoCell label="支持模型" value={`${slot.supportedModels.length}`} helper={slot.supportedModels.length > 0 ? '已自动识别模型列表' : '点击刷新后自动拉取'} />
                      <InfoCell label="最近延迟" value={formatLatency(slot.lastResponseTime ?? slot.avgResponseTime ?? null)} helper={formatDateTime(slot.lastUsed || slot.updatedAt || slot.createdAt)} />
                    </div>

                    {mode !== 'unlimited' ? (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
                          <span>{getOfficialUsageSummary(slot)}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <ProgressBar progress={progress} tone={progress >= 90 ? 'rose' : progress >= 70 ? 'amber' : 'indigo'} showLabel={false} />
                      </div>
                    ) : null}

                    {slot.lastError ? (
                      <div className="mt-4 rounded-[18px] border px-4 py-3 text-[13px] leading-6" style={{ borderColor: 'var(--state-danger-border)', backgroundColor: 'var(--state-danger-bg)', color: 'var(--state-danger-text)' }}>
                        {slot.lastError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <SettingsActionButton icon={Edit3} size="sm" onClick={() => startEditOfficial(slot)}>编辑</SettingsActionButton>
                      <SettingsActionButton icon={RefreshCw} size="sm" loading={busy === `official-check:${slot.id}`} onClick={() => void refreshOfficial(slot)}>刷新</SettingsActionButton>
                      <SettingsActionButton icon={slot.disabled ? Play : Pause} size="sm" onClick={() => void toggleOfficial(slot)}>
                        {slot.disabled ? '启用' : '暂停'}
                      </SettingsActionButton>
                    </div>
                  </EndpointSurface>
                );
              })}
            </div>
          )}
        </SettingsSection>
      ) : (
        <SettingsSection
          title="第三方供应商"
          eyebrow="第三方渠道"
          description="这里重点处理供应商列表、通信协议和自动价格同步，适合做扩容和多源调度。"
          action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateProvider}>新增供应商</SettingsActionButton>}
        >
          {thirdPartyProviders.length === 0 ? (
            <EmptyState
              title="当前还没有第三方供应商"
              description="先添加一个供应商，再配置协议、预算和自动价格同步。"
              action={<SettingsActionButton icon={Plus} tone="primary" onClick={beginCreateProvider}>新增供应商</SettingsActionButton>}
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {thirdPartyProviders.map((provider) => {
                const mode = getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited');
                const status = getProviderStatus(provider);
                const progress = getProgress(mode, mode === 'amount' ? provider.usage.totalCost : provider.usage.totalTokens, provider.budgetLimit, provider.tokenLimit);

                return (
                  <EndpointSurface key={provider.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[14px] font-semibold" style={{ ...SETTINGS_OVERLAY_STYLE, color: provider.providerColor || '#60A5FA' }}>
                          {provider.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-[18px] font-semibold text-[var(--text-primary)]">{provider.name}</div>
                            <SettingsBadge tone={status.badge}>{status.label}</SettingsBadge>
                            {provider.group ? <SettingsBadge tone="neutral">{provider.group}</SettingsBadge> : null}
                          </div>
                          <div className="mt-1 truncate text-[13px] text-[var(--text-secondary)]">{extractDomain(provider.baseUrl)}</div>
                          <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">{getProviderActivityLine(provider)}</div>
                        </div>
                      </div>
                      <StatusBadge status={status.status} label={status.label} />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoCell label="通信协议" value={getProtocolLabel(provider.format)} helper="决定模型拉取和请求结构" />
                      <InfoCell label="预算策略" value={getModeLabel(mode)} helper={getLimitValueLabel(mode, mode === 'amount' ? provider.budgetLimit : provider.tokenLimit)} />
                      <InfoCell label="已识别模型" value={`${provider.models.length}`} helper={provider.models.length > 0 ? '刷新后可同步模型列表' : '等待连通检测'} />
                      <InfoCell label="最近检测" value={formatLatency(provider.activitySummary?.lastLatencyMs ?? null)} helper={formatDateTime(provider.lastChecked || provider.updatedAt)} />
                    </div>

                    <div className="mt-4 text-[13px] text-[var(--text-secondary)]">{getProviderUsageSummary(provider)}</div>

                    {mode !== 'unlimited' ? (
                      <div className="mt-3">
                        <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
                          <span>{getProviderUsageSummary(provider)}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <ProgressBar progress={progress} tone={progress >= 90 ? 'rose' : progress >= 70 ? 'amber' : 'indigo'} showLabel={false} />
                      </div>
                    ) : null}

                    {provider.lastError ? (
                      <div className="mt-4 rounded-[18px] border px-4 py-3 text-[13px] leading-6" style={{ borderColor: 'var(--state-danger-border)', backgroundColor: 'var(--state-danger-bg)', color: 'var(--state-danger-text)' }}>
                        {provider.lastError}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <SettingsActionButton icon={Edit3} size="sm" onClick={() => startEditProvider(provider)}>编辑</SettingsActionButton>
                      <SettingsActionButton icon={RefreshCw} size="sm" loading={busy === `provider-check:${provider.id}`} onClick={() => void refreshProvider(provider)}>刷新</SettingsActionButton>
                      <SettingsActionButton icon={Wand2} size="sm" loading={busy === `provider-price:${provider.id}`} onClick={() => void syncPricing(provider)}>自动获取价格</SettingsActionButton>
                      <SettingsActionButton icon={provider.isActive ? Pause : Play} size="sm" onClick={() => void toggleProvider(provider)}>
                        {provider.isActive ? '暂停' : '启用'}
                      </SettingsActionButton>
                    </div>
                  </EndpointSurface>
                );
              })}
            </div>
          )}
        </SettingsSection>
      )}
        </>
      ) : null}

      {editorMode === 'official' ? (
        <SettingsSection
          title="官方接口编辑器"
          eyebrow={editingOfficialId ? '编辑官方接口' : '新增官方接口'}
          description="保存只负责提交当前表单；刷新和启用状态请在上面的接口卡片里单独操作。"
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCell label="当前对象" value={officialForm.name.trim() || `${officialForm.provider} 官方接口`} helper={editingOfficialId ? '正在编辑已有接口' : '准备新增一条官方链路'} />
              <InfoCell label="服务商" value={officialForm.provider === 'Google' ? 'Google Gemini' : 'OpenAI'} helper={getOfficialProviderLabel(officialForm.provider)} />
              <InfoCell label="预算策略" value={getModeLabel(officialForm.mode)} helper={officialForm.mode === 'unlimited' ? '当前不限制累计消耗' : officialForm.mode === 'amount' ? '按累计金额控制预算' : '按累计令牌量控制预算'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label="接口名称"
                value={officialForm.name}
                onChange={(value) => setOfficialForm((current) => ({ ...current, name: value }))}
                placeholder="例如：OpenAI 主账号"
                helper="建议使用对你有识别度的名称，便于后续调度。"
              />
              <SettingSelect
                label="服务商"
                value={officialForm.provider}
                options={[
                  { value: 'Google', label: 'Google Gemini' },
                  { value: 'OpenAI', label: 'OpenAI' },
                ]}
                onChange={(value) => setOfficialForm((current) => ({ ...current, provider: value as OfficialProvider }))}
              />
            </div>

            <SettingInput
              label="API Key"
              value={officialForm.key}
              onChange={(value) => setOfficialForm((current) => ({ ...current, key: value }))}
              placeholder="输入官方接口的 API Key"
              type="password"
              helper="这里只保存当前接口使用的密钥，不会和刷新动作混用。"
            />

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">预算策略</div>
              <SegmentedControlMulti options={[...BUDGET_OPTIONS]} value={getModeOption(officialForm.mode)} onChange={(value) => setOfficialForm((current) => ({ ...current, mode: parseModeOption(value) }))} />
              {officialForm.mode !== 'unlimited' ? (
                <div className="mt-3">
                  <SettingInput
                    label={officialForm.mode === 'amount' ? '预算上限' : '令牌上限'}
                    value={officialForm.value}
                    onChange={(value) => setOfficialForm((current) => ({ ...current, value }))}
                    type="number"
                    placeholder={officialForm.mode === 'amount' ? '例如：100' : '例如：1000000'}
                    helper={officialForm.mode === 'amount' ? '金额预算按累计成本统计。' : '令牌上限按累计令牌量统计。'}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton onClick={() => void saveOfficial()} loading={busy === `official-save:${officialForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingOfficialId ? '保存变更' : '新增官方接口'}
              </PrimaryButton>
              <SecondaryButton onClick={cancelEdit}>取消</SecondaryButton>
              {editingOfficialId ? (
                <DangerButton onClick={() => void deleteOfficial(editingOfficialId)} className="ml-auto">
                  <Trash2 size={16} className="mr-1" />
                  删除接口
                </DangerButton>
              ) : null}
            </div>
          </div>
        </SettingsSection>
      ) : null}

      {editorMode === 'third-party' ? (
        <SettingsSection
          title="供应商编辑器"
          eyebrow={editingProviderId ? '编辑供应商' : '新增供应商'}
          description="“自动获取价格”只负责同步价格数据，不负责保存当前表单；保存按钮才会提交供应商配置。"
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCell label="当前对象" value={providerForm.name.trim() || '未命名供应商'} helper={editingProviderId ? '正在编辑已有供应商' : '准备新增一个供应商'} />
              <InfoCell label="通信协议" value={getProtocolLabel(providerForm.format)} helper="决定请求结构、模型识别和价格拉取方式" />
              <InfoCell label="调度状态" value={providerForm.isActive ? '参与调度' : '暂停调度'} helper={providerForm.mode === 'unlimited' ? '当前不限制预算' : getModeLabel(providerForm.mode)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label="供应商名称"
                value={providerForm.name}
                onChange={(value) => setProviderForm((current) => ({ ...current, name: value }))}
                placeholder="例如：SiliconFlow"
                helper="建议写成你在团队里常用的供应商名称。"
              />
              <SettingInput
                label="主题颜色"
                value={providerForm.color}
                onChange={(value) => setProviderForm((current) => ({ ...current, color: value }))}
                placeholder="#60A5FA"
                helper="用于列表卡片的识别色，不影响真实请求。"
              />
            </div>

            <SettingInput
              label="基础地址"
              value={providerForm.baseUrl}
              onChange={(value) => setProviderForm((current) => ({ ...current, baseUrl: value }))}
              placeholder="https://api.example.com/v1"
              helper="通信检测、模型拉取和价格同步都会基于这里的地址。"
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label="API Key"
                value={providerForm.apiKey}
                onChange={(value) => setProviderForm((current) => ({ ...current, apiKey: value }))}
                placeholder="输入供应商 API Key"
                type="password"
              />
              <SettingSelect
                label="通信协议"
                value={providerForm.format}
                options={[
                  { value: 'auto', label: '自动识别' },
                  { value: 'openai', label: 'OpenAI 协议' },
                  { value: 'gemini', label: 'Gemini 协议' },
                  { value: 'claude', label: 'Claude 协议' },
                ]}
                onChange={(value) => setProviderForm((current) => ({ ...current, format: value as ApiProtocolFormat }))}
                helper="默认推荐自动识别，必要时再手动固定协议。"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label="分组"
                value={providerForm.group}
                onChange={(value) => setProviderForm((current) => ({ ...current, group: value }))}
                placeholder="例如：国内通道"
                helper="用于组织和筛选供应商，不影响请求协议。"
              />
              <div className="rounded-[22px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
                <SettingToggle
                  label="参与调度"
                  helper="关闭后，供应商会保留配置，但不会再参与自动调度。"
                  checked={providerForm.isActive}
                  onChange={(checked) => setProviderForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>

            <div className="rounded-[24px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">自动获取价格</div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    这个动作只会尝试从供应商价格端点同步价格数据，不会保存表单。如果当前供应商还没落库，请先点击“保存变更”或“新增供应商”。
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
                    自动获取价格
                  </SettingsActionButton>
                ) : (
                  <SettingsBadge tone="neutral">需先保存后可同步</SettingsBadge>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">预算策略</div>
              <SegmentedControlMulti options={[...BUDGET_OPTIONS]} value={getModeOption(providerForm.mode)} onChange={(value) => setProviderForm((current) => ({ ...current, mode: parseModeOption(value) }))} />
              {providerForm.mode !== 'unlimited' ? (
                <div className="mt-3">
                  <SettingInput
                    label={providerForm.mode === 'amount' ? '预算上限' : '令牌上限'}
                    value={providerForm.value}
                    onChange={(value) => setProviderForm((current) => ({ ...current, value }))}
                    type="number"
                    placeholder={providerForm.mode === 'amount' ? '例如：100' : '例如：1000000'}
                    helper={providerForm.mode === 'amount' ? '金额预算按累计成本统计。' : '令牌上限按累计令牌量统计。'}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton onClick={() => void saveProvider()} loading={busy === `provider-save:${providerForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingProviderId ? '保存变更' : '新增供应商'}
              </PrimaryButton>
              <SecondaryButton onClick={cancelEdit}>取消</SecondaryButton>
              {editingProviderId ? (
                <DangerButton onClick={() => void deleteProvider(editingProviderId)} className="ml-auto">
                  <Trash2 size={16} className="mr-1" />
                  删除供应商
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
