/**
 * API Key Manager Service
 *
 * Provides multi-key rotation, status monitoring, and automatic failover.
 * Similar to Gemini Balance but runs entirely on frontend.
 * NOW SUPPORTS: Cloud-backed Sync & Third-Party API Proxies
 */
import { subscribeAuthSessionChange } from './authSessionEvents';
import {
    clearCloudSyncPendingFlagsOnRevisionMatch,
    clearPendingCloudRetry,
    createKeyManagerCloudSyncState,
    hasPendingCloudSync,
    markPendingProviderCloudSync,
    markPendingStateCloudSync,
    resetCloudSyncState,
    schedulePendingCloudRetry,
} from './keyManagerCloudSync';
import {
    BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,
    createBrowserDirectProviderChecksDisabledError,
    getKeyManagerStorageKey,
    isBrowserRuntime,
    purgeAnonymousSensitiveLocalCaches,
    shouldAllowSessionlessLocalUserApiStorage,
    type ProviderStorageScope,
    USER_API_LOGIN_REQUIRED_MESSAGE,
} from './keyManagerStorage';
import {
    loadProvidersFromLocal,
    mergeCloudProvidersWithLocalRuntimeState,
    persistProvidersLocal,
} from './keyManagerProviders';
import {
    findLinkedProviderForSlot,
    findProviderLinkedSlots,
    normalizeProviderLinkValue,
    normalizeStoredProviders,
} from './keyManagerProviderLinks';
import {
    buildEffectiveSlotFromProvider,
    resolveProviderBudgetLimit,
    resolveProviderTokenLimit,
} from './keyManagerEffectiveSlot';
import {
    applyProviderUsageDeltaToProvider,
    isUsageLimitExceeded,
} from './keyManagerProviderUsage';
import {
    buildProviderRouteId,
    buildStableSystemRouteId,
    buildUserSlotRouteId,
    decodeRouteSuffix,
    extractSlotRouteTarget,
    matchesProviderRouteSuffix,
    matchesSlotRouteSuffix,
} from './keyManagerRouteIds';
import { sanitizeAsciiApiKey } from './keyManagerCredentialSanitizer';
import { getRedactedChannelConfigApiKey } from './keyManagerChannelConfigSecrets';
import { buildKeyUpdateDiagnosticPayload } from './keyManagerUpdateDiagnostics';
import { buildSilentProviderPricingUrl } from './keyManagerPricingUrl';
import { buildChannelCapabilities } from './keyManagerChannelCapabilities';
import { detectApiType } from './keyManagerApiType';
import {
    DEFAULT_OPENAI_MODELS,
} from './keyManagerDefaultModels';
import {
    normalizeModelList,
} from './keyManagerModelList';
import {
    getDefaultOfficialModelsForRuntime,
    resolveEffectiveProviderModels,
} from './keyManagerEffectiveProviderModels';
import { getDocumentedStaticModelsForProvider, PROVIDER_PRESETS } from './keyManagerProviderPresets';
import {
    buildPricingSnapshotFromSharedCache,
    buildSharedPricingItemsFromRawCatalog,
} from './keyManagerSharedPricing';
import {
    buildGoogleModelDiscoveryResult,
    buildOpenAICompatModelDiscoveryResult,
    type OpenAICompatModelDiscoveryMetadata,
    extractGeminiCompatModelIds,
} from './keyManagerRemoteModelDiscovery';
import { registerCapabilityRouteKeyManager } from '../api/capabilityRouteAssignments';
export {
    DEFAULT_GOOGLE_MODELS,
    DEFAULT_OPENAI_MODELS,
    GOOGLE_IMAGE_WHITELIST,
    VIDEO_MODEL_WHITELIST,
    ADVANCED_IMAGE_MODEL_WHITELIST,
    AUDIO_MODEL_WHITELIST,
} from './keyManagerDefaultModels';
export {
    BLACKLIST_MODELS,
    normalizeModelList,
} from './keyManagerModelList';
export { resolveEffectiveProviderModels } from './keyManagerEffectiveProviderModels';
export { getDocumentedStaticModelsForProvider, PROVIDER_PRESETS } from './keyManagerProviderPresets';
import {
    applyOpenAICompatAuthToUrl,
    type ApiProtocolFormat,
    type AuthMethod,
    buildGeminiHeaders,
    buildGeminiModelsEndpoint,
    buildOpenAIEndpoint,
    buildProxyHeaders,
    formatAuthorizationHeaderValue,
    GOOGLE_API_BASE,
    getDefaultAuthMethod,
    normalizeApiProtocolFormat,
    resolveApiProtocolFormat,
} from '../api/apiConfig';
import { buildUserFacingApiErrorMessage, classifyApiFailure, hasAuthErrorMarkers } from '../api/errorClassification';
import { resolveProviderModelCompatibilityIssue, resolveProviderRuntime } from '../api/providerStrategy';
import type { ChannelConfig } from '../api/channelConfig';
import { buildChannelSurfaceView } from '../api/providerChannelSurfaceView.ts';
import {
    compactUserApisPayloadForTransport,
    extractKeyManagerCloudSlots,
    extractUserApiProvidersFromPayload,
    isUserApisEnvelope,
} from '../api/userApiPayload';
import {
    getUserApisPayloadDensity,
} from '../api/userApiCloudRecordStorage';
import {
    isKkApiPersistenceUnavailableError,
} from '../api/kkApiServerHealth';
import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from '../api/kkApiClient';
import { getPreferredKkApiAccessToken } from '../api/authAccessToken';
import { MODEL_PRESETS, CHAT_MODEL_PRESETS } from '../model/modelPresets';
import type { Provider } from '../../types';
import { getLatestRuntimeAuthState } from './runtimeAuthState';
import { MODEL_REGISTRY } from '../model/modelRegistry';
import { adminModelService } from '../model/adminModelService'; // 完成 [API Key 轮换历史记录清理]
import { requestCostSync } from '../billing/costSyncBridge';
import { buildProviderPricingSnapshot, mergeProviderPricingSnapshot, type ProviderPricingSnapshot } from './providerPricingSnapshot';
import {
    cacheProviderPricingByBaseUrl,
    fetchRawPricingCatalog,
    fetchWuyinPricingCatalog,
    getCachedPricingByBaseUrl,
    selectWuyinGeneratableCatalogModels,
} from '../billing/newApiPricingService';
import { applyModelPricingOverrides } from '../model/modelPricingOverrideBridge';
import { notify } from '../system/notificationService';
import { isStartupStageReady, type AppStartupStage } from '../system/appStartup';
import { resolveModelDisplayName } from '../../utils/modelDisplayName';
import {
    categorizeModels,
    extractModelIdsFromPricingData,
    inferModelType,
    isGoogleOfficialModelId,
    MODEL_MIGRATION_MAP,
    parseModelString,
} from './keyManagerModelHelpers';
import type { GlobalModelType } from './keyManagerModelHelpers';
import { determineKeyType } from './keyManagerKeyType';
export {
    parseModelString,
    MODEL_MIGRATION_MAP,
    DEPRECATED_MODELS,
    normalizeModelId,
    parseModelVariantMeta,
    appendModelVariantLabel,
    categorizeModels,
    isDeprecatedModel,
    isGoogleOfficialModelId,
} from './keyManagerModelHelpers';
export type { ModelVariantMeta, GlobalModelType } from './keyManagerModelHelpers';
export { determineKeyType } from './keyManagerKeyType';
export { detectApiType } from './keyManagerApiType';

const RATE_LIMIT_COOLDOWN_MS = 30 * 1000;

export interface KeySlot {
    id: string;
    key: string;
    name: string;
    provider: Provider; // 注意: Updated to strict type
    type: 'official' | 'proxy' | 'third-party'; // 注意: New field for categorization
    format: ApiProtocolFormat;

    // Provider Specific Config
    providerConfig?: {
        region?: string;      // AWS/Volcengine/Aliyun regions
        endpointId?: string;  // Volcengine Endpoint ID
        bucketName?: string;  // Object Storage bucket
        baseUrl?: string;     // Custom base URL (e.g. for proxies)
    };

    // Channel Configuration
    baseUrl?: string;        // Custom base URL (e.g. for proxies)
    group?: string;          // Group selection for proxies
    compatibilityMode?: 'standard' | 'chat'; // 'standard' = /v1/images, 'chat' = /v1/chat
    supportedModels: string[]; // List of model IDs this channel supports

    // Proxy Specific
    proxyConfig?: {
        serverName?: string;
    };

    // Auth Configuration
    authMethod?: AuthMethod; // 'query' | 'header'
    headerName?: string;     // Custom header name (default: x-goog-api-key)
    customHeaders?: Record<string, string>; // Provider-specific custom request headers
    customBody?: Record<string, any>; // Provider-specific custom request body template

    // Advanced Configuration (NEW)
    weight?: number;         // 权重 (1-100), 请求时优先选择,默认为0
    timeout?: number;        // 请求超时 (ms), 默认为10000
    maxRetries?: number;     // 最大重试次数, 默认为3
    retryDelay?: number;     // 重试延迟(ms), 默认为1000

    // Status & Usage
    status: 'valid' | 'invalid' | 'rate_limited' | 'unknown';
    failCount: number;
    successCount: number;
    lastUsed: number | null;
    lastError: string | null;
    disabled: boolean;
    createdAt: number;

    // Performance Metrics (NEW)
    avgResponseTime?: number;    // 平均响应时间计算窗口(ms)
    lastResponseTime?: number;   // 上次响应时间(ms)
    successRate?: number;        // 成功率(0-100)
    totalRequests?: number;      // 总请求次数

    // Call History (NEW)
    recentCalls?: Array<{
        timestamp: number;
        success: boolean;
        responseTime: number;
        model?: string;
        error?: string;
    }>;

    // Metrics
    usedTokens?: number;
    totalCost: number;
    budgetLimit: number; // -1 for unlimited
    tokenLimit?: number; // 注意: New: -1 for unlimited
    creditCost?: number; // 完成 [API Isolation] User-defined custom cost per generation

    // Sync
    updatedAt?: number; // Timestamp of last modification for sync conflict resolution
    quota?: {
        limitRequests: number;
        remainingRequests: number;
        resetConstant?: string;
        resetTime: number;
        updatedAt: number;
    };
    cooldownUntil?: number; // temporary cooldown for auto-failover
}


interface KeyManagerState {
    slots: KeySlot[];
    currentIndex: number;
    maxFailures: number;
    rotationStrategy: 'round-robin' | 'sequential'; // New strategy field
}

/**
 * 专门用于API密钥轮询服务
 * 类似Gemini Balance但完全运行在前端，现在也支持OpenAI格式的API
 */
export interface ThirdPartyProvider {
    id: string;
    name: string;                 // Display name, for example "Zhihui AI"
    baseUrl: string;              // API base URL
    apiKey: string;               // API Key
    group?: string;
    models: string[];             // Supported model list
    format: ApiProtocolFormat;    // Protocol format
    icon?: string;                // Optional emoji icon
    isActive: boolean;            // Whether the provider is active
    providerColor?: string;
    badgeColor?: string;
    budgetLimit?: number;
    tokenLimit?: number;
    customCostMode?: 'unlimited' | 'amount' | 'tokens';
    customCostValue?: number;

    // Cache of pricing data fetched from the provider's pricing endpoint
    pricingSnapshot?: ProviderPricingSnapshot;
    activitySummary?: {
        lastLatencyMs?: number | null;
        lastTokens?: number | null;
        lastAmount?: number | null;
        updatedAt?: number | null;
    };

    // Independent usage accounting
    usage: {
        totalTokens: number;
        totalCost: number;
        dailyTokens: number;
        dailyCost: number;
        lastReset: number;        // Daily reset timestamp
    };

    // Runtime status
    status: 'active' | 'error' | 'checking';
    lastError?: string;
    lastChecked?: number;

    // Metadata
    createdAt: number;
    updatedAt: number;
}

const DEFAULT_MAX_FAILURES = 3;
const CLOUD_SYNC_POLL_INTERVAL_MS = 60 * 1000;

const GOOGLE_HEADER_NAME = 'x-goog-api-key';

