import React from 'react';
import { createPortal } from 'react-dom';
import {
  FolderKanban,
  LayoutPanelTop,
  LogOut,
  Settings,
  Shield,
  User,
  Zap,
} from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useCanvas } from '../context/CanvasContext.tsx';
import { navigateAppRoot } from './navigation/appRootNavigation';

interface AppDesktopChromeProps {
  isMobile: boolean;
  activeMode: 'canvas' | 'copilot' | 'create';
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
  onCloseAssistant: () => void;
  onOpenCanvasWorkspace: () => void;
  onOpenCreateWorkspace: () => void;
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

/**
 * 只让项目名称文本订阅 CanvasContext，避免卡片拖拽时重绘整条桌面 Chrome。
 */
const ActiveProjectName: React.FC = () => {
  const { activeCanvas } = useCanvas();
  return <>{activeCanvas?.name || '项目 1'}</>;
};

const AppDesktopChrome: React.FC<AppDesktopChromeProps> = ({
  isMobile,
  activeMode,
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
  onCloseAssistant,
  onOpenCanvasWorkspace,
}) => {
  const { adminLevel } = useAuth();
  React.useEffect(() => {
    if (isMobile) {
      delete document.body.dataset.kkWorkspaceMode;
      return undefined;
    }

    document.body.dataset.kkWorkspaceMode = activeMode;
    return () => {
      if (document.body.dataset.kkWorkspaceMode === activeMode) {
        delete document.body.dataset.kkWorkspaceMode;
      }
    };
  }, [activeMode, isMobile]);

  if (isMobile) {
    return null;
  }

  const openCanvasMode = () => {
    onCloseAssistant();
    onOpenCanvasWorkspace();
    focusWorkspaceCanvas();
  };
  const openProjectMenu = () => {
    document.getElementById('project-manager-trigger')?.click();
  };

  return (
    <div
      className="kk-workspace-chrome-surface kk-workspace-chrome-v3 w-full select-none"
      style={{ '--kk-desktop-chrome-right-offset': rightOffset } as React.CSSProperties}
    >
      <button
        type="button"
        data-chrome-region="project"
        className="kk-workspace-chrome-v3__project"
        onClick={openProjectMenu}
        aria-label="打开当前项目"
      >
        <FolderKanban size={16} aria-hidden="true" />
        <span><small>项目</small><strong><ActiveProjectName /></strong></span>
      </button>

      <button
        type="button"
        data-chrome-region="canvas"
        className="kk-workspace-chrome-v3__canvas"
        aria-current="page"
        onClick={openCanvasMode}
      >
        <LayoutPanelTop size={16} aria-hidden="true" />
        <span>画布</span>
      </button>

      <div data-chrome-region="account" className="kk-workspace-chrome-v3__account">
        <div className="relative flex-shrink-0">
          <button
            data-testid="desktop-user-menu-trigger"
            onClick={(event) => {
              event.stopPropagation();
              setShowUserMenu((prev) => !prev);
            }}
            className="kk-workspace-avatar-button"
            aria-label="打开个人中心"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span className="kk-workspace-avatar-fallback">
                {user?.email?.[0].toUpperCase() || 'K'}
              </span>
            )}
          </button>
          <span className="kk-workspace-status-dot" data-status={apiStatus} aria-hidden="true" />
        </div>

        {billingUiEnabled ? (
          <div className="kk-workspace-chrome-v3__billing">
            <span><Zap size={13} aria-hidden="true" />{remainingBalanceDisplay}<small>积分</small></span>
            <button id="btn-desktop-recharge" type="button" onClick={onRecharge}>充值</button>
          </div>
        ) : null}

        <button
          id="btn-desktop-settings"
          type="button"
          data-testid="desktop-settings-trigger"
          className="kk-workspace-icon-control"
          onClick={onOpenSettings}
          aria-label="打开设置"
          title="设置"
        >
          <Settings size={16} aria-hidden="true" />
        </button>
      </div>

      {showUserMenu ? (
        createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: KK_LAYER.modalBackdrop }} onClick={() => setShowUserMenu(false)} />
            <div
              id="desktop-user-menu-panel"
              onClick={(e) => e.stopPropagation()}
              className="kk-workspace-menu-surface fixed right-3 top-[52px] w-64 origin-top-right animate-in rounded-[14px] border p-2 duration-100 fade-in zoom-in-95"
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

export default React.memo(AppDesktopChrome);
