import React from 'react';
import { Images, MessageSquare, Sparkles, User } from 'lucide-react';
import { GenerationMode, type MobilePrimaryTab } from '../../types';

interface MobileTabBarProps {
  currentMode: GenerationMode;
  currentTab: MobilePrimaryTab;
  onSelectTab: (tab: MobilePrimaryTab) => void;
  isVisible?: boolean;
  onInteract?: () => void;
}

const modeLabelMap: Record<GenerationMode, string> = {
  [GenerationMode.IMAGE]: '图片',
  [GenerationMode.VIDEO]: '视频',
  [GenerationMode.ECOMMERCE]: '电商',
  [GenerationMode.AUDIO]: '音频',
  [GenerationMode.PPT]: 'PPT',
  [GenerationMode.EDIT]: '编辑',
  [GenerationMode.INPAINT]: '局部',
  [GenerationMode.REDRAW]: '重绘',
};

const MobileTabBar: React.FC<MobileTabBarProps> = ({
  currentMode,
  currentTab,
  onSelectTab,
  isVisible = true,
  onInteract,
}) => {
  const tabs: Array<{
    key: MobilePrimaryTab;
    label: string;
    caption?: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'create',
      label: '创作',
      caption: modeLabelMap[currentMode],
      icon: <Sparkles size={18} strokeWidth={2.1} />,
    },
    {
      key: 'library',
      label: '资源',
      icon: <Images size={18} strokeWidth={2.1} />,
    },
    {
      key: 'chat',
      label: '聊天',
      icon: <MessageSquare size={18} strokeWidth={2.1} />,
    },
    {
      key: 'me',
      label: '我的',
      icon: <User size={18} strokeWidth={2.1} />,
    },
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[940] transition-transform duration-300 ease-out md:hidden ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[140%] opacity-0'}`}
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))' }}
      onTouchStart={onInteract}
      onClick={onInteract}
    >
      <div id="mobile-tab-bar" className="ios-mobile-tabbar-shell mx-3 px-2 py-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(tab.key)}
                className={`ios-mobile-tab-button flex min-h-[54px] flex-col items-center justify-center gap-1 px-2 py-2 ${isActive ? 'is-active' : ''}`}
                style={{ color: isActive ? '#ffffff' : 'var(--text-tertiary)' }}
              >
                {tab.icon}
                <span className="ios-mobile-tab-label">{tab.label}</span>
                {tab.caption ? (
                  <span className={`ios-mobile-tab-caption text-[10px] leading-none ${isActive ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                    {tab.caption}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileTabBar;
