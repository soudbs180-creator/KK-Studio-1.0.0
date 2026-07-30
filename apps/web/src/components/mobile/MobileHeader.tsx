import React from 'react';
import { Menu, Sparkles } from 'lucide-react';
import { formatRemainingCredits, normalizeRemainingCredits } from '../../services/billing/remainingBalance';
import { resolveAvatarUrl } from '../../utils/presetAvatars';
import { useLocale } from '../../context/LocaleContext';

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
    balance: rawBalance,
    balanceLoading = false,
    title = 'KK Studio',
    userName = '用户',
    userAvatarUrl,
    userRole = 'user',
}) => {
    const { pick, language } = useLocale();
    const resolvedUserName = userName || pick('用户', 'User');
    const iconButtonClass = 'h-12 w-12 rounded-[10px] flex items-center justify-center border transition-colors';
    const handleRechargeClick = onRechargeClick ?? onBillingClick;
    const avatarFallback = resolvedUserName?.trim()?.[0]?.toUpperCase() || 'U';
    const maxCredits = 999999;
    const normalizedBalance = normalizeRemainingCredits(rawBalance);
    const balance = Math.min(normalizedBalance, maxCredits);
    const balanceDisplay = balanceLoading ? '...' : formatRemainingCredits(balance, language === 'zh-CN' ? 'zh-CN' : 'en-US');
    const resolvedAvatarUrl = resolveAvatarUrl(userAvatarUrl);

    return (
        <div className="mobile-header w-full lg:hidden">
            <div
                className="kk-mobile-header-surface ios-mobile-header-glass rounded-[14px] border p-2"
            >
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onUserClick}
                        aria-label={pick('打开个人中心', 'Open Profile')}
                        className="kk-mobile-header-control flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[10px] border px-2.5 text-left transition-[background-color,border-color]"
                        title={resolvedUserName}
                    >
                        <span
                            className="kk-mobile-avatar flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[8px] text-xs font-bold text-white"
                        >
                            {resolvedAvatarUrl ? (
                                <img src={resolvedAvatarUrl} alt={resolvedUserName} className="h-full w-full object-cover" />
                            ) : (
                                <span>{avatarFallback}</span>
                            )}
                        </span>
                        <span className="min-w-0 flex-1 flex flex-col justify-center">
                            <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)] leading-tight">
                                {resolvedUserName}
                            </span>
                            <span className="mt-0.5 flex items-center min-w-0">
                                {(() => {
                                    const role = String(userRole || 'user').toLowerCase();
                                    if (role === 'admin') {
                                        return (
                                            <span className="kk-mobile-user-role shrink-0 inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-1.5 text-red-400">
                                                {pick('管理员', 'Admin')}
                                            </span>
                                        );
                                    }
                                    if (role.startsWith('member')) {
                                        return (
                                            <span className="kk-mobile-user-role shrink-0 inline-flex items-center rounded-full bg-amber-500/10 border border-amber-400/20 px-1.5 text-amber-400">
                                                {pick('高级会员', 'Pro Member')}
                                            </span>
                                        );
                                    }
                                    return (
                                        <span className="kk-mobile-user-role shrink-0 inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/15 px-1.5 text-slate-400">
                                            {pick('普通用户', 'Standard User')}
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
                        aria-label={pick('查看积分', 'View Credits')}
                        className="kk-mobile-header-control flex h-12 shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 transition-colors disabled:opacity-55"
                        disabled={!handleRechargeClick}
                    >
                        <span className="inline-flex items-center gap-0.5 shrink-0 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
                            <Sparkles size={9} className="text-amber-300 animate-pulse" />
                            {pick('积分', 'Credits')}
                        </span>
                        <span className="truncate whitespace-nowrap text-[12px] font-bold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
                            {balanceDisplay}
                        </span>
                    </button>
 
                    <button
                        type="button"
                        onClick={onMenuClick}
                        data-testid="mobile-header-menu-button"
                        aria-label={pick('打开功能菜单', 'Open Menu')}
                        className={`kk-mobile-header-control ${iconButtonClass} shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                    >
                        <Menu size={16} strokeWidth={2.15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileHeader;
