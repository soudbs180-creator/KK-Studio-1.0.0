// services/api/lib/dispatcher/providerRouter.js
// 中文注释：大模型图像生成请求核心调度路由器

const providerRegistry = require('./providerRegistry');

/**
 * 依据供应商ID与模型ID，分发执行图像生成
 */
async function generateImage(input) {
  const { providerId, modelId } = input;
  const adapter = providerRegistry.getAdapter(providerId);
  if (!adapter) {
    const err = new Error(`No adapter registered for provider: ${providerId}`);
    err.code = 'PROVIDER_ROUTE_MISMATCH';
    err.statusCode = 400;
    throw err;
  }
  
  return adapter.generateImage(input);
}

module.exports = {
  generateImage
};
