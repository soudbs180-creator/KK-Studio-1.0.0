/**
 * @file geminiTransport.ts
 * @module apps/web/src/services/providers/transports
 * @description Google Gemini 原生多模态协议传输层。负责按照 Google 官方 generateContent 规范
 *              拼接 REST API 请求路径及拼装 contents/parts 结构体，只专注于协议规范，解耦品牌特判。
 * @author KK-Studio Team
 * @version 1.5.2
 */

import { TransportRequest } from './openaiTransport';

export class GeminiTransport {
  /**
   * 构建原生 Google Gemini generateContent 请求
   * @param baseUrl 接口基础路径 (如 https://generativelanguage.googleapis.com)
   * @param apiKey API 密钥
   * @param unifiedPayload 统一的请求参数
   * @param authMethod 鉴权类型：通过 query 带 key 还是 header 带 x-goog-api-key
   */
  public buildGenerateRequest(
    baseUrl: string,
    apiKey: string,
    unifiedPayload: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
    },
    authMethod: 'query' | 'header' = 'query'
  ): TransportRequest {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    
    // 1. 映射标准 messages 数组为 Gemini 原生 contents/parts 结构
    const contents = unifiedPayload.messages.map(msg => {
      // Gemini 的角色映射：system -> user，assistant -> model
      let role = 'user';
      if (msg.role === 'assistant') {
        role = 'model';
      }
      return {
        role,
        parts: [{ text: msg.content }]
      };
    });

    // 2. 组装请求路径
    let url = `${cleanUrl}/v1beta/models/${unifiedPayload.model}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (authMethod === 'query') {
      url += `?key=${apiKey}`;
    } else {
      headers['x-goog-api-key'] = apiKey;
    }

    const body = JSON.stringify({
      contents,
      generationConfig: {
        temperature: unifiedPayload.temperature ?? 0.7,
        maxOutputTokens: unifiedPayload.max_tokens
      }
    });

    return {
      url,
      method: 'POST',
      headers,
      body
    };
  }
}

export const geminiTransport = new GeminiTransport();
