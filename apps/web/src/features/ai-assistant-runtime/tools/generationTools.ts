// 简体中文：生图和批量生图任务相关的 AI 助手工具 (Generation Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import {
  durableGenerationQueue,
  type DurableGenerationQueue,
} from '../queue/DurableGenerationQueue.ts';
import type { AssistantOutputGroupPlan, BatchGenerationPlan } from '../../ai-takeover/types.ts';
import {
  CreateAudioJobToolInputSchema,
  CreateImageBatchJobToolInputSchema,
  CreateVideoJobToolInputSchema,
  GenerationJobControlInputSchema,
  GenerationRetryJobInputSchema,
  StartGenerationToolInputSchema,
  type GenerationMediaTaskType,
} from '@kk/shared';

type BatchLayoutPreset = 'grid' | 'row' | 'column' | 'compact-grid';

type RetryJobInput = {
  jobId: string;
  expectedUpdatedAt: number;
  expectedRetryablePromptIds: string[];
};

const stableGenerationHash = (value: string, seed: number): string => value.split('').reduce(
  (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
  seed,
).toString(16).padStart(8, '0');

const createGenerationItemId = (
  prefix: string,
  idempotencyKey: string | undefined,
  index = 0,
): string => {
  const normalizedKey = String(idempotencyKey || '').trim();
  if (!normalizedKey) {
    return `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 9)}`;
  }
  const source = `${normalizedKey}\u0000${prefix}\u0000${index}`;
  return `${prefix}_${stableGenerationHash(source, 2166136261)}${stableGenerationHash(source, 3335557771)}`;
};

// ==========================================
// 1. 核心算法：模型能力评估轻量级 LRU 缓存
// ==========================================
class SimpleLruCache<K, V> {
  private cache = new Map<K, V>();
  private maxLimit: number;
  constructor(maxLimit: number = 100) {
    this.maxLimit = maxLimit;
  }

  public get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  public set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxLimit) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }
}

const modelCapabilitiesCache = new SimpleLruCache<string, any>(100);

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
  includePromptNodes: false,
  tags: Array.from(new Set(['automation', ...(params.jobId ? [`batch:${params.jobId}`] : []), ...(params.tags || [])]))
});

const buildQueueOptions = (params: {
  selectedModel: any;
  taskType?: GenerationMediaTaskType;
  modelId?: string;
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
  durationSeconds?: number;
  resolution?: string;
  generateAudio?: boolean;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  motion?: string;
  voice?: string;
  lyrics?: string;
  genre?: string;
}) => {
  const layoutOptions = normalizeLayoutOptions({
    count: params.count,
    layoutPreset: params.layoutPreset,
    layout: params.layout,
    columns: params.columns,
    gap: params.gap
  });

  return {
    taskType: params.taskType || 'image',
    modelId: params.modelId || params.selectedModel?.id || 'gemini-2.5-flash',
    aspectRatio: params.aspectRatio || '1:1',
    imageSize: params.imageSize || '1K',
    countPerPrompt: params.countPerPrompt || 1,
    concurrency: params.concurrency,
    ...layoutOptions,
    outputGroup: params.outputGroup,
    durationSeconds: params.durationSeconds,
    resolution: params.resolution,
    generateAudio: params.generateAudio,
    firstFrameAssetId: params.firstFrameAssetId,
    lastFrameAssetId: params.lastFrameAssetId,
    motion: params.motion,
    voice: params.voice,
    lyrics: params.lyrics,
    genre: params.genre
  };
};

const verifyQueuedMediaJob = (output: any, expectedType: GenerationMediaTaskType) => {
  const persisted = output?.id ? durableGenerationQueue.getJob(output.id) : undefined;
  return {
    success: Boolean(persisted && persisted.schemaVersion === 2 && persisted.taskType === expectedType),
    message: `Generation job verification failed for taskType=${expectedType}`
  };
};

