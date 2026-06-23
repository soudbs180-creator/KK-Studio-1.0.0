// 简体中文：Agent 权限与安全策略评估层 (Agent Permission Policy)
// 职责：桥接至接管子系统中的物理安全与二次确认策略，消灭重复的规则定义。

import type { AssistantAction, AssistantPlan, SanitizedProjectContext } from '../../ai-takeover/types.ts';
import { safetyPolicy } from '../../ai-takeover/core/safetyPolicy.ts';
import { confirmationPolicy } from '../../ai-takeover/core/confirmationPolicy.ts';

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ConfirmationDetails {
  required: boolean;
  title: string;
  summary: string;
  confirmText: string;
  cancelText: string;
  metadata?: {
    taskType: string;
    source: string;
    imageCount: number;
    promptStrategy: string;
    useReference: boolean;
    expectedOutputs: number;
    requiresCredits: boolean;
    willUpload: boolean;
  };
}

export class AgentPermissionPolicy {
  /**
   * 评估单个动作的安全合法性（代理至 ai-takeover 核心物理安全策略）
   */
  evaluateSafety(action: AssistantAction): SafetyCheckResult {
    return safetyPolicy.evaluate(action);
  }

  /**
   * 评估动作列表是否需要用户强确认（代理至 ai-takeover 二次确认策略）
   */
  evaluateConfirmation(plan: AssistantPlan, context: SanitizedProjectContext): ConfirmationDetails {
    return confirmationPolicy.evaluate(plan, context) as ConfirmationDetails;
  }
}

export const agentPermissionPolicy = new AgentPermissionPolicy();
