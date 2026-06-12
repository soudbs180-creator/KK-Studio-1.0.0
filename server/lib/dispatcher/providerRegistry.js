// server/lib/dispatcher/providerRegistry.js
// 中文注释：后端供应商 Adapter 注册表

const googleImageAdapter = require('./adapters/googleImageAdapter');
const wuyinImageAdapter = require('./adapters/wuyinImageAdapter');
const { OpenAICompatibleImageAdapter } = require('./adapters/openAICompatibleImageAdapter');

const registry = {
  google: googleImageAdapter,
  wuyinkeji: wuyinImageAdapter,
  'gpt-best': new OpenAICompatibleImageAdapter('gpt-best'),
  '12ai': new OpenAICompatibleImageAdapter('12ai'),
  suxi: new OpenAICompatibleImageAdapter('suxi'),
  newapi: new OpenAICompatibleImageAdapter('newapi'),
  acedata: new OpenAICompatibleImageAdapter('acedata'),
  custom: new OpenAICompatibleImageAdapter('custom')
};

/**
 * 依据供应商ID获取适配器
 */
function getAdapter(providerId) {
  return registry[providerId] || registry.custom;
}

module.exports = {
  getAdapter,
  registry
};