const createSingleMediaJob = (input: any, ctx: any, taskType: GenerationMediaTaskType) => {
  const referenceImageNodeId = input.referenceImageNodeId || input.options?.referenceImageNodeId;
  const count = taskType === 'image' ? Math.max(1, Number(input.count || 4)) : 1;
  const prompts = Array.from({ length: count }, (_, index) => ({
    id: createGenerationItemId('prompt_item', input.idempotencyKey, index),
    prompt: input.prompt,
    referenceImageNodeId
  }));
  const outputGroup = createDefaultOutputGroup({
    label: count > 1 ? `AI ${taskType} batch output` : `AI ${taskType} output`,
    tags: referenceImageNodeId ? ['automation', taskType, `source:${referenceImageNodeId}`] : ['automation', taskType]
  });
  return durableGenerationQueue.createJob(
    prompts,
    buildQueueOptions({
      selectedModel: ctx.selectedModel,
      taskType,
      modelId: input.modelId || input.model,
      count,
      aspectRatio: input.aspectRatio || input.options?.aspectRatio || '1:1',
      imageSize: input.options?.imageSize,
      concurrency: input.options?.concurrency,
      outputGroup,
      durationSeconds: input.durationSeconds || input.options?.durationSeconds || input.options?.duration,
      resolution: input.resolution || input.options?.resolution,
      generateAudio: input.generateAudio ?? input.options?.generateAudio,
      firstFrameAssetId: input.firstFrameAssetId || input.options?.firstFrameAssetId,
      lastFrameAssetId: input.lastFrameAssetId || input.options?.lastFrameAssetId,
      motion: input.motion || input.options?.motion,
      voice: input.voice || input.options?.voice,
      lyrics: input.lyrics || input.options?.lyrics,
      genre: input.genre || input.options?.genre
    }),
    ctx.activeCanvas?.id || 'default',
    input.idempotencyKey
  );
};

const resolveRetryJob = (
  input: RetryJobInput,
  queue: Pick<DurableGenerationQueue, 'getJob'> = durableGenerationQueue,
) => {
  const explicitJob = queue.getJob(input.jobId);
  if (!explicitJob) {
    throw new Error(`generation job not found: ${input.jobId}`);
  }
  return explicitJob;
};

const requireGenerationJob = (jobId: string) => {
  const job = durableGenerationQueue.getJob(jobId);
  if (!job) {
    throw new Error(`generation job not found: ${jobId}`);
  }
  return job;
};

const verifyPersistedGenerationJobState = (
  output: any,
  input: { jobId?: string },
  allowedStatuses: readonly string[],
  operation: string,
  queue: Pick<DurableGenerationQueue, 'getJob'> = durableGenerationQueue,
) => {
  const jobId = String(input.jobId || output?.id || output?.jobId || '').trim();
  const job = jobId ? queue.getJob(jobId) : undefined;
  return {
    success: Boolean(job && allowedStatuses.includes(job.status)),
    message: job
      ? `Generation job ${job.id} is ${job.status}; expected ${allowedStatuses.join(' or ')} after ${operation}.`
      : `Generation job verification could not find the durable job after ${operation}.`,
  };
};

