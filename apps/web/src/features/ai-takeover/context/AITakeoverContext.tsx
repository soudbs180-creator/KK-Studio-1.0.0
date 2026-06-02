// 简体中文：AI 接管上下文控制中心 (AITakeover Context)

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { AssistantPlan, SanitizedProjectContext, AssistantAction } from '../types';
import { LocalAssistantBrain } from '../core/localBrain';
import { buildSanitizedProjectContext } from '../core/projectContextBuilder';
import { executeAction, ExecutorContext } from '../core/actionExecutor';
import { useAssetStore } from '../../assets/assetStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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
}

const AITakeoverContext = createContext<AITakeoverContextType | null>(null);

const localBrain = new LocalAssistantBrain();

interface AITakeoverProviderProps {
  children: ReactNode;
  activeCanvas: any;
  selectedModel: any;
  addPromptNode: (node: any) => Promise<void> | void;
  updatePromptNode: (node: any) => Promise<void> | void;
  executeGeneration: (node: any) => Promise<void> | void;
  getNextCardPosition: () => { x: number; y: number };
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  onOpenSettings?: (view?: string) => void;
  apiKeyStatus: 'missing' | 'configured_masked' | 'invalid' | 'unknown';
  balance: number;
  notify: any;
}

export function AITakeoverProvider({
  children,
  activeCanvas,
  selectedModel: initialModel,
  addPromptNode,
  updatePromptNode,
  executeGeneration,
  getNextCardPosition,
  setConfig,
  onOpenSettings,
  apiKeyStatus,
  balance,
  notify
}: AITakeoverProviderProps) {
  const [aiTakeoverMode, setAiTakeoverModeState] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `🤖 你好！我是 **KK Studio AI 本地接管助手**。
我目前以本地规则驱动模式运行，为您保障 API 安全。
我可以在本地帮您**优化提示词**、**高亮定位卡片**、**诊断常见错误**，并在任务完成时**压缩 ZIP 打包下载**。

请问我现在能帮您做点什么？`,
      timestamp: Date.now()
    }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<AssistantPlan | null>(null);

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

  // 执行计划
  const executePlan = useCallback(async (plan: AssistantPlan) => {
    const assetsSummary = useAssetStore.getState().getAssetsSummary();
    const projectContext = buildSanitizedProjectContext({
      currentPage: 'canvas',
      aiTakeoverEnabled: true,
      agentEnabled: false,
      activeCanvas,
      selectedNodeIds: activeCanvas?.promptNodes?.map((n: any) => n.id) || [],
      apiKeyStatus,
      providerCount: 1,
      selectedModel: selectedModel?.id,
      balanceKnown: true,
      canEstimateCost: true,
      assetsSummary,
      errors: []
    });

    const ctx: ExecutorContext = {
      activeCanvas,
      selectedModel,
      addPromptNode,
      updatePromptNode,
      executeGeneration,
      addToQueue,
      getNextCardPosition,
      setConfig,
      onOpenSettings,
      notify
    };

    for (const action of plan.actions) {
      await executeAction(action, ctx);
    }
  }, [activeCanvas, selectedModel, addPromptNode, updatePromptNode, executeGeneration, addToQueue, getNextCardPosition, setConfig, onOpenSettings, apiKeyStatus, notify]);

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

    // 智能脱敏上下文构建
    const assetsSummary = useAssetStore.getState().getAssetsSummary();
    const projectContext = buildSanitizedProjectContext({
      currentPage: 'canvas',
      aiTakeoverEnabled: true,
      agentEnabled: false,
      activeCanvas,
      selectedNodeIds: [],
      apiKeyStatus,
      providerCount: 1,
      selectedModel: selectedModel?.id,
      balanceKnown: true,
      canEstimateCost: true,
      assetsSummary,
      errors: []
    });

    try {
      // 模拟大脑思考用时，提升拟人化感官
      await new Promise(resolve => setTimeout(resolve, 800));

      const plan = await localBrain.plan(text, projectContext);

      const assistantMsg: Message = {
        id: plan.id,
        role: 'assistant',
        content: plan.reply,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMsg]);

      // 评估是否需要确认卡片
      if (plan.requiresConfirmation) {
        setPendingPlan(plan);
      } else {
        // 如果不需要确认，静默且自动安全地执行
        await executePlan(plan);
      }
    } catch (e: any) {
      notify?.error('助手脑出现异常', e.message || '未知错误');
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, activeCanvas, selectedModel, apiKeyStatus, executePlan, notify]);

  // 用户点击“确认执行”
  const executePendingPlan = useCallback(async () => {
    if (!pendingPlan) return;
    const plan = pendingPlan;
    setPendingPlan(null);
    await executePlan(plan);
  }, [pendingPlan, executePlan]);

  // 用户点击“取消计划”
  const cancelPendingPlan = useCallback(() => {
    setPendingPlan(null);
    
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
        setSelectedModel
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
