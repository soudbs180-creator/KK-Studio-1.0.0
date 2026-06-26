import type { BrowserTaskIntent, BrowserTaskResult } from './browserAssistantTypes';
import { SITE_CAPABILITY_MATRIX } from './siteCapabilityMatrix';
import { providerRouteEngine } from '../generation/providerRouteEngine';

// 简体中文：网页助手动作执行路由中心 (Browser Action Router)
export class BrowserActionRouter {
  public async route(intent: BrowserTaskIntent, ctx: any): Promise<{
    allowed: boolean;
    requiresConfirm: boolean;
    reason: string;
    routeMode?: string;
  }> {
    const cap = SITE_CAPABILITY_MATRIX[intent.targetSite];
    if (!cap) {
      return {
        allowed: false,
        requiresConfirm: false,
        reason: `未识别该站点的能力配置: ${intent.targetSite}`
      };
    }

    if (cap.executionMode === 'disabled') {
      return {
        allowed: false,
        requiresConfirm: false,
        reason: `站点已禁用: ${cap.name}`
      };
    }

    // 1. 移动端安全边界校验
    const isMobile = ctx?.isMobile || false;
    if (isMobile && cap.quotaSource === 'user-membership') {
      return {
        allowed: false,
        requiresConfirm: false,
        reason: `网页会员能力 (${cap.name}) 只能在桌面端本地浏览器执行，移动端不支持该模式。`
      };
    }

    // 2. 判断是否是生成任务，如果是，走 ProviderRouteEngine 评估
    if (intent.actionType === 'generate-image' || intent.actionType === 'generate-text') {
      const decision = await providerRouteEngine.decideRoute({
        modelId: intent.targetSite === 'chatgpt' ? 'gpt-4o' : 'gemini-1.5-flash',
        taskType: intent.actionType === 'generate-image' ? 'image' : 'text',
        preferredKeyId: `web-provider:${intent.targetSite}`
      });

      if (decision.mode === 'user-owned-web-provider' || decision.mode === 'browser-assistant-opencli') {
        return {
          allowed: true,
          requiresConfirm: cap.requiresConfirmation || cap.riskLevel !== 'low',
          routeMode: decision.mode,
          reason: `路由引擎决策: ${decision.reason}`
        };
      }
    }

    // 3. 普通动作（搜寻、提取、截图等）的安全级研判
    const requiresConfirm = cap.requiresConfirmation || cap.riskLevel === 'high' || cap.riskLevel === 'medium';
    return {
      allowed: true,
      requiresConfirm,
      routeMode: cap.executionMode,
      reason: `采用常规执行模式: ${cap.executionMode}`
    };
  }
}

export const browserActionRouter = new BrowserActionRouter();