const capabilityUnavailable = (message: string, setupAction = 'open-workspace') => ({
  success: false as const,
  code: 'CAPABILITY_UNAVAILABLE' as const,
  message,
  setupAction
});

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
        count: { type: 'number', description: '生成的数量张数' },
        aspectRatio: { type: 'string', description: '图片比例' },
        referenceImageNodeId: { type: 'string', description: '参考图节点ID' }
      },
      required: ['prompt']
    },
    inputValidator: StartGenerationToolInputSchema,
    handler: async (input: {
      prompt: string;
      count?: number;
      aspectRatio?: string;
      referenceImageNodeId?: string;
      mode?: GenerationMediaTaskType;
      options?: Record<string, any>;
      idempotencyKey?: string;
    }, ctx) => {
      const explicitMode = input.mode || input.options?.taskType || input.options?.mode;
      const taskType: GenerationMediaTaskType = explicitMode === 'video' || explicitMode === 'audio' ? explicitMode : 'image';
      const { prompt, aspectRatio } = input;
      const referenceImageNodeId = input.referenceImageNodeId || input.options?.referenceImageNodeId;
      const count = taskType === 'image' ? input.count || 4 : 1;
      const { selectedModel, notify, activeCanvas } = ctx;

      try {
        const prompts: Array<{ id: string; prompt: string; referenceImageNodeId?: string }> = [];
        for (let i = 0; i < count; i++) {
          prompts.push({
            id: createGenerationItemId('prompt_item', input.idempotencyKey, i),
            prompt: prompt,
            referenceImageNodeId
          });
        }

        // 创建 output group 以便生成完成后的打组和排版
        const tags = referenceImageNodeId
          ? ['automation', 'edit', `source:${referenceImageNodeId}`]
          : ['automation'];

        const outputGroup = createDefaultOutputGroup({
          label: count > 1 ? 'AI batch output' : 'AI output',
          tags
        });

        const job = durableGenerationQueue.createJob(
          prompts,
          buildQueueOptions({
            selectedModel,
            count,
            taskType,
            modelId: input.options?.modelId,
            aspectRatio: aspectRatio || input.options?.aspectRatio || '1:1',
            concurrency: input.options?.concurrency,
            durationSeconds: input.options?.durationSeconds || input.options?.duration,
            resolution: input.options?.resolution,
            generateAudio: input.options?.generateAudio,
            firstFrameAssetId: input.options?.firstFrameAssetId,
            lastFrameAssetId: input.options?.lastFrameAssetId,
            motion: input.options?.motion,
            voice: input.options?.voice,
            lyrics: input.options?.lyrics,
            genre: input.options?.genre,
            outputGroup
          }),
          activeCanvas?.id || 'default',
          input.idempotencyKey
        );

        notify.success('生图计划已提交', `任务已加入持久化队列 (Job ID: ${job.id})`);
        return job;
      } catch (e: any) {
        notify.error('生图排队触发失败', e.message || '未知异常');
        throw e;
      }
    },
    verify: (output: any, input: any) => {
      const explicitMode = input.mode || input.options?.taskType || input.options?.mode;
      const taskType: GenerationMediaTaskType = explicitMode === 'video' || explicitMode === 'audio' ? explicitMode : 'image';
      return verifyQueuedMediaJob(output, taskType);
    }
  },

  // 2. startBatchGeneration - 启动批量生成
  {
    name: 'generation.createVideoJob',
    description: 'Create a durable text-to-video or image-to-video generation job.',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        referenceImageNodeId: { type: 'string' },
        durationSeconds: { type: 'number' },
        resolution: { type: 'string' },
        aspectRatio: { type: 'string' },
        generateAudio: { type: 'boolean' },
        firstFrameAssetId: { type: 'string' },
        lastFrameAssetId: { type: 'string' },
        motion: { type: 'string' }
      },
      required: ['prompt']
    },
    inputValidator: CreateVideoJobToolInputSchema,
    handler: async (input: any, ctx) => {
      const job = createSingleMediaJob(input, ctx, 'video');
      ctx.notify.success('Video job submitted', `Job ID: ${job.id}`);
      return job;
    },
    verify: (output: any) => verifyQueuedMediaJob(output, 'video')
  },

  {
    name: 'generation.createAudioJob',
    description: 'Create a durable speech, music, or sound generation job.',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        durationSeconds: { type: 'number' },
        voice: { type: 'string' },
        lyrics: { type: 'string' },
        genre: { type: 'string' }
      },
      required: ['prompt']
    },
    inputValidator: CreateAudioJobToolInputSchema,
    handler: async (input: any, ctx) => {
      const job = createSingleMediaJob(input, ctx, 'audio');
      ctx.notify.success('Audio job submitted', `Job ID: ${job.id}`);
      return job;
    },
    verify: (output: any) => verifyQueuedMediaJob(output, 'audio')
  },

  {
    name: 'startBatchGeneration',
    description: '绑定图片资源文件夹，为每张图片依次拉起重绘生成任务并创建卡片',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'object', description: '批量生图完整执行计划' },
        idempotencyKey: { type: 'string' }
      },
      required: ['plan']
    },
    handler: async (input: { plan: BatchGenerationPlan; idempotencyKey?: string }, ctx) => {
      const { plan } = input;
      const { activeCanvas, selectedModel, notify } = ctx;
      const count = plan.imageIds.length;

      try {
        const prompts = plan.imageIds.map((imageId: string, idx: number) => ({
          id: createGenerationItemId('prompt_item', input.idempotencyKey, idx),
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
          input.idempotencyKey
        );

        notify.success('批量生成计划已提交', `任务已加入持久化队列 (Job ID: ${job.id})，共 ${count} 张图`);
        return job;
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

      if (ctx.trigger !== 'user-action') {
        return {
          success: false as const,
          code: 'DIRECT_USER_ACTION_REQUIRED' as const,
          message: 'Composer submission is reserved for an explicit user click. AI generation must use generation.createBatchJob.',
        };
      }

      if (typeof onGenerate !== 'function') {
        notify.warning('未绑定发送功能', '');
        return capabilityUnavailable('Prompt composer submit handler is not bound.');
      }

      await Promise.resolve(onGenerate());
      notify.success('AI 接管：已帮您发起生成任务', '');
      return { success: true as const, executionOutcome: 'success' as const, status: 'submitted' };
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
              id: { type: 'string' },
              prompt: { type: 'string' },
              referenceImageNodeId: { type: 'string' },
              targetNodeId: { type: 'string' }
            },
            required: ['prompt']
          }
        },
        options: { type: 'object' },
        idempotencyKey: { type: 'string' },
        clientIdempotencyKey: { type: 'string' }
      },
      required: ['prompts']
    },
    inputValidator: CreateImageBatchJobToolInputSchema,
    handler: async (input: { prompts: any[]; options?: any; idempotencyKey?: string; clientIdempotencyKey?: string }, ctx) => {
      const { prompts, options, idempotencyKey, clientIdempotencyKey } = input;
      const queueIdempotencyKey = clientIdempotencyKey || idempotencyKey;
      const { activeCanvas, selectedModel, notify, addPromptNode, getNextCardPosition } = ctx;
      
      if (options?.researchBrief && typeof addPromptNode === 'function') {
        const lastPos = typeof getNextCardPosition === 'function' ? getNextCardPosition() : { x: 100, y: 100 };
        const briefNode = {
          id: createGenerationItemId('research_brief', idempotencyKey),
          prompt: options.researchBrief,
          position: {
            x: lastPos.x - 300,
            y: lastPos.y
          },
          aspectRatio: '3:4',
          imageSize: '1K',
          model: 'local-research',
          modelLabel: '深度研究报告',
          provider: 'Local',
          childImageIds: [],
          timestamp: Date.now(),
          parallelCount: 1,
          isGenerating: false,
          status: 'done',
          tags: ['research-brief', 'automation']
        };
        const liveCanvas = ctx.getActiveCanvas?.() || activeCanvas;
        if (!(liveCanvas?.promptNodes || []).some((node: any) => node.id === briefNode.id)) {
          await addPromptNode(briefNode);
        }
      }

      const formattedPrompts = prompts.map((p, idx) => ({
        id: typeof p.id === 'string' && p.id.trim()
          ? p.id.trim()
          : createGenerationItemId('prompt_item', queueIdempotencyKey, idx),
        prompt: p.prompt,
        referenceImageNodeId: p.referenceImageNodeId,
        targetNodeId: p.targetNodeId,
      }));

      const job = durableGenerationQueue.createJob(
        formattedPrompts,
        buildQueueOptions({
          selectedModel,
          count: formattedPrompts.length,
          taskType: options?.taskType === 'video' || options?.taskType === 'audio' ? options.taskType : 'image',
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
        queueIdempotencyKey
      );

      notify.success('批量生成任务已创建', `Job ID: ${job.id} 已加入队列执行。`);
      return job;
    },
    verify: (output: any, input: any) => {
      const taskType = input?.options?.taskType === 'video' || input?.options?.taskType === 'audio'
        ? input.options.taskType
        : 'image';
      return verifyQueuedMediaJob(output, taskType);
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
        id: createGenerationItemId('ecommerce_prompt_item', input.idempotencyKey, idx),
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
    inputValidator: GenerationJobControlInputSchema,
    handler: async (input: { jobId: string }, ctx) => {
      requireGenerationJob(input.jobId);
      durableGenerationQueue.pauseJob(input.jobId);
      const job = requireGenerationJob(input.jobId);
      if (job.status === 'paused') {
        ctx.notify.success('任务已暂停', `批量生图任务 ${input.jobId} 已暂停。`);
      } else {
        ctx.notify.warning?.('任务未暂停', `任务 ${input.jobId} 当前状态为 ${job.status}，无需暂停。`);
      }
      return {
        id: job.id,
        status: job.status,
        promptCount: job.prompts.length
      };
    },
    verify: async (output: any, input: { jobId: string }) => (
      verifyPersistedGenerationJobState(output, input, ['paused'], 'pause')
    ),
  },

  // 6. generation.resumeJob - 恢复批量生图任务
  {
    name: 'generation.resumeJob',
    description: '恢复指定的批量生图任务',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: '批量生图的任务ID' }
      },
      required: ['jobId']
    },
    inputValidator: GenerationJobControlInputSchema,
    handler: async (input: { jobId: string }, ctx) => {
      const currentJob = requireGenerationJob(input.jobId);
      if (currentJob.status === 'queued' || currentJob.status === 'running') {
        return {
          success: true,
          executionOutcome: 'success',
          alreadyActive: true,
          id: currentJob.id,
          status: currentJob.status,
          promptCount: currentJob.prompts.length,
        };
      }
      if (currentJob.status !== 'paused') {
        return {
          success: false,
          executionOutcome: 'failed',
          code: 'INVALID_JOB_STATE',
          retryable: false,
          message: `Generation job ${input.jobId} cannot resume from status ${currentJob.status}.`,
          id: currentJob.id,
          status: currentJob.status,
          promptCount: currentJob.prompts.length,
        };
      }
      durableGenerationQueue.resumeJob(input.jobId);
      const job = requireGenerationJob(input.jobId);
      if (job.status !== 'queued' && job.status !== 'running') {
        return {
          success: false,
          executionOutcome: 'failed',
          code: 'RESUME_VERIFICATION_FAILED',
          retryable: false,
          message: `Generation job ${input.jobId} did not enter a runnable state.`,
          id: job.id,
          status: job.status,
          promptCount: job.prompts.length,
        };
      }
      ctx.notify.success('任务已恢复', `批量生图任务 ${input.jobId} 已恢复并开始继续生图。`);
      return {
        success: true,
        executionOutcome: 'success',
        id: job.id,
        status: job.status,
        promptCount: job.prompts.length
      };
    },
    verify: async (output: any, input: { jobId: string }) => (
      verifyPersistedGenerationJobState(output, input, ['queued', 'running'], 'resume')
    ),
  },

  // 7. generation.retryJob - retry failed prompts in a durable generation job
  {
    name: 'generation.retryJob',
    description: 'Retry failed prompts in a durable batch generation job without resubmitting completed items.',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Durable generation job ID' },
        expectedUpdatedAt: { type: 'number', description: 'Queue job revision frozen before confirmation' },
        expectedRetryablePromptIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sorted retryable failed prompt IDs frozen before confirmation'
        }
      },
      required: ['jobId', 'expectedUpdatedAt', 'expectedRetryablePromptIds']
    },
    inputValidator: GenerationRetryJobInputSchema,
    handler: async (input: RetryJobInput, ctx) => {
      const queue = ctx.generationQueue || durableGenerationQueue;
      const resolvedJob = resolveRetryJob(input, queue);
      const actualRetryablePromptIds = resolvedJob.prompts
        .filter(prompt => prompt.status === 'failed' && prompt.retryable !== false)
        .map(prompt => prompt.id)
        .sort();
      const expectedRetryablePromptIds = [...input.expectedRetryablePromptIds].sort();
      const frozenScopeStillMatches = resolvedJob.updatedAt === input.expectedUpdatedAt
        && actualRetryablePromptIds.length === expectedRetryablePromptIds.length
        && actualRetryablePromptIds.every((promptId, index) => promptId === expectedRetryablePromptIds[index]);

      if (!frozenScopeStillMatches) {
        return {
          success: false,
          executionOutcome: 'failed',
          code: 'STALE_RETRY_TARGET',
          retryable: false,
          message: `Generation job ${resolvedJob.id} changed after confirmation preview; create a new retry plan.`,
          id: resolvedJob.id,
          status: resolvedJob.status,
          expectedUpdatedAt: input.expectedUpdatedAt,
          actualUpdatedAt: resolvedJob.updatedAt,
          expectedRetryablePromptIds,
          actualRetryablePromptIds,
        };
      }

      const retryingCount = actualRetryablePromptIds.length;
      if (retryingCount === 0) {
        return {
          success: false,
          executionOutcome: 'failed',
          code: 'NO_RETRYABLE_ITEMS',
          retryable: false,
          message: `Generation job ${resolvedJob.id} has no retryable failed items.`,
          id: resolvedJob.id,
          status: resolvedJob.status,
          resolvedFrom: 'explicit',
          retryingCount: 0,
          failedCount: resolvedJob.prompts.filter(prompt => prompt.status === 'failed').length,
          queuedCount: resolvedJob.prompts.filter(prompt => prompt.status === 'queued').length,
          promptCount: resolvedJob.prompts.length,
          outputGroup: resolvedJob.outputGroup,
          updatedAt: resolvedJob.updatedAt
        };
      }

      queue.retryFailedPrompts(resolvedJob.id);
      const job = queue.getJob(resolvedJob.id) || resolvedJob;

      ctx.notify?.success?.('失败项已重新入队', `已将 ${retryingCount} 个失败项重新加入 DurableGenerationQueue。`);
      return {
        success: true,
        executionOutcome: 'success',
        id: job.id,
        idempotencyKey: job.idempotencyKey,
        canvasId: job.canvasId,
        status: job.status,
        resolvedFrom: 'explicit',
        retryingCount,
        promptCount: job.prompts.length,
        completedCount: job.prompts.filter(prompt => prompt.status === 'completed').length,
        failedCount: job.prompts.filter(prompt => prompt.status === 'failed').length,
        runningCount: job.prompts.filter(prompt => prompt.status === 'running').length,
        queuedCount: job.prompts.filter(prompt => prompt.status === 'queued').length,
        outputGroup: job.outputGroup,
        updatedAt: job.updatedAt
      };
    },
    verify: async (output: any, input: RetryJobInput, ctx) => {
      if (Number(output?.retryingCount || 0) <= 0) {
        return { success: false, message: 'Retry did not requeue any failed generation item.' };
      }
      return verifyPersistedGenerationJobState(
        output,
        input,
        ['queued', 'running', 'completed', 'completed_with_errors'],
        'retry',
        ctx.generationQueue || durableGenerationQueue,
      );
    },
  },

  // 8. generation.getJobStatus - 读取批量生图任务状态摘要
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
    inputValidator: GenerationJobControlInputSchema,
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
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: '批量生图的任务ID' }
      },
      required: ['jobId']
    },
    inputValidator: GenerationJobControlInputSchema,
    handler: async (input: { jobId: string }, ctx) => {
      requireGenerationJob(input.jobId);
      durableGenerationQueue.cancelJob(input.jobId);
      const job = requireGenerationJob(input.jobId);
      ctx.notify?.success?.('任务已取消', `批量生图任务 ${input.jobId} 已取消。`);
      return {
        id: job.id,
        status: job.status,
        promptCount: job.prompts.length
      };
    },
    verify: async (output: any, input: { jobId: string }) => (
      verifyPersistedGenerationJobState(output, input, ['cancelled'], 'cancellation')
    ),
  },
  {
    name: 'generation.createAudioTask',
    description: '提交语音合成 (TTS) 或音乐生成任务',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '输入文本内容或音乐风格提示词' },
        voice: { type: 'string', description: '音色选择（如 minimax-tts 的 voice 参数）' },
        model: { type: 'string', description: '使用的音频生成模型ID（如 minimax-tts）' }
      },
      required: ['prompt']
    },
    handler: async (input: { prompt: string; voice?: string; model?: string }, ctx) => {
      const queuedJob = createSingleMediaJob({ ...input, modelId: input.model }, ctx, 'audio');
      ctx.notify.success('Audio job submitted', `Job ID: ${queuedJob.id}`);
      return queuedJob;
    },
    verify: (output: any) => verifyQueuedMediaJob(output, 'audio')
  },
  {
    name: 'provider.getModelCapabilities',
    description: '获取指定模型的路由与多模态（如图像理解）支持特征',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        modelId: { type: 'string' }
      },
      required: ['modelId']
    },
    handler: async (input: { modelId: string }, ctx) => {
      const cacheKey = input.modelId;
      const cached = modelCapabilitiesCache.get(cacheKey);
      if (cached) return cached;

      const { getModelRouteMeta } = ctx;
      let result;

      try {
        if (typeof getModelRouteMeta === 'function') {
          // 超时熔断机制：若 3000ms 未响应则触发超时熔断，降级语义路由
          result = await Promise.race([
            getModelRouteMeta(input.modelId),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('CapTimeout')), 3000))
          ]);
        }
      } catch (err) {
        console.warn(`[CapRouter] Failed to retrieve declared model capabilities:`, err);
      }

      if (!result) {
        result = {
          modelId: input.modelId,
          multimodal: false,
          image_understanding: false,
          generationCapabilities: null,
          fallback: 'undeclared'
        };
      }

      modelCapabilitiesCache.set(cacheKey, result);
      return result;
    }
  }
];
