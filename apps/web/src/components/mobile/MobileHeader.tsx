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
    const iconButtonClass = 'h-12 w-12 rounded-[16px] flex items-center justify-center border transition-all active:scale-95';
    const handleRechargeClick = onRechargeClick ?? onBillingClick;
    const avatarFallback = resolvedUserName?.trim()?.[0]?.toUpperCase() || 'U';
    const maxCredits = 999999;
    const normalizedBalance = normalizeRemainingCredits(rawBalance);
    const balance = Math.min(normalizedBalance, maxCredits);
    const balanceDisplay = balanceLoading ? '...' : formatRemainingCredits(balance, language === 'zh-CN' ? 'zh-CN' : 'en-US');
    const resolvedAvatarUrl = resolveAvatarUrl(userAvatarUrl);

    return (
        <div className="w-full lg:hidden">
            <div
                className="ios-mobile-header-glass rounded-[20px] border p-2"
                style={{
                    background: 'var(--mobile-clay-shell-bg)',
                    borderColor: 'var(--mobile-clay-border)',
                    boxShadow: 'var(--mobile-clay-shadow)'
                }}
            >
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onUserClick}
                        aria-label={pick('打开个人中心', 'Open Profile')}
                        className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[16px] border px-2.5 text-left transition-[background-color,border-color]"
                        style={{
                            background: 'var(--mobile-clay-surface-bg)',
                            borderColor: 'var(--mobile-clay-border)'
                        }}
                        title={resolvedUserName}
                    >
                        <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, var(--clay-brand-coral), var(--clay-brand-pink))' }}
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
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-1 py-0.5 text-[7px] font-bold text-red-400 tracking-wider scale-90 origin-left">
                                                {pick('管理员', 'Admin')}
                                            </span>
                                        );
                                    }
                                    if (role.startsWith('member')) {
                                        return (
                                            <span className="shrink-0 inline-flex items-center rounded-full bg-amber-500/10 border border-amber-400/20 px-1 py-0.5 text-[7px] font-bold text-amber-400 tracking-wider scale-90 origin-left">
                                                {pick('高级会员', 'Pro Member')}
                                            </span>
                                        );
                                    }
                                    return (
                                        <span className="shrink-0 inline-flex items-center rounded-full bg-slate-500/10 border border-slate-500/15 px-1 py-0.5 text-[7px] font-bold text-slate-400 tracking-wider scale-90 origin-left">
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
                        className="flex h-12 shrink-0 items-center gap-1.5 rounded-[16px] border px-2.5 transition-all active:scale-95 disabled:opacity-55"
                        style={{
                            background: 'var(--mobile-clay-surface-bg)',
                            borderColor: 'var(--mobile-clay-border)'
                        }}
                        disabled={!handleRechargeClick}
                    >
                        <span className="inline-flex items-center gap-0.5 shrink-0 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
                            <Sparkles size={9} className="text-amber-300 animate-pulse" />
                            {pick('积分', 'Credits')}
                        </span>
                        <span className="text-[12px] font-bold text-[var(--text-primary)] truncate font-variant-numeric: tabular-nums whitespace-nowrap">
                            {balanceDisplay}
                        </span>
                    </button>
 
                    <button
                        type="button"
                        onClick={onMenuClick}
                        data-testid="mobile-header-menu-button"
                        aria-label={pick('打开功能菜单', 'Open Menu')}
                        className={`${iconButtonClass} shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}
                        style={{
                            background: 'var(--mobile-clay-surface-bg)',
                            borderColor: 'var(--mobile-clay-border)'
                        }}
                    >
                        <Menu size={16} strokeWidth={2.15} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileHeader;
