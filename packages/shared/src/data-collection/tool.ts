// packages/shared/src/data-collection/tool.ts
// 中文注释：AI 助手可调用的数据采集/网站交互工具契约。
//          支持 API 与浏览器自动化两种通道，AI 可根据策略自动调配。

import { z } from 'zod';

export const DataCollectionChannelSchema = z.enum([
  'api',
  'browser-automation',
  'hybrid-auto',
]);

export type DataCollectionChannel = z.infer<typeof DataCollectionChannelSchema>;

export const DataCollectionToolParameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string(),
  required: z.boolean().default(false),
  enum: z.array(z.string()).optional(),
});

export type DataCollectionToolParameter = z.infer<typeof DataCollectionToolParameterSchema>;

export const DataCollectionToolSchema = z.object({
  toolId: z.string().min(1),
  description: z.string().min(1),
  descriptionForModel: z.string().min(1),
  inputParameters: z.array(DataCollectionToolParameterSchema).default([]),
  outputSchema: z.record(z.string(), z.unknown()).default({}),
  supportedChannels: z.array(DataCollectionChannelSchema).min(1),
  defaultChannel: DataCollectionChannelSchema.default('hybrid-auto'),
  allowedHosts: z.array(z.string()).optional(),
  requiresUserAuth: z.boolean().default(false),
});

export type DataCollectionTool = z.infer<typeof DataCollectionToolSchema>;

export const DataCollectionRequestSchema = z.object({
  toolId: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  channel: DataCollectionChannelSchema.optional(),
  browserProfileId: z.string().optional(),
  requestId: z.string().optional(),
});

export type DataCollectionRequest = z.infer<typeof DataCollectionRequestSchema>;

export const DataCollectionResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  metadata: z.object({
    channelUsed: DataCollectionChannelSchema,
    browserProfileId: z.string().optional(),
    requestId: z.string().optional(),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
  }),
});

export type DataCollectionResult = z.infer<typeof DataCollectionResultSchema>;
