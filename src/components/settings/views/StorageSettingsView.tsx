import React, { useEffect, useState } from 'react';
import { Activity, HardDrive, RefreshCw, Trash2 } from 'lucide-react';
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
import {
  DangerButton,
  EmptyState,
  MetricCard,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SettingCard,
  SettingSelect,
  StatusBadge,
} from '../ui/index';

export const StorageSettingsView: React.FC = () => {
  const {
    connectLocalFolder,
    disconnectLocalFolder,
    isConnectedToLocal,
    state,
    activeCanvas,
    mergeCanvasInto,
    cleanupInvalidCards,
  } = useCanvas();

  const [mode, setMode] = useState<StorageMode | null>(null);
  const [usageMB, setUsageMB] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingMode, setSwitchingMode] = useState<'local' | 'browser' | null>(null);
  const [cleanupType, setCleanupType] = useState<'compress' | number | null>(null);
  const [projectAction, setProjectAction] = useState<'merge' | 'cleanup' | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [lastActionMessage, setLastActionMessage] = useState('最近一次状态读取尚未执行。');

  const supportsLocal = isFileSystemAccessSupported();
  const isBusy = refreshing || switchingMode !== null || cleanupType !== null;
  const cleanupOptions = [
    { label: '1 天前', days: 1 },
    { label: '7 天前', days: 7 },
    { label: '30 天前', days: 30 },
  ] as const;
  const mergeCandidates = state.canvases.filter((canvas) => canvas.id !== activeCanvas?.id);

  const formatSavedSpace = (savedBytes: number) => `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;

  useEffect(() => {
    setMergeSourceId((current) => {
      if (current && mergeCandidates.some((canvas) => canvas.id === current)) {
        return current;
      }
      return mergeCandidates[0]?.id || '';
    });
  }, [mergeCandidates]);

  const refresh = async () => {
    setRefreshing(true);
    setLastActionMessage('正在重新读取存储状态...');
    try {
      const [storedMode, usageBytes, ids] = await Promise.all([
        getStorageMode(),
        getStorageUsage(),
        getAllImageIds(),
      ]);

      setMode(storedMode);
      setUsageMB(usageBytes / (1024 * 1024));
      setImageCount(ids.length);
      setLastActionMessage(`状态已刷新：共 ${ids.length} 张图片，占用 ${(usageBytes / (1024 * 1024)).toFixed(2)} MB。`);
    } catch (error) {
      console.error('[StorageSettingsView] 刷新失败:', error);
      setLastActionMessage('刷新失败，请稍后重试。');
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
    setLastActionMessage('正在切换到本地文档夹存储...');
    try {
      await connectLocalFolder();
      const handle = await getLocalFolderHandle();
      if (!handle) {
        notify.warning('未完成授权', '请先选择并授权本地文档夹。');
        setLastActionMessage('本地目录授权未完成。');
        return;
      }

      const ok = await setStorageMode('local');
      if (!ok) {
        notify.error('切换失败', '本地文档夹模式保存失败，请重试。');
        setLastActionMessage('切换到本地文档夹失败。');
        return;
      }

      notify.success('切换成功', '已切换为本地文档夹存储。');
      await refresh();
    } catch (error) {
      notify.error('切换失败', '本地文档夹连接失败，请重试。');
      console.error('[StorageSettingsView] 切换本地模式失败:', error);
      setLastActionMessage('切换到本地文档夹失败。');
    } finally {
      setSwitchingMode(null);
    }
  };

  const switchToBrowser = async () => {
    setSwitchingMode('browser');
    setLastActionMessage('正在切换到浏览器存储...');
    try {
      await disconnectLocalFolder();
      const ok = await setStorageMode('browser');
      if (!ok) {
        notify.error('切换失败', '浏览器存储模式保存失败，请重试。');
        setLastActionMessage('切换到浏览器存储失败。');
        return;
      }

      notify.success('切换成功', '已切换为浏览器存储。');
      await refresh();
    } catch (error) {
      notify.error('切换失败', '浏览器存储切换失败，请重试。');
      console.error('[StorageSettingsView] 切换浏览器模式失败:', error);
      setLastActionMessage('切换到浏览器存储失败。');
    } finally {
      setSwitchingMode(null);
    }
  };

  const handleCleanup = async () => {
    setCleanupType('compress');
    setLastActionMessage('正在压缩并清理原图缓存...');
    try {
      const result = await cleanupOriginals();
      const summary = `共处理 ${result.count} 条缓存，预计释放 ${formatSavedSpace(result.savedBytes)}。`;
      notify.success('清理完成', summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      notify.error('清理失败', '请稍后重试。');
      console.error('[StorageSettingsView] 清理失败:', error);
      setLastActionMessage('原图缓存清理失败。');
    } finally {
      setCleanupType(null);
    }
  };

  const handleCleanupByAge = async (days: number) => {
    setCleanupType(days);
    setLastActionMessage(`正在清理 ${days} 天前的缓存图片...`);
    try {
      const result = await cleanupImagesOlderThan(days);
      const summary =
        result.count > 0
          ? `已清理 ${days} 天前的 ${result.count} 条缓存，预计释放 ${formatSavedSpace(result.savedBytes)}。`
          : `没有找到 ${days} 天前可清理的缓存图片。`;
      notify.success('按时间清理完成', summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      notify.error('按时间清理失败', '请稍后重试。');
      console.error('[StorageSettingsView] 按时间清理失败:', error);
      setLastActionMessage(`清理 ${days} 天前缓存失败。`);
    } finally {
      setCleanupType(null);
    }
  };

  const handleMergeProject = async () => {
    if (!activeCanvas || !mergeSourceId) {
      notify.warning('请选择项目', '先选一个要合并进当前画布的项目。');
      return;
    }

    const sourceCanvas = mergeCandidates.find((canvas) => canvas.id === mergeSourceId);
    if (!sourceCanvas) {
      notify.warning('项目不存在', '目标项目列表已变化，请重新选择。');
      return;
    }

    setProjectAction('merge');
    setLastActionMessage(`正在把"${sourceCanvas.name}"合并到"${activeCanvas.name}"...`);
    try {
      const result = mergeCanvasInto(sourceCanvas.id, activeCanvas.id, { deleteSource: true });
      const summary = `已合并 ${result.movedPrompts} 张主卡和 ${result.movedImages} 张子卡到"${activeCanvas.name}"。`;
      notify.success('项目合并完成', summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] 项目合并失败:', error);
      notify.error('项目合并失败', '请稍后重试。');
      setLastActionMessage('项目合并失败。');
    } finally {
      setProjectAction(null);
    }
  };

  const handleCleanupProjectCards = async () => {
    if (!activeCanvas) {
      notify.warning('没有活动项目', '请先打开一个项目再执行清理。');
      return;
    }

    setProjectAction('cleanup');
    setLastActionMessage(`正在清理"${activeCanvas.name}"中的错误卡片...`);
    try {
      const result = cleanupInvalidCards(activeCanvas.id);
      const summary =
        result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0
          ? `"${activeCanvas.name}"里没有发现需要清理的错误卡片。`
          : `已清理 ${result.removedPrompts} 张主卡、${result.removedImages} 张子卡，并移除 ${result.removedGroups} 个空分组。`;
      notify.success('项目整理完成', summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] 错误卡片清理失败:', error);
      notify.error('错误卡片清理失败', '请稍后重试。');
      setLastActionMessage('错误卡片清理失败。');
    } finally {
      setProjectAction(null);
    }
  };

  const modeLabel = mode === 'local' ? '本地文档夹' : mode === 'browser' ? '浏览器存储' : '未设置';
  const modeStatus = mode === 'local' ? 'online' : mode === 'browser' ? 'warning' : 'paused';
  const usageProgress = Math.min(100, (usageMB / 1024) * 100);

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard value={modeLabel} label="当前存储" helper={supportsLocal ? '支持本地目录授权' : '仅浏览器存储'} tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'neutral'} />
        <MetricCard value={`${imageCount} 张`} label="已存图片" helper="当前可识别的图片记录" tone="indigo" />
        <MetricCard value={`${usageMB.toFixed(2)} MB`} label="占用空间" helper={usageMB > 512 ? '建议清理缓存' : '容量处于可控范围'} tone={usageMB > 512 ? 'amber' : 'neutral'} />
        <MetricCard value={activeCanvas?.name || '未打开'} label="当前项目" helper={`${state.canvases.length} 个项目`} tone="neutral" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <SettingCard title="存储策略">
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-[var(--text-primary)]">本地文档夹存储</div>
                  <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">适合长期归档、项目交付和跨浏览器访问。</div>
                </div>
                <StatusBadge status={mode === 'local' ? (isConnectedToLocal ? 'online' : 'warning') : 'paused'} />
              </div>
              <div className="mt-3 flex gap-2">
                <PrimaryButton onClick={() => void switchToLocal()} loading={switchingMode === 'local'} className="flex-1">
                  切换到本地文档夹
                </PrimaryButton>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-[var(--text-primary)]">浏览器存储</div>
                  <div className="mt-1 text-[13px] leading-6 text-[var(--text-secondary)]">无需授权，适合试跑和轻量场景。</div>
                </div>
                <StatusBadge status={mode === 'browser' ? 'online' : 'paused'} />
              </div>
              <div className="mt-3 flex gap-2">
                <SecondaryButton onClick={() => void switchToBrowser()} className="flex-1">
                  {switchingMode === 'browser' ? '正在切换...' : '切换到浏览器存储'}
                </SecondaryButton>
              </div>
            </div>
          </div>
        </SettingCard>

        <SettingCard title="存储概况">
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-medium text-[var(--text-primary)]">当前状态</div>
                  <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{lastActionMessage}</div>
                </div>
                <StatusBadge status={modeStatus} />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[15px] font-medium text-[var(--text-primary)]">空间占用</div>
                <div className="text-[14px] font-semibold text-[var(--text-primary)]">{usageMB.toFixed(2)} MB</div>
              </div>
              <ProgressBar progress={usageProgress} tone={usageMB > 512 ? 'amber' : 'indigo'} showLabel={false} />
              <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">以 1 GB 为高占用参考阈值</div>
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={() => void refresh()} className="flex-1">
                <RefreshCw size={14} className="mr-1 inline-block" />
                {refreshing ? '正在刷新...' : '刷新状态'}
              </SecondaryButton>
            </div>
          </div>
        </SettingCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <SettingCard title="缓存清理">
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
              <div className="text-[15px] font-medium text-[var(--text-primary)]">压缩原图缓存</div>
              <div className="mt-1 text-[13px] text-[var(--text-secondary)]">保留结果图，尽量释放原图占用空间。</div>
              <div className="mt-3">
                <PrimaryButton onClick={() => void handleCleanup()} loading={cleanupType === 'compress'}>
                  <Trash2 size={14} className="mr-1 inline-block" />清理原图缓存
                </PrimaryButton>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {cleanupOptions.map((option) => (
                <SecondaryButton key={option.days} onClick={() => void handleCleanupByAge(option.days)}>
                  {cleanupType === option.days ? '清理中...' : `清理 ${option.label}`}
                </SecondaryButton>
              ))}
            </div>
          </div>
        </SettingCard>

        <SettingCard title="项目整理">
          {activeCanvas ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
                <div className="text-[15px] font-medium text-[var(--text-primary)]">整理当前项目</div>
                <div className="mt-1 text-[13px] text-[var(--text-secondary)]">清理错误卡片、空分组和无效内容。</div>
                <div className="mt-3">
                  <SecondaryButton onClick={() => void handleCleanupProjectCards()}>
                    {projectAction === 'cleanup' ? '整理中...' : '整理当前项目'}
                  </SecondaryButton>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-light)] p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 30%, transparent)' }}>
                <div className="text-[15px] font-medium text-[var(--text-primary)]">合并项目到当前画布</div>
                <div className="mt-1 text-[13px] text-[var(--text-secondary)]">把其他项目的卡片迁移到当前打开的项目中。</div>
                <div className="mt-3 space-y-3">
                  <SettingSelect
                    label="来源项目"
                    value={mergeSourceId}
                    options={mergeCandidates.map((canvas) => ({ value: canvas.id, label: canvas.name }))}
                    onChange={setMergeSourceId}
                    helper={mergeCandidates.length === 0 ? '没有可合并的其他项目' : undefined}
                  />
                  <PrimaryButton onClick={() => void handleMergeProject()} loading={projectAction === 'merge'}>
                    合并到当前项目
                  </PrimaryButton>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="当前没有活动项目" description="先打开一个项目，再执行整理或合并操作。" />
          )}
        </SettingCard>
      </div>
    </div>
  );
};

export default StorageSettingsView;
