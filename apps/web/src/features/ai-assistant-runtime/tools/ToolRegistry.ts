// 简体中文：工具注册表与安全等级 (Tool Registry)
// 职责：管理所有 Agent 工具的注册、获取、安全审计与执行日志

import type { ToolPermission, AgentToolCallLog } from '../../ai-takeover/types.ts';

const MAX_TOOL_LOGS = 200;

export interface AgentToolDefinition<Input = any, Output = any> {
  name: string;
  description: string;
  permission: ToolPermission;
  inputSchema: any;
  outputSchema?: any;
  handler: (input: Input, ctx: any) => Promise<Output>;
}

export const redactToolSummary = (value: unknown): string => {
  try {
    return JSON.stringify(value)
      .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer ***')
      .replace(/sk-[a-zA-Z0-9_\-]{8,}/gi, 'sk-***')
      .replace(/[A-Za-z0-9_\-]{48,}/g, '***')
      .slice(0, 500);
  } catch {
    return '[unserializable]';
  }
};

export class AgentToolRegistry {
  private tools = new Map<string, AgentToolDefinition>();
  private logs: AgentToolCallLog[] = [];

  private appendLog(log: AgentToolCallLog): void {
    this.logs.push(log);
    if (this.logs.length > MAX_TOOL_LOGS) {
      this.logs.splice(0, this.logs.length - MAX_TOOL_LOGS);
    }
  }

  register<Input, Output>(tool: AgentToolDefinition<Input, Output>) {
    if (this.tools.has(tool.name)) {
      throw new Error(`工具已注册: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): AgentToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): AgentToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getLogs(): AgentToolCallLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  async execute(name: string, input: any, ctx: any): Promise<any> {
    const tool = this.getTool(name);
    const runId = ctx?.runId || `run_${Date.now()}`;
    const log: AgentToolCallLog = {
      id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      runId,
      toolName: name,
      inputSummary: redactToolSummary(input),
      status: 'success',
      startedAt: new Date().toISOString(),
      idempotencyKey: input?.idempotencyKey
    };

    if (!tool) {
      const errorLog: AgentToolCallLog = {
        ...log,
        status: 'failed',
        error: `未找到工具: ${name}`,
        completedAt: new Date().toISOString()
      };
      this.appendLog(errorLog);
      throw new Error(`未找到工具: ${name}`);
    }

    // 安全隔离校验
    if (tool.permission === 'forbidden') {
      ctx.notify?.error?.('操作被拦截', `出于绝对安全隔离原则，禁止 AI 助手执行该工具: ${name}`);
      const blockedLog: AgentToolCallLog = {
        ...log,
        status: 'blocked',
        error: `Execution forbidden for tool: ${name}`,
        completedAt: new Date().toISOString()
      };
      this.appendLog(blockedLog);
      throw new Error(`Execution forbidden for tool: ${name}`);
    }

    try {
      const output = await tool.handler(input, ctx);
      const successLog: AgentToolCallLog = {
        ...log,
        outputSummary: redactToolSummary(output),
        completedAt: new Date().toISOString()
      };
      this.appendLog(successLog);
      return output;
    } catch (e: any) {
      const safeError = redactToolSummary(e?.message || String(e));
      console.error(`[ToolRegistry] 工具执行异常: ${name}`, safeError);
      const failedLog: AgentToolCallLog = {
        ...log,
        status: 'failed',
        error: safeError,
        completedAt: new Date().toISOString()
      };
      this.appendLog(failedLog);
      throw e;
    }
  }

  registerAlias(name: string, targetName: string, description?: string) {
    if (this.getTool(name)) {
      return;
    }

    const target = this.getTool(targetName);
    if (!target) {
      throw new Error(`无法注册工具别名 ${name}: 目标工具不存在 ${targetName}`);
    }

    this.register({
      ...target,
      name,
      description: description || target.description
    });
  }
}

export const toolRegistryInstance = new AgentToolRegistry();

// 导入具体的子工具数组
import { canvasTools } from './canvasTools.ts';
import { assetTools } from './assetTools.ts';
import { generationTools } from './generationTools.ts';
import { knowledgeTools } from './knowledgeTools.ts';
import { uiTools } from './uiTools.ts';
import { skillTools } from './skillTools.ts';
import { browserTools } from './browserTools.ts';
// 注册所有导入的工具
[
  ...canvasTools,
  ...assetTools,
  ...generationTools,
  ...knowledgeTools,
  ...uiTools,
  ...skillTools,
  ...browserTools
].forEach(tool => {
  toolRegistryInstance.register(tool);
});

// 注册特殊机制工具
toolRegistryInstance.register({
  name: 'fillApiKey',
  description: '出于绝对安全隔离原则，禁止 AI 自动填写密钥',
  permission: 'forbidden',
  inputSchema: {},
  handler: async () => {}
});

toolRegistryInstance.register({
  name: 'optimizePromptLocally',
  description: '在本地对用户的提示词进行模板匹配与效果词强化润色',
  permission: 'safe',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '提示词绘图主体' },
      style: { type: 'string', description: '附加画风说明' }
    },
    required: ['subject']
  },
  handler: async () => {}
});

// 注册别名机制
toolRegistryInstance.registerAlias('canvas.locateNodes', 'locateCard');
toolRegistryInstance.registerAlias('ui.highlightElement', 'highlightElement');
toolRegistryInstance.registerAlias('ui.locateApiCard', 'locateApiCard');
toolRegistryInstance.registerAlias('ui.openSettings', 'openSettings');
toolRegistryInstance.registerAlias('navigateToSurface', 'ui.navigateToSurface');
toolRegistryInstance.registerAlias('assets.zipOriginals', 'zipOutputs');
toolRegistryInstance.registerAlias('generation.start', 'startGeneration');
toolRegistryInstance.registerAlias('generation.createBatchJob', 'startBatchGeneration');
toolRegistryInstance.registerAlias('generation.cancelJob', 'cancelBatchGeneration');
toolRegistryInstance.registerAlias('generation.submitComposer', 'submitPromptComposer');
toolRegistryInstance.registerAlias('prompt.fillPrompt', 'fillPrompt');
toolRegistryInstance.registerAlias('prompt.optimizeInput', 'fillInputPrompt');
toolRegistryInstance.registerAlias('getModelCapabilities', 'provider.getModelCapabilities');

// 导出兼容旧的大模型工具结构
export const TOOL_REGISTRY = toolRegistryInstance.getAllTools().map(t => ({
  name: t.name,
  description: t.description,
  permission: t.permission,
  schema: t.inputSchema
}));

export const getToolRegistrySchemas = () => TOOL_REGISTRY;
