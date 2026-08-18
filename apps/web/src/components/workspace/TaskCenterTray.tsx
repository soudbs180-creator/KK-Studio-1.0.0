import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  FileText,
  Globe,
  Download,
  Copy,
  Settings,
  Bot,
} from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import type {
  PublicTaskAction,
  PublicTaskPhase,
  PublicTaskProjectionDto,
  PublicTaskTerminalOutcome,
} from '@kk/shared';
import {
  getPublicTaskDisplayStatus,
  getPublicTaskProgressPercent,
  projectLocalTask,
  type LocalTaskInput,
  type PublicTaskSourceStatus,
} from '../../features/tasks/publicTaskProjection.ts';
import {
  archiveFinishedPublicTaskProjections,
  archivePublicTaskProjection,
  dispatchPublicTaskAction,
} from '../../features/tasks/publicTaskProjectionSource.ts';
import { usePublicTaskProjections } from '../../features/tasks/usePublicTaskProjections.ts';
import { notify } from '../../services/system/notificationService';
import type { SettingsSurfaceView } from '../../hooks/useWorkspaceSurface';
import { TASK_CENTER_OPEN_EVENT, TASK_CENTER_TOGGLE_EVENT } from './taskCenterEvents';

interface TaskCenterTrayProps {
  onOpenSettings?: (view?: SettingsSurfaceView) => void;
  isChatOpen?: boolean;
  chatSidebarWidth?: number;
  isMobile?: boolean;
}

type LocalTaskProjection = Extract<PublicTaskProjectionDto, { source: 'local_task' }>;
type TaskDisplayStatus = PublicTaskPhase | PublicTaskTerminalOutcome;

