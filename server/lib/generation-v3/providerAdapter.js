// server/lib/generation-v3/providerAdapter.js
// 中文注释：统一 Provider Adapter 抽象接口。
//          所有图片/视频/音频 Provider 必须实现 submit / poll / cancel / parse，
//          由 RouteEngine 按 Quote 中的 routeSnapshot 分发。

/**
 * @typedef {Object} ProviderSubmitInput
 * @property {string} requestId
 * @property {string} modelId
 * @property {string} prompt
 * @property {string} [aspectRatio]
 * @property {string} [size]
 * @property {number} [count]
 * @property {Array<string>} [referenceImages]
 * @property {Object} [payload] - Provider 专用原始参数
 * @property {Object} [auth] - 鉴权信息，例如 { apiKey, keySlotId }
 */

/**
 * @typedef {Object} ProviderSubmitResult
 * @property {string} providerTaskId
 * @property {'pending'|'success'|'failed'} status
 * @property {string[]} [urls]
 * @property {string} [errorMessage]
 */

/**
 * @typedef {Object} ProviderPollResult
 * @property {'pending'|'running'|'success'|'failed'|'cancelled'} status
 * @property {string[]} [urls]
 * @property {string} [errorMessage]
 * @property {Object} [raw]
 */

/**
 * @typedef {Object} ProviderAdapter
 * @property {string} adapterId
 * @property {string} adapterVersion
 * @property {(input: ProviderSubmitInput) => Promise<ProviderSubmitResult>} submit
 * @property {(providerTaskId: string, auth?: Object) => Promise<ProviderPollResult>} poll
 * @property {(providerTaskId: string, auth?: Object) => Promise<void>} cancel
 */

class ProviderAdapterRegistry {
  constructor() {
    /** @type {Map<string, ProviderAdapter>} */
    this.adapters = new Map();
  }

  /**
   * 注册 Provider Adapter
   * @param {ProviderAdapter} adapter
   */
  register(adapter) {
    if (!adapter || typeof adapter.adapterId !== 'string') {
      throw new Error('ProviderAdapter must have a string adapterId');
    }
    if (typeof adapter.submit !== 'function' || typeof adapter.poll !== 'function') {
      throw new Error(`ProviderAdapter ${adapter.adapterId} must implement submit and poll`);
    }
    this.adapters.set(adapter.adapterId, adapter);
  }

  /**
   * @param {string} adapterId
   * @returns {ProviderAdapter|undefined}
   */
  get(adapterId) {
    return this.adapters.get(adapterId);
  }

  /**
   * @returns {ProviderAdapter[]}
   */
  list() {
    return Array.from(this.adapters.values());
  }
}

const registry = new ProviderAdapterRegistry();

module.exports = {
  ProviderAdapterRegistry,
  registry,
};
