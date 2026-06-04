/**
 * @file google.ts
 * @module apps/web/src/services/providers/profiles
 * @description Google 官方 Gemini 渠道画像。
 * @author KK-Studio Team
 * @version 1.5.4
 */

import { ProviderProfile } from './index';

export const googleProfile: ProviderProfile = {
  id: 'google',
  label: 'Google Gemini Official',
  matchers: {
    providerNames: [/google/i, /gemini/i],
    hostPatterns: [/generativelanguage\.googleapis\.com/i],
    basePatterns: [/google/i, /gemini/i]
  },
  surfaces: {
    'gemini-native': {
      enabled: true,
      auth: {
        method: 'query',
        headerName: 'x-goog-api-key', // 可选 Header 备用
        valueFormat: 'raw'
      },
      endpointStyle: 'gemini-native',
      discovery: 'models'
    },
    'gemini-models': {
      enabled: true,
      auth: {
        method: 'query',
        valueFormat: 'raw'
      },
      endpointStyle: 'gemini-native'
    }
  },
  defaults: {
    preferredChatSurface: 'gemini-native',
    preferredImageSurface: 'gemini-native'
  },
  capabilities: {
    supportsEndpointTypesField: false,
    supportsAsyncTasks: false,
    billingRisk: 'low'
  }
};
