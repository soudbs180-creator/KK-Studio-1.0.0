/**
 * @file capabilityRouter.ts
 * @module apps/web/src/services/providers/router
 * @description 智能能力路由器。根据调用意图、模型特质及特定渠道画像静态事实，
 *              智能判定最优的通信协议面（Surface）及安全鉴权规则，消灭硬编码。
 * @author KK-Studio Team
 * @version 1.5.2
 */

import { matchProviderProfile, ApiSurface, EndpointStyle } from '../profiles/index';

export interface RouteResolution {
  providerId: string;
  selectedSurface: ApiSurface;
  endpointStyle: EndpointStyle;
  auth: {
    method: 'header' | 'query';
    headerName: string;
    valueFormat: 'bearer' | 'raw';
  };
  billingRisk: 'low' | 'medium' | 'high';
}

export class CapabilityRouter {
  /**
   * 根据意图和提供商特征解析最优协议路径
   * @param providerName 渠道物理名
   * @param baseUrl 渠道基础路径
   * @param intent 意图类型 ('chat' | 'image' | 'video')
   * @param modelId 模型识别 ID
   */
  public resolveRoute(
    providerName: string,
    baseUrl: string,
    intent: 'chat' | 'image' | 'video',
    modelId: string
  ): RouteResolution {
    // 1. 匹配供应商画像事实
    const profile = matchProviderProfile(providerName, baseUrl);
    
    // 默认兜底配置 (以标准 OpenAI 兼容形式)
    const defaultResolution: RouteResolution = {
      providerId: 'generic-openai',
      selectedSurface: 'openai-chat',
      endpointStyle: 'openai-compatible',
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      billingRisk: 'medium'
    };

    if (!profile) {
      // 若没有匹配到专属画像，按意图决定标准 OpenAI 兼容兜底
      if (intent === 'image') {
        defaultResolution.selectedSurface = 'openai-images';
      }
      return defaultResolution;
    }

    // 2. 根据意图解析 Surface
    let selectedSurface: ApiSurface = 'openai-chat';
    if (intent === 'chat') {
      selectedSurface = profile.defaults.preferredChatSurface || 'openai-chat';
    } else if (intent === 'image') {
      selectedSurface = profile.defaults.preferredImageSurface || 'openai-images';
    }

    // 3. 校验所选 Surface 在画像中是否处于启用状态，未启用则采用该意图下第一个启用的 Surface
    let surfaceConfig = profile.surfaces[selectedSurface];
    if (!surfaceConfig || !surfaceConfig.enabled) {
      const availableSurfaces = Object.keys(profile.surfaces) as ApiSurface[];
      let fallbackSurface: ApiSurface | undefined;

      if (intent === 'chat') {
        fallbackSurface = availableSurfaces.find(s => ['openai-chat', 'openai-responses', 'gemini-native', 'claude-messages'].includes(s));
      } else if (intent === 'image') {
        fallbackSurface = availableSurfaces.find(s => ['openai-images', 'gemini-native', 'async-image'].includes(s));
      }

      if (fallbackSurface) {
        selectedSurface = fallbackSurface;
        surfaceConfig = profile.surfaces[selectedSurface];
      }
    }

    // 若画像配置中完全没有任何支持，直接采用兜底
    if (!surfaceConfig) {
      if (intent === 'image') {
        selectedSurface = 'openai-images';
      }
      return defaultResolution;
    }

    // 4. 组装并返回解析出的高阶路由决策
    return {
      providerId: profile.id,
      selectedSurface,
      endpointStyle: surfaceConfig.endpointStyle,
      auth: {
        method: surfaceConfig.auth.method,
        headerName: surfaceConfig.auth.headerName || (surfaceConfig.auth.method === 'header' ? 'Authorization' : 'key'),
        valueFormat: surfaceConfig.auth.valueFormat || 'raw'
      },
      billingRisk: profile.capabilities?.billingRisk || 'medium'
    };
  }
}

export const capabilityRouter = new CapabilityRouter();
