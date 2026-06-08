/**
 * @file adapterRegistry.js
 * @module server/lib/dispatcher
 * @description AI Router 协议适配器注册中心。负责把统一 Chat/Image 请求转换为不同供应商协议，
 *              并把响应归一化为统一结果。管理员系统渠道和用户自带 Key 共用这些适配器；
 *              管理员积分计费只包在外层，不影响协议执行。
 * @author KK-Studio Team
 * @version 2.4.0
 */

const querystring = require('querystring');
const { matchProviderProfile } = require('./providerProfiles');

function normalizeBaseUrl(baseUrl, options = {}) {
  let clean = String(baseUrl || '').trim().replace(/\/+$/, '');
  const suffixes = [
    '/v1/chat/completions',
    '/chat/completions',
    '/api/chat/completions',
    '/v1/messages',
    '/messages',
    '/v1beta/models',
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
  if (options.noVersionAppend) return clean;
  if (!/\/v\d+(?:beta)?$/i.test(clean) && !clean.endsWith('/compatible-mode') && !/\/api\/v\d+$/i.test(clean)) {
    return `${clean}/v1`;
  }
  return clean;
}

function normalizeAdapterId(adapterIdOrType, channel = {}) {
  const explicit = String(adapterIdOrType || '').trim().toLowerCase();
  const profile = matchProviderProfile(channel);

  if (explicit && !['auto', 'default', 'openai'].includes(explicit)) {
    if (['custom_form', 'form', 'wuyin_form', 'suchuang_form'].includes(explicit)) return 'custom_form_urlencoded';
    if (['openai_chat', 'openai_compat', 'openai-compatible', 'chat_completions'].includes(explicit)) return 'openai_chat_completions';
    if (['deepseek', 'deepseek_chat', 'deepseek_chat_completions'].includes(explicit)) return 'deepseek_chat_completions';
    if (['anthropic', 'claude', 'claude_messages'].includes(explicit)) return 'anthropic_messages';
    if (['gemini', 'google_gemini', 'generate_content'].includes(explicit)) return 'google_gemini_generate_content';
    if (['apimart', 'apimart_chat', 'apimart_chat_completions'].includes(explicit)) return 'apimart_chat_completions';
    if (['12ai', 'twelveai', '12ai_auto', 'twelveai_auto', 'twelveai_multi_protocol'].includes(explicit)) return 'twelveai_multi_protocol';
    if (['docs_pending', 'docs_pending_adapter'].includes(explicit)) return 'docs_pending_adapter';
    return explicit;
  }

  return profile.adapterId || 'openai_chat_completions';
}

function normalizeMessages(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
      content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''),
    }))
    .filter((message) => message.content.length > 0);
}

function splitSystemPrompt(messages = []) {
  const normalized = normalizeMessages(messages);
  const systemMessages = normalized.filter((message) => message.role === 'system');
  const rest = normalized.filter((message) => message.role !== 'system');
  return {
    systemPrompt: systemMessages.map((message) => message.content).join('\n\n').trim(),
    messages: rest,
  };
}

function normalize12AIOrigin(baseUrl) {
  let clean = String(baseUrl || 'https://cdn.12ai.org').trim().replace(/\/+$/, '');
  clean = clean
    .replace(/\/v1beta\/models$/i, '')
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1\/messages$/i, '')
    .replace(/\/v1$/i, '')
    .replace(/\/v1beta$/i, '')
    .replace(/\/+$/, '');
  return clean || 'https://cdn.12ai.org';
}

function infer12AIProtocol(modelId, unifiedPayload = {}) {
  const explicit = String(unifiedPayload.protocol || unifiedPayload.protocolFamily || unifiedPayload.endpointProtocol || '').trim().toLowerCase();
  if (explicit.includes('gemini')) return 'gemini';
  if (explicit.includes('claude') || explicit.includes('anthropic')) return 'claude';
  if (explicit.includes('openai')) return 'openai';

  const model = String(modelId || '').trim().toLowerCase();
  if (model.startsWith('gemini-')) return 'gemini';
  if (model.startsWith('claude-')) return 'claude';
  return 'openai';
}

class OpenAICompatAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    const baseUrl = normalizeBaseUrl(provider.base_url || 'https://api.openai.com/v1');
    const url = `${baseUrl}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.api_key}`,
    };

    const body = JSON.stringify({
      model: modelId,
      messages: normalizeMessages(unifiedPayload.messages),
      temperature: unifiedPayload.temperature ?? 0.7,
      max_tokens: unifiedPayload.max_tokens,
      stream: unifiedPayload.stream ?? false,
    });

    return { url, method: 'POST', headers, body };
  }

  extractContent(data) {
    const content = data?.choices?.[0]?.message?.content
      || data?.choices?.[0]?.delta?.content
      || data?.output_text
      || data?.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('OpenAI 兼容协议返回空内容');
    }
    return content;
  }
}

class DeepSeekChatCompletionsAdapter extends OpenAICompatAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    let baseUrl = String(provider.base_url || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
    baseUrl = baseUrl
      .replace(/\/v1$/i, '')
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;
    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: normalizeMessages(unifiedPayload.messages),
        temperature: unifiedPayload.temperature ?? 0.7,
        max_tokens: unifiedPayload.max_tokens,
        stream: unifiedPayload.stream ?? false,
      }),
    };
  }
}

class APIMartChatCompletionsAdapter extends OpenAICompatAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    const baseUrl = normalizeBaseUrl(provider.base_url || 'https://api.apimart.ai/v1');
    const url = `${baseUrl}/chat/completions`;
    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: normalizeMessages(unifiedPayload.messages),
        temperature: unifiedPayload.temperature ?? 0.7,
        max_tokens: unifiedPayload.max_tokens,
        stream: unifiedPayload.stream ?? false,
      }),
    };
  }

  extractContent(data) {
    const payload = data?.data && typeof data.data === 'object' ? data.data : data;
    const content = payload?.choices?.[0]?.message?.content
      || payload?.choices?.[0]?.delta?.content
      || payload?.output_text;
    if (typeof content !== 'string' || content.length === 0) {
      const code = data?.code != null ? ` code=${data.code}` : '';
      throw new Error(`APIMart 协议返回空内容或非预期结构。${code}`);
    }
    return content;
  }
}

class AnthropicMessagesAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    const baseUrl = normalizeBaseUrl(provider.base_url || 'https://api.anthropic.com/v1');
    const url = `${baseUrl}/messages`;
    const { systemPrompt, messages } = splitSystemPrompt(unifiedPayload.messages);
    const bodyPayload = {
      model: modelId,
      messages: messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
      max_tokens: unifiedPayload.max_tokens || 4096,
      temperature: unifiedPayload.temperature ?? 0.7,
      stream: unifiedPayload.stream ?? false,
    };
    if (systemPrompt) {
      bodyPayload.system = systemPrompt;
    }

    return {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.api_key,
        'anthropic-version': provider.anthropic_version || '2023-06-01',
      },
      body: JSON.stringify(bodyPayload),
    };
  }

  extractContent(data) {
    const content = Array.isArray(data?.content)
      ? data.content.map((item) => item?.text || '').join('').trim()
      : data?.completion || data?.text;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('Claude Messages 协议返回空内容');
    }
    return content;
  }
}

class GoogleGeminiGenerateContentAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    const baseUrl = normalizeBaseUrl(provider.base_url || 'https://generativelanguage.googleapis.com/v1beta', { noVersionAppend: true });
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(provider.api_key)}`;
    const { systemPrompt, messages } = splitSystemPrompt(unifiedPayload.messages);
    const contents = messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const bodyPayload = {
      contents,
      generationConfig: {
        temperature: unifiedPayload.temperature ?? 0.7,
        maxOutputTokens: unifiedPayload.max_tokens,
      },
    };
    if (systemPrompt) {
      bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    return {
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    };
  }

  extractContent(data) {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content = parts.map((part) => part?.text || '').join('').trim();
    if (!content) {
      throw new Error('Gemini generateContent 协议返回空内容');
    }
    return content;
  }
}

class TwelveAIMultiProtocolAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    const origin = normalize12AIOrigin(provider.base_url || 'https://cdn.12ai.org');
    const protocol = infer12AIProtocol(modelId, unifiedPayload);

    if (protocol === 'gemini') {
      const gemini = new GoogleGeminiGenerateContentAdapter();
      return gemini.buildRequest({
        base_url: `${origin}/v1beta`,
        api_key: provider.api_key,
      }, modelId, unifiedPayload);
    }

    if (protocol === 'claude') {
      const { systemPrompt, messages } = splitSystemPrompt(unifiedPayload.messages);
      const bodyPayload = {
        model: modelId,
        messages: messages.map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content,
        })),
        max_tokens: unifiedPayload.max_tokens || 4096,
        temperature: unifiedPayload.temperature ?? 0.7,
        stream: unifiedPayload.stream ?? false,
      };
      if (systemPrompt) {
        bodyPayload.system = systemPrompt;
      }
      return {
        url: `${origin}/v1/messages`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.api_key}`,
          'anthropic-version': provider.anthropic_version || '2023-06-01',
        },
        body: JSON.stringify(bodyPayload),
      };
    }

    return {
      url: `${origin}/v1/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: normalizeMessages(unifiedPayload.messages),
        temperature: unifiedPayload.temperature ?? 0.7,
        max_tokens: unifiedPayload.max_tokens,
        stream: unifiedPayload.stream ?? false,
      }),
    };
  }

  extractContent(data) {
    const openaiContent = data?.choices?.[0]?.message?.content
      || data?.choices?.[0]?.delta?.content
      || data?.output_text;
    if (typeof openaiContent === 'string' && openaiContent.length > 0) return openaiContent;

    const claudeContent = Array.isArray(data?.content)
      ? data.content.map((item) => item?.text || '').join('').trim()
      : data?.completion || data?.text;
    if (typeof claudeContent === 'string' && claudeContent.length > 0) return claudeContent;

    const geminiParts = data?.candidates?.[0]?.content?.parts || [];
    const geminiContent = geminiParts.map((part) => part?.text || '').join('').trim();
    if (geminiContent) return geminiContent;

    throw new Error('12AI 文档化多协议返回空内容或非预期结构');
  }
}

class CustomFormUrlencodedAdapter {
  buildRequest(provider, modelId, unifiedPayload) {
    const messages = normalizeMessages(unifiedPayload.messages);
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    const content = lastUserMessage ? lastUserMessage.content : unifiedPayload.user_input || '';
    return {
      url: provider.base_url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        'Authorization': provider.api_key,
      },
      body: querystring.stringify({ content, model: modelId, stream: 'false' }),
    };
  }

  extractContent(data) {
    const content = data?.content
      || data?.text
      || data?.message
      || data?.msg
      || data?.data?.content
      || data?.data?.text
      || data?.data?.message
      || data?.data?.answer
      || data?.data?.output;
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('表单自定义协议返回空内容');
    }
    return content;
  }
}

class DocsPendingAdapter {
  buildRequest() {
    throw new Error('该第三方预设缺少可验证的官方接口文档，AI Router 已阻止猜测式请求。请补充官方 endpoint、鉴权方式、请求体和响应结构后再启用。');
  }

  extractContent() {
    throw new Error('该第三方预设缺少可验证的官方接口文档，无法解析响应。');
  }
}

const adapters = {
  openai_chat_completions: new OpenAICompatAdapter(),
  deepseek_chat_completions: new DeepSeekChatCompletionsAdapter(),
  apimart_chat_completions: new APIMartChatCompletionsAdapter(),
  anthropic_messages: new AnthropicMessagesAdapter(),
  google_gemini_generate_content: new GoogleGeminiGenerateContentAdapter(),
  twelveai_multi_protocol: new TwelveAIMultiProtocolAdapter(),
  custom_form_urlencoded: new CustomFormUrlencodedAdapter(),
  docs_pending_adapter: new DocsPendingAdapter(),
};

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
  normalizeBaseUrl,
};
