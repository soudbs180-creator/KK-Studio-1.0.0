/**
 * @file openai.ts
 * @module apps/web/src/services/providers/profiles
 * @description OpenAI 官方渠道画像。
 * @author KK-Studio Team
 * @version 1.5.6
 */

import { ProviderProfile } from './index';

export const openaiProfile: ProviderProfile = {
  id: 'openai',
  label: 'OpenAI Official',
  matchers: {
    providerNames: [/openai/i],
    hostPatterns: [/api\.openai\.com/i]
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
    'openai-images': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      endpointStyle: 'openai-compatible'
    },
    'openai-models': {
      enabled: true,
      auth: {
        method: 'header',
        headerName: 'Authorization',
        valueFormat: 'bearer'
      },
      endpointStyle: 'openai-compatible'
    }
  },
  defaults: {
    preferredChatSurface: 'openai-chat',
    preferredImageSurface: 'openai-images'
  },
  capabilities: {
    supportsEndpointTypesField: false,
    supportsAsyncTasks: false,
    billingRisk: 'low'
  }
};
