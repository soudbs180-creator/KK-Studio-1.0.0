/**
 * Skill Registry Domain Contract & DTOs
 * Part of Awesome Claude Skills & ToolRegistry integration for KK Studio.
 */

export type SkillCategory = 'design' | 'coding' | 'marketing' | 'workflow' | 'utility' | 'multimedia';

export type SkillPermission =
  | 'canvas:read'
  | 'canvas:write'
  | 'network:outbound'
  | 'storage:write'
  | 'account:read';

export interface SkillParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  default?: any;
}

export interface SkillParameterSchema {
  type: 'object';
  properties: Record<string, SkillParameterProperty>;
  required?: string[];
}

export interface AgentSkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  author?: string;
  homepage?: string;
  icon?: string;
  permissions: SkillPermission[];
  parameters: SkillParameterSchema;
  systemPromptSnippet?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecutionParams {
  skillId: string;
  args: Record<string, any>;
  context?: {
    canvasId?: string;
    selectedNodeIds?: string[];
    ownerId?: string;
  };
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
  executionTimeMs: number;
}
