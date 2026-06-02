// 简体中文：本地提示词润色与模板拼接引擎

import { PromptTemplate } from '../types';

export interface OptimizedPromptResult {
  optimizedPromptEn: string;
  optimizedPromptZh: string;
}

/**
 * 本地提示词润色规则
 * 拼接主体、匹配到的模板变量，并注入辅助修饰词 (Boosters)
 */
export function optimizePromptLocally(
  userInput: string,
  matchedTemplate?: PromptTemplate,
  extraStyle?: string
): OptimizedPromptResult {
  // 如果没有匹配到模板，我们使用一个基础的通用高质量视觉渲染框架
  if (!matchedTemplate) {
    const cleanSubject = userInput
      .replace(/(帮我)?(优化提示词|优化|改提示词|润色|整理提示词|提示词怎么写|只要提示词)[:：]?/g, '')
      .trim() || 'a majestic scenery';

    const defaultPromptEn = `${cleanSubject}, highly detailed, digital painting style, sharp focus, 8k resolution, cinematic lighting, dramatic atmosphere.`;
    const defaultPromptZh = `「${cleanSubject}」的高清写实数字绘画，融入了电影感光影、锐利对焦和大气氛围渲染。`;

    return {
      optimizedPromptEn: defaultPromptEn,
      optimizedPromptZh: defaultPromptZh
    };
  }

  // 提取用户真实主体：去除触发词及命令词
  let subject = userInput;
  for (const word of matchedTemplate.triggerWords) {
    subject = subject.replace(word, '');
  }
  subject = subject
    .replace(/(帮我)?(优化提示词|优化|改提示词|润色|整理提示词|提示词怎么写|只要提示词|一幅|一张|一个)[:：]?/g, '')
    .trim();

  if (!subject) {
    // 如果过滤后为空，从变量默认值或模板名称里取一个
    const subjectVar = matchedTemplate.variables.find(v => v.key === 'subject');
    subject = subjectVar?.defaultValue || matchedTemplate.name;
  }

  // 开始变量替换
  let finalPrompt = matchedTemplate.basePrompt;
  
  // 替换 {subject}
  finalPrompt = finalPrompt.replace('{subject}', subject);
  
  // 替换 {style}
  const styleVar = matchedTemplate.variables.find(v => v.key === 'style');
  const styleValue = extraStyle || styleVar?.defaultValue || '';
  finalPrompt = finalPrompt.replace('{style}', styleValue);

  // 拼接修饰语 (Boosters)
  const boosters = [
    ...matchedTemplate.styleBoosters,
    ...matchedTemplate.qualityBoosters,
    ...matchedTemplate.compositionBoosters
  ];

  if (boosters.length > 0) {
    finalPrompt = `${finalPrompt.trim().replace(/\.$/, '')}, ${boosters.join(', ')}.`;
  }

  // 移除多余的连续逗号与空格
  finalPrompt = finalPrompt.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();

  // 构造中文解释说明
  const categoryNames: Record<string, string> = {
    portrait: '人像肖像',
    anime: '二次元动漫',
    ecommerce: '商业电商',
    mecha: '科幻机甲'
  };
  const categoryLabel = categoryNames[matchedTemplate.category] || matchedTemplate.category;
  
  const optimizedPromptZh = `基于预置的【${matchedTemplate.name}】模板为您精心润色的英文提示词。主体已设为「${subject}」，画风为【${categoryLabel}】模式，并追加了以下修饰：光影助推（${matchedTemplate.styleBoosters[0] || '无'}）、细节强化（${matchedTemplate.qualityBoosters[0] || '无'}）及视距构图（${matchedTemplate.compositionBoosters[0] || '无'}）。`;

  return {
    optimizedPromptEn: finalPrompt,
    optimizedPromptZh
  };
}
