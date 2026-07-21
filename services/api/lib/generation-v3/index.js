// services/api/lib/generation-v3/index.js
// 中文注释：AI 创作核心升级 Phase 1 服务端统一出口。

const { registry } = require('./providerAdapter');
require('./fakeProviderAdapter');
require('./adapters');

const { createQuote, getActiveQuote, getQuote, consumeQuote } = require('./quoteEngine');
const { createJobFromQuote, submitJob } = require('./jobLifecycle');
const { getJob } = require('./jobStore');
const { selectRoute, buildRouteSnapshot } = require('./routeEngine');

module.exports = {
  registry,
  createQuote,
  getActiveQuote,
  getQuote,
  consumeQuote,
  createJobFromQuote,
  submitJob,
  getJob,
  selectRoute,
  buildRouteSnapshot,
};
