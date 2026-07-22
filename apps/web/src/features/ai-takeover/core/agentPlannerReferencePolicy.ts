import type {
  AssistantAction,
  AssistantPlan,
  CanvasRuntimeState,
  SanitizedProjectContext,
} from '../types.ts';
import type { AgentPlannerSessionContext } from './agentPlannerContext.ts';

const HISTORICAL_SELECTION_REFERENCE = /(?:刚才|刚刚|上次|之前)(?:所)?(?:选中|选择|框选)?(?:的)?(?:那个|那张|那些|这些|卡片|图片|节点|内容)|(?:previously|just|last)\s+(?:selected\s+)?(?:card|image|node|one|ones)/iu;
const SINGULAR_REFERENCE = /那个|那一个|那张|它(?!们)|that\s+(?:one|card|image|node)|\bit\b/iu;
const SPECIFIC_SELECTION_OPERATION = /下载|打包|导出|压缩|整理|排列|排版|定位|查找|生成视频|做成视频|图生视频|换背景|修改|重绘|优化|download|zip|export|arrange|layout|locate|find|video|edit|redraw|optimi[sz]e/iu;
const VAGUE_CONTINUATION = /^(?:请)?\s*(?:继续|继续吧|继续一下|接着|接着来|continue|go\s+on|keep\s+going)\s*[。.!！?？]*$/iu;
const VAGUE_HISTORICAL_TASK = /^(?:请)?\s*(?:继续|接着)(?:处理|做|弄)?(?:刚才|刚刚|上次|之前)(?:选中|选择|框选)?(?:的)?(?:那个|那张|那些|这些|卡片|图片|节点|内容)?\s*[。.!！?？]*$/iu;
const GENERATION_JOB_ID = /\b(?:job|batch)_[a-zA-Z0-9_-]+\b/;

type ReferenceDecision =
  | { status: 'none' }
  | { status: 'resolved'; selectedNodeIds: string[] }
  | { status: 'clarification'; message: string };

function uniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function currentSelection(context: SanitizedProjectContext): string[] {
  const knownNodeIds = currentCanvasNodeIds(context);
  const runtimeIds = context.runtime?.selection.selectedNodeIds || [];
  const validRuntimeIds = uniqueIds(runtimeIds).filter((id) => knownNodeIds.has(id));
  return validRuntimeIds.length > 0
    ? validRuntimeIds
    : uniqueIds(context.canvas.selectedNodeIds).filter((id) => knownNodeIds.has(id));
}

function currentCanvasNodeIds(context: SanitizedProjectContext): Set<string> {
  return new Set([
    ...context.canvas.promptNodes.map((node) => node.id),
    ...context.canvas.imageNodes.map((node) => node.id),
    ...(context.runtime?.groups.map((group) => group.id) || []),
    ...(context.runtime?.selectedNodes.notes.map((node) => node.id) || []),
    ...(context.runtime?.selectedNodes.workflowPanels.map((node) => node.id) || []),
  ]);
}

function historicalSelection(
  context: SanitizedProjectContext,
  sessionContext?: AgentPlannerSessionContext,
): string[] {
  const knownNodeIds = currentCanvasNodeIds(context);
  return uniqueIds(sessionContext?.canvasSnapshot?.selectedNodeIds || [])
    .filter((id) => knownNodeIds.has(id));
}

function resolveReferenceDecision(
  userInput: string,
  context: SanitizedProjectContext,
  sessionContext?: AgentPlannerSessionContext,
): ReferenceDecision {
  const input = userInput.trim();
  if (VAGUE_CONTINUATION.test(input) || VAGUE_HISTORICAL_TASK.test(input)) {
    return { status: 'clarification', message: '请明确要继续哪项操作；普通“继续”不会恢复生成任务。' };
  }
  if (!HISTORICAL_SELECTION_REFERENCE.test(input)) return { status: 'none' };
  if (!SPECIFIC_SELECTION_OPERATION.test(input)) {
    return { status: 'clarification', message: '请说明要对刚才的卡片执行什么具体操作。' };
  }
  const candidates = currentSelection(context);
  const selectedNodeIds = candidates.length > 0 ? candidates : historicalSelection(context, sessionContext);
  if (selectedNodeIds.length === 0) {
    return { status: 'clarification', message: '无法在当前画布确认刚才的选区，请重新选择目标卡片。' };
  }
  if (SINGULAR_REFERENCE.test(input) && selectedNodeIds.length !== 1) {
    return { status: 'clarification', message: '刚才的选区包含多个卡片，请明确要处理哪一个。' };
  }
  return { status: 'resolved', selectedNodeIds };
}

function resolvedRuntimeSelection(
  context: SanitizedProjectContext,
  selectedNodeIds: string[],
): CanvasRuntimeState['selection'] | undefined {
  const selection = context.runtime?.selection;
  if (!selection) return undefined;
  const selected = new Set(selectedNodeIds);
  const promptNodeIds = context.canvas.promptNodes.map((node) => node.id).filter((id) => selected.has(id));
  const imageNodeIds = context.canvas.imageNodes.map((node) => node.id).filter((id) => selected.has(id));
  const childImageNodeIdsFromSelectedPrompts = context.canvas.imageNodes
    .filter((node) => node.parentPromptId && promptNodeIds.includes(node.parentPromptId))
    .map((node) => node.id);
  return {
    ...selection,
    selectedNodeIds,
    promptNodeIds,
    imageNodeIds,
    childImageNodeIdsFromSelectedPrompts,
    groupIds: selection.groupIds.filter((id) => selected.has(id)),
    noteNodeIds: selection.noteNodeIds.filter((id) => selected.has(id)),
    workflowNodeIds: selection.workflowNodeIds.filter((id) => selected.has(id)),
    count: selectedNodeIds.length,
  };
}

