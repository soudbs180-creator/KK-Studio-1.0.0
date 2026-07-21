// services/api/lib/data-collection/index.js
// 中文注释：数据采集/网站交互工具子系统统一出口（Phase 5 前置骨架）。

const { registerTool, getTool, listTools, clearTools } = require('./toolRegistry');
const { selectChannel, canFallbackToBrowser } = require('./channelStrategy');
const { executeTool } = require('./executor');

module.exports = {
  registerTool,
  getTool,
  listTools,
  clearTools,
  selectChannel,
  canFallbackToBrowser,
  executeTool,
};
