/**
 * @file gptBest.ts
 * @module apps/web/src/services/providers/profiles
 * @description GPT Best 聚合服务渠道画像。
 * @author KK-Studio Team
 * @version 1.5.4
 */

import { ProviderProfile } from './index';

export const gptBestProfile: ProviderProfile = {
  id: 'gpt-best',
  label: 'GPT Best Aggregator',
  matchers: {
    providerNames: [/gpt-best/i, /gptbest/i, /cherry/i],
    basePatterns: [/gpt-best/i, /gptbest/i]
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
    supportsEndpointTypesField: true,
    supportsAsyncTasks: false,
    billingRisk: 'medium'
  }
};
