import React, { useMemo, useState } from 'react';
import { Check, Clock3, FolderOpen, MessageSquare, Plus, Search, Settings } from 'lucide-react';

import { useCanvas } from '../../context/CanvasContext';
import type {
  MobileResultEntry,
  MobileSurfaceScreen,
  PartialRedrawRequest,
} from '../../types';
import MobileAppShell from './MobileAppShell';
import MobileHeader from './MobileHeader';
import MobileResultDetailScreen from './MobileResultDetailScreen';
import MobileResultFeed from './MobileResultFeed';

export interface MobileWorkspaceSurfaceProps {
  activeScreen: MobileSurfaceScreen;
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
  onPartialRedraw: (entry: MobileResultEntry, request: PartialRedrawRequest) => void;
  onDownloadEntry: (entry: MobileResultEntry) => void;
  onDeleteImage: (imageId: string) => void;
  onEditEcommerceTask: (entry: MobileResultEntry) => void;
  onConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  onGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
  onToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  composer: React.ReactNode;
  overlays?: React.ReactNode;
}

const moreSheetActionClass =
  'rounded-[22px] border border-white/10 bg-white/6 p-3.5 text-left text-white backdrop-blur-xl transition-all active:scale-[0.985]';

const MobileWorkspaceSurface: React.FC<MobileWorkspaceSurfaceProps> = ({
  activeScreen,
  onScreenChange,
  onOpenSettings,
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
}) => {
  const { state, activeCanvas, switchCanvas, createCanvas, canCreateCanvas } = useCanvas();
  const [showProjectList, setShowProjectList] = useState(false);
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
      />
    </div>
  );

  const feed = (
    <div className="h-full px-3 pb-3 pt-2">
      <MobileResultFeed
        resultEntries={resultEntries}
        activeEntryId={activeEntryId}
        activeSourceImage={activeSourceImage}
        onEntryOpen={onEntryOpen}
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
        <div className="fixed inset-0 z-[985] flex flex-col justify-end bg-black/55 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={closeMoreSheet}
            aria-label="关闭更多菜单"
          />

          <div className="relative rounded-t-[30px] border border-white/10 bg-[rgba(13,16,25,0.96)] px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 text-white shadow-[0_-24px_80px_rgba(2,6,23,0.48)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
                  工作区
                </div>
                <h2 className="mt-1 text-lg font-semibold">更多操作</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectList((previous) => !previous)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/80"
              >
                <FolderOpen size={14} />
                {resolvedProjectCount > 1 ? `项目 ${resolvedProjectCount}` : '当前项目'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowProjectList((previous) => !previous)}
              className="mb-3 flex w-full items-center justify-between rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  当前项目
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-white">{resolvedProjectName}</div>
              </div>
              <div className="text-xs text-white/70">{showProjectList ? '收起' : '切换'}</div>
            </button>

            {showProjectList ? (
              <div className="mb-4 rounded-[24px] border border-white/10 bg-white/6 p-2.5">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
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
                            ? 'border border-sky-400/30 bg-sky-400/10 text-white'
                            : 'border border-transparent bg-black/20 text-white/80'
                        }`}
                      >
                        <span className="min-w-0 truncate text-sm font-medium">{canvas.name}</span>
                        {isActive ? <Check size={16} className="shrink-0 text-sky-200" /> : null}
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
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/15 bg-black/15 px-3 py-3 text-sm font-medium text-white/80 disabled:opacity-45"
                >
                  <Plus size={16} />
                  {canCreateCanvas ? '新建项目' : '项目已满'}
                </button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => runFromMoreSheet(onOpenSearch)} className={moreSheetActionClass}>
                <Search size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">搜索</div>
                <div className="mt-1 text-xs text-white/55">查找历史提示词和结果</div>
              </button>
              <button type="button" onClick={() => runFromMoreSheet(onOpenHistory)} className={moreSheetActionClass}>
                <Clock3 size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">历史</div>
                <div className="mt-1 text-xs text-white/55">查看最近生成内容</div>
              </button>
              <button type="button" onClick={() => runFromMoreSheet(onOpenChat)} className={moreSheetActionClass}>
                <MessageSquare size={17} className="mb-2.5" />
                <div className="text-sm font-semibold">聊天</div>
                <div className="mt-1 text-xs text-white/55">打开对话侧边栏</div>
              </button>
              <button
                type="button"
                onClick={() => runFromMoreSheet(onOpenSettings)}
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
