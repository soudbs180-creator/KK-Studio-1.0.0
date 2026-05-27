import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
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
import type { CapabilityRole, Provider } from '../../types';
import type { ApiProtocolFormat } from '../../services/api/apiConfig';
import type { ChannelConfig } from '../../services/api/channelConfig';
import {
  getCapabilityRouteAssignments,
  subscribeCapabilityRouteAssignments,
  upsertCapabilityRouteAssignment,
  isCustomRoutingEnabled,
  setCustomRoutingEnabled,
} from '../../services/api/capabilityRouteAssignments';
import { kkWebApiClient, shouldUseLegacyWebApiFallback } from '../../services/api/kkApiClient';
import {
  getKkApiServerHealth,
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
  getOcrServiceSettings,
  subscribeOcrServiceSettings,
  updateOcrServiceSettings,
} from '../../services/document/ocrServiceSettings';
import {
  buildApiManagementListState,
  readApiManagementListState,
  type ApiManagementTab,
} from './apiManagementRouteState';
import {
  ApiWorkbenchCapabilitySection,
  ApiWorkbenchCurrentViewSection,
  ApiWorkbenchDiagnosticsSection,
  ApiWorkbenchModelCenterSection,
  ApiWorkbenchOcrSection,
  ApiWorkbenchOverviewSection,
  ApiWorkbenchPlatformSection,
  ApiWorkbenchRoutePoolSection,
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
const suspiciousLocaleCharSet = new Set('\u9359\u95c2\u59ab\u7487\u6dc7\u93c2\u8930\u7f02\u95b9\u93c6\u95b2\u68f0\u6e1a\u6d98\u7c32\u9350\u5a34\u7039\u95ab\u7ed7\u9422\u6d63');

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

const officialDefaults: OfficialForm = {
  name: '',
  provider: 'Google',
  key: '',
  mode: 'unlimited',
  value: '',
};

const buildOfficialDraft = (provider: OfficialProvider = 'Google'): OfficialForm => ({
  ...officialDefaults,
  provider,
  name: provider,
});

const DEFAULT_PROVIDER_COLOR = 'var(--text-secondary)';

const providerDefaults: ProviderForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  format: 'auto',
  group: '',
  color: DEFAULT_PROVIDER_COLOR,
  isActive: true,
  mode: 'unlimited',
  value: '',
};

const READONLY_SECRET_PLACEHOLDER = 'sk-readonly-0000';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const USER_API_VIEW_SNAPSHOT_PREFIX = 'kk_user_api_view_snapshot:';
const USER_API_VIEW_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

const CAPABILITY_ROLE_META: Array<{
  role: CapabilityRole;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
}> = [
  {
    role: 'image_generation',
    titleZh: '图片生成',
    titleEn: 'Image generation',
    descriptionZh: '图片生成默认走这里的主链路与模型。',
    descriptionEn: 'Primary route and model for image generation.',
  },
  {
    role: 'ppt_generation',
    titleZh: 'PPT 生成',
    titleEn: 'PPT generation',
    descriptionZh: 'PPT 主题、页面描述和单页重生使用这条能力路由。',
    descriptionEn: 'Route used by PPT topic, page description, and per-page regeneration.',
  },
  {
    role: 'ecommerce_generation',
    titleZh: '电商生成',
    titleEn: 'Ecommerce generation',
    descriptionZh: '电商模块、组图与框架补图优先走这里。',
    descriptionEn: 'Preferred route for ecommerce cards, groups, and framework fills.',
  },
  {
    role: 'assistant',
    titleZh: 'AI 助手',
    titleEn: 'AI assistant',
    descriptionZh: '聊天侧或平台辅助 AI 统一读这里的主链路。',
    descriptionEn: 'Shared assistant route for chat and platform assistant AI.',
  },
  {
    role: 'prompt_optimizer',
    titleZh: '全局提示词优化',
    titleEn: 'Global prompt optimizer',
    descriptionZh: '关闭时保持本地 skills 提示词体系；开启后才调用 AI 优化。',
    descriptionEn: 'Disabled keeps local skills-based prompt shaping. Enable it to use AI optimization.',
  },
  {
    role: 'ocr_document',
    titleZh: 'OCR 文档处理',
    titleEn: 'OCR document processing',
    descriptionZh: '保留能力占位，真实密钥和语言配置在下方 OCR 卡。',
    descriptionEn: 'Reserved capability role. The actual OCR key and language live below.',
  },
];

const API_MANAGEMENT_HOME_PATH = '/settings/api-management';
const API_MANAGEMENT_OFFICIAL_PREFIX = '/settings/api-management/official/';
const API_MANAGEMENT_PROVIDER_PREFIX = '/settings/api-management/provider/';
const ROUTE_NEW_ITEM = 'new';

