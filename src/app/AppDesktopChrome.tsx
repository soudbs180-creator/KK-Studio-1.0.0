import React from 'react';
import { LayoutDashboard, LogOut, Sparkles, User, Zap } from 'lucide-react';

import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';

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
  if (isMobile) {
    return null;
  }

  return (
    <>
      {billingUiEnabled && (
        <div className="absolute top-4 left-4 z-[100] flex items-center gap-2">
          <div
            className="flex items-center gap-3 rounded-full border px-4 py-2 shadow-2xl backdrop-blur-md transition-all hover:border-[var(--border-medium)] group"
            style={{
              background: 'var(--floating-shell-bg)',
              borderColor: 'var(--floating-shell-border)',
              boxShadow: 'var(--floating-shell-shadow)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles size={18} fill="currentColor" className="text-blue-500" />
              <div className="flex items-center select-none gap-1">
                <span className="min-w-[20px] text-[18px] font-mono font-bold leading-none drop-shadow-sm" style={{ color: 'var(--text-primary)' }}>
                  {remainingBalanceDisplay}
                </span>
                <span className="text-[14px] font-bold leading-none text-blue-400">积分</span>
              </div>
            </div>
            <div className="h-6 w-px" style={{ backgroundColor: 'var(--floating-shell-border)' }} />
            <button
              onClick={onRecharge}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-3 py-1 text-[11px] font-bold leading-none text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 hover:bg-indigo-400"
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
            className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 shadow-2xl transition-all active:scale-95"
            style={{ borderColor: 'var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-500 text-sm font-bold text-white">
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
                className="absolute right-0 top-12 z-50 w-64 origin-top-right animate-in rounded-xl border p-2 shadow-2xl duration-100 fade-in zoom-in-95"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}
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
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-indigo-500 font-bold text-white">
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
                    accentColor="var(--accent-blue)"
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
                    accentColor="var(--accent-purple)"
                    testId="desktop-user-menu-settings"
                    onClick={() => {
                      onOpenSettings();
                      setShowUserMenu(false);
                    }}
                  />

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

      <div
        className="absolute bottom-6 z-50 hidden transition-all duration-300 md:block"
        style={{ right: rightOffset }}
      >
        <button
          id="chat-trigger-button"
          className="ai-chat-btn relative flex aspect-square h-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-transparent p-2 text-xs transition-all duration-300 hover:scale-110 hover:shadow-[0_0_35px] hover:shadow-blue-400/80 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onToggleChat}
          aria-pressed={isChatOpen}
        >
          <div className="uiverse visible absolute left-0 top-0 z-[-1] h-full w-full">
            <div className="circle circle-12"></div>
            <div className="circle circle-11"></div>
            <div className="circle circle-10"></div>
            <div className="circle circle-9"></div>
            <div className="circle circle-8"></div>
            <div className="circle circle-7"></div>
            <div className="circle circle-6"></div>
            <div className="circle circle-5"></div>
            <div className="circle circle-4"></div>
            <div className="circle circle-3"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-1"></div>
          </div>
          <div className="absolute inset-0 z-[1] rounded-full bg-blue-500/15"></div>
          <svg
            className="ai-chat-icon relative z-10"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="rgba(255, 255, 255, 0.95)"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))' }}
          >
            <path d="M11.6061 4.23218C11.6838 3.79153 12.3162 3.79153 12.3939 4.23218L12.5268 4.98521C13.1111 8.29642 15.7036 10.8889 19.0148 11.4732L19.7678 11.6061C20.2085 11.6838 20.2085 12.3162 19.7678 12.3939L19.0148 12.5268C15.7036 13.1111 13.1111 15.7036 12.5268 19.0148L12.3939 19.7678C12.3162 20.2085 11.6838 20.2085 11.6061 19.7678L11.4732 19.0148C10.8889 15.7036 8.29642 13.1111 4.98521 12.5268L4.23218 12.3939C3.79153 12.3162 3.79153 11.6838 4.23218 11.6061L4.98521 11.4732C8.29642 10.8889 10.8889 8.29642 11.4732 4.98521L11.6061 4.23218Z" fill="rgba(255, 255, 255, 0.95)"></path>
          </svg>
          <style>{`
            .ai-chat-icon {
              transition: transform 0.7s ease-out;
            }
            .ai-chat-btn:hover .ai-chat-icon {
              transform: rotate(90deg);
            }
            .ai-chat-btn:hover .uiverse .circle {
              animation-duration: calc(var(--duration) / 3) !important;
            }
          `}</style>
        </button>
      </div>
    </>
  );
};

export default AppDesktopChrome;
