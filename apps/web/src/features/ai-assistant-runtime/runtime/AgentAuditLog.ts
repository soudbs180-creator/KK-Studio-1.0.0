// 简体中文：工具执行审计日志 (Agent Audit Log)

import type { AgentToolCallLog } from '../../ai-takeover/types.ts';
import { redactToolSummary, toolRegistryInstance } from '../tools/ToolRegistry.ts';

export class AgentAuditLog {
  /**
   * 从注册中心获取最新的所有工具执行记录
   */
  getLogs(): AgentToolCallLog[] {
    return toolRegistryInstance.getLogs();
  }

  /**
   * 记录外部/系统层执行产生的自定义审计记录，并打印日志
   */
  logCall(log: AgentToolCallLog): void {
    console.log(`[AgentAuditLog] [${log.status.toUpperCase()}] 工具: ${log.toolName}, 运行ID: ${log.runId}`);
    if (log.error) {
      console.error(`[AgentAuditLog] 错误详情:`, redactToolSummary(log.error));
    }
  }
}

export const agentAuditLog = new AgentAuditLog();
