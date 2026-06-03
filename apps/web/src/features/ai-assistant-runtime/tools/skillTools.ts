// 简体中文：Skills管理相关的 AI 助手工具 (Skill Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { knowledgeStore } from '../knowledge/KnowledgeStore.ts';

export const skillTools: AgentToolDefinition[] = [
  // 1. skills.upsertSkill - 新增或更新项目内 Agent Skill / Runbook
  {
    name: 'skills.upsertSkill',
    description: '新增或更新项目内 Agent Skill / Runbook 的脱敏 projection 记录',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        trigger: { type: 'string' },
        tools: { type: 'array', items: { type: 'string' } },
        steps: { type: 'array', items: { type: 'string' } },
        safety: { type: 'array', items: { type: 'string' } },
        validation: { type: 'array', items: { type: 'string' } },
        knowledgeUpdates: { type: 'array', items: { type: 'string' } }
      },
      required: ['name', 'trigger', 'tools']
    },
    handler: async (input: any) => knowledgeStore.upsertSkill(input)
  }
];
