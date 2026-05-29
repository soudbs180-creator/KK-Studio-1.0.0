import React, { useMemo, useState } from 'react';
import { Check, Clock3, FolderOpen, MessageSquare, Plus, Search, Settings, Sun, Moon, Languages } from 'lucide-react';

import { useCanvas } from '../../context/CanvasContext';
import { useTheme } from '../../context/ThemeContext';
import { useLocale } from '../../context/LocaleContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import type {
  MobileResultEntry,
  MobileSurfaceScreen,
  RedrawRequest,
  ResponsiveSurface,
  ResultViewMode,
} from '../../types';
import MobileAppShell from './MobileAppShell';
import MobileHeader from './MobileHeader';
import MobileResultDetailScreen from './MobileResultDetailScreen';
import MobileResultFeed from './MobileResultFeed';

export interface MobileWorkspaceSurfaceProps {
  activeScreen: MobileSurfaceScreen;
  surface: ResponsiveSurface;
  onScreenChange: (screen: MobileSurfaceScreen) => void;
  onOpenSettings: () => void;
  title?: string;
  userName?: string;
  userAvatarUrl?: string;
  balance?: number;
  balanceLoading?: boolean;
  projectName: string;
  projectCount: number;
  onOpenProjects: () => void;
  onOpenSearch: () => void;
  onOpenHistory: () => void;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onBillingClick?: () => void;
  onRechargeClick?: () => void;
  resultEntries: MobileResultEntry[];
  activeEntryId?: string | null;
  activeSourceImage?: string | null;
  onEntryOpen: (entryId: string) => void;
  onPreviewImage: (imageId: string) => void;
  onUseResultAsSource: (imageId: string) => void;
  onPartialRedraw: (entry: MobileResultEntry, request: RedrawRequest) => void;
  onDownloadEntry: (entry: MobileResultEntry) => void;
  onDeleteImage: (imageId: string) => void;
  onEditEcommerceTask: (entry: MobileResultEntry) => void;
  onConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  onGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
  onToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  composer: React.ReactNode;
  overlays?: React.ReactNode;
  isLoading?: boolean;
  workspaceSurface?: 'workspace' | 'library';
  onCloseHistory?: () => void;
}

// 磨砂玻璃风格按钮样式定义，带背景和边框的半透明组合
const moreSheetActionClass =
  'rounded-[22px] border border-white/8 bg-white/5 p-3.5 text-left text-[var(--text-primary)] transition-all active:scale-[0.985] active:bg-white/10';

