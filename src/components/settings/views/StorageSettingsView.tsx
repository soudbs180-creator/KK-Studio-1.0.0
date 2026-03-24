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
import { SettingsActionButton, SettingsBadge, SettingsViewShell } from '../SettingsScaffold';
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

  return (
    <SettingsViewShell>
      <div className="settings-reference-stack">
        <div className="settings-reference-page-header">
          <div className="settings-reference-page-header__lead">
            <div className="settings-reference-page-header__eyebrow">Advanced Settings</div>
            <h2>Storage Management</h2>
            <p>
              A darker, flatter storage console that follows the reference system pages. Storage targets,
              cache pressure, and project maintenance now live in the same visual language as the dashboard
              and provider cards.
            </p>
          </div>
          <div className="settings-reference-actions">
            <SettingsBadge tone={mode === 'local' ? 'emerald' : mode === 'browser' ? 'indigo' : 'amber'}>
              {getModeLabel(mode)}
            </SettingsBadge>
            <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refresh()}>
              Refresh
            </SettingsActionButton>
          </div>
        </div>

        <div className="settings-reference-grid-3">
          <StorageMetricCard
            label="Primary Target"
            value={getModeLabel(mode)}
            helper={
              mode === 'local'
                ? 'Assets are being persisted into a granted local folder.'
                : mode === 'browser'
                  ? 'Assets remain inside the browser storage layer.'
                  : 'Pick a persistent target to stabilise cache operations.'
            }
            badge={<SettingsBadge tone={mode ? 'emerald' : 'amber'}>{mode ? 'Configured' : 'Pending'}</SettingsBadge>}
          />
          <StorageMetricCard
            label="Cache Footprint"
            value={`${usageMB.toFixed(2)} MB`}
            helper={`${imageCount} images currently tracked in the cache layer.`}
            badge={<SettingsBadge tone={usageMB >= 512 ? 'amber' : 'indigo'}>{usageMB >= 512 ? 'Watch usage' : 'Healthy'}</SettingsBadge>}
          />
          <StorageMetricCard
            label="Workspace Projects"
            value={activeCanvas?.name || 'No active project'}
            helper={`${state.canvases.length} canvases can be managed from this workspace.`}
            badge={<SettingsBadge tone="neutral">{state.canvases.length} total</SettingsBadge>}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Storage Strategy</div>
                <div className="settings-reference-card__title">Persistence Modes</div>
                <div className="settings-reference-card__meta">
                  Switch modes directly from dedicated action tiles. Each action now does exactly one
                  storage task so it is easier to understand what will change.
                </div>
              </div>
              <HardDrive size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 settings-reference-grid-2">
              <StorageModeTile
                title="Local Folder"
                description="Best for durable archiving, cross-browser reuse, and long-running workspaces."
                helper={
                  supportsLocal
                    ? isConnectedToLocal
                      ? 'Browser permission is already granted for the local folder.'
                      : 'Browser supports local-folder permission but a folder still needs to be granted.'
                    : 'This browser does not expose the local folder API.'
                }
                active={mode === 'local'}
                action={
                  <SettingsActionButton
                    icon={FolderOpen}
                    tone="primary"
                    loading={switchingMode === 'local'}
                    onClick={() => void switchToLocal()}
                  >
                    Use Local Folder
                  </SettingsActionButton>
                }
              />
              <StorageModeTile
                title="Browser Cache"
                description="Fastest option for quick experiments and lightweight local sessions."
                helper="No folder permission is required, but the data remains inside the browser environment."
                active={mode === 'browser'}
                action={
                  <SettingsActionButton
                    loading={switchingMode === 'browser'}
                    onClick={() => void switchToBrowser()}
                  >
                    Use Browser Cache
                  </SettingsActionButton>
                }
              />
            </div>

            <div className="mt-5 rounded-[22px] border border-[var(--settings-border-subtle)] bg-[var(--settings-surface-overlay)] p-4">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--text-tertiary)]">
                Last Action
              </div>
              <div className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">{lastActionMessage}</div>
            </div>
          </section>

          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Capacity Snapshot</div>
                <div className="settings-reference-card__title">Usage Distribution</div>
              </div>
              <Layers3 size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="settings-reference-kpi__value">{usageMB.toFixed(2)} MB</div>
            <div className="settings-reference-kpi__helper">
              Visualised against a 1 GB operating threshold for quick pressure checks.
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
                <div className="settings-reference-mini-metric__label">Local Permission</div>
                <div className="settings-reference-mini-metric__value">{supportsLocal ? 'Supported' : 'Unavailable'}</div>
                <div className="settings-reference-mini-metric__helper">
                  {supportsLocal ? 'The browser can request a local folder permission.' : 'Only browser cache is available in this environment.'}
                </div>
              </div>
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">Image Records</div>
                <div className="settings-reference-mini-metric__value">{imageCount}</div>
                <div className="settings-reference-mini-metric__helper">
                  Total image IDs discovered in the storage layer.
                </div>
              </div>
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">Active Project</div>
                <div className="settings-reference-mini-metric__value">{activeCanvas?.name || 'None'}</div>
                <div className="settings-reference-mini-metric__helper">
                  Current workspace receiving merge and cleanup actions.
                </div>
              </div>
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">Project Count</div>
                <div className="settings-reference-mini-metric__value">{state.canvases.length}</div>
                <div className="settings-reference-mini-metric__helper">
                  Total canvases currently available for maintenance.
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
          <section className="settings-reference-card">
            <div className="settings-reference-card__header">
              <div>
                <div className="settings-reference-card__eyebrow">Cache Maintenance</div>
                <div className="settings-reference-card__title">Cleanup Controls</div>
                <div className="settings-reference-card__meta">
                  Cache cleanup no longer looks like a form. Each control is now a dedicated maintenance
                  action consistent with the reference control panels.
                </div>
              </div>
              <Trash2 size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 space-y-4">
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">Original Cache</div>
                <div className="settings-reference-mini-metric__helper">
                  Remove original image artifacts while keeping result images and project metadata intact.
                </div>
                <div className="mt-4">
                  <SettingsActionButton
                    icon={Trash2}
                    tone="primary"
                    loading={cleanupType === 'compress'}
                    onClick={() => void handleCleanup()}
                  >
                    Clean Original Cache
                  </SettingsActionButton>
                </div>
              </div>

              <div className="settings-reference-grid-3">
                {cleanupOptions.map((option) => (
                  <div key={option.days} className="settings-reference-mini-metric">
                    <div className="settings-reference-mini-metric__label">{option.label}</div>
                    <div className="settings-reference-mini-metric__helper">
                      Remove aged image cache while preserving newer workspace assets.
                    </div>
                    <div className="mt-4">
                      <SettingsActionButton
                        loading={cleanupType === option.days}
                        onClick={() => void handleCleanupByAge(option.days)}
                      >
                        Run Cleanup
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
                <div className="settings-reference-card__eyebrow">Project Maintenance</div>
                <div className="settings-reference-card__title">Workspace Repair Actions</div>
                <div className="settings-reference-card__meta">
                  Merge retired canvases into the active project or clean invalid cards without leaving the
                  storage page.
                </div>
              </div>
              <Activity size={18} className="text-[var(--text-primary)]" />
            </div>

            <div className="mt-5 space-y-4">
              <div className="settings-reference-mini-metric">
                <div className="settings-reference-mini-metric__label">Merge Source</div>
                <div className="mt-3">
                  <SettingSelect
                    label="Project to merge into the active canvas"
                    value={mergeSourceId}
                    options={
                      mergeCandidates.length > 0
                        ? mergeCandidates.map((canvas) => ({ value: canvas.id, label: canvas.name }))
                        : [{ value: '', label: 'No other canvas available' }]
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
                    Merge into Active Project
                  </SettingsActionButton>
                  <SettingsActionButton
                    loading={projectAction === 'cleanup'}
                    onClick={() => void handleCleanupProjectCards()}
                  >
                    Remove Invalid Cards
                  </SettingsActionButton>
                </div>
              </div>

              <div className="settings-reference-grid-2">
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">Active Canvas</div>
                  <div className="settings-reference-mini-metric__value">{activeCanvas?.name || 'None selected'}</div>
                  <div className="settings-reference-mini-metric__helper">
                    Merge and cleanup actions always target the current active canvas.
                  </div>
                </div>
                <div className="settings-reference-mini-metric">
                  <div className="settings-reference-mini-metric__label">Merge Candidates</div>
                  <div className="settings-reference-mini-metric__value">{mergeCandidates.length}</div>
                  <div className="settings-reference-mini-metric__helper">
                    Other canvases available to consolidate into the active workspace.
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
