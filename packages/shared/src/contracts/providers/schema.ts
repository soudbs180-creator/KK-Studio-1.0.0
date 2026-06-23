// packages/shared/src/contracts/providers/schema.ts
// 中文注释：供应商 Zod 模式校验及验证函数

import { z } from 'zod';
import type { ProviderItem } from './types.ts';

export const ProviderAuthSchema = z.object({
  method: z.enum(['bearer', 'header', 'query_param', 'custom']),
  headerName: z.string().optional(),
  keyRef: z.string().min(1, 'keyRef 必填且不能为空')
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
  capabilities: z.array(z.string()).default([])
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
