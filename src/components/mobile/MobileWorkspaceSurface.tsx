import React, { useMemo, useState, useRef } from 'react';
import { Check, Clock3, FolderOpen, MessageSquare, Plus, Search, Settings, ShoppingBag } from 'lucide-react';

import { useCanvas } from '../../context/CanvasContext';
import { useAdminRole } from '../../hooks/useAdminRole';
import type {
  MobileResultEntry,
  MobileSurfaceScreen,
  PartialRedrawRequest,
  ResponsiveSurface,
  ResultViewMode,
} from '../../types';
import type { AppPromptBarProps } from '../../app/AppPromptComposer';
import MobileAppShell from './MobileAppShell';
import MobileHeader from './MobileHeader';
import MobileResultDetailScreen from './MobileResultDetailScreen';
import MobileResultFeed from './MobileResultFeed';
import MobileEcommerceScreen from './MobileEcommerceScreen';

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
  onOpenHistorySearch?: () => void;
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
  onGenerateFollowUp?: (prompt: string, parentImageId: string) => void;
  onPartialRedraw: (entry: MobileResultEntry, request: PartialRedrawRequest) => void;
  onDownloadEntry: (entry: MobileResultEntry) => void;
  onDeleteImage: (imageId: string) => void;
  onEditEcommerceTask: (entry: MobileResultEntry) => void;
  onConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  onGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
  onToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  composer: React.ReactNode;
  promptBarProps: AppPromptBarProps;
  overlays?: React.ReactNode;
}

const moreSheetActionClass =
  'rounded-[22px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-3.5 text-left text-[var(--text-primary)] transition-all active:scale-[0.985]';

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
  onOpenHistorySearch,
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
  onGenerateFollowUp,
  onPartialRedraw,
  onDownloadEntry,
  onDeleteImage,
  onEditEcommerceTask,
  onConfirmEcommerceDesktop,
  onGenerateEcommerceMobile,
  onToggleEcommerceSelected,
  composer,
  promptBarProps,
  overlays,
}) => {
  const { state, activeCanvas, switchCanvas, createCanvas, canCreateCanvas } = useCanvas();
  const { accountRole } = useAdminRole();
  const [showProjectList, setShowProjectList] = useState(false);
  const [resultViewMode, setResultViewMode] = useState<ResultViewMode>('standard');
  
  // 边缘手势返回识别逻辑
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // 仅在非 home 状态下激活手势返回
    if (activeScreen === 'home') return;
    
    const touch = e.touches[0];
    const width = window.innerWidth;
    
    // 严格限制在屏幕边缘 40px 内起手
    if (touch.clientX < 40 || touch.clientX > width - 40) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    // 重置起手状态
    touchStartRef.current = null;
    
    // 判定水平滑动的阈值：距离 > 100px 且垂直变动 < 60px
    if (Math.abs(deltaX) > 100 && Math.abs(deltaY) < 60) {
      onScreenChange('home');
    }
  };

  const activeEntryIndex = useMemo(
    () => resultEntries.findIndex((entry) => entry.id === activeEntryId),
    [activeEntryId, resultEntries],
  );
  const activeEntry = activeEntryIndex >= 0 ? resultEntries[activeEntryIndex] : null;
  const showDetail = activeScreen === 'detail' && Boolean(activeEntry);
  const showMoreSheet = activeScreen === 'more-sheet';
  const showEcommerce = activeScreen === 'ecommerce';
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
    <div className="relative px-3 py-1.5 z-20">
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
      {/* 用户信息积分栏最下方框下面的渐变半透明效果 */}
      <div className="pointer-events-none absolute inset-x-0 top-full h-10 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />
    </div>
  );

  const feed = (
    <div className="h-full pt-1.5">
      <MobileResultFeed
        resultEntries={resultEntries}
        activeEntryId={activeEntryId}
        activeSourceImage={activeSourceImage}
        surface={surface}
        viewMode={resultViewMode}
        onViewModeChange={setResultViewMode}
        onEntryOpen={onEntryOpen}
        onUseAsSource={onUseResultAsSource}
      />
    </div>
  );

  return (
    <div
      data-testid="mobile-workspace-surface"
      data-mobile-home-shell="three-zone"
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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

          <div
            className="relative rounded-t-[30px] border px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 text-[var(--text-primary)]"
            style={{
              background: 'var(--mobile-glass-bg)',
              borderColor: 'var(--mobile-glass-border)',
              boxShadow: 'var(--mobile-glass-shadow)'
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
                className="inline-flex items-center gap-2 rounded-full border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
              >
                <FolderOpen size={14} />
                {resolvedProjectCount > 1 ? `项目 ${resolvedProjectCount}` : '当前项目'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowProjectList((previous) => !previous)}
              className="mb-3 flex w-full items-center justify-between rounded-[24px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] px-4 py-3 text-left"
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
              <div className="mb-4 rounded-[24px] border border-[var(--mobile-clay-border)] bg-[var(--mobile-clay-surface-bg)] p-2.5">
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
                            : 'border border-transparent bg-[var(--mobile-clay-muted-surface-bg)] text-[var(--text-secondary)]'
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
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--mobile-clay-border-strong)] bg-[var(--mobile-clay-muted-surface-bg)] px-3 py-3 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-45"
                >
                  <Plus size={16} />
                  {canCreateCanvas ? '新建项目' : '项目已满'}
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => runFromMoreSheet(onOpenHistorySearch || onOpenSearch)}
                className={moreSheetActionClass}
              >
                <Search size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">历史搜索</div>
                <div className="mt-1 text-xs text-white/55">检索历史或查看生成库</div>
              </button>
              <button
                type="button"
                onClick={() => runFromMoreSheet(() => onScreenChange('ecommerce'))}
                className={moreSheetActionClass}
              >
                <ShoppingBag size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">电商功能</div>
                <div className="mt-1 text-xs text-white/55">一键批量生成电商主图与A+</div>
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
          onGenerateFollowUp={onGenerateFollowUp}
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

      {showEcommerce ? (
        <MobileEcommerceScreen
          onClose={() => onScreenChange('home')}
          balance={balance}
          balanceLoading={balanceLoading}
          promptBarProps={promptBarProps}
        />
      ) : null}
    </div>
  );
};

export default MobileWorkspaceSurface;
