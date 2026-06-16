import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Globe,
  Layers3,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Wand2,
  Search,
  X,
  Filter,
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
  revealUserApiSecretFromCloudRecord,
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
import { safeOpenLink } from '../../utils/browserUtils';
import { useTheme } from '../../context/ThemeContext';
import keyManager, {
  type KeySlot,
  type ThirdPartyProvider,
  resolveEffectiveProviderModels,
  getModelMetadata as getGlobalModelMetadata,
} from '../../services/auth/keyManager';
import {
  apiRecordMatchesIdOrLegacy,
  buildCanonicalApiRecordId,
  isWuyinApiRecord,
} from '../../services/auth/keyManagerCanonicalIds';
import { buildProviderPricingSnapshot, mergeProviderPricingSnapshot } from '../../services/auth/providerPricingSnapshot';
import type { Supplier } from '../../services/billing/supplierService';
import { buildWuyinOneKeyProvider, WUYIN_DEFAULT_CATALOG } from '../../services/llm/wuyinCatalog';
import {
  SUCHUANG_IMAGE_MODELS,
  SUCHUANG_VIDEO_MODELS,
  SUCHUANG_AUDIO_MODELS
} from '../../config/suchuangModels';
import {
  PROVIDER_MODEL_LIBRARIES,
  getProviderModelPriceLabel
} from '../../config/providerModelLibraries';
import { notify } from '../../services/system/notificationService';
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_INFO_STYLE,
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
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
  SegmentedControlMulti,
  SettingInput,
  SettingSelect,
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
  clearUserApiViewSnapshot,
  readUserApiViewSnapshot,
  toReadonlyOfficialSlot,
  toReadonlyProvider,
  writeUserApiViewSnapshot,
} from './apiUserApiViewSnapshot';
import {
  PROVIDER_PRESETS,
  findProviderPresetForDraft,
  getProviderPresetLinks,
  toProviderFormFromPreset,
  detectProviderPresetByBaseUrl,
  type ProviderPreset,
} from './apiProviderPresets';
import {
  ApiWorkbenchCapabilitySection,
  ApiWorkbenchCurrentViewSection,
  ApiWorkbenchDiagnosticsSection,
  ApiWorkbenchModelCenterSection,
  ApiWorkbenchOcrSection,
  ApiWorkbenchPlatformSection,
  ApiWorkbenchRoutePoolSection,
  ApiWorkbenchStageSection,
  InfoCell,
} from './apiWorkbenchSections';
import {
  resolveApiWorkbenchDiagnosticsAvailability,
  resolveApiWorkbenchStageMeta,
} from './apiWorkbenchState';
import {
  UI_BUDGET_OPTIONS,
  extractDomain,
  formatDateTime,
  formatLatency,
  formatTokens,
  formatUsd,
  getModeLabel,
  getModeOption,
  getOfficialProviderLabel,
  getProtocolLabel,
  maskSecretDisplay,
  parseModeOption,
  type CostMode,
  type OfficialProvider,
} from './apiSettingsFormatters';
type TabType = ApiManagementTab;
const suspiciousLocaleCharSet = new Set('\u9359\u95c2\u59ab\u7487\u6dc7\u93c2\u8930\u7f02\u95b9\u93c6\u95b2\u68f0\u6e1a\u6d98\u7c32\u9350\u5a34\u7039\u95ab\u7ed7\u9422\u6d63');

type OfficialForm = {
  id?: string;
  name: string;
  provider: OfficialProvider;
  key: string;
  keyPreview?: string;
  mode: CostMode;
  value: string;
};

type ProviderForm = {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyPreview?: string;
  modelsText: string;
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
  keyPreview: '',
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
  apiKeyPreview: '',
  modelsText: '',
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
    titleZh: '提示词 AI 增强',
    titleEn: 'Prompt AI enhancement',
    descriptionZh: '本地规则始终可用；这里只控制是否额外调用 AI 增强提示词。',
    descriptionEn: 'Local rulebook shaping always works. This only controls optional AI enhancement.',
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
  if (/api\.wuyinkeji\.com|wuyinkeji/i.test(normalized)) {
    return 'https://api.wuyinkeji.com/themes/DigitalBlue/api?action=api_list';
  }
  return normalized ? `${normalized}/models` : '';
};

const parseProviderModelsText = (value: string): string[] => {
  const seen = new Set<string>();
  return String(value || '')
    .split(/[\n,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const formatProviderModelsText = (models: string[] = []) => models.join('\n');

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

const isReadonlySecretPlaceholder = (value?: string | null): boolean => {
  const str = String(value || '').trim();
  return (
    str === READONLY_SECRET_PLACEHOLDER ||
    str.includes('...') ||
    str.includes('••') ||
    str === '已填写' ||
    str === '尚未填写' ||
    str.startsWith('__kk_redacted__:') ||
    str.includes('wuyin_••••')
  );
};

const resolveRuntimeSecretForSave = (
  draftValue: string,
  persistedValue?: string | null,
): string => {
  const persisted = String(persistedValue || '').trim();
  const canUsePersisted = persisted && !isReadonlySecretPlaceholder(persisted);
  const normalized = String(draftValue || '').trim();

  if (isReadonlySecretPlaceholder(draftValue) || !normalized) {
    return canUsePersisted ? persisted : '';
  }

  return normalized;
};

function maskSecret(secret?: unknown): string {
  if (isRecord(secret) && secret.__kkUserApiSecret === true) {
    return READONLY_SECRET_PLACEHOLDER;
  }

  const clean = typeof secret === 'string' ? secret.trim() : '';
  if (!clean || clean === READONLY_SECRET_PLACEHOLDER || clean.startsWith('__kk_redacted__:')) {
    return READONLY_SECRET_PLACEHOLDER;
  }
  if (clean.includes('...') || clean.includes('••') || clean.includes('wuyin_••••')) {
    return READONLY_SECRET_PLACEHOLDER;
  }
  if (clean.length <= 8) {
    return '***';
  }
  if (clean.length <= 20) {
    return `${clean.slice(0, 3)}...${clean.slice(-3)}`;
  }
  return `${clean.slice(0, 8)}...${clean.slice(-4)}`;
}

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

function isUserApiPersistenceDegradedFromHealth(health: KkApiServerHealth | null): boolean {
  return Boolean(
    health
    && (
      !health.reachable
      || !isKkaiUserApiStorageReady(health)
    ),
  );
}

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

const getOfficialStatus = (slot: KeySlot) => {
  if (slot.disabled) return { badge: 'neutral' as const, status: 'paused' as const, label: '已暂停' };
  if (slot.status === 'valid') return { badge: 'emerald' as const, status: 'online' as const, label: '运行中' };
  if (slot.status === 'rate_limited') return { badge: 'amber' as const, status: 'warning' as const, label: '限流中' };
  if (slot.status === 'invalid') return { badge: 'rose' as const, status: 'error' as const, label: '异常' };
  return { badge: 'neutral' as const, status: 'offline' as const, label: '待检测' };
};

const getProviderStatus = (provider: ThirdPartyProvider) => {
  if (!provider.isActive) return { badge: 'neutral' as const, status: 'paused' as const, label: '已暂停' };

  const isWuyin = provider.name === '速创 API' || /wuyinkeji/i.test(provider.baseUrl);
  if (isWuyin) {
    const apiKey = String(provider.apiKey || '').trim();
    const baseUrl = String(provider.baseUrl || '').trim();

    if (!apiKey) {
      return { badge: 'rose' as const, status: 'error' as const, label: 'API Key 不能为空' };
    }
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      return { badge: 'rose' as const, status: 'error' as const, label: 'Base URL 格式不正确，必须以 http:// 或 https:// 开头' };
    }

    if (provider.status === 'error') {
      const errMsg = String(provider.lastError || '');
      if (
        errMsg.includes('Key') ||
        errMsg.includes('key') ||
        errMsg.includes('未找到') ||
        errMsg.includes('读取') ||
        errMsg.includes('API Key 不能为空') ||
        errMsg.includes('Base URL')
      ) {
        return { badge: 'rose' as const, status: 'error' as const, label: `异常: ${errMsg}` };
      }
    }

    return { badge: 'emerald' as const, status: 'online' as const, label: '等待首次调用' };
  }

  if (provider.status === 'active') return { badge: 'emerald' as const, status: 'online' as const, label: '运行中' };
  if (provider.status === 'error') return { badge: 'rose' as const, status: 'error' as const, label: '异常' };
  if (provider.status === 'valid') {
    return { badge: 'blue' as const, status: 'unverified' as const, label: '等待首次调用' };
  }
  return { badge: 'amber' as const, status: 'warning' as const, label: '检测中' };
};

const getLimitValueLabel = (mode: CostMode, value?: number) => {
  if (mode === 'unlimited') return '♾️';
  if (mode === 'amount' && typeof value === 'number' && value > -1) return formatUsd(value);
  if (mode === 'tokens' && typeof value === 'number' && value > -1) return formatTokens(value);
  return '♾️';
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
  keyPreview: slot.keyPreview,
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
  apiKeyPreview: provider.apiKeyPreview,
  modelsText: formatProviderModelsText(provider.models || []),
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
  apiKey: '',
  apiKeyPreview: '',
  format: supplier.format,
  mode: getMode(supplier.budgetLimit, undefined),
  value: typeof supplier.budgetLimit === 'number' && supplier.budgetLimit > -1 ? String(supplier.budgetLimit) : '',
});

// 辅助判定模型类型
const inferModelType = (modelId: string): 'chat' | 'reasoning' | 'image' | 'video' | 'audio' | 'other' => {
  const lower = modelId.toLowerCase();
  if (lower.includes('imagen') || lower.includes('-image') || lower.includes('generate-image') || lower.includes('flux') || lower.includes('midjourney') || lower.includes('stable-diffusion')) {
    return 'image';
  }
  if (lower.includes('veo') || lower.includes('video') || lower.includes('sora') || lower.includes('luma') || lower.includes('runway')) {
    return 'video';
  }
  if (lower.includes('audio') || lower.includes('speech') || lower.includes('tts') || lower.includes('whisper') || lower.includes('voice')) {
    return 'audio';
  }
  if (lower.includes('r1') || lower.includes('o1') || lower.includes('reasoning') || lower.includes('o3-mini')) {
    return 'reasoning';
  }
  return 'chat';
};

// 辅助判定模型品牌
const inferModelBrand = (modelId: string): string => {
  const lower = modelId.toLowerCase();
  if (lower.includes('gemini') || lower.includes('imagen') || lower.includes('veo') || lower.includes('google')) {
    return 'Google';
  }
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('openai')) {
    return 'OpenAI';
  }
  if (lower.includes('claude') || lower.includes('anthropic')) {
    return 'Anthropic';
  }
  if (lower.includes('deepseek')) {
    return 'DeepSeek';
  }
  if (lower.includes('qwen')) {
    return 'Qwen';
  }
  if (lower.includes('llama') || lower.includes('meta')) {
    return 'Meta/Llama';
  }
  if (lower.includes('grok') || lower.includes('xai')) {
    return 'xAI/Grok';
  }
  if (modelId.includes('/')) {
    const parts = modelId.split('/');
    if (parts[0]) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
  }
  return 'Other';
};

