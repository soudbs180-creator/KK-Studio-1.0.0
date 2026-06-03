// 简体中文：接管动作执行器 (Action Executor)

import type { AssistantAction, BatchGenerationPlan } from '../types.ts';
import { zipOutputs } from '../../assets/zipOutputs.ts';
import { toolRegistryInstance } from './toolRegistry.ts';



// 执行时所需的外部上下文环境依赖注入
export interface ExecutorContext {
  activeCanvas: any;
  selectedNodeIds?: string[];
  selectedModel: any;
  addPromptNode: (node: any) => Promise<void> | void;
  updatePromptNode: (node: any) => Promise<void> | void;
  executeGeneration: (node: any) => Promise<void> | void;
  addToQueue: (node: any) => void;
  getNextCardPosition: () => { x: number; y: number };
  arrangeAllNodes?: (mode?: 'grid' | 'row' | 'column') => void;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  onOpenSettings?: (view?: string) => void;
  setShowRechargeModal?: (show: boolean) => void;
  notify: {
    success: (title: string, desc?: string) => void;
    warning: (title: string, desc?: string) => void;
    error: (title: string, desc?: string) => void;
    info: (title: string, desc?: string) => void;
  };
  config?: any;
  ecommerceState?: any;
  onGenerate?: () => Promise<void> | void;
}

export async function executeAction(
  action: AssistantAction,
  ctx: ExecutorContext
): Promise<void> {
  const toolName = action.type;
  const payload = (action as any).payload || {};

  if (toolRegistryInstance.getTool(toolName)) {
    await toolRegistryInstance.execute(toolName, payload, ctx);
  } else {
    console.warn('未识别的动作类型或未注册的工具:', action.type);
  }
}
