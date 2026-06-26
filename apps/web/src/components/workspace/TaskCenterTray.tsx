import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCw,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Image,
  Video,
  FileText,
  Globe,
  Download,
  Layers,
  Eye,
  Copy,
  Settings
} from 'lucide-react';
import { durableGenerationQueue, type GenerationBatchJob } from '../../features/ai-assistant-runtime';
import { notify } from '../../services/system/notificationService';
import { useCanvas } from '../../context/CanvasContext';

interface TaskCenterTrayProps {
  onOpenSettings?: (view?: any) => void;
}

// 自定义非生图任务结构
interface CustomTask {
  id: string;
  name: string;
  type: 'image' | 'video' | 'ppt' | 'extract' | 'membership' | 'export';
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress?: number;
  error?: string;
  createdAt: number;
}

export const TaskCenterTray: React.FC<TaskCenterTrayProps> = ({ onOpenSettings }) => {
  const { activeCanvas, selectNodes, setViewportCenter } = useCanvas();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  
  // 生图队列任务
  const [generationJobs, setGenerationJobs] = useState<GenerationBatchJob[]>(() => 
    durableGenerationQueue.getJobs()
  );

  // 临时/自定义任务（如 PPT 编译、网页提取、原图打包）
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(() => {
    const saved = localStorage.getItem('kk_custom_tasks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[TaskCenter] 无法读取本地任务缓存:', e);
      }
    }
    return [];
  });

  // 订阅生图队列更新
  useEffect(() => {
    return durableGenerationQueue.subscribe((jobs) => {
      setGenerationJobs(jobs);
    });
  }, []);

  // 持久化自定义任务
  useEffect(() => {
    localStorage.setItem('kk_custom_tasks', JSON.stringify(customTasks));
  }, [customTasks]);

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

      // 自动展开任务中心
      setIsOpen(true);
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

  // 组合生图队列任务和自定义任务为统一的任务列表
  const allCombinedTasks = [
    ...generationJobs.map((job) => {
      // 映射生图 job 状态
      const totalPrompts = job.prompts.length;
      const completedPrompts = job.prompts.filter((p) => p.status === 'completed').length;
      const failedPrompts = job.prompts.filter((p) => p.status === 'failed').length;
      const progress = totalPrompts > 0 ? Math.round(((completedPrompts + failedPrompts) / totalPrompts) * 100) : 0;

      let type: 'image' | 'video' = 'image';
      if (job.options?.modelId && (job.options.modelId.includes('video') || job.options.modelId.includes('luma') || job.options.modelId.includes('runway'))) {
        type = 'video';
      }

      return {
        id: job.id,
        name: job.outputGroup?.label || `批量生成任务 (${totalPrompts} 项)`,
        type,
        status: job.status as any,
        progress,
        error: failedPrompts > 0 ? `有 ${failedPrompts} 项生成失败` : undefined,
        createdAt: job.createdAt,
        isGenerationJob: true,
        rawJob: job
      };
    }),
    ...customTasks.map((t) => ({
      ...t,
      isGenerationJob: false,
      rawJob: null
    }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  // 过滤任务
  const filteredTasks = allCombinedTasks.filter((task) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'running') return task.status === 'running' || task.status === 'queued';
    if (activeTab === 'completed') return task.status === 'completed';
    if (activeTab === 'failed') return task.status === 'failed';
    return true;
  });

  const activeRunningCount = allCombinedTasks.filter(
    (t) => t.status === 'running' || t.status === 'queued'
  ).length;

  const handlePause = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.pauseJob(task.id);
      notify.success('任务已暂停', `已成功挂起批量生成任务：${task.name}`);
    } else {
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'paused' } : t))
      );
    }
  };

  const handleResume = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.resumeJob(task.id);
      notify.success('任务已恢复', `已重新拉起批量生成任务：${task.name}`);
    } else {
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'running', progress: t.progress ?? 0 } : t))
      );
    }
  };

  const handleRetry = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.retryFailedPrompts(task.id);
      notify.success('已发起重试', '失败的生成项已重新进入生成队列。');
    } else {
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
    } else {
      setCustomTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'failed', error: '用户强制取消' } : t))
      );
      notify.info('任务已取消', `异步任务 ${task.name} 已被强制取消。`);
    }
  };

  const handleDelete = (task: typeof allCombinedTasks[0]) => {
    if (task.isGenerationJob) {
      durableGenerationQueue.cancelJob(task.id);
      durableGenerationQueue.archiveFinishedJobs();
    } else {
      setCustomTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
    notify.success('任务已清理', '该任务记录已从任务托盘中移除。');
  };

  const handleClearCompleted = () => {
    durableGenerationQueue.archiveFinishedJobs();
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
      case 'image':
        return <Image className="text-emerald-400" size={16} />;
      case 'video':
        return <Video className="text-sky-400" size={16} />;
      case 'ppt':
        return <FileText className="text-orange-400" size={16} />;
      case 'extract':
        return <Globe className="text-indigo-400" size={16} />;
      case 'membership':
        return <Layers className="text-purple-400" size={16} />;
      case 'export':
      default:
        return <Download className="text-pink-400" size={16} />;
    }
  };

  // 根据状态获取状态徽章与类
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex items-center gap-1 text-[11px] text-sky-400">
            <Loader2 className="animate-spin" size={11} />
            <span>执行中</span>
          </span>
        );
      case 'queued':
        return (
          <span className="flex items-center gap-1 text-[11px] text-amber-400">
            <Loader2 className="animate-pulse" size={11} />
            <span>排队中</span>
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Pause size={11} />
            <span>已暂停</span>
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 size={11} />
            <span>已完成</span>
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[11px] text-rose-400">
            <AlertTriangle size={11} />
            <span>失败</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <X size={11} />
            <span>已取消</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center pointer-events-none"> {/* Z_INDEX_EXCEPTION */}
      {/* 1. 悬浮底栏胶囊（折叠状态） */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full border shadow-2xl backdrop-blur-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
          style={{
            background: 'var(--frost-card-framework-bg, rgba(18, 18, 20, 0.85))', // UI_TOKEN_EXCEPTION
            border: '1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.1))', // UI_TOKEN_EXCEPTION
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)', // UI_TOKEN_EXCEPTION
          }}
        >
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${activeRunningCount > 0 ? 'bg-sky-400 animate-ping' : 'bg-emerald-400'}`} />
            {activeRunningCount > 0 && (
              <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-sky-400" />
            )}
          </div>
          
          <span className="text-xs font-semibold text-white/90">
            {activeRunningCount > 0 ? `${activeRunningCount} 个任务运行中` : '统一任务中心'}
          </span>

          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            {allCombinedTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="opacity-70">
                {getTaskIcon(task.type)}
              </div>
            ))}
            {allCombinedTasks.length > 3 && (
              <span className="text-[10px] text-gray-400">+{allCombinedTasks.length - 3}</span>
            )}
          </div>

          <ChevronUp size={14} className="text-gray-400" />
        </button>
      )}

      {/* 2. 展开抽屉面板 */}
      {isOpen && (
        <div
          className="pointer-events-auto w-[520px] max-h-[380px] rounded-3xl border shadow-3xl backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-300"
          style={{
            background: 'var(--frost-card-framework-bg, rgba(18, 18, 20, 0.95))', // UI_TOKEN_EXCEPTION
            border: '1px solid var(--frost-card-framework-border, rgba(255, 255, 255, 0.15))', // UI_TOKEN_EXCEPTION
            boxShadow: '0 24px 64px 0 rgba(0, 0, 0, 0.6)', // UI_TOKEN_EXCEPTION
          }}
        >
          {/* 面板头部 */}
          <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-white/2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">统一任务控制台</span>
              {activeRunningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400">
                  {activeRunningCount} 运行中
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearCompleted}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
                title="清理已完成"
              >
                <Trash2 size={13} />
                <span>清理已完成</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* 选项卡筛选 */}
          <div className="flex px-4 py-2 border-b border-white/5 gap-1 bg-white/1">
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
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${
                    active 
                      ? 'bg-white/10 text-white font-medium' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* 任务列表内容 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[250px]">
            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                暂无匹配该筛选条件的任务记录
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isRunning = task.status === 'running' || task.status === 'queued';
                const isFailed = task.status === 'failed' || task.status === 'cancelled';
                const isPaused = task.status === 'paused';
                
                return (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-2xl border border-white/5 bg-white/2 hover:bg-white/4 transition-colors flex items-center justify-between gap-4"
                  >
                    {/* 左侧信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {getTaskIcon(task.type)}
                        <span className="text-xs font-semibold text-white/95 truncate">
                          {task.name}
                        </span>
                        {getStatusDisplay(task.status)}
                      </div>
                      
                      {/* 进度条 */}
                      <div className="flex items-center gap-3">
                        <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isFailed 
                                ? 'bg-rose-500' 
                                : task.status === 'completed' 
                                  ? 'bg-emerald-500' 
                                  : 'bg-sky-500 animate-pulse'
                            }`}
                            style={{ width: `${task.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400 min-w-[28px] text-right">
                          {task.progress ?? 0}%
                        </span>
                      </div>

                      {task.error && (
                        <div className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                          <AlertTriangle size={9} />
                          <span>{task.error}</span>
                        </div>
                      )}
                    </div>

                    {/* 右侧控制动作 */}
                    <div className="flex items-center gap-1.5 pl-2 border-l border-white/5">
                      {isRunning && (
                        <button
                          onClick={() => handlePause(task)}
                          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="暂停任务"
                        >
                          <Pause size={13} />
                        </button>
                      )}

                      {isPaused && (
                        <button
                          onClick={() => handleResume(task)}
                          className="p-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                          title="恢复执行"
                        >
                          <Play size={13} />
                        </button>
                      )}

                      {isFailed && (
                        <button
                          onClick={() => handleRetry(task)}
                          className="p-2 rounded-xl text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                          title="失败重试"
                        >
                          <RotateCw size={13} />
                        </button>
                      )}

                      {isRunning && (
                        <button
                          onClick={() => handleCancel(task)}
                          className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="取消任务"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {task.status === 'completed' && task.isGenerationJob && (
                        <button
                          onClick={() => handleLocate(task)}
                          className="p-2 rounded-xl text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                          title="定位节点"
                        >
                          <Eye size={13} />
                        </button>
                      )}

                      {isFailed && (
                        <button
                          onClick={() => handleCopyError(task)}
                          className="p-2 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
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
                              onClick={() => onOpenSettings?.('api-management')}
                              className="p-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                              title="去配置 API"
                            >
                              <Settings size={13} />
                            </button>
                          );
                        })()
                      )}

                      {(task.status === 'completed' || isFailed) && (
                        <button
                          onClick={() => handleDelete(task)}
                          className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
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
  );
};
