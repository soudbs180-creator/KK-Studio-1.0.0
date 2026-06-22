// 简体中文：AI接管右侧固定助手面板组件 (AIAssistantDock)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAITakeover } from '../context/AITakeoverContext';
import { useAssetStore } from '../../assets/assetStore';
import { ensureFileUploaded } from '../../assets/lazyUpload';
import { estimateTokens, getModelContextLimit } from '../../../utils/contextHelper';
import { AGENT_CONTROL_ACTIONS, durableGenerationQueue } from '../../ai-assistant-runtime';
import type { GenerationBatchJob } from '../../ai-assistant-runtime';
import {
  ReferenceMentionPanel,
  buildReferenceMentionTabs,
  computeReferenceMentionAnchor,
  favoriteComposerRegistry,
  useFavoritesStore,
  type MentionReferencePayload,
  type ReferenceMentionAnchor,
  type ReferenceMentionCandidate,
} from '../../favorites';
import {
  Send,
  Loader2,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  Eye,
  Trash2,
  X,
  Lock,
  Download,
  AlertTriangle,
  Cpu,
  Pause,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const getDurableQueueJobNodeIds = (job: GenerationBatchJob): string[] => Array.from(new Set([
  ...(job.outputGroup?.nodeIds || []),
  ...job.prompts.map(prompt => prompt.promptNodeId).filter((id): id is string => Boolean(id)),
  ...job.prompts.flatMap(prompt => prompt.resultImageNodeIds || []),
]));

const getUploadStateText = (state: string) => {
  switch (state) {
    case 'linked': return '已连接';
    case 'local_ready': return '已连接，本地可用，尚未上传';
    case 'indexed': return '已索引';
    case 'uploaded': return '已上传';
    case 'used': return '正在使用';
    case 'failed': return '失败';
    case 'blocked_sensitive': return '敏感文件被隔离';
    default: return state;
  }
};

export const AIAssistantDock: React.FC = () => {
  const {
    aiTakeoverMode,
    setAiTakeoverMode,
    messages,
    isThinking,
    sendMessage,
    pendingPlan,
    executePendingPlan,
    cancelPendingPlan,
    compressContext,
    isCompressing,
    selectedModel,
    onOpenSettings,
    notify,
    activeCanvas,
    currentRun,
    agentRunTimeline
  } = useAITakeover();

  const { images, files, outputs, addImage, addFile, removeAsset, addImageCollection } = useAssetStore();
  const favoriteItems = useFavoritesStore(state => state.items);

  const [jobs, setJobs] = useState<GenerationBatchJob[]>(() => durableGenerationQueue.getJobs());
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const { maxTokens, label: maxTokensLabel } = React.useMemo(() => {
    return getModelContextLimit(selectedModel?.id);
  }, [selectedModel?.id]);

  const totalTokensUsed = React.useMemo(() => {
    let total = 0;
    messages.forEach(msg => {
      total += estimateTokens(msg.content);
    });
    return total;
  }, [messages]);

  const percentUsed = React.useMemo(() => {
    return Math.min(100, Math.round((totalTokensUsed / maxTokens) * 100));
  }, [totalTokensUsed, maxTokens]);

  const isNearLimit = percentUsed >= 80;

  useEffect(() => durableGenerationQueue.subscribe(setJobs), []);

  const activeJobs = React.useMemo(() => jobs.filter(job => (
    job.status === 'running' ||
    job.status === 'queued' ||
    job.status === 'paused' ||
    job.prompts.some(prompt => prompt.status === 'failed') ||
    getDurableQueueJobNodeIds(job).length > 0
  )), [jobs]);

  const [inputVal, setInputVal] = useState('');
  const [showResourcePanel, setShowResourcePanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentionState, setMentionState] = useState<{
    open: boolean;
    query: string;
    start: number;
    end: number;
    anchor?: ReferenceMentionAnchor;
  }>({ open: false, query: '', start: 0, end: 0 });

  const referenceMentionTabs = React.useMemo(() => buildReferenceMentionTabs({
    assistantImages: images,
    assistantFiles: files,
    promptNodes: activeCanvas?.promptNodes || [],
    imageNodes: activeCanvas?.imageNodes || [],
    favorites: favoriteItems,
  }), [
    activeCanvas?.imageNodes,
    activeCanvas?.promptNodes,
    favoriteItems,
    files,
    images,
  ]);

  // 滚动至最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // 处理文本发送
  const closeReferenceMentionPanel = useCallback(() => {
    setMentionState(prev => prev.open ? { ...prev, open: false, query: '' } : prev);
  }, []);

  const updateReferenceMentionFromTextarea = useCallback((target: HTMLTextAreaElement) => {
    const value = target.value;
    const caret = target.selectionStart ?? value.length;
    const beforeCaret = value.slice(0, caret);
    const atIndex = beforeCaret.lastIndexOf('@');

    if (atIndex < 0) {
      closeReferenceMentionPanel();
      return;
    }

    const token = beforeCaret.slice(atIndex + 1);
    if (/[\s,，。；;:：()[\]{}<>]/.test(token)) {
      closeReferenceMentionPanel();
      return;
    }

    setMentionState({
      open: true,
      query: token,
      start: atIndex,
      end: caret,
      anchor: computeReferenceMentionAnchor(target, atIndex),
    });
  }, [closeReferenceMentionPanel]);

  const applyDockInputChange = useCallback((nextValue: string, caret?: number) => {
    setInputVal(nextValue);
    window.requestAnimationFrame(() => {
      const textarea = inputRef.current;
      if (!textarea) return;
      textarea.focus();
      if (typeof caret === 'number') {
        textarea.setSelectionRange(caret, caret);
      }
    });
  }, []);

  const insertDockComposerPayload = useCallback((payload: MentionReferencePayload) => {
    const text = payload.text || '';
    if (!text) return;

    const textarea = inputRef.current;
    const current = textarea?.value ?? inputVal;
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? start;
    const nextValue = `${current.slice(0, start)}${text}${current.slice(end)}`;

    applyDockInputChange(nextValue, start + text.length);
  }, [applyDockInputChange, inputVal]);

  useEffect(() => favoriteComposerRegistry.register({
    id: 'ai-dock',
    label: 'AI takeover dock',
    insert: insertDockComposerPayload,
    focus: () => inputRef.current?.focus(),
  }), [insertDockComposerPayload]);

  const replaceActiveMentionWithCandidate = useCallback((candidate: ReferenceMentionCandidate) => {
    const current = inputRef.current?.value ?? inputVal;
    const start = Math.max(0, mentionState.start);
    const end = Math.max(start, mentionState.end);
    const mentionText = candidate.mentionText || `@${candidate.name}`;
    const rawPrefix = current.slice(0, start);
    const rawSuffix = current.slice(end);
    const prefix = rawPrefix && !/[\s(（,，:：]$/.test(rawPrefix) ? `${rawPrefix} ` : rawPrefix;
    const suffixSpacer = rawSuffix && !/^[\s,，。；;:：)\]）]/.test(rawSuffix) ? ' ' : '';
    const nextValue = `${prefix}${mentionText}${suffixSpacer}${rawSuffix}`;

    setMentionState(prev => ({ ...prev, open: false, query: '' }));
    applyDockInputChange(nextValue, prefix.length + mentionText.length + suffixSpacer.length);
  }, [applyDockInputChange, inputVal, mentionState.end, mentionState.start]);

  const handleSend = () => {
    if (!inputVal.trim() || isThinking) return;
    sendMessage(inputVal);
    setInputVal('');
  };

  const handleLocateDurableJob = useCallback((job: GenerationBatchJob) => {
    const outputNodeIds = getDurableQueueJobNodeIds(job);
    const canvasNodes = [
      ...(activeCanvas?.promptNodes || []),
      ...(activeCanvas?.imageNodes || []),
    ];
    const targetNode = canvasNodes.find((node: any) => outputNodeIds.includes(node.id));

    if (!targetNode?.position) {
      notify?.info?.('队列定位', '当前任务还没有可定位的画布产物。');
      return;
    }

    window.dispatchEvent(new CustomEvent('canvas-center-on-node', {
      detail: {
        x: targetNode.position.x,
        y: targetNode.position.y,
        nodeId: targetNode.id,
      },
    }));
    notify?.success?.('已定位队列输出', job.outputGroup?.label || `Job ${job.id.slice(-6)}`);
  }, [activeCanvas?.imageNodes, activeCanvas?.promptNodes, notify]);

  // 处理图片选择
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach(file => addImage(file));
    }
  };

  // 处理文件夹导入
  const handleDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      addImageCollection(
        Array.from(fileList).map(file => ({
          file,
          relativePath: file.webkitRelativePath
        }))
      );
    }
  };

  // 处理普通文件连接导入
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach(file => addFile(file));
    }
  };

  // 处理 Action 链接点击
  const handleActionLink = (url: string) => {
    const isTakeoverAction = url === 'action://takeover-prompt-only' ||
                             url === 'action://takeover-prompt-doc' ||
                             url.startsWith('action://takeover-bulk-generate');

    if (isTakeoverAction) {
      if (url === 'action://takeover-prompt-only') {
        sendMessage('帮我只优化提示词并填充，不进行图片生成。');
      } else if (url === 'action://takeover-prompt-doc') {
        sendMessage('请帮我把优化的生图模板方案整理一份文案形式输出。');
      } else {
        const parsedUrl = url.replace('action://', 'http://dummy');
        try {
          const u = new URL(parsedUrl);
          const prompts = u.searchParams.get('prompts') || '';

          if (url.startsWith('action://takeover-bulk-generate') && prompts) {
            sendMessage(`使用提示词开始生成：${prompts}`);
          }
        } catch (err) {
          console.error('Action parse error:', err);
        }
      }
      return;
    }

    // 常规动作放行与跳转处理器（与 ChatSidebar 保持百分之百体验一致）
    if (url.startsWith('action://highlight-')) {
      const selector = url.replace('action://highlight-', '');
      if (selector === '#btn-create-canvas') {
        const trigger = document.querySelector('#project-manager-trigger') as HTMLElement;
        if (trigger) trigger.click();
      }
      setTimeout(() => {
        const el = document.querySelector(selector) as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-glow-ring');
          setTimeout(() => {
            el.classList.remove('highlight-glow-ring');
          }, 3000);
          if (notify) notify.success('已为您高亮定位对应操作区域', '');
        } else {
          if (notify) notify.warning('未找到对应界面元素，请先展开相应功能区', '');
        }
      }, 100);
    } else if (url === 'action://open-recharge') {
      window.dispatchEvent(new CustomEvent('open-recharge-modal'));
    } else if (url === 'action://open-settings-logs') {
      if (onOpenSettings) onOpenSettings('system-logs');
      if (notify) notify.success('已为您打开系统日志面板', '');
    } else if (url === 'action://open-settings-api') {
      if (onOpenSettings) onOpenSettings('api-management');
      // 延迟高亮智能定位到 API Key 输入框
      setTimeout(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea')) as HTMLElement[];
        const keyInput = inputs.find(el => {
          const placeholder = el.getAttribute('placeholder') || '';
          const id = el.getAttribute('id') || '';
          const name = el.getAttribute('name') || '';
          return id.toLowerCase().includes('key') ||
                 name.toLowerCase().includes('key') ||
                 placeholder.toLowerCase().includes('key') ||
                 placeholder.toLowerCase().includes('密钥') ||
                 placeholder.toLowerCase().includes('token');
        });
        const el = keyInput || document.querySelector('.settings-api-key-input') || document.querySelector('input[type="password"]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-glow-ring');
          el.focus();
          setTimeout(() => {
            el.classList.remove('highlight-glow-ring');
          }, 3000);
          if (notify) notify.success('已为您打开设置并定位至 API 密钥输入框', '');
        } else {
          if (notify) notify.warning('已打开 API 管理，请手动在下方输入框填写密钥', '');
        }
      }, 300);
    } else if (url === 'action://open-settings') {
      if (onOpenSettings) onOpenSettings();
    } else if (url.startsWith('action://takeover-locate')) {
      let keyword = '';
      try {
        const parsedUrl = new URL(url.replace('action://', 'http://dummy'));
        keyword = (parsedUrl.searchParams.get('keyword') || '').trim();
      } catch (err) {
        console.error('Parse takeover-locate url failed:', err);
      }

      if (!keyword) {
        if (notify) notify.warning('AI接管定位失败', '未指定要查找的关键字');
        return;
      }

      // 搜索匹配卡片
      const nodes = activeCanvas?.promptNodes || [];
      const matchedNode = nodes.find((n: any) =>
        (n.prompt || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.optimizedPromptEn || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.optimizedPromptZh || '').toLowerCase().includes(keyword.toLowerCase())
      );

      if (matchedNode) {
        const locateEvent = new CustomEvent('canvas-center-on-node', {
          detail: {
            x: matchedNode.position.x,
            y: matchedNode.position.y,
            nodeId: matchedNode.id
          }
        });
        window.dispatchEvent(locateEvent);
        if (notify) notify.success(`AI接管：已为您平滑定位到包含“${keyword}”的卡片`, '');
      } else {
        if (notify) notify.warning('AI接管定位', `未在当前画布上找到包含“${keyword}”的卡片`);
      }
    } else {
      // 其它普通 action 直接触发
      try {
        const mockAnchor = document.createElement('a');
        mockAnchor.href = url;
        mockAnchor.click();
      } catch (err) {
        console.error('Fallback Action click error:', err);
      }
    }
  };

  // 格式化文件大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 渲染消息内容（解析 action:// 交互按钮）
  const renderMessageText = (content: string) => {
    const regex = /\[([^\]]+)\]\((action:\/\/[^\)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={lastIndex}>{content.substring(lastIndex, match.index)}</span>);
      }

      const label = match[1];
      const actionUrl = match[2];

      parts.push(
        <button
          key={match.index}
          onClick={() => handleActionLink(actionUrl)}
          className="inline-flex items-center gap-1 mx-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:brightness-110 active:scale-95 transition-all shadow-[0_2px_8px_rgba(219,39,119,0.35)] select-none cursor-pointer"
        >
          ✨ {label}
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(<span key={lastIndex}>{content.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : content;
  };

  const visibleRunTimeline = React.useMemo(() => {
    if (!currentRun && isThinking) {
      return agentRunTimeline.map((step, index) => (
        index === 0 ? { ...step, status: 'active' as const, detail: 'Reading request' } : step
      ));
    }

    return agentRunTimeline;
  }, [agentRunTimeline, currentRun, isThinking]);

  const shouldShowRunTimeline = Boolean(currentRun || isThinking || pendingPlan);
  const verificationStepLabel = 'Verification / Memory';
  const getRunTimelineStatusText = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'done': return '完成';
      case 'needs_confirmation': return '待确认';
      case 'failed': return '失败';
      case 'cancelled': return '已取消';
      default: return '等待';
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0b0c10] border-l border-zinc-800 font-inter select-none"
      style={{ width: '380px', minWidth: '380px', maxWidth: '380px', flexShrink: 0 }}
    >
      
      {/* 1. Header 头部栏 */}
      <div className="flex flex-col border-b border-zinc-800 bg-[#0f111a] backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.35)]">
                <Cpu className="text-white w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-zinc-950 rounded-full" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">KK本地接管助理</h3>
              <p className="text-[9px] text-purple-400 font-semibold">AI 接管：本地模式</p>
            </div>
          </div>

          <button
            onClick={() => setAiTakeoverMode(false)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            title="关闭 AI 接管"
          >
            <X size={16} />
          </button>
        </div>

        {/* Context Limit Indicator 胶囊栏 */}
        <div className="mx-auto my-2.5 px-5 py-2.5 rounded-full border border-zinc-800/80 bg-zinc-950/40 backdrop-blur-md flex flex-col gap-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.2)] w-[88%] max-w-[340px] select-none transition-all duration-300 hover:border-purple-500/40 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span>🧠 上下文:</span>
              <span className="font-semibold text-zinc-200">
                {totalTokensUsed >= 1000 ? `${(totalTokensUsed / 1000).toFixed(1)}k` : totalTokensUsed} / {maxTokensLabel}
              </span>
              <span className="text-purple-400">({percentUsed}%)</span>
            </span>

            <button
              onClick={compressContext}
              disabled={isCompressing || messages.filter(m => m.id !== 'welcome').length <= 1}
              data-agent-action={AGENT_CONTROL_ACTIONS.compressContext.uiAction}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none border ${
                isNearLimit
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              } disabled:opacity-30 disabled:pointer-events-none`}
              title={isNearLimit ? "上下文即将满，建议立即压缩以节省额度！" : "点击对历史对话进行总结和压缩"}
            >
              {isCompressing ? (
                <>
                  <Loader2 size={10} className="animate-spin" />
                  <span>压缩中...</span>
                </>
              ) : (
                <span>🗜️ 压缩</span>
              )}
            </button>
          </div>

          {/* 进度条 */}
          <div className="w-full bg-zinc-900 rounded-full h-1 relative overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentUsed >= 80
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          {isNearLimit && (
            <div className="text-[9px] text-amber-400/90 flex items-center justify-center gap-1 mt-0.5 animate-pulse">
              <AlertTriangle size={10} />
              <span>用量超 80%，请及时压缩。</span>
            </div>
          )}
        </div>

        {shouldShowRunTimeline && (
          <div className="ai-takeover-run-timeline mx-4 mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 mb-2">
              <span className="font-bold text-zinc-300">接管时间线</span>
              {currentRun && (
                <span className="font-mono truncate max-w-[150px]" title={currentRun.id}>
                  {currentRun.status} - {currentRun.id.slice(-8)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {visibleRunTimeline.map(step => {
                const label = step.id === 'verification' ? verificationStepLabel : step.label;
                return (
                  <div
                    key={step.id}
                    className={`ai-takeover-run-timeline__step min-w-0 rounded-lg border px-1.5 py-1.5 text-center transition-colors ${
                      step.status === 'done'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : step.status === 'active'
                          ? 'border-purple-500/40 bg-purple-500/10 text-purple-200'
                          : step.status === 'needs_confirmation'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : step.status === 'failed'
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                              : step.status === 'cancelled'
                                ? 'border-zinc-700 bg-zinc-900/80 text-zinc-500'
                                : 'border-zinc-800 bg-zinc-900/40 text-zinc-500'
                    }`}
                    data-status={step.status}
                    title={`${label}: ${step.description}${step.detail ? ` - ${step.detail}` : ''}`}
                  >
                    <div className="flex items-center justify-center h-4 mb-1">
                      {step.status === 'done' ? (
                        <CheckCircle size={13} />
                      ) : step.status === 'active' ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : step.status === 'needs_confirmation' ? (
                        <AlertTriangle size={13} />
                      ) : step.status === 'failed' ? (
                        <AlertCircle size={13} />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-current opacity-55" />
                      )}
                    </div>
                    <div className="truncate text-[8px] font-bold leading-none">{label}</div>
                    <div className="mt-1 truncate text-[8px] opacity-75 leading-none">
                      {getRunTimelineStatusText(step.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Message Area 消息对话区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#0a0a0d]">
        {(() => {
          let boundaryIndex = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].content.includes('上下文压缩分界线')) {
              boundaryIndex = i;
              break;
            }
          }

          const items: React.ReactNode[] = [];

          if (boundaryIndex !== -1) {
            items.push(
              <div key="takeover-archive-fold-toggle" className="flex flex-col items-center my-2 w-full animate-in fade-in duration-300">
                <button
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all select-none cursor-pointer"
                >
                  <span>{isHistoryExpanded ? '🔼 收起已归档历史' : `🔽 展开已压缩的 ${boundaryIndex} 条历史对话`}</span>
                </button>
              </div>
            );
          }

          messages.forEach((msg, idx) => {
            if (boundaryIndex !== -1 && idx < boundaryIndex && !isHistoryExpanded) {
              return;
            }

            const isBoundary = msg.content.includes('上下文压缩分界线');

            items.push(
              <div
                key={msg.id}
                className={`flex ${isBoundary ? 'w-full flex-col items-center my-3 animate-in fade-in duration-300' : (msg.role === 'user' ? 'justify-end' : 'justify-start')}`}
              >
                {isBoundary ? (
                  <div className="w-full flex flex-col items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-dashed border-amber-500/20 shadow-[inset_0_1px_3px_rgba(245,158,11,0.03)]">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500/80 tracking-wider uppercase select-none">
                      <span>🗜️ 上下文已压缩归档</span>
                    </div>
                    <div className="w-full text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed text-left">
                      {renderMessageText(msg.content.replace('--- 📌 上下文压缩分界线 (已归档历史) ---\n', ''))}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700'
                        : 'bg-zinc-900 text-zinc-200 rounded-bl-none border border-zinc-800/80 whitespace-pre-wrap'
                    }`}
                  >
                    {msg.role === 'assistant' ? renderMessageText(msg.content) : msg.content}
                  </div>
                )}
              </div>
            );
          });

          return items;
        })()}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl rounded-bl-none px-4 py-3 text-xs flex items-center gap-2">
              <Loader2 className="animate-spin text-purple-500 w-3.5 h-3.5" />
              <span>接管引擎正在规划...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 2.5 批量生成队列进度面板与恢复 UI */}
      {activeJobs.length > 0 && (
        <div className="mx-4 my-2 p-3 rounded-xl border border-zinc-800 bg-[#0d0e12]/80 backdrop-blur-md shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[10px] font-black text-zinc-400">
            <span className="flex items-center gap-1">
              <Cpu size={12} className="text-purple-500 animate-pulse" />
              <span>生图队列排队中 ({activeJobs.length})</span>
            </span>
            <button 
              onClick={() => durableGenerationQueue.archiveFinishedJobs()}
              data-agent-action={AGENT_CONTROL_ACTIONS.archiveFinishedGenerationJobs.uiAction}
              className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
              title="只归档已完成或已取消的历史任务，不影响正在执行的任务"
            >
              归档完成
            </button>
          </div>
          
          <div className="max-h-36 overflow-y-auto space-y-2">
            {activeJobs.map(job => {
              const total = job.prompts.length;
              const completed = job.prompts.filter((p: any) => p.status === 'completed').length;
              const failed = job.prompts.filter((p: any) => p.status === 'failed').length;
              const running = job.prompts.filter((p: any) => p.status === 'running').length;
              const outputNodeCount = getDurableQueueJobNodeIds(job).length;
              const percent = Math.round(((completed + failed) / total) * 100);

              return (
                <div key={job.id} className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-900 flex flex-col gap-1.5 text-[9px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-zinc-400 truncate max-w-[150px]">Job: {job.id.substring(4, 12)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      job.status === 'running' ? 'bg-purple-500/20 text-purple-400 animate-pulse' :
                      job.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                      job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {job.status === 'running' ? '正在生图' :
                       job.status === 'paused' ? '已暂停' :
                       job.status === 'completed' ? '已完成' :
                       job.status === 'cancelled' ? '已取消' : '排队中'}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="w-full bg-zinc-800 rounded-full h-1 relative overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[8px] text-zinc-500">
                    <span>成功: {completed} • 失败: {failed} • 总计: {total}</span>
                    <div className="flex gap-1.5">
                      {job.status === 'running' && (
                        <button 
                          onClick={() => durableGenerationQueue.pauseJob(job.id)}
                          data-agent-action={AGENT_CONTROL_ACTIONS.pauseGenerationJob.uiAction}
                          data-agent-tool={AGENT_CONTROL_ACTIONS.pauseGenerationJob.toolName}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                          title="暂停任务"
                        >
                          <Pause size={10} />
                        </button>
                      )}
                      {(job.status === 'paused' || job.status === 'queued') && (
                        <button 
                          onClick={() => durableGenerationQueue.resumeJob(job.id)}
                          data-agent-action={AGENT_CONTROL_ACTIONS.resumeGenerationJob.uiAction}
                          data-agent-tool={AGENT_CONTROL_ACTIONS.resumeGenerationJob.toolName}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
                          title="恢复并继续"
                        >
                          <Play size={10} />
                        </button>
                      )}
                      {failed > 0 && job.status !== 'cancelled' && (
                        <button
                          onClick={() => durableGenerationQueue.retryFailedPrompts(job.id)}
                          data-agent-action={AGENT_CONTROL_ACTIONS.retryGenerationJob.uiAction}
                          data-agent-tool={AGENT_CONTROL_ACTIONS.retryGenerationJob.toolName}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 hover:text-amber-200 cursor-pointer"
                          title="重试失败项"
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                      <button
                        onClick={() => handleLocateDurableJob(job)}
                        disabled={outputNodeCount === 0}
                        data-agent-action={AGENT_CONTROL_ACTIONS.locateGenerationJobOutputs.uiAction}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        title="定位队列产物"
                      >
                        <Eye size={10} />
                      </button>
                      {(job.status === 'running' || job.status === 'paused' || job.status === 'queued') && (
                        <button 
                          onClick={() => durableGenerationQueue.cancelJob(job.id)}
                          data-agent-action={AGENT_CONTROL_ACTIONS.cancelGenerationJob.uiAction}
                          data-agent-tool={AGENT_CONTROL_ACTIONS.cancelGenerationJob.toolName}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-rose-400 hover:text-rose-300 cursor-pointer"
                          title="取消任务"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Confirmation Area 意图强确认卡片 */}
      {pendingPlan && pendingPlan.confirmation && (
        <div className="mx-4 my-2 p-3.5 rounded-xl border border-purple-900/60 bg-[#120f21]/80 backdrop-blur-lg shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Cpu size={48} className="text-purple-500" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-black text-purple-400 mb-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            <span>{pendingPlan.confirmation.title}</span>
          </div>

          <div className="text-[10px] text-zinc-300 whitespace-pre-line mb-3 border-l-2 border-purple-500 pl-2 leading-relaxed">
            {pendingPlan.confirmation.summary}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={cancelPendingPlan}
              data-agent-action={AGENT_CONTROL_ACTIONS.cancelPlan.uiAction}
              data-agent-runtime-action={AGENT_CONTROL_ACTIONS.cancelPlan.runtimeAction}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              {pendingPlan.confirmation.cancelText}
            </button>
            <button
              onClick={executePendingPlan}
              data-agent-action={AGENT_CONTROL_ACTIONS.confirmPlan.uiAction}
              data-agent-runtime-action={AGENT_CONTROL_ACTIONS.confirmPlan.runtimeAction}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold text-white hover:brightness-110 hover:shadow-[0_2px_10px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
            >
              {pendingPlan.confirmation.confirmText}
            </button>
          </div>
        </div>
      )}

      {/* 4. Three-in-One Upload Bar 三合一资源上传条 */}
      <div className="px-4 py-2 border-t border-zinc-800/60 bg-[#0c0d12] flex gap-2">
        <input
          type="file"
          accept="image/*"
          multiple
          ref={imgInputRef}
          onChange={handleImageChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          multiple
          webkitdirectory="true"
          ref={dirInputRef}
          onChange={handleDirChange}
          className="hidden"
        />
        <input
          type="file"
          accept=".txt,.json,.csv,.pdf,.zip,.prompt"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 上传图片药丸按钮 */}
        <button
          onClick={() => imgInputRef.current?.click()}
          data-agent-action={AGENT_CONTROL_ACTIONS.importTakeoverImage.uiAction}
          className="flex-1 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-[10px] font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="选择单图或多图导入资源池"
        >
          <ImageIcon size={12} />
          <span>上传图片</span>
        </button>

        {/* 导入文件夹药丸按钮 */}
        <button
          onClick={() => dirInputRef.current?.click()}
          data-agent-action={AGENT_CONTROL_ACTIONS.importTakeoverFolder.uiAction}
          className="flex-1 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-[10px] font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="选择本地文件夹图片导入"
        >
          <FolderOpen size={12} />
          <span>导入文件夹</span>
        </button>

        {/* 连接文件药丸按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          data-agent-action={AGENT_CONTROL_ACTIONS.connectTakeoverFile.uiAction}
          className="flex-1 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-[10px] font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="连接配置文件（懒加载）"
        >
          <FileText size={12} />
          <span>连接文件</span>
        </button>

        {/* 展开/折叠资源管理器按钮 */}
        <button
          onClick={() => setShowResourcePanel(!showResourcePanel)}
          data-agent-action={AGENT_CONTROL_ACTIONS.toggleTakeoverResources.uiAction}
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
            showResourcePanel
              ? 'bg-purple-600/20 border-purple-500/60 text-purple-400'
              : 'border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:text-white'
          }`}
          title="展开/隐藏当前项目资源池"
        >
          <Eye size={12} />
          <span>资源({images.length + files.length})</span>
        </button>
      </div>

      {/* 5. Resource Panel 资源池折叠管理器 */}
      {showResourcePanel && (
        <div className="border-t border-zinc-800 bg-[#090a0f] p-3 max-h-48 overflow-y-auto animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-400">已连结的本地项目资源池 ({images.length + files.length})</span>
            <button
              onClick={() => setShowResourcePanel(false)}
              data-agent-action={AGENT_CONTROL_ACTIONS.closeTakeoverResources.uiAction}
              className="text-zinc-500 hover:text-white text-[9px] cursor-pointer"
            >
              关闭
            </button>
          </div>

          <div className="space-y-1.5">
            {/* 图像列表 */}
            {images.map(img => (
              <div key={img.id} className="flex items-center justify-between bg-zinc-900/60 border border-zinc-900 rounded-lg p-1.5 text-[9px] text-zinc-300">
                <div className="flex items-center gap-2 truncate">
                  {img.thumbnailUrl ? (
                    <img src={img.thumbnailUrl} alt="preview" className="w-6 h-6 rounded object-cover border border-zinc-800" />
                  ) : (
                    <ImageIcon size={12} className="text-zinc-500" />
                  )}
                  <div className="truncate">
                    <p className="truncate text-zinc-200">{img.name}</p>
                    <p className="text-[8px] text-zinc-500">{formatBytes(img.size)} • {getUploadStateText(img.uploadState)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeAsset(img.id, 'image')}
                  data-agent-action={AGENT_CONTROL_ACTIONS.removeTakeoverImage.uiAction}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            {/* 普通文件列表 */}
            {files.map(f => (
              <div key={f.id} className={`flex items-center justify-between rounded-lg p-1.5 text-[9px] border ${
                f.sensitive
                  ? 'border-red-950/40 bg-red-950/20 text-red-300'
                  : 'border-zinc-900 bg-zinc-900/60 text-zinc-300'
              }`}>
                <div className="flex items-center gap-2 truncate">
                  {f.sensitive ? (
                    <Lock size={12} className="text-red-500 animate-pulse" />
                  ) : (
                    <FileText size={12} className="text-zinc-500" />
                  )}
                  <div className="truncate">
                    <p className="truncate text-zinc-200">{f.name}</p>
                    <p className="text-[8px] text-zinc-500">
                      {formatBytes(f.size)} • {f.sensitive ? '敏感文件被隔离' : getUploadStateText(f.uploadState)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeAsset(f.id, 'file')}
                  data-agent-action={AGENT_CONTROL_ACTIONS.removeTakeoverFile.uiAction}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            {images.length === 0 && files.length === 0 && (
              <p className="text-[9px] text-zinc-600 text-center py-2">暂无已导入资源，点击上方按钮进行选择。</p>
            )}
          </div>
        </div>
      )}

      {/* 6. Input Area 输入输入区域 */}
      <div className="p-4 border-t border-zinc-800 bg-[#0d0e14]">
        <div className="relative flex items-center border border-zinc-800 bg-zinc-900/40 rounded-xl px-3 py-1.5 focus-within:border-purple-600/80 focus-within:ring-1 focus-within:ring-purple-600/20 transition-all">
          <ReferenceMentionPanel
            open={mentionState.open}
            query={mentionState.query}
            tabs={referenceMentionTabs}
            anchor={mentionState.anchor}
            onSelect={replaceActiveMentionWithCandidate}
            onClose={closeReferenceMentionPanel}
          />
          <textarea
            ref={inputRef}
            value={inputVal}
            onChange={e => {
              setInputVal(e.target.value);
              updateReferenceMentionFromTextarea(e.target);
            }}
            onKeyDown={e => {
              if (mentionState.open) {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  closeReferenceMentionPanel();
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onFocus={() => favoriteComposerRegistry.markFocused('ai-dock')}
            placeholder="输入对话或指令（回车发送）..."
            rows={1}
            disabled={isThinking}
            className="w-full text-xs text-white bg-transparent outline-none border-none resize-none placeholder-zinc-500 disabled:opacity-50 pr-8 py-1 leading-normal"
          />

          <button
            onClick={handleSend}
            disabled={!inputVal.trim() || isThinking}
            data-agent-action={AGENT_CONTROL_ACTIONS.sendTakeoverMessage.uiAction}
            className="absolute right-2 p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-md"
          >
            <Send size={12} fill="white" />
          </button>
        </div>
      </div>
      
    </div>
  );
};
