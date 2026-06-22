// 简体中文：AI 接管上下文控制中心 (AITakeover Context)

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import type { AssistantPlan, SanitizedProjectContext } from '../types';
import { buildSanitizedProjectContext } from '../core/projectContextBuilder';
import { useAssetStore } from '../../assets/assetStore';
import { durableGenerationQueue, type GenerationExecutorResult } from '../../ai-assistant-runtime/queue/DurableGenerationQueue.ts';
import { resolveAgentGroupBounds, resolveAgentNodeArrangeUpdates } from '../../ai-assistant-runtime/canvas/agentCanvasLayout.ts';
import {
  agentRuntimeInstance,
  agentRunStore,
  buildAgentRunTimeline,
  type AgentRunRecord,
  type AgentRunTimelineStep,
} from '../../ai-assistant-runtime';

type LlmChat = typeof import('../../../services/llm/LLMService')['llmService']['chat'];

const chatWithLlm: LlmChat = async (...args) => {
  const { llmService } = await import('../../../services/llm/LLMService');
  return llmService.chat(...args);
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: any[];
}


interface AITakeoverContextType {
  aiTakeoverMode: boolean;
  setAiTakeoverMode: (enabled: boolean) => void;
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
}

const AITakeoverContext = createContext<AITakeoverContextType | null>(null);

interface AITakeoverProviderProps {
  children: ReactNode;
  activeCanvas: any;
  selectedModel: any;
  selectedNodeIds: string[];
  addPromptNode: (node: any) => Promise<void> | void;
  updatePromptNode: (node: any) => Promise<void> | void;
  updateNodes?: (updates: { promptNodes?: any[]; imageNodes?: any[] }) => void;
  executeGeneration: (node: any) => Promise<void> | void;
  getNextCardPosition: () => { x: number; y: number };
  arrangeAllNodes?: (mode?: 'grid' | 'row' | 'column') => void;
  addGroup?: (group: any) => void;
  updateGroup?: (group: any) => void;
  setNodeTags?: (ids: string[], tags: string[]) => void;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  onOpenSettings?: (view?: any) => void;
  apiKeyStatus: 'missing' | 'configured_masked' | 'invalid' | 'unknown';
  balance: number;
  notify: any;
  config?: any;
  ecommerceState?: any;
  onGenerate?: () => Promise<void> | void;
  canvasTransform?: { x: number; y: number; scale: number } | null;
  canvasRef?: any;
}

