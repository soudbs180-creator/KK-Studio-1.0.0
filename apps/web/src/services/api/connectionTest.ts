/**
 * Connection testing helpers for API channels.
 *
 * The goal here is to validate auth + protocol routing without accidentally
 * creating billed image/video jobs on strict image/video endpoints.
 */

import {
  applyOpenAICompatAuthToUrl,
  type ApiProtocolFormat,
  type AuthMethod,
  buildClaudeEndpoint,
  buildClaudeHeaders,
  buildGeminiHeaders,
  buildGeminiEndpoint,
  buildGeminiModelsEndpoint,
  buildOpenAIEndpoint,
  buildProxyHeaders,
  normalizeProxyBaseUrl,
} from './apiConfig';
import type { ChannelConfig } from './channelConfig';
import {
  buildUserFacingApiErrorMessage,
  classifyApiFailure,
} from './errorClassification';
import {
  buildResponsesPayload,
  extractOpenAITextPayload,
  isResponsesPayload,
  shouldRetryWithResponsesApi,
} from './openaiResponses';
import { resolveProviderRuntime } from './providerStrategy';
import { resolveProviderProbeMatrix } from './providerProbeMatrix.ts';
import { resolveChatSurface } from './providerSurfaceRouter.ts';
import {
  fetchWuyinPricingCatalog,
  selectWuyinCatalogModels,
  selectWuyinGeneratableCatalogModels,
  extractWuyinModelIdFromBaseUrl,
  extractWuyinAsyncEndpointDetails,
} from '../billing/newApiPricingService';
import keyManager, { getDocumentedStaticModelsForProvider } from '../auth/keyManager';

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  responseTime?: number;
}

export interface ConnectionConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
  format?: ApiProtocolFormat;
  authMethod?: AuthMethod;
  headerName?: string;
  compatibilityMode?: 'standard' | 'chat';
  channelId?: string;
  channelConfig?: ChannelConfig;
}

function getCleanBaseUrl(baseUrl: string): string {
  return normalizeProxyBaseUrl(baseUrl) || String(baseUrl || '').replace(/\/$/, '');
}

function resolveConfig(config: ConnectionConfig): Required<Pick<ConnectionConfig, 'apiKey' | 'baseUrl' | 'provider'>> & ConnectionConfig {
  const channel = config.channelConfig || (config.channelId ? keyManager.getChannelConfig(config.channelId) : undefined);
  return {
    ...config,
    apiKey: config.apiKey || channel?.apiKey || '',
    baseUrl: config.baseUrl || channel?.baseUrl || '',
    provider: config.provider || String(channel?.provider || channel?.name || 'Custom'),
    format: config.format || channel?.protocolHint || 'auto',
    authMethod: config.authMethod || channel?.authProfile?.authMethod,
    headerName: config.headerName || channel?.authProfile?.headerName,
    compatibilityMode: config.compatibilityMode || channel?.compatibilityMode,
    channelConfig: channel || config.channelConfig,
  };
}

function getModelId(config: ConnectionConfig): string {
  const resolved = resolveConfig(config);
  const fallback = resolved.format === 'claude' ? 'claude-3-5-sonnet-latest' : 'gemini-2.5-flash';
  return String(resolved.model || resolved.channelConfig?.supportedModels?.[0] || fallback).trim();
}

function resolveConnectionRuntime(config: ConnectionConfig, cleanBase: string) {
  const resolved = resolveConfig(config);
  return resolveProviderRuntime({
    provider: resolved.provider,
    baseUrl: cleanBase,
    format: resolved.format,
    authMethod: resolved.authMethod,
    headerName: resolved.headerName,
    compatibilityMode: resolved.compatibilityMode,
    modelId: getModelId(resolved),
  });
}

