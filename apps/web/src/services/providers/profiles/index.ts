/**
 * @file index.ts
 * @module apps/web/src/services/providers/profiles
 * @description 供应商画像层注册表与接口定义。本模块负责定义供应商的画像契约，
 *              并将系统所有的渠道画像统一注册导出，是实现“零公共分支改动”接入新渠道的基石。
 * @author KK-Studio Team
 * @version 1.5.6
 */

/**
 * 协议面枚举：代表不同的 API 协议协议面
 */
export type ApiSurface =
  | 'openai-chat'       // 兼容标准 OpenAI Chat completions (/v1/chat/completions)
  | 'openai-responses'  // OpenAI 专属 Responses
  | 'openai-images'     // 兼容标准 OpenAI DALL-E 图片生成
  | 'openai-models'     // 兼容标准 OpenAI 模型列表
  | 'gemini-native'     // Google 原生多模态 generateContent 接口
  | 'gemini-models'     // Google 原生模型发现接口
  | 'claude-messages'   // Anthropic 原生 Messages 接口
  | 'claude-models'     // Anthropic 原生模型发现
  | 'async-image'       // 特殊：异步提交任务并轮询的生图协议面（如 12AI 等）
  | 'async-video';      // 特殊：异步提交任务并轮询的视频协议面

/**
 * 终结点请求风格
 */
export type EndpointStyle =
  | 'openai-compatible'
  | 'gemini-native'
  | 'claude-native'
  | 'async-task';

/**
 * 供应商画像定义：只描述静态事实与协议支持，严禁泄露运行时具体的请求拼接或逻辑
 */
export interface ProviderProfile {
  id: string;                                     // 唯一的渠道识别 ID
  label: string;                                  // 人类友好展示名称
  matchers: {
    providerNames?: RegExp[];                     // 通过渠道商名称别名匹配
    hostPatterns?: RegExp[];                      // 通过服务器 Base URL 的域名匹配
    basePatterns?: RegExp[];                      // 通过完整的 Base URL 关键字匹配
  };
  surfaces: Partial<Record<ApiSurface, {
    enabled: boolean;
    auth: {
      method: 'header' | 'query';                 // 密钥通过 HTTP Header 还是 Query 参数下发
      headerName?: string;                        // 自定义 Header 名称 (如 Authorization, x-api-key)
      valueFormat?: 'bearer' | 'raw';             // 格式为 "Bearer {key}" 还是原生私密串 "{key}"
    };
    endpointStyle: EndpointStyle;
    discovery?: 'models' | 'static' | 'none';     // 模型发现方式
  }>>;
  defaults: {
    preferredChatSurface?: 'openai-chat' | 'openai-responses' | 'gemini-native' | 'claude-messages';
    preferredImageSurface?: 'openai-images' | 'gemini-native' | 'async-image';
    preferredVideoSurface?: 'openai-chat' | 'async-video';
  };
  capabilities?: {
    supportsEndpointTypesField?: boolean;         // 探针响应中是否自带 endpoints 字段
    supportsAsyncTasks?: boolean;                 // 是否具有后台异步执行模型能力
    billingRisk?: 'low' | 'medium' | 'high';      // 计费风险评估等级
  };
}

// ==========================================
// 导入各细分供应商静态画像
// ==========================================
import { googleProfile } from './google';
import { openaiProfile } from './openai';
import { twelveAiProfile } from './twelveAi';
import { gptBestProfile } from './gptBest';
import { suxiProfile } from './suxi';

/**
 * 全量注册的渠道画像列表
 */
export const providerRegistry: ProviderProfile[] = [
  googleProfile,
  openaiProfile,
  twelveAiProfile,
  gptBestProfile,
  suxiProfile
];

/**
 * 根据外部请求的特征（提供商名称、Base URL 等）自动精准识别供应商静态画像
 * @param providerName 提供商物理别名
 * @param baseUrl 提供商 API 请求基础路径
 */
export function matchProviderProfile(providerName: string, baseUrl: string): ProviderProfile | null {
  const normalizedName = providerName.trim().toLowerCase();
  const normalizedUrl = baseUrl.trim().toLowerCase();

  for (const profile of providerRegistry) {
    // 1. 尝试按提供商名称正则匹配
    if (profile.matchers.providerNames) {
      const matchedName = profile.matchers.providerNames.some(reg => reg.test(normalizedName));
      if (matchedName) return profile;
    }

    // 2. 尝试按 Base URL 域名匹配
    if (profile.matchers.hostPatterns) {
      try {
        const hostname = new URL(normalizedUrl).hostname;
        const matchedHost = profile.matchers.hostPatterns.some(reg => reg.test(hostname));
        if (matchedHost) return profile;
      } catch {
        // 忽略无效 URL 异常
      }
    }

    // 3. 尝试按完整的 Base URL 关键字片段匹配
    if (profile.matchers.basePatterns) {
      const matchedBase = profile.matchers.basePatterns.some(reg => reg.test(normalizedUrl));
      if (matchedBase) return profile;
    }
  }

  return null;
}
