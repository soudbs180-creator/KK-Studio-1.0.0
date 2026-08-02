import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCw,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Image,
  Video,
  AudioLines,
  FileText,
  Globe,
  Download,
  Layers,
  Eye,
  Copy,
  Settings,
  Bot,
} from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import {
  agentRunStore,
  agentRuntimeInstance,
  durableGenerationQueue,
  type AgentRunRecord,
  type GenerationBatchJob,
} from '../../features/ai-assistant-runtime';
import { notify } from '../../services/system/notificationService';
import { useCanvas } from '../../context/CanvasContext';
import type { SettingsSurfaceView } from '../../hooks/useWorkspaceSurface';
import { TASK_CENTER_OPEN_EVENT } from './taskCenterEvents';

interface TaskCenterTrayProps {
  onOpenSettings?: (view?: SettingsSurfaceView) => void;
  isChatOpen?: boolean;
  chatSidebarWidth?: number;
  isMobile?: boolean;
}

// 自定义非生图任务结构
interface CustomTask {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'ppt' | 'extract' | 'membership' | 'export';
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress?: number;
  error?: string;
  createdAt: number;
}

type TaskCenterActivityStatus = CustomTask['status']
  | GenerationBatchJob['status']
  | 'waiting_confirmation';

interface TaskCenterActivity {
  id: string;
  source: 'generation' | 'agent' | 'transient';
  name: string;
  type: CustomTask['type'] | 'assistant';
  status: TaskCenterActivityStatus;
  progress: number;
  error?: string;
  createdAt: number;
  canRetry: boolean;
  requiresSetup: boolean;
  isGenerationJob: boolean;
  rawJob: GenerationBatchJob | null;
  rawRun: AgentRunRecord | null;
}

const isSetupRequiredError = (value: string) => {
  const error = value.toUpperCase();
  return [
    'SETUP_REQUIRED',
    'CAPABILITY_UNAVAILABLE',
    'API',
    'KEY',
    '密钥',
    '余额',
    '积分',
    'CREDIT',
    'CREDITS',
  ].some((marker) => error.includes(marker));
};

