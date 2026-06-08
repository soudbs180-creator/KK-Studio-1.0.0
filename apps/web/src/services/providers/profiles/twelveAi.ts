/**
 * @file twelveAi.ts
 * @module apps/web/src/services/providers/profiles
 * @description 12AI 多协议聚合渠道画像。支持标准 OpenAI 对话、Gemini 原生及专属异步生图任务。
 * @author KK-Studio Team
 * @version 1.5.6
 */

import { ProviderProfile } from './index';

export const twelveAiProfile: ProviderProfile = {
  id: 'twelve-ai',
  label: '12AI Multi-Protocol Portal',
  matchers: {
    providerNames: [/12ai/i, /twelve/i],
    basePatterns: [/12ai/i]
  },
  surfaces: {
    'openai-chat': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      endpointStyle: 'openai-compatible',
      discovery: 'static'
    },
    'gemini-native': {
      enabled: true,
      auth: {
        method: 'query',
        valueFormat: 'raw'
      },
      endpointStyle: 'gemini-native'
    },
    'async-image': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      endpointStyle: 'async-task'
    }
  },
  defaults: {
    preferredChatSurface: 'openai-chat',
    preferredImageSurface: 'async-image'
  },
  capabilities: {
    supportsEndpointTypesField: true,
    supportsAsyncTasks: true,
    billingRisk: 'high'
  }
};
