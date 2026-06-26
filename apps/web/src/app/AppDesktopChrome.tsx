import React from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, LogOut, User, Zap, Shield } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';

import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { navigateAppRoot } from './navigation/appRootNavigation';

const chromeSurfaceStyle: React.CSSProperties = {
  background: 'var(--kk-workspace-chrome-bg, var(--frost-card-framework-bg))',
  borderColor: 'var(--kk-workspace-chrome-border, var(--frost-card-main-border))',
  boxShadow: 'var(--kk-workspace-chrome-shadow, var(--frost-card-main-shadow))',
  backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.22)',
  WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.22)',
};

const desktopUserMenuSurfaceStyle: React.CSSProperties = {
  ...chromeSurfaceStyle,
  background: 'color-mix(in srgb, var(--frost-card-framework-bg-solid, var(--frost-card-framework-bg)) 86%, transparent 14%)',
  borderColor: 'var(--kk-workspace-chrome-border, var(--frost-card-framework-border))',
  boxShadow: 'var(--kk-workspace-chrome-shadow, var(--frost-card-framework-shadow))',
  zIndex: KK_LAYER.modal,
};

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
}

interface DesktopMenuActionButtonProps {
  icon: React.ReactNode;
  label: string;
  accentColor: string;
  onClick: () => void;
  testId?: string;
  id?: string;
}

const DesktopMenuActionButton: React.FC<DesktopMenuActionButtonProps> = ({
  icon,
  label,
  accentColor,
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
    <div className="rounded-lg p-1.5" style={{ backgroundColor: 'var(--bg-tertiary)', color: accentColor }}>
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
}) => {
  const { adminLevel } = useAuth();
  if (isMobile) {
    return null;
  }

  return (
    <div
      className="kk-workspace-chrome-surface w-full flex items-center gap-3 rounded-2xl border p-2.5 select-none relative"
      style={chromeSurfaceStyle}
    >
      {/* 简体中文：头像按钮区域 (高度与右侧资产齐平) */}
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
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-[var(--clay-brand-pink)] via-[var(--clay-brand-coral)] to-[var(--clay-brand-peach)] text-sm font-bold text-white">
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
            <Zap size={14} className="text-[var(--accent-coral)]" />
            <span className="text-[15px] font-mono font-black tracking-tight shrink-0" style={{ color: 'var(--text-primary)' }}>
              {remainingBalanceDisplay}
            </span>
            <span className="text-[10px] font-bold text-[var(--accent-coral)] shrink-0">积分</span>
          </div>

          <button
            id="btn-desktop-recharge"
            onClick={onRecharge}
            className="kk-workspace-primary-action inline-flex h-7.5 items-center justify-center rounded-xl px-2.5 text-[11px] font-black leading-none active:scale-95 shrink-0"
            style={{ minHeight: '30px', height: '30px' }}
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
              style={desktopUserMenuSurfaceStyle}
            >
              <div className="space-y-1">
                <DesktopMenuActionButton
                  icon={<User size={14} />}
                  label="个人中心"
                  accentColor="var(--clay-brand-coral)"
                  onClick={() => {
                    onOpenProfile('main');
                    setShowUserMenu(false);
                  }}
                />
                <DesktopMenuActionButton
                  id="btn-desktop-settings"
                  icon={<LayoutDashboard size={14} />}
                  label="管理设置"
                  accentColor="var(--clay-brand-lavender)"
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
                    accentColor="var(--clay-brand-coral)"
                    onClick={() => {
                      navigateAppRoot('/admin');
                      setShowUserMenu(false);
                    }}
                  />
                )}

                <div className="my-1 h-px" style={{ backgroundColor: 'var(--border-light)' }} />

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