export const TaskCenterTray: React.FC<TaskCenterTrayProps> = ({
  onOpenSettings,
  isMobile = false,
}) => {
  const { activeCanvas, selectNodes, setViewportCenter } = useCanvas();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  
  // 生图队列任务
  const [generationJobs, setGenerationJobs] = useState<GenerationBatchJob[]>(() => 
    durableGenerationQueue.getJobs()
  );

  const [agentRuns, setAgentRuns] = useState<AgentRunRecord[]>(() => agentRunStore.listRuns());

  // Non-durable event tasks remain a session-only compatibility projection.
  // Durable generation and Agent state stay owned by their respective stores.
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const externalTriggerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeTaskCenter = useCallback(() => {
    const returnTarget = externalTriggerRef.current;
    externalTriggerRef.current = null;
    setIsOpen(false);
    window.requestAnimationFrame(() => returnTarget?.focus());
  }, []);

  // 订阅生图队列更新
  useEffect(() => {
    return durableGenerationQueue.subscribe((jobs) => {
      setGenerationJobs(jobs);
    });
  }, []);

  useEffect(() => agentRunStore.subscribe(setAgentRuns), []);

  useEffect(() => {
    const handleOpenRequest = () => {
      const activeElement = document.activeElement;
      externalTriggerRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
      setIsOpen(true);
    };
    window.addEventListener(TASK_CENTER_OPEN_EVENT, handleOpenRequest);
    return () => window.removeEventListener(TASK_CENTER_OPEN_EVENT, handleOpenRequest);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeTaskCenter();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeTaskCenter, isOpen]);

  // 注册全局事件，允许其他组件下发任务
  useEffect(() => {
    const handleAddTask = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.id) return;

      const newTask: CustomTask = {
        id: detail.id,
        name: detail.name || '未知任务',
        type: detail.type || 'export',
        status: detail.status || 'running',
        progress: detail.progress ?? 0,
        error: detail.error,
        createdAt: Date.now(),
      };

      setCustomTasks((prev) => {
        // 如果已存在则更新，不存在则添加
        const exists = prev.some((t) => t.id === newTask.id);
        if (exists) {
          return prev.map((t) => (t.id === newTask.id ? { ...t, ...newTask } : t));
        }
        return [newTask, ...prev];
      });

    };

    const handleUpdateTask = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.id) return;

      setCustomTasks((prev) =>
        prev.map((t) => {
          if (t.id === detail.id) {
            return {
              ...t,
              status: detail.status ?? t.status,
              progress: detail.progress ?? t.progress,
              error: detail.error ?? t.error,
            };
          }
          return t;
        })
      );
    };

    window.addEventListener('task-center:add', handleAddTask);
    window.addEventListener('task-center:update', handleUpdateTask);

    return () => {
      window.removeEventListener('task-center:add', handleAddTask);
      window.removeEventListener('task-center:update', handleUpdateTask);
    };
  }, []);

  // Read-only activity projection: Queue and Agent Run remain the sources of truth.
  const allCombinedTasks: TaskCenterActivity[] = [
    ...generationJobs.map((job) => {
      // 映射生图 job 状态
      const totalPrompts = job.prompts.length;
      const completedPrompts = job.prompts.filter((p) => p.status === 'completed').length;
      const failedPrompts = job.prompts.filter((p) => p.status === 'failed').length;
      const setupRequired = job.prompts.some((prompt) =>
        prompt.status === 'failed'
        && isSetupRequiredError(`${prompt.errorCategory || ''} ${prompt.error || ''}`)
      );
      const progress = job.progress?.percent
        ?? (totalPrompts > 0 ? Math.round(((completedPrompts + failedPrompts) / totalPrompts) * 100) : 0);

      return {
        id: job.id,
        source: 'generation' as const,
        name: job.outputGroup?.label || `批量生成任务 (${totalPrompts} 项)`,
        type: job.taskType,
        status: job.status,
        progress,
        error: failedPrompts > 0 ? `有 ${failedPrompts} 项生成失败` : undefined,
        createdAt: job.createdAt,
        isGenerationJob: true,
        canRetry: !setupRequired && job.prompts.some((prompt) => prompt.status === 'failed' && prompt.retryable !== false),
        requiresSetup: setupRequired,
        rawJob: job,
        rawRun: null,
      };
    }),
    ...agentRuns.map((run) => {
      const totalSteps = Math.max(0, Number(run.totalSteps || 0));
      const completedSteps = Math.min(totalSteps, run.completedStepIds?.length || 0);
      const isTerminal = ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(run.status);
      const status: TaskCenterActivityStatus = run.status === 'waiting_confirmation'
        ? 'waiting_confirmation'
        : run.status === 'planning' || run.status === 'waiting_execution'
          ? 'queued'
          : run.status;
      const progress = isTerminal
        ? 100
        : totalSteps > 0
          ? Math.round((completedSteps / totalSteps) * 100)
          : 0;
      const latestFailure = [...(run.stepResults || [])]
        .reverse()
        .find((step) => step.outcome !== 'success');
      const error = ['failed', 'cancelled', 'completed_with_errors'].includes(run.status)
        ? latestFailure?.message || run.nextStep
        : undefined;

      return {
        id: run.id,
        source: 'agent' as const,
        name: run.userMessage || run.intent || 'AI assistant task',
        type: 'assistant' as const,
        status,
        progress,
        error,
        createdAt: Date.parse(run.createdAt) || Date.now(),
        isGenerationJob: false,
        canRetry: false,
        requiresSetup: isSetupRequiredError(`${error || ''} ${run.nextStep || ''}`),
        rawJob: null,
        rawRun: run,
      };
    }),
    ...customTasks.map((t) => ({
      ...t,
      source: 'transient' as const,
      progress: t.progress ?? 0,
      isGenerationJob: false,
      canRetry: t.status === 'failed',
      requiresSetup: false,
      rawJob: null,
      rawRun: null,
    }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  // 过滤任务
  const filteredTasks = allCombinedTasks.filter((task) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'running') return task.status === 'running' || task.status === 'queued' || task.status === 'paused' || task.status === 'waiting_confirmation';
    if (activeTab === 'completed') return task.status === 'completed' || task.status === 'completed_with_errors';
    if (activeTab === 'failed') return task.status === 'failed' || task.status === 'cancelled' || task.status === 'completed_with_errors';
    return true;
  });

  const activeRunningCount = allCombinedTasks.filter(
    (t) => t.status === 'running'
      || t.status === 'queued'
      || t.status === 'paused'
      || t.status === 'waiting_confirmation'
  ).length;

  const handlePause = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.pauseJob(task.id);
      notify.success('任务已暂停', `已成功挂起批量生成任务：${task.name}`);
    } else if (task.source === 'transient') {
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'paused' } : t))
      );
    }
  };

  const handleResume = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.resumeJob(task.id);
      notify.success('任务已恢复', `已重新拉起批量生成任务：${task.name}`);
    } else if (task.source === 'transient') {
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: t.progress ?? 0 } : t))
      );
    }
  };

  const handleRetry = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.retryFailedPrompts(task.id);
      notify.success('已发起重试', '失败的生成项已重新进入生成队列。');
    } else if (task.source === 'transient') {
      // 自定义任务重试：发布事件让执行器感知
      window.dispatchEvent(new CustomEvent(`task-center:retry:${task.id}`, { detail: { taskId: task.id } }));
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: 10 } : t))
      );
      notify.success('已重新调度', `已向核心引擎下发任务重试指令：${task.name}`);
    }
  };

  const handleCancel = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.cancelJob(task.id);
      notify.info('任务已取消', `批量生成任务 ${task.name} 已被强制终止。`);
    } else if (task.source === 'agent' && task.rawRun) {
      void agentRuntimeInstance.cancelPendingRun(task.rawRun.id).then(() => {
        notify.info('任务已取消', `AI 任务 ${task.name} 已停止。`);
      });
    } else {
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'failed', error: '用户强制取消' } : t))
      );
      notify.info('任务已取消', `异步任务 ${task.name} 已被强制取消。`);
    }
  };

  const handleDelete = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.archiveJob(task.id);
    } else if (task.source === 'agent') {
      agentRunStore.archiveRun(task.id);
    } else {
      setCustomTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
    notify.success('任务已清理', '该任务记录已从任务托盘中移除。');
  };

  const handleClearCompleted = () => {
    durableGenerationQueue.archiveFinishedJobs();
    agentRunStore.archiveFinishedRuns();
    setCustomTasks((prev) => prev.filter((t) => t.status !== 'completed'));
    notify.success('task cleanup completed', '已自动归档所有完成的任务记录。');
  };

  const handleLocate = (task: typeof allCombinedTasks[0]) => {
    if (!task.isGenerationJob || !task.rawJob) return;
    
    const job = task.rawJob;
    const includePromptNodes = job.outputGroup?.includePromptNodes !== false;
    const promptNodeIds = includePromptNodes
      ? job.prompts.map(prompt => prompt.promptNodeId).filter((id): id is string => Boolean(id))
      : [];
    const imageNodeIds = job.prompts.flatMap(prompt => prompt.resultImageNodeIds || []);
    
    const nodeIds = Array.from(new Set([
      ...promptNodeIds,
      ...imageNodeIds,
      ...(job.outputGroup?.nodeIds || [])
    ]));

    if (nodeIds.length === 0) {
      notify.warning('未找到生成的画布节点', '任务可能尚未产出图片。');
      return;
    }

    if (typeof selectNodes === 'function') {
      selectNodes(nodeIds, 'replace');
    }

    let targetPos: { x: number; y: number } | null = null;
    const canvas = activeCanvas;
    if (canvas) {
      const foundPrompt = canvas.promptNodes?.find(n => nodeIds.includes(n.id));
      if (foundPrompt) {
        targetPos = foundPrompt.position;
      } else {
        const foundImage = canvas.imageNodes?.find(n => nodeIds.includes(n.id));
        if (foundImage) {
          targetPos = foundImage.position;
        }
      }
    }

    if (targetPos && typeof setViewportCenter === 'function') {
      setViewportCenter(targetPos);
      notify.success('已定位到生成节点', '已自动选中并在画布中心展示产物节点。');
    }
  };

  const handleCopyError = (task: typeof allCombinedTasks[0]) => {
    let errorMsg = '';
    if (task.isGenerationJob && task.rawJob) {
      const failedPrompts = task.rawJob.prompts.filter(p => p.status === 'failed' && p.error);
      if (failedPrompts.length > 0) {
        errorMsg = failedPrompts.map(p => `提示词: "${p.prompt}"\n错误原因: ${p.error}`).join('\n\n');
      } else {
        errorMsg = task.error || '未知任务错误';
      }
    } else {
      errorMsg = task.error || '未知任务错误';
    }

    navigator.clipboard.writeText(errorMsg)
      .then(() => {
        notify.success('错误已复制', '任务错误信息已成功复制到剪贴板。');
      })
      .catch((err) => {
        console.error('无法复制错误:', err);
        notify.error('复制失败', '请重试或手动复制。');
      });
  };

  // 根据类型获取图标
  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'assistant':
        return <Bot className="kk-task-center-type-icon" data-type="assistant" size={16} />;
      case 'image':
        return <Image className="kk-task-center-type-icon" data-type="image" size={16} />;
      case 'video':
        return <Video className="kk-task-center-type-icon" data-type="video" size={16} />;
      case 'audio':
        return <AudioLines className="kk-task-center-type-icon" data-type="audio" size={16} />;
      case 'ppt':
        return <FileText className="kk-task-center-type-icon" data-type="ppt" size={16} />;
      case 'extract':
        return <Globe className="kk-task-center-type-icon" data-type="extract" size={16} />;
      case 'membership':
        return <Layers className="kk-task-center-type-icon" data-type="membership" size={16} />;
      case 'export':
      default:
        return <Download className="kk-task-center-type-icon" data-type="export" size={16} />;
    }
  };

  // 根据状态获取状态徽章与类
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="kk-task-center-status" data-status="running">
            <Loader2 className="animate-spin" size={11} />
            <span>执行中</span>
          </span>
        );
      case 'queued':
        return (
          <span className="kk-task-center-status" data-status="queued">
            <Loader2 className="animate-pulse" size={11} />
            <span>排队中</span>
          </span>
        );
      case 'waiting_confirmation':
        return (
          <span className="kk-task-center-status" data-status="waiting_confirmation">
            <Bot size={11} />
            <span>等待确认</span>
          </span>
        );
      case 'paused':
        return (
          <span className="kk-task-center-status" data-status="paused">
            <Pause size={11} />
            <span>已暂停</span>
          </span>
        );
      case 'completed':
        return (
          <span className="kk-task-center-status" data-status="completed">
            <CheckCircle2 size={11} />
            <span>已完成</span>
          </span>
        );
      case 'completed_with_errors':
        return (
          <span className="kk-task-center-status" data-status="completed_with_errors">
            <AlertTriangle size={11} />
            <span>部分完成</span>
          </span>
        );
      case 'failed':
        return (
          <span className="kk-task-center-status" data-status="failed">
            <AlertTriangle size={11} />
            <span>失败</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="kk-task-center-status" data-status="cancelled">
            <X size={11} />
            <span>已取消</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-testid="desktop-task-center"
      data-mobile={isMobile ? 'true' : 'false'}
      className="kk-task-center-host fixed flex flex-col items-center pointer-events-none"
      style={{
        zIndex: KK_LAYER.floatingPanel
      }}
    >
      <div
        className="kk-task-center-morph pointer-events-auto"
        data-state={isOpen ? 'open' : 'collapsed'}
      >
        {isOpen && (
          <div
            id="desktop-task-center-panel"
            role="dialog"
            aria-modal={isMobile}
            aria-labelledby="task-center-title"
            className="kk-task-center-panel flex min-h-0 flex-1 flex-col overflow-hidden"
          >
          {/* 面板头部 */}
          <div className="kk-task-center-header">
            <div className="flex items-center gap-2">
              <span id="task-center-title" className="kk-task-center-title">任务状态列表</span>
              {activeRunningCount > 0 && (
                <span className="kk-task-center-count">
                  {activeRunningCount} 进行中
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearCompleted}
                aria-label="清理已完成任务"
                className="kk-task-center-header-action kk-task-center-clear-action"
                title="清理已完成"
              >
                <Trash2 size={13} />
                <span>清理已完成</span>
              </button>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={closeTaskCenter}
                className="kk-task-center-header-action"
                aria-label="收起任务状态列表"
                title="收起任务状态列表"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 选项卡筛选 */}
          <div className="kk-task-center-tabs" role="tablist" aria-label="任务筛选">
            {[
              { id: 'all', name: '全部' },
              { id: 'running', name: '执行中' },
              { id: 'completed', name: '已完成' },
              { id: 'failed', name: '失败任务' }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`task-center-tab-${tab.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls="task-center-list"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  onKeyDown={(event) => {
                    const tabs = ['all', 'running', 'completed', 'failed'] as const;
                    const currentIndex = tabs.indexOf(tab.id as typeof tabs[number]);
                    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
                      ? (currentIndex + 1) % tabs.length
                      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? (currentIndex - 1 + tabs.length) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : -1;
                    if (nextIndex < 0) return;
                    event.preventDefault();
                    setActiveTab(tabs[nextIndex]);
                    document.getElementById(`task-center-tab-${tabs[nextIndex]}`)?.focus();
                  }}
                  className="kk-task-center-tab"
                  data-active={active ? 'true' : 'false'}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* 任务列表内容 */}
          <div
            id="task-center-list"
            role="tabpanel"
            aria-labelledby={`task-center-tab-${activeTab}`}
            aria-live="polite"
            className="kk-task-center-list"
          >
            {filteredTasks.length === 0 ? (
              <div className="kk-task-center-empty">
                暂无匹配该筛选条件的任务记录
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isRunning = task.status === 'running' || task.status === 'queued';
                const isAwaitingConfirmation = task.status === 'waiting_confirmation';
                const isFailed = task.status === 'failed' || task.status === 'cancelled' || task.status === 'completed_with_errors';
                const isPaused = task.status === 'paused';
                
                return (
                  <div
                    key={task.id}
                    className="kk-task-center-item"
                    data-status={task.status}
                    data-source={task.source}
                  >
                    {/* 左侧信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {getTaskIcon(task.type)}
                        <span className="kk-task-center-item-name">
                          {task.name}
                        </span>
                        {getStatusDisplay(task.status)}
                      </div>
                      
                      {/* 进度条 */}
                      <div className="flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-label={`${task.name} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.max(0, Math.min(100, task.progress ?? 0))}
                          className="kk-task-center-progress"
                        >
                          <div
                            className="kk-task-center-progress-value"
                            data-status={isFailed ? 'failed' : task.status}
                            style={{ width: `${task.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="kk-task-center-progress-label">
                          {task.progress ?? 0}%
                        </span>
                      </div>

                      {task.error && (
                        <div className="kk-task-center-error">
                          <AlertTriangle size={9} />
                          <span>{task.error}</span>
                        </div>
                      )}

                      {/* Telemetry metadata row */}
                      {task.rawJob && (
                        <div className="kk-task-center-meta">
                          <span className="kk-task-center-model">
                            {task.rawJob.options?.modelId ? task.rawJob.options.modelId.slice(0, 15) : 'Model'}
                          </span>
                          <span>·</span>
                          <span className="kk-task-center-meta-accent">
                            {task.rawJob.options?.aspectRatio || '1:1'}
                          </span>
                          {task.rawJob.createdAt && (
                            <>
                              <span>·</span>
                              <span>
                                {new Date(task.rawJob.createdAt).toLocaleTimeString()}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {!task.isGenerationJob && task.createdAt && (
                        <div className="kk-task-center-meta">
                          <span>创建时间: {new Date(task.createdAt).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>

                    {/* 右侧控制动作 */}
                    <div className="kk-task-center-actions">
                      {isRunning && task.source !== 'agent' && (
                        <button
                          type="button"
                          onClick={() => handlePause(task)}
                          aria-label={`Pause ${task.name}`}
                          className="kk-task-center-action"
                          title="暂停任务"
                        >
                          <Pause size={13} />
                        </button>
                      )}

                      {isPaused && (
                        <button
                          type="button"
                          onClick={() => handleResume(task)}
                          aria-label={`Resume ${task.name}`}
                          className="kk-task-center-action"
                          data-tone="success"
                          title="恢复执行"
                        >
                          <Play size={13} />
                        </button>
                      )}

                      {isFailed && task.canRetry && (
                        <button
                          type="button"
                          onClick={() => handleRetry(task)}
                          aria-label={`Retry ${task.name}`}
                          className="kk-task-center-action"
                          data-tone="info"
                          title="失败重试"
                        >
                          <RotateCw size={13} />
                        </button>
                      )}

                      {(isRunning || isAwaitingConfirmation) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(task)}
                          aria-label={`Cancel ${task.name}`}
                          className="kk-task-center-action"
                          data-tone="danger"
                          title="取消任务"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {task.status === 'completed' && task.isGenerationJob && (
                        <button
                          type="button"
                          onClick={() => handleLocate(task)}
                          aria-label={`Locate ${task.name}`}
                          className="kk-task-center-action"
                          data-tone="info"
                          title="定位节点"
                        >
                          <Eye size={13} />
                        </button>
                      )}

                      {isFailed && (
                        <button
                          type="button"
                          onClick={() => handleCopyError(task)}
                          aria-label={`Copy error for ${task.name}`}
                          className="kk-task-center-action"
                          data-tone="warning"
                          title="复制错误"
                        >
                          <Copy size={13} />
                        </button>
                      )}

                      {isFailed && (
                        (() => {
                          const errText = String(task.error || '').toUpperCase();
                          const isSetupRequired = errText.includes('SETUP_REQUIRED') ||
                            errText.includes('CAPABILITY_UNAVAILABLE') ||
                            errText.includes('API') ||
                            errText.includes('KEY') ||
                            errText.includes('密钥') ||
                            errText.includes('余额') ||
                            errText.includes('CREDIT') ||
                            errText.includes('CREDITS');
                          if (!isSetupRequired) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenSettings?.('api-management')}
                              aria-label="Open API settings"
                              className="kk-task-center-action"
                              data-tone="info"
                              title="去配置 API"
                            >
                              <Settings size={13} />
                            </button>
                          );
                        })()
                      )}

                      {(task.status === 'completed' || isFailed) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(task)}
                          aria-label={`Archive ${task.name}`}
                          className="kk-task-center-action"
                          title="清除记录"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
};
