import type { EcommerceAnalysisResult } from './types';
import { keyManager } from '../auth/keyManager';

type LlmServiceModule = typeof import('../llm/generationService');

const chatWithLlm: LlmServiceModule['generationService']['chat'] = async (...args) => {
  const { generationService: runtimeLlmService } = await import('../llm/generationService');
  return runtimeLlmService.chat(...args);
};

export interface ProductImageInlineData {
  mimeType: string;
  data: string;
}

interface AIProductAnalysis {
  productDescription?: string;
  materials?: string[];
  colorPalette?: string[];
  sellingPoints?: string[];
  suggestedBackground?: string;
  suggestedAngle?: string;
}

const ANALYSIS_SYSTEM_PROMPT = `你是一个电商视觉分析助手。用户会上传产品图片和电商需求信息。
请分析产品图片，返回以下 JSON 格式的结果：
{
  "productDescription": "产品的简洁描述（材质、形态、颜色、品类）",
  "materials": ["主要材质列表"],
  "colorPalette": ["产品主色调列表，如 #FFFFFF 白色"],
  "sellingPoints": ["从图片中可识别的产品卖点"],
  "suggestedBackground": "建议的背景风格",
  "suggestedAngle": "建议的拍摄角度"
}
只返回 JSON，不要其他文字。`;

function pickAnalysisModel(): string | null {
  const models = keyManager.getGlobalModelList()
    .filter((model) => model.type === 'chat' && !model.isSystemInternal);
  if (models.length === 0) return null;
  const preferred = models.find((m) => m.id.toLowerCase().includes('gemini-2.5-flash'));
  return preferred ? preferred.id : models[0].id;
}

function extractJson(text: string): any {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function enrichPromptDraft(original: string, ai: AIProductAnalysis): string {
  const additions: string[] = [];
  if (ai.productDescription) {
    additions.push(`产品识别：${ai.productDescription}`);
  }
  if (ai.materials?.length) {
    additions.push(`材质：${ai.materials.join('、')}`);
  }
  if (ai.colorPalette?.length) {
    additions.push(`主色调：${ai.colorPalette.join('、')}`);
  }
  if (ai.sellingPoints?.length) {
    additions.push(`卖点提炼：${ai.sellingPoints.join('；')}`);
  }
  if (ai.suggestedBackground) {
    additions.push(`建议背景：${ai.suggestedBackground}`);
  }
  if (additions.length === 0) return original;
  return `${original}\n\nAI 辅助识别：\n${additions.map((a) => `- ${a}`).join('\n')}`;
}

export async function enhanceAnalysisWithAI(
  analysis: EcommerceAnalysisResult,
  productImages: ProductImageInlineData[],
): Promise<EcommerceAnalysisResult> {
  if (productImages.length === 0) return analysis;

  const modelId = pickAnalysisModel();
  if (!modelId) return analysis;

  let aiResult: AIProductAnalysis;
  try {
    const userMessage = [
      `产品名称：${analysis.projectMeta.productName || '未知'}`,
      `需求名称：${analysis.projectMeta.projectName || '未知'}`,
      `主图数量：${analysis.mainImageItems.length}`,
      `A+模块数量：${analysis.aPlusGroup.modules.length}`,
      '请分析上传的产品图片，识别产品特征并返回 JSON。',
    ].join('\n');

    const raw = await chatWithLlm({
      modelId,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      inlineData: productImages,
      stream: false,
      maxTokens: 1200,
      temperature: 0.15,
    });

    const parsed = extractJson(raw);
    if (!parsed) return analysis;
    aiResult = parsed as AIProductAnalysis;
  } catch (error) {
    console.warn('[ecommerce-enhancer] AI analysis failed, using template analysis', error);
    return analysis;
  }

  const enhancedMainItems = analysis.mainImageItems.map((item) => ({
    ...item,
    promptDraft: enrichPromptDraft(item.promptDraft, aiResult),
    resolvedPromptPreview: item.resolvedPromptPreview
      ? enrichPromptDraft(item.resolvedPromptPreview, aiResult)
      : undefined,
  }));

  const enhancedModules = analysis.aPlusGroup.modules.map((mod) => ({
    ...mod,
    promptDraft: enrichPromptDraft(mod.promptDraft, aiResult),
    resolvedPromptPreview: mod.resolvedPromptPreview
      ? enrichPromptDraft(mod.resolvedPromptPreview, aiResult)
      : undefined,
  }));

  return {
    ...analysis,
    mainImageItems: enhancedMainItems,
    aPlusGroup: {
      ...analysis.aPlusGroup,
      modules: enhancedModules,
    },
  };
}
