import React from 'react';
import { LayoutDashboard, LogOut, Sparkles, User, Zap, Shield } from 'lucide-react';

import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';
import { useAuth } from '../context/AuthContext.tsx';

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
  isChatOpen: boolean;
  onToggleChat: () => void;
}

interface DesktopMenuActionButtonProps {
  icon: React.ReactNode;
  label: string;
  accentColor: string;
  onClick: () => void;
  testId?: string;
}

const DesktopMenuActionButton: React.FC<DesktopMenuActionButtonProps> = ({
  icon,
  label,
  accentColor,
  onClick,
  testId,
}) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
    style={{ color: 'var(--text-secondary)' }}
    onMouseEnter={(event) => {
      event.currentTarget.style.backgroundColor = 'var(--toolbar-hover)';
      event.currentTarget.style.color = 'var(--text-primary)';
    }}
    onMouseLeave={(event) => {
      event.currentTarget.style.backgroundColor = 'transparent';
      event.currentTarget.style.color = 'var(--text-secondary)';
    }}
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
  isChatOpen,
  onToggleChat,
}) => {
  const { adminLevel } = useAuth();
  if (isMobile) {
    return null;
  }

  return (
    <div
      className="w-full flex items-center gap-3 rounded-2xl border p-2.5 transition-all duration-300 select-none relative"
      style={{
        background: 'var(--frost-card-framework-bg)',
        borderColor: 'var(--frost-card-framework-border)',
        boxShadow: 'var(--frost-card-framework-shadow)',
        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
      }}
    >
      {/* 简体中文：头像按钮区域 (高度与右侧资产齐平) */}
      <div className="relative flex-shrink-0">
        <button
          data-testid="desktop-user-menu-trigger"
          onClick={(event) => {
            event.stopPropagation();
            setShowUserMenu((prev) => !prev);
          }}
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-all active:scale-95"
          style={{
            background: 'var(--frost-card-sub-bg)',
            borderColor: 'var(--frost-card-sub-border)',
            boxShadow: 'var(--frost-card-sub-shadow)',
          }}
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
          className={`absolute -right-0.5 -top-0.5 z-10 h-3.5 w-3.5 rounded-full border-2 shadow-lg ${apiStatus === 'success' ? 'bg-green-500' : apiStatus === 'error' ? 'bg-red-500' : 'bg-zinc-500'}`}
          style={{ borderColor: 'var(--bg-canvas)' }}
        />
      </div>

      {/* 简体中文：右侧资产展示 & 充值模块 (高度与左侧头像一致，均为 40px 水平居中对齐) */}
      {billingUiEnabled && (
        <div className="flex-1 flex items-center justify-between gap-1.5 h-10">
          <div className="flex flex-col items-start leading-none justify-center">
            <div className="flex items-center gap-0.5 select-none">
              <span className="text-[16px] font-mono font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {remainingBalanceDisplay}
              </span>
              <span className="text-[10px] font-bold text-[var(--accent-coral)]">积分</span>
            </div>
          </div>

          <button
            onClick={onRecharge}
            className="inline-flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-black leading-none text-white transition-all active:scale-95 hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, var(--accent-coral) 0%, #ff5240 100%)',
              boxShadow: '0 4px 12px rgba(255, 107, 90, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '32px',
            }}
          >
            充值
          </button>
        </div>
      )}

      {/* 简体中文：用户下拉菜单弹出容器 - 改为 left-0 并向下平移，完美配合左侧等宽面板 */}
      {showUserMenu ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
          <div
            id="desktop-user-menu-panel"
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-[72px] z-50 w-64 origin-top-left animate-in rounded-xl border p-2 duration-100 fade-in zoom-in-95"
            style={{
              background: 'color-mix(in srgb, var(--frost-card-framework-bg) 94%, var(--bg-canvas) 6%)',
              borderColor: 'var(--frost-card-framework-border)',
              boxShadow: 'var(--frost-card-framework-shadow)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            }}
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
                    window.history.pushState({}, '', '/admin');
                    window.dispatchEvent(new PopStateEvent('popstate'));
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
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 outline-none"
              >
                <div className="rounded-lg bg-red-500/10 p-1.5">
                  <LogOut size={14} />
                </div>
                退出登录
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AppDesktopChrome;
