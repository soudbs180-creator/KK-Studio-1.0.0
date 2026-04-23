import React, { useEffect, useState } from 'react';
import { Activity, FolderOpen, HardDrive, Layers3, RefreshCw, Trash2 } from 'lucide-react';
import { useCanvas } from '../../../context/CanvasContext';
import { useLocale } from '../../../context/LocaleContext';
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
  cleanupOriginalsOlderThan,
  getAllImageIds,
  getStorageUsage,
} from '../../../services/storage/imageStorage';
import { cleanupCompletedTasksOlderThan } from '../../../services/persistence/taskPersistence';
import { cleanupLogsOlderThan } from '../../../services/system/systemLogService';
import { notify } from '../../../services/system/notificationService';
import { SettingsActionButton, SettingsBadge, SettingsViewShell } from '../SettingsScaffold';
import { ProgressBar, SettingSelect } from '../ui/index';

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
}> = ({ title, description, active, helper, action }) => {
  const { pick } = useLocale();

  return (
    <div className="settings-reference-mini-metric">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="settings-reference-mini-metric__label">{title}</div>
          <div className="settings-reference-mini-metric__value">{active ? pick('已启用', 'Active') : pick('可用', 'Available')}</div>
        </div>
        <SettingsBadge tone={active ? 'emerald' : 'neutral'}>{active ? pick('当前使用', 'Current') : pick('可切换', 'Ready')}</SettingsBadge>
      </div>
      <div className="settings-reference-mini-metric__helper">{description}</div>
      <div className="mt-3 text-[12px] text-[var(--text-tertiary)]">{helper}</div>
      <div className="mt-4">{action}</div>
    </div>
  );
};

