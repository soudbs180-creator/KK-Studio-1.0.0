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
}) => {
    const iconButtonClass = 'h-10 w-10 rounded-2xl flex items-center justify-center transition-all active:scale-95 hover:bg-white/10';
    const handleRechargeClick = onRechargeClick ?? onBillingClick;
    const avatarFallback = userName?.trim()?.[0]?.toUpperCase() || 'U';
    const balanceDisplay = balanceLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');
    const resolvedAvatarUrl = resolveAvatarUrl(userAvatarUrl);

    return (
        <div className="w-full lg:hidden">
            <div className="ios-mobile-header-glass rounded-[30px] border border-white/10 bg-[rgba(15,18,28,0.88)] px-3 py-3 shadow-[0_22px_44px_rgba(2,6,23,0.28)] backdrop-blur-2xl">
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onUserClick}
                        aria-label="\u6253\u5f00\u4e2a\u4eba\u4e2d\u5fc3"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-2.5 py-2.5 text-left"
                        title={userName}
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white/10 text-sm font-bold text-white">
                            {resolvedAvatarUrl ? (
                                <img src={resolvedAvatarUrl} alt={userName} className="h-full w-full object-cover" />
                            ) : (
                                <span>{avatarFallback}</span>
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100/70">
                                {title}
                            </span>
                            <span className="mt-1 block truncate text-[15px] font-semibold text-white">
                                {userName}
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRechargeClick}
                        data-testid="mobile-header-credit-chip"
                        aria-label="\u67e5\u770b\u79ef\u5206"
                        className="inline-flex min-w-[92px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[20px] border border-white/10 bg-white/6 px-3 py-2 text-left text-white transition-all active:scale-95 disabled:opacity-55"
                        disabled={!handleRechargeClick}
                    >
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
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
                        className={`${iconButtonClass} shrink-0 border border-white/10 bg-white/6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                    >
                        <Menu size={18} strokeWidth={2.15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileHeader;
