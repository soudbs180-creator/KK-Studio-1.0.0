// packages/shared/src/generation/types.ts
// 中文注释：规范化的模型生成类型定义与契约定义

/**
 * 大模型供应商统一枚举标识
 */
export type GenerationProviderId =
  | 'google'
  | 'gpt-best'
  | '12ai'
  | 'suxi'
  | 'wuyinkeji'
  | 'newapi'
  | 'acedata'
  | 'custom';

/**
 * 图像生成的执行/调度 Surface 类型
 */
export type GenerationSurface =
  | 'chat-image'
  | 'provider-images'
  | 'gemini-native-image'
  | 'async-image';

/**
 * 标准的生成任务执行状态
 */
export type StandardGenerationStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed';

/**
 * 标准的生成服务错误码枚举
 */
export type StandardGenerationErrorCode =
  | 'AUTH_ERROR'                  // 认证错误 (API Key 无效或过期)
  | 'RATE_LIMIT'                  // 请求频率超限
  | 'INVALID_INPUT'               // 输入参数校验未通过
  | 'MODEL_UNAVAILABLE'           // 请求的模型不存在或已下架
  | 'PROVIDER_ROUTE_MISMATCH'     // 供应商路由未匹配
  | 'PROVIDER_RESPONSE_INVALID'   // 供应商返回数据格式错误或不完整
  | 'EMPTY_RESULT'                // 生成的返回结果为空
  | 'TIMEOUT'                     // 请求上游超时
  | 'BILLING_PRECHARGE_FAILED'    // 计费预扣积分失败
  | 'BILLING_REFUND_FAILED'       // 计费失败退款事务执行失败
  | 'UNKNOWN_PROVIDER_ERROR';     // 未分类的供应商内部错误

/**
 * 统一的图像生成输入参数契约
 */
export interface StandardImageGenerationInput {
  requestId: string;
  providerId: GenerationProviderId;
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  size?: string;
  imageCount?: number;
  referenceImages?: Array<string | { data: string; mimeType: string }>;
  executionLane: 'local-user-api' | 'cloud-credit-model';
}

/**
 * 统一的图像生成输出/结果契约
 */
export interface StandardImageGenerationResult {
  requestId: string;
  providerId: GenerationProviderId;
  surface: GenerationSurface;
  modelId: string;
  status: StandardGenerationStatus;
  urls: string[];
  taskId?: string;
  providerTaskId?: string;
  usage?: {
    totalTokens?: number;
    cost?: number;
  };
  billing?: {
    deducted?: boolean;
    ledgerId?: string;
    balanceAfter?: number;
    refundApplied?: boolean;
  };
  error?: StandardGenerationError;
  raw?: unknown;
}

/**
 * 统一的生成错误详情契约
 */
export interface StandardGenerationError {
  code: StandardGenerationErrorCode;
  message: string;
  retryable: boolean;
  providerId: GenerationProviderId;
  surface?: GenerationSurface;
  status?: number;
  raw?: unknown;
}