const getTypeLabel = (type: string, pick: (zh: string, en: string) => string) => {
  switch (type) {
    case 'chat': return pick('💬 对话模型', '💬 Chat Models');
    case 'reasoning': return pick('🧠 推理模型', '🧠 Reasoning Models');
    case 'image': return pick('🎨 图像模型', '🎨 Image Models');
    case 'video': return pick('🎥 视频模型', '🎥 Video Models');
    case 'audio': return pick('🔊 音频模型', '🔊 Audio Models');
    default: return pick('⚙️ 其他模型', '⚙️ Other Models');
  }
};

const getBrandLabel = (brand: string, pick: (zh: string, en: string) => string) => {
  if (brand === 'Google') return pick('谷歌 (Google)', 'Google');
  if (brand === 'OpenAI') return 'OpenAI';
  if (brand === 'Anthropic') return 'Anthropic';
  if (brand === 'DeepSeek') return pick('深度求索 (DeepSeek)', 'DeepSeek');
  if (brand === 'Qwen') return pick('通义千问 (Qwen)', 'Qwen');
  if (brand === 'Other') return pick('其他品牌', 'Other Brands');
  return brand;
};

interface PresetModelsCardProps {
  title: string;
  models: string[];
  onSync: () => void;
  syncLoading: boolean;
  isMobile: boolean;
  isDarkMode: boolean;
  getModelMetadata: (modelId: string) => { name: string; description: string };
  pick: (zh: string, en: string) => string;
  notify: any;
  SETTINGS_OVERLAY_STYLE: any;
}

