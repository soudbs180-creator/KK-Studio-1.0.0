// services/api/lib/data-collection/executor.js
// 中文注释：数据采集工具执行器骨架。
//          当前仅实现通道选择与结果封装；具体 Provider/API 适配器在 Phase 5 接入。

const { selectChannel, canFallbackToBrowser } = require('./channelStrategy');

/**
 * @typedef {import('@kk/shared').DataCollectionRequest} DataCollectionRequest
 * @typedef {import('@kk/shared').DataCollectionTool} DataCollectionTool
 * @typedef {import('@kk/shared').DataCollectionResult} DataCollectionResult
 */

/**
 * 执行数据采集工具。
 * @param {Object} params
 * @param {DataCollectionTool} params.tool
 * @param {DataCollectionRequest} params.request
 * @param {Object} [params.context]
 * @param {string} [params.context.userId]
 * @param {boolean} [params.context.apiAvailable]
 * @param {boolean} [params.context.browserAvailable]
 * @param {boolean} [params.context.apiRateLimited]
 * @returns {Promise<DataCollectionResult>}
 */
async function executeTool({ tool, request, context = {} }) {
  const startedAt = new Date().toISOString();

  try {
    const channel = selectChannel({
      tool,
      preferredChannel: request.channel,
      apiAvailable: context.apiAvailable,
      browserAvailable: context.browserAvailable,
      apiRateLimited: context.apiRateLimited,
    });

    // Phase 5 接入点：根据 channel 调用 API Provider 或 Browser Bridge Adapter
    const data = await runAdapter({ tool, request, channel, context });

    const finishedAt = new Date().toISOString();
    return {
      success: true,
      data,
      metadata: {
        channelUsed: channel,
        browserProfileId: request.browserProfileId,
        requestId: request.requestId,
        startedAt,
        finishedAt,
      },
    };
  } catch (err) {
    const finishedAt = new Date().toISOString();
    const errorCode = err.code || 'EXECUTION_FAILED';

    if (
      request.channel === 'hybrid-auto' ||
      request.channel === undefined ||
      request.channel === 'api'
    ) {
      const canFallback = canFallbackToBrowser({
        tool,
        failedChannel: err.channel || request.channel || 'api',
        errorCode,
      });
      if (canFallback) {
        // 记录回退意图；Phase 5 实现真正重试
        err.fallbackToBrowser = true;
      }
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: err.message,
      },
      metadata: {
        channelUsed: err.channel || request.channel || 'hybrid-auto',
        browserProfileId: request.browserProfileId,
        requestId: request.requestId,
        startedAt,
        finishedAt,
      },
    };
  }
}

/**
 * 调用具体通道适配器（占位实现）。
 * @param {Object} params
 * @param {DataCollectionTool} params.tool
 * @param {DataCollectionRequest} params.request
 * @param {import('@kk/shared').DataCollectionChannel} params.channel
 * @param {Object} params.context
 * @returns {Promise<unknown>}
 */
async function runAdapter({ tool, request, channel, context }) {
  if (channel === 'api') {
    throw Object.assign(new Error(`API adapter for ${tool.toolId} is not implemented yet.`), {
      code: 'API_UNAVAILABLE',
      channel,
    });
  }

  if (channel === 'browser-automation') {
    throw Object.assign(new Error(`Browser automation adapter for ${tool.toolId} is not implemented yet.`), {
      code: 'BROWSER_ADAPTER_UNAVAILABLE',
      channel,
    });
  }

  throw new Error(`Unsupported channel: ${channel}`);
}

module.exports = {
  executeTool,
};
