/**
 * PPT 大纲多轮 AI 精炼交互逻辑
 * 
 * 资深架构师设计：结合多轮修改指示和当前大纲上下文，
 * 通过大语言模型流式/单次更新大纲 JSON，并保持设计风格一致性。
 * 提供强大的 Partial JSON 自动补齐容错解析，确保极端异常环境下的状态韧性。
 */

import { generateOutlineSystemPrompt } from './pptPrompts';

export interface RefinementHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface OutlineRefinementParams {
  currentOutline: any; // 当前的 PPTOutline 结构
  userRequirement: string; // 用户的修改指令
  history?: RefinementHistoryEntry[]; // 修改历史上下文
  language?: string;
}

/**
 * 组装大纲精炼的 Prompt
 */
export function buildOutlineRefinementPrompt(params: OutlineRefinementParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { currentOutline, userRequirement, history = [], language = '中文' } = params;

  const systemPrompt = `你是一位顶尖的 PPT 大纲重构专家。你的任务是根据用户的“修改指令”，对现有的“当前 PPT 大纲”进行修改和精炼。
  
## 核心规范
- 必须输出严格的 JSON，格式与当前大纲结构完全一致。
- 你只能输出最终的 JSON 对象本身，禁止在外面包裹 Markdown 语法块或输出任何多余的解释。
- 必须高度保持整套 PPT 的设计风格一致性，除非用户明确要求改变风格，否则不要随意修改现有的 styleSpec（视觉风格、色板、字体、布局规范等）。
- 支持对页面进行：增、删、改、重新排序、要点重构。
  
${generateOutlineSystemPrompt({ language })}
`;

  let userPrompt = `【当前 PPT 大纲 JSON】：
${JSON.stringify(currentOutline, null, 2)}
  
【用户的修改指令】：
“${userRequirement}”
`;

  if (history.length > 0) {
    userPrompt += `
    
【之前的修改历史】：
${history.map((entry) => `${entry.role === 'user' ? '用户' : 'AI'}: ${entry.content}`).join('\n')}
`;
  }

  userPrompt += `
  
请直接输出修改后最新的完整 PPT 大纲 JSON：`;

  return { systemPrompt, userPrompt };
}

/**
 * 对未完成或截断的 JSON 串执行括号闭合与修补
 */
export function repairIncrementalJson(jsonStr: string): string {
  let cleaned = jsonStr.trim();
  
  // 提取 JSON 大括号起始位置
  const startIdx = cleaned.indexOf('{');
  if (startIdx === -1) {
    return '{}';
  }
  cleaned = cleaned.slice(startIdx);

  const stack: string[] = [];
  let inString = false;
  let isEscaped = false;
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  let result = cleaned;

  // 1. 如果遍历结束仍处于字符串字面量中，优先闭合双引号
  if (inString) {
    result += '"';
  }

  // 2. 清除悬空或截断的结构字符
  result = result.replace(/,\s*$/, ''); // 清除尾部逗号
  if (result.endsWith(':') || /:\s*$/.test(result)) {
    result = result.replace(/:\s*$/, '');
    result = result.replace(/,\s*[^,]+$/, '');
  }

  // 3. 倒序补全未闭合的括号
  while (stack.length > 0) {
    const openChar = stack.pop();
    if (openChar === '{') {
      result += '}';
    } else if (openChar === '[') {
      result += ']';
    }
  }

  return result;
}

/**
 * 后端 API 提取与容错校验解析器
 */
export function parseRefinedOutline(responseContent: string): any {
  let cleaned = responseContent.trim();
  
  // 剥离 Markdown 语法标记包围
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\s*/, '').replace(/\s*```$/, '');
  }

  // 执行增量/截断 JSON 自动修复
  cleaned = repairIncrementalJson(cleaned);

  try {
    const parsed = JSON.parse(cleaned);
    
    if (!parsed.title) {
      throw new Error("解析失败：大纲缺少 title 字段");
    }
    const pages = parsed.pages || parsed.slides;
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error("解析失败：大纲页面数组 pages 不能为空");
    }

    return {
      title: parsed.title,
      styleSpec: parsed.styleSpec || parsed.style || {},
      pages: pages.map((page: any, index: number) => ({
        layout: page.layout || page.type || 'title-body',
        title: page.title || `第 ${index + 1} 页`,
        subtitle: page.subtitle,
        bullets: Array.isArray(page.bullets) ? page.bullets : (Array.isArray(page.points) ? page.points : []),
        imagePrompt: page.imagePrompt || page.visualPrompt,
        notes: page.notes || page.speakerNotes
      }))
    };
  } catch (error: any) {
    console.error("Failed to parse refined outline:", error);
    throw new Error(`大纲大语言模型返回解析异常：${error.message}`);
  }
}

