import { AspectRatio, ImageSize, type ModelType, type ReferenceImage} from '../../types';
import { calculateCost } from '../billing/costService';
import { classifyApiFailure } from '../api/errorClassification';
import { logError } from '../system/systemLogService';
import { getImage } from '../storage/imageStorage';
import { llmService } from './LLMService';
import { type ImageGenerationOptions, type ProviderConfig} from './LLMAdapter';
import { getMaxRefImages } from '../model/modelCapabilities';
import { abortSyncImageBridgeRequest } from './syncImageBridge';
import {
  isSecureProxyGuestModeError,
  isSecureProxySessionReauthError,
  SECURE_PROXY_GUEST_MODE_MESSAGE,
  SECURE_PROXY_SESSION_REAUTH_MESSAGE,
} from '../model/secureModelProxy';
import { normalizeModelId } from '../../utils/modelIdNormalization';

// AbortController map to track active requests
const abortControllers = new Map<string, AbortController>();

export function normalizeProxyBaseUrl(baseUrl: string): string {
  let clean = (baseUrl || '').trim();
  if (!clean) return '';
  clean = clean.replace(/\/+$/, '');
  const suffixes = ['/v1/chat/completions', '/chat/completions', '/v1/images/generations', '/images/generations', '/v1beta', '/v1', '/api'];
  let stripped = true;
  while (stripped) {
    stripped = false;
    const lower = clean.toLowerCase();
    for (const suffix of suffixes) {
      if (lower.endsWith(suffix)) {
        clean = clean.slice(0, -suffix.length).replace(/\/+$/, '');
        stripped = true;
        break;
      }
    }
  }
  return clean;
}

export const cancelGeneration = (id: string) => {
  const controller = abortControllers.get(id);
  if (controller) {
    controller.abort("Generation cancelled by user");
    abortControllers.delete(id);
  }
  void abortSyncImageBridgeRequest(id).catch(() => undefined);
};