export const StorageSettingsView: React.FC = () => {
  const { locale, pick } = useLocale();
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
  const [lastActionMessage, setLastActionMessage] = useState(() =>
    pick('还没有执行过存储操作。', 'No storage action has been executed yet.')
  );

  const supportsLocal = isFileSystemAccessSupported();
  const cleanupOptions = [
    { label: pick('7 天策略', '7-Day Policy'), days: 7 },
    { label: pick('30 天策略', '30-Day Policy'), days: 30 },
  ] as const;
  const mergeCandidates = state.canvases.filter((canvas) => canvas.id !== activeCanvas?.id);
  const usageProgress = Math.min(100, (usageMB / 1024) * 100);
  const retentionCleanupOptions = cleanupOptions;

  const formatMb = (value: number) => `${value.toFixed(2)} MB`;
  const formatSavedSpace = (savedBytes: number) => `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;

  const getModeLabel = (nextMode: StorageMode | null) => {
    if (nextMode === 'local') return pick('本地文件夹', 'Local Folder');
    if (nextMode === 'browser') return pick('浏览器缓存', 'Browser Cache');
    if (nextMode === 'opfs') return pick('设备私有存储', 'Private Device');
    return pick('未指定', 'Unassigned');
  };

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
    setLastActionMessage(pick('正在刷新当前存储状态...', 'Refreshing current storage status...'));
    try {
      const [storedMode, usageBytes, ids] = await Promise.all([
        getStorageMode(),
        getStorageUsage(),
        getAllImageIds(),
      ]);
      setMode(storedMode);
      setUsageMB(usageBytes / (1024 * 1024));
      setImageCount(ids.length);
      setLastActionMessage(
        pick(
          `状态已刷新，检测到 ${ids.length} 张图片，占用 ${formatMb(usageBytes / (1024 * 1024))}。`,
          `Status refreshed. ${ids.length} images detected and ${formatMb(usageBytes / (1024 * 1024))} in use.`
        )
      );
    } catch (error) {
      console.error('[StorageSettingsView] Refresh failed:', error);
      setLastActionMessage(pick('刷新失败，请稍后再试。', 'Refresh failed. Try again in a moment.'));
      notify.error(
        pick('刷新失败', 'Refresh failed'),
        pick('当前状态暂时无法读取，请稍后再试。', 'Current storage status is temporarily unavailable.')
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [locale]);

  const switchToLocal = async () => {
    if (!supportsLocal) {
      notify.error(
        pick('当前浏览器不支持', 'Unsupported browser'),
        pick('请使用较新的 Chrome 或 Edge，并开启本地文件访问能力。', 'Use a recent Chrome or Edge build with local folder access.')
      );
      return;
    }

    setSwitchingMode('local');
    setLastActionMessage(pick('正在切换到本地文件夹存储...', 'Switching persistence to a local folder...'));
    try {
      await connectLocalFolder();
      const handle = await getLocalFolderHandle();
      if (!handle) {
        notify.warning(
          pick('尚未完成授权', 'Permission required'),
          pick('请先选择并授权本地文件夹。', 'Choose and authorize a local folder first.')
        );
        setLastActionMessage(pick('本地文件夹授权未完成。', 'Local folder permission was not completed.'));
        return;
      }

      const ok = await setStorageMode('local');
      if (!ok) {
        notify.error(
          pick('切换失败', 'Switch failed'),
          pick('本地文件夹模式保存失败，请重试。', 'Failed to activate local-folder persistence.')
        );
        setLastActionMessage(pick('未能启用本地文件夹存储。', 'Failed to activate local-folder persistence.'));
        return;
      }

      notify.success(
        pick('切换成功', 'Switched'),
        pick('现在已经改为本地文件夹存储。', 'Local-folder persistence is now active.')
      );
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Failed to switch local mode:', error);
      notify.error(
        pick('切换失败', 'Switch failed'),
        pick('连接本地文件夹时出现异常，请稍后再试。', 'Failed while connecting the local folder.')
      );
      setLastActionMessage(pick('本地文件夹存储启用失败。', 'Local-folder activation failed.'));
    } finally {
      setSwitchingMode(null);
    }
  };

  const switchToBrowser = async () => {
    setSwitchingMode('browser');
    setLastActionMessage(pick('正在切换到浏览器缓存...', 'Switching persistence to browser cache...'));
    try {
      await disconnectLocalFolder();
      const ok = await setStorageMode('browser');
      if (!ok) {
        notify.error(
          pick('切换失败', 'Switch failed'),
          pick('浏览器缓存模式保存失败，请重试。', 'Failed to activate browser persistence.')
        );
        setLastActionMessage(pick('未能启用浏览器缓存模式。', 'Failed to activate browser persistence.'));
        return;
      }

      notify.success(
        pick('切换成功', 'Switched'),
        pick('现在已经改为浏览器缓存。', 'Browser-cache persistence is now active.')
      );
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Failed to switch browser mode:', error);
      notify.error(
        pick('切换失败', 'Switch failed'),
        pick('浏览器缓存切换失败，请稍后再试。', 'Browser-cache switching failed.')
      );
      setLastActionMessage(pick('浏览器缓存模式启用失败。', 'Browser-cache activation failed.'));
    } finally {
      setSwitchingMode(null);
    }
  };

  const handleCleanup = async () => {
    setCleanupType('compress');
    setLastActionMessage(pick('正在清理原始图片缓存...', 'Cleaning original image cache...'));
    try {
      const result = await cleanupOriginals();
      const summary = pick(
        `已移除 ${result.count} 份原始缓存，约释放 ${formatSavedSpace(result.savedBytes)}。`,
        `Removed ${result.count} cached originals and reclaimed about ${formatSavedSpace(result.savedBytes)}.`
      );
      notify.success(pick('清理完成', 'Cleanup complete'), summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Cleanup failed:', error);
      notify.error(
        pick('清理失败', 'Cleanup failed'),
        pick('请稍后重试。', 'Please try again later.')
      );
      setLastActionMessage(pick('原图缓存清理失败。', 'Original cache cleanup failed.'));
    } finally {
      setCleanupType(null);
    }
  };

  const handleRetentionCleanup = async (days: number) => {
    setCleanupType(days);
    setLastActionMessage(
      pick(
        `正在按 ${days} 天策略清理本地资源...`,
        `Applying the ${days}-day retention policy...`
      )
    );
    try {
      const [imageResult, originalResult, removedTasks, removedLogs] = await Promise.all([
        cleanupImagesOlderThan(days),
        cleanupOriginalsOlderThan(days),
        cleanupCompletedTasksOlderThan(days),
        Promise.resolve(cleanupLogsOlderThan(days)),
      ]);
      const totalCount = imageResult.count + originalResult.count + removedTasks + removedLogs;
      const totalSavedBytes = imageResult.savedBytes + originalResult.savedBytes;
      const summary =
        totalCount > 0
          ? pick(
              `已按 ${days} 天策略清理 ${totalCount} 项本地资源，释放约 ${formatSavedSpace(totalSavedBytes)}。`,
              `Removed ${totalCount} local resources using the ${days}-day policy and reclaimed about ${formatSavedSpace(totalSavedBytes)}.`
            )
          : pick(
              `没有发现超过 ${days} 天的本地资源。`,
              `No local resources older than ${days} days were found.`
            );

      notify.success(pick('按时清理完成', 'Timed cleanup complete'), summary);
      setLastActionMessage(summary);
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Retention cleanup failed:', error);
      notify.error(
        pick('清理失败', 'Cleanup failed'),
        pick('请稍后重试。', 'Please try again later.')
      );
      setLastActionMessage(
        pick(`${days} 天策略清理失败。`, `Timed cleanup for the ${days}-day policy failed.`)
      );
    } finally {
      setCleanupType(null);
    }
  };

  const handleMergeProject = async () => {
    if (!activeCanvas || !mergeSourceId) {
      notify.warning(
        pick('请选择项目', 'Choose a project'),
        pick('先选择一个要合并到当前项目的来源项目。', 'Choose a source project before merging.')
      );
      return;
    }

    const sourceCanvas = mergeCandidates.find((canvas) => canvas.id === mergeSourceId);
    if (!sourceCanvas) {
      notify.warning(
        pick('项目不存在', 'Project missing'),
        pick('来源项目列表已变化，请重新选择。', 'The source project list changed. Choose again.')
      );
      return;
    }

    setProjectAction('merge');
    setLastActionMessage(
      pick(
        `正在把“${sourceCanvas.name}”合并到“${activeCanvas.name}”...`,
        `Merging "${sourceCanvas.name}" into "${activeCanvas.name}"...`
      )
    );
    try {
      const result = mergeCanvasInto(sourceCanvas.id, activeCanvas.id, { deleteSource: true });
      const summary = pick(
        `已向“${activeCanvas.name}”合并 ${result.movedPrompts} 张提示卡和 ${result.movedImages} 张图片卡。`,
        `Merged ${result.movedPrompts} prompt cards and ${result.movedImages} image cards into "${activeCanvas.name}".`
      );
      notify.success(pick('合并完成', 'Merge complete'), summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] Merge failed:', error);
      notify.error(
        pick('合并失败', 'Merge failed'),
        pick('请稍后再试。', 'Please try again later.')
      );
      setLastActionMessage(pick('项目合并失败。', 'Project merge failed.'));
    } finally {
      setProjectAction(null);
    }
  };

  const handleCleanupProjectCards = async () => {
    if (!activeCanvas) {
      notify.warning(
        pick('没有活动项目', 'No active project'),
        pick('请先打开一个项目。', 'Open a project first.')
      );
      return;
    }

    setProjectAction('cleanup');
    setLastActionMessage(
      pick(
        `正在整理“${activeCanvas.name}”中的无效卡片...`,
        `Cleaning invalid cards in "${activeCanvas.name}"...`
      )
    );
    try {
      const result = cleanupInvalidCards(activeCanvas.id);
      const summary =
        result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0
          ? pick(`“${activeCanvas.name}”中没有发现无效卡片。`, `No invalid cards were found in "${activeCanvas.name}".`)
          : pick(
              `已移除 ${result.removedPrompts} 张提示卡、${result.removedImages} 张图片卡，以及 ${result.removedGroups} 个空分组。`,
              `Removed ${result.removedPrompts} prompt cards, ${result.removedImages} image cards, and ${result.removedGroups} empty groups from "${activeCanvas.name}".`
            );
      notify.success(pick('整理完成', 'Cleanup complete'), summary);
      setLastActionMessage(summary);
    } catch (error) {
      console.error('[StorageSettingsView] Project cleanup failed:', error);
      notify.error(
        pick('整理失败', 'Cleanup failed'),
        pick('请稍后再试。', 'Please try again later.')
      );
      setLastActionMessage(pick('项目整理失败。', 'Project cleanup failed.'));
    } finally {
      setProjectAction(null);
    }
  };

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">{pick('高级设置', 'Advanced Settings')}</div>
            <h2>{pick('存储管理', 'Storage')}</h2>
            <p>
              {pick(
                '把存储目标、缓存压力和项目维护整合到同一页，避免在不同面板之间来回切换。',
                'Storage targets, cache pressure, and project maintenance now live in the same console.'
              )}
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'amber'}>
              {getModeLabel(mode)}
            </SettingsBadge>
            <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refresh()}>
              {pick('刷新', 'Refresh')}
            </SettingsActionButton>
          </div>
        </div>

        <div className="settings-reference-grid-3">
          <StorageMetricCard
            label={pick('主存储目标', 'Primary Target')}
            value={getModeLabel(mode)}
            helper={
              mode === 'local'
                ? pick('资源会落到授权的本地文件夹中。', 'Assets are being persisted into a granted local folder.')
                : mode === 'browser'
                  ? pick('资源当前保留在浏览器缓存层中。', 'Assets remain inside the browser storage layer.')
                  : pick('请选择一个持久化目标，让缓存行为稳定下来。', 'Pick a persistent target to stabilise cache operations.')
            }
            badge={<SettingsBadge tone={mode ? 'emerald' : 'amber'}>{mode ? pick('已配置', 'Configured') : pick('待配置', 'Pending')}</SettingsBadge>}
          />
          <StorageMetricCard
            label={pick('缓存占用', 'Cache Footprint')}
            value={formatMb(usageMB)}
            helper={pick(`缓存层当前追踪 ${imageCount} 张图片。`, `${imageCount} images currently tracked in the cache layer.`)}
            badge={<SettingsBadge tone={usageMB >= 512 ? 'amber' : 'indigo'}>{usageMB >= 512 ? pick('注意占用', 'Watch usage') : pick('健康', 'Healthy')}</SettingsBadge>}
          />
          <StorageMetricCard
            label={pick('工作区项目', 'Workspace Projects')}
            value={activeCanvas?.name || pick('没有活动项目', 'No active project')}
            helper={pick(`当前工作区可管理 ${state.canvases.length} 个画布项目。`, `${state.canvases.length} canvases can be managed from this workspace.`)}
            badge={<SettingsBadge tone="neutral">{pick(`共 ${state.canvases.length} 个`, `${state.canvases.length} total`)}</SettingsBadge>}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('存储策略', 'Storage Strategy')}</div>
                <div className="settings-reference-card__title">{pick('持久化模式', 'Persistence Modes')}</div>
                <div className="settings-reference-card__meta">
                  {pick('每个按钮只负责一种真实动作，避免保存、刷新和切换语义混在一起。', 'Each action tile handles exactly one storage task so the result is easier to predict.')}
                </div>
              </div>
              <HardDrive size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 settings-reference-grid-2">
              <StorageModeTile
                title={pick('本地文件夹', 'Local Folder')}
                description={pick('适合长期归档、跨浏览器复用和较大的工作区。', 'Best for durable archiving, cross-browser reuse, and long-running workspaces.')}
                helper={
                  supportsLocal
                    ? isConnectedToLocal
                      ? pick('本地文件夹已经授权完成。', 'Browser permission is already granted for the local folder.')
                      : pick('浏览器支持本地文件夹，但还没有授权。', 'Browser supports local-folder permission but a folder still needs to be granted.')
                    : pick('当前浏览器不支持本地文件夹接口。', 'This browser does not expose the local folder API.')
                }
                active={mode === 'local'}
                action={
                  <SettingsActionButton
                    icon={FolderOpen}
                    tone="primary"
                    loading={switchingMode === 'local'}
                    onClick={() => void switchToLocal()}
                  >
                    {pick('使用本地文件夹', 'Use Local Folder')}
                  </SettingsActionButton>
                }
              />
              <StorageModeTile
                title={pick('浏览器缓存', 'Browser Cache')}
                description={pick('适合临时实验和轻量本地会话。', 'Fastest option for quick experiments and lightweight local sessions.')}
                helper={pick('不需要额外授权，但数据会保留在浏览器环境中。', 'No folder permission is required, but the data remains inside the browser environment.')}
                active={mode === 'browser'}
                action={
                  <SettingsActionButton
                    loading={switchingMode === 'browser'}
                    onClick={() => void switchToBrowser()}
                  >
                    {pick('使用浏览器缓存', 'Use Browser Cache')}
                  </SettingsActionButton>
                }
              />
            </div>

            <div className="mt-5 rounded-[22px] border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-overlay)] p-4">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--text-tertiary)]">
                {pick('最近动作', 'Last Action')}
              </div>
              <div className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">{lastActionMessage}</div>
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('容量快照', 'Capacity Snapshot')}</div>
                <div className="settings-reference-card__title">{pick('占用分布', 'Usage Distribution')}</div>
              </div>
              <Layers3 size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="settings-reference-kpi__value">{formatMb(usageMB)}</div>
            <div className="settings-reference-kpi__helper">
              {pick('按 1 GB 运行阈值可视化，用于快速判断容量压力。', 'Visualised against a 1 GB operating threshold for quick pressure checks.')}
            </div>

            <div className="mt-4">
              <ProgressBar
                progress={usageProgress}
                tone={usageMB >= 768 ? 'rose' : usageMB >= 512 ? 'amber' : 'indigo'}
                showLabel={false}
              />
            </div>

            <div className="settings-reference-segments">
              <span className={`settings-reference-segment ${mode === 'browser' ? 'is-active' : ''}`.trim()} />
              <span className={`settings-reference-segment ${mode === 'opfs' ? 'is-active' : ''}`.trim()} />
              <span className={`settings-reference-segment ${mode === 'local' ? 'is-active' : ''}`.trim()} />
            </div>

            <div className="mt-5 settings-reference-metric-grid">
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">{pick('本地授权', 'Local Permission')}</div>
                <div className="settings-reference-mini-metric__value">{supportsLocal ? pick('支持', 'Supported') : pick('不可用', 'Unavailable')}</div>
                <div className="settings-reference-mini-metric__helper">
                  {supportsLocal ? pick('浏览器可以申请本地文件夹权限。', 'The browser can request a local folder permission.') : pick('当前环境只能使用浏览器缓存。', 'Only browser cache is available in this environment.')}
                </div>
              </div>
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">{pick('图片记录', 'Image Records')}</div>
                <div className="settings-reference-mini-metric__value">{imageCount}</div>
                <div className="settings-reference-mini-metric__helper">
                  {pick('当前存储层中发现的图片 ID 总数。', 'Total image IDs discovered in the storage layer.')}
                </div>
              </div>
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">{pick('活动项目', 'Active Project')}</div>
                <div className="settings-reference-mini-metric__value">{activeCanvas?.name || pick('无', 'None')}</div>
                <div className="settings-reference-mini-metric__helper">
                  {pick('合并和整理动作都会作用在当前活动项目上。', 'Merge and cleanup actions always target the current active canvas.')}
                </div>
              </div>
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">{pick('项目数量', 'Project Count')}</div>
                <div className="settings-reference-mini-metric__value">{state.canvases.length}</div>
                <div className="settings-reference-mini-metric__helper">
                  {pick('当前工作区内可维护的画布总数。', 'Total canvases currently available for maintenance.')}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('缓存维护', 'Cache Maintenance')}</div>
                <div className="settings-reference-card__title">{pick('清理控制', 'Cleanup Controls')}</div>
                <div className="settings-reference-card__meta">
                  {pick(
                    '手机端只保留手动清原图和 7 天 / 30 天策略，避免误触过短档位。',
                    'Mobile keeps manual original cleanup plus 7-day and 30-day policies only.'
                  )}
                </div>
              </div>
              <Trash2 size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 space-y-4">
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">{pick('手动清原图', 'Manual Originals Cleanup')}</div>
                <div className="settings-reference-mini-metric__helper">
                  {pick(
                    '只在你手动执行时清理原图，结果图和项目数据会保留。',
                    'Originals are removed only when you run this manual cleanup. Result images and project data stay intact.'
                  )}
                </div>
                <div className="mt-4">
                  <SettingsActionButton
                    icon={Trash2}
                    tone="primary"
                    loading={cleanupType === 'compress'}
                    onClick={() => void handleCleanup()}
                  >
                    {pick('立即手动清原图', 'Clean Originals Manually')}
                  </SettingsActionButton>
                </div>
              </div>

              <div className="settings-reference-grid-3">
                {retentionCleanupOptions.map((option) => (
                  <div key={option.days} className="settings-reference-mini-metric">
                    <div className="settings-reference-mini-metric__label">{option.label}</div>
                    <div className="settings-reference-mini-metric__helper">
                      {pick(
                        `会同时按 ${option.days} 天策略清理缓存图、原图、任务记录和系统日志。`,
                        `Apply the ${option.days}-day policy to cached images, originals, task records, and system logs.`
                      )}
                    </div>
                    <div className="mt-4">
                      <SettingsActionButton
                        loading={cleanupType === option.days}
                        onClick={() => void handleRetentionCleanup(option.days)}
                      >
                        {pick(`应用 ${option.days} 天策略`, `Apply ${option.days}-Day Policy`)}
                      </SettingsActionButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">{pick('项目维护', 'Project Maintenance')}</div>
                <div className="settings-reference-card__title">{pick('工作区修复动作', 'Workspace Repair Actions')}</div>
                <div className="settings-reference-card__meta">
                  {pick('可以把旧项目合并到当前项目，或清理无效卡片，不需要离开存储页。', 'Merge retired canvases into the active project or clean invalid cards without leaving the storage page.')}
                </div>
              </div>
              <Activity size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 space-y-4">
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">{pick('合并来源', 'Merge Source')}</div>
                <div className="mt-3">
                  <SettingSelect
                    label={pick('选择要合并到当前项目的来源项目', 'Project to merge into the active canvas')}
                    value={mergeSourceId}
                    options={
                      mergeCandidates.length > 0
                        ? mergeCandidates.map((canvas) => ({ value: canvas.id, label: canvas.name }))
                        : [{ value: '', label: pick('没有其他可用项目', 'No other canvas available') }]
                    }
                    onChange={setMergeSourceId}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <SettingsActionButton
                    loading={projectAction === 'merge'}
                    tone="primary"
                    onClick={() => void handleMergeProject()}
                  >
                    {pick('合并到当前项目', 'Merge into Active Project')}
                  </SettingsActionButton>
                  <SettingsActionButton
                    loading={projectAction === 'cleanup'}
                    onClick={() => void handleCleanupProjectCards()}
                  >
                    {pick('移除无效卡片', 'Remove Invalid Cards')}
                  </SettingsActionButton>
                </div>
              </div>

              <div className="settings-reference-grid-2">
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">{pick('当前项目', 'Active Canvas')}</div>
                  <div className="settings-reference-mini-metric__value">{activeCanvas?.name || pick('未选择', 'None selected')}</div>
                  <div className="settings-reference-mini-metric__helper">
                    {pick('所有合并和整理动作都会以当前项目为目标。', 'Merge and cleanup actions always target the current active canvas.')}
                  </div>
                </div>
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">{pick('可合并项目', 'Merge Candidates')}</div>
                  <div className="settings-reference-mini-metric__value">{mergeCandidates.length}</div>
                  <div className="settings-reference-mini-metric__helper">
                    {pick('当前可以并入活动项目的其他画布数量。', 'Other canvases available to consolidate into the active workspace.')}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </SettingsViewShell>
  );
};

export default StorageSettingsView;
