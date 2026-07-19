// 简体中文：AI 接管上下文控制中心 (AITakeover Context)

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import type {
  AssistantCollaborationMode,
  AssistantContextSuggestion,
  AssistantPlan,
  AssistantWorkspaceSurface,
  CanvasRuntimeState,
  SanitizedProjectContext,
} from '../types';
import { buildSanitizedProjectContext } from '../core/projectContextBuilder';
import { buildCanvasRuntimeState } from '../core/canvasRuntimeStateBuilder';
import {
  ASSISTANT_COLLABORATION_MODE_STORAGE_KEY,
  buildAssistantContextSuggestions,
  normalizeAssistantCollaborationMode,
} from '../core/collaborationMode';
import { useAssetStore } from '../../assets/assetStore';
import { durableGenerationQueue, type GenerationExecutorResult } from '../../ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import { startGenerationQueueSync } from '../../ai-assistant-runtime/queue/GenerationQueueSync.ts';
import { resolveAgentGroupBounds } from '../../ai-assistant-runtime/canvas/agentCanvasLayout.ts';
import {
  agentRuntimeInstance,
  agentRunStore,
  buildAgentRunTimeline,
  captureAssistantAuthorizationScope,
  type AssistantAuthorizationScopeSnapshot,
  type AssistantExecutionContext,
  type AssistantExecutionTrigger,
  type AssistantSiteCapabilityPorts,
  type AgentRunRecord,
  type AgentRunTimelineStep,
  toolRegistryInstance,
} from '../../ai-assistant-runtime';

type LlmChat = typeof import('../../generation/generateService')['generationService']['chat'];

const chatWithLlm: LlmChat = async (...args) => {
  const { generationService } = await import('../../generation/generateService');
  return generationService.chat(...args);
};

const getQueuePromptNodeId = (jobId: string, promptId: string): string => (
  `takeover_batch_${jobId}_${promptId}`.replace(/[^a-zA-Z0-9_-]/g, '_')
);

const hasExecutablePlanActions = (plan: AssistantPlan): boolean => (
  (plan.steps?.length || plan.actions?.length || 0) > 0
);

