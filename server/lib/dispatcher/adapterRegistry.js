/**
 * @file adapterRegistry.js
 * @module server/lib/dispatcher
 * @description 后端协议适配器注册中心。负责定义不同通信协议面（Surface）的
 *              请求 Payload 组装、Headers 构造以及响应字段提取策略，实现非标接口归一化。
 * @author KK-Studio Team
 * @version 1.5.2
 */

const querystring = require('querystring');

class OpenAICompatAdapter {
  /**
   * 拼装标准 OpenAI 兼容的 HTTP 请求
   */
  buildRequest(provider, modelId, unifiedPayload) {
    const url = `${provider.base_url.replace(/\/+$/, '')}/chat/completions`;
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
    const content = data?.choices?.[0]?.message?.content;
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
    const content = data?.content || data?.text || data?.message || data?.data?.content;
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
 * 根据协议面标识获取具体的协议适配器
 * @param {string} adapterId 适配器协议 ID
 */
function getAdapter(adapterId) {
  const adapter = adapters[adapterId];
  if (!adapter) {
    throw new Error(`未找到匹配的后端适配器协议面: ${adapterId}`);
  }
  return adapter;
}

module.exports = {
  getAdapter
};
