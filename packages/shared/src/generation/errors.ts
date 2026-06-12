// packages/shared/src/generation/errors.ts
// 中文注释：大模型供应商错误处理与标准化转换

import type {
  GenerationProviderId,
  StandardGenerationErrorCode,
  StandardGenerationError,
} from './types.ts';

/**
 * 将各上游供应商的原始错误码/提示信息，归一化为平台标准错误
 */
export function normalizeGenerationError(params: {
  providerId: GenerationProviderId;
  statusCode?: number;
  message?: string;
  rawError?: any;
}): StandardGenerationError {
  const { providerId, statusCode, message = '', rawError } = params;
  let code: StandardGenerationErrorCode = 'UNKNOWN_PROVIDER_ERROR';
  let retryable = false;

  const errMsg = message.toLowerCase();

  // 1. 通用 HTTP 状态码归一化
  if (statusCode === 401 || statusCode === 403 || errMsg.includes('unauthorized') || errMsg.includes('api key') || errMsg.includes('auth')) {
    code = 'AUTH_ERROR';
  } else if (statusCode === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests')) {
    code = 'RATE_LIMIT';
    retryable = true;
  } else if (statusCode === 400 || errMsg.includes('invalid') || errMsg.includes('bad request') || errMsg.includes('prompt too long')) {
    code = 'INVALID_INPUT';
  } else if (statusCode === 404 || errMsg.includes('not found') || errMsg.includes('model not exist')) {
    code = 'MODEL_UNAVAILABLE';
  } else if (statusCode === 504 || errMsg.includes('timeout') || errMsg.includes('deadline exceeded')) {
    code = 'TIMEOUT';
    retryable = true;
  }

  // 2. 特殊厂家特有错误处理
  if (providerId === 'wuyinkeji') {
    if (errMsg.includes('contract mismatch') || errMsg.includes('documented async')) {
      code = 'PROVIDER_ROUTE_MISMATCH';
    }
  } else if (providerId === 'google') {
    if (errMsg.includes('safety') || errMsg.includes('block')) {
      code = 'INVALID_INPUT'; // 触发安全过滤
    }
  }

  return {
    code,
    message: message || 'An unexpected error occurred during image generation.',
    retryable,
    providerId,
    status: statusCode,
    raw: rawError,
  };
}
