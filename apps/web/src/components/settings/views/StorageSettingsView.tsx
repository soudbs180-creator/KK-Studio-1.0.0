import React, { useEffect, useState } from 'react';
import { Activity, FolderOpen, HardDrive, Layers3, RefreshCw, Trash2 } from 'lucide-react';
import { useCanvas } from '../../../context/CanvasContext';
import {
  getLocalFolderHandle,
  getStorageMode,
  isFileSystemAccessSupported,
  setStorageMode,
  type StorageMode,
} from '../../../services/storage/storagePreference';
import {
  cleanupImagesOlderThan,
  cleanupOriginals,
  getAllImageIds,
  getStorageUsage,
} from '../../../services/storage/imageStorage';
import { notify } from '../../../services/system/notificationService';
import { SettingsActionButton, SettingsBadge, SettingsCardGridContainer, SettingsViewShell } from '../SettingsScaffold';
import { ProgressBar, SettingSelect } from '../ui/index';

const formatSavedSpace = (savedBytes: number) => `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;

const getModeLabel = (mode: StorageMode | null) => {
  if (mode === 'local') return 'Local Folder';
  if (mode === 'browser') return 'Browser Cache';
  if (mode === 'opfs') return 'Private Device';
  return 'Unassigned';
};

const StorageMetricCard: React.FC<{ label: string; value: string; helper: string; badge?: React.ReactNode }> = ({
  label,
  value,
  helper,
  badge,
}) => (
  <section className="settings-reference-card settings-reference-card--elevated">
    <div className="settings-reference-card__header">
      <div>
        <div className="settings-reference-card__eyebrow">{label}</div>
        <div className="settings-reference-card__title">{value}</div>
        <div className="settings-reference-card__meta">{helper}</div>
      </div>
      {badge}
    </div>
  </section>
);

const StorageModeTile: React.FC<{
  title: string;
  description: string;
  active: boolean;
  helper: string;
  action: React.ReactNode;
}> = ({ title, description, active, helper, action }) => (
  <div className="settings-reference-mini-metric">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="settings-reference-mini-metric__label">{title}</div>
        <div className="settings-reference-mini-metric__value">{active ? 'Active' : 'Available'}</div>
      </div>
      <SettingsBadge tone={active ? 'emerald' : 'neutral'}>{active ? 'Current Target' : 'Ready'}</SettingsBadge>
    </div>
    <div className="settings-reference-mini-metric__helper">{description}</div>
    <div className="mt-3 text-[12px] text-[var(--text-tertiary)]">{helper}</div>
    <div className="mt-4">{action}</div>
  </div>
);

export const StorageSettingsView: React.FC = () => {
  const {
    connectLocalFolder,
    disconnectLocalFolder,
    changeLocalFolder,
    isConnectedToLocal,
    state,
    activeCanvas,
    mergeCanvasInto,
    cleanupInvalidCards,
    clearAllData,
  } = useCanvas();

  const [mode, setMode] = useState<StorageMode | null>(null);
  const [usageMB, setUsageMB] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingMode, setSwitchingMode] = useState<'local' | 'browser' | null>(null);
  const [cleanupType, setCleanupType] = useState<'compress' | number | null>(null);
  const [projectAction, setProjectAction] = useState<'merge' | 'cleanup' | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [lastActionMessage, setLastActionMessage] = useState('No storage action has been executed yet.');

  const supportsLocal = isFileSystemAccessSupported();
  const cleanupOptions = [
    { label: '1 Day Cache', days: 1 },
    { label: '7 Day Cache', days: 7 },
    { label: '30 Day Cache', days: 30 },
  ] as const;
  const mergeCandidates = state.canvases.filter((canvas) => canvas.id !== activeCanvas?.id);
  const usageProgress = Math.min(100, (usageMB / 1024) * 100);

  useEffect(() => {
    setMergeSourceId((current) => {
      if (current && mergeCandidates.some((canvas) => canvas.id === current)) {
        return current;
      }
      return mergeCandidates[0]?.id || '';
    });
  }, [mergeCandidates]);

  const getLocalFolderStatusLabel = () => {
    if (!supportsLocal) {
      return 'Not supported by current browser';
    }
    if (mode === 'local') {
      return isConnectedToLocal
        ? 'Status: Active & Connected'
        : '⚠️ Status: Active but Disconnected, click Change to reauthorize';
    }
    return isConnectedToLocal
      ? 'Status: Authorized but Inactive'
      : 'Status: Supported but Disconnected';
  };

  const refresh = async () => {
    setRefreshing(true);
    setLastActionMessage('Refreshing current storage status...');
    try {
      const [storedMode, usageBytes, ids] = await Promise.all([
        getStorageMode(),
        getStorageUsage(),
        getAllImageIds(),
      ]);
      setMode(storedMode);
      setUsageMB(usageBytes / (1024 * 1024));
      setImageCount(ids.length);
      setLastActionMessage(`Status refreshed. ${ids.length} images detected and ${(usageBytes / (1024 * 1024)).toFixed(2)} MB in use.`);
    } catch (error) {
      console.error('[StorageSettingsView] Refresh failed:', error);
      setLastActionMessage('Refresh failed. Try again in a moment.');
      notify.error('刷新失败', '当前状态暂时无法读取，请稍后再试。');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const switchToLocal = async () => {
    if (!supportsLocal) {
      notify.error('当前浏览器不支持', '请改用最新版 Chrome 或 Edge。');
      return;
    }

    setSwitchingMode('local');
    setLastActionMessage('Switching persistence to a local folder...');
    try {
      await connectLocalFolder();
      const handle = await getLocalFolderHandle();
      if (!handle) {
        notify.warning('未完成授权', '请先选择并授权本地文件夹。');
        setLastActionMessage('Local folder permission was not completed.');
        return;
      }

      const ok = await setStorageMode('local');
      if (!ok) {
        notify.error('切换失败', '本地文件夹模式保存失败，请重试。');
        setLastActionMessage('Failed to activate local-folder persistence.');
        return;
      }

      notify.success('切换成功', '现在已经改为本地文件夹存储。');
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Failed to switch local mode:', error);
      notify.error('切换失败', '本地文件夹连接失败，请稍后再试。');
      setLastActionMessage('Local-folder activation failed.');
    } finally {
      setSwitchingMode(null);
    }
  };

  const switchToBrowser = async () => {
    setSwitchingMode('browser');
    setLastActionMessage('Switching persistence to browser cache...');
    try {
      await disconnectLocalFolder();
      const ok = await setStorageMode('browser');
      if (!ok) {
        notify.error('切换失败', '浏览器存储模式保存失败，请重试。');
        setLastActionMessage('Failed to activate browser persistence.');
        return;
      }

      notify.success('切换成功', '现在已经改为浏览器存储。');
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Failed to switch browser mode:', error);
      notify.error('切换失败', '浏览器存储切换失败，请稍后再试。');
      setLastActionMessage('Browser-cache activation failed.');
    } finally {
      setSwitchingMode(null);
    }
  };

  const handleCleanup = async () => {
    setCleanupType('compress');
    setLastActionMessage('Cleaning original image cache...');
    try {
      const result = await cleanupOriginals();
      const summary = `Removed ${result.count} cached originals and reclaimed about ${formatSavedSpace(result.savedBytes)}.`;
      notify.success('清理完成', summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Cleanup failed:', error);
      notify.error('清理失败', '请稍后重试。');
      setLastActionMessage('Original cache cleanup failed.');
    } finally {
      setCleanupType(null);
    }
  };

  const handleCleanupByAge = async (days: number) => {
    setCleanupType(days);
    setLastActionMessage(`Cleaning image cache older than ${days} days...`);
    try {
      const result = await cleanupImagesOlderThan(days);
      const summary =
        result.count > 0
          ? `Removed ${result.count} cached images older than ${days} days and reclaimed about ${formatSavedSpace(result.savedBytes)}.`
          : `No image cache older than ${days} days was found.`;
      notify.success('按时间清理完成', summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Cleanup by age failed:', error);
      notify.error('清理失败', '请稍后重试。');
      setLastActionMessage(`Timed cleanup for ${days}-day cache failed.`);
    } finally {
      setCleanupType(null);
    }
  };

  const handleMergeProject = async () => {
    if (!activeCanvas || !mergeSourceId) {
      notify.warning('请选择项目', '先选择一个要合并到当前项目的来源项目。');
      return;
    }

    const sourceCanvas = mergeCandidates.find((canvas) => canvas.id === mergeSourceId);
    if (!sourceCanvas) {
      notify.warning('项目不存在', '来源项目列表已变化，请重新选择。');
      return;
    }

    setProjectAction('merge');
    setLastActionMessage(`Merging "${sourceCanvas.name}" into "${activeCanvas.name}"...`);
    try {
      const result = mergeCanvasInto(sourceCanvas.id, activeCanvas.id, { deleteSource: true });
      const summary = `Merged ${result.movedPrompts} prompt cards and ${result.movedImages} image cards into "${activeCanvas.name}".`;
      notify.success('合并完成', summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] Merge failed:', error);
      notify.error('合并失败', '请稍后再试。');
      setLastActionMessage('Project merge failed.');
    } finally {
      setProjectAction(null);
    }
  };

  const handleCleanupProjectCards = async () => {
    if (!activeCanvas) {
      notify.warning('没有活动项目', '请先打开一个项目。');
      return;
    }

    setProjectAction('cleanup');
    setLastActionMessage(`Cleaning invalid cards in "${activeCanvas.name}"...`);
    try {
      const result = cleanupInvalidCards(activeCanvas.id);
      const summary =
        result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0
          ? `No invalid cards were found in "${activeCanvas.name}".`
          : `Removed ${result.removedPrompts} prompt cards, ${result.removedImages} image cards, and ${result.removedGroups} empty groups from "${activeCanvas.name}".`;
      notify.success('整理完成', summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] Project cleanup failed:', error);
      notify.error('整理失败', '请稍后再试。');
      setLastActionMessage('Project cleanup failed.');
    } finally {
      setProjectAction(null);
    }
  };

  // 简体中文：为英文版设置页提供免确认的快捷错误卡片清理操作，响应用户“错误卡片不需要危险提醒”的要求
  const handleQuickCleanupInvalid = async () => {
    if (!activeCanvas) {
      notify.warning('没有活动项目', '请先打开一个项目。');
      return;
    }

    setProjectAction('cleanup');
    try {
      const result = cleanupInvalidCards(activeCanvas.id);
      const summary =
        result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0
          ? `No invalid cards were found in "${activeCanvas.name}".`
          : `Removed ${result.removedPrompts} prompt cards, ${result.removedImages} image cards, and ${result.removedGroups} empty groups from "${activeCanvas.name}".`;
      notify.success('Cleanup complete', summary);
      setLastActionMessage(summary);
      void refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Quick cleanup failed:', error);
      notify.error('Cleanup failed', 'Please try again later.');
    } finally {
      setProjectAction(null);
    }
  };

  // 简体中文：为英文版彻底清除全部卡片与项目数据的操作提供处理器，强制弹出警示窗口，保证数据安全性
  const handleClearAllData = async () => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          '⚠️ WARNING: Are you sure you want to permanently clear all projects, cards, and image caches? This will reset the workspace. All local IndexedDB caches will be wiped out and cannot be undone!'
        );
    if (!confirmed) return;

    setCleanupType('compress'); // 复用 loading 状态
    try {
      clearAllData();
      notify.success('All Data Cleared', 'Workspace has been fully reset.');
      setLastActionMessage('All projects and caches have been cleared and reset.');
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Clear all failed:', error);
      notify.error('Clear failed', 'Please try again later.');
    } finally {
      setCleanupType(null);
    }
  };


  return (
    <SettingsViewShell>
      <SettingsCardGridContainer>
        {/* Metric Card 1: Local Permission (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Permission</span>
              <HardDrive size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{supportsLocal ? 'Supported' : 'Unavailable'}</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Local folder read/write capability.</div>
          </div>
        </div>

        {/* Metric Card 2: Active Project (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Active Project</span>
              <FolderOpen size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 truncate">{activeCanvas?.name || 'None'}</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Canvas currently in use.</div>
          </div>
        </div>

        {/* Metric Card 3: Footprint (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Footprint</span>
              <Activity size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{usageMB.toFixed(2)} MB</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Total storage consumed locally.</div>
          </div>
        </div>

        {/* Metric Card 4: Projects (1A) */}
        <div className="dashboard-grid-card">
          
          <div className="flex flex-col justify-between h-full w-full">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[9px] font-bold uppercase tracking-wider">Projects</span>
              <Layers3 size={13} />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{state.canvases.length} total</div>
            <div className="text-[9px] text-slate-400 mt-1 truncate">Total canvases stored.</div>
          </div>
        </div>

        {/* Card 5: Persistence Modes (2A * 2row) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Persistence
              </div>
              <SettingsBadge tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'amber'}>
                {getModeLabel(mode)}
              </SettingsBadge>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">Active Target</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Browser cache for sessions, local folders for workspace persistence.
            </p>

            <div className="mt-3.5 space-y-2">
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <div className="min-w-0 flex-1 mr-2">
                  <div className="text-[11px] font-semibold text-slate-900 dark:text-white">Local Folder Mode</div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">{getLocalFolderStatusLabel()}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {supportsLocal && (
                    <button
                      type="button"
                      onClick={() => void changeLocalFolder()}
                      className="bg-slate-600 hover:bg-slate-700 text-white rounded-lg py-1 px-3 text-[10px] font-bold transition active:scale-95 cursor-pointer"
                    >
                      Change
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!supportsLocal || mode === 'local'}
                    onClick={() => void switchToLocal()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1 px-3 text-[10px] font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
                  >
                    Switch
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-900 dark:text-white">Browser Cache Mode</div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">No permission required</div>
                </div>
                <button
                  type="button"
                  disabled={mode === 'browser'}
                  onClick={() => void switchToBrowser()}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-1 px-3 text-[10px] font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  Switch
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 truncate">
            Last Action: {lastActionMessage}
          </div>
        </div>

        {/* Card 6: Usage Distribution (2A * 2row) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Usage
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">Capacity Snapshot</h3>
            
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                <span>{refreshing ? 'Updating...' : `${imageCount} images`}</span>
                <span>{usageMB.toFixed(2)} MB / 1 GB</span>
              </div>
              <ProgressBar
                progress={usageProgress}
                tone={usageMB >= 768 ? 'rose' : usageMB >= 512 ? 'amber' : 'indigo'}
                showLabel={false}
              />
              <p className="text-[10px] text-slate-500 mt-2">
                Reaching storage limit triggers automatic cleanup policies.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <span className="text-[9px] text-slate-400">Quota policy: Auto-eviction</span>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void refresh()}
              className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 active:scale-95 transition cursor-pointer"
            >
              <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Card 7: Cleanup Controls (2A * 3row) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-3-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Cleanup
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">Cache & Retention Policy</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Safely reclaim local space or permanently clear all workspace data.
            </p>

            <div className="space-y-3 mt-3">
              {/* 1. Clean Broken Cards */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[11px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Clean Broken Cards
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                    Remove broken cards, stale references and empty groups from current project
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleQuickCleanupInvalid}
                  className="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 text-slate-600 dark:text-slate-200 rounded-lg py-1 px-3 text-[10px] font-semibold transition active:scale-95 shrink-0 cursor-pointer"
                >
                  Clean
                </button>
              </div>

              {/* 2. 30-Day Policy */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[11px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    30-Day Policy
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                    Keep last 30 days of image cache, logs, and task history
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cleanupType === 30}
                  onClick={() => void handleCleanupByAge(30)}
                  className="bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg py-1 px-3 text-[10px] font-semibold transition active:scale-95 shrink-0 cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {/* 3. 7-Day Policy */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[11px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    7-Day Policy
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                    Keep last 7 days of resources to reclaim maximum local storage
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cleanupType === 7}
                  onClick={() => void handleCleanupByAge(7)}
                  className="bg-orange-600/80 hover:bg-orange-600 text-white rounded-lg py-1 px-3 text-[10px] font-semibold transition active:scale-95 shrink-0 cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {/* 4. Clear All Data */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[11px] font-semibold text-red-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    Clear All Data
                  </div>
                  <div className="text-[9px] text-red-200/50 mt-0.5 leading-normal">
                    DANGER: Permanently wipe all projects, canvases, and media cache
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cleanupType === 'compress'}
                  onClick={handleClearAllData}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-lg py-1 px-3 text-[10px] font-bold transition active:scale-95 shrink-0 cursor-pointer"
                >
                  Wipe All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 8: Workspace Repair Actions (2A * 2row) */}
        <div 
          className="dashboard-grid-card a-card-span-2-col a-card-span-2-row p-4 flex flex-col justify-between"
          style={{ cursor: 'default' }}
        >
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Repair
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">Project Merge & Tidy</h3>
            
            <div className="mt-3 space-y-2.5">
              <div>
                <label className="text-[9px] text-slate-400 block mb-1">Source Canvas</label>
                <div className="select-container mt-1">
                  <SettingSelect
                    label=""
                    value={mergeSourceId}
                    options={
                      mergeCandidates.length > 0
                        ? mergeCandidates.map((canvas) => ({ value: canvas.id, label: canvas.name }))
                        : [{ value: '', label: 'No other canvas' }]
                    }
                    onChange={setMergeSourceId}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!activeCanvas || mergeCandidates.length === 0 || !mergeSourceId}
                  onClick={() => void handleMergeProject()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1.5 px-2 text-[10px] font-bold transition active:scale-95 truncate disabled:opacity-40 cursor-pointer"
                >
                  Merge into Active
                </button>
                <button
                  type="button"
                  disabled={projectAction === 'cleanup' || !activeCanvas}
                  onClick={() => void handleCleanupProjectCards()}
                  className="flex-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 text-slate-600 dark:text-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-bold transition active:scale-95 truncate cursor-pointer"
                >
                  Clean Cards
                </button>
              </div>
            </div>
          </div>
        </div>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default StorageSettingsView;
