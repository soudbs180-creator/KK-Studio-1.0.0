// services/api/lib/data-collection/channelStrategy.js
// 中文注释：数据采集工具通道选择策略。
//          支持用户显式指定、AI 自动调配、API 失败时回退到浏览器自动化。

/**
 * @typedef {import('@kk/shared').DataCollectionChannel} DataCollectionChannel
 * @typedef {import('@kk/shared').DataCollectionTool} DataCollectionTool
 */

/**
 * 根据工具配置、用户偏好、风控历史选择实际使用的通道。
 * @param {Object} params
 * @param {DataCollectionTool} params.tool
 * @param {DataCollectionChannel} [params.preferredChannel]
 * @param {boolean} [params.apiAvailable]
 * @param {boolean} [params.browserAvailable]
 * @param {boolean} [params.apiRateLimited]
 * @returns {DataCollectionChannel}
 */
function selectChannel({
  tool,
  preferredChannel,
  apiAvailable = true,
  browserAvailable = true,
  apiRateLimited = false,
}) {
  const supports = (channel) => tool.supportedChannels.includes(channel);

  // 1. 用户/AI 显式指定通道
  if (preferredChannel && preferredChannel !== 'hybrid-auto') {
    if (!supports(preferredChannel)) {
      const err = new Error(`Tool ${tool.toolId} does not support channel ${preferredChannel}.`);
      err.code = 'CHANNEL_UNSUPPORTED';
      err.statusCode = 400;
      throw err;
    }
    const isAvailable = preferredChannel === 'api'
      ? apiAvailable && !apiRateLimited
      : browserAvailable;
    if (!isAvailable) {
      const err = new Error(`Channel ${preferredChannel} is not available for tool ${tool.toolId}.`);
      err.code = 'CHANNEL_UNAVAILABLE';
      err.statusCode = 400;
      throw err;
    }
    return preferredChannel;
  }

  // 2. 工具默认通道（非 hybrid-auto）
  if (tool.defaultChannel !== 'hybrid-auto' && supports(tool.defaultChannel)) {
    return tool.defaultChannel;
  }

  // 3. 自动调配：优先 API，API 不可用时回退浏览器
  if (supports('api') && apiAvailable && !apiRateLimited) {
    return 'api';
  }

  if (supports('browser-automation') && browserAvailable) {
    return 'browser-automation';
  }

  const err = new Error(`No available channel for tool ${tool.toolId}.`);
  err.code = 'CHANNEL_UNAVAILABLE';
  err.statusCode = 400;
  throw err;
}

/**
 * 判断某次失败后是否允许回退到浏览器通道。
 * @param {Object} params
 * @param {DataCollectionTool} params.tool
 * @param {string} params.failedChannel
 * @param {string} params.errorCode
 * @returns {boolean}
 */
function canFallbackToBrowser({ tool, failedChannel, errorCode }) {
  if (failedChannel === 'browser-automation') return false;
  if (!tool.supportedChannels.includes('browser-automation')) return false;
  const fallbackEligibleCodes = new Set([
    'RATE_LIMITED',
    'FORBIDDEN',
    'UNAUTHORIZED',
    'SETUP_REQUIRED',
    'API_UNAVAILABLE',
  ]);
  return fallbackEligibleCodes.has(errorCode);
}

module.exports = {
  selectChannel,
  canFallbackToBrowser,
};