function resolveOfficialCompatibleBaseUrl(runtime: ReturnType<typeof resolveConnectionRuntime>, cleanBase: string, surface: 'chat' | 'models'): string {
  const normalizedBase = String(cleanBase || '').trim();
  if (normalizedBase) {
    return normalizedBase;
  }

  const surfaceLabel = surface === 'chat' ? 'Chat' : 'Models';
  if (runtime.strategyId !== 'openai') {
    throw new Error(`${runtime.strategy.label || runtime.strategyId} ${surfaceLabel} test requires a Base URL from the provider workbench; documentation hosts must not fall back to official OpenAI.`);
  }

  return 'https://api.openai.com';
}

function assertNativeProtocolBaseUrl(runtime: ReturnType<typeof resolveConnectionRuntime>, cleanBase: string, surface: 'models'): void {
  const normalizedBase = String(cleanBase || '').trim();
  const allowOfficialDefault = runtime.providerFamily === 'google-official'
    || runtime.strategyId === 'anthropic'
    || runtime.strategyId === '12ai';

  if (!allowOfficialDefault && !normalizedBase) {
    const surfaceLabel = surface === 'models' ? 'Models' : surface;
    throw new Error(`${runtime.strategy.label || runtime.strategyId} ${surfaceLabel} test requires a Base URL from the provider workbench; documentation hosts must not fall back to official provider APIs.`);
  }
}

function get12AIProbeModel(
  runtime: ReturnType<typeof resolveConnectionRuntime>,
  config: ConnectionConfig,
): string {
  const requested = String(config.model || '').trim();
  if (runtime.protocolFamily === 'claude-native') {
    return requested || 'claude-4-sonnet';
  }
  if (runtime.protocolFamily === 'gemini-native') {
    return requested || 'gemini-2.5-flash';
  }
  return requested || 'gpt-5.1';
}

function isVideoModel(modelId: string): boolean {
  return /(veo|sora|seedance|runway|luma|kling|pika|video)/i.test(modelId);
}

function isImageOnlyNativeModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return lower.startsWith('imagen-') || lower.startsWith('veo-');
}

function buildFailureResult(params: {
  startTime: number;
  status?: number;
  responseText?: string;
  error?: unknown;
  fallbackMessage: string;
}): TestResult {
  const failure = classifyApiFailure({
    error: params.error,
    status: params.status,
    responseText: params.responseText,
    fallbackMessage: params.fallbackMessage,
  });

  return {
    success: false,
    message: buildUserFacingApiErrorMessage(failure),
    details: {
      status: failure.status,
      detail: failure.detail,
      kind: failure.kind,
    },
    responseTime: Date.now() - params.startTime,
  };
}

type OpenAITestResponse = {
  response: Response;
  responseFormat: 'chat-completions' | 'responses';
};

async function runGeminiGenerateContentTest(
  cleanBase: string,
  config: ConnectionConfig,
): Promise<Response> {
  const resolved = resolveConfig(config);
  const requestedModel = getModelId(config);
  const testModel = requestedModel.toLowerCase().startsWith('gemini-') ? requestedModel : 'gemini-2.5-flash';
  const runtime = resolveConnectionRuntime(resolved, cleanBase);
  const authMethod = runtime.authMethod as AuthMethod;
  const apiUrl = buildGeminiEndpoint(
    cleanBase,
    testModel,
    'generateContent',
    resolved.apiKey,
    authMethod,
    resolved.provider
  );

  return fetch(apiUrl, {
    method: 'POST',
    headers: buildGeminiHeaders(authMethod, resolved.apiKey, runtime.headerName, runtime.authorizationValueFormat),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Test connection' }] }],
    }),
    signal: AbortSignal.timeout(30000),
  });
}

