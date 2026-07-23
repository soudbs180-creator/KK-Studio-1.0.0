import React, { useState, useEffect } from 'react';
import { BrowserAssistantChat } from './BrowserAssistantChat';
import { BrowserAssistantTaskList } from './BrowserAssistantTaskList';
import { BrowserAssistantPermissionModal } from './BrowserAssistantPermissionModal';
import { browserAssistantService } from './browserAssistantService';
import { opencliHealthCheck } from './opencli/opencliHealthCheck';
import type { BrowserTaskIntent, BrowserTaskResult } from './browserAssistantTypes';

const persistLocalData = (k: string, v: string) => {
  localStorage.setItem(k, v);
};

export const BrowserAssistantPanel: React.FC = () => {
  const [tasks, setTasks] = useState<BrowserTaskResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocalRunnerOk, setIsLocalRunnerOk] = useState(false);
  const [runnerLatency, setRunnerLatency] = useState<number | null>(null);
  const [localToken, setLocalToken] = useState('');

  // 授权弹窗状态
  const [permissionModal, setPermissionModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    riskLevel: 'low',
    onConfirm: () => {},
    onCancel: () => {}
  });

  useEffect(() => {
    // 1. 初始化读取本地缓存的 Token
    const storedToken = localStorage.getItem('kk_local_runner_token') || '';
    setLocalToken(storedToken);

    // 2. 配置 Service 回调
    browserAssistantService.setCallbacks({
      onConfirmRequired: (intent, confirm, cancel) => {
        setPermissionModal({
          isOpen: true,
          title: `确认浏览器自动化指令`,
          description: `AI 助手请求控制本地已登录的 Chrome 浏览器执行【${intent.actionType}】操作。目标站点为【${intent.targetSite}】。由于此操作安全等级较高，请您确认后继续。`,
          riskLevel: intent.actionType === 'publish' || intent.actionType === 'delete' ? 'high' : 'medium',
          onConfirm: () => {
            setPermissionModal(prev => ({ ...prev, isOpen: false }));
            confirm();
          },
          onCancel: () => {
            setPermissionModal(prev => ({ ...prev, isOpen: false }));
            cancel();
          }
        });
      },
      onStatusUpdate: () => {
        setTasks(browserAssistantService.getTasks());
      }
    });

    // 3. 定时检测 local-runner 健康状态
    const checkRunner = async () => {
      const status = await opencliHealthCheck.check();
      setIsLocalRunnerOk(status.ok);
      setRunnerLatency(status.latencyMs || null);
    };

    void checkRunner();
    const timer = setInterval(checkRunner, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleUpdateToken = (token: string) => {
    setLocalToken(token);
    persistLocalData('kk_local_runner_token', token);
  };

  const handleExecute = async (userText: string) => {
    setIsLoading(true);
    try {
      await browserAssistantService.runTask(userText);
    } catch (e) {
      console.error('[BrowserAssistantPanel] Action failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur-lg flex flex-col space-y-4">
      {/* 炫酷头部 HSL 渐变 */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div>
          <h2 className="text-sm font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent tracking-wide">
            Browser Assistant Hub
          </h2>
          <p className="text-[10px] text-slate-400">多网站浏览器自有会员助手控制台</p>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${isLocalRunnerOk ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-rose-500 shadow-lg shadow-rose-500/50'}`} />
          <span className="text-[10px] text-slate-300">
            {isLocalRunnerOk ? `已连接 (${runnerLatency || 0}ms)` : '离线'}
          </span>
        </div>
      </div>

      {/* Local Token 安全交互输入层 */}
      <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 space-y-2">
        <label className="text-[10px] font-semibold text-slate-300 block">🗝️ Local Runner Token (本地鉴权凭证)</label>
        <div className="flex space-x-2">
          <input
            type="password"
            value={localToken}
            onChange={(e) => handleUpdateToken(e.target.value)}
            placeholder="输入 Local Runner 安全凭据文件中的配对凭证..."
            className="flex-1 px-3 py-1.5 text-[11px] text-slate-200 placeholder-slate-600 rounded-lg border border-white/10 bg-slate-950 focus:border-indigo-500 focus:outline-none transition-all"
          />
        </div>
        <p className="text-[9px] leading-relaxed text-slate-500">
          Local Runner 不会在启动日志中输出凭证；仅从本地安全凭据文件完成手动配对。
        </p>
      </div>

      {/* 对话与规划下达区域 */}
      <div>
        <BrowserAssistantChat onSend={handleExecute} isLoading={isLoading} />
      </div>

      {/* 动作状态及历史审计 */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">任务队列 & 审计日志</h3>
        <BrowserAssistantTaskList tasks={tasks} />
      </div>

      {/* 安全授权阻拦模态弹窗 */}
      <BrowserAssistantPermissionModal
        isOpen={permissionModal.isOpen}
        title={permissionModal.title}
        description={permissionModal.description}
        riskLevel={permissionModal.riskLevel}
        onConfirm={permissionModal.onConfirm}
        onCancel={permissionModal.onCancel}
      />
    </div>
  );
};
export default BrowserAssistantPanel;
