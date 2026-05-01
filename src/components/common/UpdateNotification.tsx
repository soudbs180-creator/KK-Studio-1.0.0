import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp } from 'lucide-react';

const UpdateNotification: React.FC = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const applyUpdateRef = useRef<null | (() => void)>(null);

    useEffect(() => {
        let isMounted = true;
        let unsubscribe: (() => void) | undefined;

        import('../../services/system/updateCheck').then(({ applyUpdate, subscribeToUpdates }) => {
            if (!isMounted) {
                return;
            }

            applyUpdateRef.current = applyUpdate;
            unsubscribe = subscribeToUpdates((available) => {
                setShowUpdate(available);
            });
        });

        return () => {
            isMounted = false;
            unsubscribe?.();
        };
    }, []);

    const handleApplyUpdate = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.currentTarget.blur();
        applyUpdateRef.current?.();
    }, []);

    if (!showUpdate) return null;

    return (
        <button
            onClick={handleApplyUpdate}
            className="group animate-in fade-in zoom-in duration-300 outline-none focus:outline-none"
        >
            <div
                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 transition-all"
                style={{
                    background: 'var(--frost-card-framework-bg)',
                    borderColor: 'var(--frost-card-framework-border)',
                    boxShadow: 'var(--frost-card-framework-shadow)',
                    WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
                    backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)'
                }}
            >
                <Sparkles size={12} className="animate-pulse" style={{ color: 'var(--clay-brand-pink)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>新版本可用</span>
                <ArrowUp size={12} style={{ color: 'var(--clay-brand-coral)' }} />
            </div>
        </button>
    );
};

export default UpdateNotification;
