import { GenerationMode, type Canvas, type GenerationConfig } from '../types.ts';
import type { AssistantToolExecutionContext } from '../features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';
import { createUserActionConfirmation } from '../features/ai-assistant-runtime/runtime/AssistantExecutionContext.ts';
import {
  createCanvasGenerationIdempotencyKey,
  resolveCanvasGenerationSelection,
} from './canvasGenerationSelection.ts';

interface CanvasGenerationNotificationPort {
  warning: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
}

interface SubmitCanvasGenerationBatchArgs {
  activeCanvas: Canvas;
  selectedNodeIds: readonly string[];
  submissionConfig: GenerationConfig;
  submissionPrompt: string;
  notify: CanvasGenerationNotificationPort;
  selectedNodeIdsRef: { current: string[] };
  activeCanvasRef: { current: Canvas | null | undefined };
  execute: (name: string, input: unknown, context: AssistantToolExecutionContext) => Promise<unknown>;
  onSubmitted: () => void;
}

type CanvasGenerationBatchInput = {
  prompts: Array<{
    id: string;
    prompt: string;
    targetNodeId: string;
    referenceImageNodeId?: string;
  }>;
  options: {
    taskType: 'image' | 'video' | 'audio';
    modelId: string;
    aspectRatio: string;
    imageSize: string;
    countPerPrompt: 1;
    layout: 'grid';
  };
  idempotencyKey: string;
  clientIdempotencyKey: string;
};

function getTaskType(mode: GenerationMode): CanvasGenerationBatchInput['options']['taskType'] {
  if (mode === GenerationMode.VIDEO) return 'video';
  if (mode === GenerationMode.AUDIO) return 'audio';
  return 'image';
}

function notifySelectionIssues(
  selection: ReturnType<typeof resolveCanvasGenerationSelection>,
  notify: CanvasGenerationNotificationPort,
): boolean {
  const skippedCount = selection.skippedNodeIds.length + selection.unsupportedNodeIds.length;
  if (selection.eligibleTargets.length === 0) {
    notify.warning(
      '没有可生成的目标卡片',
      `当前模式不支持所选卡片，已跳过 ${skippedCount} 个目标。请切换生成模式或选择兼容卡片。`,
    );
    return false;
  }
  if (skippedCount > 0) {
    notify.info(
      '已过滤不兼容卡片',
      `当前模式将生成 ${selection.eligibleTargets.length} 张，跳过 ${skippedCount} 张不兼容卡片。`,
    );
  }
  return true;
}

function buildCanvasGenerationBatchInput(
  activeCanvas: Canvas,
  selection: ReturnType<typeof resolveCanvasGenerationSelection>,
  submissionConfig: GenerationConfig,
  submissionPrompt: string,
): CanvasGenerationBatchInput {
  const prompts = selection.eligibleTargets
    .slice()
    .sort((left, right) => left.promptNodeId.localeCompare(right.promptNodeId))
    .map((target, index) => ({
      id: `canvas_target_${index}_${target.promptNodeId}`,
      prompt: submissionPrompt,
      targetNodeId: target.promptNodeId,
      referenceImageNodeId: target.referenceImageNodeId,
    }));
  const idempotencyKey = createCanvasGenerationIdempotencyKey({
    canvasId: activeCanvas.id,
    mode: submissionConfig.mode,
    prompt: submissionPrompt,
    targetNodeIds: prompts.map((item) => item.targetNodeId),
  });
  return {
    prompts,
    options: {
      taskType: getTaskType(submissionConfig.mode),
      modelId: String(submissionConfig.model),
      aspectRatio: String(submissionConfig.aspectRatio),
      imageSize: String(submissionConfig.imageSize),
      countPerPrompt: 1,
      layout: 'grid',
    },
    idempotencyKey,
    clientIdempotencyKey: idempotencyKey,
  };
}

type CanvasGenerationExecutionArgs = Omit<SubmitCanvasGenerationBatchArgs, 'onSubmitted'>;

function buildCanvasExecutionScope(args: CanvasGenerationExecutionArgs): Record<string, unknown> {
  return {
    currentPage: 'canvas',
    activeCanvas: args.activeCanvas,
    selectedNodeIds: [...args.selectedNodeIds],
    selectedModel: { id: args.submissionConfig.model },
    config: args.submissionConfig,
    getActiveCanvas: () => args.activeCanvasRef.current || undefined,
    getSelectedNodeIds: () => args.selectedNodeIdsRef.current,
  };
}

async function executeCanvasGenerationBatch(
  args: CanvasGenerationExecutionArgs,
  batchInput: CanvasGenerationBatchInput,
): Promise<void> {
  const executionScope = buildCanvasExecutionScope(args);
  const confirmation = createUserActionConfirmation(
    'generation.createBatchJob',
    batchInput,
    executionScope,
  );
  await args.execute('generation.createBatchJob', batchInput, {
    ...confirmation,
    ...executionScope,
    notify: args.notify,
  });
}

/** Submits a selection-aware canvas batch without creating duplicate prompt nodes. */
export async function submitCanvasGenerationBatch({
  activeCanvas,
  selectedNodeIds,
  submissionConfig,
  submissionPrompt,
  notify,
  selectedNodeIdsRef,
  activeCanvasRef,
  execute,
  onSubmitted,
}: SubmitCanvasGenerationBatchArgs): Promise<boolean> {
  const selection = resolveCanvasGenerationSelection(activeCanvas, selectedNodeIds, submissionConfig);
  if (!notifySelectionIssues(selection, notify)) return true;
  const batchInput = buildCanvasGenerationBatchInput(
    activeCanvas,
    selection,
    submissionConfig,
    submissionPrompt,
  );

  try {
    await executeCanvasGenerationBatch({
      activeCanvas,
      selectedNodeIds,
      submissionConfig,
      submissionPrompt,
      notify,
      selectedNodeIdsRef,
      activeCanvasRef,
      execute,
    }, batchInput);
    onSubmitted();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '任务未能加入持久化队列。';
    notify.error('批量生成提交失败', message);
  }

  return true;
}