function normalizeError(error: any): Error {
  // 🚀 [日志增强] 在归一化之前记录原始错误详情
  logError('GeminiService', error, `Raw Message: ${error?.message || 'N/A'}\nStack: ${error?.stack || 'N/A'}`);

  const rawMessage = error?.message || error?.toString?.() || '未知错误';
  const msg = rawMessage.toLowerCase();
  const status = typeof error?.status === 'number'
    ? error.status
    : (typeof error?.code === 'number' ? error.code : undefined);
  const failure = classifyApiFailure({
    error,
    status,
    responseText: error?.responseBody,
    fallbackMessage: rawMessage,
  });
  
  const withMeta = (normalized: Error): Error => {
    const out: any = normalized;
    if (error?.code !== undefined) out.code = error.code;
    if (error?.status !== undefined) out.status = error.status;
    if (error?.provider !== undefined) out.provider = error.provider;
    if (error?.requestPath !== undefined) out.requestPath = error.requestPath;
    if (error?.requestBody !== undefined) out.requestBody = error.requestBody;
    if (error?.responseBody !== undefined) out.responseBody = error.responseBody;
    return out as Error;
  };

  if (isSecureProxySessionReauthError(error)) {
    return withMeta(new Error(error?.message || SECURE_PROXY_SESSION_REAUTH_MESSAGE));
  }

  if (isSecureProxyGuestModeError(error)) {
    return withMeta(new Error(error?.message || SECURE_PROXY_GUEST_MODE_MESSAGE));
  }
  
  if (msg.includes('cancelled')) return withMeta(new Error("任务已取消"));

  // 🚀 [Critical Fix] API 鉴权错误检测 - 优先检查状态码
  if (failure.kind === 'auth') {
    return withMeta(new Error("API 令牌无效 (401)：检测到鉴权错误，请在'设置 - API管理'中检查密钥或令牌是否正确、是否过期，以及当前请求是否走到了您选中的供应商"));
  }
  
  if (status === 403 || msg.includes('403') || msg.includes('permission') || msg.includes('api_key_invalid') || msg.includes('forbidden')) {
    return withMeta(new Error("API Key 无效或权限不足 (403)：请检查设置中的 API 密钥是否正确，或联系供应商确认权限"));
  }

  // 🚀 [12AI 对齐] 精准网关与状态码映射
  if (msg.includes('524') || msg.includes('timeout')) return withMeta(new Error(`网络超时 (524): ${rawMessage.slice(0, 180)}`));
  if (msg.includes('530') || msg.includes('502') || msg.includes('504')) return withMeta(new Error(`网关错误 (530/502/504): ${rawMessage.slice(0, 180)}`));
  if (msg.includes('413') || msg.includes('payload too large')) return withMeta(new Error("请求体过大 (413)，请减少待识别的图片数量或压缩图片体积"));
  if (msg.includes('503') && msg.includes('no available channel')) return withMeta(new Error(`服务暂不可用 (503: 无可用渠道): ${rawMessage.slice(0, 180)}`));
  if (msg.includes('maxoutputtokens')) return withMeta(new Error("Token 设置超出限制：请确保最大输出 Token 小于 65536"));

  if (msg.includes('no accounts available with quota') || msg.includes('insufficient_quota')) {
    return withMeta(new Error("渠道额度不足：当前线路无可用配额，请切换到有余额的提供商或渠道"));
  }
  if (msg.includes('429') || msg.includes('rate limit') || (msg.includes('quota') && !msg.includes('503'))) {
    return withMeta(new Error("请求太过频繁 (429)，正在尝试切换线路，请稍后..."));
  }
  if (msg.includes("503") || msg.includes("service unavailable") || msg.includes("too busy") || msg.includes("deadlock")) return withMeta(new Error(`服务器繁忙 (503): ${rawMessage.slice(0, 180)}`));
  if (msg.includes("MISSING_API_KEY")) return withMeta(new Error("请先在设置中配置有效的 API Key"));
  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("policy")) return withMeta(new Error("内容触发安全审查 (Safety Blocked)，请更换提示词或尝试非流式模式"));
  if (msg.includes("400") || msg.includes("invalid_argument")) return withMeta(new Error("请求参数无效：Token 数可能过大或模型不支持当前配置"));
  if (msg.includes("500") || msg.includes("internal")) return withMeta(new Error("远程服务器故障 (500)，请稍后重试"));
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch")) return withMeta(new Error("网络连接失败 (Network Error)，请检查您的网络设置或代理配置"));

  return withMeta(new Error(`生成失败: ${error.message || '未知错误'} (请按 F12 查看控制台详情)`));
}

/**
 * Export result interface
 */
export interface GenerateImageResult {
  url: string;
  deducted?: boolean;
  ledgerId?: string;
  balanceAfter?: number;
  apiDurationMs?: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  model?: string;
  imageSize?: ImageSize;
  effectiveModel?: string; // Actual model used
  effectiveSize?: ImageSize; // Actual size used
  aspectRatio?: AspectRatio; // Aspect Ratio
  dimensions?: { width: number; height: number }; // Exact dimensions for AUTO mode
  provider?: string; // API Provider Internal
  providerName?: string; // User-defined Provider Name
  modelName?: string; // User-friendly Model Name
  keySlotId?: string;
  requestPath?: string;
  requestBodyPreview?: string;
  pythonSnippet?: string;
  referenceImagesUsed?: number;
  referenceImagesDropped?: number;
  groundingSources?: Array<{
    uri: string;
    title?: string;
    imageUri?: string;
  }>;
}

/**
 * Parse model suffix
 */
