/**
 * @deprecated 建议直接使用 './adminModelService' 中的相关方法。
 * 本文件仅为了向前兼容，将所有调用代理分流至 adminModelService 对应的 Unified 方法。
 */
import { adminModelService, type ModelType, type UnifiedModel } from './adminModelService';

export type { ModelType, UnifiedModel };

class UnifiedModelService {
  async initialize(): Promise<void> {
    return adminModelService.initializeUnifiedModels();
  }

  async refreshModels(): Promise<void> {
    return adminModelService.refreshUnifiedModels();
  }

  getModels(): UnifiedModel[] {
    return adminModelService.getUnifiedModels();
  }

  getModelsByType(type: ModelType): UnifiedModel[] {
    return adminModelService.getUnifiedModelsByType(type);
  }

  getModel(id: string): UnifiedModel | undefined {
    return adminModelService.getUnifiedModel(id);
  }

  isCreditBasedModel(id: string): boolean {
    return adminModelService.isCreditBasedModel(id);
  }

  getCreditCost(id: string): number {
    return adminModelService.getUnifiedCreditCost(id);
  }

  getModelColors(id: string): { start: string; end: string } | null {
    return adminModelService.getUnifiedModelColors(id);
  }

  subscribe(callback: () => void): () => void {
    return adminModelService.subscribe(callback);
  }
}

export const unifiedModelService = new UnifiedModelService();
