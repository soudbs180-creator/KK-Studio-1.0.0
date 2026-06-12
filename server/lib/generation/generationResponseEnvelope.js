// server/lib/generation/generationResponseEnvelope.js
// 中文注释：后端接口统一 JSON 信封包装器

/**
 * 包装成功的响应
 */
function wrapSuccess(data, meta = {}) {
  return {
    success: true,
    data,
    meta: {
      requestId: data?.requestId || meta.requestId,
      providerId: data?.providerId || meta.providerId,
      surface: data?.surface || meta.surface,
      ...meta
    }
  };
}

/**
 * 包装失败的响应
 */
function wrapError(error, meta = {}) {
  return {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_PROVIDER_ERROR',
      message: error.message || 'An unexpected error occurred during generation.',
      retryable: !!error.retryable,
      providerId: error.providerId || meta.providerId,
      surface: error.surface || meta.surface,
      status: error.status || error.statusCode
    },
    meta: {
      requestId: error.requestId || meta.requestId,
      providerId: error.providerId || meta.providerId,
      surface: error.surface || meta.surface,
      ...meta
    }
  };
}

module.exports = {
  wrapSuccess,
  wrapError
};