async function runOpenAIChatTest(cleanBase: string, config: ConnectionConfig): Promise<OpenAITestResponse> {
  const resolved = resolveConfig(config);
  const runtime = resolveConnectionRuntime(resolved, cleanBase);
  const base = resolveOfficialCompatibleBaseUrl(runtime, cleanBase, 'chat');
  const headers = buildProxyHeaders(
    runtime.authMethod as AuthMethod,
    resolved.apiKey,
    runtime.headerName,
    undefined,
    runtime.authorizationValueFormat,
  );
  const modelId = getModelId(resolved);
  const chatUrl = applyOpenAICompatAuthToUrl(
    buildOpenAIEndpoint(base, '/chat/completions'),
    runtime.authMethod as AuthMethod,
    resolved.apiKey,
  );
  const responsesUrl = applyOpenAICompatAuthToUrl(
    buildOpenAIEndpoint(base, '/responses'),
    runtime.authMethod as AuthMethod,
    resolved.apiKey,
  );
  const chatBody = {
    model: modelId,
    stream: false,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Test connection' }],
      },
    ],
    max_tokens: 10,
  };
  const responsesBody = buildResponsesPayload({
    model: modelId,
    messages: [{ role: 'user', content: 'Test connection' }],
    maxOutputTokens: 10,
    stream: false,
  });

  const preferResponses = resolveChatSurface({
    runtime,
    modelId,
  }) === 'openai-responses';
  if (preferResponses) {
    const response = await fetch(responsesUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(responsesBody),
      signal: AbortSignal.timeout(30000),
    });
    return { response, responseFormat: 'responses' };
  }

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(chatBody),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    if (shouldRetryWithResponsesApi(response.status, responseText)) {
      const fallbackResponse = await fetch(responsesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(responsesBody),
        signal: AbortSignal.timeout(30000),
      });
      return { response: fallbackResponse, responseFormat: 'responses' };
    }

    return {
      response: new Response(responseText, {
        status: response.status,
        headers: response.headers,
      }),
      responseFormat: 'chat-completions',
    };
  }

  return { response, responseFormat: 'chat-completions' };
}

