import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { MemoryRouter, useInRouterContext, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Provider } from '../../types';
import type { ApiProtocolFormat } from '../../services/api/apiConfig';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import {
  getKkApiServerHealth,
  isKkApiUserDataPersistedInCloudFromHealth,
  type KkApiServerHealth,
} from '../../services/api/kkApiServerHealth';
import { isKkaiUserApiStorageReady } from '../../services/api/kkaiUserApiStorageMode';
import {
  loadUserApisPayloadMetadataFromCloudRecord,
  removeUserApiProviderFromCloudRecord,
  removeUserApiSlotFromCloudRecord,
  upsertUserApiProviderToCloudRecord,
  upsertUserApiSlotToCloudRecord,
} from '../../services/api/userApiCloudRecordStorage';
import {
  extractKeyManagerCloudSlots,
  extractUserApiProvidersFromPayload,
} from '../../services/api/userApiPayload';
import { resolveUserApiViewState } from '../../services/api/userApiViewState';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import keyManager, {
  type KeySlot,
  type ThirdPartyProvider,
  resolveEffectiveProviderModels,
} from '../../services/auth/keyManager';
import { buildProviderPricingSnapshot, mergeProviderPricingSnapshot } from '../../services/auth/providerPricingSnapshot';
import type { Supplier } from '../../services/billing/supplierService';
import { notify } from '../../services/system/notificationService';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_INFO_STYLE,
  SETTINGS_OVERLAY_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SETTINGS_WARNING_STYLE,
  SettingsViewShell,
} from './SettingsScaffold';
import {
  DangerButton,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  SegmentedControlMulti,
  SettingInput,
  SettingSelect,
  SettingToggle,
} from './ui/index';
import {
  buildApiManagementListState,
  readApiManagementListState,
  type ApiManagementTab,
} from './apiManagementRouteState';
import { ConsoleEndpointCard, type ConsoleEndpointCardMetric } from './apiWorkbenchCards';
import {
  ApiWorkbenchCurrentViewSection,
  ApiWorkbenchDiagnosticsSection,
  ApiWorkbenchOverviewSection,
  ApiWorkbenchPlatformSection,
  ApiWorkbenchStageSection,
  InfoCell,
} from './apiWorkbenchSections';
import {
  resolveApiWorkbenchDiagnosticsAvailability,
  resolveApiWorkbenchStageMeta,
} from './apiWorkbenchState';
type CostMode = 'unlimited' | 'amount' | 'tokens';
type OfficialProvider = 'Google' | 'OpenAI';
type TabType = ApiManagementTab;
const UI_TOKEN_UNIT_LABEL = '词元';
const UI_TOKEN_LIMIT_LABEL = '词元上限';
const UI_LEGACY_TOKEN_LIMIT_LABEL = '令牌上限';
const UI_BUDGET_OPTIONS = ['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL] as const;
const suspiciousLocaleCharSet = new Set('鍙闂妫璇淇鏂褰缂閹鏆閲棰渚涘簲鍐娴瀹閫绗鐢浣');

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

const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const USER_API_VIEW_SNAPSHOT_PREFIX = 'kk_user_api_view_snapshot:';
const USER_API_VIEW_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const API_MANAGEMENT_HOME_PATH = '/settings/api-management';
const API_MANAGEMENT_OFFICIAL_PREFIX = '/settings/api-management/official/';
const API_MANAGEMENT_PROVIDER_PREFIX = '/settings/api-management/provider/';
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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProviderConnectionValue(value: unknown): string {
  return normalizeString(value).replace(/\/+$/, '').toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return fallback;
}

function containsLikelyMojibake(text: string): boolean {
  let suspiciousCount = 0;

  for (const char of text) {
    if (suspiciousLocaleCharSet.has(char)) {
      suspiciousCount += 1;
      if (suspiciousCount >= 2) {
        return true;
      }
    }
  }

  return false;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

const isReadonlySecretPlaceholder = (value?: string | null) => String(value || '').trim() === READONLY_SECRET_PLACEHOLDER;

function hasStoredSecret(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return isRecord(value) && value.__kkUserApiSecret === true;
}

function normalizeProtocolFormat(value: unknown, fallback: ApiProtocolFormat = 'auto'): ApiProtocolFormat {
  return value === 'auto' || value === 'openai' || value === 'gemini' || value === 'claude'
    ? value
    : fallback;
}

function normalizeOfficialProvider(value: unknown): Provider {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'openai') return 'OpenAI' as Provider;
  if (normalized === 'google' || normalized === 'gemini') return 'Google' as Provider;
  return (normalizeString(value) || 'Google') as Provider;
}

function normalizeOptionalTimestamp(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  return normalizeTimestamp(value, Date.now());
}

function toReadonlyOfficialSlot(rawValue: unknown): KeySlot | null {
  const raw = isRecord(rawValue) ? rawValue : null;
  if (!raw) return null;

  const id = normalizeString(raw.id);
  if (!id) return null;

  const now = Date.now();
  const createdAt = normalizeTimestamp(raw.createdAt ?? raw.created_at, now);
  const provider = normalizeOfficialProvider(raw.provider);
  const defaultBaseUrl =
    provider === 'Google'
      ? DEFAULT_GOOGLE_BASE_URL
      : provider === 'OpenAI'
        ? DEFAULT_OPENAI_BASE_URL
        : undefined;
  const baseUrl = normalizeString(raw.baseUrl ?? raw.base_url) || defaultBaseUrl;

  return {
    id,
    key: hasStoredSecret(raw.key) ? READONLY_SECRET_PLACEHOLDER : '',
    name: normalizeString(raw.name) || (provider === 'OpenAI' ? 'OpenAI' : 'Google'),
    provider,
    type: provider === 'Google' || provider === 'OpenAI' ? 'official' : (baseUrl ? 'proxy' : 'third-party'),
    format: normalizeProtocolFormat(raw.format, provider === 'Google' ? 'gemini' : 'openai'),
    baseUrl,
    supportedModels: normalizeStringArray(raw.supportedModels ?? raw.supported_models),
    disabled:
      typeof raw.disabled === 'boolean'
        ? raw.disabled
        : typeof raw.is_active === 'boolean'
          ? !raw.is_active
          : false,
    status:
      raw.status === 'valid' || raw.status === 'invalid' || raw.status === 'rate_limited'
        ? raw.status
        : 'unknown',
    failCount: normalizeNumber(raw.failCount ?? raw.fail_count),
    successCount: normalizeNumber(raw.successCount ?? raw.success_count),
    lastUsed: normalizeOptionalTimestamp(raw.lastUsed ?? raw.last_used),
    lastError: normalizeString(raw.lastError ?? raw.last_error) || null,
    createdAt,
    updatedAt: normalizeTimestamp(raw.updatedAt ?? raw.updated_at, createdAt),
    avgResponseTime: normalizeNumber(raw.avgResponseTime ?? raw.avg_response_time, 0) || undefined,
    lastResponseTime: normalizeNumber(raw.lastResponseTime ?? raw.last_response_time, 0) || undefined,
    usedTokens: normalizeNumber(raw.usedTokens ?? raw.used_tokens),
    totalCost: normalizeNumber(raw.totalCost ?? raw.total_cost),
    budgetLimit: Number.isFinite(Number(raw.budgetLimit)) ? Number(raw.budgetLimit) : -1,
    tokenLimit: Number.isFinite(Number(raw.tokenLimit)) ? Number(raw.tokenLimit) : -1,
  };
}

function toReadonlyProvider(rawValue: unknown): ThirdPartyProvider | null {
  const raw = isRecord(rawValue) ? rawValue : null;
  if (!raw) return null;

  const id = normalizeString(raw.id);
  if (!id) return null;

  const now = Date.now();
  const createdAt = normalizeTimestamp(raw.createdAt ?? raw.created_at, now);
  const usageRaw = isRecord(raw.usage) ? raw.usage : {};
  const providerName = normalizeString(raw.name) || 'Provider';
  const providerBaseUrl = normalizeString(raw.baseUrl ?? raw.base_url);
  const providerFormat = normalizeProtocolFormat(raw.format);
  const rawProviderModels = normalizeStringArray(raw.models ?? raw.supportedModels ?? raw.supported_models);

  return {
    id,
    name: providerName,
    baseUrl: providerBaseUrl,
    apiKey: hasStoredSecret(raw.apiKey ?? raw.key) ? READONLY_SECRET_PLACEHOLDER : '',
    models: resolveEffectiveProviderModels({
      provider: providerName,
      baseUrl: providerBaseUrl,
      format: providerFormat,
      models: rawProviderModels,
    }),
    format: providerFormat,
    group: normalizeString(raw.group) || undefined,
    providerColor: normalizeString(raw.providerColor ?? raw.color) || '#60A5FA',
    isActive:
      typeof raw.isActive === 'boolean'
        ? raw.isActive
        : typeof raw.is_active === 'boolean'
          ? raw.is_active
          : true,
    budgetLimit: Number.isFinite(Number(raw.budgetLimit)) ? Number(raw.budgetLimit) : undefined,
    tokenLimit: Number.isFinite(Number(raw.tokenLimit)) ? Number(raw.tokenLimit) : undefined,
    customCostMode:
      raw.customCostMode === 'unlimited' || raw.customCostMode === 'amount' || raw.customCostMode === 'tokens'
        ? raw.customCostMode
        : 'unlimited',
    customCostValue: Number.isFinite(Number(raw.customCostValue)) ? Number(raw.customCostValue) : undefined,
    usage: {
      totalTokens: normalizeNumber(usageRaw.totalTokens ?? raw.usedTokens ?? raw.used_tokens),
      totalCost: normalizeNumber(usageRaw.totalCost ?? raw.totalCost ?? raw.total_cost),
      dailyTokens: normalizeNumber(usageRaw.dailyTokens),
      dailyCost: normalizeNumber(usageRaw.dailyCost),
      lastReset: normalizeTimestamp(usageRaw.lastReset, createdAt),
    },
    status: raw.status === 'active' || raw.status === 'error' || raw.status === 'checking' ? raw.status : 'checking',
    lastError: normalizeString(raw.lastError ?? raw.last_error) || undefined,
    lastChecked: normalizeOptionalTimestamp(raw.lastChecked ?? raw.last_checked) ?? undefined,
    createdAt,
    updatedAt: normalizeTimestamp(raw.updatedAt ?? raw.updated_at, createdAt),
    activitySummary: isRecord(raw.activitySummary)
      ? {
          lastLatencyMs: normalizeNumber(raw.activitySummary.lastLatencyMs, 0) || null,
          lastTokens: normalizeNumber(raw.activitySummary.lastTokens, 0) || null,
          lastAmount: normalizeNumber(raw.activitySummary.lastAmount, 0) || null,
          updatedAt: normalizeOptionalTimestamp(raw.activitySummary.updatedAt) ?? undefined,
        }
      : undefined,
  };
}

interface UserApiViewSnapshot {
  officialSlots: unknown[];
  providers: unknown[];
  updatedAt: number;
}

function getUserApiViewSnapshotKey(userId: string): string {
  return `${USER_API_VIEW_SNAPSHOT_PREFIX}${userId}`;
}

function readUserApiViewSnapshot(userId: string | null | undefined): UserApiViewSnapshot | null {
  const normalizedUserId = normalizeString(userId);
  if (typeof window === 'undefined' || !normalizedUserId) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(getUserApiViewSnapshotKey(normalizedUserId))
      || window.sessionStorage.getItem(getUserApiViewSnapshotKey(normalizedUserId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<UserApiViewSnapshot> | null;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const updatedAt = normalizeTimestamp(parsed.updatedAt, 0);
    if (!updatedAt || Date.now() - updatedAt > USER_API_VIEW_SNAPSHOT_TTL_MS) {
      window.localStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
      window.sessionStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
      return null;
    }

    return {
      officialSlots: Array.isArray(parsed.officialSlots) ? parsed.officialSlots : [],
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      updatedAt,
    };
  } catch (error) {
    console.warn('[ApiSettingsView] Failed to restore cached user API snapshot:', error);
    return null;
  }
}

function writeUserApiViewSnapshot(
  userId: string | null | undefined,
  officialSlots: KeySlot[],
  providers: ThirdPartyProvider[],
): void {
  const normalizedUserId = normalizeString(userId);
  if (typeof window === 'undefined' || !normalizedUserId) {
    return;
  }

  try {
    window.localStorage.setItem(getUserApiViewSnapshotKey(normalizedUserId), JSON.stringify({
      officialSlots: officialSlots
        .map((slot) => toReadonlyOfficialSlot(slot))
        .filter((slot): slot is KeySlot => Boolean(slot)),
      providers: providers
        .map((provider) => toReadonlyProvider(provider))
        .filter((provider): provider is ThirdPartyProvider => Boolean(provider)),
      updatedAt: Date.now(),
    } satisfies UserApiViewSnapshot));
  } catch (error) {
    console.warn('[ApiSettingsView] Failed to persist cached user API snapshot:', error);
  }
}

function clearUserApiViewSnapshot(userId: string | null | undefined): void {
  const normalizedUserId = normalizeString(userId);
  if (typeof window === 'undefined' || !normalizedUserId) {
    return;
  }

  window.localStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
  window.sessionStorage.removeItem(getUserApiViewSnapshotKey(normalizedUserId));
}

function isUserApiPersistenceDegradedFromHealth(health: KkApiServerHealth | null): boolean {
  return Boolean(
    health
    && (
      !health.reachable
      || !isKkaiUserApiStorageReady(health)
    ),
  );
}

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

const formatTokens = (value: number) => `${compactNumber(value)} ${UI_TOKEN_UNIT_LABEL}`;

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
  if (mode === 'tokens') return UI_TOKEN_LIMIT_LABEL;
  return '不限额';
};

const getModeOption = (mode: CostMode) => {
  if (mode === 'amount') return '金额预算';
  if (mode === 'tokens') return UI_TOKEN_LIMIT_LABEL;
  return '不限额';
};

const parseModeOption = (value: string): CostMode => {
  if (value === '金额预算') return 'amount';
  if (value === UI_TOKEN_LIMIT_LABEL || value === UI_LEGACY_TOKEN_LIMIT_LABEL) return 'tokens';
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

const ApiSettingsViewInner: React.FC<{ initialSupplier?: Supplier | null }> = ({ initialSupplier = null }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isTempUser } = useAuth();
    const { pick: localePick } = useLocale();
    const pick = useCallback((zhText: string, enText: string) => (
      localePick(containsLikelyMojibake(zhText) ? enText : zhText, enText)
    ), [localePick]);
  const handleOpenPlatformAssistant = useCallback(() => {
    notify.info(
      pick('平台辅助 AI', 'Platform Assistant AI'),
      pick('平台入口仍然是单独能力，当前请先在下方的本地 API 区继续配置你的 Base URL、Key 和预算规则。', 'The platform entry stays separate for now. Please continue configuring your Base URL, key, and budget rules in the local API section below.'),
    );
  }, [pick]);
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
  const initialUserApiViewSnapshot = !isTempUser ? readUserApiViewSnapshot(user?.id || null) : null;
  const [activeTab, setActiveTab] = useState<TabType>('official');
  const [officialForm, setOfficialForm] = useState<OfficialForm>(officialDefaults);
  const [providerForm, setProviderForm] = useState<ProviderForm>(providerDefaults);
  const [editingOfficialId, setEditingOfficialId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [apiHealth, setApiHealth] = useState<KkApiServerHealth | null>(null);
  const [returnHighlight, setReturnHighlight] = useState<{
    officialId?: string;
    providerId?: string;
  } | null>(null);
  const officialCardRegistryRef = useRef(new Map<string, HTMLElement>());
  const providerCardRegistryRef = useRef(new Map<string, HTMLElement>());
  const consumedListStateKeyRef = useRef<string | null>(null);
  const [readonlyOfficialSlots, setReadonlyOfficialSlots] = useState<KeySlot[]>(() =>
    (initialUserApiViewSnapshot?.officialSlots || [])
      .map((slot) => toReadonlyOfficialSlot(slot))
      .filter((slot): slot is KeySlot => Boolean(slot))
      .filter(isOfficialSlot),
  );
  const [readonlyProviders, setReadonlyProviders] = useState<ThirdPartyProvider[]>(() =>
    (initialUserApiViewSnapshot?.providers || [])
      .map((provider) => toReadonlyProvider(provider))
      .filter((provider): provider is ThirdPartyProvider => Boolean(provider))
      .sort((left, right) => right.updatedAt - left.updatedAt),
  );

  const runtimeOfficialSlots = useMemo(() => slots.filter(isOfficialSlot), [slots]);
  const runtimeThirdPartyProviders = useMemo(() => [...providers].sort((a, b) => b.updatedAt - a.updatedAt), [providers]);
  const isUserApiPersistenceDegraded = isUserApiPersistenceDegradedFromHealth(apiHealth);
  const authenticatedUserId = !isTempUser ? (user?.id || keyManager.getUserId()) : null;
  const isAuthenticated = Boolean(authenticatedUserId);
  const hasReadonlySnapshot = readonlyOfficialSlots.length > 0 || readonlyProviders.length > 0;
  const userApiViewState = resolveUserApiViewState({
    hasReadonlySnapshot,
    isApiReachable: apiHealth?.reachable,
    isAuthenticated,
    isPersistenceDegraded: isUserApiPersistenceDegraded,
    runtimeOfficialCount: runtimeOfficialSlots.length,
    runtimeProviderCount: runtimeThirdPartyProviders.length,
  });
  const shouldUseReadonlyProfileFallback = userApiViewState.shouldUseReadonlyProfileFallback;
  const isHydratingRuntimeUserApis = userApiViewState.isHydratingRuntimeUserApis;
  const shouldUseReadonlySnapshotForDisplay = userApiViewState.shouldUseReadonlySnapshotForDisplay;
  const officialSlots = useMemo(
    () => (shouldUseReadonlySnapshotForDisplay ? readonlyOfficialSlots : runtimeOfficialSlots),
    [readonlyOfficialSlots, runtimeOfficialSlots, shouldUseReadonlySnapshotForDisplay]
  );
  const thirdPartyProviders = useMemo(
    () => (shouldUseReadonlySnapshotForDisplay ? readonlyProviders : runtimeThirdPartyProviders),
    [readonlyProviders, runtimeThirdPartyProviders, shouldUseReadonlySnapshotForDisplay]
  );
  const isUsingReadonlyProfileFallback =
    shouldUseReadonlySnapshotForDisplay
    && hasReadonlySnapshot;
  const routeOfficialId = useMemo(() => {
    const routeValue = decodeRouteParam(officialId);
    if (routeValue) {
      return routeValue;
    }

    if (!location.pathname.startsWith(API_MANAGEMENT_OFFICIAL_PREFIX)) {
      return '';
    }

    return decodeRouteParam(location.pathname.slice(API_MANAGEMENT_OFFICIAL_PREFIX.length));
  }, [location.pathname, officialId]);
  const routeProviderId = useMemo(() => {
    const routeValue = decodeRouteParam(providerId || legacySupplierId);
    if (routeValue) {
      return routeValue;
    }

    if (!location.pathname.startsWith(API_MANAGEMENT_PROVIDER_PREFIX)) {
      return '';
    }

    return decodeRouteParam(location.pathname.slice(API_MANAGEMENT_PROVIDER_PREFIX.length));
  }, [legacySupplierId, location.pathname, providerId]);
  const selectedOfficialSlot = useMemo(
    () => officialSlots.find((slot) => normalizeRouteMatchValue(slot.id) === normalizeRouteMatchValue(routeOfficialId)) || null,
    [officialSlots, routeOfficialId]
  );
  const selectedProvider = useMemo(() => {
    const routeValue = normalizeRouteMatchValue(routeProviderId);
    if (!routeValue) return null;

    return thirdPartyProviders.find((provider) => normalizeRouteMatchValue(provider.id) === routeValue) || null;
  }, [routeProviderId, thirdPartyProviders]);
  const isOfficialEditorRoute = Boolean(routeOfficialId);
  const isProviderEditorRoute = Boolean(routeProviderId);
  const activeEditorMode: TabType | null = isOfficialEditorRoute ? 'official' : isProviderEditorRoute ? 'third-party' : null;
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
  const workbenchTone = isUserApiPersistenceDegraded ? 'rose' : attentionCount > 0 ? 'amber' : connectedChannels > 0 ? 'emerald' : 'neutral';
  const workbenchStatusLabel = isUsingReadonlyProfileFallback
    ? pick('来自云端记录的只读回显', 'Read-only data from cloud record')
    : isUserApiPersistenceDegraded
      ? pick('本地 API 未连接云端持久化', 'Local API is not using cloud persistence')
      : connectedChannels > 0
        ? pick(`已接入 ${connectedChannels} 条链路`, `${connectedChannels} routes connected`)
        : pick('尚未接入链路', 'No routes connected yet');
  const userApiPersistenceWarning = useMemo(() => {
    if (!apiHealth) {
      return null;
    }

    if (!apiHealth.reachable) {
      return pick(
        '当前本地 API 服务不可用。已登录用户的 BYOK 配置仍然会保存在账号云端记录里，页面会优先回显云端数据，等本地服务恢复后再重新接管完整能力。',
        'The local API server is unavailable. Signed-in BYOK settings now fall back to the account-backed Supabase record, so existing providers can still be shown and new changes can still sync to the user profile.',
      );
    }

    if (!apiHealth.persistence.userApiKeys || !apiHealth.persistence.keyManager) {
      return pick(
        '当前本地 API 仍在内存模式，但已登录用户的 BYOK 修改会直接写入账号云端记录，并在本地服务恢复后继续同步。',
        'The local API server is still running in memory mode, but signed-in BYOK changes now write straight to the account-backed cloud record and will sync back once the local service recovers.',
      );
    }

    return null;
  }, [apiHealth, pick]);
  const userApiPersistenceHelper = useMemo(() => {
    if (!apiHealth) {
      return null;
    }

    if (!apiHealth.reachable) {
      return pick(
        '本地 API 恢复后会重新接管服务端仓库；在这之前，当前页面会继续优先使用云端同步结果。',
        'Until the local API comes back, BYOK reads and writes fall back to the authenticated Supabase profile so you can keep working from the account-backed record.',
      );
    }

    if (!apiHealth.config.hasServiceRoleKey) {
      return pick(
        '如果你想让本地 API 也恢复完整的服务端持久化能力，再补上 SUPABASE_SERVICE_ROLE_KEY 并重启本地服务；普通用户 BYOK 云端同步本身不依赖它。',
        'If you want the local API to regain full server-side persistence, add SUPABASE_SERVICE_ROLE_KEY and restart it. Basic BYOK cloud sync for signed-in users does not depend on that key.',
      );
    }

    return pick(
      '本地与云端会在服务恢复后继续对齐；当前页面已经优先保证云端记录不丢失。',
      'Local and cloud state will realign once the service recovers. The page now prioritizes keeping the cloud record intact.',
    );
  }, [apiHealth, pick]);
  const snapshotHydrationHelper = pick(
    '当前先展示的是本地快照，正在同步最新云端配置。请稍候片刻后再编辑。',
    'Showing the cached snapshot while the latest cloud configuration syncs. Please wait a moment before editing.',
  );
  const userApiActionsDisabled = userApiViewState.userApiActionsDisabled;
  const providerActionsDisabled = userApiViewState.providerActionsDisabled;
  const userApiEditorDisabled = userApiViewState.userApiEditorDisabled;
  const userApiEditorReadOnly = userApiEditorDisabled;
  const providerEditorReadOnly = userApiViewState.providerEditorReadOnly;
  const backendUnavailableHelper = apiHealth?.reachable === false
    ? pick(
        '本地 API 当前不可用。请先恢复服务，再新增、编辑或删除 BYOK 配置。',
        'The local API server is unavailable. The page will fall back to the current account-backed Supabase profile, so you can still edit and save this BYOK configuration.',
      )
    : null;
  const userApiActionHelper = backendUnavailableHelper ?? (!isAuthenticated
    ? pick(
        '登录后才能管理 BYOK 路由。前端匿名态不会保存密钥，也不会直接调用供应商接口。',
        'Sign in before managing BYOK routes. Anonymous key storage and direct provider calls are disabled in the frontend.',
      )
    : isHydratingRuntimeUserApis
      ? snapshotHydrationHelper
      : null);
  const providerActionHelper = userApiActionHelper;
  const userApiEditorReadOnlyHelper = userApiEditorReadOnly
    ? userApiActionHelper
    : apiHealth?.reachable === false
      ? backendUnavailableHelper
      : isUserApiPersistenceDegraded
      ? pick(
          '当前处于云端直写模式。你保存的本地 API 会直接进入账号云端记录，并在本地服务恢复后继续同步。',
          'Cloud-backed write mode is active. Saved local APIs will go straight to the account-backed cloud record and sync back once the local service recovers.',
        )
      : null;
  const providerEditorReadOnlyHelper = providerEditorReadOnly
    ? providerActionHelper
    : apiHealth?.reachable === false
      ? backendUnavailableHelper
      : isUserApiPersistenceDegraded
      ? pick(
          '当前处于云端直写模式。你保存的供应商会直接进入账号云端记录，并在本地服务恢复后继续同步。',
          'Cloud-backed write mode is active. Saved providers will go straight to the account-backed cloud record and sync back once the local service recovers.',
        )
      : null;
  const browserDirectChecksDisabled = false;
  const browserDirectChecksHelper = pick(
    '浏览器直连检测已关闭。请先保存到账号，再通过本地后端或云端安全代理链路使用。',
    'Browser-side diagnostics are disabled. Save the route to your account and use the local backend or secure cloud proxy path instead.',
  );
  const useCloudBackedUserApiWrites =
    isAuthenticated
    && !isTempUser
    && (isUserApiPersistenceDegraded || apiHealth?.reachable === false);
  const canReusePersistedOfficialSecret = Boolean(editingOfficialId && selectedOfficialSlot);
  const canReusePersistedProviderSecret = Boolean(editingProviderId && selectedProvider);
  const diagnosticsAvailability = resolveApiWorkbenchDiagnosticsAvailability({
    isAuthenticated,
    isApiReachable: apiHealth?.reachable,
  });
  const diagnosticsRefreshDisabled = diagnosticsAvailability.refreshDisabled;
  const routeDiagnosticsActionDisabled = diagnosticsAvailability.routeActionsDisabled;
  const userApiReadOnlyHelper = isUserApiPersistenceDegraded
    ? pick(
        '当前页面会优先保住账号云端记录里的配置，并在本地服务恢复后重新和本地状态对齐。',
        'This page now prioritizes preserving the account-backed cloud record and will realign local state after the local service recovers.',
      )
    : null;
  const ensureUserApiActionsAllowed = (): boolean => {
    if (!isAuthenticated) {
      notify.warning(pick('请先登录', 'Sign in required'), userApiActionHelper || snapshotHydrationHelper);
      return false;
    }

    if (apiHealth?.reachable === false && !useCloudBackedUserApiWrites) {
      notify.warning(pick('本地 API 不可用', 'Local API unavailable'), userApiActionHelper || userApiPersistenceHelper || snapshotHydrationHelper);
      return false;
    }

    if (hasReadonlySnapshot) {
      return true;
    }

    if (isHydratingRuntimeUserApis) {
      notify.warning(pick('正在同步配置', 'Still syncing'), snapshotHydrationHelper);
      return false;
    }

    return true;
  };
  const ensureProviderActionsAllowed = (): boolean => {
    if (!isAuthenticated) {
      notify.warning(pick('请先登录', 'Sign in required'), providerActionHelper || snapshotHydrationHelper);
      return false;
    }

    if (apiHealth?.reachable === false && !useCloudBackedUserApiWrites) {
      notify.warning(pick('本地 API 不可用', 'Local API unavailable'), providerActionHelper || userApiPersistenceHelper || snapshotHydrationHelper);
      return false;
    }

    if (hasReadonlySnapshot) {
      return true;
    }

    if (isHydratingRuntimeUserApis) {
      notify.warning(pick('正在同步配置', 'Still syncing'), snapshotHydrationHelper);
      return false;
    }

    return true;
  };
  const ensureBrowserDirectDiagnosticsAllowed = (): boolean => {
    if (browserDirectChecksDisabled) {
      notify.warning(pick('浏览器直连已禁用', 'Browser direct calls disabled'), browserDirectChecksHelper);
      return false;
    }

    return true;
  };
  const showOfficialEditor = activeEditorMode === 'official';
  const showProviderEditor = activeEditorMode === 'third-party';

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

  const refresh = useCallback(() => {
    setSlots(keyManager.getSlots());
    setProviders(keyManager.getProviders());
  }, []);

  const refreshReadonlyProfileFallback = useCallback(async () => {
    try {
      const payload = await loadUserApisPayloadMetadataFromCloudRecord();
      const nextOfficialSlots = extractKeyManagerCloudSlots(payload)
        .map((slot) => toReadonlyOfficialSlot(slot))
        .filter((slot): slot is KeySlot => Boolean(slot))
        .filter(isOfficialSlot);
      const nextProviders = extractUserApiProvidersFromPayload(payload)
        .map((provider) => toReadonlyProvider(provider))
        .filter((provider): provider is ThirdPartyProvider => Boolean(provider))
        .sort((left, right) => right.updatedAt - left.updatedAt);

      setReadonlyOfficialSlots(nextOfficialSlots);
      setReadonlyProviders(nextProviders);
      if (nextOfficialSlots.length > 0 || nextProviders.length > 0) {
        writeUserApiViewSnapshot(authenticatedUserId, nextOfficialSlots, nextProviders);
      } else {
        clearUserApiViewSnapshot(authenticatedUserId);
      }
    } catch (error) {
      console.warn('[ApiSettingsView] Failed to load read-only cloud metadata fallback:', error);
    }
  }, [authenticatedUserId]);

  const refreshApiHealth = useCallback(async (forceRefresh = false) => {
    const health = await getKkApiServerHealth({ forceRefresh });
    setApiHealth(health);
    return health;
  }, []);

  const refreshCloudData = useCallback(async (silent = false) => {
    let nextHealth: KkApiServerHealth | null = null;
    try {
      [, nextHealth] = await Promise.all([
        keyManager.refreshFromCloudNow(),
        refreshApiHealth(!silent),
      ]);
    } catch (error) {
      refresh();
      void refreshApiHealth(true);

      if (!silent) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : pick('暂时无法从云端拉取最新配置。', 'Unable to pull the latest cloud configuration right now.');

        notify.warning(pick('刷新失败', 'Refresh failed'), message);
      }

      return;
    }

    refresh();
    const nextOfficialSlots = keyManager.getSlots().filter(isOfficialSlot);
    const nextProviders = keyManager.getProviders().sort((left, right) => right.updatedAt - left.updatedAt);
    if (nextOfficialSlots.length > 0 || nextProviders.length > 0) {
      writeUserApiViewSnapshot(authenticatedUserId, nextOfficialSlots, nextProviders);
      return;
    }

    if (!isUserApiPersistenceDegradedFromHealth(nextHealth)) {
      clearUserApiViewSnapshot(authenticatedUserId);
      setReadonlyOfficialSlots([]);
      setReadonlyProviders([]);
    }
  }, [authenticatedUserId, pick, refresh, refreshApiHealth]);
  const refreshAfterCloudUserApiMutation = useCallback(async () => {
    await refreshCloudData(true);
  }, [refreshCloudData]);

  useEffect(() => {
    refresh();
    void refreshApiHealth();
    void refreshCloudData(true);
    return keyManager.subscribe(refresh);
  }, [refresh, refreshApiHealth, refreshCloudData]);

  useEffect(() => {
    if (runtimeOfficialSlots.length === 0 && runtimeThirdPartyProviders.length === 0) {
      return;
    }

    writeUserApiViewSnapshot(authenticatedUserId, runtimeOfficialSlots, runtimeThirdPartyProviders);
  }, [authenticatedUserId, runtimeOfficialSlots, runtimeThirdPartyProviders]);

  useEffect(() => {
    const cachedSnapshot = readUserApiViewSnapshot(authenticatedUserId);
    if (!cachedSnapshot) {
      setReadonlyOfficialSlots([]);
      setReadonlyProviders([]);
      return;
    }

    setReadonlyOfficialSlots(
      cachedSnapshot.officialSlots
        .map((slot) => toReadonlyOfficialSlot(slot))
        .filter((slot): slot is KeySlot => Boolean(slot))
        .filter(isOfficialSlot),
    );
    setReadonlyProviders(
      cachedSnapshot.providers
        .map((provider) => toReadonlyProvider(provider))
        .filter((provider): provider is ThirdPartyProvider => Boolean(provider))
        .sort((left, right) => right.updatedAt - left.updatedAt),
    );
  }, [authenticatedUserId]);

  useEffect(() => {
    if (!shouldUseReadonlySnapshotForDisplay) {
      return;
    }

    void refreshReadonlyProfileFallback();
  }, [refreshReadonlyProfileFallback, shouldUseReadonlySnapshotForDisplay]);

  useEffect(() => {
    if (isOfficialEditorRoute) {
      setActiveTab('official');

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

    if (location.pathname === API_MANAGEMENT_HOME_PATH) {
      setEditingOfficialId(null);
      setEditingProviderId(null);
      setOfficialForm(officialDefaults);
      setProviderForm(providerDefaults);
    }
  }, [
    initialSupplier,
    isCreatingOfficial,
    isCreatingProvider,
    isOfficialEditorRoute,
    isProviderEditorRoute,
    location.pathname,
    selectedOfficialSlot?.id,
    selectedProvider?.id,
  ]);

  useEffect(() => {
    if (activeEditorMode || consumedListStateKeyRef.current === location.key) {
      return;
    }

    consumedListStateKeyRef.current = location.key;
    const listState = readApiManagementListState(location.state);
    if (!listState) {
      return;
    }

    setActiveTab(listState.activeTab);
    if (listState.highlightOfficialId || listState.highlightProviderId) {
      setReturnHighlight({
        officialId: listState.highlightOfficialId,
        providerId: listState.highlightProviderId,
      });
    }
  }, [activeEditorMode, location.key, location.state]);

  useEffect(() => {
    if (!returnHighlight?.officialId && !returnHighlight?.providerId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setReturnHighlight(null);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [returnHighlight]);

  useEffect(() => {
    if (activeEditorMode) {
      return;
    }

    const targetId = activeTab === 'official' ? returnHighlight?.officialId : returnHighlight?.providerId;
    if (!targetId) {
      return;
    }

    const registry = activeTab === 'official' ? officialCardRegistryRef.current : providerCardRegistryRef.current;
    const targetNode = registry.get(targetId);
    if (!targetNode) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      targetNode.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeEditorMode, activeTab, returnHighlight, officialSlots.length, thirdPartyProviders.length]);

  const run = async (
    key: string,
    task: () => Promise<void>,
    options?: {
      skipRefresh?: boolean;
    },
  ) => {
    setBusy(key);
    try {
      await task();
      if (!options?.skipRefresh) {
        refresh();
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : pick('当前操作暂时无法完成。', 'The current action could not be completed right now.');

      notify.error(pick('操作失败', 'Action failed'), message);
    } finally {
      setBusy((current) => (current === key ? null : current));
    }
  };

  const returnToApiManagementList = useCallback(
    (tab: TabType, options?: { highlightOfficialId?: string | null; highlightProviderId?: string | null }) => {
      navigate(API_MANAGEMENT_HOME_PATH, {
        state: buildApiManagementListState(tab, options),
      });
    },
    [navigate],
  );

  const registerOfficialCardRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node) {
      officialCardRegistryRef.current.set(id, node);
      return;
    }

    officialCardRegistryRef.current.delete(id);
  }, []);

  const registerProviderCardRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node) {
      providerCardRegistryRef.current.set(id, node);
      return;
    }

    providerCardRegistryRef.current.delete(id);
  }, []);

  const beginCreateOfficial = () => {
    if (!ensureUserApiActionsAllowed()) {
      return;
    }

    setActiveTab('official');
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(officialDefaults);
    navigate(buildOfficialEditorPath());
  };

  const beginCreateProvider = () => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    setActiveTab('third-party');
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setProviderForm(initialSupplier ? toProviderFormFromSupplier(initialSupplier) : providerDefaults);
    navigate(buildProviderEditorPath());
  };

  const startEditOfficial = (slot: KeySlot) => {
    if (!ensureUserApiActionsAllowed()) {
      return;
    }

    setActiveTab('official');
    setEditingOfficialId(slot.id);
    setEditingProviderId(null);
    setOfficialForm(toOfficialForm(slot));
    navigate(buildOfficialEditorPath(slot.id));
  };

  const startEditProvider = (provider: ThirdPartyProvider) => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    setActiveTab('third-party');
    setEditingOfficialId(null);
    setEditingProviderId(provider.id);
    setProviderForm(toProviderForm(provider));
    navigate(buildProviderEditorPath(provider.id));
  };

  const cancelEdit = () => {
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(officialDefaults);
    setProviderForm(providerDefaults);
    if (isOfficialEditorRoute) {
      returnToApiManagementList('official', { highlightOfficialId: editingOfficialId });
      return;
    }

    returnToApiManagementList('third-party', { highlightProviderId: editingProviderId });
  };

  const saveOfficial = async () => {
    if (!ensureUserApiActionsAllowed()) {
      return;
    }

    const value = officialForm.mode === 'unlimited' ? null : positive(officialForm.value);
    const normalizedKey = officialForm.key.trim();
    const nextSlotId = officialForm.id || `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const nextKeyValue = normalizedKey || (canReusePersistedOfficialSecret ? READONLY_SECRET_PLACEHOLDER : '');

    if (!nextKeyValue) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('请填写有效的 API Key。', 'Enter a valid API key.'),
      );
      return;
    }

    if (isReadonlySecretPlaceholder(officialForm.key)) {
      if (!canReusePersistedOfficialSecret) {
        notify.error(
          pick('保存失败', 'Save failed'),
          pick(
            '请重新输入真实 API Key，当前只读占位符不能直接保存回账号。',
            'Re-enter the real API key before saving. Read-only placeholder secrets cannot be saved back to the account.',
          ),
        );
        return;
      }
    }

    if (officialForm.mode !== 'unlimited' && !value) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('预算或词元上限必须大于 0。', 'Budget or token limit must be greater than 0.'),
      );
      return;
    }

    const payload = {
      budgetLimit: officialForm.mode === 'amount' ? value ?? -1 : -1,
      tokenLimit: officialForm.mode === 'tokens' ? value ?? -1 : -1,
    };

    await run(`official-save:${officialForm.id || 'new'}`, async () => {
      if (useCloudBackedUserApiWrites) {
        const existingSlot = selectedOfficialSlot || officialSlots.find((slot) => slot.id === officialForm.id) || null;
        await upsertUserApiSlotToCloudRecord({
          id: nextSlotId,
          name: officialForm.provider,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: officialForm.provider === 'Google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_OPENAI_BASE_URL,
          key: nextKeyValue,
          supportedModels: existingSlot?.supportedModels || [],
          disabled: existingSlot?.disabled || false,
          status: existingSlot?.status || 'unknown',
          failCount: existingSlot?.failCount || 0,
          successCount: existingSlot?.successCount || 0,
          lastUsed: existingSlot?.lastUsed || null,
          lastError: existingSlot?.lastError || null,
          createdAt: existingSlot?.createdAt || Date.now(),
          updatedAt: Date.now(),
          avgResponseTime: existingSlot?.avgResponseTime,
          lastResponseTime: existingSlot?.lastResponseTime,
          usedTokens: existingSlot?.usedTokens || 0,
          totalCost: existingSlot?.totalCost || 0,
          ...payload,
        });
        await refreshAfterCloudUserApiMutation();
      } else if (officialForm.id) {
        await keyManager.updateKey(officialForm.id, {
          name: officialForm.provider,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: '',
          key: normalizedKey,
          ...payload,
        });
        await keyManager.syncToCloudNow();
      } else {
        const result = await keyManager.addKey(normalizedKey, {
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
            result.error || pick('无法创建本地 API。', 'Unable to create the local API.'),
          );
          return;
        }
        await keyManager.syncToCloudNow();
      }

      notify.success(
        officialForm.id ? pick('保存成功', 'Saved') : pick('新增成功', 'Created'),
        officialForm.id
          ? pick('本地 API 配置已更新。', 'Local API settings have been updated.')
          : pick('本地 API 已加入当前链路。', 'The local API has been added to the current routing chain.'),
      );
      cancelEdit();
    });
  };

  const saveProvider = async () => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    const value = providerForm.mode === 'unlimited' ? null : positive(providerForm.value);
    const normalizedApiKey = providerForm.apiKey.trim();
    const nextProviderId = providerForm.id || `provider_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const nextApiKeyValue = normalizedApiKey || (canReusePersistedProviderSecret ? READONLY_SECRET_PLACEHOLDER : '');
    const existingProvider = selectedProvider || thirdPartyProviders.find((provider) => provider.id === providerForm.id) || null;
    const connectionSignatureChanged = Boolean(
      existingProvider && (
        normalizeProviderConnectionValue(existingProvider.baseUrl) !== normalizeProviderConnectionValue(providerForm.baseUrl)
        || normalizeProtocolFormat(existingProvider.format, 'auto') !== providerForm.format
        || (
          normalizedApiKey
          && !isReadonlySecretPlaceholder(providerForm.apiKey)
          && normalizedApiKey !== String(existingProvider.apiKey || '').trim()
        )
      )
    );
    const effectiveProviderModelsForCloudWrite = resolveEffectiveProviderModels({
      provider: providerForm.name.trim(),
      baseUrl: providerForm.baseUrl.trim(),
      format: providerForm.format,
      models: connectionSignatureChanged ? [] : (existingProvider?.models || []),
    });

    if (!providerForm.name.trim() || !providerForm.baseUrl.trim() || !nextApiKeyValue) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('请完整填写供应商名称、基础地址和 API Key。', 'Enter the provider name, base URL, and API key.'),
      );
      return;
    }

    if (isReadonlySecretPlaceholder(providerForm.apiKey) && !canReusePersistedProviderSecret) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick(
          '请重新输入真实 API Key，当前只读占位符不能直接保存回账号。',
          'Re-enter the real API key before saving. Read-only placeholder secrets cannot be saved back to the account.',
        ),
      );
      return;
    }

    if (providerForm.mode !== 'unlimited' && !value) {
      notify.error(
        pick('保存失败', 'Save failed'),
        pick('预算或词元上限必须大于 0。', 'Budget or token limit must be greater than 0.'),
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
      if (useCloudBackedUserApiWrites) {
        await upsertUserApiProviderToCloudRecord({
          id: nextProviderId,
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: nextApiKeyValue,
          models: effectiveProviderModelsForCloudWrite,
          format: providerForm.format,
          group: providerForm.group.trim() || undefined,
          providerColor: providerForm.color,
          isActive: providerForm.isActive,
          usage: existingProvider?.usage || {
            totalTokens: 0,
            totalCost: 0,
            dailyTokens: 0,
            dailyCost: 0,
            lastReset: Date.now(),
          },
          status: existingProvider?.status || 'checking',
          lastError: existingProvider?.lastError,
          lastChecked: existingProvider?.lastChecked,
          createdAt: existingProvider?.createdAt || Date.now(),
          updatedAt: Date.now(),
          activitySummary: existingProvider?.activitySummary,
          ...payload,
        });
        await refreshAfterCloudUserApiMutation();
      } else if (providerForm.id) {
        keyManager.updateProvider(providerForm.id, {
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: normalizedApiKey,
          format: providerForm.format,
          group: providerForm.group.trim() || undefined,
          providerColor: providerForm.color,
          isActive: providerForm.isActive,
          models: connectionSignatureChanged ? [] : (existingProvider?.models || []),
          ...payload,
        });
        await keyManager.syncToCloudNow();
      } else {
        keyManager.addProvider({
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: normalizedApiKey,
          models: [],
          format: providerForm.format,
          group: providerForm.group.trim() || undefined,
          providerColor: providerForm.color,
          isActive: providerForm.isActive,
          ...payload,
        });
        await keyManager.syncToCloudNow();
      }

      notify.success(
        providerForm.id ? pick('保存成功', 'Saved') : pick('新增成功', 'Created'),
        providerForm.id
          ? pick('供应商配置已更新。', 'Provider settings have been updated.')
          : pick('供应商已加入当前调度池。', 'The provider has been added to the routing pool.'),
      );
      cancelEdit();
    });
  };

  const deleteOfficial = async (id: string) => {
    if (!ensureUserApiActionsAllowed()) {
      return;
    }

    await run(`official-delete:${id}`, async () => {
      if (useCloudBackedUserApiWrites) {
        await removeUserApiSlotFromCloudRecord(id);
        await refreshAfterCloudUserApiMutation();
      } else {
        keyManager.removeKey(id);
        await keyManager.syncToCloudNow();
      }

      notify.success(
        pick('删除成功', 'Deleted'),
        pick('本地 API 已移除。', 'The local API has been removed.'),
      );
      if (editingOfficialId === id) cancelEdit();
    });
  };

  const deleteProvider = async (id: string) => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    await run(`provider-delete:${id}`, async () => {
      if (useCloudBackedUserApiWrites) {
        await removeUserApiProviderFromCloudRecord(id);
        await refreshAfterCloudUserApiMutation();
      } else {
        keyManager.removeProvider(id);
        await keyManager.syncToCloudNow();
      }

      notify.success(
        pick('删除成功', 'Deleted'),
        pick('供应商配置已移除。', 'The provider configuration has been removed.'),
      );
      if (editingProviderId === id) cancelEdit();
    });
  };

  const toggleOfficial = async (slot: KeySlot) => {
    if (!ensureUserApiActionsAllowed()) {
      return;
    }

    const nextDisabled = !slot.disabled;
    await run(`official-toggle:${slot.id}`, async () => {
      if (useCloudBackedUserApiWrites) {
        await upsertUserApiSlotToCloudRecord({
          id: slot.id,
          name: slot.name,
          provider: slot.provider,
          type: slot.type,
          format: slot.format,
          baseUrl: slot.baseUrl || (slot.provider === 'Google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_OPENAI_BASE_URL),
          key: READONLY_SECRET_PLACEHOLDER,
          supportedModels: slot.supportedModels,
          disabled: nextDisabled,
          status: slot.status,
          failCount: slot.failCount,
          successCount: slot.successCount,
          lastUsed: slot.lastUsed,
          lastError: slot.lastError,
          createdAt: slot.createdAt,
          updatedAt: Date.now(),
          avgResponseTime: slot.avgResponseTime,
          lastResponseTime: slot.lastResponseTime,
          usedTokens: slot.usedTokens,
          totalCost: slot.totalCost,
          budgetLimit: slot.budgetLimit,
          tokenLimit: slot.tokenLimit,
        });
        await refreshAfterCloudUserApiMutation();
      } else {
        await keyManager.updateKey(slot.id, { disabled: nextDisabled });
        await keyManager.syncToCloudNow();
      }

      notify.success(
        nextDisabled ? pick('已暂停', 'Paused') : pick('已启用', 'Enabled'),
        pick(`${slot.name} 的调度状态已更新。`, `${slot.name} scheduling status has been updated.`),
      );
    });
  };

  const toggleProvider = async (provider: ThirdPartyProvider) => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    const nextActive = !provider.isActive;
    await run(`provider-toggle:${provider.id}`, async () => {
      if (useCloudBackedUserApiWrites) {
        await upsertUserApiProviderToCloudRecord({
          id: provider.id,
          name: provider.name,
          baseUrl: provider.baseUrl,
          apiKey: READONLY_SECRET_PLACEHOLDER,
          models: provider.models,
          format: provider.format,
          group: provider.group,
          providerColor: provider.providerColor,
          isActive: nextActive,
          usage: provider.usage,
          status: provider.status,
          lastError: provider.lastError,
          lastChecked: provider.lastChecked,
          createdAt: provider.createdAt,
          updatedAt: Date.now(),
          activitySummary: provider.activitySummary,
          budgetLimit: provider.budgetLimit,
          tokenLimit: provider.tokenLimit,
          customCostMode: provider.customCostMode,
          customCostValue: provider.customCostValue,
        });
        await refreshAfterCloudUserApiMutation();
      } else {
        keyManager.updateProvider(provider.id, { isActive: nextActive });
        await keyManager.syncToCloudNow();
      }

      notify.success(
        nextActive ? pick('已启用', 'Enabled') : pick('已暂停', 'Paused'),
        pick(`${provider.name} 的调度状态已更新。`, `${provider.name} scheduling status has been updated.`),
      );
    });
  };

  const refreshOfficial = async (slot: KeySlot) => {
    if (!ensureBrowserDirectDiagnosticsAllowed()) {
      return;
    }

    await run(`official-check:${slot.id}`, async () => {
      const response = await kkWebApiClient.checkUserRouteConnectivity(slot.id);
      if (!response.success) {
        notify.warning(
          pick('检测失败', 'Check failed'),
          response.error.message || pick('本地 API 安全代理暂时不可用。', 'The local API secure proxy is unavailable right now.'),
        );
        return;
      }

      const check = response.data;
      await keyManager.updateKey(slot.id, {
        status: check.ok ? 'valid' : 'invalid',
        lastError: check.ok ? null : check.message || '连接失败',
        supportedModels: check.ok ? check.models : slot.supportedModels,
        lastResponseTime: check.ok ? check.latencyMs ?? slot.lastResponseTime : slot.lastResponseTime,
        avgResponseTime: check.ok ? check.latencyMs ?? slot.avgResponseTime : slot.avgResponseTime,
      });
      if (check.ok) {
        notify.success(
          pick('刷新成功', 'Refreshed'),
          pick(`${slot.name} 已完成连通检测。`, `${slot.name} connectivity check is complete.`),
        );
      } else {
        notify.warning(
          pick('检测失败', 'Check failed'),
          check.message || pick('请检查密钥和网络连通性。', 'Check the key and network connectivity.'),
        );
      }
    });
  };

  const refreshProvider = async (provider: ThirdPartyProvider) => {
    if (!ensureBrowserDirectDiagnosticsAllowed()) {
      return;
    }

    await run(`provider-check:${provider.id}`, async () => {
      const response = await kkWebApiClient.checkUserRouteConnectivity(provider.id);
      if (!response.success) {
        notify.warning(
          pick('检测失败', 'Check failed'),
          response.error.message || pick('本地 API 安全代理暂时不可用。', 'The local API secure proxy is unavailable right now.'),
        );
        return;
      }

      const check = response.data;
      const checkedAt = Date.now();
      keyManager.updateProvider(provider.id, {
        status: check.ok ? 'active' : 'error',
        lastChecked: checkedAt,
        lastError: check.ok ? undefined : check.message || '连接失败',
        models: check.ok ? check.models : provider.models,
        activitySummary: {
          ...provider.activitySummary,
          lastLatencyMs: check.ok
            ? check.latencyMs ?? provider.activitySummary?.lastLatencyMs ?? null
            : provider.activitySummary?.lastLatencyMs ?? null,
          updatedAt: checkedAt,
        },
      });
      if (check.ok) {
        notify.success(
          pick('刷新成功', 'Refreshed'),
          pick(`${provider.name} 已完成连通检测。`, `${provider.name} connectivity check is complete.`),
        );
      } else {
        notify.warning(
          pick('检测失败', 'Check failed'),
          check.message || pick('请检查基础地址和密钥。', 'Check the base URL and key.'),
        );
      }
    });
  };

  const syncPricing = async (provider: ThirdPartyProvider) => {
    if (!ensureBrowserDirectDiagnosticsAllowed()) {
      return;
    }

    await run(`provider-price:${provider.id}`, async () => {
      const response = await kkWebApiClient.syncUserRoutePricing(provider.id);
      if (!response.success) {
        notify.warning(
          pick('同步失败', 'Sync failed'),
          response.error.message || pick('本地 API 安全代理暂时不可用。', 'The local API secure proxy is unavailable right now.'),
        );
        return;
      }

      const result = response.data;
      if (result.ok) {
        const fetchedSnapshot = buildProviderPricingSnapshot(result.pricingData, result.groupRatio, {
          fetchedAt: Date.now(),
          note: result.endpointUrl ? `Synced from ${result.endpointUrl}` : 'Synced from secure proxy',
        });
        const mergedSnapshot = mergeProviderPricingSnapshot(fetchedSnapshot, provider.pricingSnapshot);
        const pricingModels = (fetchedSnapshot.rows || [])
          .map((row) => String(row?.model || '').trim())
          .filter(Boolean);

        keyManager.updateProvider(provider.id, {
          pricingSnapshot: mergedSnapshot,
          models: pricingModels.length > 0 ? Array.from(new Set([...provider.models, ...pricingModels])) : provider.models,
        });

        notify.success(
          pick('同步成功', 'Synced'),
          result.message || pick('价格信息已更新。', 'Pricing information has been updated.'),
        );
      } else {
        notify.warning(
          pick('同步失败', 'Sync failed'),
          result.message || pick('当前没有可用的价格数据返回。', 'No pricing data is available right now.'),
        );
      }
    });
  };

  const stageMeta = resolveApiWorkbenchStageMeta({
    activeTab,
    pick,
    showDiagnostics,
    stage: userApiViewState.stage,
    snapshotHydrationHelper,
    userApiPersistenceWarning,
    userApiPersistenceHelper,
    backendUnavailableHelper,
    userApiActionHelper,
  });
  const userApiWorkbenchStage = stageMeta.stage;
  const stageTone = stageMeta.tone;
  const stageTitle = stageMeta.title;
  const stageDescription = stageMeta.description;
  const stageInteractionLabel = stageMeta.interactionLabel;
  const stageNextActionLabel = stageMeta.nextActionLabel;
  const stageBannerStyle = stageMeta.bannerTone === 'elevated'
    ? SETTINGS_ELEVATED_STYLE
    : stageMeta.bannerTone === 'info'
      ? SETTINGS_INFO_STYLE
      : SETTINGS_WARNING_STYLE;
  const stagePrimaryActionIcon = stageMeta.primaryActionKind === 'create-official' || stageMeta.primaryActionKind === 'create-provider'
    ? Plus
    : RefreshCw;
  const stagePrimaryActionTone = stageMeta.primaryActionKind === 'create-official' || stageMeta.primaryActionKind === 'create-provider'
    ? 'primary'
    : 'secondary';
  const handleStagePrimaryAction = () => {
    switch (stageMeta.primaryActionKind) {
      case 'create-official':
        beginCreateOfficial();
        return;
      case 'create-provider':
        beginCreateProvider();
        return;
      case 'refresh-readonly-snapshot':
        void refreshReadonlyProfileFallback();
        return;
      case 'refresh-runtime-health':
        void refreshApiHealth(true);
        return;
      case 'review-sign-in-requirements':
      default:
        notify.info(pick('请先登录', 'Sign in required'), userApiActionHelper || snapshotHydrationHelper);
    }
  };

  if (officialRouteMissing) {
    return (
      <SettingsViewShell>
        <SettingsHero
          eyebrow={pick('接口编辑', 'Endpoint editor')}
          title={pick('找不到接口', 'Endpoint not found')}
          description={pick(
            '当前要编辑的本地 API 已经不存在了，先回到列表重新选择。',
            'The local API you are editing no longer exists. Return to the list and pick another one.'
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
            title={pick('这条本地 API 可能已经被删除', 'This local API may have been removed')}
            description={pick(
              '返回 API 管理列表后重新选择要编辑的接口。',
              'Return to API Management and choose another endpoint to edit.'
            )}
            action={
              <SettingsActionButton data-testid="api-official-editor-back" icon={ArrowLeft} onClick={cancelEdit}>
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
      {activeEditorMode === 'official' ? (
        <SettingsHero
          eyebrow={pick('接口编辑', 'Endpoint editor')}
          title={editingOfficialId ? getOfficialDisplayName(officialForm.provider) : pick('新增本地 API', 'Add local API')}
          description={
            editingOfficialId
              ? pick('当前页面只修改这一条本地 API，保存后返回列表。', 'This page edits one local API at a time and returns to the list after saving.')
              : pick('在独立页面创建本地 API，避免和列表卡片混在一起。', 'Create a local API in a focused editor instead of mixing it with the list.')
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
              <SettingsActionButton data-testid="api-official-editor-back" icon={ArrowLeft} onClick={cancelEdit}>
                {pick('返回接口列表', 'Back to endpoints')}
              </SettingsActionButton>
              {selectedOfficialSlot ? (
                <SettingsActionButton
                  icon={RefreshCw}
                  disabled={routeDiagnosticsActionDisabled}
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
                helper={editingOfficialId ? pick('你现在编辑的是这一条本地 API', 'You are editing this local API now') : pick('保存后会加入本地 API 列表', 'After saving it will join the local API list')}
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

      {activeEditorMode === 'third-party' ? (
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
                    disabled={routeDiagnosticsActionDisabled}
                    loading={busy === `provider-check:${selectedProvider.id}`}
                    onClick={() => void refreshProvider(selectedProvider)}
                  >
                    {pick('刷新连通性', 'Refresh connectivity')}
                  </SettingsActionButton>
                  <SettingsActionButton
                    icon={Wand2}
                    disabled={routeDiagnosticsActionDisabled}
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

      {activeEditorMode === null ? (
        <>
          <SettingsHero
        eyebrow={pick('高级设置', 'Advanced settings')}
        title={pick('API 工作台', 'API Workspace')}
        description={pick(
          '把本地 API、第三方供应商和预算规则收在一个页面里，优先保留清晰的入口和最少的操作。',
          'Keep local APIs, third-party providers, and budget rules in one place with clearer entry points and less clutter.'
        )}
        icon={Key}
        tone={workbenchTone}
        badge={
          <SettingsBadge tone={workbenchTone}>
            {isUsingReadonlyProfileFallback
              ? pick('来自云端记录的只读回显', 'Read-only data from cloud record')
              : isUserApiPersistenceDegraded
                ? pick('本地 API 未连接云端持久化', 'Local API is not using cloud persistence')
                : connectedChannels > 0
                  ? pick(`已接入 ${connectedChannels} 条链路`, `${connectedChannels} routes connected`)
                  : pick('尚未接入链路', 'No routes connected yet')}
          </SettingsBadge>
        }
        actions={
          <>
            <SettingsActionButton
              icon={RefreshCw}
              loading={busy === 'cloud-refresh'}
              onClick={() => void run('cloud-refresh', () => refreshCloudData())}
            >
              {pick('刷新数据', 'Refresh data')}
            </SettingsActionButton>
            <SettingsActionButton
              style={{ display: 'none' }}
              data-testid="api-workbench-hero-diagnostics-toggle"
              icon={Activity}
              tone={showDiagnostics ? 'primary' : 'secondary'}
              onClick={() => setShowDiagnostics((current) => !current)}
            >
              {showDiagnostics ? pick('收起诊断', 'Hide diagnostics') : pick('查看诊断', 'Show diagnostics')}
            </SettingsActionButton>
          </>
        }
        metrics={
          <>
            {isUserApiPersistenceDegraded ? (
              <SettingsMetricCard
                label={pick('持久化状态', 'Persistence status')}
                value={isUsingReadonlyProfileFallback ? pick('正在展示云端只读数据', 'Showing read-only cloud data') : pick('本地 API 仍在内存模式', 'Local API still uses memory mode')}
                helper={userApiReadOnlyHelper || userApiPersistenceHelper || pick('云端配置仍会继续保留，等本地服务恢复后会重新和本地状态对齐。', 'Cloud-backed settings remain preserved and will realign with local state once the service recovers.')}
                icon={RefreshCw}
                tone="rose"
              />
            ) : null}
            <SettingsMetricCard
              label={pick('本地 API', 'Local APIs')}
              value={`${officialSlots.length}`}
              helper={pick(
                `${officialSlots.filter((slot) => !slot.disabled).length} 条当前可参与调度`,
                `${officialSlots.length} endpoints`
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
                    `${thirdPartyProviders.length} providers`
                  )
                : pick('尚未配置第三方供应商', 'No third-party providers configured yet')}
              icon={Globe}
              tone={activeProviders > 0 ? 'emerald' : 'neutral'}
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

      <ApiWorkbenchOverviewSection
        pick={pick}
        workbenchStatusLabel={workbenchStatusLabel}
        workbenchTone={workbenchTone}
        userApiPersistenceWarning={userApiPersistenceWarning}
        isHydratingRuntimeUserApis={isHydratingRuntimeUserApis}
        snapshotHydrationHelper={snapshotHydrationHelper}
        attentionCount={attentionCount}
        connectedChannels={connectedChannels}
        officialActiveCount={officialSlots.filter((slot) => !slot.disabled).length}
        activeProviders={activeProviders}
        budgetCount={budgetCount}
        activeTab={activeTab}
      />

      <ApiWorkbenchStageSection
        pick={pick}
        showDiagnostics={showDiagnostics}
        onToggleDiagnostics={() => setShowDiagnostics((current) => !current)}
        stage={userApiWorkbenchStage}
        stageTone={stageTone}
        stageTitle={stageTitle}
        stageDescription={stageDescription}
        stageInteractionLabel={stageInteractionLabel}
        stageNextActionLabel={stageNextActionLabel}
        stageBannerStyle={stageBannerStyle}
        primaryActionIcon={stagePrimaryActionIcon}
        primaryActionTone={stagePrimaryActionTone}
        onPrimaryAction={handleStagePrimaryAction}
        primaryActionLoading={busy === 'cloud-refresh'}
        primaryActionTestId="api-workbench-primary-action"
        isUsingReadonlyProfileFallback={isUsingReadonlyProfileFallback}
        runtimeRouteCount={runtimeOfficialSlots.length + runtimeThirdPartyProviders.length}
      />

      {showDiagnostics ? (
        <ApiWorkbenchDiagnosticsSection
          pick={pick}
          diagnosticsActionDisabled={diagnosticsRefreshDisabled}
          onRefreshDiagnostics={() => void refreshApiHealth(true)}
          apiReachable={apiHealth?.reachable}
          apiErrorMessage={apiHealth?.errorMessage}
          persistenceWritable={Boolean(apiHealth?.persistence.userApiKeys)}
          isAuthenticated={isAuthenticated}
          hasReadonlySnapshot={hasReadonlySnapshot}
        />
      ) : null}

      <ApiWorkbenchPlatformSection
        pick={pick}
        onOpenPlatformAssistant={handleOpenPlatformAssistant}
      />

      <ApiWorkbenchCurrentViewSection
        pick={pick}
        activeTab={activeTab}
        onChangeTab={(value) => setActiveTab(value)}
        latencyCards={latencyCards}
        formatLatency={formatLatency}
      />

      <SegmentedControl
        options={[
          { value: 'official', label: pick('本地 API', 'Local APIs') },
          { value: 'third-party', label: pick('第三方供应商', 'Third-party providers') },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabType)}
      />

      {activeTab === 'official' ? (
        <SettingsSection
          title={pick('本地 API', 'Local APIs')}
          eyebrow={pick('本地直连', 'Local direct routes')}
          description={pick(
            '把你自己的直连 OpenAI 和 Gemini 配置收在这里。',
            'Manage your own direct OpenAI and Gemini routes here.'
          )}
          action={
            <SettingsActionButton style={{ display: 'none' }} icon={Plus} tone="primary" size="sm" disabled={userApiActionsDisabled} onClick={() => beginCreateOfficial()}>
              {pick('新增', 'Add')}
            </SettingsActionButton>
          }
        >
          {officialSlots.length === 0 ? (
            <EmptyState
              title={pick('当前还没有本地 API', 'No local APIs yet')}
              description={pick(
                '先添加一个本地 API，再让它进入调度。',
                'Add a local API first, then bring it into routing.'
              )}
              action={<SettingsActionButton data-testid="api-official-empty-create" icon={Plus} tone="primary" disabled={userApiActionsDisabled} onClick={beginCreateOfficial}>{pick('新增本地 API', 'Add local API')}</SettingsActionButton>}
            />
          ) : (
            <div className="settings-provider-grid">
              {officialSlots.map((slot) => {
                const mode = getMode(slot.budgetLimit, slot.tokenLimit);
                const status = getOfficialStatus(slot);
                const progress = getProgress(mode, mode === 'amount' ? slot.totalCost : slot.usedTokens || 0, slot.budgetLimit, slot.tokenLimit);
                const usageSummary = getOfficialUsageSummary(slot);
                const progressData = mode !== 'unlimited' ? { summary: usageSummary, percentage: progress } : undefined;

                const prioritizedMetrics: ConsoleEndpointCardMetric[] = [
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
                    cardRef={(node) => registerOfficialCardRef(slot.id, node)}
                    title={getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google')}
                    subtitle={slot.provider === 'OpenAI' ? pick('OpenAI 官方接口', 'OpenAI official endpoint') : pick('谷歌官方接口', 'Google official endpoint')}
                    meta={isUsingReadonlyProfileFallback
                      ? pick('只读回显：密钥已在服务端加密保存', 'Read-only view: secret is stored encrypted on the server')
                      : pick('Key 预览：', 'Key preview:') + maskSecret(slot.key)}
                    avatar={avatar}
                    status={status}
                    metrics={prioritizedMetrics}
                    progress={progressData}
                    error={slot.lastError}
                    className={returnHighlight?.officialId === slot.id ? 'settings-provider-card--return-focus' : ''}
                    actions={
                      <>
                        <SettingsActionButton icon={Edit3} size="sm" disabled={userApiActionsDisabled} onClick={() => startEditOfficial(slot)}>{pick('编辑', 'Edit')}</SettingsActionButton>
                        <SettingsActionButton icon={RefreshCw} size="sm" disabled={routeDiagnosticsActionDisabled} loading={busy === `official-check:${slot.id}`} onClick={() => void refreshOfficial(slot)}>{pick('刷新', 'Refresh')}</SettingsActionButton>
                        <SettingsActionButton icon={slot.disabled ? Play : Pause} size="sm" disabled={userApiActionsDisabled} onClick={() => void toggleOfficial(slot)}>
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
          action={
            <SettingsActionButton style={{ display: 'none' }} icon={Plus} tone="primary" size="sm" disabled={providerActionsDisabled} onClick={() => beginCreateProvider()}>
              {pick('新增', 'Add')}
            </SettingsActionButton>
          }
        >
          {thirdPartyProviders.length === 0 ? (
            <EmptyState
              title={pick('当前还没有第三方供应商', 'No third-party providers yet')}
              description={pick(
                '先添加一个供应商，再配置协议、预算和自动价格同步。',
                'Add a provider first, then configure its protocol, budget, and pricing sync.'
              )}
              action={<SettingsActionButton icon={Plus} tone="primary" disabled={providerActionsDisabled} onClick={beginCreateProvider}>{pick('新增供应商', 'New provider')}</SettingsActionButton>}
            />
          ) : (
            <div className="settings-provider-grid">
              {thirdPartyProviders.map((provider) => {
                const mode = getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited');
                const status = getProviderStatus(provider);
                const progress = getProgress(mode, mode === 'amount' ? provider.usage.totalCost : provider.usage.totalTokens, provider.budgetLimit, provider.tokenLimit);
                const usageSummary = getProviderUsageSummary(provider);
                const progressData = mode !== 'unlimited' ? { summary: usageSummary, percentage: progress } : undefined;

                const prioritizedMetrics: ConsoleEndpointCardMetric[] = [
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
                    cardRef={(node) => registerProviderCardRef(provider.id, node)}
                    title={provider.name}
                    subtitle={getProtocolLabel(provider.format)}
                    meta={<div className="text-[13px] text-[var(--text-secondary)]">{extractDomain(provider.baseUrl)}</div>}
                    avatar={avatar}
                    badges={provider.group ? <SettingsBadge tone="neutral">{provider.group}</SettingsBadge> : null}
                    status={status}
                    metrics={prioritizedMetrics}
                    progress={progressData}
                    error={provider.lastError || null}
                    footer={activityLine ? <div className="text-[13px] text-[var(--text-secondary)]">{activityLine}</div> : null}
                    actions={
                      <>
                        <SettingsActionButton icon={Edit3} size="sm" disabled={providerActionsDisabled} onClick={() => startEditProvider(provider)}>
                          {pick('编辑', 'Edit')}
                        </SettingsActionButton>
                        <SettingsActionButton icon={RefreshCw} size="sm" disabled={routeDiagnosticsActionDisabled} loading={busy === `provider-check:${provider.id}`} onClick={() => void refreshProvider(provider)}>
                          {pick('刷新', 'Refresh')}
                        </SettingsActionButton>
                        <SettingsActionButton icon={Wand2} size="sm" disabled={routeDiagnosticsActionDisabled} loading={busy === `provider-price:${provider.id}`} onClick={() => void syncPricing(provider)}>
                          {pick('自动获取价格', 'Sync pricing')}
                        </SettingsActionButton>
                        <SettingsActionButton icon={provider.isActive ? Pause : Play} size="sm" disabled={providerActionsDisabled} onClick={() => void toggleProvider(provider)}>
                          {provider.isActive ? pick('暂停', 'Pause') : pick('启用', 'Enable')}
                        </SettingsActionButton>
                      </>
                    }
                    className={[
                      returnHighlight?.providerId === provider.id ? 'settings-provider-card--return-focus' : '',
                      'settings-reference-card--soft',
                    ].filter(Boolean).join(' ')}
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
          title={pick('本地 API 编辑器', 'Local API editor')}
          eyebrow={
            editingOfficialId
              ? pick('编辑本地 API', 'Edit local API')
              : pick('新增本地 API', 'Add local API')
          }
          description={pick(
            '这里只保存当前本地 API；刷新和启用状态仍然在上面的卡片里操作。',
            'Save only updates this local API. Refresh and enable states stay on the cards above.'
          )}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCell
                label={pick('当前对象', 'Current object')}
                value={getOfficialDisplayName(officialForm.provider)}
                helper={editingOfficialId ? pick('正在编辑已有本地 API', 'Editing an existing local API') : pick('准备新增一条本地 API', 'Preparing a new local API')}
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
              {userApiEditorReadOnlyHelper ? (
                <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--state-warning-text)]" style={SETTINGS_WARNING_STYLE}>
                  {userApiEditorReadOnlyHelper}
                </div>
              ) : null}
              {browserDirectChecksDisabled ? (
                <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--state-warning-text)]" style={SETTINGS_WARNING_STYLE}>
                  {browserDirectChecksHelper}
                </div>
              ) : null}
              <SettingInput
                label={pick('接口名称', 'Endpoint name')}
                value={getOfficialDisplayName(officialForm.provider)}
                onChange={() => setOfficialForm((current) => ({ ...current, name: current.provider }))}
                placeholder={pick('会根据提供商自动固定', 'Automatically fixed by provider')}
                helper={pick('本地 API 名称固定按提供商显示；谷歌会跟随语言显示为“谷歌”或“Google”。', 'Local API names are fixed by provider; Google follows the current language.')}
                disabled={userApiEditorReadOnly}
              />
              <SettingSelect
                label={pick('服务商', 'Provider')}
                value={officialForm.provider}
                options={[
                  { value: 'Google', label: pick('谷歌', 'Google') },
                  { value: 'OpenAI', label: 'OpenAI' },
                ]}
                onChange={(value) => setOfficialForm((current) => ({ ...current, provider: value as OfficialProvider, name: value as OfficialProvider }))}
                disabled={userApiEditorReadOnly}
              />
            </div>

            <SettingInput
              label="API Key"
              value={officialForm.key}
              onChange={(value) => setOfficialForm((current) => ({ ...current, key: value }))}
              placeholder={pick('输入本地 API 的 API Key', 'Enter the local API key')}
              type="password"
              helper={pick('这里只保存当前接口使用的密钥，不会和刷新动作混用。', 'This field only saves the key for this endpoint and does not trigger refresh behavior.')}
              disabled={userApiEditorReadOnly}
            />

            <div>
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">{pick('预算策略', 'Budget rule')}</div>
              <SegmentedControlMulti options={[...UI_BUDGET_OPTIONS]} value={getModeOption(officialForm.mode)} onChange={(value) => setOfficialForm((current) => ({ ...current, mode: parseModeOption(value) }))} disabled={userApiEditorReadOnly} />
              {officialForm.mode !== 'unlimited' ? (
                <div className="mt-3">
                  <SettingInput
                    label={officialForm.mode === 'amount' ? pick('预算上限', 'Budget limit') : pick('词元上限', 'Token limit')}
                    value={officialForm.value}
                    onChange={(value) => setOfficialForm((current) => ({ ...current, value }))}
                    type="number"
                    placeholder={officialForm.mode === 'amount' ? pick('例如：100', 'For example: 100') : pick('例如：1000000', 'For example: 1000000')}
                    helper={officialForm.mode === 'amount' ? pick('金额预算按累计成本统计。', 'Amount budgets are tracked by cumulative cost.') : pick('词元上限按累计词元量统计。', 'Token limits are tracked by cumulative token usage.')}
                    disabled={userApiEditorReadOnly}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton disabled={userApiActionsDisabled} onClick={() => void saveOfficial()} loading={busy === `official-save:${officialForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingOfficialId ? pick('保存变更', 'Save changes') : pick('新增本地 API', 'Add local API')}
              </PrimaryButton>
              <SecondaryButton onClick={cancelEdit}>
                {editingOfficialId ? pick('取消', 'Cancel') : pick('清空', 'Reset')}
              </SecondaryButton>
              {editingOfficialId ? (
                <DangerButton disabled={userApiActionsDisabled} onClick={() => void deleteOfficial(editingOfficialId)} className="ml-auto">
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
              : pick('新增供应商', 'Create provider')
          }
          description={pick(
            '“自动获取价格”只负责同步价格数据，不负责保存当前表单；保存按钮才会提交供应商配置。',
            'Sync pricing only pulls pricing data. It does not save this form; only Save submits the provider configuration.'
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
              {providerEditorReadOnlyHelper ? (
                <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--state-warning-text)]" style={SETTINGS_WARNING_STYLE}>
                  {providerEditorReadOnlyHelper}
                </div>
              ) : null}
              {browserDirectChecksDisabled ? (
                <div className="rounded-[22px] border px-4 py-3 text-[13px] leading-6 text-[var(--state-warning-text)]" style={SETTINGS_WARNING_STYLE}>
                  {browserDirectChecksHelper}
                </div>
              ) : null}
              <SettingInput
                label={pick('供应商名称', 'Provider name')}
                value={providerForm.name}
                onChange={(value) => setProviderForm((current) => ({ ...current, name: value }))}
                placeholder={pick('例如：SiliconFlow', 'For example: SiliconFlow')}
                helper={pick('建议写成你在团队里常用的供应商名称。', 'Use the provider name your team already recognizes.')}
                disabled={providerEditorReadOnly}
              />
              <SettingInput
                label={pick('主题颜色', 'Theme color')}
                value={providerForm.color}
                onChange={(value) => setProviderForm((current) => ({ ...current, color: value }))}
                placeholder="#60A5FA"
                helper={pick('用于列表卡片的识别色，不影响真实请求。', 'Used as the list accent color and does not affect real requests.')}
                disabled={providerEditorReadOnly}
              />
            </div>

            <SettingInput
              label={pick('基础地址', 'Base URL')}
              value={providerForm.baseUrl}
              onChange={(value) => setProviderForm((current) => ({ ...current, baseUrl: value }))}
              placeholder="https://api.example.com/v1"
              helper={pick('通信检测、模型拉取和价格同步都会基于这里的地址。', 'Connectivity checks, model sync, and pricing sync all use this URL.')}
              disabled={providerEditorReadOnly}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label="API Key"
                value={providerForm.apiKey}
                onChange={(value) => setProviderForm((current) => ({ ...current, apiKey: value }))}
                placeholder={pick('输入供应商 API Key', 'Enter the provider API key')}
                type="password"
                disabled={providerEditorReadOnly}
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
                disabled={providerEditorReadOnly}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SettingInput
                label={pick('分组', 'Group')}
                value={providerForm.group}
                onChange={(value) => setProviderForm((current) => ({ ...current, group: value }))}
                placeholder={pick('例如：国内通道', 'For example: CN route')}
                helper={pick('用于组织和筛选供应商，不影响请求协议。', 'Used for organization and filtering, without affecting request behavior.')}
                disabled={providerEditorReadOnly}
              />
              <div className="rounded-[22px] border p-4" style={SETTINGS_ELEVATED_STYLE}>
                <SettingToggle
                  label={pick('参与调度', 'Include in routing')}
                  helper={pick('关闭后，供应商会保留配置，但不会再参与自动调度。', 'When disabled, the provider stays configured but is removed from automatic routing.')}
                  checked={providerForm.isActive}
                  onChange={(checked) => setProviderForm((current) => ({ ...current, isActive: checked }))}
                  disabled={providerEditorReadOnly}
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
                    disabled={routeDiagnosticsActionDisabled}
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
              <SegmentedControlMulti options={[...UI_BUDGET_OPTIONS]} value={getModeOption(providerForm.mode)} onChange={(value) => setProviderForm((current) => ({ ...current, mode: parseModeOption(value) }))} disabled={providerEditorReadOnly} />
              {providerForm.mode !== 'unlimited' ? (
                <div className="mt-3">
                  <SettingInput
                    label={providerForm.mode === 'amount' ? pick('预算上限', 'Budget limit') : pick('词元上限', 'Token limit')}
                    value={providerForm.value}
                    onChange={(value) => setProviderForm((current) => ({ ...current, value }))}
                    type="number"
                    placeholder={providerForm.mode === 'amount' ? pick('例如：100', 'For example: 100') : pick('例如：1000000', 'For example: 1000000')}
                    helper={providerForm.mode === 'amount' ? pick('金额预算按累计成本统计。', 'Amount budgets are tracked by cumulative cost.') : pick('词元上限按累计词元量统计。', 'Token limits are tracked by cumulative token usage.')}
                    disabled={providerEditorReadOnly}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <PrimaryButton disabled={providerActionsDisabled} onClick={() => void saveProvider()} loading={busy === `provider-save:${providerForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingProviderId ? pick('保存变更', 'Save changes') : pick('新增供应商', 'Create provider')}
              </PrimaryButton>
              <SecondaryButton onClick={cancelEdit}>
                {editingProviderId ? pick('取消', 'Cancel') : pick('清空', 'Reset')}
              </SecondaryButton>
              {editingProviderId ? (
                <DangerButton disabled={providerActionsDisabled} onClick={() => void deleteProvider(editingProviderId)} className="ml-auto">
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

const ApiSettingsView: React.FC<{ initialSupplier?: Supplier | null }> = ({ initialSupplier = null }) => {
  const inRouterContext = useInRouterContext();

  if (!inRouterContext) {
    return (
      <MemoryRouter initialEntries={[API_MANAGEMENT_HOME_PATH]}>
        <ApiSettingsViewInner initialSupplier={initialSupplier} />
      </MemoryRouter>
    );
  }

  return <ApiSettingsViewInner initialSupplier={initialSupplier} />;
};

export default ApiSettingsView;


