import React, { useMemo, useRef, useState } from 'react';
import { Check, Clock3, FolderOpen, Heart, MessageSquare, Plus, Search, Settings, Sun, Moon, Languages, PackageOpen, Trash2 } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

// 简体中文：自定义扫把（Broom）图标组件，用于清理操作
const Broom: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M4 20h16" />
        <path d="m11 15 4.5-4.5" />
        <path d="m13 13 4.5-4.5" />
        <path d="M15 11 19.5 6.5" />
        <path d="m20 4-4.5 4.5" />
        <path d="M11 15 8 18" />
        <path d="m8 18-2 2" />
        <path d="M13 13 10 16" />
        <path d="m10 16-2 2" />
    </svg>
);

import { useCanvas } from '../../context/CanvasContext';
import { useOverlayFocusLifecycle } from '../../hooks/useOverlayFocusLifecycle';
import { useTheme } from '../../context/ThemeContext';
import { useLocale } from '../../context/LocaleContext';
// 简体中文：导入全局通知服务以在移动端提供操作反馈
import { notify } from '../../services/system/notificationService';
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
  onOpenFavorites: () => void;
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
  workspaceSurface?: 'workspace' | 'library' | 'favorites';
  onCloseHistory?: () => void;
}

// 磨砂玻璃风格按钮样式定义，带背景和边框的半透明组合
const moreSheetActionClass =
  'rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)] p-3.5 text-left text-[var(--text-primary)] transition-all active:scale-[0.985] active:bg-[var(--mobile-clay-active-bg)]';

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
  onOpenFavorites,
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
  const { 
    state, 
    activeCanvas, 
    switchCanvas, 
    createCanvas, 
    canCreateCanvas,
    deleteCanvas,
    cleanupInvalidCards
  } = useCanvas();
  const { toggleTheme, isDarkMode } = useTheme();
  const { toggleLanguage, isChinese, pick } = useLocale();
  const moreSheetRef = useRef<HTMLDivElement>(null);
  // 🚀 [移动端专属] 提取真实的用户角色，以在头部用户名右侧进行徽章渲染
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

  useOverlayFocusLifecycle({
    isOpen: showMoreSheet,
    onClose: closeMoreSheet,
    containerRef: moreSheetRef,
  });

  const runFromMoreSheet = (action: () => void) => {
    closeMoreSheet();
    action();
  };

  const onOpenSettings = () => {
    closeMoreSheet();
    openSettings();
  };

  const header = workspaceSurface === 'library' ? null : (
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
        // 简体中文：支持多选批量删除和批量下载的回调参数向下传递
        onDeleteImage={onDeleteImage}
        onDownloadEntry={onDownloadEntry}
      />
    </div>
  );

  return (
    <div data-testid="mobile-workspace-surface" data-mobile-home-shell="adaptive-three-zone" className="relative">
      <MobileAppShell
        header={header}
        feed={feed}
        composer={composer}
        overlays={!showDetail ? overlays : null}
      />

      {showMoreSheet ? (
        <div
          data-testid="mobile-more-sheet"
          data-kk-mobile-overlay-layer="true"
          className="fixed inset-0 flex flex-col justify-end"
          style={{ background: 'var(--mobile-clay-overlay-bg)', zIndex: KK_LAYER.modal }}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeMoreSheet}
            aria-label={pick('关闭更多菜单', 'Close Menu')}
          />

          {/* 更多操作底部滑出式抽屉面板，强行指定为极具质感的暗色磨砂玻璃背景 rgba(20, 20, 22, 0.90) */}
          <div
            ref={moreSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={pick('更多操作', 'More Actions')}
            tabIndex={-1}
            className="relative rounded-t-[30px] border px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 text-[var(--text-primary)]"
            style={{
              background: 'var(--mobile-clay-shell-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderColor: 'var(--mobile-clay-border)',
              boxShadow: 'var(--mobile-clay-shadow)'
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  {pick('工作区', 'Workspace')}
                </div>
                <h2 className="mt-1 text-lg font-semibold">{pick('更多操作', 'More Actions')}</h2>
              </div>
            </div>

            <div className="mb-3 grid w-full grid-cols-[20fr_20fr_20fr_40fr] gap-2">
              {/* 左侧：主题大主图（点击切换亮/暗，下压 1px 且缩水 4% 阻尼物理回弹） */}
              <button
                type="button"
                onClick={toggleTheme}
                className="relative flex h-[58px] min-w-0 items-center justify-center gap-1 overflow-hidden rounded-[18px] border border-white/8 px-1.5 text-center active:scale-[0.97] active:translate-y-px cursor-pointer"
                style={{
                  background: isDarkMode
                    ? 'linear-gradient(135deg, rgba(255, 77, 139, 0.85) 0%, rgba(184, 164, 237, 0.85) 100%)'
                    : 'linear-gradient(135deg, rgba(255, 176, 132, 0.95) 0%, rgba(232, 185, 74, 0.95) 100%)',
                  boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.15)',
                  transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background 240ms cubic-bezier(0.16, 1, 0.3, 1), border-color 240ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 240ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {/* 切换主题时的微小物理偏转反馈 */}
                <div 
                  className="relative text-white/90 shrink-0"
                  style={{
                    transform: isDarkMode ? 'rotate(0deg) scale(1)' : 'rotate(30deg) scale(0.95)',
                    transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {isDarkMode ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
                </div>
                <div className="relative z-10 pointer-events-none flex flex-col items-start leading-[1.1] text-left shrink-0">
                  <div className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {isChinese ? '主题' : 'Theme'}
                  </div>
                  <div className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {isChinese ? '偏好' : 'Pref'}
                  </div>
                </div>
              </button>

              {/* 中间：中英文切换按钮 */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="relative flex h-[58px] min-w-0 items-center justify-center gap-1 overflow-hidden rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)] px-1.5 text-center active:scale-[0.975] active:translate-y-px cursor-pointer"
                style={{
                  transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div 
                  className="relative text-[var(--text-secondary)] shrink-0"
                  style={{
                    transform: isChinese ? 'rotate(0deg) scale(1)' : 'rotate(15deg) scale(0.95)',
                    transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <Languages size={18} strokeWidth={2} />
                </div>
                <div className="relative z-10 pointer-events-none flex flex-col items-start leading-[1.1] text-left shrink-0">
                  <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {isChinese ? '系统' : 'Sys'}
                  </div>
                  <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {isChinese ? '语言' : 'Lang'}
                  </div>
                </div>
              </button>

              {/* 收藏：扩充为 20% 大小，加了图标和文字以保持跟前两个的视觉对称美 */}
              <button
                type="button"
                onClick={() => runFromMoreSheet(onOpenFavorites)}
                data-testid="mobile-more-menu-favorites"
                className="relative flex h-[58px] min-w-0 items-center justify-center gap-1 overflow-hidden rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)] px-1.5 text-center text-[var(--accent-coral)] active:scale-[0.975] active:translate-y-px cursor-pointer"
                style={{
                  transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background-color 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div className="relative text-[var(--accent-coral)] shrink-0">
                  <Heart size={18} strokeWidth={2} />
                </div>
                <div className="relative z-10 pointer-events-none flex flex-col items-start leading-[1.1] text-left shrink-0">
                  <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {isChinese ? '我的' : 'My'}
                  </div>
                  <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {isChinese ? '收藏' : 'Favs'}
                  </div>
                </div>
              </button>

              {/* 右侧：当前项目按钮，调小了 padding 并去掉了 Collapse/Switch 文本以完美适应 40% 的排版空间 */}
              <button
                type="button"
                onClick={() => setShowProjectList((previous) => !previous)}
                className="flex h-[58px] min-w-0 items-center justify-start gap-1.5 rounded-[18px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)] px-2.5 text-left transition-all active:scale-[0.985] active:bg-[var(--mobile-clay-active-bg)]"
              >
                <FolderOpen size={17} className="shrink-0 text-[var(--accent-color)]" />
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)] leading-none truncate">
                    {pick('当前项目', 'Project')}
                  </div>
                  <div className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)] leading-none">{resolvedProjectName}</div>
                </div>
              </button>
            </div>

            {showProjectList ? (
              <div className="mb-4 rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-muted-surface-bg)] p-2.5">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  {pick('项目列表', 'Projects')}
                </div>
                <div className="space-y-2">
                  {state.canvases.map((canvas) => {
                    const isActive = canvas.id === activeCanvas?.id;

                    return (
                      <div
                        key={canvas.id}
                        className={`flex w-full items-center justify-between gap-3 rounded-[18px] px-3 py-2 transition-all ${
                          isActive
                            ? 'border border-[var(--mobile-clay-active-border)] bg-[var(--mobile-clay-active-bg)] text-[var(--text-primary)]'
                            : 'border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)]/80 text-[var(--text-secondary)]'
                        }`}
                      >
                        {/* 简体中文：项目切换触发按钮，使用 flex-1 撑满左侧区域 */}
                        <button
                          type="button"
                          onClick={() => {
                            switchCanvas(canvas.id);
                            closeMoreSheet();
                          }}
                          className="flex-1 min-w-0 py-1.5 text-left cursor-pointer"
                        >
                          <span className="block truncate text-sm font-medium">{canvas.name}</span>
                        </button>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive ? <Check size={16} className="text-[var(--accent-color)]" /> : null}
                          
                          {/* 简体中文：仅在项目多于 1 个时允许删除项目，并进行确认以防误删 */}
                          {state.canvases.length > 1 && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const confirmed = window.confirm(
                                  pick(
                                    `确定要删除项目“${canvas.name}”吗？此操作无法撤销。`,
                                    `Are you sure you want to delete project "${canvas.name}"? This action cannot be undone.`
                                  )
                                );
                                if (confirmed) {
                                  deleteCanvas(canvas.id);
                                  // 简体中文：删除后弹出成功通知反馈给用户
                                  notify.success(
                                    pick('项目已删除', 'Project Deleted'),
                                    pick(`项目“${canvas.name}”已从工作区移除。`, `Project "${canvas.name}" has been removed.`)
                                  );
                                }
                              }}
                              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-red-400 active:scale-95 transition-colors cursor-pointer"
                              aria-label={pick('删除项目', 'Delete Project')}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
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
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--mobile-clay-border-strong)] bg-[var(--mobile-clay-surface-bg)]/80 px-3 py-3 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-45 cursor-pointer"
                >
                  <Plus size={16} />
                  {canCreateCanvas ? pick('新建项目', 'New Project') : pick('项目已满', 'Project Full')}
                </button>
                
                {/* 简体中文：增加清理错误卡片功能按钮，点击后直接执行，不需要危险确认 */}
                <button
                  type="button"
                  onClick={() => {
                    const result = cleanupInvalidCards(activeCanvas?.id);
                    if (result.removedPrompts === 0 && result.removedImages === 0 && result.removedGroups === 0) {
                      notify.success(
                        pick('无需清理', 'No cleanup needed'),
                        pick('当前项目没有发现错误卡片或失效分组。', 'No invalid cards found in the current project.')
                      );
                    } else {
                      notify.success(
                        pick('清理完成', 'Cleanup complete'),
                        pick(
                          `已清理 ${result.removedPrompts} 张主卡、${result.removedImages} 张子卡，并移除 ${result.removedGroups} 个空分组。`,
                          `Cleaned up ${result.removedPrompts} prompt cards, ${result.removedImages} image cards, and removed ${result.removedGroups} empty groups.`
                        )
                      );
                    }
                    closeMoreSheet();
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--mobile-clay-border-strong)] bg-[var(--mobile-clay-surface-bg)]/80 px-3 py-3 text-sm font-medium text-[var(--text-secondary)] active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <Broom size={16} />
                  {pick('清理错误卡片', 'Clean Invalid Cards')}
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              {/* 搜索与历史合并 */}
              <button type="button" onClick={() => runFromMoreSheet(onOpenHistory)} className={moreSheetActionClass}>
                <Clock3 size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">{pick('历史与搜索', 'History & Search')}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{pick('查找历史提示词和结果', 'Find history prompts and results')}</div>
              </button>
              <button type="button" onClick={() => runFromMoreSheet(() => onScreenChange('ecommerce'))} className={moreSheetActionClass}>
                <PackageOpen size={17} className="mb-2.5 text-[var(--accent-color)]" />
                <div className="text-sm font-semibold">{pick('电商生图', 'E-commerce Gen')}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{pick('电商专用生图和任务管理', 'E-commerce image generation & tasks')}</div>
              </button>
              <button type="button" onClick={() => runFromMoreSheet(onOpenChat)} className={moreSheetActionClass}>
                <MessageSquare size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">{pick('聊天', 'Chat')}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{pick('打开对话侧边栏', 'Open chat sidebar')}</div>
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                data-testid="mobile-more-menu-settings"
                className={moreSheetActionClass}
              >
                <Settings size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">{pick('设置', 'Settings')}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{pick('模型、渠道和系统选项', 'Models, providers and options')}</div>
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
