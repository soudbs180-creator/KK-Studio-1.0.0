import React, { useEffect, useState } from 'react';
import {
  Activity,
  HardDrive,
  RefreshCw,
  Trash2,
} from 'lucide-react';
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
  SETTINGS_DANGER_STYLE,
  SETTINGS_ELEVATED_STYLE,
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_PANEL_STYLE,
  SETTINGS_SUCCESS_STYLE,
  SETTINGS_WARNING_STYLE,
  SettingsActionButton,
  SettingsBadge,
  SettingsDangerZone,
  SettingsHero,
  SettingsMetricCard,
  SettingsSection,
  SettingsViewShell,
} from '../SettingsScaffold';

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
    { label: '清理 1 天前缓存', days: 1 },
    { label: '清理 7 天前缓存', days: 7 },
    { label: '清理 30 天前缓存', days: 30 },
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
  const modeTone = mode === 'local' ? 'emerald' : mode === 'browser' ? 'sky' : 'neutral';
  const localStateTone = isConnectedToLocal ? 'emerald' : 'amber';

  return (
    <SettingsViewShell>
      <SettingsHero
        tone="sky"
        icon={HardDrive}
        eyebrow="STORAGE CONTROL"
        title="存储设置"
        description="统一管理图片保存位置、本地目录连接和缓存维护。"
        badge={<SettingsBadge tone={modeTone}>{modeLabel}</SettingsBadge>}
        actions={
          <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refresh()} disabled={isBusy}>
            {refreshing ? '正在刷新...' : '刷新状态'}
          </SettingsActionButton>
        }
        metrics={
          <>
            <SettingsMetricCard
              label="当前存储方式"
              value={modeLabel}
              helper={mode === 'local' ? '适合长期归档和项目交付。' : '适合快速试用和轻量工作流。'}
              icon={HardDrive}
              tone={modeTone}
            />
            <SettingsMetricCard
              label="本地连接状态"
              value={mode === 'local' ? (isConnectedToLocal ? '已连接' : '等待连接') : '未启用'}
              helper={supportsLocal ? 'Chrome / Edge 可直接选择本地目录。' : '当前浏览器暂不支持文件系统访问。'}
              icon={RefreshCw}
              tone={localStateTone}
            />
            <SettingsMetricCard
              label="已存图片数量"
              value={`${imageCount} 张`}
              helper="统计当前存储空间内可识别的图片记录。"
              icon={Activity}
              tone="indigo"
            />
            <SettingsMetricCard
              label="占用空间"
              value={`${usageMB.toFixed(2)} MB`}
              helper={usageMB > 512 ? '占用偏高，建议定期清理原图缓存。' : '容量处于可控范围。'}
              icon={Trash2}
              tone={usageMB > 512 ? 'amber' : 'neutral'}
            />
          </>
        }
      />

      <SettingsSection
        eyebrow="MODE SWITCH"
        title="存储策略"
        description="长期生产推荐本地文档夹，临时体验可保留浏览器存储。"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div
            className="rounded-2xl border p-5"
            style={mode === 'local' ? (isConnectedToLocal ? SETTINGS_SUCCESS_STYLE : SETTINGS_WARNING_STYLE) : SETTINGS_ELEVATED_STYLE}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  本地文档夹存储
                </div>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  生成结果直接写入你选定的本地目录，更适合长期留存、素材整理和跨浏览器访问。
                </p>
              </div>
              <SettingsBadge tone={mode === 'local' ? localStateTone : 'neutral'}>
                {mode === 'local' ? (isConnectedToLocal ? '当前启用' : '等待连接') : '可切换'}
              </SettingsBadge>
            </div>

            <div className="mt-4 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <div>适合归档原图、项目交付和本地备份。</div>
              <div>首次切换会请求目录授权，后续可持续使用同一目录。</div>
              <div>当前状态：{isConnectedToLocal ? '目录已连接，可直接写入。' : '目录未连接，切换时会重新请求授权。'}</div>
            </div>

            <div className="mt-5">
              <SettingsActionButton
                icon={HardDrive}
                tone={mode === 'local' ? 'secondary' : 'primary'}
                onClick={() => void switchToLocal()}
                disabled={isBusy || !supportsLocal || (mode === 'local' && isConnectedToLocal)}
              >
                {switchingMode === 'local' ? '正在切换...' : mode === 'local' ? '当前已启用本地模式' : '切换到本地文档夹'}
              </SettingsActionButton>
            </div>
          </div>

          <div
            className="rounded-2xl border p-5"
            style={mode === 'browser' ? SETTINGS_SUCCESS_STYLE : SETTINGS_ELEVATED_STYLE}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  浏览器存储
                </div>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  无需额外授权，适合演示、试跑和轻量操作，但数据会跟随当前浏览器环境。
                </p>
              </div>
              <SettingsBadge tone={mode === 'browser' ? 'sky' : 'neutral'}>
                {mode === 'browser' ? '当前启用' : '快速开始'}
              </SettingsBadge>
            </div>

            <div className="mt-4 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <div>零配置即可使用，适合临时任务和未授权目录的场景。</div>
              <div>清缓存、换设备或换浏览器后，历史图片可能无法保留。</div>
              <div>当前状态：{mode === 'browser' ? '正在使用浏览器本地空间。' : '可作为无需授权的备用方案。'}</div>
            </div>

            <div className="mt-5">
              <SettingsActionButton
                icon={RefreshCw}
                tone={mode === 'browser' ? 'secondary' : 'primary'}
                onClick={() => void switchToBrowser()}
                disabled={isBusy || mode === 'browser'}
              >
                {switchingMode === 'browser' ? '正在切换...' : mode === 'browser' ? '当前已启用浏览器存储' : '切换到浏览器存储'}
              </SettingsActionButton>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="MAINTENANCE"
        title="维护与清理"
        description="支持立即刷新、压缩原图缓存，以及按 1 / 7 / 30 天清理旧缓存。"
        action={<SettingsBadge tone={usageMB > 512 ? 'amber' : 'neutral'}>{usageMB > 512 ? '建议清理缓存' : '状态稳定'}</SettingsBadge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
          <div className="rounded-2xl border p-5" style={SETTINGS_ELEVATED_STYLE}>
            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                当前维护动作
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                刷新会同步模式、图片数量和空间占用；清理缓存则用于释放原图占用，适合在长期使用后定期执行。
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <SettingsActionButton icon={RefreshCw} loading={refreshing} onClick={() => void refresh()} disabled={isBusy}>
                {refreshing ? '正在读取...' : '重新读取统计'}
              </SettingsActionButton>
              <SettingsActionButton
                icon={Trash2}
                tone="danger"
                onClick={() => void handleCleanup()}
                disabled={isBusy}
                loading={cleanupType === 'compress'}
              >
                {cleanupType === 'compress' ? '正在清理...' : '压缩原图缓存'}
              </SettingsActionButton>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {cleanupOptions.map((option) => (
                <SettingsActionButton
                  key={option.days}
                  size="sm"
                  tone="secondary"
                  icon={Trash2}
                  onClick={() => void handleCleanupByAge(option.days)}
                  disabled={isBusy}
                  loading={cleanupType === option.days}
                >
                  {cleanupType === option.days ? `清理 ${option.days} 天前...` : option.label}
                </SettingsActionButton>
              ))}
            </div>

            <div
              className="mt-4 rounded-2xl border px-4 py-3 text-sm leading-6"
              style={refreshing || cleanupType !== null ? SETTINGS_WARNING_STYLE : SETTINGS_PANEL_STYLE}
            >
              {lastActionMessage}
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={supportsLocal ? SETTINGS_PANEL_STYLE : SETTINGS_WARNING_STYLE}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              使用建议
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <div>长期生产环境优先使用本地文档夹，避免浏览器数据清理后图片丢失。</div>
              <div>浏览器存储更适合临时调试、移动设备体验或尚未授权目录时使用。</div>
              <div>按时间清理会删除旧缓存图片，建议先合并需要保留的画布项目后再做清理。</div>
              <div>{supportsLocal ? '当前环境支持本地目录接入。' : '当前环境不支持本地目录接入，请使用 Chrome 或 Edge。'}</div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="PROJECT MAINTENANCE"
        title="画布项目整理"
        description="把多个项目合并到当前画布，并清理当前项目里的错误卡片和空分组。"
        action={<SettingsBadge tone={mergeCandidates.length > 0 ? 'sky' : 'neutral'}>{activeCanvas ? `当前项目：${activeCanvas.name}` : '暂无活动项目'}</SettingsBadge>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
          <div className="rounded-2xl border p-5" style={SETTINGS_ELEVATED_STYLE}>
            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                合并项目
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                选择一个旧项目，把它的卡片整体并入当前画布。合并后旧项目会自动删除，方便把内容集中到一个画布继续整理。
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select
                value={mergeSourceId}
                onChange={(event) => setMergeSourceId(event.target.value)}
                className={SETTINGS_INPUT_CLASSNAME}
                disabled={projectAction !== null || mergeCandidates.length === 0}
              >
                {mergeCandidates.length === 0 ? (
                  <option value="">没有可合并的其他项目</option>
                ) : (
                  mergeCandidates.map((canvas) => (
                    <option key={canvas.id} value={canvas.id}>
                      {canvas.name} · {canvas.promptNodes.length} 主卡 / {canvas.imageNodes.length} 子卡
                    </option>
                  ))
                )}
              </select>

              <SettingsActionButton
                icon={Activity}
                tone="primary"
                onClick={() => void handleMergeProject()}
                disabled={projectAction !== null || mergeCandidates.length === 0 || !mergeSourceId}
                loading={projectAction === 'merge'}
              >
                {projectAction === 'merge' ? '正在合并...' : '合并到当前画布'}
              </SettingsActionButton>
            </div>

            <div className="mt-5 border-t pt-5" style={{ borderColor: 'var(--settings-border-subtle)' }}>
              <div className="space-y-2">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  清理错误卡片
                </div>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  自动清掉失败卡、空卡、失效关联子卡，以及已经没有节点的空分组。
                </p>
              </div>

              <div className="mt-4">
                <SettingsActionButton
                  icon={Trash2}
                  tone="danger"
                  onClick={() => void handleCleanupProjectCards()}
                  disabled={projectAction !== null || !activeCanvas}
                  loading={projectAction === 'cleanup'}
                >
                  {projectAction === 'cleanup' ? '正在清理...' : '清理当前项目错误卡片'}
                </SettingsActionButton>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-5" style={SETTINGS_PANEL_STYLE}>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              当前整理建议
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <div>当前共有 {state.canvases.length} 个项目，建议把已完成或零散项目合并到一个主画布中。</div>
              <div>{mergeCandidates.length > 0 ? `还有 ${mergeCandidates.length} 个项目可合并。` : '当前没有其他项目可合并。'}</div>
              <div>{activeCanvas ? `你正在整理"${activeCanvas.name}"。` : '当前还没有活动项目。'}</div>
              <div>先合并项目，再按时间清理旧缓存，能更稳妥地避免误删还要继续用的素材。</div>
            </div>
          </div>
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default StorageSettingsView;
