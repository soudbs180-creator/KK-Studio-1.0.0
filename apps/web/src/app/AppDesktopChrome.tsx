import React from 'react';
import { createPortal } from 'react-dom';
import { Bot, LayoutDashboard, LogOut, User, Zap, Shield, Search } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { navigateAppRoot } from './navigation/appRootNavigation';

interface AppDesktopChromeProps {
  isMobile: boolean;
  billingUiEnabled: boolean;
  remainingBalanceDisplay: string;
  onRecharge: () => void;
  rightOffset: string;
  user: RuntimeAuthUser | null;
  avatarUrl: string | null | undefined;
  apiStatus: 'success' | 'error' | 'neutral';
  showUserMenu: boolean;
  setShowUserMenu: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenProfile: (view: UserProfileView) => void;
  onOpenSettings: () => void;
  onSignOut: () => void | Promise<void>;
  onOpenAssistant: () => void;
  onCloseAssistant: () => void;
  onOpenCommandPalette: () => void;
}

interface DesktopMenuActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
  id?: string;
}

function focusWorkspaceCanvas() {
  const canvas = document.querySelector<HTMLElement>('[data-canvas-viewport], .canvas-container, canvas');
  canvas?.focus();
}

function focusWorkspaceComposer(fallback: () => void) {
  const composer = document.querySelector<HTMLElement>(
    '#prompt-bar-container textarea, #prompt-bar-container input',
  );
  if (composer) {
    composer.focus();
    return;
  }
  fallback();
}

const DesktopMenuActionButton: React.FC<DesktopMenuActionButtonProps> = ({
  icon,
  label,
  onClick,
  testId,
  id,
}) => (
  <button
    id={id}
    onClick={onClick}
    data-testid={testId}
    className="kk-workspace-control kk-workspace-menu-action flex w-full items-center gap-3 rounded-lg px-3 text-left text-sm"
  >
    <div className="kk-workspace-menu-action__icon rounded-lg p-1.5">
      {icon}
    </div>
    {label}
  </button>
);

