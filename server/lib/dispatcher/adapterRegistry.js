/**
 * @file adapterRegistry.js
 * @module server/lib/dispatcher
 * @description 后端协议适配器注册中心。负责定义不同通信协议面（Surface）的
 *              请求 Payload 组装、Headers 构造以及响应字段提取策略，实现非标接口归一化。
 * @author KK-Studio Team
 * @version 1.6.0
 */

const querystring = require('querystring');

function normalizeBaseUrl(baseUrl) {
  let clean = String(baseUrl || '').trim().replace(/\/+$/, '');
  const suffixes = [
    '/v1/chat/completions',
    '/chat/completions',
    '/api/chat/completions',
  ];

  let changed = true;
  while (changed) {
    changed = false;
    const lower = clean.toLowerCase();
    for (const suffix of suffixes) {
      if (lower.endsWith(suffix)) {
        clean = clean.slice(0, -suffix.length).replace(/\/+$/, '');
        changed = true;
        break;
      }
    }
  }

  if (!clean) return '';
  if (!/\/v\d+(?:beta)?$/i.test(clean) && !clean.endsWith('/compatible-mode')) {
    return `${clean}/v1`;
  }
  return clean;
}

function getHostname(value) {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function normalizeAdapterId(adapterIdOrType, channel = {}) {
  const explicit = String(adapterIdOrType || '').trim().toLowerCase();
  const profile = String(channel.request_profile_id || channel.provider_kind || channel.provider_id || '').trim().toLowerCase();
  const baseUrl = String(channel.base_url || '').trim().toLowerCase();
  const hostname = getHostname(channel.base_url);

  // 中文注释：显式配置优先，但 auto/default/openai 仍允许根据 URL 自动纠偏，降低第三方接入门槛。
  if (explicit && !['auto', 'default', 'openai'].includes(explicit)) {
    if (['custom_form', 'form', 'wuyin_form', 'suchuang_form'].includes(explicit)) return 'custom_form_urlencoded';
    if (['openai_chat', 'openai_compat', 'openai-compatible', 'chat_completions'].includes(explicit)) return 'openai_chat_completions';
    return explicit;
  }

  if (
    profile.includes('wuyin')
    || profile.includes('suchuang')
    || hostname.includes('wuyinkeji.com')
    || baseUrl.includes('/api/chat/index')
  ) {
    return 'custom_form_urlencoded';
  }

  // 中文注释：绝大多数第三方中转站都声称 OpenAI-compatible；统一走该协议面，并由 OpenAICompatAdapter 清洗重复路径。
  return 'openai_chat_completions';
}

class OpenAICompatAdapter {
  /**
   * 拼装标准 OpenAI 兼容的 HTTP 请求
   */
  buildRequest(provider, modelId, unifiedPayload) {
    const baseUrl = normalizeBaseUrl(provider.base_url || 'https://api.openai.com/v1');
    const url = `${baseUrl}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.api_key}`
    };

    const body = JSON.stringify({
      model: modelId,
      messages: unifiedPayload.messages,
      temperature: unifiedPayload.temperature ?? 0.7,
      max_tokens: unifiedPayload.max_tokens,
      stream: unifiedPayload.stream ?? false
    });

    return { url, method: 'POST', headers, body };
  }

  /**
   * 解析标准 OpenAI 响应
   */
  extractContent(data) {
    const content = data?.choices?.[0]?.message?.content
      || data?.choices?.[0]?.delta?.content
      || data?.output_text;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('OpenAI 兼容协议返回空内容');
    }
    return content;
  }
}

class CustomFormUrlencodedAdapter {
  /**
   * 拼装非标的 x-www-form-urlencoded 表单请求（如速创 API 般高度定制）
   */
  buildRequest(provider, modelId, unifiedPayload) {
    // 取得消息历史中最后一条 user 消息
    const messages = unifiedPayload.messages || [];
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    const content = lastUserMessage ? lastUserMessage.content : unifiedPayload.user_input || '';

    const url = provider.base_url; // 对于定制接口，直接使用完整的 URL 端点
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      'Authorization': provider.api_key // 自定义 API 密钥头部
    };

    const body = querystring.stringify({
      content: content,
      model: modelId,
      stream: 'false'
    });

    return { url, method: 'POST', headers, body };
  }

  /**
   * 解析扁平表单响应，支持多种可能的内容字段
   */
  extractContent(data) {
    const content = data?.content || data?.text || data?.message || data?.data?.content || data?.data?.text;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('表单自定义协议返回空内容');
    }
    return content;
  }
}

const adapters = {
  'openai_chat_completions': new OpenAICompatAdapter(),
  'custom_form_urlencoded': new CustomFormUrlencodedAdapter()
};

/**
 * 根据协议面标识获取具体的协议适配器，兼容数据库中配置的 endpoint_type。
 * @param {string|object} adapterIdOrType 适配器协议 ID、endpoint_type 或完整渠道对象
 * @param {object} channel 完整渠道对象，可用于自动识别第三方协议画像
 */
function getAdapter(adapterIdOrType, channel = {}) {
  const channelConfig = typeof adapterIdOrType === 'object' && adapterIdOrType
    ? adapterIdOrType
    : channel;
  const rawAdapterId = typeof adapterIdOrType === 'object' && adapterIdOrType
    ? (adapterIdOrType.endpoint_type || adapterIdOrType.adapterId)
    : adapterIdOrType;
  const resolvedId = normalizeAdapterId(rawAdapterId, channelConfig);

  const adapter = adapters[resolvedId];
  if (!adapter) {
    throw new Error(`未找到匹配的后端适配器协议面: ${rawAdapterId} (映射为: ${resolvedId})`);
  }
  return adapter;
}

module.exports = {
  getAdapter,
  normalizeAdapterId,
  normalizeBaseUrl
};
