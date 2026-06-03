// 简体中文：项目知识库相关的 AI 助手工具 (Knowledge Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { knowledgeStore } from '../knowledge/KnowledgeStore.ts';

export const knowledgeTools: AgentToolDefinition[] = [
  // 1. knowledge.searchProject - 搜索项目知识库
  {
    name: 'knowledge.searchProject',
    description: '搜索 AI 助手项目知识库、近期变更、UI 变更和项目 Skills',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        limit: { type: 'number', description: '最大返回数量' }
      },
      required: ['query']
    },
    handler: async (input: { query: string; limit?: number }) => ({
      results: knowledgeStore.searchProject(input.query, input.limit)
    })
  },

  // 2. knowledge.recordChange - 记录变更摘要
  {
    name: 'knowledge.recordChange',
    description: '记录已验证的助手、画布、生成、下载或知识库变更摘要；仅写入脱敏 projection/cache',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        source: { type: 'string' },
        paths: { type: 'array', items: { type: 'string' } },
        affectedModules: { type: 'array', items: { type: 'string' } },
        tools: { type: 'array', items: { type: 'string' } },
        validation: { type: 'array', items: { type: 'string' } },
        deprecatedBehavior: { type: 'string' },
        nextAgentInstruction: { type: 'string' }
      },
      required: ['title', 'summary']
    },
    handler: async (input: any) => knowledgeStore.recordChange(input)
  }
];
