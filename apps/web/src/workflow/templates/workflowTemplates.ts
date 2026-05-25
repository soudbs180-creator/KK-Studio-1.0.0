import type {
  AgentWorkflowNode,
  PreviewWorkflowNode,
  SaveWorkflowNode,
  WorkflowNode,
} from '../../types';
import { createWorkflowEntityId, type WorkflowUtilityNodeKind } from '../schema';

export type WorkflowTemplateId =
  | 'prompt-image-save'
  | 'image-follow-up-image'
  | 'ppt-prompt-export';

export interface WorkflowTemplateDefinition {
  id: WorkflowTemplateId;
  title: string;
  description: string;
  utilityKinds: WorkflowUtilityNodeKind[];
  requiresSourceImage?: boolean;
}

const DEFAULT_WORKFLOW_CARD_SIZE = {
  width: 284,
  height: 176,
};

export const WORKFLOW_TEMPLATES: WorkflowTemplateDefinition[] = [
  {
    id: 'prompt-image-save',
    title: '提示词 -> 图片 -> 保存',
    description: '保留当前卡片出图链路，再加一个导出结果的保存卡。',
    utilityKinds: ['save'],
  },
  {
    id: 'image-follow-up-image',
    title: '图片 -> Follow-up 提示词 -> 图片',
    description: '围绕现有图片继续扩展 follow-up 生成，不替换主卡逻辑。',
    utilityKinds: ['preview', 'agent'],
    requiresSourceImage: true,
  },
  {
    id: 'ppt-prompt-export',
    title: 'PPT Prompt -> 多页图片 -> 导出',
    description: '为 PPT 主卡补一张导出卡，方便继续复用你现有的导出能力。',
    utilityKinds: ['save'],
  },
];

export const getWorkflowTemplate = (
  templateId: WorkflowTemplateId,
): WorkflowTemplateDefinition | undefined => WORKFLOW_TEMPLATES.find((template) => template.id === templateId);

export const createPreviewWorkflowNode = (
  position: { x: number; y: number },
  data: PreviewWorkflowNode['data'] = {},
): PreviewWorkflowNode => ({
  id: createWorkflowEntityId('preview'),
  kind: 'preview',
  position,
  width: DEFAULT_WORKFLOW_CARD_SIZE.width,
  height: DEFAULT_WORKFLOW_CARD_SIZE.height,
  label: data.title || '预览卡',
  data: {
    title: '预览卡',
    actionLabel: '预览结果',
    ...data,
  },
});

export const createSaveWorkflowNode = (
  position: { x: number; y: number },
  data: SaveWorkflowNode['data'] = {},
): SaveWorkflowNode => ({
  id: createWorkflowEntityId('save'),
  kind: 'save',
  position,
  width: DEFAULT_WORKFLOW_CARD_SIZE.width,
  height: DEFAULT_WORKFLOW_CARD_SIZE.height,
  label: data.title || '保存卡',
  data: {
    title: '保存卡',
    destination: 'export',
    format: 'zip',
    actionLabel: '导出结果',
    ...data,
  },
});

export const createAgentWorkflowNode = (
  position: { x: number; y: number },
  data: AgentWorkflowNode['data'] = {},
): AgentWorkflowNode => ({
  id: createWorkflowEntityId('agent'),
  kind: 'agent',
  position,
  width: DEFAULT_WORKFLOW_CARD_SIZE.width,
  height: DEFAULT_WORKFLOW_CARD_SIZE.height,
  label: data.title || '提示增强卡',
  data: {
    title: '提示增强卡',
    mode: 'prompt-assist',
    actionLabel: '填入提示栏',
    ...data,
  },
});

export const isWorkflowTemplateUtilityNode = (
  node: WorkflowNode,
): node is PreviewWorkflowNode | SaveWorkflowNode | AgentWorkflowNode => (
  node.kind === 'preview' || node.kind === 'save' || node.kind === 'agent'
);