function parseModelSuffix(modelId: string): {
  baseModel: string;
  aspectRatio?: AspectRatio;
  quality?: 'standard' | 'hd' | 'medium';
  imageSize?: ImageSize;
} {
  const [baseId, routingSuffix] = modelId.split('@');
  const suffixMatch = baseId.match(/-((?:\d+-)?\d+-\d+|1-1|4-3|3-4|16-9|9-16|21-9|9-21|3-2|2-3)(?:-(4k|2k|hd|medium|standard))?$/i);

  if (!suffixMatch) {
    return { baseModel: modelId };
  }

  const aspectPart = suffixMatch[1];
  const qualityPart = suffixMatch[2]?.toLowerCase();

  const aspectMap: Record<string, AspectRatio> = {
    '1-1': AspectRatio.SQUARE,
    '4-3': AspectRatio.LANDSCAPE_4_3,
    '3-4': AspectRatio.PORTRAIT_3_4,
    '16-9': AspectRatio.LANDSCAPE_16_9,
    '9-16': AspectRatio.PORTRAIT_9_16,
    '21-9': AspectRatio.LANDSCAPE_21_9,
    '9-21': AspectRatio.PORTRAIT_9_21,
    '3-2': AspectRatio.LANDSCAPE_3_2,
    '2-3': AspectRatio.PORTRAIT_2_3,
    '4-1': AspectRatio.LANDSCAPE_4_1,
    '1-4': AspectRatio.PORTRAIT_1_4,
    '8-1': AspectRatio.LANDSCAPE_8_1,
    '1-8': AspectRatio.PORTRAIT_1_8,
  };

  const qualityToSize: Record<string, ImageSize> = {
    '4k': ImageSize.SIZE_4K,
    '2k': ImageSize.SIZE_2K,
    'hd': ImageSize.SIZE_4K,
    'medium': ImageSize.SIZE_2K,
    'standard': ImageSize.SIZE_1K,
  };

  const baseModel = baseId.replace(suffixMatch[0], '') + (routingSuffix ? `@${routingSuffix}` : '');

  return {
    baseModel,
    aspectRatio: aspectMap[aspectPart],
    quality: qualityPart as 'standard' | 'hd' | 'medium' | undefined,
    imageSize: qualityToSize[qualityPart || ''],
  };
}

