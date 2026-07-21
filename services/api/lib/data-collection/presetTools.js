// services/api/lib/data-collection/presetTools.js
// 中文注释：预设数据采集工具示例，用于验证注册表与 LLM function calling schema。

const { registerTool } = require('./toolRegistry');

function registerPresetTools() {
  registerTool({
    toolId: 'search_amazon_product',
    description: '在亚马逊搜索产品信息，返回标题、价格、卖点、图片链接',
    descriptionForModel: 'Search Amazon for product information (title, price, selling points, image URLs). Use when the user needs competitive product research.',
    inputParameters: [
      { name: 'query', type: 'string', description: '搜索关键词', required: true },
      { name: 'marketplace', type: 'string', description: '站点，如 amazon.com、amazon.co.jp', required: false },
      { name: 'maxResults', type: 'number', description: '最大结果数', required: false },
    ],
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          price: { type: 'string' },
          rating: { type: 'string' },
          imageUrl: { type: 'string' },
          detailUrl: { type: 'string' },
        },
      },
    },
    supportedChannels: ['api', 'browser-automation', 'hybrid-auto'],
    defaultChannel: 'hybrid-auto',
    allowedHosts: ['amazon.com', 'amazon.co.jp', 'amazon.co.uk'],
    requiresUserAuth: false,
  });

  registerTool({
    toolId: 'search_xiaohongshu_product',
    description: '在小红书搜索产品种草笔记，返回标题、摘要、图片链接',
    descriptionForModel: 'Search Xiaohongshu (RED) for product seeding notes. Use when the user wants to understand Chinese consumer trends.',
    inputParameters: [
      { name: 'query', type: 'string', description: '搜索关键词', required: true },
      { name: 'maxResults', type: 'number', description: '最大结果数', required: false },
    ],
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          imageUrl: { type: 'string' },
          detailUrl: { type: 'string' },
        },
      },
    },
    supportedChannels: ['browser-automation', 'hybrid-auto'],
    defaultChannel: 'browser-automation',
    allowedHosts: ['xiaohongshu.com'],
    requiresUserAuth: false,
  });

  registerTool({
    toolId: 'analyze_product_selling_points',
    description: '根据竞品资料分析产品卖点并生成优化后的图片提示词',
    descriptionForModel: 'Analyze competitor product data and generate optimized image generation prompts for e-commerce main images or detail pages.',
    inputParameters: [
      { name: 'productName', type: 'string', description: '产品名称', required: true },
      { name: 'competitorData', type: 'array', description: '竞品资料列表', required: true },
      { name: 'targetMarket', type: 'string', description: '目标市场', required: false },
    ],
    outputSchema: {
      type: 'object',
      properties: {
        sellingPoints: { type: 'array', items: { type: 'string' } },
        promptVariations: { type: 'array', items: { type: 'string' } },
        recommendedAspectRatios: { type: 'array', items: { type: 'string' } },
      },
    },
    supportedChannels: ['api'],
    defaultChannel: 'api',
    requiresUserAuth: false,
  });
}

module.exports = {
  registerPresetTools,
};
