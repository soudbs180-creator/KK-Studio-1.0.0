// 简体中文：工具注册表与安全等级代理层 (Tool Registry Legacy Wrapper)
// 职责：代理到新拆分的 ToolRegistry.ts 模块，确保已有业务逻辑和测试文件不挂

import { toolRegistryInstance, AgentToolRegistry, TOOL_REGISTRY, getToolRegistrySchemas } from '../../ai-assistant-runtime/tools/ToolRegistry.ts';
import type { AgentToolDefinition } from '../../ai-assistant-runtime/tools/ToolRegistry.ts';

export { toolRegistryInstance, AgentToolRegistry, TOOL_REGISTRY, getToolRegistrySchemas };
export type { AgentToolDefinition };
