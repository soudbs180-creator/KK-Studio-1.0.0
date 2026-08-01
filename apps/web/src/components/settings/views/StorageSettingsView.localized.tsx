import React, { useEffect, useMemo, useState } from 'react';
import { Cloud, Database, FolderOpen, HardDrive, Images, Layers3, RefreshCw, Trash2, WandSparkles } from 'lucide-react';
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
import {
  SETTINGS_RESPONSIVE_GRID_CLASSNAME,
  SettingsActionButton,
  SettingsBadge,
  SettingsDangerZone,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsSystemCard,
  SettingsSystemField,
  SettingsViewShell,
} from '../SettingsScaffold';
import { ProgressBar, SettingSelect } from '../ui/index';
import { STORAGE_SETTINGS_ACTIONS } from '../settingsModuleActions';

export const StorageSettingsView: React.FC = () => {
  const { locale, pick } = useLocale();
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
  const [lastActionMessage, setLastActionMessage] = useState(() =>
    pick('还没有存储动作。', 'No storage action yet.')
  );

  const supportsLocal = isFileSystemAccessSupported();
  const mergeCandidates = useMemo(
    () => state.canvases.filter((canvas) => canvas.id !== activeCanvas?.id),
    [activeCanvas?.id, state.canvases],
  );
  const usageProgress = Math.min(100, (usageMB / 1024) * 100);

  const formatMb = (value: number) => `${value.toFixed(2)} MB`;
  const formatSavedSpace = (savedBytes: number) => `${(savedBytes / (1024 * 1024)).toFixed(2)} MB`;

  const getModeLabel = (nextMode: StorageMode | null) => {
    if (nextMode === 'local') return pick('本地文件夹', 'Local Folder');
    if (nextMode === 'browser') return pick('浏览器缓存', 'Browser Cache');
    if (nextMode === 'opfs') return pick('设备私有存储', 'Private Device');
    return pick('未指定', 'Unassigned');
  };

  const getLocalFolderStatusLabel = () => {
    if (!supportsLocal) {
      return pick('当前浏览器不支持本地存储', 'Not supported by current browser');
    }
    if (mode === 'local') {
      return isConnectedToLocal
        ? pick('状态：已启用并授权连接', 'Status: Active & Connected')
        : pick('⚠️ 状态：已启用但连接断开，请点更换或重新授权', '⚠️ Status: Active but Disconnected, click Change to reauthorize');
    }
    return isConnectedToLocal
      ? pick('状态：本地已授权就绪（当前使用浏览器缓存）', 'Status: Authorized but Inactive')
      : pick('状态：可用但未授权（未连接）', 'Status: Supported but Disconnected');
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
      }      await refresh();
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
      }      await refresh();
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
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          pick(
            '确认清理原图缓存吗？结果图和项目数据会保留。',
            'Clean cached originals now? Result images and project data will stay.',
          ),
        );
    if (!confirmed) return;

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
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          pick(
            `确认应用 ${days} 天保留策略吗？这会清理缓存图、原图、任务记录和系统日志。`,
            `Apply the ${days}-day retention policy? This clears cached images, originals, task records, and system logs.`,
          ),
        );
    if (!confirmed) return;

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

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          pick(
            `确认把“${sourceCanvas.name}”合并到“${activeCanvas.name}”吗？合并后原项目会被删除。`,
            `Merge "${sourceCanvas.name}" into "${activeCanvas.name}"? The source project will be removed.`,
          ),
        );
    if (!confirmed) return;

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

  // 无效卡片清理只移除可恢复的错误节点和空分组，因此无需和永久删除使用同一套危险确认。
  const handleCleanupProjectCards = async () => {
    if (!activeCanvas) {
      notify.warning(
        pick('没有活动项目', 'No active project'),
        pick('请先打开一个项目。', 'Open a project first.')
      );
      return;
    }

    setProjectAction('cleanup');
    try {
      const result = cleanupInvalidCards(activeCanvas.id);
      const summary =
        result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0
          ? pick(`“${activeCanvas.name}”中没有发现错误卡片。`, `No invalid cards were found in "${activeCanvas.name}".`)
          : pick(
              `已移除 ${result.removedPrompts} 张提示卡、${result.removedImages} 张图片卡，以及 ${result.removedGroups} 个空分组。`,
              `Removed ${result.removedPrompts} prompt cards, ${result.removedImages} image cards, and ${result.removedGroups} empty groups from "${activeCanvas.name}".`
            );
      notify.success(pick('清理完成', 'Cleanup complete'), summary);
      setLastActionMessage(summary);
      void refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Project cleanup failed:', error);
      notify.error(
        pick('清理失败', 'Cleanup failed'),
        pick('请稍后再试。', 'Please try again later.')
      );
      setLastActionMessage(pick('项目整理失败。', 'Project cleanup failed.'));
    } finally {
      setProjectAction(null);
    }
  };

  // 简体中文：为高危的“彻底清除全部卡片与项目数据”操作提供处理器，强制弹出警示窗口，保证数据安全性
  const handleClearAllData = async () => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
          pick(
            '⚠️ 警告：您确定要彻底清空所有的项目、卡片及图片缓存吗？此操作将重置整个工作台，所有本地 IndexedDB 缓存将被永久抹除，且无法撤销！',
            '⚠️ WARNING: Are you sure you want to permanently clear all projects, cards, and image caches? This will reset the workspace. All local IndexedDB caches will be wiped out and cannot be undone!'
          )
        );
    if (!confirmed) return;

    setCleanupType('compress'); // 复用 loading 状态
    try {
      clearAllData();
      notify.success(
        pick('抹除全部成功', 'All Data Cleared'),
        pick('工作区已完全重置。', 'Workspace has been fully reset.')
      );
      setLastActionMessage(pick('已抹除全部项目与缓存数据并重置。', 'All projects and caches have been cleared and reset.'));
      await refresh();
    } catch (error) {
      console.error('[StorageSettingsView] Clear all failed:', error);
      notify.error(
        pick('清空失败', 'Clear failed'),
        pick('请重试或稍后再试。', 'Please try again later.')
      );
    } finally {
      setCleanupType(null);
    }
  };

  const modeBadgeTone = mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'neutral';
  const modeLabel = mode === null && refreshing
    ? pick('正在检测', 'Detecting')
    : getModeLabel(mode);

  return (
    <SettingsViewShell className="settings-storage-view">
      <SettingsHero
        eyebrow={pick('存储与工作区', 'Storage & Workspaces')}
        title={pick('存储与同步', 'Storage & Sync')}
        description={pick(
          '集中管理同步策略、存储位置、容量和工作区维护动作。',
          'Manage sync policy, storage location, capacity, and workspace maintenance in one place.',
        )}
        icon={HardDrive}
        tone={mode === 'local' ? 'emerald' : 'indigo'}
        badge={<SettingsBadge tone={modeBadgeTone}>{modeLabel}</SettingsBadge>}
      />

      <SettingsSection
        title={pick('状态概览', 'Status overview')}
        description={pick('快速确认当前工作区、缓存和设备能力。', 'Review workspace, cache, and device readiness at a glance.')}
        surface="plain"
      >
        <div className="grid grid-cols-2 gap-[var(--kk-space-3)] xl:grid-cols-4">
          <SettingsMetricCard
            label={pick('本地授权', 'Local permission')}
            value={supportsLocal ? pick('已支持', 'Supported') : pick('不可用', 'Unavailable')}
            helper={pick('文件夹读写能力', 'Folder read/write capability')}
            icon={HardDrive}
            tone={supportsLocal ? 'emerald' : 'amber'}
          />
          <SettingsMetricCard
            label={pick('活动项目', 'Active project')}
            value={activeCanvas?.name || pick('未选择', 'None')}
            helper={pick('当前编辑工作区', 'Current editing workspace')}
            icon={FolderOpen}
            tone="indigo"
          />
          <SettingsMetricCard
            label={pick('缓存占用', 'Cache usage')}
            value={formatMb(usageMB)}
            helper={pick(`${imageCount} 张图片`, `${imageCount} images`)}
            icon={Images}
            tone={usageMB >= 768 ? 'rose' : usageMB >= 512 ? 'amber' : 'sky'}
          />
          <SettingsMetricCard
            label={pick('项目总数', 'Projects')}
            value={pick(`${state.canvases.length} 个`, `${state.canvases.length}`)}
            helper={pick('当前工作区项目', 'Projects in this workspace')}
            icon={Layers3}
            tone="neutral"
          />
        </div>
      </SettingsSection>

      <SettingsSystemCard
        className="settings-system-card--wide"
        title={pick('同步与存储位置', 'Sync and storage location')}
        description={pick(
          '手机端优先同步云端；桌面端可在浏览器缓存与授权文件夹之间切换。',
          'Mobile prioritizes cloud sync; desktop can switch between browser cache and an authorized folder.',
        )}
        icon={Cloud}
        tone="indigo"
      >
        <SettingsSystemField
          label={pick('多端同步', 'Cross-device sync')}
          description={pick(
            '手机端只保留加速缓存，工作区资源以云端副本为主。',
            'Mobile keeps only an acceleration cache while cloud copies remain authoritative.',
          )}
          value={<SettingsBadge tone="indigo">{pick('云端优先', 'Cloud-first')}</SettingsBadge>}
        >
          <SettingsBadge tone="neutral">{pick('自动策略', 'Automatic')}</SettingsBadge>
        </SettingsSystemField>

        <SettingsSystemField
          label={pick('本地文件夹', 'Local folder')}
          description={getLocalFolderStatusLabel()}
          value={mode === 'local' ? <SettingsBadge tone="emerald">{pick('当前使用', 'Current')}</SettingsBadge> : undefined}
        >
          <div className="flex flex-wrap justify-end gap-2">
            {supportsLocal ? (
              <SettingsActionButton size="sm" onClick={() => void changeLocalFolder()}>
                {pick('更换文件夹', 'Change folder')}
              </SettingsActionButton>
            ) : null}
            <SettingsActionButton
              size="sm"
              tone={mode === 'local' ? 'secondary' : 'primary'}
              disabled={!supportsLocal || mode === 'local'}
              loading={switchingMode === 'local'}
              aria-pressed={mode === 'local'}
              onClick={() => void switchToLocal()}
              data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.switchToLocalMode.uiAction}
            >
              {mode === 'local' ? pick('已启用', 'Enabled') : pick('切换使用', 'Use folder')}
            </SettingsActionButton>
          </div>
        </SettingsSystemField>

        <SettingsSystemField
          label={pick('浏览器缓存', 'Browser cache')}
          description={pick('无需授权，适合快速体验和临时项目。', 'No permission required; best for temporary work.')}
          value={mode === 'browser' ? <SettingsBadge tone="indigo">{pick('当前使用', 'Current')}</SettingsBadge> : undefined}
        >
          <SettingsActionButton
            size="sm"
            tone={mode === 'browser' ? 'secondary' : 'primary'}
            disabled={mode === 'browser'}
            loading={switchingMode === 'browser'}
            aria-pressed={mode === 'browser'}
            onClick={() => void switchToBrowser()}
            data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.switchToBrowserMode.uiAction}
          >
            {mode === 'browser' ? pick('已启用', 'Enabled') : pick('切换使用', 'Use cache')}
          </SettingsActionButton>
        </SettingsSystemField>

        <SettingsSystemField
          label={pick('最近动作', 'Last action')}
          description={pick('这里会显示刷新、切换和清理结果。', 'Refresh, switch, and cleanup results appear here.')}
        >
          <div className="flex max-w-full flex-col items-start gap-2">
            <span
              className="max-w-full break-words text-left text-[length:var(--type-caption)] text-[var(--text-secondary)]"
              aria-live="polite"
            >
              {lastActionMessage}
            </span>
            <SettingsActionButton
              icon={RefreshCw}
              size="sm"
              loading={refreshing}
              onClick={() => void refresh()}
              data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.refreshUsage.uiAction}
            >
              {pick('刷新存储', 'Refresh storage')}
            </SettingsActionButton>
          </div>
        </SettingsSystemField>
      </SettingsSystemCard>

      <SettingsSection
        title={pick('维护与整理', 'Maintenance and organization')}
        description={pick('普通清理不会删除项目；永久抹除单独放在危险区域。', 'Routine cleanup preserves projects; permanent deletion stays isolated below.')}
        surface="plain"
      >
        <div className="flex flex-col gap-[var(--kk-space-4)]">
          <div className={SETTINGS_RESPONSIVE_GRID_CLASSNAME}>
            <SettingsSystemCard
              title={pick('容量与保留', 'Capacity and retention')}
              description={pick('控制缓存空间和历史数据保留周期。', 'Control cache usage and data retention windows.')}
              icon={Database}
              tone="sky"
            >
              <SettingsSystemField
                label={pick('容量快照', 'Capacity snapshot')}
                description={pick('达到上限时会按保留策略自动淘汰缓存。', 'Cache is evicted by retention policy near the limit.')}
                value={pick(`${imageCount} 张图片`, `${imageCount} images`)}
              >
                <div className="w-full min-w-40">
                  <ProgressBar
                    progress={usageProgress}
                    tone={usageMB >= 768 ? 'rose' : usageMB >= 512 ? 'amber' : 'indigo'}
                    showLabel={false}
                  />
                </div>
              </SettingsSystemField>

              <SettingsSystemField
                label={pick('原图缓存', 'Original cache')}
                description={pick('只移除原图缓存，结果图和项目数据会保留。', 'Removes original cache while preserving results and projects.')}
              >
                <SettingsActionButton
                  size="sm"
                  loading={cleanupType === 'compress'}
                  onClick={() => void handleCleanup()}
                  data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.cleanOriginalCache.uiAction}
                >
                  {pick('清理原图', 'Clean originals')}
                </SettingsActionButton>
              </SettingsSystemField>

              <SettingsSystemField
                label={pick('30 天保留', '30-day retention')}
                description={pick('清理超过 30 天的缓存、任务和日志。', 'Remove cache, tasks, and logs older than 30 days.')}
              >
                <SettingsActionButton
                  size="sm"
                  loading={cleanupType === 30}
                  onClick={() => void handleRetentionCleanup(30)}
                  data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.applyRetention30Days.uiAction}
                >
                  {pick('应用策略', 'Apply')}
                </SettingsActionButton>
              </SettingsSystemField>

              <SettingsSystemField
                label={pick('7 天保留', '7-day retention')}
                description={pick('更积极地释放本地缓存空间。', 'Aggressively reclaim local cache space.')}
              >
                <SettingsActionButton
                  size="sm"
                  loading={cleanupType === 7}
                  onClick={() => void handleRetentionCleanup(7)}
                  data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.applyRetention7Days.uiAction}
                >
                  {pick('应用策略', 'Apply')}
                </SettingsActionButton>
              </SettingsSystemField>
            </SettingsSystemCard>

            <SettingsSystemCard
              title={pick('工作区整理', 'Workspace organization')}
              description={pick('合并项目，或移除当前项目中的错误卡片和空分组。', 'Merge projects or remove broken cards and empty groups.')}
              icon={WandSparkles}
              tone="emerald"
            >
              <SettingsSystemField
                label={pick('来源项目', 'Source project')}
                description={pick('选择要合并到当前项目的来源。', 'Choose a project to merge into the current one.')}
              >
                <SettingSelect
                  label=""
                  value={mergeSourceId}
                  options={
                    mergeCandidates.length > 0
                      ? mergeCandidates.map((canvas) => ({ value: canvas.id, label: canvas.name }))
                      : [{ value: '', label: pick('没有其他可用项目', 'No other project') }]
                  }
                  onChange={setMergeSourceId}
                  controlAction={STORAGE_SETTINGS_ACTIONS.selectMergeSource.uiAction}
                />
              </SettingsSystemField>

              <SettingsSystemField
                label={pick('项目合并', 'Merge projects')}
                description={pick('合并后来源项目会被删除，执行前会再次确认。', 'The source project is removed after confirmation.')}
              >
                <SettingsActionButton
                  size="sm"
                  tone="primary"
                  loading={projectAction === 'merge'}
                  disabled={!activeCanvas || mergeCandidates.length === 0 || !mergeSourceId}
                  onClick={() => void handleMergeProject()}
                  data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.mergeProject.uiAction}
                >
                  {pick('合并到当前项目', 'Merge into current')}
                </SettingsActionButton>
              </SettingsSystemField>

              <SettingsSystemField
                label={pick('卡片整理', 'Card cleanup')}
                description={pick('移除错误卡片、失效图片和空分组，不删除正常内容。', 'Remove broken cards, invalid images, and empty groups only.')}
              >
                <SettingsActionButton
                  size="sm"
                  loading={projectAction === 'cleanup'}
                  disabled={!activeCanvas}
                  onClick={() => void handleCleanupProjectCards()}
                  data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.cleanBrokenCards.uiAction}
                >
                  {pick('整理当前项目', 'Clean current project')}
                </SettingsActionButton>
              </SettingsSystemField>
            </SettingsSystemCard>
          </div>

          <SettingsDangerZone
            title={pick('永久抹除全部工作区数据', 'Permanently erase all workspace data')}
            description={pick(
              '会删除所有项目、卡片和图片缓存，且无法撤销。',
              'Deletes every project, card, and image cache and cannot be undone.',
            )}
            action={(
              <SettingsActionButton
                icon={Trash2}
                size="sm"
                tone="danger"
                loading={cleanupType === 'compress'}
                onClick={() => void handleClearAllData()}
                data-storage-settings-action={STORAGE_SETTINGS_ACTIONS.clearAllData.uiAction}
              >
                {pick('清空全部数据', 'Erase all data')}
              </SettingsActionButton>
            )}
          />
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default StorageSettingsView;
