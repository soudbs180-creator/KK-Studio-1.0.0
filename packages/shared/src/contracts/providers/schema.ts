// packages/shared/src/contracts/providers/schema.ts
// 中文注释：供应商 Zod 模式校验及验证函数

import { z } from 'zod';
import type { ProviderItem } from './types.ts';

export const ProviderAuthSchema = z.object({
  method: z.enum(['bearer', 'header', 'query_param', 'custom']),
  headerName: z.string().optional(),
  keyRef: z.string().min(1, 'keyRef 必填且不能为空')
});

export const ProviderGenerationCapabilitiesSchema = z.object({
  imageGeneration: z.boolean().default(false),
  textToVideo: z.boolean().default(false),
  imageToVideo: z.boolean().default(false),
  firstLastFrameVideo: z.boolean().default(false),
  videoExtension: z.boolean().default(false),
  audioGeneration: z.boolean().default(false),
  audioSynchronizedVideo: z.boolean().default(false),
  supportedDurationsSeconds: z.array(z.number().int().positive()).default([]),
  supportedResolutions: z.array(z.string().min(1)).default([]),
  maxConcurrentImage: z.number().int().min(0).max(64).default(0),
  maxConcurrentVideo: z.number().int().min(0).max(16).default(0),
  maxConcurrentAudio: z.number().int().min(0).max(32).default(0),
});

export const ProviderItemSchema = z.object({
  id: z.string().min(1, 'id 必填且不能为空'),
  kind: z.enum(['official', 'relay', 'byok-reverse-proxy']),
  displayName: z.string().min(1, 'displayName 必填且不能为空'),
  host: z.string().min(1, 'host 必填且不能为空'),
  apiFormat: z.enum(['openai', 'gemini', 'anthropic', 'custom']),
  auth: ProviderAuthSchema,
  endpoints: z.object({
    base: z.string().min(1, 'base endpoint 必填且不能为空'),
    chat: z.string().optional(),
    image: z.string().optional(),
    video: z.string().optional(),
    models: z.string().optional()
  }),
  pricingSource: z.object({
    sourceType: z.enum(['online', 'local_fallback']),
    url: z.string().url('pricingSource url 必须是合法 URL').optional(),
    fallbackFile: z.string().optional()
  }),
  capabilities: z.array(z.string()).default([]),
  generationCapabilities: ProviderGenerationCapabilitiesSchema.default({
    imageGeneration: false,
    textToVideo: false,
    imageToVideo: false,
    firstLastFrameVideo: false,
    videoExtension: false,
    audioGeneration: false,
    audioSynchronizedVideo: false,
    supportedDurationsSeconds: [],
    supportedResolutions: [],
    maxConcurrentImage: 0,
    maxConcurrentVideo: 0,
    maxConcurrentAudio: 0,
  })
});

/**
 * 校验供应商配置，不通过则抛出 ZodError 异常
 */
export function validateProviderItem(data: unknown): ProviderItem {
  return ProviderItemSchema.parse(data) as unknown as ProviderItem;
}

/**
 * 安全校验供应商配置，不抛出异常，返回包含 success 及 data/error 的结果对象
 */
export function safeValidateProviderItem(data: unknown) {
  return ProviderItemSchema.safeParse(data);
}
