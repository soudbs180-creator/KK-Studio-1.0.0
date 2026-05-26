import React from 'react';
import { LayoutDashboard, LogOut, Sparkles, User, Zap } from 'lucide-react';

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
    <>
      {billingUiEnabled && (
        <div className="absolute top-4 left-4 z-[100] flex items-center gap-2">
          <div
            className="group flex items-center gap-3 rounded-full border px-4 py-2 transition-all hover:border-[var(--frost-card-framework-border)]"
            style={{
              background: 'var(--frost-card-framework-bg)',
              borderColor: 'var(--frost-card-framework-border)',
              boxShadow: 'var(--frost-card-framework-shadow)',
              backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
              WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles size={18} fill="currentColor" className="text-[var(--accent-coral)]" />
              <div className="flex items-center select-none gap-1">
                <span className="min-w-[20px] text-[18px] font-mono font-bold leading-none drop-shadow-sm" style={{ color: 'var(--text-primary)' }}>
                  {remainingBalanceDisplay}
                </span>
                <span className="text-[14px] font-bold leading-none text-[var(--accent-coral)]">积分</span>
              </div>
            </div>
            <div className="h-6 w-px" style={{ backgroundColor: 'var(--floating-shell-border)' }} />
            <button
              onClick={onRecharge}
              className="inline-flex items-center justify-center rounded-lg px-3 py-1 text-[11px] font-bold leading-none text-white transition-all active:scale-95"
              style={{
                background: 'var(--accent-coral)',
                boxShadow: '0 8px 18px rgb(255 107 90 / 0.18)',
              }}
            >
              充值
            </button>
          </div>
        </div>
      )}

      <div
        id="header-user-menu"
        className="absolute top-4 z-[100] hidden items-center gap-3 transition-all duration-300 md:flex"
        style={{ right: rightOffset }}
      >
        <div className="relative group">
          <button
            data-testid="desktop-user-menu-trigger"
            onClick={() => setShowUserMenu((prev) => !prev)}
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

          <div
            className={`absolute -right-0.5 -top-0.5 z-10 h-3.5 w-3.5 rounded-full border-2 shadow-lg ${apiStatus === 'success' ? 'bg-green-500' : apiStatus === 'error' ? 'bg-red-500' : 'bg-zinc-500'}`}
            style={{ borderColor: 'var(--bg-canvas)' }}
          />

          {showUserMenu ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div
                className="absolute right-0 top-12 z-50 w-64 origin-top-right animate-in rounded-xl border p-2 duration-100 fade-in zoom-in-95"
                style={{
                  background: 'var(--frost-card-framework-bg)',
                  borderColor: 'var(--frost-card-framework-border)',
                  boxShadow: 'var(--frost-card-framework-shadow)',
                  backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                  WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                }}
              >
                <div
                  className="group mb-2 cursor-pointer rounded-lg border-b px-3 py-3 transition-colors"
                  style={{ borderColor: 'var(--border-light)' }}
                  onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = 'var(--toolbar-hover)'; }}
                  onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = 'transparent'; }}
                  onClick={() => {
                    onOpenProfile('main');
                    setShowUserMenu(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-coral)] font-bold text-white">
                      {avatarUrl ? (
                        <img src={avatarUrl} className="h-full w-full object-cover" />
                      ) : user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {user?.user_metadata?.full_name || '用户'}
                      </div>
                      <div className="truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {user?.email}
                      </div>
                    </div>
                  </div>
                </div>

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
                    icon={<Zap size={14} />}
                    label="账号管理"
                    accentColor="var(--accent-yellow)"
                    onClick={() => {
                      onOpenProfile('billing');
                      setShowUserMenu(false);
                    }}
                  />
                  <DesktopMenuActionButton
                    icon={<LayoutDashboard size={14} />}
                    label="设置"
                    accentColor="var(--clay-brand-lavender)"
                    testId="desktop-user-menu-settings"
                    onClick={() => {
                      onOpenSettings();
                      setShowUserMenu(false);
                    }}
                  />

                  {adminLevel > 0 && (
                    <DesktopMenuActionButton
                      icon={<LayoutDashboard size={14} />}
                      label="管理后台"
                      accentColor="var(--clay-brand-coral)"
                      onClick={() => {
                        window.location.href = "/admin";
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
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
      </div>


    </>
  );
};

export default AppDesktopChrome;
