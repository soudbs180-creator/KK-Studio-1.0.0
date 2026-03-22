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
import {
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_OVERLAY_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';
import { EmptyState, ProgressBar, SettingSelect, StatusBadge } from '../ui/index';

const formatSavedSpace = (savedBytes: number) => `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;

const getModeLabel = (mode: StorageMode | null) => {
  if (mode === 'local') return '本地文件夹';
  if (mode === 'browser') return '浏览器存储';
  if (mode === 'opfs') return '设备私有存储';
  return '尚未设置';
};

const InfoCard: React.FC<{
  title: string;
  description: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, description, badge, children }) => (
  <div className="rounded-[24px] border p-5" style={SETTINGS_ELEVATED_STYLE}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold text-[var(--text-primary)]">{title}</div>
        <div className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{description}</div>
      </div>
      {badge}
    </div>
    {children ? <div className="mt-4">{children}</div> : null}
  </div>
);

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
  const [lastActionMessage, setLastActionMessage] = useState('最近还没有执行存储动作。');

  const supportsLocal = isFileSystemAccessSupported();
  const cleanupOptions = [
    { label: '1 天前缓存', days: 1 },
    { label: '7 天前缓存', days: 7 },
    { label: '30 天前缓存', days: 30 },
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

  const refresh = async () => {
    setRefreshing(true);
    setLastActionMessage('正在读取当前存储状态...');
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
    setLastActionMessage('正在切换到本地文件夹存储...');
    try {
      await connectLocalFolder();
      const handle = await getLocalFolderHandle();
      if (!handle) {
        notify.warning('未完成授权', '请先选择并授权本地文件夹。');
        setLastActionMessage('本地目录授权尚未完成。');
        return;
      }

      const ok = await setStorageMode('local');
      if (!ok) {
        notify.error('切换失败', '本地文件夹模式保存失败，请重试。');
        setLastActionMessage('切换到本地文件夹失败。');
        return;
      }

      notify.success('切换成功', '现在已经改为本地文件夹存储。');
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] 切换本地模式失败:', error);
      notify.error('切换失败', '本地文件夹连接失败，请稍后再试。');
      setLastActionMessage('切换到本地文件夹失败。');
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

      notify.success('切换成功', '现在已经改为浏览器存储。');
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] 切换浏览器模式失败:', error);
      notify.error('切换失败', '浏览器存储切换失败，请稍后再试。');
      setLastActionMessage('切换到浏览器存储失败。');
    } finally {
      setSwitchingMode(null);
    }
  };

  const handleCleanup = async () => {
    setCleanupType('compress');
    setLastActionMessage('正在清理原图缓存...');
    try {
      const result = await cleanupOriginals();
      const summary = `已处理 ${result.count} 条缓存，预计释放 ${formatSavedSpace(result.savedBytes)}。`;
      notify.success('清理完成', summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] 清理失败:', error);
      notify.error('清理失败', '请稍后重试。');
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
      console.error('[StorageSettingsView] 按时间清理失败:', error);
      notify.error('清理失败', '请稍后重试。');
      setLastActionMessage(`清理 ${days} 天前缓存失败。`);
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
    setLastActionMessage(`正在把“${sourceCanvas.name}”合并到“${activeCanvas.name}”...`);
    try {
      const result = mergeCanvasInto(sourceCanvas.id, activeCanvas.id, { deleteSource: true });
      const summary = `已合并 ${result.movedPrompts} 张主卡和 ${result.movedImages} 张子卡到“${activeCanvas.name}”。`;
      notify.success('合并完成', summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] 合并项目失败:', error);
      notify.error('合并失败', '请稍后再试。');
      setLastActionMessage('项目合并失败。');
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
    setLastActionMessage(`正在整理“${activeCanvas.name}”中的异常卡片...`);
    try {
      const result = cleanupInvalidCards(activeCanvas.id);
      const summary =
        result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0
          ? `“${activeCanvas.name}”里没有需要清理的异常卡片。`
          : `已清理 ${result.removedPrompts} 张主卡、${result.removedImages} 张子卡，并移除 ${result.removedGroups} 个空分组。`;
      notify.success('整理完成', summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] 整理项目失败:', error);
      notify.error('整理失败', '请稍后再试。');
      setLastActionMessage('项目整理失败。');
    } finally {
      setProjectAction(null);
    }
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        eyebrow="高级设置"
        title="存储设置"
        description="把存储策略、缓存清理和项目整理拆成独立动作。切换模式、清理缓存和合并项目现在都会用明确的中文按钮表达。"
        icon={HardDrive}
        tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'amber'}
        badge={<SettingsBadge tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'amber'}>{getModeLabel(mode)}</SettingsBadge>}
        actions={<SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refresh()}>刷新状态</SettingsActionButton>}
        metrics={
          <>
            <SettingsMetricCard label="当前存储" value={getModeLabel(mode)} helper={supportsLocal ? '支持本地文件夹授权' : '仅支持浏览器存储'} icon={HardDrive} tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'neutral'} />
            <SettingsMetricCard label="已存图片" value={`${imageCount}`} helper="当前可识别的图片记录总数" icon={Activity} tone="indigo" />
            <SettingsMetricCard label="占用空间" value={`${usageMB.toFixed(2)} MB`} helper={usageMB > 512 ? '建议清理缓存或迁移项目' : '容量仍处于可控范围'} icon={Layers3} tone={usageMB > 512 ? 'amber' : 'neutral'} />
            <SettingsMetricCard label="当前项目" value={activeCanvas?.name || '未打开'} helper={`${state.canvases.length} 个项目可管理`} icon={FolderOpen} tone="neutral" />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsSection title="存储策略" eyebrow="模式切换" description="模式切换只负责决定数据落盘位置，不会自动执行清理或迁移。">
          <div className="space-y-4">
            <InfoCard
              title="本地文件夹存储"
              description="适合长期归档、项目交付和跨浏览器访问。切换后会把后续读写交给你授权的本地目录。"
              badge={<StatusBadge status={mode === 'local' ? (isConnectedToLocal ? 'online' : 'warning') : 'paused'} label={mode === 'local' ? (isConnectedToLocal ? '已启用' : '待授权') : '未启用'} />}
            >
              <SettingsActionButton icon={FolderOpen} tone="primary" loading={switchingMode === 'local'} onClick={() => void switchToLocal()}>
                设为本地文件夹存储
              </SettingsActionButton>
            </InfoCard>

            <InfoCard
              title="浏览器存储"
              description="无需授权，适合快速试跑和轻量使用。切换后数据继续保留在浏览器环境内。"
              badge={<StatusBadge status={mode === 'browser' ? 'online' : 'paused'} label={mode === 'browser' ? '已启用' : '未启用'} />}
            >
              <SettingsActionButton loading={switchingMode === 'browser'} onClick={() => void switchToBrowser()}>
                设为浏览器存储
              </SettingsActionButton>
            </InfoCard>
          </div>
        </SettingsSection>

        <SettingsSection title="存储概况" eyebrow="状态总览" description="这里汇总最近一次动作结果、空间占用和本地授权支持状态。">
          <div className="space-y-4">
            <InfoCard title="最近动作" description={lastActionMessage} badge={<SettingsBadge tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'neutral'}>{getModeLabel(mode)}</SettingsBadge>} />

            <div className="rounded-[24px] border p-5" style={SETTINGS_ELEVATED_STYLE}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[16px] font-semibold text-[var(--text-primary)]">空间占用</div>
                <div className="text-[16px] font-semibold text-[var(--text-primary)]">{usageMB.toFixed(2)} MB</div>
              </div>
              <ProgressBar progress={usageProgress} tone={usageMB > 512 ? 'amber' : 'indigo'} showLabel={false} />
              <div className="mt-3 text-[12px] text-[var(--text-tertiary)]">以 1 GB 作为高占用参考阈值。</div>
            </div>

            <div className="rounded-[24px] border p-5" style={SETTINGS_OVERLAY_STYLE}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">本地授权能力</div>
                  <div className="mt-2 text-[13px] text-[var(--text-secondary)]">
                    {supportsLocal ? '当前浏览器支持本地文件夹授权。' : '当前浏览器只支持浏览器存储。'}
                  </div>
                </div>
                <StatusBadge status={supportsLocal ? 'online' : 'warning'} label={supportsLocal ? '支持' : '不支持'} />
              </div>
            </div>
          </div>
        </SettingsSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsSection title="缓存清理" eyebrow="空间回收" description="缓存清理只影响图片缓存，不会改动供应商设置或其他业务数据。">
          <div className="space-y-4">
            <InfoCard title="清理原图缓存" description="保留结果图，优先释放原图和中间缓存占用空间。" badge={<SettingsBadge tone="amber">建议定期执行</SettingsBadge>}>
              <SettingsActionButton icon={Trash2} tone="primary" loading={cleanupType === 'compress'} onClick={() => void handleCleanup()}>
                清理原图缓存
              </SettingsActionButton>
            </InfoCard>

            <div className="grid gap-3 sm:grid-cols-3">
              {cleanupOptions.map((option) => (
                <div key={option.days} className="rounded-[20px] border p-4" style={SETTINGS_OVERLAY_STYLE}>
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">{option.label}</div>
                  <div className="mt-2">
                    <SettingsActionButton
                      loading={cleanupType === option.days}
                      onClick={() => void handleCleanupByAge(option.days)}
                    >
                      {option.label}
                    </SettingsActionButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="项目整理" eyebrow="项目维护" description="整理和合并只作用在当前项目空间，不会影响你的存储模式选择。">
          {activeCanvas ? (
            <div className="space-y-4">
              <InfoCard title="整理当前项目" description="清理异常卡片、空分组和失效内容，让项目结构更干净。" badge={<SettingsBadge tone="neutral">{activeCanvas.name}</SettingsBadge>}>
                <SettingsActionButton loading={projectAction === 'cleanup'} onClick={() => void handleCleanupProjectCards()}>
                  整理当前项目
                </SettingsActionButton>
              </InfoCard>

              <InfoCard title="合并到当前项目" description="把另一个项目里的卡片迁移到当前打开的项目中，并自动删除来源项目。">
                {mergeCandidates.length > 0 ? (
                  <div className="space-y-4">
                    <SettingSelect
                      label="来源项目"
                      value={mergeSourceId}
                      options={mergeCandidates.map((canvas) => ({ value: canvas.id, label: canvas.name }))}
                      onChange={setMergeSourceId}
                    />
                    <SettingsActionButton tone="primary" loading={projectAction === 'merge'} onClick={() => void handleMergeProject()}>
                      合并到当前项目
                    </SettingsActionButton>
                  </div>
                ) : (
                  <div className="text-[13px] text-[var(--text-secondary)]">当前没有可合并的其他项目。</div>
                )}
              </InfoCard>
            </div>
          ) : (
            <EmptyState title="当前没有活动项目" description="先打开一个项目，再执行整理或合并操作。" />
          )}
        </SettingsSection>
      </div>
    </SettingsViewShell>
  );
};

export default StorageSettingsView;
