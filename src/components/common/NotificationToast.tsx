import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Copy, Check } from 'lucide-react';
import { notificationService, Notification, NotificationType } from '../../services/system/notificationService';
import { writeTextToClipboard } from '../../utils/clipboard';
import { useLocale } from '../../context/LocaleContext';

const NotificationToast: React.FC = () => {
    const { pick } = useLocale();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setNotifications(notificationService.getAll());
        return notificationService.subscribe(setNotifications);
    }, []);

    const handleCopyDetails = async (notification: Notification) => {
        const text = `[${notification.type.toUpperCase()}] ${notification.title}\n${notification.message}${notification.details ? `\n\n${pick('详情', 'Details')}: ${notification.details}` : ''}`;
        try {
            await writeTextToClipboard(text);
            setCopiedId(notification.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (error) {
            console.error('[NotificationToast] Copy failed:', error);
            notificationService.warning('复制失败', '当前环境无法复制通知详情。');
        }
    };

    const getIcon = (type: NotificationType) => {
        const iconStyle = { color: getIconColor(type) };
        switch (type) {
            case 'success': return <CheckCircle size={18} style={iconStyle} />;
            case 'error': return <AlertCircle size={18} style={iconStyle} />;
            case 'warning': return <AlertTriangle size={18} style={iconStyle} />;
            case 'info': return <Info size={18} style={iconStyle} />;
            case 'alipay': return <Info size={18} style={iconStyle} />;
            case 'wechat': return <Info size={18} style={iconStyle} />;
            case 'paypal': return <Info size={18} style={iconStyle} />;
        }
    };

    const getIconColor = (type: NotificationType): string => {
        switch (type) {
            case 'success': return 'var(--clay-brand-mint)';
            case 'error': return 'var(--clay-brand-coral)';
            case 'warning': return 'var(--clay-brand-ochre)';
            case 'info': return 'var(--clay-brand-pink)';
            case 'alipay': return 'var(--clay-brand-lavender)';
            case 'wechat': return 'var(--clay-brand-teal)';
            case 'paypal': return 'var(--clay-brand-peach)';
        }
    };

    const getStyles = (type: NotificationType) => {
        switch (type) {
            case 'success': return { borderColor: 'color-mix(in srgb, var(--clay-brand-mint) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-mint) 12%, var(--frost-card-framework-bg))' };
            case 'error': return { borderColor: 'color-mix(in srgb, var(--clay-brand-coral) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-coral) 12%, var(--frost-card-framework-bg))' };
            case 'warning': return { borderColor: 'color-mix(in srgb, var(--clay-brand-ochre) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-ochre) 12%, var(--frost-card-framework-bg))' };
            case 'info': return { borderColor: 'color-mix(in srgb, var(--clay-brand-pink) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-pink) 12%, var(--frost-card-framework-bg))' };
            case 'alipay': return { borderColor: 'color-mix(in srgb, var(--clay-brand-lavender) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-lavender) 12%, var(--frost-card-framework-bg))' };
            case 'wechat': return { borderColor: 'color-mix(in srgb, var(--clay-brand-teal) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-teal) 12%, var(--frost-card-framework-bg))' };
            case 'paypal': return { borderColor: 'color-mix(in srgb, var(--clay-brand-peach) 32%, var(--frost-card-framework-border))', backgroundColor: 'color-mix(in srgb, var(--clay-brand-peach) 12%, var(--frost-card-framework-bg))' };
        }
    };

    const sortedNotifications = [...notifications].sort((a, b) => {
        const score = (t: string) => (t === 'error' ? 3 : t === 'warning' ? 2 : 1);
        return score(a.type) - score(b.type) || a.timestamp - b.timestamp;
    });

    return (
        <>
            {sortedNotifications.length > 0 && (
                <div className="fixed z-[99999] flex w-full max-w-[400px] flex-col gap-3 pointer-events-none top-[max(16px,env(safe-area-inset-top))] left-4 right-4 bottom-auto md:top-auto md:bottom-20 md:left-4 md:right-auto md:flex-col-reverse">
                    <div className="flex flex-col gap-3 pointer-events-auto md:flex-col-reverse" onMouseEnter={() => setIsExpanded(true)} onMouseLeave={() => setIsExpanded(false)}>
                        {sortedNotifications.map((notification, index) => {
                            const isTop = index === sortedNotifications.length - 1;
                            const isCollapsed = !isExpanded && !isTop;
                            const styles = getStyles(notification.type);

                            return (
                                <div
                                    key={notification.id}
                                    className={`animate-slide-in-right overflow-hidden transition-all ease-out ${isCollapsed ? '-mb-20 scale-[0.95] opacity-85 pointer-events-none' : 'mb-2 scale-100 opacity-100'} ${isTop && !isExpanded ? '!mb-0 !opacity-100 !scale-100 pointer-events-auto' : ''} hover:!scale-[1.02]`}
                                    style={{
                                        borderRadius: 'var(--radius-md)',
                                        borderWidth: '1px',
                                        borderColor: styles.borderColor,
                                        backgroundColor: styles.backgroundColor,
                                        boxShadow: 'var(--frost-card-framework-shadow)',
                                        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                                        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                                        transitionDuration: 'var(--duration-normal)'
                                    }}
                                >
                                    <div className="flex items-start gap-3 p-4">
                                        <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border" style={{ background: 'var(--frost-card-sub-bg)', borderColor: 'var(--frost-card-sub-border)' }}>
                                            {getIcon(notification.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold leading-snug tracking-wide" style={{ color: 'var(--text-primary)' }}>
                                                {notification.title}
                                            </div>
                                            <div className="mt-1.5 text-xs font-medium leading-relaxed break-words opacity-90" style={{ color: 'var(--text-secondary)' }}>
                                                {notification.message}
                                            </div>
                                            {notification.details && (
                                                <div className="mt-2 overflow-hidden rounded border p-2 text-[10px] font-mono line-clamp-3" style={{ color: 'var(--text-tertiary)', background: 'var(--frost-card-sub-bg)', borderColor: 'var(--frost-card-sub-border)' }}>
                                                    {notification.details}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 flex-col gap-1">
                                            <button
                                                onClick={() => notificationService.dismiss(notification.id)}
                                                className="p-1.5 transition-all active:scale-95"
                                                style={{ color: 'var(--text-tertiary)', borderRadius: 'var(--radius-sm)', transitionDuration: 'var(--duration-fast)' }}
                                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)')}
                                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <X size={14} />
                                            </button>
                                            {notification.details && (
                                                <button
                                                    onClick={() => handleCopyDetails(notification)}
                                                    className="p-1.5 transition-all active:scale-95"
                                                    style={{ color: 'var(--text-tertiary)', borderRadius: 'var(--radius-sm)', transitionDuration: 'var(--duration-fast)' }}
                                                    title={pick('复制详细信息', 'Copy details')}
                                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--frost-card-sub-bg)')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                >
                                                    {copiedId === notification.id ? <Check size={14} style={{ color: 'var(--clay-brand-mint)' }} /> : <Copy size={14} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
};

export default NotificationToast;
