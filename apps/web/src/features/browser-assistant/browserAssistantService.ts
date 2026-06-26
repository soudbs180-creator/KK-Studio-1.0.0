import type { BrowserTaskIntent, BrowserTaskResult } from './browserAssistantTypes';
import { browserTaskPlanner } from './browserTaskPlanner';
import { siteRegistry } from './siteRegistry';
import { browserActionRouter } from './browserActionRouter';
import { browserResultMapper } from './browserResultMapper';
import { opencliClient } from './opencli/opencliClient';
import { opencliPermissionPolicy } from './opencli/opencliPermissionPolicy';
import { opencliHealthCheck } from './opencli/opencliHealthCheck';

export interface TaskExecutionCallback {
  onConfirmRequired: (intent: BrowserTaskIntent, confirm: () => void, cancel: () => void) => void;
  onStatusUpdate: (result: BrowserTaskResult) => void;
}

// 简体中文：浏览器助手 Hub 顶层总服务层 (Browser Assistant Service)
export class BrowserAssistantService {
  private activeTasks: Map<string, BrowserTaskResult> = new Map();
  private callbacks?: TaskExecutionCallback;

  public setCallbacks(callbacks: TaskExecutionCallback) {
    this.callbacks = callbacks;
  }

  public async runTask(userText: string): Promise<BrowserTaskResult> {
    // 1. 任务规划解析
    const intent = browserTaskPlanner.plan(userText);
    const initialResult: BrowserTaskResult = {
      status: 'pending',
      siteId: intent.targetSite,
      actionType: intent.actionType
    };
    this.activeTasks.set(intent.taskId, initialResult);
    this.notifyUpdate(intent.taskId, initialResult);

    // 2. 检验本地 local-runner 健康度
    const health = await opencliHealthCheck.check();
    if (!health.ok && intent.requiresLogin) {
      const failResult: BrowserTaskResult = {
        ...initialResult,
        status: 'failed',
        error: `本地 Local Runner 守护服务未开启，无法执行需要会员登录的动作。`
      };
      this.activeTasks.set(intent.taskId, failResult);
      this.notifyUpdate(intent.taskId, failResult);
      return failResult;
    }

    // 3. 路由安全研判
    const isMobile = typeof window !== 'undefined' && /mobile|android|iphone/i.test(navigator.userAgent);
    const routing = await browserActionRouter.route(intent, { isMobile, localRunnerAvailable: health.ok });
    
    if (!routing.allowed) {
      const blockResult: BrowserTaskResult = {
        ...initialResult,
        status: 'failed',
        error: routing.reason
      };
      this.activeTasks.set(intent.taskId, blockResult);
      this.notifyUpdate(intent.taskId, blockResult);
      return blockResult;
    }

    // 4. 判断中高风险任务是否需弹窗逐次确认
    if (routing.requiresConfirm && this.callbacks) {
      return new Promise<BrowserTaskResult>((resolve) => {
        this.callbacks!.onConfirmRequired(
          intent,
          async () => {
            // 用户点击确认，继续执行
            const executeResult = await this.executeAction(intent);
            resolve(executeResult);
          },
          () => {
            // 用户取消
            const cancelResult: BrowserTaskResult = {
              ...initialResult,
              status: 'cancelled',
              error: '用户取消了本次浏览器自动化授权。'
            };
            this.activeTasks.set(intent.taskId, cancelResult);
            this.notifyUpdate(intent.taskId, cancelResult);
            resolve(cancelResult);
          }
        );
      });
    }

    // 低风险动作直接自动执行
    return this.executeAction(intent);
  }

  private async executeAction(intent: BrowserTaskIntent): Promise<BrowserTaskResult> {
    const initialResult = this.activeTasks.get(intent.taskId)!;
    try {
      // 5. 校验 OpenCLI 策略限制 (防止 shell 注入或越界)
      const allowed = opencliPermissionPolicy.validateIntent(intent);
      if (!allowed) {
        throw new Error(`OpenCLI 安全规则拦截了该动作: ${intent.actionType}`);
      }

      // 6. 查找对应适配器并执行
      const adapter = siteRegistry.matchAdapter(intent.targetUrl || intent.targetSite);
      
      let res: any;
      if (intent.actionType === 'search' && adapter.search) {
        res = await adapter.search({ intent, opencli: opencliClient });
      } else if (intent.actionType === 'extract' && adapter.extract) {
        res = await adapter.extract({ intent, opencli: opencliClient });
      } else if (intent.actionType === 'generate-image' && adapter.generate) {
        res = await adapter.generate({ intent, opencli: opencliClient });
      } else if (intent.actionType === 'generate-text' && adapter.generate) {
        res = await adapter.generate({ intent, opencli: opencliClient });
      } else if (intent.actionType === 'download' && adapter.download) {
        res = await adapter.download({ intent, opencli: opencliClient });
      } else {
        // Fallback 到 generic 动作，主要是打开与截图
        res = await opencliClient.execute({
          kind: 'inspect_page',
          target: intent.targetUrl || 'about:blank',
          payload: { action: intent.actionType }
        });
      }

      // 7. 解析结构化结果
      const finalResult: BrowserTaskResult = {
        status: 'success',
        siteId: intent.targetSite,
        actionType: intent.actionType,
        extractedText: res?.text || res?.summary || res?.data?.extractedText || '',
        extractedImages: res?.images || res?.data?.extractedImages || [],
        screenshotUrl: res?.screenshotUrl || res?.data?.screenshotUrl || '',
        generatedAssets: res?.assets || res?.data?.generatedAssets || [],
        auditLogId: res?.id || `audit_${Date.now()}`
      };

      this.activeTasks.set(intent.taskId, finalResult);
      this.notifyUpdate(intent.taskId, finalResult);

      // 8. 导入 Canvas 画布
      browserResultMapper.mapToCanvas(finalResult);

      return finalResult;
    } catch (e: any) {
      const errResult: BrowserTaskResult = {
        ...initialResult,
        status: 'failed',
        error: e?.message || '执行过程遭遇未知错误'
      };
      this.activeTasks.set(intent.taskId, errResult);
      this.notifyUpdate(intent.taskId, errResult);
      return errResult;
    }
  }

  private notifyUpdate(taskId: string, result: BrowserTaskResult) {
    if (this.callbacks) {
      this.callbacks.onStatusUpdate({
        ...result,
        auditLogId: result.auditLogId || taskId
      });
    }
  }

  public getTasks(): BrowserTaskResult[] {
    return Array.from(this.activeTasks.values());
  }
}

export const browserAssistantService = new BrowserAssistantService();
