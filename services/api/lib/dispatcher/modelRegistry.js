/**
 * @file modelRegistry.js
 * @module services/api/lib/dispatcher
 * @description 后端模型映射注册表。负责为模型 ID 建立与适配器协议、
 *              默认渠道的静态绑定关系，解耦客户端与服务端的硬编码。
 * @author KK-Studio Team
 * @version 1.5.3
 */

const models = {
  // 1. 标准对话模型
  'gpt-4o-mini': {
    realModelName: 'gpt-4o-mini',
    adapterId: 'openai_chat_completions',
    providerId: 'openai-official'
  },
  'gpt-4o': {
    realModelName: 'gpt-4o',
    adapterId: 'openai_chat_completions',
    providerId: 'openai-official'
  },

  // 2. 速创非标定制对话模型 (wuyinkeji 渠道)
  'gemini-3-pro': {
    realModelName: 'gemini-3-pro',
    adapterId: 'custom_form_urlencoded',
    providerId: 'wuyin-custom'
  },
  'gemini-2.5-pro': {
    realModelName: 'gemini-2.5-pro',
    adapterId: 'custom_form_urlencoded',
    providerId: 'wuyin-custom'
  },
  'gemini-2.5-flash': {
    realModelName: 'gemini-2.5-flash',
    adapterId: 'custom_form_urlencoded',
    providerId: 'wuyin-custom'
  },
  'o4-mini-all': {
    realModelName: 'o4-mini-all',
    adapterId: 'custom_form_urlencoded',
    providerId: 'wuyin-custom'
  }
};

/**
 * 根据模型 ID 获取其注册绑定配置
 * @param {string} modelId 模型别名 ID
 */
function getModelConfig(modelId) {
  const config = models[modelId];
  if (!config) {
    // 默认兜底使用 openai 兼容协议
    return {
      realModelName: modelId,
      adapterId: 'openai_chat_completions',
      providerId: 'generic-openai'
    };
  }
  return config;
}

module.exports = {
  getModelConfig
};
