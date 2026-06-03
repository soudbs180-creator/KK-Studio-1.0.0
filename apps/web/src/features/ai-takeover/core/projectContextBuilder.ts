// 简体中文：项目上下文脱敏构建器 (Project Context Builder)

import type { SanitizedProjectContext, AssetContextSummary } from '../types';

export interface ContextBuilderParams {
  currentPage: 'canvas' | 'settings' | 'agent' | 'unknown';
  aiTakeoverEnabled: boolean;
  agentEnabled: boolean;
  activeCanvas: any;
  selectedNodeIds: string[];
  apiKeyStatus: 'missing' | 'configured_masked' | 'invalid' | 'unknown';
  providerCount: number;
  selectedModel?: string;
  balanceKnown: boolean;
  canEstimateCost: boolean;
  assetsSummary: AssetContextSummary;
  errors: any[];
  config?: any;
  ecommerceState?: any;
}

/**
 * 物理性脱敏构建 SanitizedProjectContext
 * 确保没有任何明文密钥（以 sk- 开头或其他）、Cookie、Password、Token 混入上下文中发送给 AI。
 */
export function buildSanitizedProjectContext(params: ContextBuilderParams): SanitizedProjectContext {
  const {
    currentPage,
    aiTakeoverEnabled,
    agentEnabled,
    activeCanvas,
    selectedNodeIds,
    apiKeyStatus,
    providerCount,
    selectedModel,
    balanceKnown,
    canEstimateCost,
    assetsSummary,
    errors,
    config,
    ecommerceState
  } = params;

  // 1. 构建脱敏画布提示词卡片列表
  const promptNodes = activeCanvas?.promptNodes
    ? activeCanvas.promptNodes.map((n: any) => {
        // 脱敏报错信息，排除里面可能泄露的密钥或凭证
        let sanitizedError = n.error;
        if (sanitizedError) {
          sanitizedError = sanitizedError
            .replace(/[a-zA-Z0-9_\-]{24,}/g, '***') // 屏蔽长文本（疑似密钥/Token）
            .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***');
        }

        return {
          id: n.id,
          prompt: n.prompt || '',
          optimizedPromptEn: n.optimizedPromptEn,
          optimizedPromptZh: n.optimizedPromptZh,
          status: n.isGenerating ? 'generating' : (n.error ? 'failed' : (n.childImageIds?.length > 0 ? 'done' : 'idle')),
          hasReferenceImages: (n.referenceImages?.length || 0) > 0,
          childImageCount: n.childImageIds?.length || 0,
          tags: n.tags || [],
          error: sanitizedError
        };
      })
    : [];

  // 2. 构建脱敏图片卡片列表
  const imageNodes = activeCanvas?.imageNodes
    ? activeCanvas.imageNodes.map((img: any) => ({
        id: img.id,
        name: img.name || img.promptSummary || '',
        parentPromptId: img.parentPromptId,
        tags: img.tags || [],
        hasOriginalUrl: !!img.url
      }))
    : [];

  // 3. 过滤并脱敏全局错误列表
  const sanitizedErrors = errors
    ? errors.map((err: any) => ({
        code: err.code || 'UNKNOWN_ERROR',
        message: String(err.message || '')
          .replace(/[a-zA-Z0-9_\-]{24,}/g, '***')
          .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***'),
        source: err.source || 'system',
        relatedNodeId: err.relatedNodeId
      }))
    : [];

  // 4. 构建输入框与电商上下文
  const promptBarInput = config ? {
    prompt: config.prompt || '',
    referenceImagesCount: config.referenceImages?.length || 0,
    mode: config.mode || 'image',
    ecommerceSettings: ecommerceState ? {
      platform: ecommerceState.sheetSettings?.[ecommerceState.activeGroupSheet]?.platform || '',
      targetMarket: ecommerceState.sheetSettings?.[ecommerceState.activeGroupSheet]?.targetMarket || '',
      batchCount: ecommerceState.sheetSettings?.[ecommerceState.activeGroupSheet]?.batchCount || 1,
      productName: ecommerceState.analysis?.productName || '',
      theme: ecommerceState.analysis?.theme || '',
      activeGroupSheet: ecommerceState.activeGroupSheet || '',
      requirementFileName: ecommerceState.requirementFile?.name || '',
      productFilesCount: ecommerceState.productFiles?.length || 0
    } : undefined
  } : undefined;

  return {
    currentPage,
    aiTakeover: {
      enabled: aiTakeoverEnabled,
      mode: apiKeyStatus === 'missing' ? 'local' : 'api'
    },
    agent: {
      enabled: agentEnabled
    },
    canvas: {
      id: activeCanvas?.id,
      name: activeCanvas?.name || '新画布',
      selectedNodeIds: selectedNodeIds || [],
      promptNodes,
      imageNodes
    },
    assets: assetsSummary,
    settings: {
      apiKeyStatus,
      providerCount,
      selectedModel
    },
    billing: {
      balanceKnown,
      canEstimateCost
    },
    errors: sanitizedErrors,
    promptBarInput
  };
}