export const generateImage = async (
  prompt: string,
  aspectRatio: AspectRatio,
  imageSize: ImageSize,
  referenceImages: ReferenceImage[] = [],
  model: ModelType = 'gemini-2.5-flash-image',
  _negativePrompt: string = '',
  requestId?: string,
  grounding: boolean = false,
  options?: {
    size?: string;  // e.g. "1920x1080"
    quality?: 'standard' | 'hd' | 'medium';
    maskUrl?: string; // 🚀 Advanced Editing
    editMode?: 'inpaint' | 'outpaint' | 'vectorize' | 'reframe' | 'upscale' | 'replace-background' | 'edit';
    preferredKeyId?: string;
    executionLane?: 'local-user-api' | 'cloud-credit-model';
    creditRouteSpecId?: string;
    creditRouteUnitId?: string;
    enableWebSearch?: boolean;
    enableImageSearch?: boolean;
    thinkingMode?: 'minimal' | 'high';
    onTaskId?: (id: string) => void;
    onSyncBridgeRegistered?: (requestId: string, startedAt?: number) => void;
  }
): Promise<GenerateImageResult> => {
  // 🚀 优先对传入的模型 ID 进行归一化，将可能包含的废弃或未公开模型（如 Imagen 系列）自动迁移到最新的可用模型
  // 简体中文注释：如果是速创 (Wuyin) 图片模型，需锁定原始模型 ID，跳过 Google 原生模型归一化，防止变成 gemini-3.1-flash-image-preview 等官方 ID
  const rawModelBeforeNormalize = model;
  const isWuyinModel =
    String(model || '').includes('image_nanoBanana')
    || String(model || '').includes('image_gpt')
    || String(model || '').includes('image_grok_imagine')
    || String(model || '').includes('image_wan2.6')
    || String(model || '').toLowerCase().includes('wuyin')
    || String(model || '').includes('@slot_key_');

  if (!isWuyinModel) {
    model = normalizeModelId(model) as ModelType;
  } else {
    model = rawModelBeforeNormalize as ModelType;
  }

  // 🚀 Parse Model Suffix (Consistency)
  const parsedSuffix = parseModelSuffix(model);
  if (parsedSuffix.baseModel !== model) {
    console.log(`[GeminiService] Parsed model suffix: ${model} -> ${parsedSuffix.baseModel}`, parsedSuffix);
    model = parsedSuffix.baseModel as ModelType;
    if (parsedSuffix.aspectRatio && aspectRatio === AspectRatio.AUTO) aspectRatio = parsedSuffix.aspectRatio;
    if (parsedSuffix.imageSize && imageSize === ImageSize.SIZE_1K) imageSize = parsedSuffix.imageSize;
  }

  // 🚀 Parse size option
  if (options?.size) {
    const sizeMatch = options.size.match(/^(\d+)x(\d+)$/);
    if (sizeMatch) {
      const width = parseInt(sizeMatch[1]);
      const height = parseInt(sizeMatch[2]);
      const ratio = width / height;
      // Heuristic mapping for standard ratios
      if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_16_9;
      else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = AspectRatio.PORTRAIT_9_16;
      else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_4_3;
      else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = AspectRatio.PORTRAIT_3_4;
      else if (Math.abs(ratio - 21 / 9) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_21_9;
      else if (Math.abs(ratio - 1) < 0.1) aspectRatio = AspectRatio.SQUARE;
      else if (Math.abs(ratio - 3 / 2) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_3_2;
      else if (Math.abs(ratio - 2 / 3) < 0.1) aspectRatio = AspectRatio.PORTRAIT_2_3;
      else if (Math.abs(ratio - 4 / 1) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_4_1;
      else if (Math.abs(ratio - 1 / 4) < 0.1) aspectRatio = AspectRatio.PORTRAIT_1_4;
      else if (Math.abs(ratio - 8 / 1) < 0.1) aspectRatio = AspectRatio.LANDSCAPE_8_1;
      else if (Math.abs(ratio - 1 / 8) < 0.1) aspectRatio = AspectRatio.PORTRAIT_1_8;
    }
  }

  // 🚀 Parse quality option
  if (options?.quality) {
    const qualityMap: Record<string, ImageSize> = {
      'hd': ImageSize.SIZE_4K,
      'medium': ImageSize.SIZE_2K,
      'standard': ImageSize.SIZE_1K,
    };
    if (qualityMap[options.quality]) imageSize = qualityMap[options.quality];
  }

  // Defensive: Strip '-4k' suffix globally if present (backward compatibility)
  if (model.toLowerCase().endsWith('-4k')) {
    model = model.replace(/-4k$/i, '') as ModelType;
  }

  let resolvedRatio = aspectRatio;
  let autoRatioDimensions: { width: number; height: number } | undefined;

  // Resolve AUTO aspect ratio
  if (aspectRatio === AspectRatio.AUTO) {
    if (referenceImages.length > 0 && referenceImages[0].data) {
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load reference'));
          img.src = `data:${referenceImages[0].mimeType};base64,${referenceImages[0].data}`;
        });
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ratio = w / h;
        autoRatioDimensions = { width: w, height: h };

        if (ratio > 6.0) resolvedRatio = AspectRatio.LANDSCAPE_8_1;
        else if (ratio > 3.0) resolvedRatio = AspectRatio.LANDSCAPE_4_1;
        else if (ratio > 2.0) resolvedRatio = AspectRatio.LANDSCAPE_21_9;
        else if (ratio > 1.6) resolvedRatio = AspectRatio.LANDSCAPE_16_9;
        else if (ratio > 1.4) resolvedRatio = AspectRatio.LANDSCAPE_3_2;
        else if (ratio > 1.1) resolvedRatio = AspectRatio.LANDSCAPE_4_3;
        else if (ratio > 0.9) resolvedRatio = AspectRatio.SQUARE;
        else if (ratio > 0.7) resolvedRatio = AspectRatio.PORTRAIT_3_4;
        else if (ratio > 0.6) resolvedRatio = AspectRatio.PORTRAIT_2_3;
        else if (ratio > 0.45) resolvedRatio = AspectRatio.PORTRAIT_9_16;
        else if (ratio > 0.3) resolvedRatio = AspectRatio.PORTRAIT_9_21;
        else if (ratio > 0.2) resolvedRatio = AspectRatio.PORTRAIT_1_4;
        else resolvedRatio = AspectRatio.PORTRAIT_1_8;
      } catch (e) {
        resolvedRatio = AspectRatio.SQUARE;
      }
    } else {
      resolvedRatio = AspectRatio.LANDSCAPE_16_9;
    }
  }
  aspectRatio = resolvedRatio;

  console.log(`[GeminiService] Generating with Model: ${model}, Ratio: ${aspectRatio}, Size: ${imageSize}`);

  const maxAllowedRefs = Math.max(0, getMaxRefImages(model));
  const inputRefCount = referenceImages.length;
  const clippedReferenceImages = maxAllowedRefs > 0
    ? referenceImages.slice(0, maxAllowedRefs)
    : referenceImages.slice(0, 1);
  const droppedRefCount = Math.max(0, inputRefCount - clippedReferenceImages.length);
  if (droppedRefCount > 0) {
    console.warn(`[GeminiService] Reference images clipped: input=${inputRefCount}, used=${clippedReferenceImages.length}, max=${maxAllowedRefs}`);
  }

  // Process Use Reference Images
  const processedReferences = (await Promise.all((clippedReferenceImages || []).map(async (img) => {
    let currentData = img.data;

    // 1. If data missing, try IDB recovery
    if (!currentData && (img.storageId || img.id)) {
      try {
        const cached = await getImage(img.storageId || img.id);
        if (cached && typeof cached === 'string') {
          currentData = cached;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!currentData) return null;

    // 2. Hydrate URL/Blob
    const isUrl = currentData.startsWith('http') || currentData.startsWith('blob:') || currentData.startsWith('file:');
    if (isUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        let response: Response;
        try {
          response = await fetch(currentData, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
        const blob = await response.blob();
        return new Promise<ReferenceImage>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            // Standardize to pure base64
            const match = res.match(/^data:(.+);base64,(.+)$/);
            if (match) {
              resolve({ ...img, mimeType: match[1], data: match[2] });
            } else {
              resolve({ ...img, data: res });
            }
          };
          reader.onerror = () => resolve({ ...img, data: currentData });
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        // Skip this reference on timeout/fetch error to avoid blocking whole request
        return null;
      }
    }

    // 3. Fallback: Strip data uri prefix if present
    const cleanData = currentData.replace(/^data:image\/\w+;base64,/, '');
    return { ...img, data: cleanData };
  }))).filter((img): img is ReferenceImage => !!img && !!img.data);
  const normalizedReferenceImages = processedReferences
    .filter(r => !!r.data && !r.data.startsWith('http') && !r.data.startsWith('blob:') && !r.data.startsWith('file:'))
    .map(r => ({ data: r.data, mimeType: r.mimeType || 'image/png' }));
  const skippedDuringNormalization = Math.max(0, clippedReferenceImages.length - normalizedReferenceImages.length);
  const totalDroppedReferenceImages = Math.max(0, inputRefCount - normalizedReferenceImages.length);
  if (inputRefCount > 0) {
    console.log(`[GeminiService] Reference images prepared: input=${inputRefCount}, clipped=${clippedReferenceImages.length}, forwarded=${normalizedReferenceImages.length}, dropped=${totalDroppedReferenceImages}`);
    if (skippedDuringNormalization > 0) {
      console.warn(`[GeminiService] ${skippedDuringNormalization} reference image(s) could not be normalized and were skipped.`);
    }
  }

  // Create AbortController if requestId provided
  if (requestId && !abortControllers.has(requestId)) {
    abortControllers.set(requestId, new AbortController());
  }
  const controller = requestId ? abortControllers.get(requestId) : undefined;
  if (controller?.signal.aborted) throw new Error('Generation cancelled');

  // --- Prepare Universal Provider Config ---
  const is4K = imageSize === ImageSize.SIZE_4K || imageSize.includes('4K');
  const is2K = imageSize === ImageSize.SIZE_2K || imageSize.includes('2K');
  const upperSize = (imageSize || '').toUpperCase();
  const is05K = imageSize === ImageSize.SIZE_05K || upperSize.includes('0.5K') || upperSize.includes('512');

  // 🚀 Grounding Setup (Gemini 3 models only)
  let googleTools: any[] | undefined = undefined;
  const enableWebSearch = options?.enableWebSearch ?? grounding;
  const isThinkingModel = (model || '').toLowerCase().includes('gemini-3.1-flash') || (model || '').toLowerCase().includes('gemini-3-pro') || (model || '').toLowerCase().includes('nano-banana-2') || (model || '').toLowerCase().includes('nano-banana-pro');
  const enableImageSearch = options?.enableImageSearch ?? (grounding && (model || '').toLowerCase().includes('3.1-flash'));
  if (enableWebSearch || enableImageSearch) {
    // Both 3.1 and 3 Pro support grounding differently
    // Actually official docs recommend just {} for 3.1 Flash imageSearch too
    // but we can be specific based on model capabilities
    if (model.includes('3.1-flash')) {
      const searchTypes: Record<string, any> = {};
      if (enableImageSearch) searchTypes.imageSearch = {};
      if (enableWebSearch) searchTypes.webSearch = {};
      googleTools = [{
        googleSearch: {
          searchTypes: Object.keys(searchTypes).length > 0 ? searchTypes : undefined
        }
      }];
    } else {
      googleTools = [{
        googleSearch: {}
      }];
    }
  }

  const googleConfig: ProviderConfig['google'] = {
    // 🚀 [Fix] 严格对齐官方文档：重绘时需同时返回 TEXT 和 IMAGE
    responseModalities: ["TEXT", "IMAGE"],
    tools: googleTools, // 🚀 Inject Grounding Tools
    imageConfig: {
      aspectRatio: aspectRatio,
      imageSize: is4K ? '4K' : (is2K ? '2K' : (is05K ? '512px' : '1K'))
    }
  };
  if (isThinkingModel) {
    googleConfig.thinkingConfig = {
      thinkingLevel: options?.thinkingMode === 'high' ? 'high' : 'minimal'
    };
  }

  const providerConfig: ProviderConfig = {
    // 1. Google Gemini Config
    google: googleConfig,
    // 2. Imagen Config
    imagen: {
      aspectRatio: aspectRatio,
      sampleCount: 1,
      personGeneration: 'allow_adult',
      // Imagen 4 only supports 1K/2K. Map 4K -> 2K
      imageSize: (is4K || is2K) ? '2K' : '1K'
    },
    // 3. OpenAI Config
    openai: {
      quality: (is4K || is2K) ? 'hd' : 'standard',
      // Size is handled dynamically by adapter if not precise, but we can hint
      // We let adapter handle specific pixel logic for Antigravity, 
      // but strictly standard OpenAI uses specific sizes.
    }
  };

  const llmOptions: ImageGenerationOptions = {
    modelId: model,
    prompt: prompt,
    requestId,
    aspectRatio: aspectRatio,
    imageSize: imageSize, // Pass high level enum
    imageCount: 1,
    // 🚀 [Fix] 保留完整 { data, mimeType } 对象，严格对齐官方文档 MIME 类型要求
    referenceImages: normalizedReferenceImages,
    providerConfig: providerConfig, // 🚀 Pass the Universal Config
    maskUrl: options?.maskUrl, // 🚀 Pass Edit Options
    editMode: options?.editMode,
    preferredKeyId: options?.preferredKeyId,
    executionLane: options?.executionLane,
    creditRouteSpecId: options?.creditRouteSpecId,
    creditRouteUnitId: options?.creditRouteUnitId,
    signal: controller?.signal,
    onTaskId: options?.onTaskId,
    syncBridgeRequestId: requestId,
    onSyncBridgeRegistered: options?.onSyncBridgeRegistered,
  };

  try {
    const result = await llmService.generateImage(llmOptions);

    if ((result.status === 'pending' || result.status === 'processing') && result.taskId) {
      return {
        url: '',
        taskId: result.taskId,
        providerTaskId: (result as any).providerTaskId,
        status: result.status,
        submitExecTime: (result as any).submitExecTime ?? (result as any).execTime,
        detailExecTime: (result as any).detailExecTime,
        totalExecTime: (result as any).totalExecTime,
        effectiveModel: result.model || model,
        imageSize: (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K,
        effectiveSize: (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K,
        aspectRatio,
        provider: result.provider,
        providerName: result.providerName,
        modelName: result.modelName,
        keySlotId: result.keySlotId,
        requestPath: result.metadata?.requestPath,
        requestBodyPreview: result.metadata?.requestBodyPreview,
        referenceImagesUsed: normalizedReferenceImages.length,
        referenceImagesDropped: totalDroppedReferenceImages,
      } as any;
    }

    const resultUrl = result.urls?.[0];
    if (!resultUrl) {
      throw new Error('生成结果为空：供应商没有返回图片 URL');
    }
    const resolvedResultModel = result.model || model;
    const resolvedResultImageSize = (result.imageSize as ImageSize) || imageSize || ImageSize.SIZE_1K;
    const resolvedKeySlotId = result.keySlotId || options?.preferredKeyId;
    const promptTokens = Number.isFinite(result.usage?.promptTokens) ? result.usage?.promptTokens : undefined;
    const completionTokens = Number.isFinite(result.usage?.completionTokens)
      ? result.usage?.completionTokens
      : (Number.isFinite(result.usage?.totalTokens) && Number.isFinite(promptTokens))
        ? Math.max(0, (result.usage?.totalTokens || 0) - (promptTokens || 0))
        : undefined;

    // --- Cost Estimation Cleanup ---
    let cost = result.usage?.cost || 0;
    let tokens = result.usage?.totalTokens || 0;

    if (tokens === 0 || cost === 0) {
      try {
        const estimate = calculateCost(
          resolvedResultModel,
          resolvedResultImageSize,
          1,
          prompt.length,
          normalizedReferenceImages.length,
          resolvedKeySlotId
        );

        if (tokens === 0) {
          tokens = estimate.tokens;
        }
        if (cost === 0) {
          cost = estimate.cost;
        }
      } catch {
        // Keep adapter/LLM usage values when estimation is unavailable.
      }
    }

    return {
      url: resultUrl,
      deducted: result.deducted,
      ledgerId: result.ledgerId,
      balanceAfter: result.balanceAfter,
      apiDurationMs: result.metadata?.apiDurationMs,
      tokens,
      promptTokens,
      completionTokens,
      cost,
      imageSize: resolvedResultImageSize,
      effectiveModel: resolvedResultModel,
      effectiveSize: resolvedResultImageSize,
      aspectRatio,
      dimensions: result.metadata?.dimensions || autoRatioDimensions,
      provider: result.provider,
      providerName: result.providerName,
      modelName: result.modelName,
      keySlotId: result.keySlotId,
      requestPath: result.metadata?.requestPath,
      requestBodyPreview: result.metadata?.requestBodyPreview,
      pythonSnippet: result.metadata?.pythonSnippet,
      referenceImagesUsed: normalizedReferenceImages.length,
      referenceImagesDropped: totalDroppedReferenceImages,
      groundingSources: result.metadata?.grounding?.sources
    };

  } catch (error: any) {
    if (error.name === 'AbortError' || error.message === 'Generation cancelled') throw error;
    console.error(`[GeminiService] LLMService Generation Failed:`, error);
    throw normalizeError(error);
  } finally {
    if (requestId) {
      abortControllers.delete(requestId);
    }
  }
};