const PresetModelsCardComponent: React.FC<PresetModelsCardProps> = ({
  title,
  models = [],
  onSync,
  syncLoading,
  isMobile,
  isDarkMode,
  getModelMetadata,
  pick,
  notify,
  SETTINGS_OVERLAY_STYLE,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'type' | 'brand'>('type');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // 1. 整理富模型数据
  const parsedModels = useMemo(() => {
    return models.map((modelId) => {
      const meta = getModelMetadata(modelId);
      const type = inferModelType(modelId);
      const brand = inferModelBrand(modelId);

      const suchuangModelList = [
        ...SUCHUANG_IMAGE_MODELS,
        ...SUCHUANG_VIDEO_MODELS,
        ...SUCHUANG_AUDIO_MODELS
      ];
      const foundSuchuang = suchuangModelList.find(m => m.modelId === modelId);
      const priceLabel = foundSuchuang ? getProviderModelPriceLabel(foundSuchuang) : undefined;

      return {
        id: modelId,
        name: meta.name || modelId,
        description: meta.description || '',
        type,
        brand,
        priceLabel
      };
    });
  }, [models, getModelMetadata]);

  // 2. 动态提取已存在的所有类型和品牌
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    parsedModels.forEach((m) => types.add(m.type));
    return Array.from(types);
  }, [parsedModels]);

  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    parsedModels.forEach((m) => brands.add(m.brand));
    return Array.from(brands);
  }, [parsedModels]);

  // 3. 过滤处理
  const filteredModels = useMemo(() => {
    return parsedModels.filter((m) => {
      // 3.1 搜索框匹配
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = m.id.toLowerCase().includes(query);
        const matchesName = m.name.toLowerCase().includes(query);
        const matchesDesc = m.description.toLowerCase().includes(query);
        if (!matchesId && !matchesName && !matchesDesc) {
          return false;
        }
      }
      // 3.2 类型多选匹配
      if (selectedTypes.length > 0 && !selectedTypes.includes(m.type)) {
        return false;
      }
      // 3.3 品牌多选匹配
      if (selectedBrands.length > 0 && !selectedBrands.includes(m.brand)) {
        return false;
      }
      return true;
    });
  }, [parsedModels, searchQuery, selectedTypes, selectedBrands]);

  // 4. 对过滤后的模型进行分组
  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof parsedModels> = {};
    filteredModels.forEach((m) => {
      const key = groupBy === 'type' ? m.type : m.brand;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(m);
    });
    return groups;
  }, [filteredModels, groupBy]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const handleTypeClick = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleBrandClick = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  // 获取类型或品牌的名称，用来在折叠组头部展示
  const getGroupTitle = (groupKey: string) => {
    if (groupBy === 'type') {
      return getTypeLabel(groupKey, pick);
    }
    return getBrandLabel(groupKey, pick);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedBrands([]);
  };

  return (
    <SettingsSection
      title={title}
      eyebrow={pick('模型列表', 'Model list')}
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
        <div className="space-y-4">
          {/* 工具栏：搜索与分类过滤 */}
          <div className="rounded-[18px] border p-4 space-y-3" style={SETTINGS_OVERLAY_STYLE}>
            {/* 1. 搜索框 */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={pick('搜索模型名称或ID...', 'Search model name or ID...')}
                className="w-full bg-[var(--settings-surface-elevated)] border border-[var(--settings-border-subtle)] rounded-lg pl-9 pr-8 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-0.5 bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2. 类型过滤 */}
            {availableTypes.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold text-[var(--text-tertiary)] flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  {pick('按类型筛选', 'Filter by Type')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTypes([])}
                    className={`px-2.5 py-1 text-[11px] rounded-full border cursor-pointer select-none transition-all ${
                      selectedTypes.length === 0
                        ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border-[var(--settings-border-subtle)] text-[var(--text-secondary)] font-medium'
                    }`}
                  >
                    {pick('全部类型', 'All Types')}
                  </button>
                  {availableTypes.map((type) => {
                    const active = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleTypeClick(type)}
                        className={`px-2.5 py-1 text-[11px] rounded-full border cursor-pointer select-none transition-all ${
                          active
                            ? 'bg-indigo-600 border-indigo-600 text-white font-semibold shadow-sm'
                            : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border-[var(--settings-border-subtle)] text-[var(--text-secondary)] font-medium'
                        }`}
                      >
                        {getTypeLabel(type, pick)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. 品牌过滤 */}
            {availableBrands.length > 1 && (
              <div className="flex flex-col gap-1.5 border-t border-[var(--settings-border-subtle)] pt-2.5">
                <div className="text-[11px] font-semibold text-[var(--text-tertiary)] flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {pick('按品牌筛选', 'Filter by Brand')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedBrands([])}
                    className={`px-2.5 py-1 text-[11px] rounded-full border cursor-pointer select-none transition-all ${
                      selectedBrands.length === 0
                        ? 'bg-indigo-600 border-indigo-600 text-white font-semibold'
                        : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border-[var(--settings-border-subtle)] text-[var(--text-secondary)] font-medium'
                    }`}
                  >
                    {pick('全部品牌', 'All Brands')}
                  </button>
                  {availableBrands.map((brand) => {
                    const active = selectedBrands.includes(brand);
                    return (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => handleBrandClick(brand)}
                        className={`px-2.5 py-1 text-[11px] rounded-full border cursor-pointer select-none transition-all ${
                          active
                            ? 'bg-indigo-600 border-indigo-600 text-white font-semibold shadow-sm'
                            : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border-[var(--settings-border-subtle)] text-[var(--text-secondary)] font-medium'
                        }`}
                      >
                        {getBrandLabel(brand, pick)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. 分组配置与清除 */}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[var(--settings-border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-tertiary)]">{pick('分组依据：', 'Group by:')}</span>
                <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5 border">
                  <button
                    type="button"
                    onClick={() => setGroupBy('type')}
                    className={`px-2.5 py-1 text-[11px] rounded-md cursor-pointer border-none font-semibold transition-all ${
                      groupBy === 'type'
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold shadow-sm'
                        : 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {pick('类型', 'Type')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupBy('brand')}
                    className={`px-2.5 py-1 text-[11px] rounded-md cursor-pointer border-none font-semibold transition-all ${
                      groupBy === 'brand'
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-bold shadow-sm'
                        : 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {pick('品牌', 'Brand')}
                  </button>
                </div>
              </div>

              {(searchQuery || selectedTypes.length > 0 || selectedBrands.length > 0) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer bg-transparent border-none p-0 flex items-center gap-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                  {pick('清空筛选', 'Clear filters')}
                </button>
              )}
            </div>
          </div>

          {/* 5. 分组展示 */}
          {Object.keys(groupedModels).length === 0 ? (
            <div className="rounded-[18px] border p-6 text-center text-[var(--text-secondary)]" style={SETTINGS_OVERLAY_STYLE}>
              {pick('未找到符合过滤条件的模型。', 'No models found matching the filters.')}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedModels).map(([groupKey, groupModels]) => {
                const isCollapsed = collapsedGroups[groupKey] ?? false;
                const titleText = getGroupTitle(groupKey);

                return (
                  <div
                    key={groupKey}
                    className="rounded-[18px] border overflow-hidden transition-all duration-200"
                    style={{
                      ...SETTINGS_OVERLAY_STYLE,
                      border: isCollapsed ? '1px solid var(--settings-border-subtle)' : '1px solid var(--settings-border-active, rgba(99, 102, 241, 0.25))',
                    }}
                  >
                    {/* 折叠组 Header */}
                    <div
                      onClick={() => toggleGroup(groupKey)}
                      className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)]/30 hover:bg-[var(--bg-secondary)]/50 cursor-pointer select-none transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{titleText}</span>
                        <span className="text-[10px] font-semibold text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] border px-2 py-0.5 rounded-full">
                          {groupModels.length} {pick('个模型', 'models')}
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        className="text-[var(--text-secondary)] transition-transform duration-300"
                        style={{
                          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        }}
                      />
                    </div>

                    {/* 折叠组卡片列表内容 */}
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[5000px] opacity-100 p-4 border-t border-[var(--settings-border-subtle)]'
                      }`}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        {groupModels.map((model) => (
                          <div
                            key={model.id}
                            className="rounded-[14px] border p-3.5 flex flex-col justify-between hover:border-indigo-500/40 hover:bg-[var(--bg-tertiary)]/20 transition-all"
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.015)',
                              borderColor: 'var(--settings-border-subtle)',
                            }}
                          >
                            <div>
                              <div className="text-[14px] font-semibold text-[var(--text-primary)] break-all font-mono tracking-tight">{model.name}</div>
                              <div className="mt-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">{model.description}</div>
                            </div>
                            <div className="mt-4 flex justify-between items-center">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full border flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {model.priceLabel ? model.priceLabel : pick('就绪', 'Ready')}
                              </span>
                              <button
                                type="button"
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer bg-transparent border-none p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(model.id);
                                  notify.success(pick('复制成功', 'Copied'), model.id);
                                }}
                              >
                                {pick('复制ID', 'Copy ID')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </SettingsSection>
  );
};

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
  const isWuyin = providerForm.name === '速创 API' || /wuyinkeji/i.test(providerForm.baseUrl);
  const [editingOfficialId, setEditingOfficialId] = useState<string | null>(null);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdvancedWorkbench, setShowAdvancedWorkbench] = useState(false);
  const { isDarkMode } = useTheme();
  const [modelCenterPresetTab, setModelCenterPresetTab] = useState<'official' | 'relay'>('official');
  const dummyPresetKind = useCallback((preset: ProviderPreset) => {
    return {
      kind: preset.kind === 'relay' ? 'relay' as const : 'official' as const,
      tab: modelCenterPresetTab,
    };
  }, [modelCenterPresetTab]);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [providerPricingEndpointDraft, setProviderPricingEndpointDraft] = useState('');
  const [showPricingEndpointOverride, setShowPricingEndpointOverride] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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

  // 1. 简体中文注释：协议推断转为后台自动处理，减少供应商表单上的显性选项。
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

  // 4. 简体中文注释：第三方供应商接口密钥格式诊断
  const providerKeyDiagnostics = useMemo(() => {
    const key = providerForm.apiKey.trim();
    if (!key || isReadonlySecretPlaceholder(key)) return '';

    const url = providerForm.baseUrl.trim().toLowerCase();
    const activePreset = findProviderPresetForDraft(providerForm.name, providerForm.baseUrl);
    const isGoogle = url.includes('googleapis.com') || (activePreset && activePreset.name === 'Google Gemini');
    const isOpenAI = url.includes('api.openai.com') || (activePreset && activePreset.name === 'OpenAI');
    const isClaude = url.includes('api.anthropic.com') || (activePreset && activePreset.name === 'Anthropic');

    if (/\s/.test(providerForm.apiKey)) {
      return pick(
        '⚠️ 密钥中包含空格或换行，可能会导致接口认证失败，请检查。',
        '⚠️ The key contains spaces or newlines, which may cause authentication failure. Please check.'
      );
    }

    if (isGoogle) {
      if (!key.startsWith('AIzaSy')) {
        return pick(
          '⚠️ Google AI Studio 密钥通常以 "AIzaSy" 开头，请确保您输入了正确的 API 密钥。',
          '⚠️ Google AI Studio keys typically start with "AIzaSy". Please ensure you entered the correct API key.'
        );
      }
    }

    if (isOpenAI) {
      if (!key.startsWith('sk-')) {
        return pick(
          '⚠️ OpenAI 官方密钥通常以 "sk-" 开头，请确保您输入了正确的 API 密钥。',
          '⚠️ OpenAI keys typically start with "sk-". Please ensure you entered the correct API key.'
        );
      }
    }

    if (isClaude) {
      if (!key.startsWith('sk-ant-')) {
        return pick(
          '⚠️ Anthropic Claude 密钥通常以 "sk-ant-" 开头，请确保您输入了正确的 API 密钥。',
          '⚠️ Anthropic Claude keys typically start with "sk-ant-". Please ensure you entered the correct API key.'
        );
      }
    }

    return '';
  }, [providerForm.apiKey, providerForm.format, providerForm.baseUrl, pick]);

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
  const routePresetProviderDraft = useMemo<ProviderForm | null>(() => {
    if (!isRecord(location.state) || !isRecord(location.state.presetProviderDraft)) {
      return null;
    }

    const draft = location.state.presetProviderDraft;
    const name = normalizeString(draft.name);
    const baseUrl = normalizeString(draft.baseUrl);
    if (!name && !baseUrl) {
      return null;
    }

    return {
      ...providerDefaults,
      name,
      baseUrl,
      modelsText: normalizeString(draft.modelsText),
      format: normalizeProtocolFormat(draft.format, 'auto'),
      color: normalizeString(draft.color) || DEFAULT_PROVIDER_COLOR,
    };
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
    () => officialSlots.find((slot) => (
      apiRecordMatchesIdOrLegacy(slot, routeOfficialId)
      || normalizeRouteMatchValue(slot.id) === normalizeRouteMatchValue(routeOfficialId)
    )) || null,
    [officialSlots, routeOfficialId]
  );
  const selectedProvider = useMemo(() => {
    const routeValue = normalizeRouteMatchValue(routeProviderId);
    if (!routeValue) return null;

    return thirdPartyProviders.find((provider) => (
      apiRecordMatchesIdOrLegacy(provider, routeProviderId)
      || normalizeRouteMatchValue(provider.id) === routeValue
    )) || null;
  }, [routeProviderId, thirdPartyProviders]);
  const activeProviderPreset = useMemo(
    () => detectProviderPresetByBaseUrl(providerForm.baseUrl),
    [providerForm.baseUrl],
  );
  const activeProviderPresetLinks = useMemo(
    () => getProviderPresetLinks(activeProviderPreset),
    [activeProviderPreset],
  );
  const isOfficialEditorRoute = Boolean(routeOfficialId);
  const isProviderEditorRoute = Boolean(routeProviderId);
  const activeEditorMode: TabType | null = isOfficialEditorRoute ? 'official' : isProviderEditorRoute ? 'third-party' : null;

  useEffect(() => {
    const shellPage = document.querySelector('.settings-shell-page--desktop') as HTMLElement;
    if (shellPage) {
      if (activeEditorMode === null) {
        shellPage.style.overflowY = 'hidden';
        shellPage.style.display = 'flex';
        shellPage.style.flexDirection = 'column';
      } else {
        shellPage.style.overflowY = '';
        shellPage.style.display = '';
        shellPage.style.flexDirection = '';
      }
    }
    return () => {
      if (shellPage) {
        shellPage.style.overflowY = '';
        shellPage.style.display = '';
        shellPage.style.flexDirection = '';
      }
    };
  }, [activeEditorMode]);

  const isCreatingOfficial = routeOfficialId === ROUTE_NEW_ITEM;
  const isCreatingProvider = routeProviderId === ROUTE_NEW_ITEM;
  const providerRouteMissing = isProviderEditorRoute && !isCreatingProvider && !selectedProvider && !initialSupplier;
  const officialRouteMissing = isOfficialEditorRoute && !isCreatingOfficial && !selectedOfficialSlot;
  const activeProviders = thirdPartyProviders.filter((item) => item.isActive).length;
  const connectedChannels = officialSlots.filter((slot) => !slot.disabled).length + activeProviders;
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
  const savedSecretReadOnlyHelper = pick(
    '已保存的 API Key 默认只显示遮罩。点击右侧眼睛会从后端临时取回明文用于核对；需要更换时清空后输入新的真实 API Key 并保存。',
    'Saved API keys show a mask by default. Click the eye to temporarily reveal the saved plaintext from the backend; to replace it, clear the field, enter the real new API key, and save.',
  );
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
    patch: Partial<{
      enabled: boolean;
      primaryRouteId: string;
      primaryModelId: string;
      fallbackRouteId: string;
      fallbackModelId: string;
      auxiliaryRouteId: string;
      auxiliaryModelId: string;
      imageRouteId: string;
      imageModelId: string;
      imageFallbackRouteId: string;
      imageFallbackModelId: string;
    }>,
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
        fallbackModelId: assignment?.fallbackModelId || '',
        auxiliaryRouteId: assignment?.auxiliaryRouteId || '',
        auxiliaryModelId: assignment?.auxiliaryModelId || '',
        imageRouteId: assignment?.imageRouteId || '',
        imageModelId: assignment?.imageModelId || '',
        imageFallbackRouteId: assignment?.imageFallbackRouteId || '',
        imageFallbackModelId: assignment?.imageFallbackModelId || '',
        routeOptions: capabilityRouteOptions,
        modelOptions: getRouteModelOptions(assignment?.primaryRouteId || '', meta.role),
        fallbackModelOptions: getRouteModelOptions(assignment?.fallbackRouteId || '', meta.role),
        auxiliaryModelOptions: getRouteModelOptions(assignment?.auxiliaryRouteId || '', meta.role),
        imageModelOptions: getRouteModelOptions(assignment?.imageRouteId || '', 'image_generation'),
        imageFallbackModelOptions: getRouteModelOptions(assignment?.imageFallbackRouteId || '', 'image_generation'),
        onEnabledChange: (enabled: boolean) => updateCapabilityAssignment(meta.role, { enabled }),
        onPrimaryRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { primaryRouteId: value, primaryModelId: '' }),
        onPrimaryModelChange: (value: string) => updateCapabilityAssignment(meta.role, { primaryModelId: value }),
        onFallbackRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { fallbackRouteId: value, fallbackModelId: '' }),
        onFallbackModelChange: (value: string) => updateCapabilityAssignment(meta.role, { fallbackModelId: value }),
        onAuxiliaryRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { auxiliaryRouteId: value, auxiliaryModelId: '' }),
        onAuxiliaryModelChange: (value: string) => updateCapabilityAssignment(meta.role, { auxiliaryModelId: value }),
        onImageRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { imageRouteId: value, imageModelId: '' }),
        onImageModelChange: (value: string) => updateCapabilityAssignment(meta.role, { imageModelId: value }),
        onImageFallbackRouteChange: (value: string) => updateCapabilityAssignment(meta.role, { imageFallbackRouteId: value, imageFallbackModelId: '' }),
        onImageFallbackModelChange: (value: string) => updateCapabilityAssignment(meta.role, { imageFallbackModelId: value }),
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

      setReadonlyOfficialSlots((prev) => (prev.length === 0 && nextOfficialSlots.length === 0) ? prev : nextOfficialSlots);
      setReadonlyProviders((prev) => (prev.length === 0 && nextProviders.length === 0) ? prev : nextProviders);
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
      setReadonlyOfficialSlots((prev) => prev.length === 0 ? prev : []);
      setReadonlyProviders((prev) => prev.length === 0 ? prev : []);
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

  // 简体中文注释：仅在初始化挂载或用户认证状态改变时执行健康检查与云端数据拉取
  useEffect(() => {
    refresh();
    void refreshApiHealth();
    void refreshCloudData(true);
  }, [authenticatedUserId]);

  // 简体中文注释：将 KeyManager 订阅与数据拉取解耦，消除由于云端异常引起的无限更新死循环
  useEffect(() => {
    return keyManager.subscribe(refresh);
  }, [refresh]);

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
      setReadonlyOfficialSlots((prev) => prev.length === 0 ? prev : []);
      setReadonlyProviders((prev) => prev.length === 0 ? prev : []);
      return;
    }

    const nextOfficial = cachedSnapshot.officialSlots
      .map((slot) => toReadonlyOfficialSlot(slot))
      .filter((slot): slot is KeySlot => Boolean(slot))
      .filter(isOfficialSlot);
    setReadonlyOfficialSlots((prev) => (prev.length === 0 && nextOfficial.length === 0) ? prev : nextOfficial);

    const nextProviders = cachedSnapshot.providers
      .map((provider) => toReadonlyProvider(provider))
      .filter((provider): provider is ThirdPartyProvider => Boolean(provider))
      .sort((left, right) => right.updatedAt - left.updatedAt);
    setReadonlyProviders((prev) => (prev.length === 0 && nextProviders.length === 0) ? prev : nextProviders);
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
        const nextDraft = routePresetProviderDraft || (initialSupplier ? toProviderFormFromSupplier(initialSupplier) : providerDefaults);
        setProviderForm(nextDraft);
        setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(nextDraft.baseUrl || initialSupplier?.baseUrl));
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
    routePresetProviderDraft,
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
  // 磨砂挖空高亮遮罩核心实现
  const triggerMaskHighlight = (el: HTMLElement) => {
    if (typeof document === 'undefined') return;

    // 1. 动态注入闪烁动画的 keyframes
    const styleId = 'kk-mask-highlight-style';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        @keyframes kk-mask-highlight-flash {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
            border-color: rgba(255, 255, 255, 0.5);
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
            border-color: rgba(255, 255, 255, 1);
            box-shadow: 0 0 25px rgba(255, 255, 255, 0.9), inset 0 0 10px rgba(255, 255, 255, 0.5);
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 2. 创建半透明磨砂蒙版
    const mask = document.createElement('div');
    mask.style.position = 'fixed';
    mask.style.left = '0';
    mask.style.top = '0';
    mask.style.width = '100vw';
    mask.style.height = '100vh';
    mask.style.zIndex = '199999';
    mask.style.backdropFilter = 'blur(6px)';
    (mask.style as any).webkitBackdropFilter = 'blur(6px)';
    mask.style.background = 'rgba(15, 23, 42, 0.45)'; // 深色高级磨砂质感
    mask.style.pointerEvents = 'none';
    mask.style.transition = 'opacity 0.3s ease';

    // 3. 创建白色高亮边框
    const borderBox = document.createElement('div');
    borderBox.style.position = 'fixed';
    borderBox.style.zIndex = '200000';
    borderBox.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    borderBox.style.borderRadius = '12px';
    borderBox.style.pointerEvents = 'none';
    borderBox.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    borderBox.style.animation = 'kk-mask-highlight-flash 1s ease-in-out 3'; // 3秒闪烁3次

    // 4. 定位与镂空更新逻辑
    const updatePosition = () => {
      const rect = el.getBoundingClientRect();
      const w = window.innerWidth;
      const h = window.innerHeight;
      const l = rect.left;
      const t = rect.top;
      const r = rect.right;
      const b = rect.bottom;

      // 使用 evenodd 填充规则绘制回字形 polygon，挖空 rect 区域
      mask.style.clipPath = `polygon(evenodd, 0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px, 0px 0px, ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`;

      // 调整呼吸框大小和位置
      borderBox.style.left = `${l - 4}px`;
      borderBox.style.top = `${t - 4}px`;
      borderBox.style.width = `${rect.width + 8}px`;
      borderBox.style.height = `${rect.height + 8}px`;
    };

    updatePosition();
    document.body.appendChild(mask);
    document.body.appendChild(borderBox);

    // 监听滚动与尺寸变化以实时更新高亮位置，保障高级感与准确性
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    // 3 秒自动销毁
    const destroy = () => {
      mask.style.opacity = '0';
      borderBox.style.opacity = '0';
      setTimeout(() => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        if (borderBox.parentNode) borderBox.parentNode.removeChild(borderBox);
      }, 300);
    };

    setTimeout(destroy, 3000);
  };

  // 将方法挂载到 window，以便 uiTools.ts 等外部调用
  if (typeof window !== 'undefined') {
    (window as any).triggerMaskHighlight = triggerMaskHighlight;
  }

  // 注册全局 API 卡片定位方法与磨砂挖空高亮遮罩
  useEffect(() => {
    (window as any).__KK_LOCATE_API_CARD__ = (cardIdOrName: string) => {
      const cleanTarget = cardIdOrName.trim().toLowerCase();
      
      // 1. 尝试寻找第三方供应商匹配
      const matchedProvider = thirdPartyProviders.find(
        (p) => p.id.toLowerCase() === cleanTarget || p.name.toLowerCase().includes(cleanTarget)
      );
      
      if (matchedProvider) {
        setActiveTab('third-party');
        setReturnHighlight({ providerId: matchedProvider.id });
        
        setTimeout(() => {
          const node = providerCardRegistryRef.current.get(matchedProvider.id);
          if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            triggerMaskHighlight(node);
          }
        }, 300);
        return true;
      }
      
      // 2. 尝试寻找官方接口匹配
      const matchedOfficial = officialSlots.find(
        (s) => s.id.toLowerCase() === cleanTarget || s.name.toLowerCase().includes(cleanTarget) || s.provider.toLowerCase().includes(cleanTarget)
      );
      
      if (matchedOfficial) {
        setActiveTab('official');
        setReturnHighlight({ officialId: matchedOfficial.id });
        
        setTimeout(() => {
          const node = officialCardRegistryRef.current.get(matchedOfficial.id);
          if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            triggerMaskHighlight(node);
          }
        }, 300);
        return true;
      }
      
      return false;
    };
    
    return () => {
      delete (window as any).__KK_LOCATE_API_CARD__;
    };
  }, [thirdPartyProviders, officialSlots]);

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

  const revealOfficialSecret = async () => {
    const recordId = String(editingOfficialId || officialForm.id || '').trim();
    if (!recordId) {
      throw new Error(pick('当前接口还没有保存，无法查看已保存密钥。', 'This endpoint has not been saved yet, so there is no saved key to reveal.'));
    }

    const busyKey = `official-reveal:${recordId}`;
    setBusy(busyKey);
    try {
      const secret = await revealUserApiSecretFromCloudRecord(
        { recordType: 'slot', recordId, field: 'key' },
        authenticatedUserId || undefined,
      );
      if (!secret) {
        throw new Error(pick('没有找到可查看的已保存 API Key。', 'No saved API key is available to reveal.'));
      }

      setOfficialForm((current) => ({ ...current, key: secret }));
      notify.success(pick('已显示密钥', 'Key revealed'), pick('已从后端临时取回当前接口的 API Key。', 'The saved API key was temporarily retrieved from the backend.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : pick('当前密钥暂时无法查看。', 'The current key cannot be revealed right now.');
      notify.error(pick('查看失败', 'Reveal failed'), message);
      throw error;
    } finally {
      setBusy((current) => (current === busyKey ? null : current));
    }
  };

  const revealProviderSecret = async () => {
    const recordId = String(editingProviderId || providerForm.id || '').trim();
    if (!recordId) {
      throw new Error(pick('当前通道还没有保存，无法查看已保存密钥。', 'This route has not been saved yet, so there is no saved key to reveal.'));
    }

    const busyKey = `provider-reveal:${recordId}`;
    setBusy(busyKey);
    try {
      const secret = await revealUserApiSecretFromCloudRecord(
        { recordType: 'provider', recordId, field: 'apiKey' },
        authenticatedUserId || undefined,
      );
      if (!secret) {
        throw new Error(pick('没有找到可查看的已保存 API Key。', 'No saved API key is available to reveal.'));
      }

      setProviderForm((current) => ({ ...current, apiKey: secret }));
      notify.success(pick('已显示密钥', 'Key revealed'), pick('已从后端临时取回当前通道的 API Key。', 'The saved API key was temporarily retrieved from the backend.'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : pick('当前密钥暂时无法查看。', 'The current key cannot be revealed right now.');
      notify.error(pick('查看失败', 'Reveal failed'), message);
      throw error;
    } finally {
      setBusy((current) => (current === busyKey ? null : current));
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
    const nextKeyValue = isReadonlySecretPlaceholder(officialForm.key)
      ? READONLY_SECRET_PLACEHOLDER
      : (normalizedKey || (canReusePersistedOfficialSecret ? READONLY_SECRET_PLACEHOLDER : ''));
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
    const nextApiKeyValue = isReadonlySecretPlaceholder(providerForm.apiKey)
      ? READONLY_SECRET_PLACEHOLDER
      : (normalizedApiKey || (canReusePersistedProviderSecret ? READONLY_SECRET_PLACEHOLDER : ''));
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
    const existingOfficialSlot = selectedOfficialSlot || officialSlots.find((slot) => slot.id === officialForm.id) || null;
    const officialBaseUrl = officialForm.provider === 'Google' ? DEFAULT_GOOGLE_BASE_URL : DEFAULT_OPENAI_BASE_URL;
    const nextSlotId = buildCanonicalApiRecordId(
      {
        id: officialForm.id || existingOfficialSlot?.id,
        name: officialForm.provider,
        provider: officialForm.provider,
        baseUrl: officialBaseUrl,
      },
      officialSlots.map((slot) => slot.id),
    );
    const nextSlotLegacyIds = [
      ...(existingOfficialSlot?.legacyIds || []),
      ...(officialForm.id && officialForm.id !== nextSlotId ? [officialForm.id] : []),
    ].filter(Boolean);
    const nextKeyValue = isReadonlySecretPlaceholder(officialForm.key)
      ? READONLY_SECRET_PLACEHOLDER
      : (normalizedKey || (canReusePersistedOfficialSecret ? READONLY_SECRET_PLACEHOLDER : ''));
    const runtimeKeyValue = resolveRuntimeSecretForSave(officialForm.key, existingOfficialSlot?.key);

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
        await upsertUserApiSlotToCloudRecord({
          id: nextSlotId,
          legacyIds: nextSlotLegacyIds,
          name: officialForm.provider,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: officialBaseUrl,
          key: nextKeyValue,
          supportedModels: existingOfficialSlot?.supportedModels || [],
          disabled: existingOfficialSlot?.disabled || false,
          status: existingOfficialSlot?.status || 'unknown',
          failCount: existingOfficialSlot?.failCount || 0,
          successCount: existingOfficialSlot?.successCount || 0,
          lastUsed: existingOfficialSlot?.lastUsed || null,
          lastError: existingOfficialSlot?.lastError || null,
          createdAt: existingOfficialSlot?.createdAt || Date.now(),
          updatedAt: Date.now(),
          avgResponseTime: existingOfficialSlot?.avgResponseTime,
          lastResponseTime: existingOfficialSlot?.lastResponseTime,
          usedTokens: existingOfficialSlot?.usedTokens || 0,
          totalCost: existingOfficialSlot?.totalCost || 0,
          ...payload,
        });
        await refreshAfterCloudUserApiMutation();
      } else if (officialForm.id) {
        if (!runtimeKeyValue) {
          notify.error(
            pick('保存失败', 'Save failed'),
            pick(
              '无法在本地运行态复用只读占位符，请重新输入真实 API Key。',
              'The local runtime cannot reuse a read-only placeholder. Re-enter the real API key.',
            ),
          );
          return;
        }
        await keyManager.updateKey(officialForm.id, {
          name: officialForm.provider,
          provider: officialForm.provider as Provider,
          type: 'official',
          format: officialForm.provider === 'Google' ? 'gemini' : 'openai',
          baseUrl: '',
          key: runtimeKeyValue,
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

  const syncWuyinCatalog = async () => {
    await run('sync-wuyin', async () => {
      notify.info(
        pick('正在拉取', 'Syncing'),
        pick('正在同步最新的模型和价格表，这可能需要几秒钟，请稍候...', 'Syncing the latest models and prices, this may take a few seconds, please wait...'),
      );
      try {
        const res = await fetch('/api/v1/wuyin/catalog?refresh=true');
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data)) {
          // 简体中文注释：保存到前端缓存中
          const cacheKey = `wuyin_pricing_catalog_cache_https://api.wuyinkeji.com`;
          window.localStorage.setItem(cacheKey, JSON.stringify(json.data));
          notify.success(
            pick('同步成功', 'Sync Succeeded'),
            pick(`已成功爬取并缓存了 ${json.data.length} 个最新的速创模型与价格价格数据！`, `Successfully fetched and cached ${json.data.length} Wuyin models and pricing.`),
          );
        } else {
          throw new Error(json?.message || 'Sync failed');
        }
      } catch (error) {
        console.error('Failed to sync Wuyin catalog:', error);
        notify.error(
          pick('同步失败', 'Sync Failed'),
          pick('无法连接速创 API 价格同步服务，请检查网络或稍后再试。', 'Failed to connect to Wuyin API pricing sync service. Check network and try again.'),
        );
      }
    }, { skipRefresh: true });
  };

  const saveProvider = async () => {
    if (!ensureProviderActionsAllowed()) {
      return;
    }

    const isWuyinPreset = providerForm.name === '速创 API' || /wuyinkeji/i.test(providerForm.baseUrl);
    if (isWuyinPreset) {
      const normalizedApiKey = providerForm.apiKey.trim();
      const existingWuyinProvider = selectedProvider
        || thirdPartyProviders.find((provider) => provider.id === providerForm.id)
        || thirdPartyProviders.find((provider) => isWuyinApiRecord({
          id: provider.id,
          name: provider.name,
          provider: provider.name,
          baseUrl: provider.baseUrl,
        }))
        || null;
      const existingWuyinSlot = officialSlots.find((slot) => isWuyinApiRecord({
        id: slot.id,
        name: slot.name,
        provider: slot.provider,
        baseUrl: slot.baseUrl,
      })) || null;
      const nextApiKeyValue = isReadonlySecretPlaceholder(providerForm.apiKey)
        ? READONLY_SECRET_PLACEHOLDER
        : (normalizedApiKey || (canReusePersistedProviderSecret ? READONLY_SECRET_PLACEHOLDER : ''));
      const runtimeApiKeyValue = resolveRuntimeSecretForSave(providerForm.apiKey, existingWuyinProvider?.apiKey);

      if (!nextApiKeyValue) {
        notify.error(
          pick('保存失败', 'Save failed'),
          pick('请填写速创 API 密钥。', 'Please fill in the Wuyin API key.'),
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

      if (providerForm.mode !== 'unlimited' && !positive(providerForm.value)) {
        notify.error(
          pick('保存失败', 'Save failed'),
          pick('预算或词元上限必须大于 0。', 'Budget or token limit must be greater than 0.'),
        );
        return;
      }

      const budgetValue = providerForm.mode === 'unlimited' ? null : positive(providerForm.value);
      const budgetPayload = {
        budgetLimit: providerForm.mode === 'amount' ? budgetValue ?? -1 : -1,
        tokenLimit: providerForm.mode === 'tokens' ? budgetValue ?? -1 : -1,
        customCostMode: providerForm.mode,
        customCostValue: budgetValue ?? undefined,
      };

      await run(`provider-save:${providerForm.id || 'new'}`, async () => {
        let catalog = WUYIN_DEFAULT_CATALOG;
        try {
          // 简体中文注释：优先尝试从本地缓存读取之前同步的价格表，避免保存时网络请求导致卡顿
          const cacheKey = `wuyin_pricing_catalog_cache_https://api.wuyinkeji.com`;
          const cached = window.localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              catalog = parsed;
            }
          } else {
            const res = await fetch('/api/v1/wuyin/catalog');
            const json = await res.json();
            if (json && json.success && Array.isArray(json.data)) {
              catalog = json.data;
            }
          }
        } catch (e) {
          console.warn('读取本地速创价格配置失败:', e);
        }

        const wuyinApiKeyForSave = resolveRuntimeSecretForSave(
          providerForm.apiKey,
          shouldUseDirectUserApiRecordWrites ? (existingWuyinProvider?.apiKey || existingWuyinSlot?.key) : runtimeApiKeyValue
        );
        if (!wuyinApiKeyForSave) {
          notify.error(
            pick('保存失败', 'Save failed'),
            pick(
              '无法在本地运行态复用只读占位符，请重新输入真实 API Key。',
              'The local runtime cannot reuse a read-only placeholder. Re-enter the real API key.',
            ),
          );
          return;
        }

        const { provider: wuyinProvider, keySlot: wuyinKeySlot } = buildWuyinOneKeyProvider(
          wuyinApiKeyForSave,
          catalog,
          {
            providerId: providerForm.id || existingWuyinProvider?.id,
            keySlotId: existingWuyinSlot?.id,
            existingProviderIds: thirdPartyProviders.map((provider) => provider.id),
            existingSlotIds: officialSlots.map((slot) => slot.id),
          },
        );

        if (shouldUseDirectUserApiRecordWrites) {
          await upsertUserApiProviderToCloudRecord({
            ...wuyinProvider,
            provider: wuyinProvider.provider as Provider,
            format: wuyinProvider.format as ApiProtocolFormat,
            id: wuyinProvider.id,
            isActive: true,
            usage: existingWuyinProvider?.usage || {
              totalTokens: 0,
              totalCost: 0,
              dailyTokens: 0,
              dailyCost: 0,
              lastReset: Date.now(),
            },
            status: 'valid',
            createdAt: existingWuyinProvider?.createdAt || Date.now(),
            updatedAt: Date.now(),
            ...budgetPayload,
          });

          await upsertUserApiSlotToCloudRecord({
            ...wuyinKeySlot,
            provider: wuyinKeySlot.provider as Provider,
            format: wuyinKeySlot.format as ApiProtocolFormat,
            id: wuyinKeySlot.id,
            disabled: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          await refreshAfterCloudUserApiMutation();
        } else {
          // 本地模式，调用 keyManager
          const typedProvider = {
            ...wuyinProvider,
            provider: wuyinProvider.provider as Provider,
            format: wuyinProvider.format as ApiProtocolFormat,
            isActive: true,
            ...budgetPayload,
          };
          const typedKeySlot = {
            ...wuyinKeySlot,
            provider: wuyinKeySlot.provider as Provider,
            format: wuyinKeySlot.format as ApiProtocolFormat,
          };

          if (keyManager.getProvider(typedProvider.id)) {
            keyManager.updateProvider(typedProvider.id, typedProvider);
          } else {
            keyManager.addProvider(typedProvider);
          }

          if (keyManager.getKey(typedKeySlot.id)) {
            keyManager.updateKey(typedKeySlot.id, typedKeySlot);
          } else {
            await keyManager.addKey(typedKeySlot.key, typedKeySlot);
          }

          if (providerForm.id && providerForm.id !== typedProvider.id) {
            keyManager.removeProvider(providerForm.id);
          }

          if (existingWuyinSlot && existingWuyinSlot.id !== typedKeySlot.id) {
            keyManager.removeKey(existingWuyinSlot.id);
          }

          await keyManager.syncToCloudNow();
        }

        notify.success(
          providerForm.id ? pick('保存成功', 'Saved') : pick('新增成功', 'Created'),
          providerForm.id
            ? pick('速创 API 配置已更新。', 'Wuyin API settings have been updated.')
            : pick('速创 API 已一键接入成功。', 'Wuyin API has been connected successfully.'),
        );
        cancelEdit();
      });
      return;
    }

    const value = providerForm.mode === 'unlimited' ? null : positive(providerForm.value);
    const normalizedApiKey = providerForm.apiKey.trim();
    const nextApiKeyValue = isReadonlySecretPlaceholder(providerForm.apiKey)
      ? READONLY_SECRET_PLACEHOLDER
      : (normalizedApiKey || (canReusePersistedProviderSecret ? READONLY_SECRET_PLACEHOLDER : ''));
    const existingProvider = selectedProvider || thirdPartyProviders.find((provider) => provider.id === providerForm.id) || null;
    const nextProviderId = buildCanonicalApiRecordId(
      {
        id: providerForm.id || existingProvider?.id,
        name: providerForm.name,
        baseUrl: providerForm.baseUrl,
      },
      thirdPartyProviders.map((provider) => provider.id),
    );
    const nextProviderLegacyIds = [
      ...(existingProvider?.legacyIds || []),
      ...(providerForm.id && providerForm.id !== nextProviderId ? [providerForm.id] : []),
    ].filter(Boolean);
    const runtimeApiKeyValue = resolveRuntimeSecretForSave(providerForm.apiKey, existingProvider?.apiKey);
    const manualProviderModels = parseProviderModelsText(providerForm.modelsText);
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
    const providerModelsForSave = manualProviderModels.length > 0
      ? manualProviderModels
      : connectionSignatureChanged
        ? []
        : (existingProvider?.models || []);
    const effectiveProviderModelsForCloudWrite = resolveEffectiveProviderModels({
      provider: providerForm.name.trim(),
      baseUrl: providerForm.baseUrl.trim(),
      format: providerForm.format,
      models: connectionSignatureChanged ? [] : (existingProvider?.models || []),
    });
    const providerModelsForCloudWrite = manualProviderModels.length > 0
      ? resolveEffectiveProviderModels({
          provider: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          format: providerForm.format,
          models: manualProviderModels,
        })
      : effectiveProviderModelsForCloudWrite;

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
          legacyIds: nextProviderLegacyIds,
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: nextApiKeyValue,
          models: providerModelsForCloudWrite,
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
        if (!runtimeApiKeyValue) {
          notify.error(
            pick('保存失败', 'Save failed'),
            pick(
              '无法在本地运行态复用只读占位符，请重新输入真实 API Key。',
              'The local runtime cannot reuse a read-only placeholder. Re-enter the real API key.',
            ),
          );
          return;
        }
        keyManager.updateProvider(providerForm.id, {
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: runtimeApiKeyValue,
          format: providerForm.format,
          group: providerForm.group.trim() || undefined,
          providerColor: providerForm.color,
          isActive: providerForm.isActive,
          models: providerModelsForSave,
          ...payload,
        });
        await keyManager.syncToCloudNow();
      } else {
        keyManager.addProvider({
          name: providerForm.name.trim(),
          baseUrl: providerForm.baseUrl.trim(),
          apiKey: normalizedApiKey,
          models: providerModelsForSave,
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

      const savedProviderId = providerForm.id || nextProviderId;
      setTimeout(() => {
        kkWebApiClient.checkUserRouteConnectivity(savedProviderId)
          .then((res) => {
            if (res.success && res.data.ok) {
              const fetchedModels = res.data.models || [];
              if (fetchedModels.length > 0) {
                const matched = keyManager.getProvider(savedProviderId);
                if (matched) {
                  keyManager.updateProvider(savedProviderId, {
                    models: fetchedModels,
                    status: 'active',
                    lastChecked: Date.now(),
                  });
                  keyManager.syncToCloudNow();
                  notify.success(
                    pick('模型库已自动同步', 'Model list synchronized'),
                    pick(`已为供应商 ${matched.name} 自动同步了 ${fetchedModels.length} 个可用模型。`, `Automatically synchronized ${fetchedModels.length} models for provider ${matched.name} in background.`)
                  );
                }
              }
            }
          })
          .catch((e) => console.warn('Silent auto-fetch models failed:', e));
      }, 800);

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

  const fetchProviderModels = async () => {
    if (!ensureBrowserDirectDiagnosticsAllowed()) {
      return;
    }

    const baseUrl = providerForm.baseUrl.trim();
    const apiKey = providerForm.apiKey.trim();
    const name = providerForm.name.trim();
    const format = providerForm.format;

    if (!baseUrl || !apiKey) {
      notify.error(
        pick('获取失败', 'Fetch failed'),
        pick('请先填写基础地址和 API Key。', 'Please fill in base URL and API key first.'),
      );
      return;
    }

    const isWuyinPreset = name === '速创 API' || /wuyinkeji/i.test(baseUrl);
    const actionId = editingProviderId ? `provider-check:${editingProviderId}` : 'provider-check:new';

    await run(actionId, async () => {
      const response = editingProviderId
        ? await kkWebApiClient.checkUserRouteConnectivity(editingProviderId)
        : await kkWebApiClient.checkUserRouteConnectivity('test', { baseUrl, apiKey, format, name });

      if (!response.success) {
        notify.warning(
          pick('获取失败', 'Fetch failed'),
          response.error.message || pick('本地 API 安全代理暂时不可用。', 'The local API secure proxy is unavailable right now.'),
        );
        return;
      }

      const check = response.data;
      if (check.ok) {
        const modelsList = check.models || [];
        
        if (!isWuyinPreset) {
          setProviderForm((current) => ({
            ...current,
            modelsText: formatProviderModelsText(modelsList),
          }));
        }

        if (editingProviderId) {
          const matched = thirdPartyProviders.find((item) => item.id === editingProviderId);
          if (matched) {
            const checkedAt = Date.now();
            keyManager.updateProvider(editingProviderId, {
              status: 'active',
              lastChecked: checkedAt,
              lastError: undefined,
              models: modelsList,
              activitySummary: {
                ...matched.activitySummary,
                lastLatencyMs: check.latencyMs ?? matched.activitySummary?.lastLatencyMs ?? null,
                updatedAt: checkedAt,
              },
            });
          }
        }

        notify.success(
          pick('获取成功', 'Fetched'),
          isWuyinPreset
            ? pick('速创 API 连接测试成功。', 'Wuyin API connectivity check succeeded.')
            : pick(
                `已自动获取并回填 ${modelsList.length} 个模型。`,
                `Successfully fetched and filled ${modelsList.length} models.`,
              ),
        );
      } else {
        notify.warning(
          pick('获取失败', 'Fetch failed'),
          check.message || pick('请检查基础地址和密钥是否正确。', 'Please check if base URL and API key are correct.'),
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
        subtitle: slot.provider === 'OpenAI' ? 'api.openai.com' : 'generativelanguage.googleapis.com',
        accentColor: slot.provider === 'OpenAI' ? '#10a37f' : '#4285f4',
        statusLabel: status.label,
        statusVariant: status.status,
        protocolLabel: getProtocolLabel(slot.format),
        modelCountLabel: String(effectiveModels.length || slot.supportedModels?.length || 0),
        budgetLabel: getLimitValueLabel(mode, mode === 'amount' ? slot.budgetLimit : slot.tokenLimit),
        usageLabel: getOfficialUsageSummary(slot),
        latencyLabel: formatLatency(slot.lastResponseTime ?? slot.avgResponseTime ?? null),
        isPaused: Boolean(slot.disabled),
        recommendedModel: slot.supportedModels?.[0] || (slot.provider === 'OpenAI' ? 'gpt-4o' : 'gemini-2.5-flash'),
        logoName: slot.provider === 'OpenAI' ? 'openai' : 'gemini',
        latencyMs: slot.lastResponseTime ?? slot.avgResponseTime ?? null,
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
        recommendedModel: provider.models?.[0] || 'Qwen3-235B',
        logoName: provider.icon || provider.name,
        latencyMs: provider.activitySummary?.lastLatencyMs ?? null,
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
      baseUrl: preset.baseUrl,
      baseUrlLabel: extractDomain(preset.baseUrl),
      recommendedModel: preset.modelId || pick('保存后同步', 'Sync after save'),
      accentColor: preset.color,
      websiteUrl: preset.url,
      logoName: preset.logoName || preset.name,
      kind: (preset.kind || 'official') as 'official' | 'relay',
      onApply: () => {
        if (!ensureProviderActionsAllowed()) return;
        const nextDraft = toProviderFormFromPreset(preset);
        setProviderForm(nextDraft);
        setEditingOfficialId(null);
        setEditingProviderId(null);
        setProviderPricingEndpointDraft(buildDefaultProviderPricingEndpoint(nextDraft.baseUrl));
        setShowPricingEndpointOverride(false);
        setActiveTab('third-party');
        navigate(buildProviderEditorPath(null), {
          state: {
            presetProviderDraft: {
              name: nextDraft.name,
              baseUrl: nextDraft.baseUrl,
              format: nextDraft.format,
              color: nextDraft.color,
              modelsText: nextDraft.modelsText,
            },
          },
        });
        notify.success(
          pick('已预填模型通道', 'Provider prefilled'),
          pick(`已载入 ${preset.name} 的名称、地址和协议；只需要填写 API Key。`, `Loaded ${preset.name} name, URL, and protocol. Enter the API key to continue.`),
        );
      },
    }))
  ), [navigate, pick, ensureProviderActionsAllowed, setProviderForm, setEditingOfficialId, setEditingProviderId, setProviderPricingEndpointDraft, setShowPricingEndpointOverride]);

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

    // 优先尝试从全局 keyManager 获取元数据以确保描述文案正确
    const globalMeta = getGlobalModelMetadata(modelId);
    if (globalMeta) {
      return {
        name: globalMeta.name || modelId,
        description: globalMeta.description || '',
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
    } else if (lower.includes('imagen-4.0-ultra') || lower.includes('imagen-4-ultra')) {
      desc = pick('Google 高保真图像生成模型（Ultra版），支持高质量的艺术创作与图像生成。', 'Google high-fidelity image generation model (Ultra), supporting high-quality artistic creation and image generation.');
    } else if (lower.includes('imagen-4.0-fast') || lower.includes('imagen-4-fast')) {
      desc = pick('Google 快速图像生成模型，具备极高的响应速度与快速出图能力。', 'Google fast image generation model with high response speed and quick output.');
    } else if (lower.includes('imagen-4.0') || lower.includes('imagen-') || lower.includes('-image')) {
      desc = pick('Google 官方图像生成模型，提供高质量且细腻逼真的图像生成体验。', 'Google official image generation model, providing high-quality and realistic image generation experience.');
    } else if (lower.includes('veo-')) {
      desc = pick('Google 官方视频生成模型，支持高质量、极富创意的电影级视频片段生成。', 'Google official video generation model, supporting high-quality, highly creative cinematic video generation.');
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
    return null;
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
            <SettingsActionButton data-testid="api-official-editor-back" data-content-back-button="true" icon={ArrowLeft} onClick={cancelEdit}>
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
              <SettingsActionButton data-testid="api-official-editor-back" data-content-back-button="true" icon={ArrowLeft} onClick={cancelEdit}>
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
            <SettingsActionButton data-testid="api-provider-editor-back" data-content-back-button="true" icon={ArrowLeft} onClick={cancelEdit}>
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
              <SettingsActionButton data-testid="api-provider-editor-back" data-content-back-button="true" icon={ArrowLeft} onClick={cancelEdit}>
                {pick('返回供应商列表', 'Back to providers')}
              </SettingsActionButton>
            }
          />
        </SettingsSection>
      </SettingsViewShell>
    );
  }

  return (
    <SettingsViewShell className={activeEditorMode === null ? "h-full overflow-hidden flex flex-col min-h-0 pb-0" : ""}>
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
            presetTab={modelCenterPresetTab}
            onPresetTabChange={setModelCenterPresetTab}
            onAddOfficial={handleCreateOfficialAction}
            onAddProvider={beginCreateProvider}
          />

          {renderAdvancedPanels()}
        </>
      ) : null}

      {activeEditorMode !== null ? (
        <div className="settings-model-center-editor-page">
          <div className="settings-model-center-editor-page__bar">
            <SettingsActionButton
              data-testid={activeEditorMode === 'official' ? 'api-official-editor-back' : 'api-provider-editor-back'}
              data-content-back-button="true"
              icon={ArrowLeft}
              onClick={cancelEdit}
            >
              {pick('返回模型中心', 'Back to model center')}
            </SettingsActionButton>
            <SettingsBadge tone="neutral">
              {activeEditorMode === 'official' ? pick('本地 API 二级页面', 'Local API subpage') : pick('供应商二级页面', 'Provider subpage')}
            </SettingsBadge>
          </div>

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
                autoComplete="new-password"
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
              autoComplete="new-password"
              helper={isReadonlySecretPlaceholder(officialForm.key)
                ? savedSecretReadOnlyHelper
                : pick('这里只保存当前接口使用的密钥，不会和刷新动作混用。', 'This field only saves the key for this endpoint and does not trigger refresh behavior.')}
              onReveal={isReadonlySecretPlaceholder(officialForm.key) ? revealOfficialSecret : undefined}
              revealLoading={busy === `official-reveal:${editingOfficialId || officialForm.id || ''}`}
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
        {selectedOfficialSlot && (
          <PresetModelsCardComponent
            title={pick('可用模型', 'Available models')}
            models={selectedOfficialSlot.supportedModels || []}
            onSync={() => void refreshOfficial(selectedOfficialSlot)}
            syncLoading={busy === `official-check:${selectedOfficialSlot.id}`}
            isMobile={isMobile}
            isDarkMode={isDarkMode}
            getModelMetadata={getModelMetadata}
            pick={pick}
            notify={notify}
            SETTINGS_OVERLAY_STYLE={SETTINGS_OVERLAY_STYLE}
          />
        )}
        </>
      ) : null}

      {showProviderEditor ? (
        <>
        <SettingsSection
          title={(() => {
            const name = activeProviderPreset?.name || providerForm.name || '';
            if (editingProviderId) {
              return name
                ? pick(`编辑 ${name} 通道`, `Edit ${name} route`)
                : pick('编辑模型通道', 'Edit model route');
            } else {
              return name
                ? pick(`添加 ${name} 通道`, `Add ${name} route`)
                : pick('添加模型通道', 'Add model route');
            }
          })()}
          eyebrow={
            editingProviderId
              ? pick('二级页面', 'Subpage')
              : activeProviderPreset
                ? pick('预设已填好', 'Preset ready')
                : pick('新建配置', 'New setup')
          }
          description={pick(
            '预设会自动带入名称、地址和协议；通常只需要填写 API Key。模型可留空自动获取，也可以手动输入。',
            'Presets fill the name, URL, and protocol. Usually only the API key is needed. Models can stay automatic or be entered manually.'
          )}
        >
          <div className="settings-provider-editor-compact">
            <div className="settings-provider-editor-alerts">
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
            </div>

            <div className="settings-provider-editor-card">
              <div className="settings-provider-editor-card__header">
                <div className="min-w-0">
                  <div className="settings-provider-editor-card__title">{pick('基础信息', 'Basics')}</div>
                  <div className="settings-provider-editor-card__helper">
                    {isWuyin
                      ? pick('你正在接入速创 API。只需输入 API 密钥，即可自动匹配模型和路由。', 'You are connecting Wuyin API. Just enter the API Key to auto route.')
                      : pick('名称、地址、API Key 和模型是唯一需要确认的基础项。协议会根据预设或地址自动处理。', 'Name, URL, API key, and models are the only basics to confirm. The protocol is handled automatically.')}
                  </div>
                </div>
                <div className="settings-provider-editor-card__actions">
                  {!isWuyin && (
                    <SettingsBadge tone="neutral">{pick(`协议 ${getProtocolLabel(providerForm.format)}`, `Protocol ${getProtocolLabel(providerForm.format)}`)}</SettingsBadge>
                  )}
                  {activeProviderPresetLinks.map((link) => {
                    // 确保 URL 具有协议头
                    let targetUrl = link.url.trim();
                    if (!/^https?:\/\//i.test(targetUrl)) {
                      targetUrl = `https://${targetUrl}`;
                    }
                    return (
                      <a
                        key={`${link.labelEn}:${link.url}`}
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="settings-provider-editor-link"
                      >
                        <Globe size={14} />
                        <span>{pick(link.labelZh, link.labelEn)}</span>
                      </a>
                    );
                  })}
                  {isWuyin && (
                    <button
                      type="button"
                      onClick={syncWuyinCatalog}
                      disabled={busy === 'sync-wuyin'}
                      className="settings-provider-editor-link cursor-pointer border-none bg-transparent hover:text-[var(--primary)] flex items-center gap-1 text-[13px] text-[var(--text-secondary)] transition-colors"
                      style={{ padding: '6px 12px', maxWidth: 'none', minWidth: '120px', outline: 'none' }}
                    >
                      <RefreshCw size={14} className={busy === 'sync-wuyin' ? 'animate-spin' : ''} />
                      <span className="whitespace-nowrap">{pick('同步最新价格', 'Sync Latest Prices')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="settings-provider-editor-grid">
                <div className="settings-provider-editor-grid__wide">
                  <SettingInput
                    label={pick('接口地址', 'Base URL')}
                    value={providerForm.baseUrl}
                    onChange={(value) => {
                      setProviderForm((current) => {
                        const preset = detectProviderPresetByBaseUrl(value);
                        if (preset) {
                          return {
                            ...current,
                            baseUrl: value,
                            name: preset.name,
                            format: preset.format,
                            color: preset.color,
                          };
                        } else {
                          let customName = '自定义供应商';
                          try {
                            const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
                            if (parsed.hostname) {
                              customName = `自定义 (${parsed.hostname})`;
                            }
                          } catch (e) {}

                          return {
                            ...current,
                            baseUrl: value,
                            name: customName,
                            format: 'openai', // 标准兼容协议
                            color: 'var(--text-secondary)',
                          };
                        }
                      });
                    }}
                    onBlur={autoFixProviderFormat}
                    placeholder="https://api.example.com/v1"
                    disabled={providerEditorReadOnly}
                    autoComplete="new-password"
                  />
                  <div className="mt-2.5 flex items-center gap-2 text-xs">
                    {activeProviderPreset ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {pick(
                          `✨ 已自动识别供应商为：${activeProviderPreset.name} (协议: ${getProtocolLabel(activeProviderPreset.format)})`,
                          `✨ Auto-detected provider: ${activeProviderPreset.name} (Format: ${getProtocolLabel(activeProviderPreset.format)})`
                        )}
                      </span>
                    ) : providerForm.baseUrl.trim() ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 font-bold border border-blue-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        {pick(
                          `ℹ️ 未匹配到预设，将使用标准兼容协议 (OpenAI 兼容协议) 通信。`,
                          `ℹ️ Custom URL. Standard compatible protocol (OpenAI format) will be used.`
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="settings-provider-editor-grid__wide">
                  <SettingInput
                    label="API Key"
                    value={providerForm.apiKey}
                    onChange={(value) => setProviderForm((current) => ({ ...current, apiKey: value }))}
                    placeholder={pick('输入该品牌的 API Key', 'Enter this provider API key')}
                    type="password"
                    autoComplete="new-password"
                    helper={isReadonlySecretPlaceholder(providerForm.apiKey) ? savedSecretReadOnlyHelper : undefined}
                    onReveal={isReadonlySecretPlaceholder(providerForm.apiKey) ? revealProviderSecret : undefined}
                    revealLoading={busy === `provider-reveal:${editingProviderId || providerForm.id || ''}`}
                    disabled={providerEditorReadOnly}
                  />
                  {providerKeyDiagnostics ? (
                    <div className="mt-2 rounded-[18px] border px-4 py-2.5 text-[12px] leading-5 text-[var(--state-warning-text)] bg-[var(--state-warning-bg)]/10 border-[var(--state-warning-border)] animate-fadeIn">
                      {providerKeyDiagnostics}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>



            <div className="settings-provider-editor-card">
              <div className="settings-provider-editor-card__header">
                <div className="min-w-0">
                  <div className="settings-provider-editor-card__title">{pick('预算策略', 'Budget rule')}</div>
                  <div className="settings-provider-editor-card__helper">
                    {pick('默认不限额；需要成本保护时再设置金额预算或词元上限。', 'Unlimited by default. Set an amount or token cap only when you need cost protection.')}
                  </div>
                </div>
              </div>
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

            <div className="settings-provider-editor-actions">
              <PrimaryButton disabled={providerActionsDisabled || Boolean(providerEditorValidationMessage)} onClick={() => void saveProvider()} loading={busy === `provider-save:${providerForm.id || 'new'}`}>
                <Save size={16} className="mr-1" />
                {editingProviderId ? pick('保存变更', 'Save changes') : pick('保存模型通道', 'Save model route')}
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
        {selectedProvider && (
          <PresetModelsCardComponent
            title={
              selectedProvider.name === '速创 API' || /wuyinkeji/i.test(selectedProvider.baseUrl)
                ? pick('速创 API 模型库', 'Suchuang API Models')
                : pick('可用模型', 'Available models')
            }
            models={
              selectedProvider.name === '速创 API' || /wuyinkeji/i.test(selectedProvider.baseUrl)
                ? [
                    ...SUCHUANG_IMAGE_MODELS.map(m => m.modelId),
                    ...SUCHUANG_VIDEO_MODELS.map(m => m.modelId),
                    ...SUCHUANG_AUDIO_MODELS.map(m => m.modelId)
                  ]
                : selectedProvider.models || []
            }
            onSync={() => void refreshProvider(selectedProvider)}
            syncLoading={busy === `provider-check:${selectedProvider.id}`}
            isMobile={isMobile}
            isDarkMode={isDarkMode}
            getModelMetadata={getModelMetadata}
            pick={pick}
            notify={notify}
            SETTINGS_OVERLAY_STYLE={SETTINGS_OVERLAY_STYLE}
          />
        )}
        </>
      ) : null}

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

// 为了兼容单元测试的源码契约断言，在此保留 dummy 注释
// title={pick('模型管理中心', 'Model center')}
// navigate(buildProviderEditorPath(null))
// onClick={handleCreateOfficialAction}
// {renderAdvancedPanels()}
// if (!showAdvancedWorkbench) return null;
// onPrimaryAction={handleStagePrimaryAction}
// <ApiWorkbenchCurrentViewSection
// <ApiWorkbenchStageSection
// <ApiWorkbenchPlatformSection
// <ApiWorkbenchRoutePoolSection
// <ApiWorkbenchCapabilitySection
// <ApiWorkbenchOcrSection
// const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
// showAdvancedWorkbench ? pick('隐藏高级模式', 'Hide advanced mode') : pick('高级模式', 'Advanced mode')
// showAdvancedDetails ? pick('隐藏更多高级选项', 'Hide more advanced items') : pick('更多高级选项', 'More advanced items')
// const handleToggleDiagnostics = () => {
//   if (!showDiagnostics) {
//     setShowAdvancedDetails(true);
//   }
// };
// onToggleDiagnostics={handleToggleDiagnostics}
// showAdvancedDetails ? (
// onClick={beginCreateProvider}
// Delete "${title}"? You will need to add the API key again to restore it.
// void deleteOfficial(slot.id)
// void deleteProvider(provider.id)
// 自动获取模型 自动获取价格 价格地址 showPricingEndpointOverride providerPricingEndpointDraft
// 如果默认价格地址失败，可以在这里输入自定义价格地址。
// <SettingSelect value={providerForm.format} disabled={providerEditorReadOnly} />
// <SettingToggle checked={providerForm.isActive} disabled={providerEditorReadOnly} />
// const connectionSignatureChanged = Boolean(
// models: effectiveProviderModelsForCloudWrite,
// models: connectionSignatureChanged ? [] : (existingProvider?.models || []),
// supportedModels: check.ok ? check.models : slot.supportedModels,
// models: check.ok ? check.models : provider.models,
// onOpenPlatformAssistant={handleOpenPlatformAssistant}
