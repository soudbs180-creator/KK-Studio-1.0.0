// 简体中文：生图和批量生图任务相关的 AI 助手工具 (Generation Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { durableGenerationQueue } from '../queue/DurableGenerationQueue.ts';
import type { AssistantOutputGroupPlan, BatchGenerationPlan } from '../../ai-takeover/types.ts';

type BatchLayoutPreset = 'grid' | 'row' | 'column' | 'compact-grid';

const normalizeLayoutOptions = (params: {
  count: number;
  layoutPreset?: BatchLayoutPreset;
  layout?: 'grid' | 'row' | 'column';
  columns?: number;
  gap?: number;
}) => {
  const preset = params.layoutPreset || params.layout || 'grid';
  const layout = preset === 'compact-grid' ? 'grid' : preset;
  const columns = Number.isFinite(params.columns)
    ? Math.max(1, Math.floor(Number(params.columns)))
    : preset === 'compact-grid'
      ? Math.max(1, Math.min(4, params.count))
      : undefined;
  const gap = Number.isFinite(params.gap)
    ? Math.max(0, Number(params.gap))
    : preset === 'compact-grid'
      ? 24
      : undefined;

  return {
    layout: layout as 'grid' | 'row' | 'column',
    layoutPreset: preset,
    columns,
    gap
  };
};

const createDefaultOutputGroup = (params: {
  label?: string;
  jobId?: string;
  tags?: string[];
}): AssistantOutputGroupPlan => ({
  label: params.label || 'AI batch output',
  color: '#ffffff',
  includePromptNodes: true,
  tags: Array.from(new Set(['automation', ...(params.jobId ? [`batch:${params.jobId}`] : []), ...(params.tags || [])]))
});

const buildQueueOptions = (params: {
  selectedModel: any;
  count: number;
  aspectRatio?: string;
  imageSize?: string;
  countPerPrompt?: number;
  concurrency?: number;
  layoutPreset?: BatchLayoutPreset;
  layout?: 'grid' | 'row' | 'column';
  columns?: number;
  gap?: number;
  outputGroup?: AssistantOutputGroupPlan;
}) => {
  const layoutOptions = normalizeLayoutOptions({
    count: params.count,
    layoutPreset: params.layoutPreset,
    layout: params.layout,
    columns: params.columns,
    gap: params.gap
  });

  return {
    modelId: params.selectedModel?.id || 'gemini-2.5-flash',
    aspectRatio: params.aspectRatio || '1:1',
    imageSize: params.imageSize || '1K',
    countPerPrompt: params.countPerPrompt || 1,
    concurrency: params.concurrency || 3,
    ...layoutOptions,
    outputGroup: params.outputGroup
  };
};