const GOOGLE_CHAT_MODELS = [
    // Gemini 3.5 series
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', icon: '⚡', description: '最智能的 Flash 模型，可在智能体和编码任务中提供前沿性能。' },
    // Gemini 3 / 3.1 series - advanced reasoning
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro 预览', icon: '💎', description: '具备先进的智能、复杂的问题解决能力，以及强大的智能体和氛围编码能力。' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', icon: '⚡', description: '前沿级性能，可与大型模型相媲美，但成本却低得多。' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro 预览', icon: '🚀', description: '更强推理与复杂任务能力，适合专业工作流。' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash 预览', icon: '⚡', description: '前沿级性能，可与大型模型相媲美，但成本却低得多。' },
    // Gemini 2.5 series - best value
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: '🧠', description: '最强推理模型，擅长代码、数学、STEM 复杂任务。' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡', description: '速度优先，适合高并发与快速响应场景。' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', icon: '🔹', description: '速度快、最具成本效益的多模态模型。' },
    // Multimodal models
    { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', icon: '🍌🍌', description: '第二代 Nano Banana 图像模型，参考图与高清能力更强。' },
    { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', icon: '🍌', description: '高质量 Nano Banana Pro 预览图像模型。' },
    { id: 'gemini-2.5-flash-image', name: 'Nano Banana', icon: '🍌', description: '经典 Nano Banana 快速出图模型。' },
];

type ModelMetadata = {
    name: string;
    description?: string;
    icon?: string;
    contextLength?: number;
    pricing?: { prompt: string; completion: string; image?: string; request?: string };
    endpointType?: string;
    endpointTypes?: string[];
};

const REMOTE_MODEL_METADATA = new Map<string, ModelMetadata>();

const GOOGLE_MODEL_METADATA = new Map<string, ModelMetadata>(
    GOOGLE_CHAT_MODELS.map(model => [model.id, { name: model.name, description: model.description, icon: model.icon }])
);

function toModelMetadata(metadata: OpenAICompatModelDiscoveryMetadata): ModelMetadata {
    return {
        name: metadata.name || '',
        description: metadata.description,
        endpointType: metadata.endpointType,
        endpointTypes: metadata.endpointTypes,
    };
}

function registerRemoteModelMetadata(metadataByModelId?: Record<string, OpenAICompatModelDiscoveryMetadata>): void {
    Object.entries(metadataByModelId || {}).forEach(([modelId, metadata]) => {
        const normalizedModelId = String(modelId || '').trim();
        if (!normalizedModelId) return;

        const existing = REMOTE_MODEL_METADATA.get(normalizedModelId);
        REMOTE_MODEL_METADATA.set(normalizedModelId, {
            ...(existing || {}),
            ...toModelMetadata(metadata),
            name: metadata.name || existing?.name || normalizedModelId,
        });
    });
}

const MODEL_TYPE_MAP = new Map<string, GlobalModelType>();
GOOGLE_CHAT_MODELS.forEach(model => MODEL_TYPE_MAP.set(model.id, 'chat'));
MODEL_PRESETS.forEach(preset => MODEL_TYPE_MAP.set(preset.id, preset.type));

// Mark Gemini image models as multimodal
MODEL_TYPE_MAP.set('gemini-2.5-flash-image', 'image+chat');
MODEL_TYPE_MAP.set('gemini-3.1-flash-image-preview', 'image+chat');
MODEL_TYPE_MAP.set('gemini-3-pro-image-preview', 'image+chat');

// Set Imagen 4.0 model types
MODEL_TYPE_MAP.set('imagen-4.0-generate-001', 'image');
MODEL_TYPE_MAP.set('imagen-4.0-ultra-generate-001', 'image');
MODEL_TYPE_MAP.set('imagen-4.0-fast-generate-001', 'image');

// Set Veo 3.1 model types
MODEL_TYPE_MAP.set('veo-3.1-generate-preview', 'video');
MODEL_TYPE_MAP.set('veo-3.1-fast-generate-preview', 'video');
MODEL_TYPE_MAP.set('veo-3.1-lite-generate-preview', 'video');

MODEL_PRESETS.filter(preset => preset.provider === 'Google').forEach(preset => {
    if (!GOOGLE_MODEL_METADATA.has(preset.id)) {
        GOOGLE_MODEL_METADATA.set(preset.id, { name: preset.label, description: preset.description });
    }
});

// Add Imagen 4.0 / Veo 3.1 metadata
GOOGLE_MODEL_METADATA.set('imagen-4.0-generate-001', { name: 'Imagen 4.0 标准版', icon: '🎨', description: 'Google 官方图像生成模型标准版，提供画面稳定且细节丰富的高清图像生成体验' });
GOOGLE_MODEL_METADATA.set('imagen-4.0-ultra-generate-001', { name: 'Imagen 4.0 Ultra', icon: '💎', description: 'Google 旗舰高保真图像生成模型，支持极高质量的专业级艺术创作与图像生成' });
GOOGLE_MODEL_METADATA.set('imagen-4.0-fast-generate-001', { name: 'Imagen 4.0 快速版', icon: '⚡', description: 'Google 快速图像生成模型，具备极高的响应速度与高效率出图能力' });
GOOGLE_MODEL_METADATA.set('veo-3.1-generate-preview', { name: 'Veo 3.1', icon: '🎬', description: '前沿电影级视频生成模型，具有高级创意控件和原生同步音频' });
GOOGLE_MODEL_METADATA.set('veo-3.1-fast-generate-preview', { name: 'Veo 3.1 Fast', icon: '⚡', description: 'Veo 3.1 视频生成快速版，提供高效、低成本的创意流媒体控制' });
GOOGLE_MODEL_METADATA.set('veo-3.1-lite-generate-preview', { name: 'Veo 3.1 Lite', icon: '🎬', description: 'Veo 3.1 系列的高效、低成本、开发者优先的视频生成与编辑模型' });

// Custom name overrides for whitelisted models
GOOGLE_MODEL_METADATA.set('gemini-2.5-flash-image', { name: 'Nano Banana', icon: '\u{1F34C}', description: 'Gemini 2.5 Flash Image (Custom)' });
GOOGLE_MODEL_METADATA.set('gemini-3.1-flash-image-preview', { name: 'Nano Banana 2', icon: '\u{1F34C}', description: 'Gemini 3.1 Flash Image Preview (Custom)' });
GOOGLE_MODEL_METADATA.set('gemini-3-pro-image-preview', { name: 'Nano Banana Pro', icon: '\u{1F34C}', description: 'Gemini 3 Pro Image (Custom)' });

export const getModelMetadata = (modelId: string): ModelMetadata | undefined => {
    const exactId = String(modelId || '').trim();
    const baseId = exactId.split('@')[0];
    const remoteMetadata = REMOTE_MODEL_METADATA.get(exactId)
        || REMOTE_MODEL_METADATA.get(baseId);

    if (exactId) {
        const exactModel = keyManager.getGlobalModelList().find(model => model.id === exactId);
        if (exactModel) {
            return {
                name: remoteMetadata?.name || resolveModelDisplayName(exactId, exactModel.name),
                icon: exactModel.icon,
                description: remoteMetadata?.description || exactModel.description,
                endpointType: remoteMetadata?.endpointType || exactModel.endpointType,
                endpointTypes: remoteMetadata?.endpointTypes || exactModel.endpointTypes,
            };
        }
    }

    if (remoteMetadata) {
        return remoteMetadata;
    }

    const exactAdminModel = adminModelService.getModel(exactId);
    if (exactAdminModel) {
        return {
            name: exactAdminModel.displayName,
            description: exactAdminModel.advantages
        };
    }

    return GOOGLE_MODEL_METADATA.get(baseId);
};

// Register Chat Model Presets
CHAT_MODEL_PRESETS.forEach(preset => {
    if (!GOOGLE_MODEL_METADATA.has(preset.id)) {
        GOOGLE_MODEL_METADATA.set(preset.id, { name: preset.label, description: preset.description });
    }
});

export class KeyManager {
    private state: KeyManagerState;
    private listeners: Set<() => void> = new Set();
    private userId: string | null = null;
    private authIsTempUser = false;
    private sessionlessLocalUserApiStorageEnabled = false;
    private isSyncing = false;
    private cloudSyncBackoffUntil = 0;
    private hasHydratedCloudState = false;
    private startupStage: AppStartupStage = 'background_ready';
    private providerStorageScope: ProviderStorageScope = 'none';
    private cloudSyncState = createKeyManagerCloudSyncState();
    private pendingCloudSyncPromise: Promise<void> | null = null;

    // Cached global model list snapshot
    private globalModelListCache: {
        models: any[];
        slotsHash: string;
        timestamp: number;
    } | null = null;
    private readonly CACHE_TTL = 5000; // 5 seconds

    constructor() {
        this.bootstrapSessionlessLocalUserApiStorage();
        this.state = this.loadState();
        // Ensure strategy exists for legacy state
        if (!this.state.rotationStrategy) {
            this.state.rotationStrategy = 'round-robin';
        }

        // Ensure loaded slots have sane defaults
        this.state.slots = this.state.slots.map(s => ({
            ...s,
            disabled: s.disabled ?? false,
            status: s.status || 'valid'
        }));

        this.loadProviders();
        this.providers.forEach((provider) => {
            this.syncLegacySlotsWithProvider(provider);
        });

        // Keep downstream UI in sync when admin model routes change.
        adminModelService.subscribe(() => {
            console.log('[KeyManager] Admin models updated, notifying listeners');
            this.notifyListeners();
        });

        subscribeAuthSessionChange((detail) => {
            this.authIsTempUser = detail.isTempUser;

            if (detail.isTempUser || !detail.hasSession) {
                return;
            }

            if (detail.userId && this.userId && detail.userId !== this.userId) {
                return;
            }

            if (!this.hasPendingCloudSync()) {
                return;
            }

            this.cloudSyncBackoffUntil = 0;
            void this.flushPendingCloudSync();
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                if (!this.hasPendingCloudSync()) {
                    return;
                }

                this.cloudSyncBackoffUntil = 0;
                void this.flushPendingCloudSync();
            });
        }
    }

    private bootstrapSessionlessLocalUserApiStorage(): void {
        if (!shouldAllowSessionlessLocalUserApiStorage()) {
            return;
        }

        const runtimeState = getLatestRuntimeAuthState();
        if (!runtimeState.isTempUser) {
            return;
        }

        const runtimeUserId = String(runtimeState.user?.id || '').trim();
        if (!runtimeUserId) {
            return;
        }

        this.userId = runtimeUserId;
        this.authIsTempUser = true;
        this.sessionlessLocalUserApiStorageEnabled = true;
    }

    private getStorageKey(): string {
        return getKeyManagerStorageKey(this.userId);
    }

    private canUseSessionlessLocalUserApiStorage(): boolean {
        return this.sessionlessLocalUserApiStorageEnabled && Boolean(this.userId);
    }

    private purgeAnonymousSensitiveLocalCaches(): void {
        purgeAnonymousSensitiveLocalCaches();
    }

    private ensureAuthenticatedUserApiMode(): string | null {
        if (this.userId) {
            return null;
        }

        return USER_API_LOGIN_REQUIRED_MESSAGE;
    }

    /**
     * Add token usage to a key and update cost
     * Track token usage for a key and keep its cost counters in sync.
     */
    addUsage(keyId: string, tokens: number): void {
        const now = Date.now();
        const slot = this.state.slots.find(s => s.id === keyId);
        let stateChanged = false;
        if (slot) {
            slot.usedTokens = (slot.usedTokens || 0) + tokens;
            slot.updatedAt = now; // Update timestamp
            stateChanged = true;

            // Check budget and emit a diagnostic when the budget ceiling is reached.
            if (slot.budgetLimit > 0 && slot.totalCost >= slot.budgetLimit) {
                console.log(`[KeyManager] API ${slot.name} 已达到预算上限 ($${slot.totalCost.toFixed(2)}/$${slot.budgetLimit})`);
                // Removed strategy-based rotation, now handled by external logic or just disabled
            }
            if ((slot.tokenLimit || -1) > 0 && (slot.usedTokens || 0) >= (slot.tokenLimit || -1)) {
                console.log(`[KeyManager] API ${slot.name} token quota exhausted (${slot.usedTokens}/${slot.tokenLimit})`);
            }
        }

        const linkedProvider = this.getProviderForKeySlot(keyId);
        const providerChanged = linkedProvider ? !!this.applyProviderUsageDelta(linkedProvider.id, tokens, 0) : false;

        if (!stateChanged && !providerChanged) return;

        if (stateChanged) {
            this.saveState();
        }
        if (providerChanged) {
            this.saveProviders();
        }
        this.notifyListeners();
    }




    /**
     * Load state from localStorage
     */
    private loadState(): KeyManagerState {
        if (this.userId && !this.authIsTempUser) {
            this.purgeAnonymousSensitiveLocalCaches();
        }

        try {
            const key = this.getStorageKey();
            const isTemp = this.authIsTempUser || !this.userId;
            const isOffline = !this.hasHydratedCloudState;
            const stored = localStorage.getItem(key);

            if (stored && (isTemp || isOffline)) {
                const parsed = JSON.parse(stored);
                // Migration for existing keys
                const slots = (parsed.slots || []).map((s: any) => {
                    const provider = s.provider || 'Google';
                    const baseUrl = s.baseUrl || '';
                    const keyType = determineKeyType(provider, baseUrl);
                    const format = normalizeApiProtocolFormat(
                        s.format,
                        provider === 'Google' && keyType === 'official' ? 'gemini' : 'auto'
                    );
                    const runtime = resolveProviderRuntime({
                        provider,
                        baseUrl,
                        format,
                        authMethod: s.authMethod,
                        headerName: s.headerName,
                        compatibilityMode: s.compatibilityMode,
                    });
                    const authMethod = runtime.authMethod as AuthMethod;
                    const shouldOverrideHeader = !s.headerName || (
                        s.headerName === GOOGLE_HEADER_NAME &&
                        provider !== 'Google' &&
                        !baseUrl.toLowerCase().includes('google')
                    );
                    const headerName = shouldOverrideHeader ? runtime.headerName : s.headerName;
                    const rawModels = Array.isArray(s.supportedModels) ? s.supportedModels : [];
                    const builtInOfficialModels = getDefaultOfficialModelsForRuntime(runtime);
                    let supportedModels = builtInOfficialModels.length > 0 && rawModels.length === 0
                        ? [...builtInOfficialModels]
                        : rawModels;

                    // Official Google keys should only keep canonical official model IDs.
                    if (provider === 'Google') {
                        supportedModels = supportedModels.filter((m: string) => isGoogleOfficialModelId(parseModelString(m).id));
                    }

                    if (builtInOfficialModels.length > 0) {
                        const missingDefaults = builtInOfficialModels.filter(m => !supportedModels.includes(m));
                        if (missingDefaults.length > 0) {
                            console.log(`[KeyManager] Auto-adding missing official models to key ${s.name}:`, missingDefaults);
                            supportedModels = [...supportedModels, ...missingDefaults];
                        }
                    }

                    // Normalize and deduplicate the supported model list before storing it.
                    supportedModels = normalizeModelList(supportedModels, provider, baseUrl);

                    return {
                        ...s,
                        name: s.name || 'Unnamed Channel',
                        provider: (provider as Provider),
                        totalCost: s.totalCost || 0,
                        budgetLimit: s.budgetLimit !== undefined ? s.budgetLimit : -1,
                        tokenLimit: s.tokenLimit !== undefined ? s.tokenLimit : -1, // Default unlimited
                        type: s.type || keyType,
                        format,
                        baseUrl,
                        authMethod,
                        headerName,
                        compatibilityMode: runtime.compatibilityMode,
                        supportedModels,
                        disabled: s.disabled ?? false,
                        status: s.status || 'valid',
                        updatedAt: s.updatedAt || s.createdAt || Date.now() // Backfill updatedAt
                    };
                });

                const state: KeyManagerState = {
                    slots,
                    currentIndex: 0,
                    maxFailures: DEFAULT_MAX_FAILURES,
                    rotationStrategy: parsed.rotationStrategy || this.state?.rotationStrategy || 'round-robin'
                };

                return state;
            }

            if (this.userId && !isTemp && !isOffline) {
                localStorage.removeItem(key);
                return {
                    slots: [],
                    currentIndex: 0,
                    maxFailures: DEFAULT_MAX_FAILURES,
                    rotationStrategy: 'round-robin'
                };
            }
        } catch (e) {
            console.warn('[KeyManager] Load failed:', e);
        }

        // Return empty state if nothing found (Fresh user / Fresh storage)
        return {
            slots: [],
            currentIndex: 0,
            maxFailures: DEFAULT_MAX_FAILURES,
            rotationStrategy: 'round-robin'
        };
    }

    /**
     * Save state for the active user without restoring browser-side plain-text secrets.
     */
    private async saveState(state?: KeyManagerState): Promise<void> {
        const toSave = state || this.state;
        const key = this.getStorageKey();

        try {
            const isTemp = this.authIsTempUser || !this.userId;
            const isOffline = !this.hasHydratedCloudState;

            if (isTemp || isOffline) {
                localStorage.setItem(key, JSON.stringify({
                    slots: toSave.slots,
                    rotationStrategy: toSave.rotationStrategy
                }));
                console.log('[KeyManager] Saved fallback slots state to LocalStorage');
            } else {
                localStorage.removeItem(key);
            }

            if (this.userId) {
                markPendingStateCloudSync(this.cloudSyncState);
                await this.flushPendingCloudSync(toSave);
            }
        } catch (e) {
            console.error('[KeyManager] Failed to save state:', e);
        }
    }

    /**
     * Get current user ID
     */
    getUserId(): string | null {
        return this.userId;
    }

    /**
     * Set user ID and sync with cloud
     */
    async setUserId(
        userId: string | null,
        options?: {
            sessionlessLocalUserApiStorageEnabled?: boolean;
        },
    ) {
        this.unsubscribeRealtime();
        this.clearPendingCloudRetry();

        this.userId = userId;
        this.sessionlessLocalUserApiStorageEnabled =
            options?.sessionlessLocalUserApiStorageEnabled === true
            && Boolean(userId);
        this.hasHydratedCloudState = false;
        resetCloudSyncState(this.cloudSyncState);
        this.loadProviders(true);
        this.state = this.loadState();
        this.globalModelListCache = null;
        this.notifyListeners();

        if (userId) {
            console.log('[KeyManager] User login:', userId);

            // Prime local cache first for responsive UI.
            if (this.state.slots.length > 0) {
                console.log('[KeyManager] Local cache loaded:', this.state.slots.length, 'slots');
            }

            // Then hydrate the local API payload asynchronously.
            if (this.canUseSessionlessLocalUserApiStorage()) {
                console.log('[KeyManager] Local API temp user payload bridge enabled:', userId);
            }
            setTimeout(() => {
                if (this.userId !== userId) {
                    return;
                }

                if (!this.canHydrateCloudState()) {
                    console.log('[KeyManager] Deferring cloud hydration until startup reaches workspace_ready.');
                    return;
                }

                this.loadFromCloud().then(() => {
                    if (this.userId !== userId) {
                        return;
                    }

                    if (this.providerStorageScope === 'user' && this.providers.length > 0) {
                        void this.saveToCloud(this.state).catch((syncError) => {
                            console.warn('[KeyManager] Failed to backfill provider state to local API payload:', syncError);
                        });
                    }
                    if (this.canPollCloudState()) {
                        this.subscribeRealtime(userId);
                    }
                });
            }, 100);
        } else {
            console.log('[KeyManager] User logout');
            this.state = this.loadState();
            this.notifyListeners();
        }
    }

    private realtimeChannel: ReturnType<typeof setInterval> | null = null;

    private canHydrateCloudState(): boolean {
        return isStartupStageReady(this.startupStage, 'workspace_ready');
    }

    private canPollCloudState(): boolean {
        return isStartupStageReady(this.startupStage, 'background_ready');
    }

    setStartupStage(stage: AppStartupStage): void {
        this.startupStage = stage;

        if (!this.userId) {
            return;
        }

        if (!this.canPollCloudState()) {
            this.unsubscribeRealtime();
        }

        if (this.canHydrateCloudState() && !this.hasHydratedCloudState && !this.isSyncing) {
            const activeUserId = this.userId;
            void this.loadFromCloud().then(() => {
                if (this.userId !== activeUserId) {
                    return;
                }

                if (this.providerStorageScope === 'user' && this.providers.length > 0) {
                    void this.saveToCloud(this.state).catch((syncError) => {
                        console.warn('[KeyManager] Failed to backfill provider state to local API payload:', syncError);
                    });
                }

                if (this.canPollCloudState()) {
                    this.subscribeRealtime(activeUserId);
                }
            }).catch((error) => {
                console.warn('[KeyManager] Deferred local API payload hydration failed:', error);
            });
            return;
        }

        if (this.canPollCloudState() && this.hasHydratedCloudState && !this.realtimeChannel) {
            this.subscribeRealtime(this.userId);
        }
    }

    private subscribeRealtime(userId: string) {
        this.unsubscribeRealtime();
        console.log('[KeyManager] Starting local API payload polling...');
        this.realtimeChannel = setInterval(() => {
            if (this.userId !== userId || this.isSyncing) {
                return;
            }

            void this.loadFromCloud().catch((error) => {
                console.warn('[KeyManager] Periodic local API payload refresh failed:', error);
            });
        }, CLOUD_SYNC_POLL_INTERVAL_MS);
    }

    private unsubscribeRealtime() {
        if (this.realtimeChannel) {
            console.log('[KeyManager] Stop local API payload polling');
            clearInterval(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    }

    private applyCloudPayload(
        rawPayload: unknown,
        options?: {
            preserveLocalProvidersOnEmpty?: boolean;
        }
    ) {
        const previousProviders = [...this.providers];
        const cloudProviders = mergeCloudProvidersWithLocalRuntimeState(
            this.normalizeStoredProviders(extractUserApiProvidersFromPayload(rawPayload)),
            this.providers,
        );
        const hasProviderEnvelope = isUserApisEnvelope(rawPayload) && 'providers' in rawPayload;
        const shouldPreserveLocalProviders =
            options?.preserveLocalProvidersOnEmpty === true
            && this.providerStorageScope === 'user'
            && cloudProviders.length === 0
            && this.providers.length > 0;
        const shouldPreserveUnsyncedProviders =
            hasProviderEnvelope
            && !!this.userId
            && cloudProviders.length === 0
            && this.providers.length > 0
            && (
                this.cloudSyncState.pendingProviderCloudSync
                || this.providerStorageScope === 'user'
                || this.providerStorageScope === 'none'
            );

        if (hasProviderEnvelope && !shouldPreserveLocalProviders && !shouldPreserveUnsyncedProviders) {
            this.providers = cloudProviders;
            this.providerStorageScope = 'cloud';
            this.persistProvidersLocal();
        } else if (shouldPreserveUnsyncedProviders) {
            console.warn('[KeyManager] Preserving unsynced providers because the local API payload returned an empty provider list.');
        }

        let cloudSlots = extractKeyManagerCloudSlots(rawPayload) as KeySlot[];
        if (!Array.isArray(cloudSlots)) {
            return;
        }

        const rawCloudSlots = cloudSlots;
        const validCloudSlots = rawCloudSlots.filter((slot: any) => {
            const key = String(slot?.key || '').trim();
            const id = String(slot?.id || '').trim();
            return Boolean(id && key);
        });

        if (rawCloudSlots.length > 0 && validCloudSlots.length === 0) {
            console.warn('[KeyManager] Local API user_apis payload is not a key-slot structure, skipping overwrite.');
            return;
        }

        cloudSlots = validCloudSlots;

        cloudSlots = cloudSlots.map(s => {
            const provider = (s.provider as Provider) || 'Google';
            const keyType = determineKeyType(provider, s.baseUrl);
            const format = normalizeApiProtocolFormat(
                (s as any).format,
                provider === 'Google' && keyType === 'official' ? 'gemini' : 'auto'
            );
            const runtime = resolveProviderRuntime({
                provider,
                baseUrl: s.baseUrl,
                format,
                authMethod: s.authMethod,
                headerName: s.headerName,
                compatibilityMode: s.compatibilityMode,
            });
            const authMethod = runtime.authMethod as AuthMethod;

            return {
                ...s,
                name: s.name || 'Cloud Key',
                provider,
                totalCost: s.totalCost || 0,
                budgetLimit: s.budgetLimit !== undefined ? s.budgetLimit : -1,
                tokenLimit: s.tokenLimit !== undefined ? s.tokenLimit : -1,
                disabled: s.disabled || false,
                createdAt: s.createdAt || Date.now(),
                failCount: s.failCount || 0,
                successCount: s.successCount || 0,
                lastUsed: s.lastUsed || null,
                lastError: s.lastError || null,
                status: s.status || 'unknown',
                weight: s.weight || 50,
                timeout: s.timeout || 30000,
                maxRetries: s.maxRetries || 2,
                retryDelay: s.retryDelay || 1000,
                type: keyType,
                format,
                authMethod,
                headerName: s.headerName || runtime.headerName,
                compatibilityMode: runtime.compatibilityMode,
            };
        });

        cloudSlots = cloudSlots.map(s => {
            const isGoogle = s.provider === 'Google' || (s.provider as string) === 'Gemini';
            let newProvider = s.provider;
            if ((s.provider as string) === 'Gemini' && !s.baseUrl) newProvider = 'Google' as Provider;
            if (s.provider === 'Google' && s.baseUrl && !s.baseUrl.includes('googleapis.com')) newProvider = 'Custom' as Provider;

            const runtime = resolveProviderRuntime({
                provider: newProvider,
                baseUrl: s.baseUrl,
                format: s.format,
                authMethod: s.authMethod,
                headerName: s.headerName,
                compatibilityMode: s.compatibilityMode,
            });
            const builtInOfficialModels = getDefaultOfficialModelsForRuntime(runtime);

            if (isGoogle) {
                const currentModels = (s.supportedModels || []).filter((m: string) => isGoogleOfficialModelId(parseModelString(m).id));
                const missingDefaults = builtInOfficialModels.filter(m => !currentModels.includes(m));

                if (missingDefaults.length > 0 || newProvider !== s.provider) {
                    console.log(`[KeyManager] API payload refresh: Auto-adding models/fixing provider for key ${s.name}`);
                    return {
                        ...s,
                        provider: 'Google',
                        supportedModels: [...currentModels, ...missingDefaults]
                    };
                }
            }

            if (builtInOfficialModels.length > 0) {
                const currentModels = normalizeModelList(s.supportedModels || [], String(newProvider || s.provider || ''));
                const missingDefaults = builtInOfficialModels.filter((model) => !currentModels.includes(model));
                if (missingDefaults.length > 0 || newProvider !== s.provider) {
                    return {
                        ...s,
                        provider: newProvider,
                        supportedModels: [...currentModels, ...missingDefaults],
                    };
                }
            }
            return s;
        });

        this.state.slots = cloudSlots;
        // Re-apply provider-linked slot overrides so the runtime model library
        // reflects the latest provider enablement and model lists from cloud payloads.
        this.providers.forEach((provider) => {
            this.syncLegacySlotsWithProvider(provider, undefined, { persistState: false });
        });
        previousProviders
            .filter((provider) => !this.providers.some((candidate) => candidate.id === provider.id))
            .forEach((provider) => {
                this.clearLegacySlotsForRemovedProvider(provider, { persistState: false });
            });
        console.log('[KeyManager] Local API payload refresh completed (overwrite mode). Keys:', this.state.slots.length);
        this.notifyListeners();
    }

    /**
     * Refresh state from the local API payload bridge for the active user.
     */
    /**
     * Refresh state from the local API payload bridge for the active user.
     */
    private async loadFromCloud() {
        if (!this.userId) return;

        const activeUserId = this.userId;

        try {
            this.isSyncing = true;
            console.log('[KeyManager] Refreshing key-manager state from local API payload...');
            let preferredPayload: unknown = null;
            let loadError: unknown = null;
            const accessToken = await getPreferredKkApiAccessToken();

            try {
                const response = await legacyWebApiClient.getKeyManagerCloudState({ accessToken });
                if (response.success) {
                    preferredPayload = response.data;
                } else if (response.error.code !== 'AUTH_REQUIRED' && response.error.code !== 'HTTP_404') {
                    loadError = new Error(response.error.message || 'Local API payload fetch failed.');
                    console.warn('[KeyManager] Local API payload fetch failed:', response.error);
                }
            } catch (error) {
                loadError = error;
                console.warn('[KeyManager] Local API payload fetch threw:', error);
            }

            if (this.userId !== activeUserId) {
                return;
            }

            const preferredDensity = getUserApisPayloadDensity(preferredPayload);

            const hasLocalState = this.state.slots.length > 0 || this.providers.length > 0;
            if ((preferredPayload == null || preferredDensity === 0) && hasLocalState && loadError) {
                console.warn('[KeyManager] Local API payload empty during degraded sync, preserving local state.');
                return;
            }

            const shouldPreserveLocalProviders =
                !this.hasHydratedCloudState
                && this.providerStorageScope === 'user'
                && this.providers.length > 0;
            this.hasHydratedCloudState = true;
            this.applyCloudPayload(preferredPayload, {
                preserveLocalProvidersOnEmpty: shouldPreserveLocalProviders,
            });
        } catch (e) {
            console.error('[KeyManager] Error refreshing local API payload:', e);
        } finally {
            this.isSyncing = false;
            if (this.userId === activeUserId && this.hasPendingCloudSync()) {
                void this.flushPendingCloudSync();
            }
        }
    }

    /**
     * Update budgets and usage from Cloud (called by CostService)
     */
    updateBudgetsFromCloud(budgets: { id: string, budget: number, used?: number }[]): void {
        const slots = this.state.slots;
        let changed = false;

        budgets.forEach(b => {
            const slot = slots.find(s => s.id === b.id);
            if (slot) {
                if (b.budget !== undefined && slot.budgetLimit !== b.budget) {
                    slot.budgetLimit = b.budget;
                    changed = true;
                }
                if (b.used !== undefined && (slot.totalCost || 0) < b.used) {
                    slot.totalCost = b.used;
                    changed = true;
                }
            }
        });

        if (changed) {
            this.saveState();
            this.notifyListeners();
        }
    }


    /**
     * Sync state to the local API payload bridge for the active user.
     */
    private async saveToCloud(
        state: KeyManagerState,
        options?: {
            ignoreBackoff?: boolean;
            throwOnError?: boolean;
        }
    ) {
        const activeUserId = this.userId;
        if (!activeUserId) {
            console.log('[KeyManager] Skip local API payload sync (missing userId)');
            return;
        }

        if (!options?.ignoreBackoff && Date.now() < this.cloudSyncBackoffUntil) {
            return;
        }

        try {
            const canUseLegacyApi = shouldUseLegacyWebApiFallback() || this.authIsTempUser;
            console.log('[KeyManager] Syncing key-manager state to local API payload...', {
                userId: activeUserId,
                slotCount: state.slots.length,
                runtimeFallbackEnabled: canUseLegacyApi,
            });

            const nextProviders =
                this.hasHydratedCloudState || this.providers.length > 0
                    ? this.providers
                    : undefined;
            const compactTransportPayload = compactUserApisPayloadForTransport({
                version: 2,
                slots: state.slots as unknown as Record<string, unknown>[],
                providers: nextProviders as unknown as Record<string, unknown>[] | undefined,
                entries: [],
            });
            const compactSlots =
                extractKeyManagerCloudSlots(compactTransportPayload) as Record<string, unknown>[];
            const compactProviders =
                extractUserApiProvidersFromPayload(compactTransportPayload) as Record<string, unknown>[] | undefined;

            let localApiPayload: unknown = null;
            let localApiError: Error | null = null;
            const accessToken = await getPreferredKkApiAccessToken();
            const response = await legacyWebApiClient.replaceKeyManagerCloudState({
                version: 2,
                slots: compactSlots,
                providers: compactProviders,
            }, { accessToken });

            if (response.success) {
                localApiPayload = response.data;
            } else {
                const errorCode = response.error?.code || 'UNKNOWN_ERROR';
                const errorMessage = response.error?.message || 'Unknown local API sync failure.';
                const isNetworkError = errorCode === 'NETWORK_ERROR'
                    || errorMessage.includes('fetch')
                    || errorMessage.includes('Network');

                if (isNetworkError) {
                    console.warn('[KeyManager] \u7F51\u7EDC\u5F02\u5E38\uFF0C\u8DF3\u8FC7\u672C\u6B21\u672C\u5730 API \u540C\u6B65\uFF0C\u7A0D\u540E\u91CD\u8BD5');
                    this.cloudSyncBackoffUntil = Date.now() + 30_000;
                    localApiError = new Error(errorMessage);
                } else if (errorCode === 'AUTH_REQUIRED' || errorCode === 'HTTP_401' || errorCode === 'HTTP_403') {
                    console.error('[KeyManager] Local API session is missing or expired, postponing sync.');
                    this.cloudSyncBackoffUntil = Date.now() + 5 * 60_000;
                    localApiError = new Error(errorMessage);
                } else {
                    console.error('[KeyManager] Local API sync failed!', {
                        code: errorCode,
                        message: errorMessage,
                        details: response.error?.details,
                    });
                    localApiError = new Error(errorMessage);
                }
            }

            if (this.userId !== activeUserId) {
                return;
            }

            if (localApiPayload) {
                this.hasHydratedCloudState = true;
                this.applyCloudPayload(localApiPayload);
                this.cloudSyncBackoffUntil = 0;
                console.log('[KeyManager] Local API payload sync succeeded.');
                requestCostSync().catch(console.error);
                return;
            }

            if (localApiError) {
                throw localApiError;
            }
        } catch (e: any) {
            if (isKkApiPersistenceUnavailableError(e)) {
                this.schedulePendingCloudRetry();
                if (!options?.throwOnError) {
                    notify.warning('Local API payload sync unavailable', e.message);
                }
                return;
            }

            const isNetworkError = e.message?.includes('fetch') || e.message?.includes('Network');
            if (!isNetworkError) {
                console.error('[KeyManager] saveToCloud failed:', e);
            }
            this.schedulePendingCloudRetry();
            if (options?.throwOnError) {
                throw e;
            }
        }
    }

    private hasPendingCloudSync(): boolean {
        return hasPendingCloudSync(this.cloudSyncState);
    }

    private clearPendingCloudRetry(): void {
        clearPendingCloudRetry(this.cloudSyncState);
    }

    private schedulePendingCloudRetry(): void {
        schedulePendingCloudRetry(this.cloudSyncState, {
            userId: this.userId,
            cloudSyncBackoffUntil: this.cloudSyncBackoffUntil,
            onRetry: () => {
                void this.flushPendingCloudSync();
            },
        });
    }

    private async flushPendingCloudSync(state: KeyManagerState = this.state): Promise<void> {
        if (!this.userId || !this.hasPendingCloudSync()) {
            return;
        }

        if (this.isSyncing) {
            return;
        }

        if (this.pendingCloudSyncPromise) {
            await this.pendingCloudSyncPromise;
            return;
        }

        this.clearPendingCloudRetry();
        const syncRevision = this.cloudSyncState.cloudSyncRevision;
        this.pendingCloudSyncPromise = this.saveToCloud(state).then(() => {
            clearCloudSyncPendingFlagsOnRevisionMatch(this.cloudSyncState, syncRevision);
        }).catch((error) => {
            console.error('[KeyManager] Failed to sync key-manager state to local API payload:', error);
        }).finally(() => {
            this.pendingCloudSyncPromise = null;

            if (this.hasPendingCloudSync()) {
                this.schedulePendingCloudRetry();
            }
        });

        await this.pendingCloudSyncPromise;
    }

    async syncToCloudNow(): Promise<void> {
        await this.saveToCloud(this.state, {
            ignoreBackoff: true,
            throwOnError: true,
        });
    }

    async refreshFromCloudNow(): Promise<void> {
        if (!this.userId) {
            return;
        }

        await this.loadFromCloud();
    }

    private ensureCloudHydration(): void {
        if (!this.userId) {
            return;
        }

        if (!this.canHydrateCloudState()) {
            return;
        }

        if (this.hasHydratedCloudState || this.isSyncing) {
            return;
        }

        void this.loadFromCloud().catch((error) => {
            console.warn('[KeyManager] Lazy local API payload hydration failed:', error);
        });
    }

    /**
     * Notify all listeners of state change
     */
    private notifyListeners(): void {
        // Invalidate the merged model-list cache before notifying subscribers.
        this.globalModelListCache = null;
        this.listeners.forEach(fn => fn());
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Clear the global model-list cache so admin model updates are reflected immediately.
     */
    clearGlobalModelListCache(): void {
        this.globalModelListCache = null;
        console.log('[KeyManager] Global model list cache cleared');
    }

    /**
     * Force a listener notification after external state changes such as admin model refreshes.
     */
    forceNotify(): void {
        console.log('[KeyManager] Force notifying all listeners');
        this.notifyListeners();
    }

    /**
     * Test a potential channel connection
     */
    async testChannel(
        url: string,
        key: string,
        provider?: Provider | string,
        authMethod?: AuthMethod,
        headerName?: string,
        format?: ApiProtocolFormat
    ): Promise<{ success: boolean, message?: string }> {
        if (isBrowserRuntime()) {
            return {
                success: false,
                message: BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,
            };
        }

        try {
            // Sanitize input key before connectivity test
            const cleanKey = sanitizeAsciiApiKey(key);
            if (!cleanKey) return { success: false, message: 'API Key \u65E0\u6548\uFF08\u4EC5\u652F\u6301 ASCII / \u82F1\u6587\u5B57\u7B26\uFF09' };

            let targetUrl = url;
            const headers: Record<string, string> = {};

            // Pre-process URL
            const cleanUrl = url.replace(/\/chat\/completions$/, '').replace(/\/$/, '');

            const runtime = resolveProviderRuntime({
                provider,
                baseUrl: cleanUrl,
                format,
                authMethod,
                headerName,
            });
            const resolvedAuthMethod = runtime.authMethod as AuthMethod;
            const resolvedHeader = runtime.headerName;

            if (runtime.geminiNative || runtime.resolvedFormat === 'gemini') {
                // Google Native Logic
                if (cleanUrl === 'https://generativelanguage.googleapis.com') {
                    // Default Google Base
                    targetUrl = `${cleanUrl}/v1beta/models`;
                } else if (!cleanUrl.endsWith('/models')) {
                    // Custom Google Proxy? Try appending models if missing
                    targetUrl = `${cleanUrl}/models`;
                }

                // Google uses Query Param or x-goog-api-key header
                // We'll use the header for cleanliness, works on v1beta
                if (resolvedAuthMethod === 'query') {
                    targetUrl = `${targetUrl}?key=${cleanKey}`;
                } else {
                    headers[resolvedHeader] = cleanKey;
                }
                // headers['Content-Type'] = 'application/json'; // Not strictly triggered for GET
            } else {
                // OpenAI-compatible proxies should always be probed through /v1/models.
                const cleanBaseUrl = cleanUrl.replace(/\/v1$/, '').replace(/\/v1\/models$/, '').replace(/\/models$/, '');
                targetUrl = `${cleanBaseUrl}/v1/models`;
                const headerValue = resolvedHeader.toLowerCase() === 'authorization'
                    ? formatAuthorizationHeaderValue(cleanKey, runtime.authorizationValueFormat)
                    : cleanKey;
                headers[resolvedHeader] = headerValue;
            }

            // console.log(`[TestChannel] Testing ${targetUrl} (Provider: ${provider})...`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort("Request Timed Out"), 15000); // Increased to 15s

            try {
                const response = await fetch(targetUrl, {
                    method: 'GET',
                    headers,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    return { success: true };
                }

                // Google often returns 400/403 with detailed JSON
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorMsg = errorData.error.message;
                    }
                } catch (e) {
                    // Ignore json parse error
                }

                return { success: false, message: errorMsg };
            } catch (e: any) {
                clearTimeout(timeoutId);
                const isAbort = e.name === 'AbortError' || e.message?.includes('aborted');
                return {
                    success: false,
                    message: isAbort ? 'Request Timed Out (Check Network/Proxy)' : (e.message || 'Connection failed')
                };
            }
        } catch (e: any) {
            return { success: false, message: e.message || 'Connection failed' };
        }
    }

    /**
     * Fetch available models from a remote API
     * Returns a list of model IDs or empty array on failure
     * SIDE EFFECT: Updates GOOGLE_MODEL_METADATA with rich info if available
     */
    async fetchRemoteModels(
        baseUrl: string,
        key: string,
        authMethod?: AuthMethod,
        headerName?: string,
        provider?: Provider | string,
        format?: ApiProtocolFormat
    ): Promise<string[]> {
        if (isBrowserRuntime()) {
            console.warn('[KeyManager] Browser-side remote model discovery is disabled.');
            return [];
        }

        try {
            const cleanUrl = baseUrl.replace(/\/chat\/completions$/, '').replace(/\/$/, '');
            const runtime = resolveProviderRuntime({
                provider,
                baseUrl: cleanUrl,
                format,
                authMethod,
                headerName,
            });
            const documentedModels = getDocumentedStaticModelsForProvider(runtime.strategyId);
            if (documentedModels.length > 0) {
                return documentedModels;
            }
            const resolvedAuthMethod = runtime.authMethod as AuthMethod;
            const resolvedHeader = runtime.headerName;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (resolvedAuthMethod !== 'query') {
                headers[resolvedHeader] = resolvedHeader.toLowerCase() === 'authorization'
                    ? formatAuthorizationHeaderValue(key, runtime.authorizationValueFormat)
                    : key;
            }

            // OpenRouter CORS Fix
            if (cleanUrl.includes('openrouter.ai')) {
                headers['HTTP-Referer'] = window.location.origin; // Required by OpenRouter
                headers['X-Title'] = 'KK Studio'; // Optional
            }

            if (runtime.geminiNative || runtime.resolvedFormat === 'gemini') {
                const response = await fetch(
                    buildGeminiModelsEndpoint(cleanUrl, key, resolvedAuthMethod, typeof provider === 'string' ? provider : undefined),
                    {
                        method: 'GET',
                        headers: buildGeminiHeaders(resolvedAuthMethod, key, resolvedHeader, runtime.authorizationValueFormat),
                    }
                );

                if (!response.ok) {
                    return [];
                }

                const data = await response.json();
                const geminiModels: any[] = data.models || data.data || [];
                return geminiModels
                    .map((model: any) => String(model?.name || model?.id || model?.model || '').replace(/^models\//i, ''))
                    .filter(Boolean);
            }

            let targetUrls = [
                cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`,
            ];

            if (!cleanUrl.match(/\/v1\/?$/) && !cleanUrl.match(/\/v1beta\/?$/)) {
                targetUrls.push(`${cleanUrl}/v1/models`);
                targetUrls.push(`${cleanUrl}/v1beta/models`);
            }

            targetUrls = [...new Set(targetUrls)];

            // Try each URL until one works
            for (const url of targetUrls) {
                try {
                    const fullUrl = resolvedAuthMethod === 'query' ? `${url}?key=${key}` : url;

                    // Use manual AbortController for broader compatibility
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort("Request Timed Out"), 8000);

                    const response = await fetch(fullUrl, {
                        method: 'GET',
                        headers,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        const list = data.data || data.models || [];
                        if (Array.isArray(list)) {
                            // Process metadata if available (OpenRouter style)
                            list.forEach((m: any) => {
                                const id = m.id || m.name;
                                if (!id) return;

                                const existing = GOOGLE_MODEL_METADATA.get(id);
                                const metadata: any = {
                                    name: m.name || existing?.name || id,
                                    description: m.description || existing?.description,
                                    // OpenRouter specific fields
                                    contextLength: m.context_length || m.context_window,
                                    pricing: m.pricing // { prompt: "0.000001", completion: "0.000002" } check API docs
                                };

                                // Explicitly handle OpenRouter free tagging
                                if (id.endsWith(':free')) {
                                    metadata.pricing = { prompt: '0', completion: '0' };
                                }

                                GOOGLE_MODEL_METADATA.set(id, { ...existing, ...metadata });
                            });

                            // Return all models - filtering by type happens at usage time
                            // Chat models are needed for chat functionality
                            // Image/video models are needed for generation
                            let models = list.map((m: any) => {
                                const id = m.id || m.name;
                                // Normalize: remove 'models/' prefix if present for consistent matching
                                return id ? id.replace(/^models\//, '') : null;
                            }).filter(Boolean);

                            // Auto-add Google chat models for Google provider
                            if (provider === 'Google') {
                                const googleModelIds = GOOGLE_CHAT_MODELS.map(m => m.id);
                                googleModelIds.forEach(modelId => {
                                    if (!models.includes(modelId)) {
                                        models.push(modelId);
                                    }
                                });
                            }

                            // Try to fetch /pricing in the background and refresh the cached pricing snapshot
                            try {
                                const pricingUrl = buildSilentProviderPricingUrl(cleanUrl);
                                // We don't want to block the models return, so do this asynchronously but catch errors locally.
                                // It runs in the background.
                                fetch(pricingUrl, {
                                    method: 'GET',
                                    headers: headers
                                }).then(async (pricingRes) => {
                                    if (pricingRes.ok) {
                                        const pricingData = await pricingRes.json();
                                        if (pricingData && (pricingData.data || Array.isArray(pricingData))) {
                                            applyModelPricingOverrides(pricingData);
                                        }
                                    }
                                }).catch(e => {
                                    console.log('[KeyManager] Silent pricing fetch failed or unsupported:', e);
                                });
                            } catch (e) {
                                console.log('[KeyManager] Silent pricing fetch setup failed:', e);
                            }

                            return models;
                        }
                    }
                } catch { /* continue */ }
            }
            return [];
        } catch (e) {
            console.error('Fetch models failed', e);
            return [];
        }
    }

    /**
     * Set rotation strategy
     */
    setStrategy(strategy: 'round-robin' | 'sequential') {

        this.state.rotationStrategy = strategy;
        this.saveState();
        this.notifyListeners();
    }

    /**
     * Get the current rotation strategy
     */
    getStrategy(): 'round-robin' | 'sequential' {
        return this.state.rotationStrategy || 'round-robin'; // Default to round-robin
    }

    private applyProviderUsageDelta(providerId: string, tokenDelta: number, costDelta: number): ThirdPartyProvider | undefined {
        this.loadProviders();

        const provider = this.providers.find((entry) => entry.id === providerId);
        if (!provider) return undefined;

        return applyProviderUsageDeltaToProvider(provider, tokenDelta, costDelta);
    }

    /**
     * Get the best available channel for a specific model
     * Strategy:
     * 1. Filter channels that support the model
     * 2. Filter healthy channels (Active, Valid, Budget OK)
     * 3. Apply Rotation Strategy (Round Robin vs Sequential)
     */
    getNextKey(modelId: string, preferredKeyId?: string): KeySlot | null {
        // Parse the requested ID to separate base model and suffix
        // Format: modelId@Suffix or just modelId
        const [baseIdPart, suffix] = modelId.split('@');
        const normalizedSuffix = decodeRouteSuffix(suffix);

        // Normalize the requested model ID and apply migration mapping
        let normalizedModelId = baseIdPart.replace(/^models\//, '');
        // Accept display-name style input that may come from old UI state or legacy records.
        const lowerRequested = normalizedModelId.toLowerCase();
        // Only rewrite display-name style inputs that use spaces.
        // Hyphenated IDs may be real upstream model names and should be preserved.
        if (lowerRequested === 'nano banana pro') {
            normalizedModelId = 'gemini-3-pro-image-preview';
        } else if (lowerRequested === 'nano banana') {
            normalizedModelId = 'gemini-2.5-flash-image';
        } else if (lowerRequested === 'nano banana 2') {
            normalizedModelId = 'gemini-3.1-flash-image-preview';
        }

        // When a route suffix is present, preserve the channel-specific raw model ID.
        // This avoids migrating provider-local aliases into official IDs and breaking routing.
        if (!suffix && MODEL_MIGRATION_MAP[normalizedModelId]) {
            normalizedModelId = MODEL_MIGRATION_MAP[normalizedModelId];
        }

        // Routing strategy:
        // 1. If a suffix is present, try to match that explicit route.
        // 2. Without a suffix, prefer direct Google/Gemini keys.

        // Convert third-party providers into temporary KeySlot objects so routing stays unified.
        this.loadProviders();
        const providerSlots: KeySlot[] = this.providers.filter(p => p.isActive).map(p => {
            const provider = (['Google', 'OpenAI', 'Anthropic', 'Volcengine', 'Aliyun', 'Tencent', 'SiliconFlow', '12AI', 'Flow2API'].includes(p.name) ? p.name : 'Custom') as Provider;
            const format = normalizeApiProtocolFormat(p.format, 'auto');
            const runtime = resolveProviderRuntime({
                provider,
                baseUrl: p.baseUrl,
                format,
            });
            const authMethod = runtime.authMethod as AuthMethod;
            const effectiveProviderModels = resolveEffectiveProviderModels({
                provider: p.name,
                baseUrl: p.baseUrl,
                format: p.format,
                models: p.models,
            });

            return {
                id: p.id,
                key: p.apiKey,
                name: p.name,
                provider,
                baseUrl: p.baseUrl,
                format,
                authMethod,
                headerName: runtime.headerName,
                group: p.group,
                status: 'valid',
                budgetLimit: resolveProviderBudgetLimit(p),
                tokenLimit: resolveProviderTokenLimit(p),
                usedTokens: p.usage?.totalTokens || 0,
                totalCost: p.usage?.totalCost || 0,
                successCount: 0,
                failCount: 0,
                supportedModels: effectiveProviderModels,
                type: 'third-party',
                lastUsed: p.lastChecked || 0,
                lastError: p.lastError || null,
                disabled: !p.isActive,
                createdAt: p.createdAt || 0,
                proxyConfig: {
                    serverUrl: p.baseUrl,
                    serverName: p.name,
                    isEnabled: true
                }
            };
        });

        const effectiveUserSlots = this.state.slots.map((slot) => {
            const linkedProvider = this.findLinkedProviderForSlot(slot);
            if (!linkedProvider) return slot;

            const effectiveSlot = this.buildEffectiveSlotFromProvider(slot, linkedProvider);
            if (String(effectiveSlot.key || '').trim() !== String(slot.key || '').trim()) {
                console.log(
                    `[KeyManager] Overriding legacy slot at runtime from provider ${linkedProvider.name}: ${slot.name}[${slot.id}] -> ${linkedProvider.id}`
                );
            }
            return effectiveSlot;
        });

        const explicitRouteTarget = extractSlotRouteTarget(normalizedSuffix);
        const filteredLegacySlots = effectiveUserSlots.filter((slot) => {
            const slotIdLower = String(slot.id || '').trim().toLowerCase();
            if (explicitRouteTarget && slotIdLower === explicitRouteTarget) {
                return true;
            }
            const slotBaseUrl = normalizeProviderLinkValue(slot.baseUrl);
            const slotName = normalizeProviderLinkValue(slot.name);
            if (!slotBaseUrl || !slotName) return true;

            return !providerSlots.some((providerSlot) => (
                normalizeProviderLinkValue(providerSlot.baseUrl) === slotBaseUrl
                && normalizeProviderLinkValue(providerSlot.name) === slotName
            ));
        });

        const allSlots = [...providerSlots, ...filteredLegacySlots];

        const getSlotModelCompatibilityIssue = (slot: KeySlot) => (
            resolveProviderModelCompatibilityIssue({
                provider: slot.provider,
                baseUrl: slot.baseUrl,
                modelId: normalizedModelId,
            })
        );

        const modelSupportedBySlot = (slot: KeySlot) => {
            if (getSlotModelCompatibilityIssue(slot)) {
                return false;
            }
            const supported = slot.supportedModels || [];
            if (supported.includes('*')) return true;
            return supported.some(m => {
                const parts = parseModelString(m);
                const id = parts.id.replace(/^models\//, '');
                return id === normalizedModelId;
            });
        };

        const isSlotHealthy = (slot: KeySlot) => {
            if (slot.disabled) return false;
            if (isUsageLimitExceeded(slot)) return false;
            return true;
        };

        const matchesRequestedRoute = (slot: KeySlot) => {
            // No suffix means the official direct route, which only applies to Google slots.
            if (!suffix) {
                return slot.provider === 'Google';
            }

            return matchesSlotRouteSuffix(slot, suffix);
        };

        // Credit-model forced routing was removed; routing is now handled by the suffix and health checks.

        if (preferredKeyId) {
            const normalizedPreferredKeyId = String(preferredKeyId).trim().toLowerCase();
            const parts = normalizedPreferredKeyId.split('@');
            const mainPreferredId = parts[0];
            const preferredSuffix = parts[1] || null;
            const preferredRouteTarget = preferredSuffix
                ? extractSlotRouteTarget(preferredSuffix)
                : extractSlotRouteTarget(normalizedPreferredKeyId);

            const preferred = allSlots.find(s => {
                const slotIdLower = String(s.id || '').trim().toLowerCase();
                return (
                    slotIdLower === normalizedPreferredKeyId ||
                    slotIdLower === mainPreferredId ||
                    (!!preferredRouteTarget && slotIdLower === preferredRouteTarget)
                );
            });
            if (preferred) {
                const hasCompatIssue = !!getSlotModelCompatibilityIssue(preferred);
                if (isSlotHealthy(preferred) && !hasCompatIssue && matchesRequestedRoute(preferred)) {
                    return this.prepareKeyResult(preferred);
                }
            }
            if (!suffix) {
                console.warn(`[KeyManager] Preferred key unavailable for model=${normalizedModelId}, fallback to normal routing. preferredKeyId=${preferredKeyId}`);
            }
        }

        let candidates: KeySlot[] = [];

        if (!suffix) {
            // [No Suffix Case]

            // Credit-model priority routing has been removed from the no-suffix branch.

            // B. For regular models, prefer the user's direct Google official key
            candidates = allSlots.filter(s => s.provider === 'Google' || (s.provider as string) === 'Gemini');
            let strictCandidates = candidates.filter(s => modelSupportedBySlot(s));

            if (strictCandidates.length > 0) {
                candidates = strictCandidates;
            } else {
                console.warn(`[KeyManager] 找不到官方 Key: ${normalizedModelId}`);
            }

        } else {
            // [Proxy / Channel Connection]
            // Strategy: find keys matching the selected suffix.
            const isSystemRoute = normalizedSuffix.startsWith('system') || normalizedSuffix === 'systemproxy';
            const proxyAliasSet = new Set(['custom', 'proxy', 'proxied', 'system', 'builtin']);
            if (isSystemRoute) {
                // Represent the backend-managed SystemProxy route as a synthetic KeySlot so the rest
                // of the pipeline can keep using the same selection contract.
                return this.prepareKeyResult({
                    id: `backend_proxy_${normalizedModelId}`,
                    key: 'system-proxy-managed-key',
                    name: 'System Internal',
                    provider: 'SystemProxy',
                    status: 'valid',
                    budgetLimit: -1,
                    totalCost: 0,
                    successCount: 0,
                    failCount: 0,
                    supportedModels: [normalizedModelId],
                    type: 'proxy',
                    lastUsed: Date.now(),
                    lastError: null,
                    disabled: false,
                    createdAt: Date.now()
                } as KeySlot);

                // The built-in SystemProxy route has already been synthesized above, so skip external matching here.
            } else {

                // Step 1: exact route-name match
                const routeTarget = extractSlotRouteTarget(normalizedSuffix);
                const nameMatchedCandidates = allSlots.filter(s => {
                    if (routeTarget) {
                        return String(s.id || '').trim().toLowerCase() === routeTarget;
                    }

                    return matchesSlotRouteSuffix(s, normalizedSuffix);
                });

                // Step 2: filter the name-matched candidates by model capability.
                let modelFilteredCandidates = nameMatchedCandidates.filter(s => modelSupportedBySlot(s));

                // Step 3: if model filtering removes every explicit route-name match, fall back to the name matches so manual routing still wins.
                // This keeps explicit slot routing stable even when a slot's advertised model list is incomplete or temporarily stale.
                if (nameMatchedCandidates.length > 0 && modelFilteredCandidates.length === 0) {
                    const compatibilityIssues = nameMatchedCandidates
                        .map(candidate => getSlotModelCompatibilityIssue(candidate))
                        .filter((issue): issue is string => Boolean(issue));

                    if (compatibilityIssues.length > 0) {
                        console.warn(
                            `[KeyManager] Route-matched candidates for suffix '${normalizedSuffix}' are incompatible with '${normalizedModelId}': ${compatibilityIssues[0]}`,
                        );
                        candidates = [];
                    } else {
                        console.log(`[KeyManager] Name-matched candidates for suffix '${normalizedSuffix}' but model filter rejected '${normalizedModelId}', fallback to name matches.`);
                        candidates = nameMatchedCandidates;
                    }
                } else if (modelFilteredCandidates.length > 0) {
                    candidates = modelFilteredCandidates;
                } else {
                    candidates = [];
                }

                // Step 4: If the suffix is a generic proxy alias and no exact route matched,
                // fall back to any healthy non-Google provider that supports the model.
                if (candidates.length === 0 && proxyAliasSet.has(normalizedSuffix)) {
                    candidates = allSlots.filter(s => {
                        if (s.provider === 'Google') return false;
                        return modelSupportedBySlot(s);
                    });
                }

                // system/builtin aliases share the same fallback behavior

                console.log(
                    `[KeyManager] route debug: Suffix='${normalizedSuffix}', routeTarget='${routeTarget || ''}', NameMatched=${nameMatchedCandidates.length}, ModelFiltered=${modelFilteredCandidates.length}, FinalCandidates=${candidates.length}` +
                    (candidates.length > 0
                        ? ` -> ${candidates.map(c => `${c.name}[${c.id}]@${String(c.baseUrl || '').trim() || 'no-base-url'}`).join(', ')}`
                        : '')
                );
            }
        }

        // --- DIAGNOSTICS & FILTERING ---
        // Now filter candidates by HEALTH (Status, Budget, Disabled)

        const validCandidates: KeySlot[] = [];
        const budgetExhausted: KeySlot[] = [];
        const disabled: KeySlot[] = [];

        for (const s of candidates) {
            if (s.disabled) {
                disabled.push(s);
                continue;
            }
            if (isUsageLimitExceeded(s)) {
                budgetExhausted.push(s);
                continue;
            }
            validCandidates.push(s);
        }

        if (validCandidates.length === 0) {
            // JIT auto-repair for official Google models only
            if (!suffix && (normalizedModelId.startsWith('gemini-') || normalizedModelId.startsWith('imagen-') || normalizedModelId.startsWith('veo-'))) {

                // Find any healthy Google key
                const healingCandidates = this.state.slots.filter(s =>
                    (s.provider === 'Google' || (s.provider as string) === 'Gemini') &&
                    !s.disabled &&
                    !isUsageLimitExceeded(s)
                );

                if (healingCandidates.length > 0) {
                    console.log(`[KeyManager] JIT Healing: Valid Google key found, auto-authorizing ${normalizedModelId}`);
                    const selected = healingCandidates[0];

                    // Auto-fix
                    if (!selected.supportedModels) selected.supportedModels = [];
                    if (!selected.supportedModels.includes(normalizedModelId)) {
                        selected.supportedModels.push(normalizedModelId);
                        this.saveState();
                    }
                    return this.prepareKeyResult(selected);
                }
            }

            // No healthy fallback route was found

            return null;
        }

        // 3. Apply Strategy
        // Common Sort: Valid > Unknown > Rate Limited
        const now = Date.now();
        const cooldownFiltered = validCandidates.filter(s => {
            // SystemProxy entries do not participate in client-side cooldown handling
            if (s.provider === 'SystemProxy' || s.id?.startsWith('backend_proxy')) return true;
            if (s.cooldownUntil && now < s.cooldownUntil) return false;
            if (s.status !== 'rate_limited') return true;
            if (!s.lastUsed) return false;
            return now - s.lastUsed >= RATE_LIMIT_COOLDOWN_MS;
        });

        const healthy = cooldownFiltered.filter(s => s.status !== 'invalid' && s.status !== 'rate_limited');
        let usable = healthy.length > 0 ? healthy : cooldownFiltered; // prefer non-rate-limited and cooldown-passed keys

        // If all matching keys are still in cooldown, fallback to original candidate list (degraded mode)
        if (usable.length === 0) {
            const blocked = validCandidates.filter(s =>
                (s.status === 'rate_limited' && s.lastUsed && (now - s.lastUsed < RATE_LIMIT_COOLDOWN_MS)) ||
                (!!s.cooldownUntil && now < s.cooldownUntil)
            );
            if (blocked.length > 0) {
                const shortestWaitMs = Math.min(...blocked.map(s => {
                    const rateLimitWait = s.lastUsed ? Math.max(0, RATE_LIMIT_COOLDOWN_MS - (now - s.lastUsed)) : RATE_LIMIT_COOLDOWN_MS;
                    const explicitWait = s.cooldownUntil ? Math.max(0, s.cooldownUntil - now) : 0;
                    return Math.max(rateLimitWait, explicitWait);
                }));
                console.warn(`[KeyManager] All matching keys are in rate-limit cooldown. Fallback enabled. Earliest retry in ~${Math.ceil(shortestWaitMs / 1000)}s`);
            }
            usable = validCandidates;
        }

        if (usable.length === 0) return null;

        usable.sort((a, b) => {
            // Prefer Valid
            if (a.status === 'valid' && b.status !== 'valid') return -1;
            if (a.status !== 'valid' && b.status === 'valid') return 1;
            return 0;
        });

        // Determine Selection
        const strategy = this.state.rotationStrategy || 'round-robin';
        let winner: KeySlot;

        if (strategy === 'sequential') {
            winner = usable[0];
        } else {
            // Round Robin: Pick random from top tier
            const topStatus = usable[0].status;
            const topTier = usable.filter(s => s.status === topStatus);
            winner = topTier[Math.floor(Math.random() * topTier.length)];
        }

        return this.prepareKeyResult(winner);
    }

    /**
     * Get available proxy models with default capabilities
     * Used by modelCapabilities.ts
     */
    getAvailableProxyModels(): { id: string; supportedAspectRatios: any[]; supportedSizes: any[]; supportsGrounding: boolean }[] {
        const models = new Map<string, any>();
        // Import enums to avoid circular dependency if possible, or just use strings if suitable.
        // Actually we can access AspectRatio/ImageSize from imports if available, but to avoid circular deps with types.ts if this file imports it...
        // KeyManager imports types from apiConfig? No.
        // Let's assume defaults.
        const defaultRatios = ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9', '2:3', '3:2'];
        const defaultSizes = ['1024x1024', '1344x768', '768x1344']; // Approximate

        this.state.slots.forEach(s => {
            // Check if proxy (has baseUrl)
            if (s.baseUrl && !s.disabled && s.status !== 'invalid') {
                (s.supportedModels || []).forEach(m => {
                    if (!models.has(m)) {
                        models.set(m, {
                            id: m,
                            supportedAspectRatios: defaultRatios,
                            supportedSizes: defaultSizes,
                            supportsGrounding: false
                        });
                    }
                });
            }
        });
        return Array.from(models.values());
    }

    /**
     * Helper to format the key result and update metadata
     */
    private prepareKeyResult(slot: KeySlot): KeySlot {
        // Update last used timestamp (skip for built-in proxy to avoid concurrent request issues)
        if (slot.provider !== 'SystemProxy' && !slot.id?.startsWith('backend_proxy')) {
            const actualSlot = this.state.slots.find(s => s.id === slot.id);
            if (actualSlot) {
                actualSlot.lastUsed = Date.now();
                this.saveState();
            }
        }

        const baseUrl = slot.baseUrl || GOOGLE_API_BASE;
        const runtime = resolveProviderRuntime({
            provider: slot.provider,
            baseUrl,
            format: slot.format,
            authMethod: slot.authMethod || getDefaultAuthMethod(baseUrl, {
                provider: slot.provider,
                format: slot.format,
            }),
            headerName: slot.headerName,
            compatibilityMode: slot.compatibilityMode,
        });

        return {
            ...slot,
            id: slot.id,
            key: slot.key,
            name: slot.name || slot.provider || 'Unnamed Channel',
            baseUrl,
            format: normalizeApiProtocolFormat(slot.format, runtime.resolvedFormat),
            authMethod: runtime.authMethod as AuthMethod,
            headerName: runtime.headerName,
            compatibilityMode: runtime.compatibilityMode,
            group: slot.group,
            provider: slot.provider || 'Google',
            timeout: slot.timeout,
            customHeaders: slot.customHeaders,
            customBody: slot.customBody,
            cooldownUntil: slot.cooldownUntil
        };
    }

    /**
     * Report successful API call
     */
    reportSuccess(keyId: string): void {
        const slot = this.state.slots.find(s => s.id === keyId);
        if (slot) {
            slot.status = 'valid';
            slot.successCount++;
            slot.failCount = 0; // Reset fail count on success
            slot.lastError = null;
            slot.cooldownUntil = undefined;
            this.saveState();
            this.notifyListeners();
        }
    }

    /**
     * Report failed API call
     */
    reportFailure(keyId: string, error: string): void {
        const slot = this.state.slots.find(s => s.id === keyId);
        if (slot) {
            slot.failCount++;
            slot.lastError = error;
            slot.lastUsed = Date.now();

            const lowerError = String(error || '').toLowerCase();
            const isRateLimit =
                lowerError.includes('429') ||
                lowerError.includes('rate limit') ||
                lowerError.includes('too many requests') ||
                lowerError.includes('quota exceeded');

            const isAuthError =
                hasAuthErrorMarkers(error) ||
                lowerError.includes('authentication') ||
                lowerError.includes('permission denied') ||
                lowerError.includes('permission_denied');

            // SystemProxy entries should never be pushed into the client-side cooldown flow.
            if (slot.provider === 'SystemProxy' || slot.id?.startsWith('backend_proxy')) {
                // Record the error for diagnostics, but leave the route state unchanged.
                console.warn(`[KeyManager] SystemProxy error reported but not changing cooldown state: ${error}`);
            } else if (isRateLimit) {
                slot.status = 'rate_limited';
                slot.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            } else if (isAuthError) {
                slot.status = 'invalid';
                slot.cooldownUntil = undefined;
            } else {
                // Transient network or provider failures should back off and fall back to unknown, not hard-invalid.
                slot.status = 'unknown';
                const transientBackoff = Math.min(15000, 2000 * Math.max(1, slot.failCount));
                slot.cooldownUntil = Date.now() + transientBackoff;
            }

            this.saveState();
            this.notifyListeners();
        }
    }
    /**
     * Toggle disabled state for manual pause/resume
     * 切换 Key 的手动暂停/恢复状态。
     */
    toggleKey(keyId: string): void {
        const slot = this.state.slots.find(s => s.id === keyId);
        if (slot) {
            slot.disabled = !slot.disabled;
            if (!slot.disabled) {
                // Optimistic unpause: Assume valid to allow immediate usage without auto-check
                // If it fails, standard error handling will mark it invalid/rate_limited
                slot.status = 'valid';
                slot.failCount = 0;
                slot.lastError = null;
                slot.cooldownUntil = undefined;
            }
            this.saveState();
            this.notifyListeners();
        }
    }


    /**
     * Update quota information for a key
     */
    updateQuota(keyId: string, quota: KeySlot['quota']): void {
        const slot = this.state.slots.find(s => s.id === keyId);
        if (slot && quota) {
            slot.quota = quota;
            this.saveState();
            this.notifyListeners();
        }
    }

    /**
     * Add exact cost usage to a key (syncs with CostService)
     */
    addCost(keyId: string, cost: number): void {
        const slot = this.state.slots.find((s) => s.id === keyId);
        let stateChanged = false;
        if (slot) {
            const previousCost = slot.totalCost || 0;
            slot.totalCost = previousCost + cost;
            stateChanged = true;

            if (slot.budgetLimit > 0) {
                const usageRatio = slot.totalCost / slot.budgetLimit;
                const previousRatio = previousCost / slot.budgetLimit;

                if (usageRatio >= 0.9 && previousRatio < 0.9) {
                    notify.warning(
                        'Budget warning',
                        `API Key "${slot.name}" is using ${(usageRatio * 100).toFixed(0)}% of its budget ($${slot.totalCost.toFixed(2)} / $${slot.budgetLimit}).`
                    );
                }

                if (usageRatio >= 1.0 && previousRatio < 1.0) {
                    notify.error(
                        'Budget exhausted',
                        `API Key "${slot.name}" reached its budget limit. Recharge or increase the budget to continue.`
                    );
                }
            }
        }

        const linkedProvider = this.getProviderForKeySlot(keyId);
        const providerChanged = linkedProvider ? !!this.applyProviderUsageDelta(linkedProvider.id, 0, cost) : false;

        if (!stateChanged && !providerChanged) return;

        if (stateChanged) {
            this.saveState();
        }
        if (providerChanged) {
            this.saveProviders();
        }
        this.notifyListeners();
    }

    /**
     * Reset usage statistics for a key.
     */
    resetUsage(keyId: string): void {
        const slot = this.state.slots.find((s) => s.id === keyId);
        if (!slot) return;

        slot.totalCost = 0;
        slot.failCount = 0;
        slot.successCount = 0;
        slot.status = 'unknown';
        this.saveState();
        this.notifyListeners();
        console.log(`[KeyManager] Usage reset for key ${slot.name} (${keyId})`);
    }

    /**
     * Clear all keys (for example on user switch).
     */
    clearAll(): void {
        this.state.slots = [];
        this.state.currentIndex = 0;
        this.saveState();
        this.notifyListeners();
    }

    /**
     * Reorder slots for manual sorting.
     */
    reorderSlots(fromIndex: number, toIndex: number): void {
        if (
            fromIndex < 0
            || fromIndex >= this.state.slots.length
            || toIndex < 0
            || toIndex >= this.state.slots.length
        ) {
            return;
        }

        const slots = [...this.state.slots];
        const [moved] = slots.splice(fromIndex, 1);
        slots.splice(toIndex, 0, moved);

        this.state.slots = slots;
        this.saveState();
        this.notifyListeners();
    }

    async addKey(key: string, options?: {
        name?: string;
        provider?: Provider | string;
        baseUrl?: string;
        format?: ApiProtocolFormat;
        authMethod?: AuthMethod;
        headerName?: string;
        compatibilityMode?: 'standard' | 'chat';
        supportedModels?: string[];
        budgetLimit?: number;
        tokenLimit?: number;
        creditCost?: number;
        type?: 'official' | 'proxy' | 'third-party';
        proxyConfig?: { serverName?: string };
        customHeaders?: Record<string, string>;
        customBody?: Record<string, any>;
    }): Promise<{ success: boolean; error?: string; id?: string }> {
        const secureModeError = this.ensureAuthenticatedUserApiMode();
        if (secureModeError) {
            return { success: false, error: secureModeError };
        }

        // Sanitize the input key before validation: trim whitespace and remove non-ASCII noise
        const trimmedKey = sanitizeAsciiApiKey(key);

        if (!trimmedKey) {
            return { success: false, error: '请输入有效的 API Key（仅保留 ASCII 字符）。' };
        }

        // Check for duplicates
        if (this.state.slots.some(s => s.key === trimmedKey && s.baseUrl === options?.baseUrl)) {
            return { success: false, error: '该 API Key 已存在，请勿重复添加。' };
        }

        const baseUrl = options?.baseUrl || '';
        const keyType = determineKeyType(options?.provider || 'Custom', baseUrl);
        const format = normalizeApiProtocolFormat(
            options?.format,
            options?.provider === 'Google' && keyType === 'official' ? 'gemini' : 'auto'
        );
        const runtime = resolveProviderRuntime({
            provider: options?.provider || 'Custom',
            baseUrl,
            format,
            authMethod: options?.authMethod,
            headerName: options?.headerName,
            compatibilityMode: options?.compatibilityMode,
        });
        const authMethod = runtime.authMethod as AuthMethod;
        const headerName = runtime.headerName;

        // Initialize supportedModels
        let supportedModels = options?.supportedModels || [];

        // Auto-add all Google chat models for Google provider
        if (options?.provider === 'Google') {
            const googleModelIds = GOOGLE_CHAT_MODELS.map(m => m.id);
            googleModelIds.forEach(modelId => {
                if (!supportedModels.includes(modelId)) {
                    supportedModels.push(modelId);
                }
            });
        }

        // Normalize provider models before the new slot enters the shared routing pool.
        supportedModels = normalizeModelList(supportedModels, options?.provider, options?.baseUrl);

        const newSlot: KeySlot = {
            id: `key_${Date.now()}`,
            key: trimmedKey,
            name: options?.name || 'My Channel',
            // Default provider logic
            provider: (options?.provider as Provider) || 'Custom',
            // Default type logic using helper
            type: options?.type || keyType,
            format,
            baseUrl,
            authMethod,
            headerName,
            compatibilityMode: runtime.compatibilityMode,
            supportedModels,
            status: 'unknown',
            failCount: 0,
            successCount: 0,
            lastUsed: null,
            lastError: null,
            disabled: false,
            createdAt: Date.now(),
            totalCost: 0,
            budgetLimit: options?.budgetLimit ?? -1,
            tokenLimit: options?.tokenLimit ?? -1,
            creditCost: options?.creditCost,
            proxyConfig: options?.proxyConfig,
            customHeaders: options?.customHeaders,
            customBody: options?.customBody,
            updatedAt: Date.now() // Initial timestamp
        };

        this.state.slots.push(newSlot);
        this.saveState();
        this.notifyListeners();

        return {
            success: true,
            id: newSlot.id
        };
    }

    /**
     * Remove an API key
     */
    removeKey(keyId: string): void {
        this.state.slots = this.state.slots.filter(s => s.id !== keyId);
        this.saveState();
        this.notifyListeners();
    }

    /**
 * Update an existing API key
 */
    async updateKey(id: string, updates: Partial<KeySlot>): Promise<void> {
        const secureModeError = this.ensureAuthenticatedUserApiMode();
        if (secureModeError) {
            throw new Error(secureModeError);
        }

        console.log('[KeyManager] updateKey invoked:', buildKeyUpdateDiagnosticPayload(
            id,
            updates,
            this.state.slots.find(s => s.id === id)?.supportedModels
        ));
        const slot = this.state.slots.find(s => s.id === id);
        if (slot) {
            Object.assign(slot, updates);
            if ((updates.provider || updates.baseUrl !== undefined) && !updates.type) {
                slot.type = determineKeyType(slot.provider, slot.baseUrl);
            }
            if (
                updates.format !== undefined
                || updates.provider !== undefined
                || updates.baseUrl !== undefined
                || updates.authMethod !== undefined
                || updates.headerName !== undefined
                || updates.compatibilityMode !== undefined
            ) {
                slot.format = normalizeApiProtocolFormat(
                    updates.format ?? slot.format,
                    slot.provider === 'Google' && determineKeyType(slot.provider, slot.baseUrl) === 'official' ? 'gemini' : 'auto'
                );
                const runtime = resolveProviderRuntime({
                    provider: slot.provider,
                    baseUrl: slot.baseUrl,
                    format: slot.format,
                    authMethod: updates.authMethod || slot.authMethod,
                    headerName: updates.headerName || slot.headerName,
                    compatibilityMode: updates.compatibilityMode || slot.compatibilityMode,
                });
                slot.authMethod = runtime.authMethod as AuthMethod;
                slot.headerName = runtime.headerName;
                slot.compatibilityMode = runtime.compatibilityMode;
            }
            if (updates.supportedModels) {
                slot.supportedModels = normalizeModelList(updates.supportedModels, slot.provider, slot.baseUrl);
            }
            slot.updatedAt = Date.now();
            await this.saveState();
            this.notifyListeners();
        }
    }


    /**
     * Validate an API key by making a test request
     */
    /**
     * Validate an API key by making a test request.
     * @param syncModels If true, also fetches and returns the latest model list from the API.
     */
    async validateKey(key: string, provider: string = 'Gemini', syncModels: boolean = false): Promise<{ valid: boolean; error?: string; models?: string[] }> {
        if (isBrowserRuntime()) {
            return {
                valid: false,
                error: BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,
            };
        }

        if (provider !== 'Gemini' && provider !== 'Google' && provider !== 'Custom' && provider !== 'OpenAI') {
            // Other OpenAI-compatible providers are validated in refreshKey with baseUrl context.
            return { valid: true };
        }

        try {
            let isValid = false;
            let errorMsg: string | undefined = undefined;
            let fetchedModels: string[] | undefined = undefined;

            if (provider === 'Gemini' || provider === 'Google') {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
                    { method: 'GET' }
                );

                const limitRequests = response.headers.get('x-ratelimit-limit-requests');
                const remainingRequests = response.headers.get('x-ratelimit-remaining-requests');
                const resetRequests = response.headers.get('x-ratelimit-reset-requests');

                const existingSlot = this.state.slots.find(s => s.key === key);
                if (existingSlot && (limitRequests || remainingRequests)) {
                    const resetSeconds = resetRequests ? (parseInt(resetRequests) || 0) : 0;
                    this.updateQuota(existingSlot.id, {
                        limitRequests: parseInt(limitRequests || '0'),
                        remainingRequests: parseInt(remainingRequests || '0'),
                        resetConstant: resetRequests || '',
                        resetTime: Date.now() + (resetSeconds * 1000),
                        updatedAt: Date.now()
                    });
                }

                if (response.ok) {
                    isValid = true;
                } else if (response.status === 429) {
                    isValid = true;
                    errorMsg = '\u6709\u6548\u4F46\u5DF2\u9650\u6D41';
                } else if (response.status === 401 || response.status === 403) {
                    isValid = false;
                    errorMsg = 'API Key \u65E0\u6548';
                } else {
                    isValid = false;
                    errorMsg = `HTTP ${response.status}`;
                }

                if (isValid && syncModels) {
                    fetchedModels = await fetchGoogleModels(key);
                }
            } else {
                return { valid: true };
            }

            return { valid: isValid, error: errorMsg, models: fetchedModels };
        } catch (e: any) {
            return { valid: false, error: e.message || '\u7F51\u7EDC\u9519\u8BEF' };
        }
    }

    /**
     * Update compatibility mode for a specific key (Persistence)
     * Used by GeminiService to remember working API format
     */
    public setKeyCompatibilityMode(keyId: string, mode: 'standard' | 'chat') {
        const slotIndex = this.state.slots.findIndex(s => s.id === keyId);
        if (slotIndex === -1) return;

        console.log(`[KeyManager] Persisting compatibility mode for key ${keyId}: ${mode}`);

        // Update state
        this.state.slots[slotIndex].compatibilityMode = mode;
        this.saveState();

        this.notifyListeners();
    }

    public getKey(id: string): KeySlot | undefined {
        return this.getProjectedSlots().find(s => s.id === id);
    }

    public getEffectiveKey(id: string): KeySlot | undefined {
        return this.getProjectedSlots().find((item) => item.id === id);
    }
    /**
     * Refresh a single key
     * Also re-sync the derived model list after refreshing.
     */
    async refreshKey(id: string): Promise<void> {
        if (isBrowserRuntime()) {
            console.warn('[KeyManager] Browser-side key refresh is disabled.');
            return;
        }

        const slot = this.state.slots.find(s => s.id === id);
        if (slot) {
            console.log(`[KeyManager] Refreshing key ${id} (Syncing models: YES)`);
            const linkedProvider = this.findLinkedProviderForSlot(slot);

            // 1. Validation phase
            // We pass syncModels=true for Google.
            // For Proxy/OpenAI, validateKey lacks baseUrl, so we handle model fetching manually here if valid.
            const result = await this.validateKey(slot.key, slot.provider, true);

            slot.status = result.valid ? 'valid' : 'invalid';
            slot.lastError = result.error || null;

            if (result.valid) {
                slot.disabled = false;
                slot.failCount = 0;
                const resolvedFormat = resolveApiProtocolFormat(slot.format, slot.baseUrl);

                // 2. Model Synchronization Phase
                let newModels: string[] = result.models || [];

                // If validateKey didn't return models (e.g. Proxy/Custom where it needs BaseURL), fetch them now
                if (!newModels.length && slot.baseUrl) {
                    if (resolvedFormat === 'gemini' || slot.provider === 'Google') {
                        // Fallback if validateKey missed it
                        newModels = await fetchGeminiCompatModels(slot.key, slot.baseUrl);
                    } else {
                        // Proxy / OpenAI
                        newModels = await fetchOpenAICompatModels(slot.key, slot.baseUrl);
                    }
                }

                // 3. Update Slot Models (Overwrite logic)
                if (newModels.length > 0) {
                    console.log(`[KeyManager] Sync success for ${id}. Overwriting models.`, {
                        old: slot.supportedModels?.length,
                        new: newModels.length
                    });

                    // Helper to merge if strictly required (e.g. Google defaults),
                    // but fetchGoogleModels already handles whitelisting/defaults.
                    // fetchOpenAICompatModels returns raw list.
                    // normalizeModelList handles deduplication.

                    if (slot.provider === 'Google') {
                        // Google models must remain official only
                        slot.supportedModels = normalizeModelList(newModels, 'Google', slot.baseUrl)
                            .filter((m: string) => isGoogleOfficialModelId(parseModelString(m).id));
                    } else {
                        // For proxies, we just take what they give us (plus normalization)
                        slot.supportedModels = normalizeModelList(newModels, slot.provider, slot.baseUrl);
                    }
                } else {
                    console.warn(`[KeyManager] Refresh valid but no models found for ${id}. Clearing stale model list.`);
                    slot.supportedModels = [];
                }

                if (linkedProvider) {
                    linkedProvider.models = normalizeModelList(slot.supportedModels || [], linkedProvider.name, linkedProvider.baseUrl);
                    linkedProvider.updatedAt = Date.now();
                }
            }

            this.saveState();
            if (linkedProvider) {
                this.saveProviders();
            }
            this.notifyListeners();
        }
    }

    /**
     * Re-validate all keys
     */
    async revalidateAll(): Promise<void> {
        if (isBrowserRuntime()) {
            console.warn('[KeyManager] Browser-side key revalidation is disabled.');
            return;
        }

        for (const slot of this.state.slots) {
            // We do NOT sync models during background revalidateAll to save bandwidth/latency,
            // unless we want to? Users requested "Reflects API capabilities", usually implies explicit action.
            // Let's keep revalidateAll light (connections only).
            // Only manual "refreshKey" does full sync.
            const result = await this.validateKey(slot.key, slot.provider, false);
            slot.status = result.valid ? 'valid' : 'invalid';
            slot.lastError = result.error || null;
            if (result.valid) {
                slot.disabled = false;
                slot.failCount = 0;
            }
        }
        this.saveState();
        this.notifyListeners();
    }

    /**
     * Record the result of a model call so we can update per-channel health and failure counts.
     */
    public reportCallResult(id: string, success: boolean, error?: string): void {
        const slot = this.state.slots.find(s => s.id === id);
        if (!slot) return;

        slot.lastUsed = Date.now();

        if (success) {
            slot.failCount = 0;
            slot.successCount++;
            slot.status = 'valid';
            slot.lastError = null;
        } else {
            slot.failCount++;
            slot.lastError = error || 'Unknown error';

            // Repeated failures should mark the channel invalid once it crosses the threshold.
            if (slot.failCount >= (this.state.maxFailures || 5)) {
                slot.status = 'invalid';
                console.warn(`[KeyManager] Channel ${slot.name} (${id}) failed repeatedly and was marked invalid.`);
            }
        }

        this.saveState();
        this.notifyListeners();
    }

    /**
     * Get validated global model list from all channels (Standard + Custom)
     * SORTING ORDER: User Custom Models (Top) -> Standard Google Models (Bottom)
     */
    getGlobalModelList(): {
        id: string;
        name: string;
        provider: string;
        providerLabel?: string;
        providerLogo?: string;
        isCustom: boolean;
        isSystemInternal?: boolean;
        type: GlobalModelType;
        icon?: string;
        description?: string;
        tags?: string[];
        tokenGroup?: string;
        billingType?: string;
        endpointType?: string;
        endpointTypes?: string[];
        colorStart?: string; // Gradient start color used in the model picker UI
        colorEnd?: string;
        colorSecondary?: string;
        textColor?: 'white' | 'black';
        creditCost?: number; // Credit cost badge shown in the model picker UI
    }[] {
        // Cache key includes active slots, admin models, and providers so the list stays fresh.
        const activeSlots = this.state.slots.filter(s => !s.disabled && s.status !== 'invalid');
        const slotsHash = `${activeSlots.length}-${activeSlots
            .map((slot) => {
                const supportedModels = normalizeModelList(slot.supportedModels || [], slot.provider, slot.baseUrl).join('||');
                return [
                    slot.id,
                    slot.provider,
                    String(slot.baseUrl || ''),
                    String(slot.format || ''),
                    String(slot.status || ''),
                    slot.disabled ? '1' : '0',
                    supportedModels,
                ].join(':');
            })
            .join(',')}`;

        // Include adminModels in the cache signature so admin updates invalidate the list immediately.
        const adminModels = [...adminModelService.getModels()].sort((left, right) => {
            const modelDiff = String(left.id || '').localeCompare(String(right.id || ''));
            if (modelDiff !== 0) return modelDiff;

            const priorityDiff = Number(right.priority || 0) - Number(left.priority || 0);
            if (priorityDiff !== 0) return priorityDiff;

            const weightDiff = Number(right.weight || 0) - Number(left.weight || 0);
            if (weightDiff !== 0) return weightDiff;

            return String(left.providerId || left.provider || '').localeCompare(
                String(right.providerId || right.provider || '')
            );
        });
        const adminHash = `${adminModels.length}-${adminModels
            .map(m => `${m.id}:${m.providerId || ''}:${m.providerName || ''}:${m.displayName}:${m.priority || 0}:${m.weight || 0}:${m.mixWithSameModel ? '1' : '0'}:${m.colorStart}:${m.colorEnd}:${m.colorSecondary || ''}:${m.textColor || ''}:${m.creditCost}`)
            .join(',')}`;

        // Include providers in the cache signature so provider changes refresh the list immediately.
        this.loadProviders();
        const providerHash = `${this.providers.length}-${this.providers
            .map((provider) => {
                const effectiveProviderModels = resolveEffectiveProviderModels({
                    provider: provider.name,
                    baseUrl: provider.baseUrl,
                    format: provider.format,
                    models: provider.models,
                }).join('||');

                return [
                    provider.id,
                    provider.isActive ? '1' : '0',
                    provider.name,
                    String(provider.baseUrl || ''),
                    String(provider.format || ''),
                    String(provider.updatedAt || 0),
                    effectiveProviderModels,
                ].join(':');
            })
            .join(',')}`;
        const combinedHash = `${slotsHash}|${adminHash}|${providerHash}`;

        const now = Date.now();

        if (this.globalModelListCache &&
            this.globalModelListCache.slotsHash === combinedHash &&
            now - this.globalModelListCache.timestamp < this.CACHE_TTL) {
            return this.globalModelListCache.models;
        }

        const uniqueModels = new Map<string, {
            id: string;
            name: string;
            provider: string;
            providerLabel?: string;
            providerLogo?: string;
            isCustom: boolean;
            isSystemInternal?: boolean;
            type: GlobalModelType;
            icon?: string;
            description?: string;
            tags?: string[];
            tokenGroup?: string;
            billingType?: string;
        endpointType?: string;
        endpointTypes?: string[];
            colorStart?: string; // Gradient start color used in the model picker UI
            colorEnd?: string;
            colorSecondary?: string;
            textColor?: 'white' | 'black';
            creditCost?: number; // Credit cost badge shown in the model picker UI
        }>();
        const normalizeUserSourceSignaturePart = (value?: string) =>
            String(value || '').trim().replace(/\/+$/, '').toLowerCase();
        const userSlotSourceSignatures = new Set(
            this.state.slots
                .filter(slot => !slot.disabled && slot.status !== 'invalid' && !!slot.key)
                .map(slot => [
                    normalizeUserSourceSignaturePart(slot.name || slot.proxyConfig?.serverName || slot.provider),
                    normalizeUserSourceSignaturePart(slot.baseUrl),
                    String(slot.key || '').trim(),
                ].join('|'))
                .filter(signature => signature !== '||')
        );

        // 1. Add models from all active keys (Proxies/Custom) - THESE GO FIRST
        this.state.slots.forEach(slot => {
            // Strict mode: ignore disabled, invalid, or empty key slots.
            if (slot.disabled || slot.status === 'invalid' || !slot.key) return;

            if (slot.supportedModels && slot.supportedModels.length > 0) {
                let cleanModels = normalizeModelList(slot.supportedModels, slot.provider, slot.baseUrl);

                cleanModels.forEach(rawModelStr => {
                    const { id, name, description } = parseModelString(rawModelStr);
                    // Drop deprecated alias IDs that should not surface in the picker
                    if (id === 'nano-banana' || id === 'nano-banana-pro') return;

                    let distinctId = id;
                    const suffix = slot.name || slot.proxyConfig?.serverName || slot.provider || 'Custom';
                    // Non-Google providers get a route-qualified model ID so parallel upstreams stay distinct.
                    if (slot.provider !== 'Google') {
                        distinctId = buildUserSlotRouteId(id, slot.id || suffix);
                    }

                    if (!uniqueModels.has(distinctId)) {
                        const meta = GOOGLE_MODEL_METADATA.get(id);
                        const registryInfo = (MODEL_REGISTRY as any)[id];
                        const displayProvider = slot.provider === 'Google' ? 'Google' : suffix;

                        uniqueModels.set(distinctId, {
                            id: distinctId,
                            name: name || registryInfo?.name || (meta ? meta.name : id),
                            provider: displayProvider,
                            providerLabel: slot.name || displayProvider,
                            isCustom: false,
                            isSystemInternal: false,
                            type: MODEL_TYPE_MAP.get(id) || inferModelType(id),
                            icon: registryInfo?.icon || meta?.icon,
                            description: description || registryInfo?.description || meta?.description || ''
                        });
                    }
                });
            }
        });

        // 1.5 Add active third-party provider models managed in API settings
        this.providers
            .filter(provider => provider.isActive && provider.apiKey && provider.baseUrl)
            .forEach(provider => {
                const providerSourceSignature = [
                    normalizeUserSourceSignaturePart(provider.name),
                    normalizeUserSourceSignaturePart(provider.baseUrl),
                    String(provider.apiKey || '').trim(),
                ].join('|');

                if (userSlotSourceSignatures.has(providerSourceSignature)) {
                    return;
                }

                const cleanModels = resolveEffectiveProviderModels({
                    provider: provider.name,
                    baseUrl: provider.baseUrl,
                    format: provider.format,
                    models: provider.models,
                });

                cleanModels.forEach(rawModelStr => {
                    const { id, name, description } = parseModelString(rawModelStr);
                    if (!id || id === 'nano-banana' || id === 'nano-banana-pro') return;

                    const distinctId = buildProviderRouteId(id, provider.id || provider.name);
                    if (uniqueModels.has(distinctId)) return;

                    const meta = GOOGLE_MODEL_METADATA.get(id);
                    const registryInfo = (MODEL_REGISTRY as any)[id];
                    const pricingMeta = provider.pricingSnapshot?.modelMeta?.[id]
                        || provider.pricingSnapshot?.modelMeta?.[String(id || '').toLowerCase()]
                        || provider.pricingSnapshot?.rows?.find((row) => String(row?.model || '').trim().toLowerCase() === String(id || '').trim().toLowerCase());

                    uniqueModels.set(distinctId, {
                        id: distinctId,
                        name: name || registryInfo?.name || (meta ? meta.name : id),
                        provider: provider.name,
                        providerLabel: pricingMeta?.providerLabel || pricingMeta?.provider || provider.name,
                        providerLogo: pricingMeta?.providerLogo,
                        isCustom: false,
                        isSystemInternal: false,
                        type: MODEL_TYPE_MAP.get(id) || inferModelType(id),
                        icon: provider.icon || registryInfo?.icon || meta?.icon,
                        description: description || pricingMeta?.description || registryInfo?.description || meta?.description || '',
                        tags: Array.isArray(pricingMeta?.tags) ? pricingMeta.tags : undefined,
                        tokenGroup: pricingMeta?.tokenGroup,
                        billingType: pricingMeta?.billingType,
                        endpointType: pricingMeta?.endpointType,
                        endpointTypes: pricingMeta?.endpointTypes,
                    });
                });
            });

        // 2. Add Standard Google Models (ONLY if valid keys exist for them)
        const googleSlots = this.state.slots.filter(s => s.provider === 'Google' && !s.disabled && s.status !== 'invalid' && !!s.key);
        if (googleSlots.length > 0) {
            GOOGLE_CHAT_MODELS.forEach(model => {
                // Only expose standard Google models when a healthy compatible key exists.
                if (!uniqueModels.has(model.id) && this.hasCustomKeyForModel(model.id)) {
                    uniqueModels.set(model.id, {
                        ...model,
                        provider: 'Google',
                        isCustom: false,
                        isSystemInternal: false,
                        type: MODEL_TYPE_MAP.get(model.id) || 'chat'
                    });
                }
            });
        }

        // 3. Add system internal models (built-in 12AI proxy).
        // Group admin models by base model ID so multiple provider routes share one logical entry.
        const adminModelsByBaseId = new Map<string, typeof adminModels>();
        adminModels.forEach(adminModel => {
            const baseId = String(adminModel.id || '').trim();
            if (!baseId) return;
            if (!adminModelsByBaseId.has(baseId)) {
                adminModelsByBaseId.set(baseId, []);
            }
            adminModelsByBaseId.get(baseId)!.push(adminModel);
        });

        adminModelsByBaseId.forEach((routes, baseId) => {
            const hasMultipleRoutes = routes.length > 1;
            const mixedRoutes = routes.filter((route) => route.mixWithSameModel);
            const shouldExposeMixedOnly = mixedRoutes.length > 1;
            const primaryRoute = shouldExposeMixedOnly
                ? mixedRoutes[0]
                : routes[0];
            const modelType = MODEL_TYPE_MAP.get(baseId) || (() => {
                const inferred = inferModelType(baseId);
                return (inferred === 'video' || inferred === 'audio') ? inferred : 'image';
            })();

            if (shouldExposeMixedOnly) {
                const mixedRouteId = `${baseId}@system`;
                const mixedDisplay = adminModelService.getModelDisplayInfo(mixedRouteId);
                if (!uniqueModels.has(mixedRouteId)) {
                    // 使用同组混合路由里最高优先级的展示配置，避免不同页面出现不同名称/颜色。
                    const mixedColorStart = mixedDisplay?.colorStart || primaryRoute.colorStart || '#475569';
                    const mixedColorEnd = mixedDisplay?.colorEnd || primaryRoute.colorEnd || '#334155';
                    const mixedColorSecondary =
                        mixedDisplay?.colorSecondary || primaryRoute.colorSecondary || mixedColorEnd;
                    const mixedTextColor = mixedDisplay?.textColor || primaryRoute.textColor || 'white';

                    uniqueModels.set(mixedRouteId, {
                        id: mixedRouteId,
                        name: mixedDisplay?.displayName || primaryRoute.displayName || baseId,
                        provider: 'SystemProxy',
                        providerLogo: undefined,
                        providerLabel: 'Mixed Route',
                        isCustom: false,
                        isSystemInternal: true,
                        type: modelType,
                        icon: undefined,
                        description: mixedDisplay?.advantages || primaryRoute.advantages || `Mixed routing enabled across ${mixedRoutes.length} matching routes`,
                        colorStart: mixedColorStart,
                        colorEnd: mixedColorEnd,
                        colorSecondary: mixedColorSecondary,
                        textColor: mixedTextColor,
                        creditCost: mixedDisplay?.creditCost ?? primaryRoute.creditCost,
                    });
                }

                // 🚀 [Fix] 只移除系统内部的同 baseId 路由，保留用户/供应商自定义条目
                for (const [modelId, modelData] of uniqueModels.entries()) {
                    const modelBaseId = String(modelData.id || '').split('@')[0];
                    const isSameBaseModel = modelBaseId === baseId;
                    const isOtherSystemRoute = modelData.isSystemInternal === true && modelData.id !== mixedRouteId;

                    if (isSameBaseModel && isOtherSystemRoute) {
                        uniqueModels.delete(modelId);
                    }
                }

                return;
            }

            routes.forEach((adminModel, index) => {
                const systemId = hasMultipleRoutes
                    ? buildStableSystemRouteId(baseId, adminModel.providerId, index + 1)
                    : `${baseId}@system`;

                if (!uniqueModels.has(systemId)) {
                    const routeProviderLabel = adminModel.providerName || adminModel.providerId || adminModel.provider || 'SystemProxy';

                    uniqueModels.set(systemId, {
                        id: systemId,
                        name: adminModel.displayName || adminModel.id,
                        provider: routeProviderLabel,
                        providerLabel: routeProviderLabel,
                        isCustom: false,
                        isSystemInternal: true,
                        type: modelType,
                        icon: undefined,
                        description: adminModel.advantages || 'System credit model route',
                        colorStart: adminModel.colorStart,
                        colorEnd: adminModel.colorEnd,
                        colorSecondary: adminModel.colorSecondary,
                        textColor: adminModel.textColor,
                        creditCost: adminModel.creditCost,
                    });
                }
            });
        });

        const result = Array.from(uniqueModels.values()).map((model) => {
            const baseId = String(model.id || '').split('@')[0];
            const relatedAdminRoutes = adminModelsByBaseId.get(baseId) || [];
            const isMixedRoute = model.provider === 'SystemProxy' && model.id === `${baseId}@system` && relatedAdminRoutes.length > 1;

            if (!isMixedRoute) {
                return model;
            }

            return {
                ...model,
                name: (relatedAdminRoutes.filter((route) => route.mixWithSameModel)[0]?.displayName)
                    || relatedAdminRoutes[0]?.displayName
                    || baseId,
                providerLabel: 'Mixed Route',
                description: (relatedAdminRoutes.filter((route) => route.mixWithSameModel)[0]?.advantages)
                    || relatedAdminRoutes[0]?.advantages
                    || `Mixed routing enabled across ${relatedAdminRoutes.length} matching routes`,
            };
        });

        // Refresh cache
        this.globalModelListCache = {
            models: result,
            slotsHash: combinedHash,
            timestamp: Date.now()
        };

        console.log('[keyManager.getGlobalModelList] Final model count:', result.length);
        return result;
    }

    /**
     * Get all key slots
     */
    private getProjectedSlots(): KeySlot[] {
        return this.state.slots.map((slot) => {
            const linkedProvider = this.findLinkedProviderForSlot(slot);
            return linkedProvider ? this.buildEffectiveSlotFromProvider(slot, linkedProvider) : slot;
        });
    }

    getSlots(): KeySlot[] {
        this.ensureCloudHydration();
        return this.getProjectedSlots();
    }

    private buildSlotChannelConfig(slot: KeySlot): ChannelConfig {
        const slotBaseUrl = slot.baseUrl
            || (slot.provider === 'OpenAI' ? 'https://api.openai.com' : GOOGLE_API_BASE);
        const runtime = resolveProviderRuntime({
            provider: slot.provider,
            baseUrl: slotBaseUrl,
            format: slot.format,
            authMethod: slot.authMethod,
            headerName: slot.headerName,
            compatibilityMode: slot.compatibilityMode,
        });
        const pricingSupport = runtime.pricingSupport === 'native' ? 'native' : runtime.pricingSupport === 'manual' ? 'manual' : 'none';
        const managementSupport = runtime.managementSupport === 'native' ? 'native' : runtime.managementSupport === 'external' ? 'external' : 'none';
        const surfaces = buildChannelSurfaceView({
            runtime,
            documentedModels: getDocumentedStaticModelsForProvider(runtime.strategyId),
        });
        const effectiveSlotModels = resolveEffectiveProviderModels({
            provider: slot.provider,
            baseUrl: slot.baseUrl,
            format: slot.format,
            models: slot.supportedModels,
        });

        return {
            id: slot.id,
            name: slot.name || slot.provider || 'Unnamed Channel',
            baseUrl: slotBaseUrl,
            apiKey: getRedactedChannelConfigApiKey(),
            provider: slot.provider,
            providerFamily: runtime.providerFamily,
            protocolHint: normalizeApiProtocolFormat(slot.format, runtime.resolvedFormat),
            authProfile: {
                authMethod: slot.authMethod || (runtime.authMethod as AuthMethod),
                headerName: slot.headerName || runtime.headerName,
                authorizationValueFormat: runtime.authorizationValueFormat,
            },
            capabilities: buildChannelCapabilities(effectiveSlotModels, pricingSupport, managementSupport),
            pricingSupport,
            managementSupport,
            supportedModels: effectiveSlotModels,
            surfaces,
            group: slot.group,
            compatibilityMode: slot.compatibilityMode,
            source: slot.provider === 'SystemProxy' ? 'system' : 'user-slot',
        };
    }

    private buildProviderChannelConfig(provider: ThirdPartyProvider): ChannelConfig {
        const runtime = resolveProviderRuntime({
            provider: provider.name,
            baseUrl: provider.baseUrl,
            format: provider.format,
        });
        const effectiveProviderModels = resolveEffectiveProviderModels({
            provider: provider.name,
            baseUrl: provider.baseUrl,
            format: provider.format,
            models: provider.models,
        });
        const pricingSupport = runtime.pricingSupport === 'native' ? 'native' : runtime.pricingSupport === 'manual' ? 'manual' : 'none';
        const managementSupport = runtime.managementSupport === 'native' ? 'native' : runtime.managementSupport === 'external' ? 'external' : 'none';
        const surfaces = buildChannelSurfaceView({
            runtime,
            documentedModels: getDocumentedStaticModelsForProvider(runtime.strategyId),
        });

        return {
            id: provider.id,
            name: provider.name,
            baseUrl: provider.baseUrl,
            apiKey: getRedactedChannelConfigApiKey(),
            provider: runtime.uiProvider,
            providerFamily: runtime.providerFamily,
            protocolHint: normalizeApiProtocolFormat(provider.format, runtime.resolvedFormat),
            authProfile: {
                authMethod: runtime.authMethod as AuthMethod,
                headerName: runtime.headerName,
                authorizationValueFormat: runtime.authorizationValueFormat,
            },
            capabilities: buildChannelCapabilities(effectiveProviderModels, pricingSupport, managementSupport),
            pricingSupport,
            managementSupport,
            supportedModels: effectiveProviderModels,
            surfaces,
            group: provider.group,
            compatibilityMode: runtime.compatibilityMode,
            source: 'provider',
        };
    }

    getChannelConfigs(options?: { includeDisabled?: boolean; includeProviders?: boolean }): ChannelConfig[] {
        const includeDisabled = options?.includeDisabled ?? true;
        const includeProviders = options?.includeProviders ?? true;
        const slotChannels = this.getProjectedSlots()
            .filter((slot) => includeDisabled || !slot.disabled)
            .map((slot) => this.buildSlotChannelConfig(slot));

        if (!includeProviders) {
            return slotChannels;
        }

        this.loadProviders();
        const providerChannels = this.providers
            .filter((provider) => includeDisabled || provider.isActive)
            .map((provider) => this.buildProviderChannelConfig(provider));

        return [...slotChannels, ...providerChannels];
    }

    getChannelConfig(id: string): ChannelConfig | undefined {
        const slot = this.getProjectedSlots().find((item) => item.id === id);
        if (slot) {
            return this.buildSlotChannelConfig(slot);
        }

        this.loadProviders();
        const provider = this.providers.find((item) => item.id === id);
        return provider ? this.buildProviderChannelConfig(provider) : undefined;
    }

    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        valid: number;
        invalid: number;
        disabled: number;
        rateLimited: number;
    } {
        const slots = this.getProjectedSlots();
        return {
            total: slots.length,
            valid: slots.filter(s => s.status === 'valid' && !s.disabled).length,
            invalid: slots.filter(s => s.status === 'invalid').length,
            disabled: slots.filter(s => s.disabled).length,
            rateLimited: slots.filter(s => s.status === 'rate_limited').length
        };
    }

    /**
     * Check if any valid keys are available
     */
    hasValidKeys(): boolean {
        return this.getProjectedSlots().some(s => !s.disabled && s.status !== 'invalid');
    }

    /**
     * Determine whether a model can be served by any active custom API key or provider route.
     * Built-in system routes such as @system or @12ai are excluded from this check.
     */
    hasCustomKeyForModel(modelIdFull: string): boolean {
        const parts = (modelIdFull || '').split('@');
        const normalizedModelId = parts[0].toLowerCase().trim();
        const suffix = parts.length > 1 ? parts[1].toLowerCase().trim() : null;

        // Built-in route suffixes such as @system, @system_2, @12ai, and @systemproxy
        // should never be mistaken for user-managed keys or third-party channels.
        if (suffix?.startsWith('system') || suffix === '12ai' || suffix === 'systemproxy') {
            return false;
        }

        const hasValidSlot = this.getProjectedSlots().some(s => {
            if (s.disabled || s.status === 'invalid') return false;
            // Budget check: if budget is set and exhausted, it's effectively invalid
            if (isUsageLimitExceeded(s)) return false;

            // Scenario 1: Exact model support in supportedModels array (or wildcard)
            const supported = s.supportedModels || [];
            if (supported.includes('*') || supported.includes(normalizedModelId)) return true;

            // Scenario 2: If model was selected with a provider suffix (e.g. @MyChannel)
            if (suffix) {
                if (matchesSlotRouteSuffix(s, suffix)) {
                    return true;
                }
            }

            return false;
        });

        if (hasValidSlot) return true;

        // Also inspect ThirdPartyProvider entries because custom APIs live there now.
        this.loadProviders();
        return this.providers.some(p => {
            if (!p.isActive) return false;
            if (isUsageLimitExceeded({
                budgetLimit: resolveProviderBudgetLimit(p),
                totalCost: p.usage?.totalCost,
                tokenLimit: resolveProviderTokenLimit(p),
                usedTokens: p.usage?.totalTokens,
            })) return false;

            const effectiveProviderModels = resolveEffectiveProviderModels({
                provider: p.name,
                baseUrl: p.baseUrl,
                format: p.format,
                models: p.models,
            });

            // Check if model matches asterisk or specifically supported
            if (effectiveProviderModels.includes('*') || effectiveProviderModels.includes(normalizedModelId)) return true;

            // Check if suffix matches provider name
            if (suffix) {
                if (matchesProviderRouteSuffix(p, suffix)) return true;
            }

            return false;
        });
    }

    /**
     * Set max failures threshold
     */
    setMaxFailures(count: number): void {
        this.state.maxFailures = Math.max(1, count);
        this.saveState();
    }

    // =========================================================================
    // Third-party / proxy API provider management
    // =========================================================================

    private providers: ThirdPartyProvider[] = [];

    /**
     * Add a new third-party provider definition.
     */
    getProviders(): ThirdPartyProvider[] {
        this.loadProviders();
        this.ensureCloudHydration();
        return [...this.providers];
    }

    /**
     * Returns a provider by ID.
     */
    getProvider(id: string): ThirdPartyProvider | undefined {
        this.loadProviders();
        return this.providers.find(p => p.id === id);
    }

    getProviderForKeySlot(slotOrId: string | KeySlot): ThirdPartyProvider | undefined {
        this.loadProviders();

        if (typeof slotOrId === 'string') {
            const directProvider = this.providers.find((provider) => provider.id === slotOrId);
            if (directProvider) return directProvider;

            const slot = this.state.slots.find((entry) => entry.id === slotOrId);
            return slot ? this.findLinkedProviderForSlot(slot) || undefined : undefined;
        }

        return this.findLinkedProviderForSlot(slotOrId) || undefined;
    }

    /**
     * 添加新的第三方供应商配置。
     */
    addProvider(config: Omit<ThirdPartyProvider, 'id' | 'usage' | 'status' | 'createdAt' | 'updatedAt'>): ThirdPartyProvider {
        const secureModeError = this.ensureAuthenticatedUserApiMode();
        if (secureModeError) {
            throw new Error(secureModeError);
        }

        this.loadProviders();

        const now = Date.now();
        const providerModels = resolveEffectiveProviderModels({
            provider: config.name,
            baseUrl: config.baseUrl,
            format: config.format,
            models: config.models,
        });
        const provider: ThirdPartyProvider = {
            ...config,
            models: providerModels,
            format: normalizeApiProtocolFormat(config.format, 'auto'),
            id: `provider_${now}_${Math.random().toString(36).substr(2, 9)}`,
            usage: {
                totalTokens: 0,
                totalCost: 0,
                dailyTokens: 0,
                dailyCost: 0,
                lastReset: now
            },
            status: 'checking',
            createdAt: now,
            updatedAt: now
        };

        this.providers.push(provider);
        this.saveProviders();
        this.syncLegacySlotsWithProvider(provider);
        this.globalModelListCache = null; // Clear the model list cache so the picker refreshes immediately
        this.notifyListeners();

        // 简体中文注释：价格抓取会触发外部请求，新增通道默认只保存配置，交给页面里的“高级抓取”显式触发。

        return provider;
    }

    /**
     * Update an existing third-party provider.
     */
    updateProvider(id: string, updates: Partial<Omit<ThirdPartyProvider, 'id' | 'createdAt'>>): boolean {
        const secureModeError = this.ensureAuthenticatedUserApiMode();
        if (secureModeError) {
            throw new Error(secureModeError);
        }

        this.loadProviders();

        const index = this.providers.findIndex(p => p.id === id);
        if (index === -1) return false;

        const previousProvider = { ...this.providers[index] };
        const normalizedFormat = normalizeApiProtocolFormat(updates.format ?? previousProvider.format, 'auto');
        const connectionFieldsChanged = (
            (updates.baseUrl !== undefined
                && normalizeProviderLinkValue(updates.baseUrl) !== normalizeProviderLinkValue(previousProvider.baseUrl))
            || (updates.apiKey !== undefined
                && String(updates.apiKey || '').trim() !== String(previousProvider.apiKey || '').trim())
            || (updates.format !== undefined
                && normalizedFormat !== normalizeApiProtocolFormat(previousProvider.format, 'auto'))
        );
        const hasExplicitHealthUpdate = (
            Object.prototype.hasOwnProperty.call(updates, 'status')
            || Object.prototype.hasOwnProperty.call(updates, 'lastError')
            || Object.prototype.hasOwnProperty.call(updates, 'lastChecked')
        );
        const nextProviderModels = updates.models !== undefined
            ? updates.models
            : connectionFieldsChanged
                ? []
                : previousProvider.models;

        const nextProvider: ThirdPartyProvider = {
            ...previousProvider,
            ...updates,
            models: resolveEffectiveProviderModels({
                provider: String((updates.name ?? previousProvider.name) || '').trim(),
                baseUrl: String((updates.baseUrl ?? previousProvider.baseUrl) || '').trim(),
                format: normalizedFormat,
                models: nextProviderModels,
            }),
            format: normalizedFormat,
            updatedAt: Date.now()
        };

        if (connectionFieldsChanged && !hasExplicitHealthUpdate) {
            nextProvider.lastError = undefined;
            nextProvider.lastChecked = undefined;

            if (nextProvider.status === 'error') {
                nextProvider.status = 'active';
            }
        }

        this.providers[index] = nextProvider;

        this.saveProviders();
        this.syncLegacySlotsWithProvider(this.providers[index], previousProvider);
        this.globalModelListCache = null; // Clear the model list cache so the picker refreshes immediately
        this.notifyListeners();

        // 简体中文注释：更新地址或密钥时不再自动抓价，避免用户保存基础信息时产生隐式网络动作。

        return true;
    }

    private syncLegacySlotsWithProvider(
        provider: ThirdPartyProvider,
        previousProvider?: Partial<ThirdPartyProvider>,
        options?: { persistState?: boolean }
    ): boolean {
        const matchedSlots = findProviderLinkedSlots(
            this.state.slots,
            [provider, previousProvider],
            { allowSingleBaseUrlFallback: true },
        );

        if (matchedSlots.length === 0) return false;

        let changed = false;

        matchedSlots.forEach((slot) => {
            const nextKey = String(provider.apiKey || '').trim();
            const nextName = provider.name;
            const nextBaseUrl = provider.baseUrl;
            const nextGroup = provider.group;
            const nextDisabled = !provider.isActive;
            const nextFormat = normalizeApiProtocolFormat(provider.format, slot.format || 'auto');
            const nextSupportedModels = normalizeModelList(provider.models || [], slot.provider, nextBaseUrl);
            const nextType = determineKeyType(slot.provider, nextBaseUrl);

            const runtime = resolveProviderRuntime({
                provider: slot.provider,
                baseUrl: nextBaseUrl,
                format: nextFormat,
                authMethod: slot.authMethod,
                headerName: slot.headerName,
                compatibilityMode: slot.compatibilityMode,
            });

            const nextAuthMethod = runtime.authMethod as AuthMethod;
            const nextHeaderName = runtime.headerName;
            const nextCompatibilityMode = runtime.compatibilityMode;
            const slotModels = Array.isArray(slot.supportedModels) ? slot.supportedModels : [];
            const modelsChanged = slotModels.join('||') !== nextSupportedModels.join('||');

            const slotChanged = (
                String(slot.key || '') !== nextKey
                || String(slot.name || '') !== String(nextName || '')
                || String(slot.baseUrl || '') !== String(nextBaseUrl || '')
                || String(slot.group || '') !== String(nextGroup || '')
                || Boolean(slot.disabled) !== nextDisabled
                || normalizeApiProtocolFormat(slot.format, 'auto') !== nextFormat
                || modelsChanged
                || slot.type !== nextType
                || slot.authMethod !== nextAuthMethod
                || slot.headerName !== nextHeaderName
                || slot.compatibilityMode !== nextCompatibilityMode
            );

            slot.key = nextKey;
            slot.name = nextName;
            slot.baseUrl = nextBaseUrl;
            slot.group = nextGroup;
            slot.disabled = nextDisabled;
            slot.format = nextFormat;
            slot.supportedModels = nextSupportedModels;
            slot.type = nextType;
            slot.authMethod = nextAuthMethod;
            slot.headerName = nextHeaderName;
            slot.compatibilityMode = nextCompatibilityMode;

            if (slotChanged) {
                slot.updatedAt = Date.now();
                changed = true;
            }
        });

        if (changed && options?.persistState !== false) {
            this.saveState();
        }
        if (changed) {
            console.log(
                `[KeyManager] Synced ${matchedSlots.length} legacy slot(s) from provider ${provider.name}: ${matchedSlots.map((slot) => `${slot.name}[${slot.id}]`).join(', ')}`
            );
        }

        return changed;
    }

    private clearLegacySlotsForRemovedProvider(
        provider: ThirdPartyProvider,
        options?: { persistState?: boolean }
    ): boolean {
        const matchedSlots = findProviderLinkedSlots(this.state.slots, [provider]);

        if (matchedSlots.length === 0) return false;

        let changed = false;

        matchedSlots.forEach((slot) => {
            const slotModels = Array.isArray(slot.supportedModels) ? slot.supportedModels : [];
            const slotChanged = Boolean(slot.disabled !== true || slotModels.length > 0);

            slot.disabled = true;
            slot.supportedModels = [];

            if (slotChanged) {
                slot.updatedAt = Date.now();
                changed = true;
            }
        });

        if (changed && options?.persistState !== false) {
            this.saveState();
        }
        if (changed) {
            console.log(
                `[KeyManager] Cleared ${matchedSlots.length} linked legacy slot(s) after provider removal: ${matchedSlots.map((slot) => `${slot.name}[${slot.id}]`).join(', ')}`
            );
        }

        return changed;
    }

    private findLinkedProviderForSlot(slot: KeySlot): ThirdPartyProvider | null {
        return findLinkedProviderForSlot(slot, this.providers);
    }

    private buildEffectiveSlotFromProvider(slot: KeySlot, provider: ThirdPartyProvider): KeySlot {
        return buildEffectiveSlotFromProvider(
            slot,
            provider,
            (models, providerName) => normalizeModelList(models, providerName),
            resolveProviderRuntime,
        );
    }

    /**
     * 移除第三方供应商配置。
     */
    removeProvider(id: string): boolean {
        this.loadProviders();

        const index = this.providers.findIndex(p => p.id === id);
        if (index === -1) return false;

        const removedProvider = this.providers[index];
        this.providers.splice(index, 1);
        this.clearLegacySlotsForRemovedProvider(removedProvider, { persistState: false });
        this.saveProviders();
        this.globalModelListCache = null; // Clear the model list cache so the picker refreshes immediately
        this.notifyListeners();
        return true;
    }

    /**
     * 记录服务商使用量
     */
    addProviderUsage(providerId: string, tokens: number, cost: number): void {
        const provider = this.applyProviderUsageDelta(providerId, tokens, cost);
        if (!provider) return;
        this.saveProviders();
        this.notifyListeners();
    }

    /**
     * Returns aggregated provider statistics.
     */
    getProviderStats(): {
        total: number;
        active: number;
        totalCost: number;
        dailyCost: number;
    } {
        this.loadProviders();

        return {
            total: this.providers.length,
            active: this.providers.filter(p => p.isActive && p.status === 'active').length,
            totalCost: this.providers.reduce((sum, p) => sum + p.usage.totalCost, 0),
            dailyCost: this.providers.reduce((sum, p) => sum + p.usage.dailyCost, 0)
        };
    }

    /**
     * 从预设创建服务商
     */
    createProviderFromPreset(presetKey: string, apiKey: string, customModels?: string[]): ThirdPartyProvider | null {
        const preset = PROVIDER_PRESETS[presetKey];
        if (!preset) return null;

        const provider = this.addProvider({
            name: preset.name,
            baseUrl: preset.baseUrl,
            apiKey,
            models: customModels || preset.models,
            format: preset.format,
            icon: preset.icon,
            isActive: true
        });

        // 简体中文注释：预设创建同样只保存配置，价格和消耗信息由用户在高级抓取中手动获取。

        return provider;
    }

    /**
     * Fetch /api/pricing from a provider and persist the snapshot for later use.
     */
    async syncProviderPricingDetailed(providerId: string): Promise<{
        ok: boolean;
        message?: string;
        endpointUrl?: string;
        attemptedUrls?: string[];
        count?: number;
    }> {
        if (isBrowserRuntime()) {
            return {
                ok: false,
                message: BROWSER_DIRECT_PROVIDER_CHECKS_DISABLED_MESSAGE,
            };
        }

        this.loadProviders();
        const provider = this.providers.find(p => p.id === providerId);
        if (!provider) {
            return { ok: false, message: '未找到对应的供应商配置。' };
        }
        if (!provider.baseUrl) {
            return { ok: false, message: '当前供应商还没有填写基础地址。' };
        }

        const runtime = resolveProviderRuntime({
            baseUrl: provider.baseUrl,
            format: provider.format,
        });
        if (runtime.pricingSupport === 'none') {
            const message = `供应商 ${provider.name} 当前未暴露可抓取的价格端点，需要手动录入价格。`;
            console.info(`[KeyManager] ${message}`);
            return { ok: false, message };
        }

        if (!provider.pricingSnapshot) {
            const sharedPricing = await getCachedPricingByBaseUrl(provider.baseUrl);
            const cachedSnapshot = buildPricingSnapshotFromSharedCache(sharedPricing || []);
            if (cachedSnapshot) {
                provider.pricingSnapshot = mergeProviderPricingSnapshot(cachedSnapshot, provider.pricingSnapshot);
                this.saveProviders();
                this.notifyListeners();
                return {
                    ok: true,
                    message: `已从共享价格缓存载入 ${sharedPricing?.length || 0} 条价格数据。`,
                    count: sharedPricing?.length || 0,
                };
            }
        }

        try {
            const result = await fetchRawPricingCatalog(
                provider.baseUrl,
                provider.apiKey,
                normalizeApiProtocolFormat(provider.format, 'auto')
            );

            if (!result?.pricingData?.length) {
                const message = result?.error || `未能从 ${provider.baseUrl} 解析到可用价格数据。`;
                console.warn(`[KeyManager] Pricing API not available for ${provider.name}: ${message}`);
                if (result?.attemptedUrls?.length) {
                    console.warn(`[KeyManager] Attempted pricing URLs for ${provider.name}:`, result.attemptedUrls);
                }
                return {
                    ok: false,
                    message,
                    endpointUrl: result?.endpointUrl,
                    attemptedUrls: result?.attemptedUrls,
                };
            }

            console.log(`[KeyManager] Syncing pricing for ${provider.name} from ${result.endpointUrl}...`);

            const fetchedSnapshot = buildProviderPricingSnapshot(result.pricingData, result.groupRatio, {
                fetchedAt: Date.now(),
                note: `Synced from ${result.endpointUrl}`,
            });

            provider.pricingSnapshot = mergeProviderPricingSnapshot(fetchedSnapshot, provider.pricingSnapshot);

            this.saveProviders();
            this.notifyListeners();

            const sharedPricing = buildSharedPricingItemsFromRawCatalog(
                result.pricingData,
                result.groupRatio,
                result.endpointUrl,
            );
            if (sharedPricing.length > 0) {
                void cacheProviderPricingByBaseUrl(provider.baseUrl, sharedPricing);
            }

            console.log(`[KeyManager] Successfully synced pricing for ${provider.name}. Models found: ${result.pricingData.length}`);
            return {
                ok: true,
                message: `已同步 ${result.pricingData.length} 条价格数据。`,
                endpointUrl: result.endpointUrl,
                attemptedUrls: result.attemptedUrls,
                count: result.pricingData.length,
            };
        } catch (e) {
            const message = e instanceof Error ? e.message : '价格同步请求失败。';
            console.warn(`[KeyManager] Failed or timed out syncing pricing for ${provider.name}:`, e);
            return { ok: false, message };
        }
    }

    async syncProviderPricing(providerId: string): Promise<boolean> {
        const result = await this.syncProviderPricingDetailed(providerId);
        return result.ok;
    }

    /**
     * Normalize stored third-party providers before they enter the workbench.
     */
    private normalizeStoredProviders(rawProviders: unknown): ThirdPartyProvider[] {
        return normalizeStoredProviders<ThirdPartyProvider>(
            rawProviders,
            (models, providerName) => normalizeModelList(models, providerName),
        ).map((provider) => ({
            ...provider,
            models: resolveEffectiveProviderModels({
                provider: provider.name,
                baseUrl: provider.baseUrl,
                format: provider.format,
                models: provider.models,
            }),
        }));
    }

    private persistProvidersLocal(): void {
        try {
            const allowLocal = this.authIsTempUser || !this.hasHydratedCloudState;
            this.providerStorageScope = persistProvidersLocal(
                this.userId,
                this.providers,
                allowLocal,
            );
        } catch (e) {
            console.error('[KeyManager] Failed to save providers:', e);
        }
    }

    private loadProviders(force = false): void {
        try {
            const allowLocal = this.authIsTempUser || !this.hasHydratedCloudState;
            const loaded = loadProvidersFromLocal(
                this.userId,
                this.providers,
                force,
                allowLocal,
            );
            if (!loaded) {
                return;
            }

            this.providers = loaded.providers;
            this.providerStorageScope = loaded.scope;
        } catch (e) {
            console.error('[KeyManager] Failed to load providers:', e);
            this.providers = [];
            this.providerStorageScope = 'none';
        }
    }

    /**
     * 保存第三方供应商配置。
     */
    private saveProviders(): void {
        this.persistProvidersLocal();

        if (this.userId) {
            markPendingProviderCloudSync(this.cloudSyncState);
            void this.flushPendingCloudSync();
        }
    }

}

// Singleton instance
export const keyManager = new KeyManager();
registerCapabilityRouteKeyManager(keyManager);
adminModelService.registerModelRefreshHandler(() => {
    keyManager.clearGlobalModelListCache();
    keyManager.forceNotify();
});
// Force Vite HMR Cache Invalidation: 2026-03-02-03-05

export default keyManager;

// ============================================================================
// API type detection helpers
// ============================================================================

/**
 * Fetch available Google models using the official models endpoint.
 */
export async function fetchGoogleModels(apiKey: string): Promise<string[]> {
    if (isBrowserRuntime()) {
        throw createBrowserDirectProviderChecksDisabledError();
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            console.error('[KeyManager] Failed to fetch Google models:', response.status);
            const responseText = await response.text().catch(() => '');
            const failure = classifyApiFailure({
                status: response.status,
                responseText,
                fallbackMessage: `HTTP ${response.status}`
            });
            throw new Error(buildUserFacingApiErrorMessage(failure));
        }

        const data = await response.json();
        const discovery = buildGoogleModelDiscoveryResult(data);

        console.log(`[KeyManager] Strict whitelist kept ${discovery.strictModels.length} models:`, discovery.strictModels);
        console.log('[KeyManager] Merged Google model list:', discovery.finalModels);
        return discovery.finalModels;
    } catch (error) {
        console.error('[KeyManager] Error fetching Google models:', error);
        const failure = classifyApiFailure({
            error,
            fallbackMessage: error instanceof Error ? error.message : 'Google models request failed'
        });
        throw new Error(buildUserFacingApiErrorMessage(failure));
    }
}

export async function fetchGeminiCompatModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    if (isBrowserRuntime()) {
        throw createBrowserDirectProviderChecksDisabledError();
    }

    const lowerBase = String(baseUrl || '').toLowerCase();
    if (!baseUrl || lowerBase.includes('googleapis.com') || lowerBase.includes('generativelanguage.googleapis.com')) {
        return fetchGoogleModels(apiKey);
    }

    try {
        const runtime = resolveProviderRuntime({
            baseUrl,
            format: 'gemini',
        });
        const documentedModels = getDocumentedStaticModelsForProvider(runtime.strategyId);
        if (documentedModels.length > 0) {
            return documentedModels;
        }
        const authMethod = runtime.authMethod as AuthMethod;
        const response = await fetch(buildGeminiModelsEndpoint(baseUrl, apiKey, authMethod), {
            headers: buildGeminiHeaders(authMethod, apiKey, runtime.headerName, runtime.authorizationValueFormat)
        });

        if (!response.ok) {
            console.error('[KeyManager] Failed to fetch Gemini-compatible models:', response.status, response.statusText);
            const responseText = await response.text().catch(() => '');
            const failure = classifyApiFailure({
                status: response.status,
                responseText,
                fallbackMessage: `HTTP ${response.status}`
            });
            if (response.status === 404) {
                return [];
            }
            throw new Error(buildUserFacingApiErrorMessage(failure));
        }
        const data = await response.json();
        return extractGeminiCompatModelIds(data);
    } catch (error) {
        console.error('[KeyManager] Error fetching Gemini-compatible models:', error);
        const failure = classifyApiFailure({
            error,
            fallbackMessage: error instanceof Error ? error.message : 'Gemini-compatible models request failed'
        });
        throw new Error(buildUserFacingApiErrorMessage(failure));
    }
}

/**
 * Fetch models from an OpenAI-compatible endpoint and normalize the response.
 */
export async function fetchOpenAICompatModels(apiKey: string, baseUrl: string): Promise<string[]> {
    if (isBrowserRuntime()) {
        throw createBrowserDirectProviderChecksDisabledError();
    }

    try {
        const runtime = resolveProviderRuntime({
            baseUrl,
            format: 'openai',
        });
        const response = await fetch(applyOpenAICompatAuthToUrl(
            buildOpenAIEndpoint(baseUrl, 'models'),
            runtime.authMethod as AuthMethod,
            apiKey,
        ), {
            headers: buildProxyHeaders(runtime.authMethod as AuthMethod, apiKey, runtime.headerName, undefined, runtime.authorizationValueFormat)
        });

        if (!response.ok) {
            console.error('[KeyManager] Failed to fetch proxy models:', response.status, response.statusText);
            if (response.status === 401) {
                throw new Error('认证失败（401）：API Key 无效、已过期，或缺少访问权限。');
            }
            if (response.status === 403) {
                throw new Error('权限不足（403）：当前 API Key 无权访问模型列表接口。');
            }
            if (response.status === 404) {
                console.warn('[KeyManager] Provider does not expose /v1/models, returning an empty model list.');
                return [];
            }
            throw new Error(`获取模型列表失败（${response.status}）：${response.statusText || '请检查接口地址和 API Key。'}`);
        }

        const data = await response.json();
        const discovery = buildOpenAICompatModelDiscoveryResult(data);

        console.log('[KeyManager] /v1/models response:', {
            count: discovery.rawCount,
            firstModel: discovery.firstModel,
            dataType: discovery.hasDataArray ? 'object' : typeof (data as { data?: unknown }).data,
            hasObjectField: discovery.hasObjectField,
        });

        console.log(`[KeyManager] Deduplicated down to ${discovery.models.length} unique models:`, discovery.models);
        registerRemoteModelMetadata(discovery.metadataByModelId);
        return discovery.models;
    } catch (error) {
        console.error('[KeyManager] Error fetching proxy models:', error);
        return [];
    }
}

/**
 * Auto-detect available models from the configured API endpoint and infer its protocol family.
 */
export async function autoDetectAndConfigureModels(
    apiKey: string,
    baseUrl?: string,
    preferredFormat?: ApiProtocolFormat
): Promise<{
    success: boolean;
    models: string[];
    categories: ReturnType<typeof categorizeModels>;
    apiType: string;
}> {
    if (isBrowserRuntime()) {
        return {
            success: false,
            models: [],
            categories: categorizeModels([]),
            apiType: 'browser-direct-disabled',
        };
    }

    const apiType = detectApiType(apiKey, baseUrl);
    const resolvedFormat = resolveApiProtocolFormat(
        preferredFormat,
        baseUrl,
        apiType === 'google-official' ? 'gemini' : 'openai'
    );
    console.log('[KeyManager] API type resolved:', apiType);

    let models: string[] = [];
    const runtime = resolveProviderRuntime({
        baseUrl,
        format: resolvedFormat === 'gemini' ? 'gemini' : preferredFormat,
    });
    const documentedModels = getDocumentedStaticModelsForProvider(runtime.strategyId);
    if (documentedModels.length > 0) {
        models = documentedModels;
    }

    if (models.length === 0 && runtime.strategyId === 'wuyinkeji' && baseUrl) {
        try {
            // 简体中文注释：对于五音科技，先拉取官方产品目录，再只把当前应用可直接生成的异步模型放进选择列表。
            const catalog = await fetchWuyinPricingCatalog(baseUrl);
            models = selectWuyinGeneratableCatalogModels(catalog).map((item) => item.modelId).filter(Boolean);
        } catch (err) {
            console.warn('[KeyManager] Failed to fetch Wuyin catalog dynamically, using static fallback models:', err);
            models = [
                'video_google_omni',
                'video_vidu',
                'video_omni',
                'video_digital_humans',
                'video_package',
                'video_veo3.1_fast',
                'video_grok_imagine',
                'video_wan2.6',
                'image_gpt',
                'image_nanoBanana2',
                'image_grok_imagine',
                'image_nanoBanana_pro',
                'image_nanoBanana',
                'image_wan2.6',
                'audio_tts',
                'sora2-new',
                'async_detail',
                'chat_index',
                'img_split',
                'sora2_detail',
                'voice_composite',
                'voice_clone',
            ];
        }
    }

    if (models.length === 0 && baseUrl && runtime.pricingSupport === 'native' && runtime.strategyId !== '12ai' && runtime.strategyId !== 'wuyinkeji') {
        try {
            const pricingCatalog = await fetchRawPricingCatalog(baseUrl, apiKey, resolvedFormat);
            const pricingModels = extractModelIdsFromPricingData(pricingCatalog?.pricingData || []);

            if (pricingModels.length > 0) {
                console.log(`[KeyManager] Loaded ${pricingModels.length} models from pricing endpoint ${pricingCatalog?.endpointUrl || '(unknown)'}`);
                models = pricingModels;
            }
        } catch (error) {
            console.warn('[KeyManager] Failed to derive models from pricing endpoint:', error);
        }
    }

    if (models.length === 0 && resolvedFormat === 'gemini') {
        models = await fetchGeminiCompatModels(apiKey, baseUrl);
    } else if (models.length === 0 && apiType === 'google-official') {
        models = await fetchGoogleModels(apiKey);
    } else if (models.length === 0 && apiType === 'proxy' && baseUrl) {
        models = await fetchOpenAICompatModels(apiKey, baseUrl);
    } else if (models.length === 0 && apiType === 'openai') {
        // OpenAI falls back to a small built-in model list when discovery returns nothing.
        models = DEFAULT_OPENAI_MODELS;
    }

    // Normalize the discovered models before categorizing them.
    const normalizedModels = normalizeModelList(
        models,
        resolvedFormat === 'gemini' ? String(runtime.uiProvider || 'Google') : 'Proxy',
        baseUrl,
    );

    const categories = categorizeModels(normalizedModels);

    return {
        success: normalizedModels.length > 0,
        models: normalizedModels,
        categories,
        apiType: preferredFormat && preferredFormat !== 'auto' ? preferredFormat : apiType
    };
}

// Re-export ProxyModelConfig for convenience




