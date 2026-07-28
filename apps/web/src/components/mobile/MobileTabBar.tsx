import React, { useMemo } from 'react';
import { KK_LAYER } from '@kk/ui';
import { Images, LayoutTemplate, MessageSquare, Sparkles } from 'lucide-react';
import { GenerationMode, type MobilePrimaryTab } from '../../types';
import { useLocale } from '../../context/LocaleContext';

interface MobileTabBarProps {
  currentMode: GenerationMode;
  currentTab: MobilePrimaryTab;
  onSelectTab: (tab: MobilePrimaryTab) => void;
  isVisible?: boolean;
  onInteract?: () => void;
}

const MobileTabBar: React.FC<MobileTabBarProps> = ({
  currentMode,
  currentTab,
  onSelectTab,
  isVisible = true,
  onInteract,
}) => {
  const { pick } = useLocale();

  const modeLabelMap: Record<GenerationMode, string> = useMemo(() => ({
    [GenerationMode.IMAGE]: pick('图片', 'Image'),
    [GenerationMode.VIDEO]: pick('视频', 'Video'),
    [GenerationMode.ECOMMERCE]: pick('电商', 'E-commerce'),
    [GenerationMode.AUDIO]: pick('音频', 'Audio'),
    [GenerationMode.PPT]: pick('PPT', 'PPT'),
    [GenerationMode.EDIT]: pick('编辑', 'Edit'),
    [GenerationMode.INPAINT]: pick('局部', 'Inpaint'),
    [GenerationMode.REDRAW]: pick('重绘', 'Redraw'),
  }), [pick]);

  const tabs = useMemo(() => [
    {
      key: 'create' as const,
      label: pick('创作', 'Create'),
      caption: modeLabelMap[currentMode],
      icon: <Sparkles size={18} strokeWidth={2.1} />,
    },
    {
      key: 'canvas' as const,
      label: pick('画布', 'Canvas'),
      icon: <LayoutTemplate size={18} strokeWidth={2.1} />,
    },
    {
      key: 'copilot' as const,
      label: 'Copilot',
      icon: <MessageSquare size={18} strokeWidth={2.1} />,
    },
    {
      key: 'assets' as const,
      label: pick('资源', 'Assets'),
      icon: <Images size={18} strokeWidth={2.1} />,
    },
  ], [pick, currentMode, modeLabelMap]);

  const canonicalTab = currentTab === 'library'
    ? 'assets'
    : currentTab === 'chat'
      ? 'copilot'
      : currentTab === 'me'
        ? 'create'
        : currentTab;

  return (
    <div
      data-mobile-primary-navigation="true"
      className={`fixed bottom-0 left-0 right-0 transition-[transform,opacity] duration-[125ms] ease-out lg:hidden ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[140%] opacity-0'}`}
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))', zIndex: KK_LAYER.mobileChrome }}
      onTouchStart={onInteract}
      onClick={onInteract}
    >
      <div id="mobile-tab-bar" className="mobile-tab-bar ios-mobile-tabbar-shell mx-3 px-2 py-1.5">
        <div className="grid grid-cols-4 gap-1.5">
          {tabs.map((tab) => {
            const isActive = canonicalTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(tab.key)}
                className={`ios-mobile-tab-button flex min-h-[54px] flex-col items-center justify-center gap-1 px-2 py-2 ${isActive ? 'is-active' : ''}`}
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
              >
                {tab.icon}
                <span className="ios-mobile-tab-label">{tab.label}</span>
                {tab.caption ? (
                  <span className={`ios-mobile-tab-caption text-[10px] leading-none ${isActive ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
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