const buildAssistancePreviewPlan = (plan: AssistantPlan): AssistantPlan => ({
  ...plan,
  requiresConfirmation: true,
  confirmation: {
    title: 'AI 辅助建议',
    summary: plan.confirmation?.summary || plan.reply || '已根据当前页面和选区生成下一步建议。',
    confirmText: '交给 AI 执行',
    cancelText: '暂不执行',
  },
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: any[];
}


interface AITakeoverContextType {
  collaborationMode: AssistantCollaborationMode;
  setCollaborationMode: (mode: AssistantCollaborationMode) => void;
  aiTakeoverMode: boolean;
  setAiTakeoverMode: (enabled: boolean) => void;
  canvasRuntimeState: CanvasRuntimeState;
  contextSuggestions: AssistantContextSuggestion[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isThinking: boolean;
  sendMessage: (text: string) => Promise<void>;
  pendingPlan: AssistantPlan | null;
  setPendingPlan: (plan: AssistantPlan | null) => void;
  executePendingPlan: () => Promise<void>;
  cancelPendingPlan: () => void;
  selectedModel: any;
  setSelectedModel: (model: any) => void;
  currentRunId: string | null;
  currentRun: AgentRunRecord | null;
  agentRunTimeline: AgentRunTimelineStep[];
  compressContext: () => Promise<void>;
  isCompressing: boolean;
  onOpenSettings?: (view?: any) => void;
  notify?: any;
  activeCanvas?: any;
  selectNodes?: (ids: string[], mode?: any) => void;
}

const AITakeoverContext = createContext<AITakeoverContextType | null>(null);

interface AITakeoverProviderProps {
  children: ReactNode;
  currentPage?: AssistantWorkspaceSurface;
  activeCanvas: any;
  selectedModel: any;
  selectedNodeIds: string[];
  addPromptNode: (node: any) => Promise<void> | void;
  updatePromptNode: (node: any) => Promise<void> | void;
  deletePromptNode?: (id: string) => void;
  updateNodes?: (updates: { promptNodes?: any[]; imageNodes?: any[] }) => void;
  createCard?: (input: any) => any;
  convertDrawingsToNote?: (drawingIds: string[], title?: string) => any;
  updateWorkflowNode?: (id: string, updates: any) => void;
  rasterizeNote?: (id: string, scale?: number) => Promise<any>;
  executeGeneration: (node: any) => Promise<void> | void;
  getNextCardPosition: () => { x: number; y: number };
  arrangeAllNodes?: (mode?: 'grid' | 'row' | 'column', nodeIds?: string[]) => void;
  addGroup?: (group: any) => void;
  updateGroup?: (group: any) => void;
  setNodeTags?: (ids: string[], tags: string[]) => void;
  selectNodes?: (ids: string[], mode?: any) => void;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  onOpenSettings?: (view?: any) => void;
  openLibrarySurface?: () => void;
  openFavoritesSurface?: () => void;
  openProfileSurface?: (view?: any) => void;
  focusWorkspace?: () => void;
  apiKeyStatus: 'missing' | 'configured_masked' | 'invalid' | 'unknown';
  balance: number;
  notify: any;
  config?: any;
  ecommerceState?: any;
  onGenerate?: () => Promise<void> | void;
  canvasTransform?: { x: number; y: number; scale: number } | null;
  canvasRef?: any;
  openToolWindowInstance?: (toolId: string, url?: string, options?: any) => void;
  updateToolWindowLayout?: (instanceId: string, layout: Partial<any>) => void;
  setPptEditorMode?: (mode: string) => void;
  togglePinTool?: (toolId: string, pinned: boolean) => void;
  siteCapabilities?: AssistantSiteCapabilityPorts;
}

export function AITakeoverProvider({
  children,
  currentPage = 'canvas',
  activeCanvas,
  selectedModel: initialModel,
  selectedNodeIds,
  addPromptNode,
  updatePromptNode,
  deletePromptNode,
  updateNodes,
  createCard,
  convertDrawingsToNote,
  updateWorkflowNode,
  rasterizeNote,
  executeGeneration,
  getNextCardPosition,
  arrangeAllNodes,
  addGroup,
  updateGroup,
  setNodeTags,
  selectNodes,
  setConfig,
  onOpenSettings,
  openLibrarySurface,
  openFavoritesSurface,
  openProfileSurface,
  focusWorkspace,
  apiKeyStatus,
  balance,
  notify,
  config,
  ecommerceState,
  onGenerate,
  canvasTransform,
  canvasRef,
  openToolWindowInstance,
  updateToolWindowLayout,
  setPptEditorMode,
  togglePinTool,
  siteCapabilities
}: AITakeoverProviderProps) {

  useEffect(() => startGenerationQueueSync(), []);

  const [collaborationMode, setCollaborationModeState] = useState<AssistantCollaborationMode>(() => {
    try {
      return normalizeAssistantCollaborationMode(
        globalThis.localStorage?.getItem(ASSISTANT_COLLABORATION_MODE_STORAGE_KEY),
      );
    } catch {
      return 'direct';
    }
  });
  const aiTakeoverMode = collaborationMode === 'takeover';
  const [selectedModel, setSelectedModel] = useState(initialModel);

  const canvasRuntimeState = React.useMemo(() => buildCanvasRuntimeState({
    currentPage,
    activeCanvas,
    selectedNodeIds: selectedNodeIds || [],
    canvasTransform,
    canvasRef,
    config,
  }), [activeCanvas, canvasRef, canvasTransform, config, currentPage, selectedNodeIds]);
  const contextSuggestions = React.useMemo(
    () => buildAssistantContextSuggestions(canvasRuntimeState),
    [canvasRuntimeState],
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // 简体中文：一键压缩接管助理上下文
  const compressContext = useCallback(async () => {
    if (isCompressing || messages.filter(m => m.id !== 'welcome').length <= 1) return;
    setIsCompressing(true);

    try {
      let boundaryIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].content.includes('上下文压缩分界线')) {
          boundaryIndex = i;
          break;
        }
      }
      const filteredMsgs = boundaryIndex !== -1 ? messages.slice(boundaryIndex) : messages;

      const history = filteredMsgs
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const promptText = "请为我们之前的对话内容进行一次高度精炼的摘要总结，提炼出核心的事实、当前的任务状态和关键决策。要求言简意赅，不要有任何客套话。";
      
      const responseText = await chatWithLlm({
        modelId: selectedModel?.id || 'gemini-2.5-flash',
        messages: [
          ...history,
          { role: 'user', content: promptText }
        ]
      });

      if (!responseText) throw new Error("大模型未能返回摘要内容");

      const summaryContent = `--- 📌 上下文压缩分界线 (已归档历史) ---\n以下是此前对话内容的摘要总结：\n\n${responseText}\n\n此前的历史已被压缩归档，后续对话将基于此摘要进行。`;
      const boundaryMessage: Message = {
        id: `boundary_${Date.now()}`,
        role: 'assistant',
        content: summaryContent,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, boundaryMessage]);
      if (notify) {
        notify.success("上下文压缩成功！", "已成功通过摘要生成归档分界线，释放本地接管助理的上下文缓存。");
      }
    } catch (error: any) {
      console.error("Context compression failed:", error);
      if (notify) {
        notify.error("上下文压缩失败", error.message || "未知错误");
      }
    } finally {
      setIsCompressing(false);
    }
  }, [messages, selectedModel, isCompressing, notify]);

  const [restoredPendingRun] = useState<AgentRunRecord | null>(() => agentRunStore.getPendingRun() ?? null);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AssistantPlan | null>(() => {
    if (!restoredPendingRun?.plan) return null;
    return collaborationMode === 'assist'
      ? buildAssistancePreviewPlan(restoredPendingRun.plan as AssistantPlan)
      : restoredPendingRun.plan as AssistantPlan;
  });
  const [pendingAuthorizationScope, setPendingAuthorizationScope] = useState<AssistantAuthorizationScopeSnapshot | null>(() => (
    restoredPendingRun
      ? captureAssistantAuthorizationScope({
          currentPage,
          activeCanvas,
          selectedNodeIds: selectedNodeIds || [],
          canvasRuntimeState,
          selectedModel,
          config,
          ecommerceState,
        })
      : null
  ));
  const [currentRunId, setCurrentRunId] = useState<string | null>(() => restoredPendingRun?.id ?? null);
  const [currentRun, setCurrentRun] = useState<AgentRunRecord | null>(() => restoredPendingRun);
  const agentRunTimeline = React.useMemo(() => buildAgentRunTimeline(currentRun), [currentRun]);

  useEffect(() => {
    // getPendingRun() can convert an interrupted run into a pending failed snapshot.
    // Trigger the durable backend flush after React has restored that local state.
    agentRuntimeInstance.requestPendingRunSync();
  }, []);



  const setCollaborationMode = useCallback((mode: AssistantCollaborationMode) => {
    const nextMode = normalizeAssistantCollaborationMode(mode);
    setCollaborationModeState(nextMode);
    try {
      globalThis.localStorage?.setItem(ASSISTANT_COLLABORATION_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Browser storage is optional; the in-memory mode remains authoritative for this session.
    }
    if (notify) {
      if (nextMode === 'takeover') {
        notify.success('AI 接管已开启', '低风险步骤可自动执行，高风险步骤仍会请求确认。');
      } else if (nextMode === 'assist') {
        notify.info('AI 辅助已开启', '建议会同步当前页面与选区，执行前由你决定。');
      } else {
        notify.info('已切换到直接操作', '画布保持可编辑，进行中的持久任务不会丢失。');
      }
    }
  }, [notify]);

  const setAiTakeoverMode = useCallback((enabled: boolean) => {
    setCollaborationMode(enabled ? 'takeover' : 'direct');
  }, [setCollaborationMode]);

  useEffect(() => {
    const syncModeFromStorage = (event: StorageEvent) => {
      if (event.key !== ASSISTANT_COLLABORATION_MODE_STORAGE_KEY) return;
      setCollaborationModeState(normalizeAssistantCollaborationMode(event.newValue));
    };
    window.addEventListener('storage', syncModeFromStorage);
    return () => window.removeEventListener('storage', syncModeFromStorage);
  }, []);

  // 执行计划（桥接到 AgentRuntime）
  const executePlan = useCallback(async (
    runId: string,
    trigger: AssistantExecutionTrigger,
    confirmedByUser = false,
    confirmedPlanSnapshot?: AssistantPlan,
    confirmedAuthorizationScope?: AssistantAuthorizationScopeSnapshot,
  ) => {
    const ctx: AssistantExecutionContext = {
      runId,
      currentPage,
      collaborationMode,
      trigger,
      activeCanvas: activeCanvasRef.current,
      selectedNodeIds: selectedNodeIdsRef.current,
      canvasRuntimeState: canvasRuntimeStateRef.current,
      canvasRevision: activeCanvasRef.current?.lastModified || 0,
      getActiveCanvas: () => activeCanvasRef.current,
      getSelectedNodeIds: () => selectedNodeIdsRef.current,
      getCanvasRuntimeState: () => canvasRuntimeStateRef.current,
      generationQueue: durableGenerationQueue,
      runStore: agentRunStore,
      siteCapabilities,
      selectedModel,
      addPromptNode,
      updatePromptNode,
      updateNodes,
      createCard,
      convertDrawingsToNote,
      updateWorkflowNode,
      rasterizeNote,
      executeGeneration,
      getNextCardPosition,
      arrangeAllNodes,
      addGroup,
      updateGroup,
      setNodeTags,
      selectNodes: selectNodesRef.current,
      setConfig,
      onOpenSettings,
      openLibrarySurface,
      openFavoritesSurface,
      openProfileSurface,
      focusWorkspace,
      notify,
      config,
      ecommerceState,
      onGenerate,
      openToolWindowInstance,
      updateToolWindowLayout,
      setPptEditorMode,
      togglePinTool
    };
    if (confirmedByUser) {
      if (!confirmedPlanSnapshot) {
        throw new Error('Cannot execute a confirmed plan without the exact preview shown to the user.');
      }
      if (!confirmedAuthorizationScope) {
        throw new Error('Cannot execute a confirmed plan without the authorization scope shown to the user.');
      }
      ctx.planId = confirmedPlanSnapshot.id;
      ctx.confirmationGrant = agentRuntimeInstance.createConfirmationGrant(
        runId,
        confirmedPlanSnapshot,
        ctx,
        confirmedAuthorizationScope,
      );
    }
    ctx.executeTool = (toolName: string, input: unknown, extra: Partial<AssistantExecutionContext> = {}) => (
      toolRegistryInstance.execute(toolName, input, { ...ctx, ...extra })
    );

    setCurrentRun(agentRunStore.getRun(runId) ?? null);
    try {
      await agentRuntimeInstance.executePendingRun(runId, ctx);
    } finally {
      setCurrentRun(agentRunStore.getRun(runId) ?? null);
    }
  }, [activeCanvas, selectedModel, selectedNodeIds, addPromptNode, updatePromptNode, updateNodes, createCard, convertDrawingsToNote, updateWorkflowNode, rasterizeNote, executeGeneration, getNextCardPosition, arrangeAllNodes, addGroup, updateGroup, setNodeTags, selectNodes, setConfig, onOpenSettings, openLibrarySurface, openFavoritesSurface, openProfileSurface, focusWorkspace, notify, config, ecommerceState, onGenerate, openToolWindowInstance, updateToolWindowLayout, setPptEditorMode, togglePinTool, siteCapabilities, currentPage, collaborationMode]);


  // 发送消息
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isThinking) return;

    const userMsg: Message = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setPendingPlan(null);
    setPendingAuthorizationScope(null);
    setCurrentRunId(null);
    setCurrentRun(null);

    // 智能脱敏上下文构建
    const assetsSummary = useAssetStore.getState().getAssetsSummary();
    const projectContext = buildSanitizedProjectContext({
      currentPage,
      aiTakeoverEnabled: collaborationMode === 'takeover',
      agentEnabled: collaborationMode !== 'direct',
      collaborationMode,
      activeCanvas,
      selectedNodeIds: selectedNodeIds || [],
      apiKeyStatus,
      providerCount: 1,
      selectedModel: selectedModel?.id,
      balanceKnown: true,
      canEstimateCost: true,
      assetsSummary,
      projectSnapshot: siteCapabilities?.project.getSnapshot(),
      errors: [],
      config,
      ecommerceState,
      canvasTransform,
      canvasRef
    });

    try {
      // 模拟大脑思考用时，提升拟人化感官
      await new Promise(resolve => setTimeout(resolve, 800));

      const record = await agentRuntimeInstance.run(text, projectContext, selectedModel?.id);
      const plan = record.plan;

      const assistantMsg: Message = {
        id: record.id,
        role: 'assistant',
        content: plan.reply,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);
      setCurrentRunId(record.id);
      setCurrentRun(record);

      // 评估是否需要确认卡片
      if (collaborationMode === 'assist' && hasExecutablePlanActions(plan)) {
        const previewPlan = buildAssistancePreviewPlan(plan);
        const previewRecord = agentRunStore.updateRun(record.id, {
          plan: previewPlan,
          status: 'waiting_confirmation',
          nextStep: '等待用户确认 AI 辅助建议。',
        });
        setPendingAuthorizationScope(captureAssistantAuthorizationScope({
          currentPage,
          activeCanvas,
          selectedNodeIds: selectedNodeIds || [],
          canvasRuntimeState,
          selectedModel,
          config,
          ecommerceState,
        }));
        setPendingPlan(previewPlan);
        setCurrentRun(previewRecord);
      } else if (plan.requiresConfirmation) {
        setPendingAuthorizationScope(captureAssistantAuthorizationScope({
          currentPage,
          activeCanvas,
          selectedNodeIds: selectedNodeIds || [],
          canvasRuntimeState,
          selectedModel,
          config,
          ecommerceState,
        }));
        setPendingPlan(plan);
      } else {
        // 如果不需要确认，静默且自动安全地执行
        await executePlan(record.id, 'takeover-auto');
      }
    } catch (e: any) {
      notify?.error('助手脑出现异常', e.message || '未知错误');
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, activeCanvas, selectedModel, selectedNodeIds, apiKeyStatus, executePlan, notify, config, ecommerceState, canvasTransform, canvasRef, canvasRuntimeState, collaborationMode, currentPage, siteCapabilities]);


  // 用户点击“确认执行”
  const executePendingPlan = useCallback(async () => {
    if (!currentRunId || !pendingPlan || !pendingAuthorizationScope) return;
    const runId = currentRunId;
    const confirmedPlanSnapshot = pendingPlan;
    const confirmedAuthorizationScope = pendingAuthorizationScope;
    setPendingPlan(null);
    setPendingAuthorizationScope(null);
    try {
      await executePlan(
        runId,
        collaborationMode === 'assist' ? 'assist-confirmed' : 'takeover-confirmed',
        true,
        confirmedPlanSnapshot,
        confirmedAuthorizationScope,
      );
    } catch (error) {
      setPendingPlan(confirmedPlanSnapshot);
      setPendingAuthorizationScope(confirmedAuthorizationScope);
      throw error;
    } finally {
      const latest = agentRunStore.getRun(runId);
      if (!latest || ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(latest.status)) {
        setCurrentRunId(null);
      }
    }
  }, [currentRunId, pendingPlan, pendingAuthorizationScope, executePlan, collaborationMode]);

  // 用户点击“取消计划”
  const cancelPendingPlan = useCallback(() => {
    const runId = currentRunId;
    const wasRunning = currentRun?.status === 'running';
    setPendingPlan(null);
    setPendingAuthorizationScope(null);

    if (runId) {
      void agentRuntimeInstance.cancelPendingRun(runId)
        .then(() => setCurrentRun(agentRunStore.getRun(runId) ?? null))
        .catch(error => console.error('[AITakeover] cancel pending run failed:', error));
      setCurrentRunId(null);
    }
    
    // 取消后，智能友好地提醒用户可选润色方案
    const cancelMsg: Message = {
      id: 'cancel_' + Date.now(),
      role: 'assistant',
      content: wasRunning ? `⏹️ **已请求停止运行**
当前步骤正在取消，后续依赖步骤不会启动。已经完成的步骤和已产生的费用不会自动回滚。`
        : `❌ **操作已取消**
我不会执行本次生图计划，也没有扣减您的积分。
您可以选择：
- 🔍 [只优化提示词并填充](action://takeover-prompt-only)
- 📝 [整理我的批量方案为文案](action://takeover-prompt-doc)`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, cancelMsg]);
  }, [currentRunId, currentRun?.status]);

  // 简体中文：利用 Refs 跟踪最新的 React 状态与生图回调，供单例持久化队列消费以防闭包陈旧
  const activeCanvasRef = useRef(activeCanvas);
  const selectedNodeIdsRef = useRef(selectedNodeIds || []);
  const canvasRuntimeStateRef = useRef(canvasRuntimeState);
  const selectedModelRef = useRef(selectedModel);
  const addPromptNodeRef = useRef(addPromptNode);
  const updatePromptNodeRef = useRef(updatePromptNode);
  const deletePromptNodeRef = useRef(deletePromptNode);
  const updateNodesRef = useRef(updateNodes);
  const executeGenerationRef = useRef(executeGeneration);
  const getNextCardPositionRef = useRef(getNextCardPosition);
  const arrangeAllNodesRef = useRef(arrangeAllNodes);
  const addGroupRef = useRef(addGroup);
  const updateGroupRef = useRef(updateGroup);
  const setNodeTagsRef = useRef(setNodeTags);
  const selectNodesRef = useRef(selectNodes);

  useEffect(() => {
    activeCanvasRef.current = activeCanvas;
    selectedNodeIdsRef.current = selectedNodeIds || [];
    canvasRuntimeStateRef.current = canvasRuntimeState;
    selectedModelRef.current = selectedModel;
    addPromptNodeRef.current = addPromptNode;
    updatePromptNodeRef.current = updatePromptNode;
    deletePromptNodeRef.current = deletePromptNode;
    updateNodesRef.current = updateNodes;
    executeGenerationRef.current = executeGeneration;
    getNextCardPositionRef.current = getNextCardPosition;
    arrangeAllNodesRef.current = arrangeAllNodes;
    addGroupRef.current = addGroup;
    updateGroupRef.current = updateGroup;
    setNodeTagsRef.current = setNodeTags;
    selectNodesRef.current = selectNodes;
  });

  useEffect(() => {
    // 向队列注册具体的图片生成任务 executor 桥接逻辑
    durableGenerationQueue.registerExecutor(async (promptText, options, jobId, promptId, signal) => {
      if (signal.aborted) {
        throw new DOMException('Generation cancelled', 'AbortError');
      }
      const lastPos = getNextCardPositionRef.current();
      const job = durableGenerationQueue.getJob(jobId);
      const index = job ? job.prompts.findIndex(p => p.id === promptId) : 0;
      const strayDraft = activeCanvasRef.current?.promptNodes?.find((node: any) => node.isDraft);
      const shouldKeepPromptNode = job?.outputGroup?.includePromptNodes !== false;
      const useDraft = shouldKeepPromptNode && index === 0 && strayDraft;
      const deterministicNodeId = getQueuePromptNodeId(jobId, promptId);
      const existingQueueNode = activeCanvasRef.current?.promptNodes?.find((node: any) => node.id === deterministicNodeId);
      const nodeId = useDraft ? strayDraft.id : deterministicNodeId;
      const pos = useDraft ? strayDraft.position : existingQueueNode?.position || {
        x: lastPos.x + (index >= 0 ? index : 0) * 420,
        y: lastPos.y
      };

      const referenceImages: any[] = [];
      if (options.referenceImageNodeId) {
        const sourceImg = activeCanvasRef.current?.imageNodes?.find((img: any) => img.id === options.referenceImageNodeId);
        if (sourceImg) {
          referenceImages.push({
            id: sourceImg.id,
            url: sourceImg.url,
            label: sourceImg.name || '参考图'
          });
        } else {
          const assetImg = useAssetStore.getState().images.find((img: any) => img.id === options.referenceImageNodeId);
          if (assetImg?.thumbnailUrl) {
            referenceImages.push({
              id: assetImg.id,
              url: assetImg.thumbnailUrl,
              label: assetImg.name || 'Reference image'
            });
          }
        }
      }

      const tags = ['automation', 'batch:' + jobId];
      const nodeData = {
        id: nodeId,
        prompt: promptText,
        position: pos,
        aspectRatio: options.aspectRatio,
        imageSize: options.imageSize,
        model: options.modelId,
        modelLabel: options.modelId,
        provider: selectedModelRef.current?.provider || 'Google',
        childImageIds: [],
        timestamp: Date.now(),
        parallelCount: options.countPerPrompt || 1,
        isGenerating: true,
        isDraft: false,
        hiddenInCanvas: job?.outputGroup?.includePromptNodes === false,
        status: 'queued',
        mode: options.taskType,
        videoDuration: options.durationSeconds ? `${options.durationSeconds}s` : undefined,
        videoResolution: options.resolution,
        videoAudio: options.generateAudio,
        videoFirstFrameUrl: options.firstFrameAssetId,
        videoLastFrameUrl: options.lastFrameAssetId,
        audioDuration: options.durationSeconds ? `${options.durationSeconds}s` : undefined,
        audioLyrics: options.lyrics,
        referenceImages,
        tags
      };

      // 1. 先把准备执行生成的 prompt 节点加入或更新到画布
      if (useDraft || existingQueueNode) {
        console.log('[TakeoverQueue] Reusing queue prompt node:', nodeId);
        await updatePromptNodeRef.current({
          ...(useDraft ? strayDraft : existingQueueNode),
          ...nodeData
        });
        if (useDraft) setConfig((prev: any) => ({ ...prev, prompt: '', referenceImages: [] }));
      } else {
        console.log('[TakeoverQueue] Creating new node for queue generation:', nodeId);
        await addPromptNodeRef.current(nodeData);
      }

      // 2. 拉起真正的生成逻辑 (由 useImageGeneration hook 承担)
      await executeGenerationRef.current({
        ...(useDraft ? strayDraft : {}),
        ...nodeData,
        isGenerating: true,
        status: 'idle'
      });

      // 3. 轮询监听该卡片的生成状态（isGenerating 变为 false 时代表成功或失败）
      return new Promise<GenerationExecutorResult>((resolve, reject) => {
        let attempts = 0;
        const cleanup = () => {
          clearInterval(interval);
          signal.removeEventListener('abort', handleAbort);
        };
        const handleAbort = () => {
          cleanup();
          reject(new DOMException('Generation cancelled', 'AbortError'));
        };
        const interval = setInterval(() => {
          attempts++;
          const currentCanvas = activeCanvasRef.current;
          const node = currentCanvas?.promptNodes?.find((n: any) => n.id === nodeId);
          if (node) {
            if (!node.isGenerating) {
              cleanup();
              if (node.status === 'failed' || node.error) {
                if (!shouldKeepPromptNode) deletePromptNodeRef.current?.(nodeId);
                reject(new Error(node.error || '生图失败'));
              } else {
                const resultImageNodeIds = node.childImageIds || [];
                if (!shouldKeepPromptNode) deletePromptNodeRef.current?.(nodeId);
                resolve({
                  promptNodeId: shouldKeepPromptNode ? nodeId : undefined,
                  resultImageNodeIds,
                  nodeIds: shouldKeepPromptNode ? [nodeId, ...resultImageNodeIds] : resultImageNodeIds,
                  providerTaskId: node.jobId
                } as any);
              }
            }
          } else {
            cleanup();
            reject(new Error('Prompt node deleted'));
          }

          if (attempts > 120) {
            cleanup();
            reject(new Error('Generation timeout'));
          }
        }, 1000);
        signal.addEventListener('abort', handleAbort, { once: true });
        if (signal.aborted) handleAbort();
      });
    });

    // 注册自动排版 handler
    durableGenerationQueue.registerArrangeHandler(async (nodeIds, options) => {
      console.log('[DurableQueue] Job completed, nodes ready to arrange:', nodeIds);
      if (arrangeAllNodesRef.current) {
        arrangeAllNodesRef.current(options.layout || 'grid', nodeIds);
      }
    });

    durableGenerationQueue.registerCompletionHandler(async (job, nodeIds) => {
      const outputGroup = job.outputGroup;
      if (!outputGroup || nodeIds.length === 0) {
        return;
      }

      const canvas = activeCanvasRef.current;
      if (!canvas) {
        return;
      }

      const groupId = outputGroup.groupId || `assistant_batch_group_${job.id}`;
      outputGroup.groupId = groupId;
      const tags = Array.from(new Set([
        'automation',
        `batch:${job.id}`,
        ...(outputGroup.tags || [])
      ]));
      const nodeIdSet = new Set(nodeIds);

      if (updateNodesRef.current) {
        updateNodesRef.current({
          promptNodes: (canvas.promptNodes || [])
            .filter((node: any) => nodeIdSet.has(node.id))
            .map((node: any) => ({
              id: node.id,
              updates: { tags: Array.from(new Set([...(node.tags || []), ...tags])) }
            })),
          imageNodes: (canvas.imageNodes || [])
            .filter((node: any) => nodeIdSet.has(node.id))
            .map((node: any) => ({
              id: node.id,
              updates: { tags: Array.from(new Set([...(node.tags || []), ...tags])) }
            }))
        });
      } else if (setNodeTagsRef.current) {
        setNodeTagsRef.current(nodeIds, tags);
      }

      const bounds = resolveAgentGroupBounds(canvas, nodeIds);
      const existingGroup = (canvas.groups || []).find((group: any) => group.id === groupId);
      const nextGroup = {
        ...(existingGroup || {}),
        id: groupId,
        nodeIds: Array.from(new Set([...(existingGroup?.nodeIds || []), ...nodeIds])),
        bounds,
        label: outputGroup.label || 'AI batch output',
        color: outputGroup.color || '#ffffff',
        type: 'custom'
      };

      if (existingGroup) {
        updateGroupRef.current?.(nextGroup);
      } else {
        addGroupRef.current?.(nextGroup);
      }
    });

    // 挂载时，自动触发/恢复排队及挂起的批量任务
    const legacyQueuePromptNodeIds = new Set(
      durableGenerationQueue.getJobs()
        .filter((job) => job.outputGroup?.includePromptNodes === false)
        .flatMap((job) => job.prompts.map((prompt) => getQueuePromptNodeId(job.id, prompt.id)))
    );
    (activeCanvasRef.current?.promptNodes || [])
      .filter((node: any) => legacyQueuePromptNodeIds.has(node.id))
      .forEach((node: any) => deletePromptNodeRef.current?.(node.id));

    durableGenerationQueue.processQueue();

    const handleOnline = () => {
      console.log('[TakeoverQueue] Network reconnected, resuming pending generation tasks...');
      durableGenerationQueue.processQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <AITakeoverContext.Provider
      value={{
        collaborationMode,
        setCollaborationMode,
        aiTakeoverMode,
        setAiTakeoverMode,
        canvasRuntimeState,
        contextSuggestions,
        messages,
        setMessages,
        isThinking,
        sendMessage,
        pendingPlan,
        setPendingPlan,
        executePendingPlan,
        cancelPendingPlan,
        selectedModel,
        setSelectedModel,
        currentRunId,
        currentRun,
        agentRunTimeline,
        compressContext,
        isCompressing,
        onOpenSettings,
        notify,
        activeCanvas,
        selectNodes
      }}
    >
      {children}
    </AITakeoverContext.Provider>
  );
}

export function useAITakeover() {
  const context = useContext(AITakeoverContext);
  if (!context) {
    throw new Error('useAITakeover must be used within AITakeoverProvider');
  }
  return context;
}