export function AITakeoverProvider({
  children,
  activeCanvas,
  selectedModel: initialModel,
  selectedNodeIds,
  addPromptNode,
  updatePromptNode,
  updateNodes,
  executeGeneration,
  getNextCardPosition,
  arrangeAllNodes,
  addGroup,
  updateGroup,
  setNodeTags,
  setConfig,
  onOpenSettings,
  apiKeyStatus,
  balance,
  notify,
  config,
  ecommerceState,
  onGenerate,
  canvasTransform,
  canvasRef
}: AITakeoverProviderProps) {

  const [aiTakeoverMode, setAiTakeoverModeState] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);

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

  const [isThinking, setIsThinking] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AssistantPlan | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<AgentRunRecord | null>(null);
  const agentRunTimeline = React.useMemo(() => buildAgentRunTimeline(currentRun), [currentRun]);

  // 简体中文：前端生图最大 3 并发排队队列状态
  const [generationQueue, setGenerationQueue] = useState<any[]>([]);

  // 调度函数：推进生图等待队列
  const addToQueue = useCallback((node: any) => {
    setGenerationQueue(prev => [...prev, node]);
  }, []);

  // 简体中文：生图排队控制器 —— 侦听画布，空闲时才启动 executeGeneration 并变更为 isGenerating 开始计时
  React.useEffect(() => {
    if (generationQueue.length === 0) return;

    // 统计目前正在生成中的卡片数
    const activeGeneratingCount = activeCanvas?.promptNodes?.filter((n: any) => n.isGenerating).length || 0;

    if (activeGeneratingCount < 3) {
      const nextNode = generationQueue[0];
      setGenerationQueue(prev => prev.slice(1));

      (async () => {
        try {
          // 1. 卡片正式进入 isGenerating = true 状态，开启倒计时与闪烁
          await updatePromptNode({
            ...nextNode,
            isGenerating: true,
            status: 'idle'
          });

          // 2. 真正拉起绘图接口
          void executeGeneration({
            ...nextNode,
            isGenerating: true,
            status: 'idle'
          });
        } catch (err) {
          console.error('[TakeoverQueue] 调度执行异常:', err);
        }
      })();
    }
  }, [generationQueue, activeCanvas?.promptNodes, updatePromptNode, executeGeneration]);

  const setAiTakeoverMode = useCallback((enabled: boolean) => {
    setAiTakeoverModeState(enabled);
    if (notify) {
      if (enabled) {
        notify.success('AI 接管模式已启动', '右侧助手面板已固定，开启本地安全接管机制。');
      } else {
        notify.info('AI 接管模式已关闭', '已恢复为常规聊天面板。');
      }
    }
  }, [notify]);

  // 执行计划（桥接到 AgentRuntime）
  const executePlan = useCallback(async (runId: string) => {
    const ctx = {
      activeCanvas,
      selectedNodeIds: selectedNodeIds || [],
      selectedModel,
      addPromptNode,
      updatePromptNode,
      updateNodes,
      executeGeneration,
      addToQueue,
      getNextCardPosition,
      arrangeAllNodes,
      addGroup,
      updateGroup,
      setNodeTags,
      setConfig,
      onOpenSettings,
      notify,
      config,
      ecommerceState,
      onGenerate
    };

    setCurrentRun(agentRunStore.getRun(runId) ?? null);
    try {
      await agentRuntimeInstance.executePendingRun(runId, ctx);
    } finally {
      setCurrentRun(agentRunStore.getRun(runId) ?? null);
    }
  }, [activeCanvas, selectedModel, selectedNodeIds, addPromptNode, updatePromptNode, updateNodes, executeGeneration, addToQueue, getNextCardPosition, arrangeAllNodes, addGroup, updateGroup, setNodeTags, setConfig, onOpenSettings, notify, config, ecommerceState, onGenerate]);


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
    setCurrentRunId(null);
    setCurrentRun(null);

    // 智能脱敏上下文构建
    const assetsSummary = useAssetStore.getState().getAssetsSummary();
    const projectContext = buildSanitizedProjectContext({
      currentPage: 'canvas',
      aiTakeoverEnabled: true,
      agentEnabled: false,
      activeCanvas,
      selectedNodeIds: selectedNodeIds || [],
      apiKeyStatus,
      providerCount: 1,
      selectedModel: selectedModel?.id,
      balanceKnown: true,
      canEstimateCost: true,
      assetsSummary,
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
      if (plan.requiresConfirmation) {
        setPendingPlan(plan);
      } else {
        // 如果不需要确认，静默且自动安全地执行
        await executePlan(record.id);
      }
    } catch (e: any) {
      notify?.error('助手脑出现异常', e.message || '未知错误');
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, activeCanvas, selectedModel, selectedNodeIds, apiKeyStatus, executePlan, notify, config, ecommerceState, canvasTransform, canvasRef]);


  // 用户点击“确认执行”
  const executePendingPlan = useCallback(async () => {
    if (!currentRunId) return;
    const runId = currentRunId;
    setPendingPlan(null);
    setCurrentRunId(null);
    await executePlan(runId);
  }, [currentRunId, executePlan]);

  // 用户点击“取消计划”
  const cancelPendingPlan = useCallback(() => {
    const runId = currentRunId;
    setPendingPlan(null);

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
      content: `❌ **操作已取消**
我不会执行本次生图计划，也没有扣减您的积分。
您可以选择：
- 🔍 [只优化提示词并填充](action://takeover-prompt-only)
- 📝 [整理我的批量方案为文案](action://takeover-prompt-doc)`,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, cancelMsg]);
  }, [currentRunId]);

  // 简体中文：利用 Refs 跟踪最新的 React 状态与生图回调，供单例持久化队列消费以防闭包陈旧
  const activeCanvasRef = useRef(activeCanvas);
  const selectedModelRef = useRef(selectedModel);
  const addPromptNodeRef = useRef(addPromptNode);
  const updatePromptNodeRef = useRef(updatePromptNode);
  const updateNodesRef = useRef(updateNodes);
  const executeGenerationRef = useRef(executeGeneration);
  const getNextCardPositionRef = useRef(getNextCardPosition);
  const arrangeAllNodesRef = useRef(arrangeAllNodes);
  const addGroupRef = useRef(addGroup);
  const updateGroupRef = useRef(updateGroup);
  const setNodeTagsRef = useRef(setNodeTags);

  useEffect(() => {
    activeCanvasRef.current = activeCanvas;
    selectedModelRef.current = selectedModel;
    addPromptNodeRef.current = addPromptNode;
    updatePromptNodeRef.current = updatePromptNode;
    updateNodesRef.current = updateNodes;
    executeGenerationRef.current = executeGeneration;
    getNextCardPositionRef.current = getNextCardPosition;
    arrangeAllNodesRef.current = arrangeAllNodes;
    addGroupRef.current = addGroup;
    updateGroupRef.current = updateGroup;
    setNodeTagsRef.current = setNodeTags;
  });

  useEffect(() => {
    // 向队列注册具体的图片生成任务 executor 桥接逻辑
    durableGenerationQueue.registerExecutor(async (promptText, options, jobId, promptId) => {
      const lastPos = getNextCardPositionRef.current();
      const job = durableGenerationQueue.getJob(jobId);
      const index = job ? job.prompts.findIndex(p => p.id === promptId) : 0;
      const strayDraft = activeCanvasRef.current?.promptNodes?.find((node: any) => node.isDraft);
      const useDraft = index === 0 && strayDraft;
      const nodeId = useDraft ? strayDraft.id : ('takeover_batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
      const pos = useDraft ? strayDraft.position : {
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
        status: 'queued',
        referenceImages,
        tags
      };

      // 1. 先把准备执行生成的 prompt 节点加入或更新到画布
      if (useDraft) {
        console.log('[TakeoverQueue] Found stray draft during queue generation, converting it:', strayDraft.id);
        await updatePromptNodeRef.current({
          ...strayDraft,
          ...nodeData
        });
        setConfig((prev: any) => ({ ...prev, prompt: '', referenceImages: [] }));
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
        const interval = setInterval(() => {
          attempts++;
          const currentCanvas = activeCanvasRef.current;
          const node = currentCanvas?.promptNodes?.find((n: any) => n.id === nodeId);
          if (node) {
            if (!node.isGenerating) {
              clearInterval(interval);
              if (node.status === 'failed' || node.error) {
                reject(new Error(node.error || '生图失败'));
              } else {
                const resultImageNodeIds = node.childImageIds || [];
                resolve({
                  promptNodeId: nodeId,
                  resultImageNodeIds,
                  nodeIds: [nodeId, ...resultImageNodeIds]
                } as any);
              }
            }
          } else {
            clearInterval(interval);
            reject(new Error('Prompt node deleted'));
          }

          if (attempts > 120) {
            clearInterval(interval);
            reject(new Error('Generation timeout'));
          }
        }, 1000);
      });
    });

    // 注册自动排版 handler
    durableGenerationQueue.registerArrangeHandler(async (nodeIds, options) => {
      console.log('[DurableQueue] Job completed, nodes ready to arrange:', nodeIds);
      const canvas = activeCanvasRef.current;
      if (canvas && updateNodesRef.current && nodeIds.length > 0) {
        const updates = resolveAgentNodeArrangeUpdates(canvas, nodeIds, {
          mode: options.layout,
          preset: options.layoutPreset,
          columns: options.columns,
          gap: options.gap
        });
        updateNodesRef.current(updates);
        return;
      }

      if (arrangeAllNodesRef.current) {
        arrangeAllNodesRef.current(options.layout || 'grid');
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
    durableGenerationQueue.processQueue();
  }, []);

  return (
    <AITakeoverContext.Provider
      value={{
        aiTakeoverMode,
        setAiTakeoverMode,
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
        activeCanvas
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