const LOCAL_EVENT_STATUSES = new Set<PublicTaskSourceStatus>([
  'running', 'completed', 'failed', 'paused', 'cancelled', 'completed_with_errors',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeLocalStatus = (value: unknown, fallback: PublicTaskSourceStatus) => (
  typeof value === 'string' && LOCAL_EVENT_STATUSES.has(value as PublicTaskSourceStatus)
    ? value as PublicTaskSourceStatus
    : fallback
);

const optionalString = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value.trim() : undefined
);

const getLocalSourceStatus = (task?: LocalTaskProjection): PublicTaskSourceStatus => {
  if (!task) return 'running';
  if (task.terminalOutcome) return task.terminalOutcome;
  return task.phase === 'terminal' ? 'completed' : task.phase;
};

const localTaskInputFromEvent = (
  detail: Record<string, unknown>,
  current?: LocalTaskProjection,
): LocalTaskInput => ({
  id: optionalString(detail.id) || current?.localTaskId || '',
  status: normalizeLocalStatus(detail.status, getLocalSourceStatus(current)),
  progress: typeof detail.progress === 'number' ? detail.progress : current?.progress?.completed,
  code: optionalString(detail.errorCode) || current?.error?.code,
  category: optionalString(detail.errorCategory) || current?.error?.category,
  retryable: typeof detail.retryable === 'boolean' ? detail.retryable : current?.error?.retryable,
  createdAt: current?.createdAt || Date.now(),
  updatedAt: Date.now(),
});

const isTerminalFailure = (status: TaskDisplayStatus): boolean => (
  ['failed', 'cancelled', 'completed_with_errors'].includes(status)
);

export const TaskCenterTray: React.FC<TaskCenterTrayProps> = ({
  onOpenSettings,
  isMobile = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const authoritativeTasks = usePublicTaskProjections();
  const [localTasks, setLocalTasks] = useState<LocalTaskProjection[]>([]);
  const externalTriggerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeTaskCenter = useCallback(() => {
    const returnTarget = externalTriggerRef.current;
    externalTriggerRef.current = null;
    setIsOpen(false);
    window.requestAnimationFrame(() => returnTarget?.focus());
  }, []);

  useEffect(() => {
    const rememberExternalTrigger = () => {
      const activeElement = document.activeElement;
      externalTriggerRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    };
    const handleOpenRequest = () => {
      rememberExternalTrigger();
      setIsOpen(true);
    };
    const handleToggleRequest = () => {
      setIsOpen((currentOpen) => {
        if (currentOpen) {
          const returnTarget = externalTriggerRef.current;
          externalTriggerRef.current = null;
          window.requestAnimationFrame(() => returnTarget?.focus());
          return false;
        }
        rememberExternalTrigger();
        return true;
      });
    };
    window.addEventListener(TASK_CENTER_OPEN_EVENT, handleOpenRequest);
    window.addEventListener(TASK_CENTER_TOGGLE_EVENT, handleToggleRequest);
    return () => {
      window.removeEventListener(TASK_CENTER_OPEN_EVENT, handleOpenRequest);
      window.removeEventListener(TASK_CENTER_TOGGLE_EVENT, handleToggleRequest);
    };
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

  // Legacy event tasks are immediately reduced to safe local-task projections.
  useEffect(() => {
    const handleAddTask = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isRecord(detail) || !optionalString(detail.id)) return;
      const projection = projectLocalTask(localTaskInputFromEvent(detail));
      setLocalTasks((currentTasks) => {
        const remaining = currentTasks.filter((task) => task.localTaskId !== projection.localTaskId);
        return [projection, ...remaining];
      });
    };

    const handleUpdateTask = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const taskId = isRecord(detail) ? optionalString(detail.id) : undefined;
      if (!taskId || !isRecord(detail)) return;
      setLocalTasks((currentTasks) => currentTasks.map((task) => (
        task.localTaskId === taskId
          ? projectLocalTask(localTaskInputFromEvent(detail, task))
          : task
      )));
    };

    window.addEventListener('task-center:add', handleAddTask);
    window.addEventListener('task-center:update', handleUpdateTask);

    return () => {
      window.removeEventListener('task-center:add', handleAddTask);
      window.removeEventListener('task-center:update', handleUpdateTask);
    };
  }, []);

  const allCombinedTasks = useMemo<PublicTaskProjectionDto[]>(() => [
    ...authoritativeTasks,
    ...localTasks,
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [
    authoritativeTasks,
    localTasks,
  ]);

  // 过滤任务
  const filteredTasks = allCombinedTasks.filter((task) => {
    const displayStatus = getPublicTaskDisplayStatus(task);
    if (activeTab === 'all') return true;
    if (activeTab === 'running') return task.phase !== 'terminal';
    if (activeTab === 'completed') return displayStatus === 'completed';
    if (activeTab === 'failed') return isTerminalFailure(displayStatus) || Boolean(task.error);
    return true;
  });

  const activeRunningCount = allCombinedTasks.filter(
    (task) => task.phase !== 'terminal'
  ).length;

  const updateLocalTaskStatus = (
    task: LocalTaskProjection,
    status: PublicTaskSourceStatus,
    progress?: number,
  ) => setLocalTasks((currentTasks) => currentTasks.map((candidate) => (
    candidate.localTaskId === task.localTaskId
      ? projectLocalTask({
        id: task.localTaskId,
        status,
        progress: progress ?? task.progress?.completed,
        createdAt: task.createdAt,
        updatedAt: Date.now(),
      })
      : candidate
  )));

  const handleAction = (task: PublicTaskProjectionDto, action: PublicTaskAction) => {
    if (task.source === 'local_task') {
      if (action === 'pause') updateLocalTaskStatus(task, 'paused');
      if (action === 'resume') updateLocalTaskStatus(task, 'running');
      if (action === 'retry') {
        window.dispatchEvent(new CustomEvent(`task-center:retry:${task.localTaskId}`, {
          detail: { taskId: task.localTaskId },
        }));
        updateLocalTaskStatus(task, 'running', 10);
      }
      if (action === 'cancel') updateLocalTaskStatus(task, 'cancelled');
      return;
    }
    void dispatchPublicTaskAction(task, action);
  };

  const handlePause = (task: PublicTaskProjectionDto) => {
    handleAction(task, 'pause');
    notify.success('任务已暂停', `${task.title} 已挂起。`);
  };

  const handleResume = (task: PublicTaskProjectionDto) => {
    handleAction(task, 'resume');
    notify.success('任务已恢复', `${task.title} 已重新调度。`);
  };

  const handleRetry = (task: PublicTaskProjectionDto) => {
    handleAction(task, 'retry');
    notify.success('已发起重试', `${task.title} 已重新调度。`);
  };

  const handleCancel = (task: PublicTaskProjectionDto) => {
    handleAction(task, 'cancel');
    notify.info('任务已取消', `${task.title} 已收到取消请求。`);
  };

  const handleDelete = (task: PublicTaskProjectionDto) => {
    let archived = false;
    if (task.source === 'local_task') {
      setLocalTasks((current) => current.filter((item) => item.localTaskId !== task.localTaskId));
      archived = true;
    } else {
      archived = archivePublicTaskProjection(task);
    }
    if (archived) notify.success('任务已清理', '该任务记录已从任务托盘中移除。');
  };

  const handleClearCompleted = () => {
    archiveFinishedPublicTaskProjections();
    setLocalTasks((current) => current.filter((task) => task.phase !== 'terminal'));
    notify.success('任务清理完成', '已归档所有终态任务记录。');
  };

  const handleCopyError = (task: PublicTaskProjectionDto) => {
    if (!task.error) return;
    const safeError = `code: ${task.error.code}\ncategory: ${task.error.category}\nphase: ${task.phase}`;
    navigator.clipboard.writeText(safeError)
      .then(() => {
        notify.success('错误已复制', '任务错误信息已成功复制到剪贴板。');
      })
      .catch(() => notify.error('复制失败', '请重试或手动复制。'));
  };

  const getTaskIcon = (source: PublicTaskProjectionDto['source']) => {
    switch (source) {
      case 'agent_run':
        return <Bot className="kk-task-center-type-icon" data-type="assistant" size={16} />;
      case 'generation_job':
        return <Image className="kk-task-center-type-icon" data-type="image" size={16} />;
      case 'local_task':
        return <FileText className="kk-task-center-type-icon" data-type="ppt" size={16} />;
      case 'paired_command':
        return <Globe className="kk-task-center-type-icon" data-type="extract" size={16} />;
      case 'app_update':
        return <Download className="kk-task-center-type-icon" data-type="export" size={16} />;
    }
  };

  // 根据状态获取状态徽章与类
  const getStatusDisplay = (status: TaskDisplayStatus) => {
    switch (status) {
      case 'running':
      case 'retrying':
      case 'verifying':
        return (
          <span className="kk-task-center-status" data-status={status}>
            <Loader2 className="animate-spin" size={11} />
            <span>{status === 'verifying' ? '验证中' : status === 'retrying' ? '重试中' : '执行中'}</span>
          </span>
        );
      case 'queued':
      case 'planning':
      case 'waiting_execution':
        return (
          <span className="kk-task-center-status" data-status={status}>
            <Loader2 className="animate-pulse" size={11} />
            <span>{status === 'planning' ? '规划中' : status === 'waiting_execution' ? '等待执行' : '排队中'}</span>
          </span>
        );
      case 'waiting_confirmation':
        return (
          <span className="kk-task-center-status" data-status="waiting_confirmation">
            <Bot size={11} />
            <span>等待确认</span>
          </span>
        );
      case 'waiting_for_device':
      case 'setup_required':
      case 'verification_required':
      case 'manual_reconcile':
        return (
          <span className="kk-task-center-status" data-status={status}>
            <AlertTriangle size={11} />
            <span>{status === 'waiting_for_device' ? '等待设备' : status === 'setup_required' ? '需要设置' : '需要处理'}</span>
          </span>
        );
      case 'pausing':
      case 'cancelling':
        return (
          <span className="kk-task-center-status" data-status={status}>
            <Loader2 className="animate-spin" size={11} />
            <span>{status === 'pausing' ? '暂停中' : '取消中'}</span>
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
                const displayStatus = getPublicTaskDisplayStatus(task);
                const progressPercent = getPublicTaskProgressPercent(task);
                const isFailed = isTerminalFailure(displayStatus) || Boolean(task.error);
                
                return (
                  <div
                    key={task.projectionId}
                    className="kk-task-center-item"
                    data-status={displayStatus}
                    data-source={task.source}
                  >
                    {/* 左侧信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {getTaskIcon(task.source)}
                        <span className="kk-task-center-item-name">
                          {task.title}
                        </span>
                        {getStatusDisplay(displayStatus)}
                      </div>
                      
                      {/* 进度条 */}
                      <div className="flex items-center gap-3">
                        <div
                          role="progressbar"
                          aria-label={`${task.title} progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progressPercent}
                          className="kk-task-center-progress"
                        >
                          <div
                            className="kk-task-center-progress-value"
                            data-status={isFailed ? 'failed' : displayStatus}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="kk-task-center-progress-label">
                          {progressPercent}%
                        </span>
                      </div>

                      {task.error && (
                        <div className="kk-task-center-error">
                          <AlertTriangle size={9} />
                          <span>{task.error.code} · {task.error.category}</span>
                        </div>
                      )}

                      <div className="kk-task-center-meta">
                        <span>创建时间: {new Date(task.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* 右侧控制动作 */}
                    <div className="kk-task-center-actions">
                      {task.allowedActions.includes('pause') && (
                        <button
                          type="button"
                          onClick={() => handlePause(task)}
                          aria-label={`Pause ${task.title}`}
                          className="kk-task-center-action"
                          title="暂停任务"
                        >
                          <Pause size={13} />
                        </button>
                      )}

                      {task.allowedActions.includes('resume') && (
                        <button
                          type="button"
                          onClick={() => handleResume(task)}
                          aria-label={`Resume ${task.title}`}
                          className="kk-task-center-action"
                          data-tone="success"
                          title="恢复执行"
                        >
                          <Play size={13} />
                        </button>
                      )}

                      {task.allowedActions.includes('retry') && (
                        <button
                          type="button"
                          onClick={() => handleRetry(task)}
                          aria-label={`Retry ${task.title}`}
                          className="kk-task-center-action"
                          data-tone="info"
                          title="失败重试"
                        >
                          <RotateCw size={13} />
                        </button>
                      )}

                      {task.allowedActions.includes('cancel') && (
                        <button
                          type="button"
                          onClick={() => handleCancel(task)}
                          aria-label={`Cancel ${task.title}`}
                          className="kk-task-center-action"
                          data-tone="danger"
                          title="取消任务"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {task.error && (
                        <button
                          type="button"
                          onClick={() => handleCopyError(task)}
                          aria-label={`Copy error for ${task.title}`}
                          className="kk-task-center-action"
                          data-tone="warning"
                          title="复制错误"
                        >
                          <Copy size={13} />
                        </button>
                      )}

                      {task.allowedActions.includes('open_runtime_settings') && (
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
                      )}

                      {task.phase === 'terminal' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(task)}
                          aria-label={`Archive ${task.title}`}
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
