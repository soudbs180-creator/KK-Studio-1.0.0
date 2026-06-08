/**
 * @file suxi.ts
 * @module apps/web/src/services/providers/profiles
 * @description New Suxi AI 多端混合代理渠道画像。
 * @author KK-Studio Team
 * @version 1.5.6
 */

import { ProviderProfile } from './index';

export const suxiProfile: ProviderProfile = {
  id: 'new-suxi-ai',
  label: 'New Suxi AI Hybrid Portal',
  matchers: {
    providerNames: [/suxi/i, /new-suxi/i],
    basePatterns: [/suxi/i]
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
      discovery: 'models'
    },
    'openai-responses': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      endpointStyle: 'openai-compatible'
    },
    'openai-images': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      endpointStyle: 'openai-compatible'
    },
    'gemini-native': {
      enabled: true,
      auth: {
        method: 'query',
        valueFormat: 'raw'
      },
      endpointStyle: 'gemini-native'
    },
    'claude-messages': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'x-api-key',
        valueFormat: 'raw'
      },
      endpointStyle: 'claude-native'
    }
  },
  defaults: {
    preferredChatSurface: 'openai-chat',
    preferredImageSurface: 'openai-images'
  },
  capabilities: {
    supportsEndpointTypesField: false,
    supportsAsyncTasks: false,
    billingRisk: 'medium'
  }
};