/** Adds only a uniquely resolved, current-canvas selection reference to Planner input. */
export function applyAgentPlannerReferenceContext(
  userInput: string,
  context: SanitizedProjectContext,
  sessionContext?: AgentPlannerSessionContext,
): SanitizedProjectContext {
  const decision = resolveReferenceDecision(userInput, context, sessionContext);
  if (decision.status !== 'resolved') return context;
  const runtimeSelection = resolvedRuntimeSelection(context, decision.selectedNodeIds);
  return {
    ...context,
    canvas: { ...context.canvas, selectedNodeIds: decision.selectedNodeIds },
    ...(context.runtime && runtimeSelection
      ? { runtime: { ...context.runtime, selection: runtimeSelection } }
      : {}),
  };
}

function plannedActions(plan: AssistantPlan): AssistantAction[] {
  return plan.steps && plan.steps.length > 0
    ? plan.steps.map((step) => step.action)
    : plan.actions;
}

function requestedGenerationJobId(userInput: string): string | undefined {
  return userInput.match(GENERATION_JOB_ID)?.[0];
}

function isExplicitResumeRequest(userInput: string, jobId: string): boolean {
  const requestedJobId = requestedGenerationJobId(userInput);
  if (!requestedJobId || requestedJobId !== jobId) return false;
  const command = userInput.replace(requestedJobId, ' ');
  const strongResume = /恢复|resume/iu.test(command);
  const continueCommand = /继续(?:执行|运行|生成|生图|处理)|continue\s+(?:running|processing|generating|execution)/iu.test(command);
  const pausedJobAnchor = /暂停|挂起|生成(?:任务|批次|队列)|生图(?:任务|批次|队列)|paused\s+(?:generation\s+)?(?:job|batch)/iu.test(command);
  return strongResume || (continueCommand && pausedJobAnchor);
}

function hasUnboundResumeAction(userInput: string, plan: AssistantPlan): boolean {
  return plannedActions(plan).some((action) => (
    action.type === 'generation.resumeJob'
    && !isExplicitResumeRequest(userInput, action.payload.jobId)
  ));
}

function actionReferenceTargetIds(action: AssistantAction): string[] | undefined {
  switch (action.type) {
    case 'startGeneration':
    case 'generation.start':
      return uniqueIds(action.payload.referenceImageNodeId ? [action.payload.referenceImageNodeId] : []);
    case 'assets.zipOriginals':
    case 'export.zipOriginals':
    case 'zipOutputs':
      return action.payload.scope === 'selected_cards'
        ? uniqueIds(action.payload.selectedNodeIds || [])
        : undefined;
    case 'canvas.arrangeNodes':
      return uniqueIds(action.payload.nodeIds);
    case 'generation.createVideoJob':
      return uniqueIds(action.payload.referenceImageNodeId ? [action.payload.referenceImageNodeId] : []);
    case 'ecommerce.createBatchTransformJob':
      return uniqueIds(action.payload.imageIds || []);
    case 'generation.createBatchJob':
      return uniqueIds(action.payload.prompts.flatMap((prompt: unknown) => {
        if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) return [];
        const referenceId = (prompt as Record<string, unknown>).referenceImageNodeId;
        return typeof referenceId === 'string' ? [referenceId] : [];
      }));
    default:
      return undefined;
  }
}

function sameIds(left: string[], right: string[]): boolean {
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

function hasSubstitutedReferenceTarget(plan: AssistantPlan, expectedIds: string[]): boolean {
  return plannedActions(plan).some((action) => {
    const actualIds = actionReferenceTargetIds(action);
    return actualIds !== undefined && !sameIds(actualIds, expectedIds);
  });
}

function clarificationPlan(plan: AssistantPlan, message: string): AssistantPlan {
  return {
    ...plan,
    reply: message,
    intent: 'unknown',
    confidence: Math.min(plan.confidence, 0.5),
    actions: [],
    steps: [],
    requiresConfirmation: false,
    confirmation: undefined,
  };
}

/** Removes any plan that treats historical context as execution authority. */
export function enforceAgentPlannerReferencePolicy(
  userInput: string,
  plan: AssistantPlan,
  context: SanitizedProjectContext,
  sessionContext?: AgentPlannerSessionContext,
): AssistantPlan {
  if (hasUnboundResumeAction(userInput, plan)) {
    return clarificationPlan(
      plan,
      '请在当前消息中明确要恢复的暂停任务，并提供具体 jobId；普通“继续”只会继续对话。',
    );
  }
  const decision = resolveReferenceDecision(userInput, context, sessionContext);
  if (decision.status === 'clarification') return clarificationPlan(plan, decision.message);
  if (decision.status === 'resolved' && hasSubstitutedReferenceTarget(plan, decision.selectedNodeIds)) {
    return clarificationPlan(plan, 'Planner 返回的目标与当前画布可确认的选区不一致，请重新选择或明确目标。');
  }
  return plan;
}
