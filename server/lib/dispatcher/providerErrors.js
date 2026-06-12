// server/lib/dispatcher/providerErrors.js
// 中文注释：后端供应商错误捕获与标准化映射

function normalizeGenerationError(params) {
  const { providerId, statusCode, message = '', rawError } = params;
  let code = 'UNKNOWN_PROVIDER_ERROR';
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
      code = 'INVALID_INPUT';
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

/**
 * 将底层适配器捕获的错误规范化为 StandardGenerationError 格式 of 错误对象
 */
function toStandardError(err, providerId, surface) {
  const statusCode = err.statusCode || err.status || (err.response ? err.response.status : undefined);
  const message = err.message || 'Upstream provider execution failed';
  
  const normalized = normalizeGenerationError({
    providerId,
    statusCode,
    message,
    rawError: err
  });

  const errorObj = new Error(normalized.message);
  errorObj.code = normalized.code;
  errorObj.retryable = normalized.retryable;
  errorObj.providerId = providerId;
  errorObj.surface = surface;
  errorObj.statusCode = statusCode;
  errorObj.raw = err;
  
  return errorObj;
}

module.exports = {
  toStandardError
};
