import { generationService } from './generationService';

// 导出原本 geminiService 提供的独立函数
export const generateImage = generationService.generateImage.bind(generationService);
export const cancelGeneration = generationService.cancelGeneration.bind(generationService);
export const normalizeProxyBaseUrl = generationService.normalizeProxyBaseUrl.bind(generationService);
export type { GenerateImageResult } from './generationService';

// 为了向前兼容，导出 llmService 指向 generationService
export const llmService = generationService;
export { GenerationService as LLMService } from './generationService';
