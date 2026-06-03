// 简体中文：上下文 Token 估算与模型容量限制配置工具类

/**
 * 粗略估算字符串占用的 Token 数量
 * 中文字符每个估算为 1.2 个 token，其它字符（包括英文、空格、标点）每个估算为 0.3 个 token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // 匹配所有中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.2 + otherChars * 0.3);
}

export interface ContextLimitInfo {
  maxTokens: number;
  supportsCompression: boolean;
  label: string;
}

/**
 * 根据模型 ID 获取其上下文容量限制及是否支持内置压缩等信息
 */
export function getModelContextLimit(modelId: string = ''): ContextLimitInfo {
  const id = modelId.toLowerCase();

  // 1. 谷歌 Gemini 系列（以超大上下文容量著称）
  if (id.includes('gemini-2.5-pro') || id.includes('gemini-3-pro') || id.includes('gemini-1.5-pro')) {
    return { maxTokens: 2000000, supportsCompression: true, label: '2M' };
  }
  if (
    id.includes('gemini-2.5-flash') ||
    id.includes('gemini-3.1-flash') ||
    id.includes('gemini-1.5-flash') ||
    id.includes('gemini') ||
    id.includes('nano-banana')
  ) {
    return { maxTokens: 1000000, supportsCompression: true, label: '1M' };
  }

  // 2. OpenAI GPT 系列
  if (id.includes('gpt-4o') || id.includes('gpt-4') || id.includes('o1') || id.includes('o3')) {
    return { maxTokens: 128000, supportsCompression: false, label: '128k' };
  }

  // 3. Anthropic Claude 系列
  if (id.includes('claude-3-5') || id.includes('claude')) {
    return { maxTokens: 200000, supportsCompression: false, label: '200k' };
  }

  // 4. 多媒体生成模型 (Suno/Udio/Imagen/Veo 等)
  if (
    id.includes('suno') ||
    id.includes('udio') ||
    id.includes('imagen') ||
    id.includes('veo') ||
    id.includes('flux') ||
    id.includes('kling') ||
    id.includes('runway')
  ) {
    return { maxTokens: 8000, supportsCompression: false, label: '8k' };
  }

  // 5. 默认兜底限制
  return { maxTokens: 100000, supportsCompression: false, label: '100k' };
}
