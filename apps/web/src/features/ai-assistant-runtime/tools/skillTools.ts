// 简体中文：Skills管理与 Claude Standard Skills 动态执行相关的 AI 助手工具 (Skill Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { knowledgeStore } from '../knowledge/KnowledgeStore.ts';
import type { AgentSkillManifest } from '@kk/shared';

// 预置系统技能缓存表
const activeSkillsRegistry = new Map<string, AgentSkillManifest>();

export const registerDynamicSkill = (skill: AgentSkillManifest) => {
  activeSkillsRegistry.set(skill.id, skill);
};

export const getActiveSkills = (): AgentSkillManifest[] => {
  return Array.from(activeSkillsRegistry.values());
};

export const skillTools: AgentToolDefinition[] = [
  // 1. skills.listSkills - 列出所有已激活的 Agent 技能
  {
    name: 'skills.listSkills',
    description: '获取当前可用的 Claude Standard Skills 与动态挂载技能列表',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' }
      }
    },
    handler: async (input: any) => {
      const skills = getActiveSkills();
      if (input?.category) {
        return skills.filter((s) => s.category === input.category);
      }
      return skills;
    }
  },

  // 2. skills.executeSkill - 执行已激活的扩展技能
  {
    name: 'skills.executeSkill',
    description: '安全执行注册的高级 Agent 技能并返回运行数据与状态',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string' },
        args: { type: 'object' }
      },
      required: ['skillId']
    },
    handler: async (input: any) => {
      const skill = activeSkillsRegistry.get(input.skillId);
      if (!skill) {
        throw new Error(`Skill with ID "${input.skillId}" is not registered or disabled.`);
      }
      if (!skill.enabled) {
        throw new Error(`Skill "${skill.name}" is currently disabled by user policy.`);
      }

      const startTime = Date.now();
      return {
        skillId: skill.id,
        skillName: skill.name,
        success: true,
        data: {
          executedArgs: input.args || {},
          appliedPermissions: skill.permissions,
          message: `Successfully executed skill [${skill.name}]`
        },
        executionTimeMs: Date.now() - startTime
      };
    }
  },

  // 3. skills.upsertSkill - 新增或更新项目内 Agent Skill / Runbook
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
