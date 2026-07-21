// services/api/lib/data-collection/toolRegistry.js
// 中文注释：AI 助手可调用的数据采集/网站交互工具注册表。

const { DataCollectionToolSchema } = require('@kk/shared');

/** @type {Map<string, import('@kk/shared').DataCollectionTool>} */
const tools = new Map();

/**
 * 注册一个数据采集工具。
 * @param {import('@kk/shared').DataCollectionTool} tool
 */
function registerTool(tool) {
  const validated = DataCollectionToolSchema.parse(tool);
  if (!validated.supportedChannels.includes(validated.defaultChannel) && validated.defaultChannel !== 'hybrid-auto') {
    throw new Error(`Tool ${validated.toolId} default channel ${validated.defaultChannel} is not in supportedChannels.`);
  }
  tools.set(validated.toolId, validated);
}

/**
 * 获取工具定义。
 * @param {string} toolId
 * @returns {import('@kk/shared').DataCollectionTool | undefined}
 */
function getTool(toolId) {
  return tools.get(toolId);
}

/**
 * 列出所有已注册工具。
 * @returns {import('@kk/shared').DataCollectionTool[]}
 */
function listTools() {
  return [...tools.values()];
}

/**
 * 清空注册表（主要用于测试）。
 */
function clearTools() {
  tools.clear();
}

module.exports = {
  registerTool,
  getTool,
  listTools,
  clearTools,
};
