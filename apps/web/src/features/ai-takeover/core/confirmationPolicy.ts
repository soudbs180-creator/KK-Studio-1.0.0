// 简体中文：动作确认层策略评估器 (Confirmation Policy)

import type { AssistantPlan, SanitizedProjectContext } from '../types.ts';

const formatConfirmedBrowserTarget = (value: unknown): string => {
  try {
    const url = new URL(String(value || ''));
    return `${url.origin}${url.pathname}`.slice(0, 180);
  } catch {
    return '';
  }
};

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

// 必须触发强确认卡片的动作列表
export const CONFIRM_ACTIONS = [
  'startGeneration',
  'startBatchGeneration',
  'cancelBatchGeneration',
  'uploadAssetToAI',
  'readFileContent',
  'attachManyReferenceImages',
  'deductCredits',
  'deleteCard',
  'overwriteOutput',
  'publishProject',
  'generation.createBatchJob',
  'generation.createVideoJob',
  'generation.createAudioJob',
  'generation.createAudioTask',
  'generation.cancelJob',
  'generation.retryJob',
  'generation.resumeJob',
  'generation.start',
  'generation.submitComposer',
  'knowledge.recordChange',
  'skills.upsertSkill',
  'submitPromptComposer',
  'ecommerce.createBatchTransformJob',
  'assets.zipOriginals',
  'zipOutputs',
  'workflow.controlPanel',
  'ui.recordLayoutChange',
  'browser.extractProduct',
  'browser.generateExternal',
  'browser.publishDraft',
  'browser.inspectPage',
  'browser.openDesktopProject',
  'browser.writeBackDom'
];