const MobileWorkspaceSurface: React.FC<MobileWorkspaceSurfaceProps> = ({
  activeScreen,
  surface,
  onScreenChange,
  onOpenSettings: openSettings,
  title = 'KK Studio',
  userName,
  userAvatarUrl,
  balance,
  balanceLoading = false,
  projectName,
  projectCount,
  onOpenSearch,
  onOpenHistory,
  onOpenChat,
  onOpenProfile,
  onBillingClick,
  onRechargeClick,
  resultEntries,
  activeEntryId,
  activeSourceImage,
  onEntryOpen,
  onPreviewImage,
  onUseResultAsSource,
  onPartialRedraw,
  onDownloadEntry,
  onDeleteImage,
  onEditEcommerceTask,
  onConfirmEcommerceDesktop,
  onGenerateEcommerceMobile,
  onToggleEcommerceSelected,
  composer,
  overlays,
  isLoading = false,
  workspaceSurface = 'workspace',
  onCloseHistory,
}) => {
  const { state, activeCanvas, switchCanvas, createCanvas, canCreateCanvas } = useCanvas();
  const { toggleTheme, isDarkMode } = useTheme();
  const { toggleLanguage, isChinese } = useLocale();
  // 🚀 [移动端专属] 提取真实的用户角色，以在头部用户名右侧进行徽章渲染
  const { accountRole } = useAdminRole();
  const [showProjectList, setShowProjectList] = useState(false);
  const [resultViewMode, setResultViewMode] = useState<ResultViewMode>('standard');
  const activeEntryIndex = useMemo(
    () => resultEntries.findIndex((entry) => entry.id === activeEntryId),
    [activeEntryId, resultEntries],
  );
  const activeEntry = activeEntryIndex >= 0 ? resultEntries[activeEntryIndex] : null;
  const showDetail = activeScreen === 'detail' && Boolean(activeEntry);
  const showMoreSheet = activeScreen === 'more-sheet';
  const resolvedProjectName = activeCanvas?.name || projectName;
  const resolvedProjectCount = state.canvases.length || projectCount;

  const closeMoreSheet = () => {
    setShowProjectList(false);
    onScreenChange('home');
  };

  const runFromMoreSheet = (action: () => void) => {
    closeMoreSheet();
    action();
  };

  const onOpenSettings = () => {
    closeMoreSheet();
    openSettings();
  };

  const header = (
    <div className="px-3 pb-3 pt-2">
      <MobileHeader
        onMenuClick={() => onScreenChange(showMoreSheet ? 'home' : 'more-sheet')}
        onUserClick={onOpenProfile}
        onBillingClick={onBillingClick}
        onRechargeClick={onRechargeClick}
        balance={balance}
        balanceLoading={balanceLoading}
        title={title}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        userRole={accountRole}
      />
    </div>
  );

  const feed = (
    <div className="h-full pt-1.5 flex flex-col min-h-0">
      <MobileResultFeed
        resultEntries={resultEntries}
        activeEntryId={activeEntryId}
        activeSourceImage={activeSourceImage}
        surface={surface}
        viewMode={resultViewMode}
        onViewModeChange={setResultViewMode}
        onEntryOpen={onEntryOpen}
        onUseAsSource={onUseResultAsSource}
        isLoading={isLoading}
        isHistoryView={workspaceSurface === 'library'}
        onCloseHistory={onCloseHistory}
      />
    </div>
  );

  return (
    <div data-testid="mobile-workspace-surface" data-mobile-home-shell="three-zone" className="relative">
      <MobileAppShell
        header={header}
        feed={feed}
        composer={composer}
        overlays={!showDetail ? overlays : null}
      />

      {showMoreSheet ? (
        <div
          data-testid="mobile-more-sheet"
          className="fixed inset-0 z-[985] flex flex-col justify-end"
          style={{ background: 'var(--mobile-clay-overlay-bg)' }}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeMoreSheet}
            aria-label="关闭更多菜单"
          />

          {/* 更多操作底部滑出式抽屉面板，强行指定为极具质感的暗色磨砂玻璃背景 rgba(20, 20, 22, 0.90) */}
          <div
            className="relative rounded-t-[30px] border px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 text-[var(--text-primary)]"
            style={{
              background: 'linear-gradient(to bottom, rgba(20, 20, 22, 0.95) 0%, rgba(20, 20, 22, 0.65) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  工作区
                </div>
                <h2 className="mt-1 text-lg font-semibold">更多操作</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectList((previous) => !previous)}
                className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
              >
                <FolderOpen size={14} />
                {resolvedProjectCount > 1 ? `项目 ${resolvedProjectCount}` : '当前项目'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowProjectList((previous) => !previous)}
              className="mb-3 flex w-full items-center justify-between rounded-[24px] border border-white/8 bg-white/5 px-4 py-3 text-left transition-all active:scale-[0.985] active:bg-white/10"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  当前项目
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{resolvedProjectName}</div>
              </div>
              <div className="text-xs text-white/70">{showProjectList ? '收起' : '切换'}</div>
            </button>

            {showProjectList ? (
              <div className="mb-4 rounded-[24px] border border-white/8 bg-white/5 p-2.5">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  项目列表
                </div>
                <div className="space-y-2">
                  {state.canvases.map((canvas) => {
                    const isActive = canvas.id === activeCanvas?.id;

                    return (
                      <button
                        key={canvas.id}
                        type="button"
                        onClick={() => {
                          switchCanvas(canvas.id);
                          closeMoreSheet();
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-[18px] px-3 py-3 text-left transition-all ${
                          isActive
                            ? 'border border-[var(--mobile-clay-active-border)] bg-[var(--mobile-clay-active-bg)] text-[var(--text-primary)]'
                            : 'border border-white/5 bg-white/5 text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="min-w-0 truncate text-sm font-medium">{canvas.name}</span>
                        {isActive ? <Check size={16} className="shrink-0 text-[var(--accent-color)]" /> : null}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!canCreateCanvas) {
                      return;
                    }
                    createCanvas();
                    closeMoreSheet();
                  }}
                  disabled={!canCreateCanvas}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-45"
                >
                  <Plus size={16} />
                  {canCreateCanvas ? '新建项目' : '项目已满'}
                </button>
              </div>
            ) : null}

            {/* 简体中文注释：手机端专属的主题与语言切换合并卡片。应用了 Clay 专有 cubic-bezier(0.16, 1, 0.3, 1) 黄金阻尼曲线与高档旋转微反馈 */}
            <div className="mb-3 flex w-full gap-2.5">
              {/* 左侧：主题大主图（点击切换亮/暗，下压 1px 且缩水 4% 阻尼物理回弹） */}
              <button
                type="button"
                onClick={toggleTheme}
                className="relative flex h-[76px] w-[140px] shrink-0 flex-col justify-end overflow-hidden rounded-[22px] border border-white/8 p-3 text-left active:scale-[0.96] active:translate-y-px cursor-pointer"
                style={{
                  background: isDarkMode
                    ? 'linear-gradient(135deg, rgba(255, 77, 139, 0.85) 0%, rgba(184, 164, 237, 0.85) 100%)'
                    : 'linear-gradient(135deg, rgba(255, 176, 132, 0.95) 0%, rgba(232, 185, 74, 0.95) 100%)',
                  boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.15)',
                  transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background 240ms cubic-bezier(0.16, 1, 0.3, 1), border-color 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 240ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* 发光背景装饰微图 */}
                <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/20 blur-md pointer-events-none" />
                {/* 简体中文注释：切换主题时，Sun/Moon 图标伴随极其滑顺的 30度 物理旋转与极微小缩放偏转反馈 */}
                <div 
                  className="absolute right-3 top-3 text-white/90"
                  style={{
                    transform: isDarkMode ? 'rotate(0deg) scale(1)' : 'rotate(30deg) scale(0.95)',
                    transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {isDarkMode ? <Moon size={20} strokeWidth={2} /> : <Sun size={20} strokeWidth={2} />}
                </div>
                <div className="relative z-10 pointer-events-none">
                  <div className="text-[10px] font-bold tracking-[0.16em] text-white/70 uppercase">
                    主题偏好
                  </div>
                  <div className="mt-0.5 text-xs font-bold text-white whitespace-nowrap">
                    {isDarkMode ? '中性黑灰' : '亮色奶油'}
                  </div>
                </div>
              </button>

              {/* 右侧：中英文切换按钮（下压 1px 且缩水 2.5% 阻尼物理回弹） */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="flex flex-1 h-[76px] items-center justify-between rounded-[22px] border border-white/8 bg-white/5 px-4 text-left active:scale-[0.975] active:translate-y-px cursor-pointer"
                style={{
                  transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div className="min-w-0 pointer-events-none">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    系统语言 / LANG
                  </div>
                  <div className="mt-1 truncate text-xs font-bold text-[var(--text-primary)]">
                    {isChinese ? '中文 (简体)' : 'English (US)'}
                  </div>
                </div>
                {/* 简体中文注释：中英文切换时，右侧 Languages 翻译图标小格子产生极其克制不张扬的 15度 偏转回弹与 5% 微弱收缩动效 */}
                <div 
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/8 text-[var(--text-secondary)]"
                  style={{
                    transform: isChinese ? 'rotate(0deg) scale(1)' : 'rotate(15deg) scale(0.95)',
                    transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <Languages size={18} strokeWidth={2} />
                </div>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* 搜索与历史合并 */}
              <button type="button" onClick={() => runFromMoreSheet(onOpenHistory)} className={moreSheetActionClass}>
                <Clock3 size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">历史与搜索</div>
                <div className="mt-1 text-xs text-white/55">查找历史提示词和结果</div>
              </button>
              {/* 电商生图独立入口 */}
              <button type="button" onClick={() => runFromMoreSheet(() => onScreenChange('ecommerce'))} className={moreSheetActionClass}>
                <FolderOpen size={17} className="mb-2.5 text-[var(--accent-color)]" />
                <div className="text-sm font-semibold">电商生图</div>
                <div className="mt-1 text-xs text-white/55">电商专用生图和任务管理</div>
              </button>
              <button type="button" onClick={() => runFromMoreSheet(onOpenChat)} className={moreSheetActionClass}>
                <MessageSquare size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">聊天</div>
                <div className="mt-1 text-xs text-white/55">打开对话侧边栏</div>
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                data-testid="mobile-more-menu-settings"
                className={moreSheetActionClass}
              >
                <Settings size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">设置</div>
                <div className="mt-1 text-xs text-white/55">模型、渠道和系统选项</div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDetail && activeEntry ? (
        <MobileResultDetailScreen
          entry={activeEntry}
          onClose={() => onScreenChange('home')}
          onPreviewOriginal={onPreviewImage}
          onUseAsSource={onUseResultAsSource}
          onPartialRedraw={onPartialRedraw}
          onDownload={onDownloadEntry}
          onDelete={(imageId) => {
            onDeleteImage(imageId);
            onScreenChange('home');
          }}
          onEditEcommerceTask={onEditEcommerceTask}
          onConfirmEcommerceDesktop={onConfirmEcommerceDesktop}
          onGenerateEcommerceMobile={onGenerateEcommerceMobile}
          onToggleEcommerceSelected={onToggleEcommerceSelected}
          onPrevious={
            activeEntryIndex > 0
              ? () => onEntryOpen(resultEntries[activeEntryIndex - 1].id)
              : undefined
          }
          onNext={
            activeEntryIndex >= 0 && activeEntryIndex < resultEntries.length - 1
              ? () => onEntryOpen(resultEntries[activeEntryIndex + 1].id)
              : undefined
          }
        />
      ) : null}
    </div>
  );
};

export default MobileWorkspaceSurface;