interface ProviderPreset {
  name: string;
  baseUrl: string;
  format: ApiProtocolFormat;
  color: string;
  modelId?: string;
  kind?: 'provider' | 'relay';
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'Google AI Studio', baseUrl: 'https://generativelanguage.googleapis.com', format: 'gemini', color: '#4285f4', modelId: 'gemini-2.5-flash' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', format: 'openai', color: '#10a37f', modelId: 'gpt-4o' },
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', format: 'openai', color: '#0054ff', modelId: 'deepseek-chat' },
  { name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', format: 'openai', color: '#ff5a00', modelId: 'Qwen/Qwen3-235B-A22B-Instruct-2507' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', format: 'openai', color: '#7c3aed', modelId: 'openai/gpt-4o', kind: 'relay' },
  { name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', format: 'claude', color: '#d97706', modelId: 'claude-3-5-sonnet-latest' },
];

const buildOfficialEditorPath = (officialId?: string | null) =>
  officialId
    ? `/settings/api-management/official/${encodeURIComponent(officialId)}`
    : '/settings/api-management/official/new';

const buildProviderEditorPath = (providerId?: string | null) =>
  providerId
    ? `/settings/api-management/provider/${encodeURIComponent(providerId)}`
    : '/settings/api-management/provider/new';

const buildDefaultProviderPricingEndpoint = (baseUrl?: string) => {
  const normalized = String(baseUrl || '').trim().replace(/\/+$/, '');
  return normalized ? `${normalized}/models` : '';
};

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

function getRouteLabel(channel: ChannelConfig) {
  return `${channel.name} · ${channel.providerFamily}`;
}

function normalizeOfficialProviderChoice(value: unknown): OfficialProvider {
  return normalizeOfficialProvider(value) === 'OpenAI' ? 'OpenAI' : 'Google';
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
    providerColor: normalizeString(raw.providerColor ?? raw.color) || DEFAULT_PROVIDER_COLOR,
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
  color: provider.providerColor || DEFAULT_PROVIDER_COLOR,
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
  const [capabilityAssignments, setCapabilityAssignments] = useState(() => getCapabilityRouteAssignments());
  const [ocrSettings, setOcrSettings] = useState(() => getOcrServiceSettings());
  const initialUserApiViewSnapshot = !isTempUser ? readUserApiViewSnapshot(user?.id || null) : null;
  const [activeTab, setActiveTab] = useState<TabType>('official');
  const [officialForm, setOfficialForm] = useState<OfficialForm>(officialDefaults);
  const [providerForm, setProviderForm] = useState<ProviderForm>(providerDefaults);
  const [editingOfficialId, setEditingOfficialId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdvancedWorkbench, setShowAdvancedWorkbench] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [providerPricingEndpointDraft, setProviderPricingEndpointDraft] = useState('');
  const [showPricingEndpointOverride, setShowPricingEndpointOverride] = useState(false);
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

  // 1. 简体中文注释：第三方供应商 Base URL 与协议冲突诊断
  const routingConflictWarning = useMemo(() => {
    const url = providerForm.baseUrl.trim().toLowerCase();
    const format = providerForm.format;

    if (!url) return '';

    if (url.includes('googleapis.com')) {
      if (format !== 'gemini' && format !== 'auto') {
        return pick(
          '⚠️ 检测到 Google Gemini 官方域名，但通信协议选择为非 Gemini 协议，可能会导致请求 404，建议改选为“Gemini 协议”。',
          '⚠️ Google Gemini official URL detected, but non-Gemini protocol chosen. This may result in 404 errors. We recommend selecting "Gemini protocol".'
        );
      }
    }

    if (url.includes('api.openai.com')) {
      if (format === 'gemini' || format === 'claude') {
        return pick(
          '⚠️ 检测到 OpenAI 官方域名，但通信协议选择为了非 OpenAI 协议，可能导致密钥校验失败。',
          '⚠️ OpenAI official URL detected, but non-OpenAI protocol chosen. This may cause authentication failures.'
        );
      }
    }

    if (url.includes('api.anthropic.com')) {
      if (format !== 'claude' && format !== 'auto') {
        return pick(
          '⚠️ 检测到 Anthropic Claude 官方域名，但通信协议未选择为 Claude 协议，可能会导致通信格式错乱。',
          '⚠️ Anthropic Claude official URL detected, but non-Claude protocol chosen. This may lead to communication format mismatches.'
        );
      }
    }

    return '';
  }, [providerForm.baseUrl, providerForm.format, pick]);

  // 2. 简体中文注释：智能自动纠正第三方协议
  const autoFixProviderFormat = useCallback(() => {
    const url = providerForm.baseUrl.trim().toLowerCase();
    let targetFormat: ApiProtocolFormat = 'auto';
    if (url.includes('googleapis.com')) targetFormat = 'gemini';
    else if (url.includes('api.openai.com')) targetFormat = 'openai';
    else if (url.includes('api.anthropic.com')) targetFormat = 'claude';
    
    if (targetFormat !== 'auto' && providerForm.format !== targetFormat) {
      setProviderForm(current => ({ ...current, format: targetFormat }));
      notify.success(
        pick('协议已自动修正', 'Protocol Auto-fixed'),
        pick(`根据 Base URL，通信协议已自动修正为 ${targetFormat === 'openai' ? 'OpenAI' : targetFormat === 'gemini' ? 'Gemini' : 'Claude'} 协议。`, `Based on Base URL, the protocol format was auto-fixed to ${targetFormat}.`)
      );
    }
  }, [providerForm.baseUrl, providerForm.format, pick]);

  // 3. 简体中文注释：官方接口密钥格式诊断
  const officialKeyDiagnostics = useMemo(() => {
    const key = officialForm.key.trim();
    if (!key || isReadonlySecretPlaceholder(key)) return '';

    if (officialForm.provider === 'Google') {
      if (/\s/.test(officialForm.key)) {
        return pick(
          '⚠️ 密钥中包含空格或换行，可能会导致接口认证失败，请检查。',
          '⚠️ The key contains spaces or newlines, which may cause authentication failure. Please check.'
        );
      }
      if (!key.startsWith('AIzaSy')) {
        return pick(
          '⚠️ Google AI Studio 密钥通常以 "AIzaSy" 开头，请确保您输入了正确的 API 密钥。',
          '⚠️ Google AI Studio keys typically start with "AIzaSy". Please ensure you entered the correct API key.'
        );
      }
    }

    if (officialForm.provider === 'OpenAI') {
      if (/\s/.test(officialForm.key)) {
        return pick(
          '⚠️ 密钥中包含空格或换行，可能会导致接口认证失败，请检查。',
          '⚠️ The key contains spaces or newlines, which may cause authentication failure. Please check.'
        );
      }
      if (!key.startsWith('sk-')) {
        return pick(
          '⚠️ OpenAI 官方密钥通常以 "sk-" 开头，请确保您输入了正确的 API 密钥。',
          '⚠️ OpenAI keys typically start with "sk-". Please ensure you entered the correct API key.'
        );
      }
    }

    return '';
  }, [officialForm.key, officialForm.provider, pick]);

  const runtimeOfficialSlots = useMemo(() => slots.filter(isOfficialSlot), [slots]);
  const runtimeThirdPartyProviders = useMemo(() => [...providers].sort((a, b) => b.updatedAt - a.updatedAt), [providers]);
  const isUserApiPersistenceDegraded = isUserApiPersistenceDegradedFromHealth(apiHealth);
  const hasSessionlessLocalWorkbench = isTempUser || shouldUseLegacyWebApiFallback();
  const canUseSessionlessLocalApiBridge =
    hasSessionlessLocalWorkbench
    && apiHealth?.reachable === true
    && !isUserApiPersistenceDegraded;
  const authenticatedUserId = !isTempUser ? (user?.id || keyManager.getUserId()) : null;
  const hasAuthenticatedUser = Boolean(authenticatedUserId);
  const canUseSessionlessLocalDraftStorage = false;
  const canMutateSessionlessLocalWorkbench = hasSessionlessLocalWorkbench;
  const hasWorkbenchAccess = hasAuthenticatedUser || hasSessionlessLocalWorkbench;
  const hasReadonlySnapshot = readonlyOfficialSlots.length > 0 || readonlyProviders.length > 0;
  const userApiViewState = resolveUserApiViewState({
    hasReadonlySnapshot,
    hasSessionlessWorkbenchAccess: hasSessionlessLocalWorkbench,
    isApiReachable: apiHealth?.reachable,
    isAuthenticated: hasAuthenticatedUser,
    isPersistenceDegraded: isUserApiPersistenceDegraded,
    runtimeOfficialCount: runtimeOfficialSlots.length,
    runtimeProviderCount: runtimeThirdPartyProviders.length,
    sessionlessWorkbenchActionsEnabled: canMutateSessionlessLocalWorkbench,
  });
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
  const routePresetOfficialProvider = useMemo(() => {
    if (!isRecord(location.state) || !('presetOfficialProvider' in location.state)) {
      return 'Google' as OfficialProvider;
    }

    return normalizeOfficialProviderChoice(location.state.presetOfficialProvider);
  }, [location.state]);
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
      ? pick('本地 API 内存模式', 'Local API memory mode')
      : connectedChannels > 0
        ? pick(`已接入 ${connectedChannels} 条链路`, `${connectedChannels} routes connected`)
        : pick('尚未接入链路', 'No routes connected yet');
  const userApiPersistenceWarning = useMemo(() => {
    if (!apiHealth) {
      return null;
    }

    if (!apiHealth.reachable) {
      return pick(
        '本地 API 当前离线。为避免密钥落到浏览器缓存，请先恢复服务后再编辑。',
        'The local API is offline. Restore it before editing so secrets are not cached in the browser.',
      );
    }

    if (!apiHealth.persistence.userApiKeys || !apiHealth.persistence.keyManager) {
      return pick(
        '本地 API 处于内存模式。请先启用本地文件或后端持久化，再编辑 API 设置。',
        'The local API is running in memory mode. Enable local-file or backend persistence before editing API settings.',
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
        '恢复本地 API 后，会继续完成检测和同步。',
        'Checks and sync resume after the local API comes back.',
      );
    }

    if (!apiHealth.config.hasPostgresConfig) {
      return pick(
        '补全服务端持久化后，可恢复完整同步能力。',
        'Restore server-side persistence to regain full sync behavior.',
      );
    }

    return pick(
      '服务恢复后，当前状态会继续自动对齐。',
      'State will realign automatically after recovery.',
    );
  }, [apiHealth, pick]);
  const snapshotHydrationHelper = pick(
    '正在同步最新配置，请稍候再编辑。',
    'Syncing the latest configuration. Wait a moment before editing.',
  );
  const userApiActionsDisabled = userApiViewState.userApiActionsDisabled;
  const providerActionsDisabled = userApiViewState.providerActionsDisabled;
  const userApiEditorDisabled = userApiViewState.userApiEditorDisabled;
  const userApiEditorReadOnly = userApiEditorDisabled;
  const providerEditorReadOnly = userApiViewState.providerEditorReadOnly;
  const backendUnavailableHelper = apiHealth?.reachable === false
    ? pick(
        '本地 API 当前离线。请先恢复服务，再继续编辑。',
        'The local API is offline. Restore it before editing.',
      )
    : null;
  const sessionlessLocalPersistenceHelper = hasSessionlessLocalWorkbench
    && apiHealth
    && !canMutateSessionlessLocalWorkbench
    ? pick(
        '本地 BYOK 持久化还未就绪。请启动本地 API，并启用可写的本地文件或后端持久化后再编辑。',
        'Local BYOK persistence is not ready yet. Start the local API and enable writable local-file or backend-backed user API storage before editing.',
      )
    : null;
  const sessionlessLocalDraftHelper = canUseSessionlessLocalDraftStorage
    ? pick(
        '本地 API 当前离线。请恢复后端持久化后再编辑。',
        'The local API is offline. Restore backend persistence before editing.',
      )
    : null;
  const userApiActionHelper = (canUseSessionlessLocalDraftStorage ? sessionlessLocalDraftHelper : backendUnavailableHelper) ?? (!hasAuthenticatedUser
    ? hasSessionlessLocalWorkbench
      ? sessionlessLocalPersistenceHelper
      : pick(
          'Sign in before managing BYOK routes. Anonymous key storage and direct provider calls are disabled in the frontend.',
          'Sign in before managing BYOK routes. Anonymous key storage and direct provider calls are disabled in the frontend.',
        )
    : isHydratingRuntimeUserApis
      ? snapshotHydrationHelper
      : null);
  const providerActionHelper = userApiActionHelper;
  const userApiEditorReadOnlyHelper = userApiEditorReadOnly
    ? userApiActionHelper
    : canUseSessionlessLocalDraftStorage
      ? sessionlessLocalDraftHelper
    : apiHealth?.reachable === false
      ? backendUnavailableHelper
      : isUserApiPersistenceDegraded
      ? pick(
          '本地 API 持久化未就绪。请恢复本地文件或后端存储后再保存密钥。',
          'Local API persistence is not ready. Restore local-file or backend storage before saving secrets.',
        )
      : null;
  const providerEditorReadOnlyHelper = providerEditorReadOnly
    ? providerActionHelper
    : canUseSessionlessLocalDraftStorage
      ? sessionlessLocalDraftHelper
    : apiHealth?.reachable === false
      ? backendUnavailableHelper
      : isUserApiPersistenceDegraded
      ? pick(
          '本地 API 持久化未就绪。请恢复本地文件或后端存储后再保存供应商。',
          'Local API persistence is not ready. Restore local-file or backend storage before saving providers.',
        )
      : null;
  const browserDirectChecksDisabled = false;
  const browserDirectChecksHelper = pick(
    '浏览器直连检测已关闭。请先保存到账号，再通过本地后端或云端安全代理链路使用。',
    'Browser-side diagnostics are disabled. Save the route to your account and use the local backend or secure cloud proxy path instead.',
  );
  const useCloudBackedUserApiWrites =
    hasAuthenticatedUser
    && !isTempUser
    && (isUserApiPersistenceDegraded || apiHealth?.reachable === false);
  const shouldUseDirectUserApiRecordWrites =
    useCloudBackedUserApiWrites
    || shouldUseReadonlySnapshotForDisplay
    || canUseSessionlessLocalApiBridge;
  const canReusePersistedOfficialSecret = Boolean(editingOfficialId && selectedOfficialSlot);
  const canReusePersistedProviderSecret = Boolean(editingProviderId && selectedProvider);
  const diagnosticsAvailability = resolveApiWorkbenchDiagnosticsAvailability({
    hasWorkbenchAccess,
    isApiReachable: apiHealth?.reachable,
  });
  const diagnosticsRefreshDisabled = diagnosticsAvailability.refreshDisabled;
  const routeDiagnosticsActionDisabled = diagnosticsAvailability.routeActionsDisabled;
  const canMutateWorkbenchActions = hasAuthenticatedUser || canMutateSessionlessLocalWorkbench;
  const ensureUserApiActionsAllowed = (): boolean => {
    if (!canMutateWorkbenchActions) {
      notify.warning(
        hasSessionlessLocalWorkbench
          ? pick('Local API not ready', 'Local API not ready')
          : pick('Sign in required', 'Sign in required'),
        userApiActionHelper || snapshotHydrationHelper,
      );
      return false;
    }

    if (apiHealth?.reachable === false && !shouldUseDirectUserApiRecordWrites && !canUseSessionlessLocalDraftStorage && !isTempUser) {
      notify.warning(pick('Local API unavailable', 'Local API unavailable'), userApiActionHelper || userApiPersistenceHelper || snapshotHydrationHelper);
      return false;
    }

    if (hasReadonlySnapshot) {
      return true;
    }

    if (isHydratingRuntimeUserApis) {
      notify.warning(pick('Still syncing', 'Still syncing'), snapshotHydrationHelper);
      return false;
    }

    return true;
  };
  const ensureProviderActionsAllowed = (): boolean => {
    if (!canMutateWorkbenchActions) {
      notify.warning(
        hasSessionlessLocalWorkbench
          ? pick('Local API not ready', 'Local API not ready')
          : pick('Sign in required', 'Sign in required'),
        providerActionHelper || snapshotHydrationHelper,
      );
      return false;
    }

    if (apiHealth?.reachable === false && !shouldUseDirectUserApiRecordWrites && !canUseSessionlessLocalDraftStorage && !isTempUser) {
      notify.warning(pick('Local API unavailable', 'Local API unavailable'), providerActionHelper || userApiPersistenceHelper || snapshotHydrationHelper);
      return false;
    }

    if (hasReadonlySnapshot) {
      return true;
    }

    if (isHydratingRuntimeUserApis) {
      notify.warning(pick('Still syncing', 'Still syncing'), snapshotHydrationHelper);
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

  const allChannelConfigs = useMemo(
    () => keyManager.getChannelConfigs({ includeDisabled: true, includeProviders: true }),
    [slots, providers],
  );

  const capabilityRouteOptions = useMemo(
    () => [
      { value: '', label: pick('自动选择', 'Automatic') },
      ...allChannelConfigs.map((channel) => ({
        value: channel.id,
        label: getRouteLabel(channel),
      })),
    ],
    [allChannelConfigs, pick],
  );

  const getRouteModelOptions = useCallback((routeId: string, role: CapabilityRole) => {
    if (role === 'ocr_document') {
      return [{ value: '', label: pick('由 OCR 服务卡管理', 'Managed by OCR service') }];
    }

    const routeIdKey = String(routeId || '').trim();
    if (!routeIdKey) {
      return [
        { value: '', label: pick('自动选择', 'Automatic') },
        ...keyManager.getGlobalModelList().map((model) => ({
          value: model.id,
          label: model.name || model.id,
        })),
      ];
    }

    const slot = keyManager.getKey(routeIdKey);
    if (slot) {
      const linkedProvider = keyManager.getProviderForKeySlot(routeIdKey);
      const models = resolveEffectiveProviderModels({
        provider: linkedProvider?.name || slot.provider,
        baseUrl: linkedProvider?.baseUrl || slot.baseUrl,
        format: linkedProvider?.format || slot.format,
        models: linkedProvider?.models || slot.supportedModels,
      }).map((modelId) => ({
        value: modelId,
        label: modelId,
      }));

      return [{ value: '', label: pick('自动选择', 'Automatic') }, ...models];
    }

    const provider = keyManager.getProvider(routeIdKey);
    const providerModels = (provider?.models || []).map((modelId) => ({
      value: modelId,
      label: modelId,
    }));
    return [{ value: '', label: pick('自动选择', 'Automatic') }, ...providerModels];
  }, [pick]);

  const routePoolItems = useMemo(() => (
    allChannelConfigs.map((channel) => {
      const slot = keyManager.getKey(channel.id);
      const provider = keyManager.getProvider(channel.id);
      const statusLabel = slot
        ? (slot.disabled
            ? pick('已停用', 'Paused')
            : slot.status === 'invalid'
              ? pick('异常', 'Error')
              : slot.status === 'rate_limited'
                ? pick('限流', 'Rate limited')
                : pick('可用', 'Ready'))
        : (provider
            ? (!provider.isActive
                ? pick('已停用', 'Paused')
                : provider.status === 'error'
                  ? pick('异常', 'Error')
                  : provider.status === 'checking'
                    ? pick('检测中', 'Checking')
                    : pick('可用', 'Ready'))
            : pick('可用', 'Ready'));
      const billingSummary = slot
        ? (slot.tokenLimit && slot.tokenLimit > 0
            ? `${pick('词元上限', 'Token limit')} ${slot.tokenLimit}`
            : slot.budgetLimit > 0
              ? `${pick('预算', 'Budget')} ${slot.budgetLimit}`
              : pick('不限额', 'Unlimited'))
        : (provider?.customCostMode === 'tokens'
            ? `${pick('词元上限', 'Token limit')} ${provider.customCostValue || provider.tokenLimit || 0}`
            : provider?.customCostMode === 'amount'
              ? `${pick('预算', 'Budget')} ${provider.customCostValue || provider.budgetLimit || 0}`
              : pick('不限额', 'Unlimited'));

      return {
        id: channel.id,
        name: channel.name,
        routeKind: slot?.type === 'official'
          ? pick('官方直连', 'Official direct')
          : slot
            ? pick('中转链路', 'Proxy route')
            : pick('供应商池', 'Provider pool'),
        protocolLabel: channel.protocolHint || 'auto',
        statusLabel,
        modelSummary: channel.capabilities.modelDiscovery
          ? pick(`自动获取模型 · ${channel.supportedModels.length} 个候选`, `Model discovery · ${channel.supportedModels.length} candidates`)
          : pick(`手动模型 · ${channel.supportedModels.length} 个候选`, `Manual models · ${channel.supportedModels.length} candidates`),
        billingSummary,
        baseUrlLabel: slot?.type === 'official' && !channel.baseUrl
          ? pick('官方 Google / OpenAI 默认地址', 'Official Google / OpenAI default endpoint')
          : String(channel.baseUrl || '').trim() || pick('由运行时补全', 'Resolved by runtime'),
      };
    })
  ), [allChannelConfigs, pick]);

  const updateCapabilityAssignment = useCallback((
    role: CapabilityRole,
    patch: Partial<{ enabled: boolean; primaryRouteId: string; primaryModelId: string; fallbackRouteId: string }>,
  ) => {
    upsertCapabilityRouteAssignment(role, patch);
    setCapabilityAssignments(getCapabilityRouteAssignments());
  }, []);

  const capabilityCards = useMemo(() => (
    CAPABILITY_ROLE_META.map((meta) => {
      const assignment = capabilityAssignments.find((item) => item.role === meta.role);
      return {
        role: meta.role,
        title: pick(meta.titleZh, meta.titleEn),
        description: pick(meta.descriptionZh, meta.descriptionEn),
        enabled: assignment?.enabled !== false,
        primaryRouteId: assignment?.primaryRouteId || '',
        primaryModelId: assignment?.primaryModelId || '',
        fallbackRouteId: assignment?.fallbackRouteId || '',
        routeOptions: capabilityRouteOptions,
        modelOptions: getRouteModelOptions(assignment?.primaryRouteId || '', meta.role),
        onEnabledChange: (enabled: boolean) => updateCapabilityAssignment(meta.role, { enabled }),
        onPrimaryRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { primaryRouteId: value }),
        onPrimaryModelChange: (value: string) => updateCapabilityAssignment(meta.role, { primaryModelId: value }),
        onFallbackRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { fallbackRouteId: value }),
      };
    })
  ), [capabilityAssignments, capabilityRouteOptions, getRouteModelOptions, pick, updateCapabilityAssignment]);

  const ocrKeySourceLabel = useMemo(() => {
    if (ocrSettings.keySource === 'environment') {
      return pick('服务端环境变量', 'Server environment');
    }
    return pick('缺少密钥', 'Missing key');
  }, [ocrSettings.keySource, pick]);

  const ocrHealthLabel = useMemo(() => (
    ocrSettings.healthState === 'configured'
      ? pick('已配置', 'Configured')
      : ocrSettings.healthState === 'missing_key'
        ? pick('缺少密钥', 'Missing key')
        : pick('待检测', 'Unknown')
  ), [ocrSettings.healthState, pick]);

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
    if (hasAuthenticatedUser) {
      await refreshCloudData(true);
      return;
    }

    await refreshApiHealth(true);
    await refreshReadonlyProfileFallback();
  }, [hasAuthenticatedUser, refreshApiHealth, refreshCloudData, refreshReadonlyProfileFallback]);

