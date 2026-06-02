// 简体中文：安全拦截与过滤策略 (Safety Policy)

import { AssistantAction } from '../types';

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 物理拦截 API 密钥相关的任何敏感操纵
 */
export const safetyPolicy = {
  evaluate(action: AssistantAction): SafetyCheckResult {
    // 1. 禁止代填或拦截修改 API 密钥
    if (action.type === 'fillPrompt' && action.payload.prompt.toLowerCase().includes('sk-')) {
      return {
        allowed: false,
        reason: '出于安全原因，禁止向提示词中注入或填写 API 密钥（如 sk- 等开头特征串）。'
      };
    }

    // 2. 拦截可能由 LLM 自定义返回的危险行为
    const actionType = action.type as string;
    if (
      actionType === 'fillApiKey' ||
      actionType === 'readApiKey' ||
      actionType === 'uploadApiKey' ||
      actionType === 'logCredentials'
    ) {
      return {
        allowed: false,
        reason: `检测到受限的敏感工具调用 [${actionType}]。AI 接管系统永远不允许读取、填写或上传您的私密密钥。`
      };
    }

    return { allowed: true };
  }
};