const AppDesktopChrome: React.FC<AppDesktopChromeProps> = ({
  isMobile,
  billingUiEnabled,
  remainingBalanceDisplay,
  onRecharge,
  rightOffset,
  user,
  avatarUrl,
  apiStatus,
  showUserMenu,
  setShowUserMenu,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  onOpenAssistant,
  onCloseAssistant,
  onOpenCommandPalette,
}) => {
  const { adminLevel } = useAuth();
  const [activeMode, setActiveMode] = React.useState<'canvas' | 'copilot' | 'create'>('canvas');
  if (isMobile) {
    return null;
  }

  const openCanvasMode = () => {
    setActiveMode('canvas');
    onCloseAssistant();
    focusWorkspaceCanvas();
  };
  const openCopilotMode = () => {
    setActiveMode('copilot');
    onOpenAssistant();
  };
  const openCreateMode = () => {
    setActiveMode('create');
    onCloseAssistant();
    focusWorkspaceComposer(onOpenCommandPalette);
  };

  return (
    <div
      className="kk-workspace-chrome-surface w-full flex items-center gap-3 rounded-2xl border p-2.5 select-none relative"
    >
      <span className="kk-morphic-brand">KK Studio</span>
      <div className="kk-morphic-command-group flex items-center gap-1 border-r pr-2" role="group" aria-label="Workspace commands">
        <button
          type="button"
          id="btn-global-ai-assistant"
          data-global-ai-entry="true"
          className="kk-workspace-icon-control"
          onClick={openCopilotMode}
          aria-label="Open AI assistant"
          title="Open AI assistant"
        >
          <Bot size={17} />
        </button>
        <button
          type="button"
          id="btn-global-command-palette"
          data-command-entry="true"
          className="kk-workspace-icon-control"
          onClick={onOpenCommandPalette}
          aria-label="Open command search"
          title="Open command search"
        >
          <Search size={16} />
        </button>
      </div>

      {/* 简体中文：头像按钮区域 (高度与右侧资产齐平) */}
      <nav className="kk-morphic-mode-switch" aria-label="工作区模式">
        <button type="button" aria-current={activeMode === 'canvas' ? 'page' : undefined} onClick={openCanvasMode}>
          画布
        </button>
        <button type="button" aria-current={activeMode === 'copilot' ? 'page' : undefined} onClick={openCopilotMode}>
          Copilot
        </button>
        <button type="button" aria-current={activeMode === 'create' ? 'page' : undefined} onClick={openCreateMode}>
          创作
        </button>
      </nav>

      <div className="kk-morphic-chrome-spacer flex-1" />

      <div className="relative flex-shrink-0">
        <button
          data-testid="desktop-user-menu-trigger"
          onClick={(event) => {
            event.stopPropagation();
            setShowUserMenu((prev) => !prev);
          }}
          className="kk-workspace-avatar-button relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-all active:scale-95"
        >
          {avatarUrl ? (
            <img src={avatarUrl} className="h-full w-full object-cover" />
          ) : (
            <div className="kk-workspace-avatar-fallback flex h-full w-full items-center justify-center text-sm font-bold text-white">
              {user?.email?.[0].toUpperCase() || 'K'}
            </div>
          )}
        </button>

        {/* 简体中文：服务/API 状态指示灯 */}
        <div
          className="kk-workspace-status-dot absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 shadow-lg"
          data-status={apiStatus}
        />
      </div>

      {/* 简体中文：积分展示 & 充值模块（精简布局：⚡积分 + 充值） */}
      {billingUiEnabled && (
        <div className="flex items-center gap-1.5 h-10 shrink-0">
          <div className="flex items-center gap-1 select-none shrink-0">
            <Zap size={14} className="kk-morphic-balance-icon" />
            <span className="kk-morphic-balance-value text-[15px] font-mono font-black tracking-tight shrink-0">
              {remainingBalanceDisplay}
            </span>
            <span className="kk-morphic-balance-label text-[10px] font-bold shrink-0">积分</span>
          </div>

          <button
            id="btn-desktop-recharge"
            onClick={onRecharge}
            className="kk-workspace-primary-action inline-flex h-7.5 items-center justify-center rounded-xl px-2.5 text-[11px] font-black leading-none active:scale-95 shrink-0"
          >
            充值
          </button>
        </div>
      )}


      {showUserMenu ? (
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: KK_LAYER.modalBackdrop }} onClick={() => setShowUserMenu(false)} />
            <div
              id="desktop-user-menu-panel"
              onClick={(e) => e.stopPropagation()}
              className="kk-workspace-menu-surface fixed left-4 top-[88px] w-64 origin-top-left animate-in rounded-xl border p-2 duration-100 fade-in zoom-in-95"
              style={{ zIndex: KK_LAYER.modal }}
            >
              <div className="space-y-1">
                <DesktopMenuActionButton
                  icon={<User size={14} />}
                  label="个人中心"
                  onClick={() => {
                    onOpenProfile('main');
                    setShowUserMenu(false);
                  }}
                />
                <DesktopMenuActionButton
                  id="btn-desktop-settings"
                  icon={<LayoutDashboard size={14} />}
                  label="管理设置"
                  testId="desktop-user-menu-settings"
                  onClick={() => {
                    onOpenSettings();
                    setShowUserMenu(false);
                  }}
                />

                {adminLevel > 0 && (
                  <DesktopMenuActionButton
                    icon={<Shield size={14} />}
                    label="管理员后台"
                    onClick={() => {
                      navigateAppRoot('/admin');
                      setShowUserMenu(false);
                    }}
                  />
                )}

                <div className="kk-workspace-menu-divider my-1 h-px" />

                <button
                  onClick={() => {
                    void onSignOut();
                    setShowUserMenu(false);
                  }}
                  className="kk-workspace-danger-action flex w-full items-center gap-3 rounded-lg px-3 text-left text-sm outline-none"
                >
                  <div className="kk-workspace-danger-icon rounded-lg p-1.5">
                    <LogOut size={14} />
                  </div>
                  退出登录
                </button>
              </div>
            </div>
          </>,
          document.body
        )
      ) : null}
    </div>
  );
};

export default AppDesktopChrome;
