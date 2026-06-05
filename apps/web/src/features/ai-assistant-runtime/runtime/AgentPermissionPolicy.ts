// 简体中文：Agent 权限与安全策略评估层 (Agent Permission Policy)

import type { AssistantAction, AssistantPlan, SanitizedProjectContext } from '../../ai-takeover/types.ts';

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ConfirmationDetails {
  required: boolean;
  title: string;
  summary: string;
  confirmText: string;
  cancelText: string;
  metadata?: {
    taskType: string;
    source: string;
    imageCount: number;
    promptStrategy: string;
    useReference: boolean;
    expectedOutputs: number;
    requiresCredits: boolean;
    willUpload: boolean;
  };
}

const CONFIRM_ACTIONS = [
  'startGeneration',
  'startBatchGeneration',
  'uploadAssetToAI',
  'readFileContent',
  'attachManyReferenceImages',
  'deductCredits',
  'deleteCard',
  'overwriteOutput',
  'publishProject',
  'generation.createBatchJob',
  'ecommerce.createBatchTransformJob'
];

export class AgentPermissionPolicy {
  /**
   * 评估单个动作的安全合法性
   */
  evaluateSafety(action: AssistantAction): SafetyCheckResult {
    // 1. 禁止代填或拦截修改 API 密钥
    if (action.type === 'fillPrompt' && action.payload.prompt.toLowerCase().includes('sk-')) {
      return {
        allowed: false,
        reason: '出于安全原因，禁止向提示词中注入或填写 API 密钥（如 sk- 等开头特征串）。'
      };
    }

    // 2. 拦截敏感高危工具
    const actionType = action.type as string;
    if (
      actionType === 'fillApiKey' ||
      actionType === 'readApiKey' ||
      actionType === 'uploadApiKey' ||
      actionType === 'logCredentials'
    ) {
      return {
        allowed: false,
        reason: `检测到受限的敏感工具调用 [${actionType}]。AI 接管系统永远不允许读取、填写或上传您的私密密钥。`
      };
    }

    return { allowed: true };
  }

  /**
   * 评估动作列表是否需要用户强确认
   */
  evaluateConfirmation(plan: AssistantPlan, context: SanitizedProjectContext): ConfirmationDetails {
    const hasConfirmAction = plan.actions.some(action => CONFIRM_ACTIONS.includes(action.type));

    if (!hasConfirmAction) {
      return {
        required: false,
        title: '',
        summary: '',
        confirmText: '确定',
        cancelText: '取消'
      };
    }

    let title = '确认执行操作？';
    let summary = '此操作将修改您的画布或资源。';
    let taskType = '常规任务';
    let source = '默认画布';
    let imageCount = 0;
    let expectedOutputs = 1;
    let requiresCredits = false;
    let promptStrategy = '单提示词';
    let useReference = false;
    let willUpload = false;

    // 1. 文件夹批量生成
    if (plan.intent === 'batch_generate_from_folder') {
      const batchAction = plan.actions.find(a => a.type === 'startBatchGeneration' || (a.type as string) === 'generation.createBatchJob');
      const payloadPlan = batchAction?.type === 'startBatchGeneration' ? batchAction.payload.plan : null;

      title = '确认批量生成？';
      taskType = '批量生图';
      source = payloadPlan
        ? `图片文件夹 [ID: ${payloadPlan.sourceCollectionId.substring(0, 8)}]`
        : '关联资源夹';
      imageCount = payloadPlan ? payloadPlan.imageIds.length : (context.assets?.images?.length || 0);
      promptStrategy = payloadPlan?.promptStrategy?.mode === 'single_template' ? '单一模板' : '每图配提示词';
      useReference = payloadPlan?.referencePolicy?.useEachImageAsReference ?? true;
      expectedOutputs = payloadPlan ? payloadPlan.output.expectedTotal : imageCount;
      requiresCredits = context.settings.apiKeyStatus === 'missing';
      willUpload = payloadPlan?.referencePolicy?.uploadOnlyWhenGenerating ?? true;

      summary = `处理方式：每张图片作为对应参考图进行画风重绘；
预计输出：${expectedOutputs} 张图片；
额度消耗：${requiresCredits ? '会调用系统积分模型，将扣减额度' : '直接使用您的本地 API 密钥，不消耗系统积分'}；
上传策略：仅在开始生成时使用对应的单张参考图，不会一次性全部上传整个目录内容。`;
    } 
    // 2. 单图/多图常规生成
    else if (plan.intent === 'generate_images') {
      const genAction = plan.actions.find(a => a.type === 'startGeneration');
      const payload = genAction?.type === 'startGeneration' ? genAction.payload : null;
      
      const count = payload ? payload.count : 1;
      title = '确认生成图片？';
      taskType = '图像生成';
      source = '输入提示词';
      imageCount = 0;
      promptStrategy = '文本输入';
      useReference = context.canvas?.selectedNodeIds?.length > 0;
      expectedOutputs = count;
      requiresCredits = context.settings.apiKeyStatus === 'missing';

      summary = `使用提示词：「${payload?.prompt?.substring(0, 30)}...」；
预计输出：${count} 张图片；
额度消耗：${requiresCredits ? '会消耗系统积分' : '使用专属 API 密钥，不消耗系统积分'}。`;
    }
    // 3. 资源上传
    else if (plan.intent === 'upload_assets') {
      title = '确认上传资源？';
      taskType = '文件/图片上传';
      source = '本地文件导入';
      imageCount = context.assets?.images?.filter(i => i.uploadState === 'local_ready').length || 0;
      expectedOutputs = 0;
      willUpload = true;

      summary = `该操作将把导入的文件与图片上传至 KK Studio 项目存储库。
部分大模型将可以读取这些资源的文本描述摘要。`;
    }

    return {
      required: true,
      title,
      summary,
      confirmText: '确认执行',
      cancelText: '取消',
      metadata: {
        taskType,
        source,
        imageCount,
        promptStrategy,
        useReference,
        expectedOutputs,
        requiresCredits,
        willUpload
      }
    };
  }
}

export const agentPermissionPolicy = new AgentPermissionPolicy();