async function runClaudeMessagesTest(cleanBase: string, config: ConnectionConfig): Promise<Response> {
  const resolved = resolveConfig(config);
  const runtime = resolveConnectionRuntime(resolved, cleanBase);
  const apiUrl = buildClaudeEndpoint(cleanBase || 'https://api.anthropic.com', '/messages');

  return fetch(apiUrl, {
    method: 'POST',
    headers: buildClaudeHeaders(
      runtime.authMethod as AuthMethod,
      resolved.apiKey,
      runtime.headerName,
      runtime.authorizationValueFormat,
    ),
    body: JSON.stringify({
      model: getModelId(resolved),
      max_tokens: 16,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Test connection' }],
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
}

async function runWuyinCustomChatTest(
  cleanBase: string,
  config: ConnectionConfig
): Promise<TestResult> {
  const startTime = Date.now();
  const resolved = resolveConfig(config);
  const modelId = getModelId(resolved);

  try {
    const url = 'https://api.wuyinkeji.com/api/chat/index';
    const params = new URLSearchParams();
    params.append('content', 'Test connection');
    params.append('model', modelId || 'gemini-3-pro');
    params.append('stream', 'false');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': String(resolved.apiKey || '').trim(),
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      },
      body: params.toString(),
      signal: AbortSignal.timeout(30000),
    });

    const elapsed = Date.now() - startTime;
    const responseText = await response.text().catch(() => '');

    if (!response.ok) {
      const status = response.status;
      let errMsg = `HTTP ${status}`;
      if (status === 404 || responseText.toLowerCase().includes('<!doctype html>') || responseText.toLowerCase().includes('<html>')) {
        errMsg = '请求地址错误 (HTTP 404 / HTML)';
      } else if (status === 401 || status === 403) {
        errMsg = 'Authorization 密钥错误或权限不足';
      } else if (status === 400 || status === 422) {
        errMsg = 'content 或 model 参数缺失或格式错误';
      } else {
        errMsg = responseText.slice(0, 500) || `请求失败 (${status})`;
      }
      return {
        success: false,
        message: `测试连接失败: ${errMsg}`,
        details: { status, text: responseText.slice(0, 200) },
        responseTime: elapsed,
      };
    }

    let result: any = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      return {
        success: false,
        message: '速创 API 响应非 JSON 格式',
        details: { text: responseText.slice(0, 200) },
        responseTime: elapsed,
      };
    }

    let textPreview = '';
    if (typeof result === 'string') {
      textPreview = result;
    } else if (result && typeof result === 'object') {
      textPreview = result.content || result.text || result.message || 
                    result.data?.content || result.data?.text || 
                    result.data?.message || '';
      if (!textPreview) {
        textPreview = JSON.stringify(result);
      }
    }

    return {
      success: true,
      message: '速创 API 连接成功',
      details: {
        model: modelId,
        responseFormat: 'wuyin-custom-chat',
        responsePreview: String(textPreview).slice(0, 100)
      },
      responseTime: elapsed,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `连接失败: ${error?.message || 'Unknown error'}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Tests the active protocol path without creating billed image/video jobs.
 */
export async function testCherryConnection(config: ConnectionConfig): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const resolved = resolveConfig(config);
    const cleanBase = getCleanBaseUrl(resolved.baseUrl);
    const modelId = getModelId(resolved);
    const runtime = resolveConnectionRuntime(resolved, cleanBase);

    if (
      runtime.strategyId === 'wuyinkeji' &&
      !isVideoModel(modelId) &&
      /chat|gpt|text|claude|gemini-(?!.*image)/i.test(modelId)
    ) {
      return runWuyinCustomChatTest(cleanBase, resolved);
    }
    const nativeGemini = runtime.protocolFamily === 'gemini-native';
    const nativeClaude = runtime.protocolFamily === 'claude-native';
    const documentedModels = getDocumentedStaticModelsForProvider(runtime.strategyId);
    const probeMatrix = resolveProviderProbeMatrix({
      runtime,
      modelId,
      compatibilityMode: resolved.compatibilityMode,
      documentedModels,
      isVideoModel: isVideoModel(modelId),
      isImageOnlyNativeModel: nativeGemini && isImageOnlyNativeModel(modelId),
      isAsyncImageModel: (candidate) => runtime.strategyId === '12ai'
        && /gemini-2\.5-flash-image|gemini-3\.1-flash-image-preview|gemini-3-pro-image-preview/i.test(String(candidate || '')),
    });
    const responseTime = () => Date.now() - startTime;

    if (probeMatrix.skipReason === 'video-billing-risk') {
      const listTest = await testModelsList(resolved);
      return {
        ...listTest,
        message: listTest.success
          ? '视频链路鉴权成功，已跳过创建任务测试以避免计费'
          : `视频链路测试失败: ${listTest.message}`,
        details: listTest.success
          ? {
              model: modelId,
              responseFormat: 'models',
              selectedSurface: probeMatrix.protocolProbeSurface,
              availableSurfaces: probeMatrix.availableSurfaces,
              modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
            }
          : listTest.details,
        responseTime: responseTime(),
      };
    }

    if (probeMatrix.skipReason === 'native-image-billing-risk') {
      const listTest = await testModelsList(resolved);
      return {
        ...listTest,
        message: listTest.success
          ? '原生图像链路鉴权成功，已跳过生成测试以避免计费'
          : `原生图像链路测试失败: ${listTest.message}`,
        details: listTest.success
          ? {
              model: modelId,
              responseFormat: 'native-models',
              selectedSurface: probeMatrix.protocolProbeSurface,
              availableSurfaces: probeMatrix.availableSurfaces,
              modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
            }
          : listTest.details,
        responseTime: responseTime(),
      };
    }

    if (probeMatrix.skipReason === 'standard-mode-billing-risk') {
      const listTest = await testModelsList(resolved);
      return {
        ...listTest,
        message: listTest.success
          ? '标准模式鉴权成功，已跳过图像生成测试以避免计费'
          : `标准模式测试失败: ${listTest.message}`,
        details: listTest.success
          ? {
              model: modelId,
              responseFormat: 'models',
              selectedSurface: probeMatrix.protocolProbeSurface,
              availableSurfaces: probeMatrix.availableSurfaces,
              modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
            }
          : listTest.details,
        responseTime: responseTime(),
      };
    }

    const openAITest = !nativeGemini && !nativeClaude
      ? await runOpenAIChatTest(cleanBase, resolved)
      : null;
    const response = nativeGemini
      ? await runGeminiGenerateContentTest(cleanBase, resolved)
      : nativeClaude
        ? await runClaudeMessagesTest(cleanBase, resolved)
        : openAITest!.response;

    const elapsed = responseTime();
    const responseText = await response.text();

    if (!response.ok) {
      return buildFailureResult({
        startTime,
        status: response.status,
        responseText,
        fallbackMessage: `HTTP ${response.status}`,
      });
    }

    const result = JSON.parse(responseText);

    if (nativeGemini) {
      const parts = result.candidates?.[0]?.content?.parts || [];
      const textPreview = parts
        .map((part: any) => part?.text)
        .filter((value: unknown) => typeof value === 'string' && value.trim())
        .join(' ')
        .slice(0, 100);

      return {
        success: true,
        message: '原生 Gemini 链路连接成功',
        details: {
          model: modelId,
          responseFormat: 'generate-content',
          selectedSurface: probeMatrix.protocolProbeSurface,
          availableSurfaces: probeMatrix.availableSurfaces,
          modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
          responsePreview: textPreview ? `${textPreview}...` : 'Native generateContent responded successfully.',
        },
        responseTime: elapsed,
      };
    }

    if (nativeClaude) {
      const preview = Array.isArray(result.content)
        ? result.content
            .map((block: any) => block?.text || '')
            .join(' ')
            .slice(0, 100)
        : String(result.content || '').slice(0, 100);

      return {
        success: true,
        message: 'Claude Native 链路连接成功',
        details: {
          model: modelId,
          responseFormat: 'claude-messages',
          selectedSurface: probeMatrix.protocolProbeSurface,
          availableSurfaces: probeMatrix.availableSurfaces,
          modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
          responsePreview: preview ? `${preview}...` : 'Claude messages responded successfully.',
        },
        responseTime: elapsed,
      };
    }

    const openAIText = extractOpenAITextPayload(result);

    if (Array.isArray(result.choices) && result.choices.length > 0) {
      return {
        success: true,
        message: 'API 连接成功',
        details: {
          model: modelId,
          responseFormat: 'chat-completions',
          selectedSurface: probeMatrix.protocolProbeSurface,
          availableSurfaces: probeMatrix.availableSurfaces,
          modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
          responsePreview: `${String(result.choices[0].message?.content || '').slice(0, 100)}...`,
        },
        responseTime: elapsed,
      };
    }

    if (openAITest?.responseFormat === 'responses' || isResponsesPayload(result)) {
      return {
        success: true,
        message: 'API 连接成功',
        details: {
          model: modelId,
          responseFormat: 'responses',
          selectedSurface: probeMatrix.protocolProbeSurface,
          availableSurfaces: probeMatrix.availableSurfaces,
          modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
          responsePreview: openAIText ? `${openAIText.slice(0, 100)}...` : 'Responses API responded successfully.',
        },
        responseTime: elapsed,
      };
    }

    return {
      success: false,
      message: nativeGemini ? '原生响应格式异常，缺少 candidates 字段' : '响应格式异常，缺少 choices 字段',
      details: { response: result },
      responseTime: elapsed,
    };
  } catch (error: any) {
    return buildFailureResult({
      startTime,
      error,
      fallbackMessage: error?.message || 'Connection failed',
    });
  }
}

/**
 * Tests model-list access for the configured channel.
 */
export async function testModelsList(config: ConnectionConfig): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const resolved = resolveConfig(config);
    const cleanBase = getCleanBaseUrl(resolved.baseUrl);
    const runtime = resolveConnectionRuntime(resolved, cleanBase);
    const documentedModels = getDocumentedStaticModelsForProvider(runtime.strategyId);
    const probeMatrix = resolveProviderProbeMatrix({
      runtime,
      modelId: getModelId(resolved),
      compatibilityMode: resolved.compatibilityMode,
      documentedModels,
    });
    if (runtime.strategyId === 'wuyinkeji') {
      let pricingCatalog: any[] = [];
      try {
        pricingCatalog = selectWuyinGeneratableCatalogModels(selectWuyinCatalogModels(
          cleanBase || resolved.baseUrl,
          await fetchWuyinPricingCatalog(cleanBase || resolved.baseUrl)
        ));
      } catch (err) {
        console.warn('[ConnectionTest] Failed to fetch Wuyin pricing catalog dynamically, using fallback.', err);
        const fallbackModelId = extractWuyinModelIdFromBaseUrl(cleanBase || resolved.baseUrl) || getModelId(resolved) || 'video_google_omni';
        const details = extractWuyinAsyncEndpointDetails(cleanBase || resolved.baseUrl);
        
        // 简体中文注释：当抓取五音科技列表在前端发生跨域报错时，自动回退至本地支持的异步模型快照。
        const fallbackModelIds = [
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
          'audio_tts'
        ];
        
        if (!fallbackModelIds.includes(fallbackModelId)) {
          fallbackModelIds.unshift(fallbackModelId);
        }
        
        pricingCatalog = fallbackModelIds.map((model) => {
          const detail = extractWuyinAsyncEndpointDetails(model) || details;
          const rootUrl = (cleanBase || resolved.baseUrl || 'https://api.wuyinkeji.com').replace(/\/+$/, '');
          return {
            modelId: model,
            modelName: model,
            numeric: 0.1,
            unit: '次',
            displayPrice: '待手动设置',
            endpointUrl: detail?.endpointUrl || `${rootUrl}/api/async/${model}`,
            endpointPath: detail?.endpointPath || `/api/async/${model}`
          };
        });
      }

      return {
        success: true,
        message: `成功获取 ${pricingCatalog.length} 个模型`,
        details: {
          modelCount: pricingCatalog.length,
          models: pricingCatalog.slice(0, 5).map((item) => item.modelId || item.modelName),
          source: 'wuyin-catalog',
          selectedSurface: probeMatrix.modelDiscoverySurface,
          availableSurfaces: probeMatrix.availableSurfaces,
          modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
        },
        responseTime: Date.now() - startTime,
      };
    }
    const nativeGemini = runtime.protocolFamily === 'gemini-native';
    const nativeClaude = runtime.protocolFamily === 'claude-native';
    if (documentedModels.length > 0) {
      const probeConfig: ConnectionConfig = {
        ...resolved,
        model: get12AIProbeModel(runtime, resolved),
      };
      const probeResponse = nativeGemini
        ? await runGeminiGenerateContentTest(cleanBase, probeConfig)
        : nativeClaude
          ? await runClaudeMessagesTest(cleanBase, probeConfig)
          : (await runOpenAIChatTest(cleanBase, probeConfig)).response;

      if (!probeResponse.ok) {
        const responseText = await probeResponse.text().catch(() => '');
        const failure = classifyApiFailure({
          status: probeResponse.status,
          responseText,
          fallbackMessage: `HTTP ${probeResponse.status}`,
        });
        return {
          success: false,
          message: `无法获取模型列表: ${buildUserFacingApiErrorMessage(failure)}`,
          details: {
            status: probeResponse.status,
            detail: failure.detail,
            kind: failure.kind,
          },
          responseTime: Date.now() - startTime,
        };
      }

      return {
        success: true,
        message: `成功获取 ${documentedModels.length} 个模型`,
        details: {
          modelCount: documentedModels.length,
          models: documentedModels.slice(0, 5),
          source: '12ai-doc-preset',
          selectedSurface: probeMatrix.modelDiscoverySurface,
          availableSurfaces: probeMatrix.availableSurfaces,
          modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
        },
        responseTime: Date.now() - startTime,
      };
    }
    const usesOpenAIStyleModelList = runtime.providerFamily === 'newapi-family';
    const listBase = !nativeGemini && !nativeClaude
      ? resolveOfficialCompatibleBaseUrl(runtime, cleanBase, 'models')
      : cleanBase;
    if (nativeGemini || nativeClaude) {
      assertNativeProtocolBaseUrl(runtime, cleanBase, 'models');
    }
    const listUrl = usesOpenAIStyleModelList
      ? applyOpenAICompatAuthToUrl(
          buildOpenAIEndpoint(listBase, '/models'),
          runtime.authMethod as AuthMethod,
          resolved.apiKey,
        )
      : nativeGemini
        ? buildGeminiModelsEndpoint(cleanBase, resolved.apiKey, runtime.authMethod as AuthMethod, resolved.provider)
        : nativeClaude
          ? buildClaudeEndpoint(cleanBase || 'https://api.anthropic.com', '/models')
          : applyOpenAICompatAuthToUrl(
              buildOpenAIEndpoint(listBase, '/models'),
              runtime.authMethod as AuthMethod,
              resolved.apiKey,
            );
    const headers = usesOpenAIStyleModelList
      ? buildProxyHeaders(runtime.authMethod as AuthMethod, resolved.apiKey, runtime.headerName, undefined, runtime.authorizationValueFormat)
      : nativeGemini
        ? buildGeminiHeaders(runtime.authMethod as AuthMethod, resolved.apiKey, runtime.headerName, runtime.authorizationValueFormat)
        : nativeClaude
          ? buildClaudeHeaders(runtime.authMethod as AuthMethod, resolved.apiKey, runtime.headerName, runtime.authorizationValueFormat)
          : buildProxyHeaders(runtime.authMethod as AuthMethod, resolved.apiKey, runtime.headerName, undefined, runtime.authorizationValueFormat);

    const response = await fetch(listUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      const failure = classifyApiFailure({
        status: response.status,
        responseText,
        fallbackMessage: `HTTP ${response.status}`,
      });
      return {
        success: false,
        message: `无法获取模型列表: ${buildUserFacingApiErrorMessage(failure)}`,
        details: {
          status: response.status,
          detail: failure.detail,
          kind: failure.kind,
        },
        responseTime,
      };
    }

    const data = await response.json();
    const models = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : [];

    return {
      success: true,
      message: `成功获取 ${models.length} 个模型`,
      details: {
        modelCount: models.length,
        models: models.slice(0, 5).map((model: any) => model.id || model.name || model.model || String(model)),
        selectedSurface: probeMatrix.modelDiscoverySurface,
        availableSurfaces: probeMatrix.availableSurfaces,
        modelDiscoverySurface: probeMatrix.modelDiscoverySurface,
      },
      responseTime,
    };
  } catch (error: any) {
    const failure = classifyApiFailure({
      error,
      fallbackMessage: error?.message || 'Model list request failed',
    });
    return {
      success: false,
      message: `获取模型列表失败: ${buildUserFacingApiErrorMessage(failure)}`,
      details: {
        status: failure.status,
        detail: failure.detail,
        kind: failure.kind,
      },
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Runs both model-list and protocol checks.
 */
export async function comprehensiveConnectionTest(config: ConnectionConfig): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const basicTest = await testModelsList(config);
  results.push({
    ...basicTest,
    message: `基础连接: ${basicTest.message}`,
  });

  let apiTest: TestResult;
  try {
    apiTest = await testCherryConnection(config);
  } catch (error: any) {
    apiTest = {
      success: false,
      message: error.message || 'Unknown error',
      responseTime: 0,
    };
  }

  results.push({
    ...apiTest,
    message: `API功能: ${apiTest.message}`,
  });

  if (!basicTest.success && apiTest.success) {
    console.warn('[ConnectionTest] Model list failed but protocol test passed. Treating channel as usable.');
  }

  return results;
}