  useEffect(() => {
    refresh();
    void refreshApiHealth();
    void refreshCloudData(true);
    return keyManager.subscribe(refresh);
  }, [refresh, refreshApiHealth, refreshCloudData]);

  useEffect(() => {
    setCapabilityAssignments(getCapabilityRouteAssignments());
    return subscribeCapabilityRouteAssignments(() => {
      setCapabilityAssignments(getCapabilityRouteAssignments());
    });
  }, []);

  useEffect(() => {
    setOcrSettings(getOcrServiceSettings());
    return subscribeOcrServiceSettings(() => {
      setOcrSettings(getOcrServiceSettings());
    });
  }, []);

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
    if (hasAuthenticatedUser || !hasSessionlessLocalWorkbench) {
      return;
    }

    if (runtimeOfficialSlots.length > 0 || runtimeThirdPartyProviders.length > 0) {
      return;
    }

    void refreshReadonlyProfileFallback();
  }, [
    hasSessionlessLocalWorkbench,
    hasAuthenticatedUser,
    refreshReadonlyProfileFallback,
    runtimeOfficialSlots.length,
    runtimeThirdPartyProviders.length,
  ]);

  useEffect(() => {
    if (isOfficialEditorRoute) {
      setActiveTab('official');

      if (isCreatingOfficial) {
        setEditingOfficialId(null);
        setEditingProviderId(null);
        setOfficialForm(buildOfficialDraft(routePresetOfficialProvider));
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
        setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(initialSupplier?.baseUrl));
        setShowPricingEndpointOverride(false);
        return;
      }

      if (selectedProvider) {
        setEditingProviderId(selectedProvider.id);
        setEditingOfficialId(null);
        setProviderForm(toProviderForm(selectedProvider));
        setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(selectedProvider.baseUrl));
        setShowPricingEndpointOverride(false);
        return;
      }

      if (initialSupplier) {
        setEditingProviderId(null);
        setEditingOfficialId(null);
        setProviderForm(toProviderFormFromSupplier(initialSupplier));
        setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(initialSupplier.baseUrl));
        setShowPricingEndpointOverride(false);
      }
      return;
    }

    if (location.pathname === API_MANAGEMENT_HOME_PATH) {
      setEditingOfficialId(null);
      setEditingProviderId(null);
      setOfficialForm(officialDefaults);
      setProviderForm(providerDefaults);
      setProviderPricingEndpointDraft('');
      setShowPricingEndpointOverride(false);
    }
  }, [
    initialSupplier,
    isCreatingOfficial,
    isCreatingProvider,
    isOfficialEditorRoute,
    isProviderEditorRoute,
    location.pathname,
    routePresetOfficialProvider,
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

    const targetId = activeTab === 'official'
        ? returnHighlight?.officialId
        : returnHighlight?.providerId;
    if (!targetId) {
      return;
    }

    const registry = activeTab === 'official'
        ? officialCardRegistryRef.current
        : providerCardRegistryRef.current;
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

  const beginCreateOfficial = (provider: OfficialProvider = 'Google') => {
    if (!ensureUserApiActionsAllowed()) {
      return;
    }

    setActiveTab('official');
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(buildOfficialDraft(provider));
    navigate(buildOfficialEditorPath(), {
      state: {
        presetOfficialProvider: provider,
      },
    });
  };
  const handleCreateOfficialAction = () => {
    beginCreateOfficial();
  };

  const beginCreateProvider = () => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    setActiveTab('third-party');
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setProviderForm(initialSupplier ? toProviderFormFromSupplier(initialSupplier) : providerDefaults);
    setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(initialSupplier?.baseUrl));
    setShowPricingEndpointOverride(false);
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
    setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(provider.baseUrl));
    setShowPricingEndpointOverride(false);
    navigate(buildProviderEditorPath(provider.id));
  };

  const cancelEdit = () => {
    setEditingOfficialId(null);
    setEditingProviderId(null);
    setOfficialForm(officialDefaults);
    setProviderForm(providerDefaults);
    setProviderPricingEndpointDraft('');
    setShowPricingEndpointOverride(false);
    if (isOfficialEditorRoute) {
      returnToApiManagementList('official', { highlightOfficialId: editingOfficialId });
      return;
    }

    returnToApiManagementList('third-party', { highlightProviderId: editingProviderId });
  };

  const resetOfficialDraft = () => {
    setOfficialForm(buildOfficialDraft(officialForm.provider));
  };

  const resetProviderDraft = () => {
    setProviderForm(providerDefaults);
    setProviderPricingEndpointDraft('');
    setShowPricingEndpointOverride(false);
  };

  const officialEditorValidationMessage = (() => {
    if (userApiEditorReadOnly) {
      return '';
    }

    const normalizedKey = officialForm.key.trim();
    const nextKeyValue = normalizedKey || (canReusePersistedOfficialSecret ? READONLY_SECRET_PLACEHOLDER : '');
    if (!nextKeyValue) {
      return pick('先填写 API Key 才能保存。', 'Enter the API key before saving.');
    }

    if (isReadonlySecretPlaceholder(officialForm.key) && !canReusePersistedOfficialSecret) {
      return pick('请重新输入真实 API Key。', 'Re-enter the real API key before saving.');
    }

    if (officialForm.mode !== 'unlimited' && !positive(officialForm.value)) {
      return pick('预算值需要大于 0。', 'Budget or token limit must be greater than 0.');
    }

    return '';
  })();

  const providerEditorValidationMessage = (() => {
    if (providerEditorReadOnly) {
      return '';
    }

    const normalizedApiKey = providerForm.apiKey.trim();
    const nextApiKeyValue = normalizedApiKey || (canReusePersistedProviderSecret ? READONLY_SECRET_PLACEHOLDER : '');
    if (!providerForm.name.trim() || !providerForm.baseUrl.trim() || !nextApiKeyValue) {
      return pick('补全名称、Base URL 和 API Key 后才能保存。', 'Complete the name, base URL, and API key before saving.');
    }

    if (isReadonlySecretPlaceholder(providerForm.apiKey) && !canReusePersistedProviderSecret) {
      return pick('请重新输入真实 API Key。', 'Re-enter the real API key before saving.');
    }

    if (providerForm.mode !== 'unlimited' && !positive(providerForm.value)) {
      return pick('预算值需要大于 0。', 'Budget or token limit must be greater than 0.');
    }

    return '';
  })();

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
      if (shouldUseDirectUserApiRecordWrites) {
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
      if (shouldUseDirectUserApiRecordWrites) {
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
      if (shouldUseDirectUserApiRecordWrites) {
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
      if (shouldUseDirectUserApiRecordWrites) {
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
      if (shouldUseDirectUserApiRecordWrites) {
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
      if (shouldUseDirectUserApiRecordWrites) {
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

  const syncPricing = async (provider: ThirdPartyProvider, endpointUrlOverride?: string) => {
    if (!ensureBrowserDirectDiagnosticsAllowed()) {
      return;
    }

    await run(`provider-price:${provider.id}`, async () => {
      const trimmedEndpointUrl = String(endpointUrlOverride || '').trim();
      const response = await kkWebApiClient.syncUserRoutePricing(
        provider.id,
        trimmedEndpointUrl ? { endpointUrl: trimmedEndpointUrl } : undefined,
      );
      if (!response.success) {
        setShowPricingEndpointOverride(true);
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
        if (trimmedEndpointUrl) {
          setProviderPricingEndpointDraft(trimmedEndpointUrl);
        }
      } else {
        setShowPricingEndpointOverride(true);
        setProviderPricingEndpointDraft((current) => (
          current.trim()
            || String(result.endpointUrl || '').trim()
            || buildDefaultProviderPricingEndpoint(provider.baseUrl)
        ));
        notify.warning(
          pick('同步失败', 'Sync failed'),
          result.message || pick('当前没有可用的价格数据返回。', 'No pricing data is available right now.'),
        );
      }
    });
  };

  const confirmModelCenterRouteDelete = useCallback((title: string) => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.confirm(
      pick(`确认删除“${title}”吗？删除后需要重新添加 API Key 才能恢复。`, `Delete "${title}"? You will need to add the API key again to restore it.`),
    );
  }, [pick]);

  const modelCenterRoutes = useMemo(() => {
    const officialItems = officialSlots.map((slot) => {
      const status = getOfficialStatus(slot);
      const mode = getMode(slot.budgetLimit, slot.tokenLimit);
      const effectiveModels = resolveEffectiveProviderModels({
        provider: slot.provider,
        baseUrl: slot.baseUrl,
        format: slot.format,
        models: slot.supportedModels,
      });

      return {
        id: slot.id,
        kind: 'official' as const,
        title: getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google'),
        subtitle: slot.provider === 'OpenAI' ? 'OpenAI Direct' : 'Gemini Direct',
        accentColor: slot.provider === 'OpenAI' ? '#10a37f' : '#4285f4',
        statusLabel: status.label,
        statusVariant: status.status,
        protocolLabel: getProtocolLabel(slot.format),
        modelCountLabel: String(effectiveModels.length || slot.supportedModels?.length || 0),
        budgetLabel: getLimitValueLabel(mode, mode === 'amount' ? slot.budgetLimit : slot.tokenLimit),
        usageLabel: getOfficialUsageSummary(slot),
        latencyLabel: formatLatency(slot.lastResponseTime ?? slot.avgResponseTime ?? null),
        isPaused: Boolean(slot.disabled),
        isHighlighted: returnHighlight?.officialId === slot.id,
        cardRef: (node: HTMLElement | null) => registerOfficialCardRef(slot.id, node),
        onSelect: () => startEditOfficial(slot),
        onToggle: () => void toggleOfficial(slot),
        onRefresh: () => void refreshOfficial(slot),
        onDelete: () => {
          const title = getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google');
          if (confirmModelCenterRouteDelete(title)) {
            void deleteOfficial(slot.id);
          }
        },
        toggleDisabled: userApiActionsDisabled,
        refreshDisabled: routeDiagnosticsActionDisabled,
        deleteDisabled: userApiActionsDisabled,
        refreshLoading: busy === `official-check:${slot.id}`,
      };
    });

    const providerItems = thirdPartyProviders.map((provider) => {
      const status = getProviderStatus(provider);
      const mode = getMode(provider.budgetLimit, provider.tokenLimit, provider.customCostMode || 'unlimited');
      const budgetValue = mode === 'amount'
        ? provider.customCostValue ?? provider.budgetLimit
        : provider.customCostValue ?? provider.tokenLimit;
      const usageValue = mode === 'tokens'
        ? formatTokens(provider.usage?.totalTokens || 0)
        : formatUsd(provider.usage?.totalCost || 0);

      return {
        id: provider.id,
        kind: 'provider' as const,
        title: provider.name,
        subtitle: extractDomain(provider.baseUrl),
        accentColor: provider.providerColor || DEFAULT_PROVIDER_COLOR,
        statusLabel: status.label,
        statusVariant: status.status,
        protocolLabel: getProtocolLabel(provider.format),
        modelCountLabel: String(provider.models?.length || 0),
        budgetLabel: getLimitValueLabel(mode, budgetValue),
        usageLabel: `${pick('累计', 'Total')} ${usageValue}`,
        latencyLabel: formatLatency(provider.activitySummary?.lastLatencyMs ?? null),
        isPaused: !provider.isActive,
        isHighlighted: returnHighlight?.providerId === provider.id,
        cardRef: (node: HTMLElement | null) => registerProviderCardRef(provider.id, node),
        onSelect: () => startEditProvider(provider),
        onToggle: () => void toggleProvider(provider),
        onRefresh: () => void refreshProvider(provider),
        onDelete: () => {
          if (confirmModelCenterRouteDelete(provider.name)) {
            void deleteProvider(provider.id);
          }
        },
        toggleDisabled: providerActionsDisabled,
        refreshDisabled: routeDiagnosticsActionDisabled,
        deleteDisabled: providerActionsDisabled,
        refreshLoading: busy === `provider-check:${provider.id}`,
      };
    });

    return [...officialItems, ...providerItems];
  }, [
    busy,
    confirmModelCenterRouteDelete,
    getOfficialDisplayName,
    officialSlots,
    pick,
    providerActionsDisabled,
    registerOfficialCardRef,
    registerProviderCardRef,
    returnHighlight,
    routeDiagnosticsActionDisabled,
    thirdPartyProviders,
    userApiActionsDisabled,
  ]);

  const modelCenterPresets = useMemo(() => (
    PROVIDER_PRESETS.map((preset) => ({
      id: preset.name,
      title: preset.name,
      kindLabel: preset.kind === 'relay' ? pick('中转目录', 'Relay') : pick('供应商预设', 'Provider'),
      protocolLabel: getProtocolLabel(preset.format),
      baseUrlLabel: extractDomain(preset.baseUrl),
      recommendedModel: preset.modelId || pick('保存后同步', 'Sync after save'),
      accentColor: preset.color,
      onApply: () => {
        setProviderForm((current) => ({
          ...current,
          name: preset.name,
          baseUrl: preset.baseUrl,
          format: preset.format,
          color: preset.color,
        }));
        setEditingProviderId(null);
        setActiveTab('third-party');
        navigate(buildProviderEditorPath(null));
        notify.success(
          pick('已预填供应商', 'Provider prefilled'),
          pick(`已载入 ${preset.name} 预设，请填写 API Key 后保存。`, `Loaded ${preset.name}. Enter an API key and save.`),
        );
      },
    }))
  ), [navigate, pick]);

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
  const handleToggleDiagnostics = () => {
    if (!showDiagnostics) {
      setShowAdvancedDetails(true);
    }
    setShowDiagnostics((current) => !current);
  };

  const [customRoutingEnabled, setCustomRoutingEnabledState] = useState(() => isCustomRoutingEnabled());

  const handleCustomRoutingToggle = useCallback((enabled: boolean) => {
    setCustomRoutingEnabled(enabled);
    setCustomRoutingEnabledState(enabled);
    setCapabilityAssignments(getCapabilityRouteAssignments());
  }, []);

  useEffect(() => {
    return subscribeCapabilityRouteAssignments(() => {
      setCapabilityAssignments(getCapabilityRouteAssignments());
    });
  }, []);

  const getModelMetadata = useCallback((modelId: string) => {
    const globalModels = keyManager.getGlobalModelList();
    const matched = globalModels.find(m => m.id === modelId);
    if (matched) {
      return {
        name: matched.name || modelId,
        description: matched.description || '',
      };
    }
    const lower = modelId.toLowerCase();
    let desc = '';
    if (lower.includes('gemini-2.5-flash')) {
      desc = pick('谷歌新一代多模态旗舰级闪电模型，具备极高的响应速度与多模态理解能力。', 'Next-gen multimodal lightning model by Google with high speed and understanding.');
    } else if (lower.includes('gemini-2.5-pro')) {
      desc = pick('谷歌高智能旗舰模型，针对复杂推理、代码生成及多语言任务进行深度优化。', 'Highly intelligent flagship model by Google optimized for reasoning and coding.');
    } else if (lower.includes('gpt-4o')) {
      desc = pick('OpenAI 旗舰多模态模型，支持流畅的图文理解与极速响应。', 'OpenAI multimodal flagship model, supporting fluent understanding and fast response.');
    } else if (lower.includes('gpt-4-turbo')) {
      desc = pick('GPT-4 强力推理模型，适合处理超长上下文及高复杂逻辑。', 'GPT-4 strong reasoning model, suitable for long context and complex logic.');
    } else if (lower.includes('o1-mini')) {
      desc = pick('OpenAI 推理优化型轻量模型，在代码与数学领域速度与效果出众。', 'OpenAI reasoning-optimized light model with outstanding speed in coding and math.');
    } else if (lower.includes('deepseek-r1')) {
      desc = pick('深度求索新一代开源推理模型，拥有比肩最强闭源推理模型的长链思考与数学逻辑。', 'DeepSeek next-gen open-source reasoning model with competitive long-chain thinking.');
    } else if (lower.includes('deepseek-chat')) {
      desc = pick('深度求索通用对话模型，极高的性价比与优秀的中文创作能力。', 'DeepSeek general chat model with ultra high cost-performance and great Chinese writing.');
    } else if (lower.includes('claude-3-5-sonnet')) {
      desc = pick('Anthropic 旗舰模型，业界领先的代码、分析和多步骤推理工具。', 'Anthropic flagship model, industry-leading tool for coding, analysis, and multi-step reasoning.');
    } else {
      desc = pick('通用模型通道，支持完成绝大部分常见对话与逻辑任务。', 'General model route, capable of completing most common conversational and logical tasks.');
    }
    return {
      name: modelId,
      description: desc,
    };
  }, [pick]);

  const renderPresetModelsCard = (
    title: string,
    models: string[] = [],
    onSync: () => void,
    syncLoading: boolean,
  ) => {
    return (
      <SettingsSection
        title={title}
        eyebrow={pick('模型 Nexus', 'Model nexus')}
        description={pick(
          '此通道支持的所有可用模型。如果列表为空，请尝试重新刷新连通性或同步。',
          'All available models supported by this route. If empty, try refreshing connectivity.'
        )}
        action={
          <SettingsActionButton
            icon={RefreshCw}
            loading={syncLoading}
            onClick={onSync}
          >
            {pick('同步模型列表', 'Sync models')}
          </SettingsActionButton>
        }
      >
        {models.length === 0 ? (
          <div className="rounded-[18px] border p-6 text-center text-[var(--text-secondary)]" style={SETTINGS_OVERLAY_STYLE}>
            {pick('暂无可用模型，请点击右上角同步按钮尝试获取。', 'No available models. Click sync to retrieve them.')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {models.map((modelId) => {
              const meta = getModelMetadata(modelId);
              return (
                <div key={modelId} className="rounded-[18px] border p-3 flex flex-col justify-between" style={SETTINGS_OVERLAY_STYLE}>
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] break-all font-mono">{meta.name}</div>
                    <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{meta.description}</div>
                  </div>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full border">
                      {pick('就绪', 'Ready')}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText(modelId);
                        notify.success(pick('复制成功', 'Copied'), modelId);
                      }}
                    >
                      {pick('复制ID', 'Copy ID')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    );
  };

  const renderAdvancedPanels = () => {
    if (!showAdvancedWorkbench) return null;
    return (
      <>
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
          onToggleDiagnostics={handleToggleDiagnostics}
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

        <ApiWorkbenchRoutePoolSection
          pick={pick}
          items={routePoolItems}
        />

        <ApiWorkbenchCapabilitySection
          pick={pick}
          items={capabilityCards}
          customRoutingEnabled={customRoutingEnabled}
          onCustomRoutingToggle={handleCustomRoutingToggle}
        />

        <SettingsSection
          title={pick('更多高级项', 'More advanced items')}
          eyebrow={pick('高级分层', 'Advanced layers')}
          description={pick(
            '诊断、OCR 和平台入口收在这里，避免默认高级模式过于拥挤。',
            'Diagnostics, OCR, and platform tools stay here so advanced mode remains focused.',
          )}
          action={(
            <SettingsActionButton
              icon={showAdvancedDetails ? Layers3 : ChevronDown}
              tone={showAdvancedDetails ? 'primary' : 'secondary'}
              onClick={() => setShowAdvancedDetails((current) => !current)}
            >
              {showAdvancedDetails ? pick('收起更多高级项', 'Hide more advanced items') : pick('更多高级项', 'More advanced items')}
            </SettingsActionButton>
          )}
        >
          {showAdvancedDetails ? (
            <div className="space-y-4">
              {showDiagnostics ? (
                <ApiWorkbenchDiagnosticsSection
                  pick={pick}
                  diagnosticsActionDisabled={diagnosticsRefreshDisabled}
                  onRefreshDiagnostics={() => void refreshApiHealth(true)}
                  apiReachable={apiHealth?.reachable}
                  apiErrorMessage={apiHealth?.errorMessage}
                  persistenceWritable={Boolean(apiHealth?.persistence.userApiKeys)}
                  isAuthenticated={hasAuthenticatedUser}
                  hasReadonlySnapshot={hasReadonlySnapshot}
                />
              ) : null}

              <ApiWorkbenchOcrSection
                pick={pick}
                enabled={ocrSettings.enabled}
                defaultLanguage={ocrSettings.defaultLanguage}
                keySourceLabel={ocrKeySourceLabel}
                healthLabel={ocrHealthLabel}
                onEnabledChange={(enabled) => setOcrSettings(updateOcrServiceSettings({ enabled }))}
                onDefaultLanguageChange={(defaultLanguage) => setOcrSettings(updateOcrServiceSettings({ defaultLanguage }))}
              />

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
            </div>
          ) : (
            <div className="text-[13px] text-[var(--text-secondary)]">
              {pick('需要时再展开诊断、OCR 和平台配置。', 'Expand this only when you need diagnostics, OCR, or platform-level controls.')}
            </div>
          )}
        </SettingsSection>
      </>
    );
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
            <SettingsActionButton data-testid="api-official-editor-back" icon={ArrowLeft} onClick={cancelEdit}>
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
            <SettingsActionButton data-testid="api-provider-editor-back" icon={ArrowLeft} onClick={cancelEdit}>
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
      <SettingsHero
        eyebrow={pick('简约配置', 'Simple setup')}
        title={pick('模型管理中心', 'Model center')}
        description={pick(
          '管理官方直连或第三方供应商通道，并在此进行能力分配。',
          'Manage official direct routes or third-party provider channels and assign capability roles.'
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
              icon={showAdvancedWorkbench ? Layers3 : Wand2}
              tone={showAdvancedWorkbench ? 'primary' : 'secondary'}
              onClick={() => setShowAdvancedWorkbench((current) => !current)}
            >
              {showAdvancedWorkbench ? pick('收起高级模式', 'Hide advanced mode') : pick('高级模式', 'Advanced mode')}
            </SettingsActionButton>
            <SettingsActionButton
              icon={RefreshCw}
              loading={busy === 'cloud-refresh'}
              onClick={() => void run('cloud-refresh', () => refreshCloudData())}
            >
              {pick('刷新数据', 'Refresh data')}
            </SettingsActionButton>
          </>
        }
      />

      {activeEditorMode === null ? (
        <>
          <ApiWorkbenchModelCenterSection
            pick={pick}
            routes={modelCenterRoutes}
            presets={modelCenterPresets}
            connectedSummary={connectedChannels > 0 ? pick(`${connectedChannels} 条链路`, `${connectedChannels} routes`) : pick('等待接入', 'Waiting')}
            autoRoutingSummary={pick(
              '默认自动优先使用预算金额或 Tokens 上限最高的可用通道。',
              'By default, routing prefers the available channel with the highest budget or token limit.',
            )}
            addOfficialDisabled={userApiActionsDisabled}
            addProviderDisabled={providerActionsDisabled}
            onAddOfficial={handleCreateOfficialAction}
            onAddProvider={beginCreateProvider}
          />
          {renderAdvancedPanels()}
        </>
      ) : null}

      {activeEditorMode !== null ? (
      <div className="api-workbench-master-detail-layout flex flex-col lg:flex-row gap-6 w-full items-start mt-6" style={{ scrollbarGutter: 'stable' }}>
        {/* 左栏：卡片形式的供应商列表 */}
        <div className={`w-full lg:w-[320px] shrink-0 space-y-4 ${activeEditorMode !== null ? 'hidden lg:block' : 'block'}`}>
          <div className="rounded-[24px] border p-4 space-y-3" style={SETTINGS_ELEVATED_STYLE}>
            <div className="text-[14px] font-semibold text-[var(--text-primary)] px-1">{pick('API 供应商', 'API providers')}</div>
            
            {/* 添加通道的快速入口 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs rounded-xl border bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer font-medium"
                style={SETTINGS_OVERLAY_STYLE}
                disabled={userApiActionsDisabled}
                onClick={handleCreateOfficialAction}
              >
                <Shield size={14} />
                <span>{pick('官方直连', 'Official')}</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs rounded-xl border bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer font-medium"
                style={SETTINGS_OVERLAY_STYLE}
                disabled={providerActionsDisabled}
                onClick={beginCreateProvider}
              >
                <Globe size={14} />
                <span>{pick('中转站', 'Proxy')}</span>
              </button>
            </div>

            {/* 列表容器，固定高度与滚动条 */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
              {/* 官方直连通道列表 */}
              {officialSlots.map((slot) => {
                const isSelected = activeEditorMode === 'official' && routeOfficialId === slot.id;
                const status = getOfficialStatus(slot);
                const isPaused = slot.disabled;
                return (
                  <div
                    key={slot.id}
                    onClick={() => startEditOfficial(slot)}
                    className={`group relative flex items-center justify-between p-3 rounded-[18px] border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5' 
                        : 'hover:bg-[var(--bg-secondary)] border-[var(--border-primary)]'
                    }`}
                    style={SETTINGS_OVERLAY_STYLE}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-[var(--bg-tertiary)] group-hover:scale-105 transition-transform" style={SETTINGS_OVERLAY_STYLE}>
                        <Shield size={16} className={isPaused ? 'text-[var(--text-tertiary)]' : 'text-indigo-400'} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                          {getOfficialDisplayName(slot.provider === 'OpenAI' ? 'OpenAI' : 'Google')}
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">
                          {slot.provider === 'OpenAI' ? 'OpenAI Direct' : 'Gemini Direct'}
                        </div>
                      </div>
                    </div>
                    
                    {/* 快捷启停与状态指示灯 */}
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className={`h-2 w-2 rounded-full ${
                        isPaused ? 'bg-[var(--text-tertiary)]' : status.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`} />
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
                        style={SETTINGS_OVERLAY_STYLE}
                        disabled={userApiActionsDisabled}
                        onClick={() => void toggleOfficial(slot)}
                        title={isPaused ? pick('启用', 'Enable') : pick('暂停', 'Pause')}
                      >
                        {isPaused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} className="text-amber-400" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 第三方供应商列表 */}
              {thirdPartyProviders.map((provider) => {
                const isSelected = activeEditorMode === 'third-party' && routeProviderId === provider.id;
                const status = getProviderStatus(provider);
                const isPaused = !provider.isActive;
                const color = provider.providerColor || DEFAULT_PROVIDER_COLOR;
                return (
                  <div
                    key={provider.id}
                    onClick={() => startEditProvider(provider)}
                    className={`group relative flex items-center justify-between p-3 rounded-[18px] border transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5' 
                        : 'hover:bg-[var(--bg-secondary)] border-[var(--border-primary)]'
                    }`}
                    style={SETTINGS_OVERLAY_STYLE}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-[var(--bg-tertiary)] text-[12px] font-bold group-hover:scale-105 transition-transform" style={{ ...SETTINGS_OVERLAY_STYLE, color }}>
                        {provider.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                          {provider.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">
                          {extractDomain(provider.baseUrl)}
                        </div>
                      </div>
                    </div>
                    
                    {/* 快捷启停与状态指示灯 */}
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className={`h-2 w-2 rounded-full ${
                        isPaused ? 'bg-[var(--text-tertiary)]' : status.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`} />
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
                        style={SETTINGS_OVERLAY_STYLE}
                        disabled={providerActionsDisabled}
                        onClick={() => void toggleProvider(provider)}
                        title={isPaused ? pick('启用', 'Enable') : pick('暂停', 'Pause')}
                      >
                        {isPaused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} className="text-amber-400" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右栏：表单编辑器、预设模型与能力路由配置 */}
        <div className={`flex-1 min-w-0 space-y-6 ${activeEditorMode === null ? 'hidden lg:block' : 'block'}`}>
          {activeEditorMode === null ? (
            <>
              <div className="rounded-[24px] border p-8 text-center" style={SETTINGS_ELEVATED_STYLE}>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border mb-4 bg-[var(--bg-tertiary)]" style={SETTINGS_OVERLAY_STYLE}>
                  <Key size={24} className="text-[var(--text-secondary)]" />
                </div>
                <div className="text-[16px] font-semibold text-[var(--text-primary)]">{pick('选择供应商开始配置', 'Select a provider to configure')}</div>
                <div className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-md mx-auto">
                  {pick('在左侧列表中点击选择已有的官方直连或第三方供应商通道，或者点击“官方直连”/“中转站”以添加新通道。', 'Click a provider on the left list to edit, or click buttons to add a new channel.')}
                </div>
              </div>
              {renderAdvancedPanels()}
            </>
          ) : null}
            {showOfficialEditor ? (
        <>
        <SettingsSection
          title={pick('本地 API 编辑器', 'Local API editor')}
          eyebrow={
            editingOfficialId
              ? pick('编辑本地 API', 'Edit local API')
              : pick('新增本地 API', 'Add local API')
          }
          description={pick(
            '这里只编辑当前接口。',
            'Edit one endpoint here.'
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
              helper={pick('这里只保存当前接口使用的密钥，不会 and 刷新动作混用。', 'This field only saves the key for this endpoint and does not trigger refresh behavior.')}
              disabled={userApiEditorReadOnly}
            />

            {officialKeyDiagnostics ? (
              <div className="mt-2 rounded-[18px] border px-4 py-2.5 text-[12px] leading-5 text-[var(--state-warning-text)] bg-[var(--state-warning-bg)]/10 border-[var(--state-warning-border)] animate-fadeIn">
                {officialKeyDiagnostics}
              </div>
            ) : null}

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
              <PrimaryButton disabled={userApiActionsDisabled || Boolean(officialEditorValidationMessage)} onClick={() => void saveOfficial()} loading={busy === `official-save:${officialForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingOfficialId ? pick('保存变更', 'Save changes') : pick('新增本地 API', 'Add local API')}
              </PrimaryButton>
              <SecondaryButton onClick={editingOfficialId ? cancelEdit : resetOfficialDraft}>
                {editingOfficialId ? pick('取消', 'Cancel') : pick('清空', 'Reset')}
              </SecondaryButton>
              {editingOfficialId ? (
                <DangerButton disabled={userApiActionsDisabled} onClick={() => void deleteOfficial(editingOfficialId)} className="ml-auto">
                  <Trash2 size={16} className="mr-1" />
                  {pick('删除接口', 'Delete endpoint')}
                </DangerButton>
              ) : null}
            </div>
            {officialEditorValidationMessage ? (
              <div className="text-[13px] leading-6 text-[var(--state-warning-text)]">
                {officialEditorValidationMessage}
              </div>
            ) : null}
          </div>
        </SettingsSection>
        {selectedOfficialSlot && renderPresetModelsCard(
          pick('可用模型 Nexus', 'Available models'),
          selectedOfficialSlot.supportedModels || [],
          () => void refreshOfficial(selectedOfficialSlot),
          busy === `official-check:${selectedOfficialSlot.id}`
        )}
        </>
      ) : null}

      {showProviderEditor ? (
        <>
        <SettingsSection
          title={pick('供应商编辑器', 'Provider editor')}
          eyebrow={
            editingProviderId
              ? pick('编辑供应商', 'Edit provider')
              : pick('新增供应商', 'Create provider')
          }
          description={pick(
            '价格同步不会自动保存表单，保存按钮才会提交配置。',
            'Pricing sync does not save the form. Only Save submits the configuration.'
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
                placeholder={DEFAULT_PROVIDER_COLOR}
                helper={pick('用于列表卡片的识别色，不影响真实请求。', 'Used as the list accent color and does not affect real requests.')}
                disabled={providerEditorReadOnly}
              />
            </div>

            <div className="mb-2">
              <div className="mb-2 text-[13px] font-medium text-[var(--text-primary)]">{pick('智能预设 (快捷填充)', 'Smart Presets')}</div>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="px-3 py-1 text-xs rounded-full border bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer font-medium"
                    style={{ borderColor: preset.color }}
                    onClick={() => {
                      setProviderForm((current) => ({
                        ...current,
                        name: preset.name,
                        baseUrl: preset.baseUrl,
                        format: preset.format,
                        color: preset.color,
                      }));
                      notify.success(
                        pick('已载入预设', 'Preset Loaded'),
                        pick(`已载入 ${preset.name} 预设配置，通信协议已设为 ${preset.format}。`, `Loaded ${preset.name} preset configuration, format set to ${preset.format}.`)
                      );
                    }}
                  >
                    <span style={{ color: preset.color }} className="mr-1">●</span>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <SettingInput
              label={pick('基础地址', 'Base URL')}
              value={providerForm.baseUrl}
              onChange={(value) => setProviderForm((current) => ({ ...current, baseUrl: value }))}
              onBlur={autoFixProviderFormat}
              placeholder="https://api.example.com/v1"
              helper={pick('通信检测、模型拉取和价格同步都会基于这里的地址。', 'Connectivity checks, model sync, and pricing sync all use this URL.')}
              disabled={providerEditorReadOnly}
            />

            {routingConflictWarning ? (
              <div className="mt-2 rounded-[18px] border px-4 py-2.5 text-[12px] leading-5 text-[var(--state-warning-text)] bg-[var(--state-warning-bg)]/10 border-[var(--state-warning-border)] animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">{routingConflictWarning}</div>
                  <button
                    type="button"
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline shrink-0 cursor-pointer"
                    onClick={autoFixProviderFormat}
                  >
                    {pick('一键纠正', 'Auto-fix')}
                  </button>
                </div>
              </div>
            ) : null}

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
              <div className="rounded-[22px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
                <SettingToggle
                  label={pick('参与调度', 'Include in routing')}
                  helper={pick('关闭后，供应商会保留配置，但不会再参与自动调度。', 'When disabled, the provider stays configured but is removed from automatic routing.')}
                  checked={providerForm.isActive}
                  onChange={(checked) => setProviderForm((current) => ({ ...current, isActive: checked }))}
                  disabled={providerEditorReadOnly}
                />
              </div>
            </div>

            <div className="rounded-[24px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">{pick('高级抓取', 'Advanced fetch tools')}</div>
                  <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                    {pick(
                      '这里分开处理模型抓取和价格抓取。模型一般自动获取；价格默认按基础地址候选端点抓取，失败后可以直接填写价格地址。',
                      'Model sync and pricing sync are separated here. Models usually auto-discover; pricing uses default candidate endpoints first, then lets you enter a direct pricing endpoint when needed.'
                    )}
                  </div>
                </div>
                {!editingProviderId ? (
                  <SettingsBadge tone="neutral">{pick('需先保存后可抓取', 'Save before fetching')}</SettingsBadge>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[18px] border p-3" style={SETTINGS_OVERLAY_STYLE}>
                  <div className="text-[14px] font-semibold text-[var(--text-primary)]">{pick('自动获取模型', 'Fetch models')}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                    {pick('连通性检测成功后会回填该供应商支持的模型列表。', 'Connectivity refresh fills the supported model list for this provider.')}
                  </div>
                  <div className="mt-3">
                    {editingProviderId ? (
                      <SettingsActionButton
                        icon={RefreshCw}
                        disabled={routeDiagnosticsActionDisabled}
                        loading={busy === `provider-check:${editingProviderId}`}
                        onClick={() => {
                          const matched = thirdPartyProviders.find((item) => item.id === editingProviderId);
                          if (matched) void refreshProvider(matched);
                        }}
                      >
                        {pick('自动获取模型', 'Fetch models')}
                      </SettingsActionButton>
                    ) : (
                      <SettingsBadge tone="neutral">{pick('需先保存供应商', 'Save provider first')}</SettingsBadge>
                    )}
                  </div>
                </div>

                <div className="rounded-[18px] border p-3" style={SETTINGS_OVERLAY_STYLE}>
                  <div className="text-[14px] font-semibold text-[var(--text-primary)]">{pick('自动获取价格', 'Fetch pricing')}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                    {pick(
                      '默认会按基础地址尝试价格候选端点。价格地址通常可以是基础地址后接 /models；如果失败，再直接填完整价格地址。',
                      'Default pricing sync tries candidate endpoints based on the base URL. A common pricing endpoint is the base URL plus /models; if that fails, enter the full pricing endpoint directly.'
                    )}
                  </div>
                  {showPricingEndpointOverride ? (
                    <div className="mt-3">
                      <SettingInput
                        label={pick('价格地址', 'Pricing endpoint URL')}
                        value={providerPricingEndpointDraft}
                        onChange={setProviderPricingEndpointDraft}
                        placeholder={buildDefaultProviderPricingEndpoint(providerForm.baseUrl) || 'https://api.example.com/v1/models'}
                        helper={pick(
                          '如果默认价格地址失败，可以在这里输入自定义价格地址。',
                          'If the default pricing address fails, enter a custom pricing endpoint here.'
                        )}
                        disabled={providerEditorReadOnly}
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editingProviderId ? (
                      <SettingsActionButton
                        icon={Wand2}
                        disabled={routeDiagnosticsActionDisabled}
                        loading={busy === `provider-price:${editingProviderId}`}
                        onClick={() => {
                          const matched = thirdPartyProviders.find((item) => item.id === editingProviderId);
                          if (matched) void syncPricing(matched, providerPricingEndpointDraft);
                        }}
                      >
                        {pick('自动获取价格', 'Fetch pricing')}
                      </SettingsActionButton>
                    ) : (
                      <SettingsBadge tone="neutral">{pick('需先保存供应商', 'Save provider first')}</SettingsBadge>
                    )}
                    <SecondaryButton onClick={() => setShowPricingEndpointOverride((current) => !current)}>
                      {showPricingEndpointOverride
                        ? pick('收起价格地址', 'Hide pricing endpoint')
                        : pick('手动价格地址', 'Manual pricing endpoint')}
                    </SecondaryButton>
                  </div>
                </div>
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
              <PrimaryButton disabled={providerActionsDisabled || Boolean(providerEditorValidationMessage)} onClick={() => void saveProvider()} loading={busy === `provider-save:${providerForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingProviderId ? pick('保存变更', 'Save changes') : pick('新增供应商', 'Create provider')}
              </PrimaryButton>
              <SecondaryButton onClick={editingProviderId ? cancelEdit : resetProviderDraft}>
                {editingProviderId ? pick('取消', 'Cancel') : pick('清空', 'Reset')}
              </SecondaryButton>
              {editingProviderId ? (
                <DangerButton disabled={providerActionsDisabled} onClick={() => void deleteProvider(editingProviderId)} className="ml-auto">
                  <Trash2 size={16} className="mr-1" />
                  {pick('删除供应商', 'Delete provider')}
                </DangerButton>
              ) : null}
            </div>
            {providerEditorValidationMessage ? (
              <div className="text-[13px] leading-6 text-[var(--state-warning-text)]">
                {providerEditorValidationMessage}
              </div>
            ) : null}
          </div>
        </SettingsSection>
        {selectedProvider && renderPresetModelsCard(
          pick('可用模型 Nexus', 'Available models'),
          selectedProvider.models || [],
          () => {
            const matched = thirdPartyProviders.find((item) => item.id === editingProviderId);
            if (matched) void refreshProvider(matched);
          },
          busy === `provider-check:${editingProviderId}`
        )}
        </>
      ) : null}

      {/* 开启高级视图时，在编辑通道底部渲染高级面板 */}
      {activeEditorMode !== null && renderAdvancedPanels()}

        </div>
      </div>
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


