// 简体中文：Agent 核心运行时协调器 (Agent Runtime)

import type { SanitizedProjectContext, AssistantPlan, AssistantAction, AgentToolCallLog } from '../../ai-takeover/types.ts';
import { LocalAssistantBrain } from '../../ai-takeover/core/localBrain.ts';
import { LLMBrain } from '../../ai-takeover/core/llmBrain.ts';
import { agentPermissionPolicy } from './AgentPermissionPolicy.ts';
import { agentRunStore } from './AgentRunStore.ts';
import type { AgentRunRecord } from './AgentRunStore.ts';
import { toolRegistryInstance } from '../tools/ToolRegistry.ts';
import { writeHandoff } from '../memory/handoffWriter.ts';

const localBrain = new LocalAssistantBrain();
const llmBrain = new LLMBrain();

export class AgentRuntime {
  /**
   * 提交自然语言指令，通过规划、安全评估、确认拦截，生成运行记录
   */
  async run(
    text: string, 
    context: SanitizedProjectContext, 
    modelId?: string,
    executorContext?: any
  ): Promise<AgentRunRecord> {
    const apiKeyStatus = context.settings.apiKeyStatus;
    let plan: AssistantPlan;

    // 1. 先走本地快速判定：设置跳转、发送、建卡、低风险动作都应尽量本地直达。
    const localPlan = await localBrain.plan(text, context);
    const shouldFallbackToLLM = apiKeyStatus !== 'missing' && localPlan.intent === 'unknown';

    if (shouldFallbackToLLM) {
      try {
        plan = await llmBrain.plan(text, context, modelId);
      } catch (err) {
        console.warn('[AgentRuntime] 云端规划器异常，自动平滑回退到 LocalBrain:', err);
        plan = localPlan;
      }
    } else {
      plan = localPlan;
    }

    // 2. 执行物理安全过滤评估
    let isBlocked = false;
    let blockReason = '';
    const safeActions: AssistantAction[] = [];
    for (const action of plan.actions || []) {
      const safetyCheck = agentPermissionPolicy.evaluateSafety(action);
      if (!safetyCheck.allowed) {
        isBlocked = true;
        blockReason = safetyCheck.reason || '该操作不允许由 AI 助手执行。';
        // 安全拦截，重写计划与答复
        plan = {
          ...plan,
          reply: `⚠️ **安全策略拦截通知**\n${blockReason}`,
          actions: [],
          requiresConfirmation: false,
          confirmation: undefined
        };
        break;
      }
      safeActions.push(action);
    }
    plan.actions = safeActions;

    // 3. 执行确认层策略评估
    const confirmation = agentPermissionPolicy.evaluateConfirmation(plan, context);
    if (confirmation.required) {
      plan.requiresConfirmation = true;
      plan.confirmation = confirmation;
    }

    // 4. 新增运行记录入库持久化 (localStorage cache)
    const record = agentRunStore.createRun(text, plan.intent, plan);
    
    if (isBlocked) {
      agentRunStore.updateRun(record.id, {
        status: 'failed',
        nextStep: `安全拦截: ${blockReason}`
      });
      const updated = agentRunStore.getRun(record.id)!;
      void writeHandoff(updated);
    } else if (!plan.requiresConfirmation && executorContext) {
      // 方案 A：立即异步拉起执行以让状态流转，避免只停在 waiting_execution 阶段而没有实际工具执行
      Promise.resolve().then(async () => {
        try {
          await this.executePendingRun(record.id, executorContext);
        } catch (err) {
          console.error('[AgentRuntime] Auto-execution of plan failed:', err);
        }
      });
    }

    // 如果需要后端权威同步，此处可以发送异步请求，但不阻塞前台
    this.syncRunToBackend(agentRunStore.getRun(record.id)!);

    return agentRunStore.getRun(record.id)!;
  }

  /**
   * 用户点击“确认”后，正式执行运行记录中的所有动作
   */
  async executePendingRun(runId: string, executorContext: any): Promise<void> {
    const record = agentRunStore.getRun(runId);
    if (!record) {
      throw new Error(`未找到待执行的运行记录: ${runId}`);
    }

    if (record.status !== 'waiting_confirmation' && record.status !== 'waiting_execution' && record.status !== 'running') {
      return;
    }

    agentRunStore.updateRun(runId, { status: 'running' });
    this.syncRunToBackend(agentRunStore.getRun(runId)!);

    const plan: AssistantPlan = record.plan;
    const toolCallsLogs: AgentToolCallLog[] = [];

    try {
      for (const action of plan.actions) {
        const toolName = action.type;
        // 支持传统 action payload 的工具映射
        const payload = (action as any).payload || {};
        
        // 绑定 runId 到 executor 上下文
        const runCtx = {
          ...executorContext,
          runId
        };

        const output = await toolRegistryInstance.execute(toolName, payload, runCtx);
        
        // 获取刚刚追加的审计日志
        const latestLogs = toolRegistryInstance.getLogs();
        const callLog = latestLogs[latestLogs.length - 1];
        if (callLog) {
          toolCallsLogs.push(callLog);
        }
      }

      const updated = agentRunStore.updateRun(runId, { 
        status: 'completed',
        toolCalls: toolCallsLogs
      });
      void writeHandoff(updated);
    } catch (e: any) {
      const updated = agentRunStore.updateRun(runId, { 
        status: 'failed',
        toolCalls: toolCallsLogs,
        nextStep: `执行失败，错误原因: ${e?.message || String(e)}`
      });
      void writeHandoff(updated);
      throw e;
    } finally {
      this.syncRunToBackend(agentRunStore.getRun(runId)!);
    }
  }

  /**
   * 用户取消执行挂起的计划
   */
  async cancelPendingRun(runId: string): Promise<void> {
    const record = agentRunStore.getRun(runId);
    if (!record) return;

    const updated = agentRunStore.updateRun(runId, { status: 'cancelled' });
    this.syncRunToBackend(updated);
    void writeHandoff(updated);
  }

  /**
   * 与后端同步运行状态（如果有可用后端 API）
   */
  private async syncRunToBackend(record: AgentRunRecord) {
    try {
      // 优雅检测后端，如果有的话进行 sync 权威入库
      const response = await fetch('/api/ai-assistant/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (!response.ok) {
        // 静默失败，仅做 localStorage cache 即可
      }
    } catch {
      // 静默失败，降级不干扰前台运行
    }
  }
}

export const agentRuntimeInstance = new AgentRuntime();
