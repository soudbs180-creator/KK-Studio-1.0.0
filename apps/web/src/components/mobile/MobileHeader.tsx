import React from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { resolveAvatarUrl } from '../../utils/presetAvatars';

interface MobileHeaderProps {
    onMenuClick: () => void;
    onDashboardClick?: () => void;
    onSettingsClick?: () => void;
    onUserClick: () => void;
    onBillingClick?: () => void;
    onRechargeClick?: () => void;
    balance?: number;
    balanceLoading?: boolean;
    title?: string;
    userName?: string;
    userAvatarUrl?: string;
    userRole?: string;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
    onMenuClick,
    onUserClick,
    onBillingClick,
    onRechargeClick,
    balance,
    balanceLoading = false,
    title = 'KK Studio',
    userName = '\u7528\u6237',
    userAvatarUrl,
    userRole = 'user',
}) => {
    const iconButtonClass = 'h-10 w-10 rounded-2xl flex items-center justify-center border transition-all active:scale-95';
    const handleRechargeClick = onRechargeClick ?? onBillingClick;
    const avatarFallback = userName?.trim()?.[0]?.toUpperCase() || 'U';
    const balanceDisplay = balanceLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');
    const resolvedAvatarUrl = resolveAvatarUrl(userAvatarUrl);

    return (
        <div className="w-full lg:hidden">
            <div
                className="ios-mobile-header-glass rounded-[30px] border px-3 py-3"
                style={{
                    background: 'var(--mobile-clay-shell-bg)',
                    borderColor: 'var(--mobile-clay-border)',
                    boxShadow: 'var(--mobile-clay-shadow)'
                }}
            >
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onUserClick}
                        aria-label="\u6253\u5f00\u4e2a\u4eba\u4e2d\u5fc3"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-[22px] border px-2.5 py-2.5 text-left transition-[background-color,border-color]"
                        style={{
                            background: 'var(--mobile-clay-surface-bg)',
                            borderColor: 'var(--mobile-clay-border)'
                        }}
                        title={userName}
                    >
                        <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[18px] text-sm font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, var(--clay-brand-coral), var(--clay-brand-pink))' }}
                        >
                            {resolvedAvatarUrl ? (
                                <img src={resolvedAvatarUrl} alt={userName} className="h-full w-full object-cover" />
                            ) : (
                                <span>{avatarFallback}</span>
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] leading-tight">
                                {title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 min-w-0">
                                <span className="truncate text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                                    {userName}
                                </span>
                                {(() => {
                                    const role = String(userRole || 'user').toLowerCase();
                                    if (role === 'admin') {
                                        return (
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[8px] font-bold text-red-400 tracking-wider scale-90 origin-left">
                                                管理员
                                            </span>
                                        );
                                    }
                                    if (role.startsWith('member')) {
                                        return (
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-amber-500/10 border border-amber-400/20 px-1.5 py-0.5 text-[8px] font-bold text-amber-400 tracking-wider scale-90 origin-left">
                                                高级会员
                                            </span>
                                        );
                                    }
                                    return (
                                        <span className="shrink-0 inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/15 px-1.5 py-0.5 text-[8px] font-bold text-slate-400 tracking-wider scale-90 origin-left">
                                            普通用户
                                        </span>
                                    );
                                })()}
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRechargeClick}
                        data-testid="mobile-header-credit-chip"
                        aria-label="\u67e5\u770b\u79ef\u5206"
                        className="inline-flex min-w-[92px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[20px] border px-3 py-2 text-left text-[var(--text-primary)] transition-all active:scale-95 disabled:opacity-55"
                        style={{
                            background: 'var(--mobile-clay-surface-bg)',
                            borderColor: 'var(--mobile-clay-border)'
                        }}
                        disabled={!handleRechargeClick}
                    >
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                            <Sparkles size={12} className="text-amber-300" />
                            {'\u79ef\u5206'}
                        </span>
                        <span className="text-[15px] font-semibold leading-none">{balanceDisplay}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onMenuClick}
                        data-testid="mobile-header-menu-button"
                        aria-label="\u6253\u5f00\u529f\u80fd\u83dc\u5355"
                        className={`${iconButtonClass} shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                        style={{
                            background: 'var(--mobile-clay-surface-bg)',
                            borderColor: 'var(--mobile-clay-border)'
                        }}
                    >
                        <Menu size={18} strokeWidth={2.15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileHeader;