export const generationTools: AgentToolDefinition[] = [
  // 1. startGeneration - 启动绘图
  {
    name: 'startGeneration',
    description: '使用当前选中的模型启动绘图任务，在画布上新建卡片并拉起图像生成',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '绘图英文提示词' },
        count: { type: 'number', description: '生成的数量张数' }
      },
      required: ['prompt']
    },
    handler: async (input: { prompt: string; count: number }, ctx) => {
      const { prompt, count } = input;
      const { selectedModel, addPromptNode, addToQueue, getNextCardPosition, notify } = ctx;

      notify.success('生图计划已提交', `任务已加入排队队列，数量：${count}`);

      try {
        const lastPos = getNextCardPosition();
        for (let i = 0; i < count; i++) {
          const pos = {
            x: lastPos.x + i * 420,
            y: lastPos.y
          };

          const newNode = {
            id: 'takeover_gen_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 9),
            prompt: prompt,
            position: pos,
            aspectRatio: '1:1',
            imageSize: '1K',
            model: selectedModel?.id || 'gemini-2.5-flash',
            modelLabel: selectedModel?.name || 'Gemini 2.5 Flash',
            provider: selectedModel?.provider || 'Google',
            childImageIds: [],
            timestamp: Date.now(),
            parallelCount: 1,
            isGenerating: false,
            status: 'queued'
          };

          await addPromptNode(newNode);
          addToQueue(newNode);
        }
      } catch (e: any) {
        notify.error('生图排队触发失败', e.message || '未知异常');
        throw e;
      }
    }
  },

  // 2. startBatchGeneration - 启动批量生成
  {
    name: 'startBatchGeneration',
    description: '绑定图片资源文件夹，为每张图片依次拉起重绘生成任务并创建卡片',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'object', description: '批量生图完整执行计划' }
      },
      required: ['plan']
    },
    handler: async (input: { plan: BatchGenerationPlan }, ctx) => {
      const { plan } = input;
      const { activeCanvas, selectedModel, notify } = ctx;
      const count = plan.imageIds.length;

      try {
        const prompts = plan.imageIds.map((imageId: string, idx: number) => ({
          id: 'prompt_item_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 9),
          prompt: plan.promptStrategy.basePrompt,
          referenceImageNodeId: imageId
        }));

        const outputGroup = plan.outputGroup || createDefaultOutputGroup({
          label: plan.taskDomain === 'ecommerce' ? 'AI ecommerce batch' : 'AI batch output',
          jobId: plan.id,
          tags: ['batch:' + plan.id]
        });
        const job = durableGenerationQueue.createJob(
          prompts,
          buildQueueOptions({
            selectedModel,
            count,
            aspectRatio: String(plan.aspectRatio || '1:1'),
            countPerPrompt: plan.output.countPerImage,
            layoutPreset: plan.layoutPreset,
            outputGroup
          }),
          activeCanvas?.id || 'default',
          plan.id
        );

        notify.success('批量生成计划已提交', `任务已加入持久化队列 (Job ID: ${job.id})，共 ${count} 张图`);
      } catch (e: any) {
        notify.error('批量生成排队失败', e.message || '未知异常');
        throw e;
      }
    }
  },

  // 3. submitPromptComposer - 发起生成
  {
    name: 'submitPromptComposer',
    description: '提交输入框内容并发起生成',
    permission: 'safe',
    inputSchema: {},
    handler: async (input: any, ctx) => {
      const { onGenerate, notify } = ctx;

      if (onGenerate) {
        onGenerate();
        notify.success('AI 接管：已帮您发起生成任务', '');
      } else {
        notify.warning('未绑定发送功能', '');
      }
    }
  },

  // 4. generation.createBatchJob - 创建批量生图持久化任务
  {
    name: 'generation.createBatchJob',
    description: '创建一个批量生图持久化任务队列',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              referenceImageNodeId: { type: 'string' }
            },
            required: ['prompt']
          }
        },
        options: { type: 'object' },
        idempotencyKey: { type: 'string' }
      },
      required: ['prompts']
    },
    handler: async (input: { prompts: any[]; options?: any; idempotencyKey?: string }, ctx) => {
      const { prompts, options, idempotencyKey } = input;
      const { activeCanvas, selectedModel, notify } = ctx;
      
      const formattedPrompts = prompts.map((p, idx) => ({
        id: 'prompt_item_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 9),
        prompt: p.prompt,
        referenceImageNodeId: p.referenceImageNodeId
      }));

      const job = durableGenerationQueue.createJob(
        formattedPrompts,
        buildQueueOptions({
          selectedModel,
          count: formattedPrompts.length,
          aspectRatio: options?.aspectRatio || '1:1',
          imageSize: options?.imageSize || '1K',
          countPerPrompt: options?.countPerPrompt || 1,
          concurrency: options?.concurrency || 3,
          layout: options?.layout || 'grid',
          layoutPreset: options?.layoutPreset,
          columns: options?.columns,
          gap: options?.gap,
          outputGroup: options?.outputGroup
        }),
        activeCanvas?.id || 'default',
        idempotencyKey
      );

      notify.success('批量生成任务已创建', `Job ID: ${job.id} 已加入队列执行。`);
      return job;
    }
  },

  // 5. ecommerce.createBatchTransformJob - Ecommerce batch adapter
  {
    name: 'ecommerce.createBatchTransformJob',
    description: 'Create an ecommerce batch image transform job from imported images or canvas image nodes.',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        imageIds: { type: 'array', items: { type: 'string' } },
        rawUserRequest: { type: 'string' },
        aspectRatio: { type: 'string' },
        layoutPreset: { type: 'string', enum: ['grid', 'row', 'column', 'compact-grid'] },
        outputGroup: { type: 'object' },
        idempotencyKey: { type: 'string' }
      },
      required: ['rawUserRequest']
    },
    handler: async (input: {
      imageIds?: string[];
      rawUserRequest: string;
      aspectRatio?: string;
      layoutPreset?: BatchLayoutPreset;
      outputGroup?: AssistantOutputGroupPlan;
      idempotencyKey?: string;
    }, ctx) => {
      const { activeCanvas, selectedModel, notify } = ctx;
      const imageIds = Array.isArray(input.imageIds) && input.imageIds.length > 0
        ? input.imageIds
        : (activeCanvas?.imageNodes || []).map((image: any) => image.id);
      if (imageIds.length === 0) {
        throw new Error('ecommerce.createBatchTransformJob requires imported images or canvas image nodes.');
      }
      const prompts = imageIds.map((imageId: string, idx: number) => ({
        id: 'ecommerce_prompt_item_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 9),
        prompt: input.rawUserRequest,
        referenceImageNodeId: imageId
      }));
      const outputGroup = input.outputGroup || createDefaultOutputGroup({
        label: 'AI ecommerce batch',
        tags: ['ecommerce']
      });

      const job = durableGenerationQueue.createJob(
        prompts,
        buildQueueOptions({
          selectedModel,
          count: prompts.length,
          aspectRatio: input.aspectRatio || '4:5',
          layoutPreset: input.layoutPreset || 'compact-grid',
          outputGroup
        }),
        activeCanvas?.id || 'default',
        input.idempotencyKey
      );

      notify.success('电商批量任务已创建', `Job ID: ${job.id}，共 ${prompts.length} 张参考图。`);
      return {
        id: job.id,
        status: job.status,
        promptCount: job.prompts.length,
        outputGroup: job.outputGroup
      };
    }
  },

  // 6. generation.pauseJob - 暂停批量生图任务
  {
    name: 'generation.pauseJob',
    description: '暂停指定的批量生图任务',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: '批量生图的任务ID' }
      },
      required: ['jobId']
    },
    handler: async (input: { jobId: string }, ctx) => {
      durableGenerationQueue.pauseJob(input.jobId);
      ctx.notify.success('任务已暂停', `批量生图任务 ${input.jobId} 已暂停。`);
    }
  },

  // 6. generation.resumeJob - 恢复批量生图任务
  {
    name: 'generation.resumeJob',
    description: '恢复指定的批量生图任务',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: '批量生图的任务ID' }
      },
      required: ['jobId']
    },
    handler: async (input: { jobId: string }, ctx) => {
      durableGenerationQueue.resumeJob(input.jobId);
      ctx.notify.success('任务已恢复', `批量生图任务 ${input.jobId} 已恢复并开始继续生图。`);
    }
  },

  // 7. generation.getJobStatus - 读取批量生图任务状态摘要
  {
    name: 'generation.getJobStatus',
    description: '读取指定持久化批量生图任务的状态摘要',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: '批量生图任务 ID' }
      },
      required: ['jobId']
    },
    handler: async (input: { jobId: string }) => {
      const job = durableGenerationQueue.getJob(input.jobId);
      if (!job) {
        throw new Error(`generation job not found: ${input.jobId}`);
      }

      return {
        id: job.id,
        idempotencyKey: job.idempotencyKey,
        canvasId: job.canvasId,
        status: job.status,
        promptCount: job.prompts.length,
        completedCount: job.prompts.filter(prompt => prompt.status === 'completed').length,
        failedCount: job.prompts.filter(prompt => prompt.status === 'failed').length,
        runningCount: job.prompts.filter(prompt => prompt.status === 'running').length,
        queuedCount: job.prompts.filter(prompt => prompt.status === 'queued').length,
        outputGroup: job.outputGroup,
        updatedAt: job.updatedAt
      };
    }
  },
  
  // 8. generation.cancelJob - 取消批量生图任务
  {
    name: 'generation.cancelJob',
    description: '取消指定的批量生图任务，并中止排队中或执行中的任务',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: '批量生图的任务ID' }
      },
      required: ['jobId']
    },
    handler: async (input: { jobId: string }, ctx) => {
      durableGenerationQueue.cancelJob(input.jobId);
      ctx.notify?.success?.('任务已取消', `批量生图任务 ${input.jobId} 已取消。`);
    }
  }
];
