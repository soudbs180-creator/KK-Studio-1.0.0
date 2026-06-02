// 简体中文：提示词模板匹配评分算法

import type { PromptTemplate } from '../types';

export function matchPromptTemplates(
  input: string,
  templates: PromptTemplate[]
): Array<{ template: PromptTemplate; score: number }> {
  if (!input) return [];
  const lowerInput = input.toLowerCase();

  return templates
    .map(template => {
      let score = 0;
      // 触发词匹配：权重最高，每个加 10 分
      for (const word of template.triggerWords) {
        if (lowerInput.includes(word.toLowerCase())) {
          score += 10;
        }
      }
      // 标签匹配：每个加 5 分
      for (const tag of template.tags) {
        if (lowerInput.includes(tag.toLowerCase())) {
          score += 5;
        }
      }
      // 分类直接命中：加 8 分
      if (lowerInput.includes(template.category.toLowerCase())) {
        score += 8;
      }
      return { template, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
}
