import React from 'react';
import { KK_LAYER } from '@kk/ui';
import { Settings, User, X } from 'lucide-react';

interface MobileMoreMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
    onOpenProfile: () => void;
}

const MobileMoreMenu: React.FC<MobileMoreMenuProps> = ({
    isOpen,
    onClose,
    onOpenSettings,
    onOpenProfile
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex flex-col justify-end"
            data-kk-mobile-overlay-layer="true"
            style={{ zIndex: KK_LAYER.modalBackdrop }}
        >
            {/* Backdrop */}
            <div
                className="kk-mobile-more-menu-backdrop absolute inset-0 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Menu Sheet */}
            <div className="kk-mobile-more-menu-sheet relative rounded-t-3xl border-t p-4 pb-safe animate-in slide-in-from-bottom duration-300">
                <div className="kk-mobile-more-menu-header flex items-center justify-between mb-4 pb-3">
                    <span className="kk-mobile-more-menu-title text-lg">更多功能</span>
                    <button onClick={onClose} className="kk-mobile-more-menu-close min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg transition-all">
                        <X size={22} strokeWidth={2} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* Settings */}
                    <button
                        onClick={() => {
                            onOpenSettings();
                            onClose();
                        }}
                        className="kk-mobile-more-menu-action flex flex-col items-center gap-2 min-w-[44px] min-h-[72px] p-2 rounded-xl transition-all group"
                    >
                        <div className="kk-mobile-more-menu-icon w-14 h-14 rounded-2xl flex items-center justify-center transition-colors">
                            <Settings size={24} strokeWidth={2} />
                        </div>
                        <span className="kk-mobile-more-menu-label text-[11px] leading-none">设置</span>
                    </button>

                    {/* Profile */}
                    <button
                        onClick={() => {
                            onOpenProfile();
                            onClose();
                        }}
                        className="kk-mobile-more-menu-action flex flex-col items-center gap-2 min-w-[44px] min-h-[72px] p-2 rounded-xl transition-all group"
                    >
                        <div className="kk-mobile-more-menu-icon w-14 h-14 rounded-2xl flex items-center justify-center transition-colors">
                            <User size={24} strokeWidth={2} />
                        </div>
                        <span className="kk-mobile-more-menu-label text-[11px] leading-none">我的</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileMoreMenu;