export const confirmationPolicy = {
  /**
   * 评估动作列表是否需要确认。若任何动作匹配 CONFIRM_ACTIONS，返回详细的确认细节
   */
  evaluate(plan: AssistantPlan, context: SanitizedProjectContext): ConfirmationDetails {
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

    // 根据不同的意图，动态定制确认卡片的文案与元数据
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
      const batchAction = plan.actions.find(a => a.type === 'startBatchGeneration');
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
      requiresCredits = context.settings.apiKeyStatus === 'missing'; // 无 Key 时需要消耗积分
      willUpload = payloadPlan?.referencePolicy?.uploadOnlyWhenGenerating ?? true;

      summary = `处理方式：每张图片作为对应参考图进行画风重绘；
预计输出：${expectedOutputs} 张图片；
额度消耗：${requiresCredits ? '会调用系统积分模型，将扣减额度' : '直接使用您的本地 API 密钥，不消耗系统积分'}；
上传策略：仅在开始生成时使用对应的单张参考图，不会一次性全部上传整个目录内容。`;
    } 
    // 2. 单图/多图常规生成
    else if (plan.intent === 'generate_images' || plan.intent === 'submit_composer') {
      const genAction = plan.actions.find(a => a.type === 'startGeneration');
      const queueAction = plan.actions.find(a => a.type === 'generation.createBatchJob');
      const payload = genAction?.type === 'startGeneration' ? genAction.payload : null;
      const queuedPrompts = queueAction?.type === 'generation.createBatchJob' ? queueAction.payload.prompts : [];
      
      const count = payload ? payload.count : Math.max(1, queuedPrompts.length);
      const prompt = payload?.prompt || String(queuedPrompts[0]?.prompt || '');
      title = '确认生成图片？';
      taskType = '图像生成';
      source = '输入提示词';
      imageCount = 0;
      promptStrategy = '文本输入';
      useReference = context.canvas?.selectedNodeIds?.length > 0;
      expectedOutputs = count;
      requiresCredits = context.settings.apiKeyStatus === 'missing';

      summary = `使用提示词：「${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}」；
预计输出：${count} 张图片；
执行路径：DurableGenerationQueue，可恢复、可取消并防止重复提交；
额度消耗：${context.billing?.canEstimateCost === true ? (requiresCredits ? '会消耗系统积分' : '使用已配置的专属 API') : '当前无法精确估算，执行前仍需明确确认'}。`;
    }
    // 3. 恢复或重试生成任务：未完成项可能重新调用 Provider，必须明确展示费用风险。
    else if (plan.actions.some(action => (
      action.type === 'generation.retryJob' || action.type === 'generation.resumeJob'
    ))) {
      const queueAction = plan.actions.find(action => (
        action.type === 'generation.retryJob' || action.type === 'generation.resumeJob'
      ));
      const isResume = queueAction?.type === 'generation.resumeJob';
      const jobId = String((queueAction as any)?.payload?.jobId || '').trim();
      const retryablePromptIds = queueAction?.type === 'generation.retryJob'
        ? queueAction.payload.expectedRetryablePromptIds || []
        : [];
      title = isResume ? '确认恢复生成任务？' : '确认重试失败项？';
      taskType = isResume ? '恢复持久生成任务' : '重试失败生成项';
      source = jobId ? `DurableGenerationQueue 任务 ${jobId}` : '未冻结目标的 DurableGenerationQueue 任务';
      imageCount = retryablePromptIds.length;
      expectedOutputs = retryablePromptIds.length;
      promptStrategy = isResume ? '仅继续未完成队列项' : '仅重试失败队列项';
      requiresCredits = context.settings.apiKeyStatus === 'missing';
      const costSummary = context.billing?.canEstimateCost === true
        ? (requiresCredits ? '可能继续消耗系统积分' : '可能继续消耗已配置 Provider 的配额')
        : '当前无法精确估算，恢复或重试前仍需明确确认';
      summary = [
        `${isResume ? '恢复' : '重试'}只会处理尚未完成的队列项，已完成结果不会重复提交。`,
        isResume ? '' : `已冻结影响范围：任务 ${jobId} 的 ${retryablePromptIds.length} 个失败项；目标变化后将要求重新确认。`,
        `费用影响：${costSummary}；任务可继续暂停或取消。`,
      ].filter(Boolean).join('\n');
    }
    // 4. 资源上传
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
    // 5. Browser Assistant 外部网页控制
    else if (
      plan.intent === 'extract_page_content' ||
      plan.intent === 'control_multidevice' ||
      plan.intent === 'browser_generate_external' ||
      plan.intent === 'browser_publish_draft' ||
      plan.intent === 'browser_write_back_dom' ||
      (plan.actions[0]?.type as string | undefined) === 'browser.inspectPage' ||
      (plan.actions[0]?.type as string | undefined) === 'browser.openDesktopProject'
    ) {
      const browserAction = plan.actions.find((action) => action.type.startsWith('browser.'));
      const actionType = browserAction?.type as string | undefined;
      const isDomWrite = actionType === 'browser.writeBackDom';
      const confirmedTarget = formatConfirmedBrowserTarget((browserAction as any)?.payload?.target);
      title = isDomWrite ? '二次确认网页 DOM 回写？' : '确认使用 Browser Bridge？';
      taskType = isDomWrite ? '外部网页 DOM 回写' : '外部网页自动化';
      source = confirmedTarget
        ? `Browser Assistant / Browser Bridge · ${confirmedTarget}`
        : 'Browser Assistant / Browser Bridge';
      imageCount = 0;
      promptStrategy = '结构化 Browser Bridge 工具调用';
      expectedOutputs = actionType === 'browser.generateExternal' ? 1 : 0;
      requiresCredits = false;
      willUpload = actionType === 'browser.publishDraft';

      summary = isDomWrite
        ? `此操作会通过已连接的 Browser Bridge 修改已确认网页 ${confirmedTarget || '（目标无效）'} 的 DOM。请确认目标页面和字段无误；AI 不会读取或上传密钥、Cookie 或登录凭证。`
        : `此操作会调用本地守护进程或 Chrome Bridge 插件处理${confirmedTarget ? `已确认网页 ${confirmedTarget}` : '明确的外部目标'}。若未连接 Bridge，系统只会返回连接引导，不会伪造成功结果。`;
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
};
