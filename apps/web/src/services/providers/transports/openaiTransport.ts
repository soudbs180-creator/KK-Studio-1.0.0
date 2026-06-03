/**
 * @file openaiTransport.ts
 * @module apps/web/src/services/providers/transports
 * @description 标准 OpenAI 兼容协议传输层。负责按照标准 OpenAI 规范拼装 URL、Headers 和 Payload，
 *              此层纯粹按照协议通信，不夹杂任何特定供应商的品牌逻辑。
 * @author KK-Studio Team
 * @version 1.5.3
 */

export interface TransportRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export class OpenAITransport {
  /**
   * 构建标准的 OpenAI Chat Completions 对话请求
   * @param baseUrl 接口基础路径 (如 https://api.openai.com/v1)
   * @param apiKey API 密钥
   * @param unifiedPayload 统一的请求体内容
   */
  public buildChatRequest(
    baseUrl: string,
    apiKey: string,
    unifiedPayload: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    }
  ): TransportRequest {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const body = JSON.stringify({
      model: unifiedPayload.model,
      messages: unifiedPayload.messages,
      temperature: unifiedPayload.temperature ?? 0.7,
      max_tokens: unifiedPayload.max_tokens,
      stream: unifiedPayload.stream ?? false
    });

    return {
      url,
      method: 'POST',
      headers,
      body
    };
  }

  /**
   * 构建标准的 OpenAI DALL-E 图像生成请求
   */
  public buildImageRequest(
    baseUrl: string,
    apiKey: string,
    unifiedPayload: {
      model: string;
      prompt: string;
      n?: number;
      size?: string;
      quality?: string;
      response_format?: 'url' | 'b64_json';
    }
  ): TransportRequest {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const url = `${cleanUrl}/images/generations`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const body = JSON.stringify({
      model: unifiedPayload.model,
      prompt: unifiedPayload.prompt,
      n: unifiedPayload.n ?? 1,
      size: unifiedPayload.size ?? '1024x1024',
      quality: unifiedPayload.quality ?? 'standard',
      response_format: unifiedPayload.response_format ?? 'b64_json'
    });

    return {
      url,
      method: 'POST',
      headers,
      body
    };
  }
}

export const openaiTransport = new OpenAITransport();
