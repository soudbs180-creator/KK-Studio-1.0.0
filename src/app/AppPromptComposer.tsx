import React from 'react';
import PromptBar from '../components/layout/PromptBar';
import type { EcommerceGroupSheet, EcommerceSheetSetting, EcommerceSheetSettingPatch } from '../types';

export type AppPromptBarProps = React.ComponentProps<typeof PromptBar> & {
  ecommerceSheetSettings?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;
  onUpdateEcommerceSheetSetting?: (sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch) => void;
  sendLabel?: string;
};

const PromptBarCompat = PromptBar as React.ComponentType<AppPromptBarProps>;

interface AppPromptComposerProps {
  variant: 'mobile' | 'desktop';
  promptBarProps: AppPromptBarProps;
}

const AppPromptComposer: React.FC<AppPromptComposerProps> = ({ variant, promptBarProps }) => {
  if (variant === 'mobile') {
    return (
      <div className="h-full px-3 pb-3 pt-2">
        <div className="flex h-full flex-col rounded-[30px] border border-[var(--border-light)] bg-[var(--bg-overlay)]/96 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <PromptBarCompat {...promptBarProps} />
        </div>
      </div>
    );
  }

  return (
    <div className="contents">
      <PromptBarCompat {...promptBarProps} />
    </div>
  );
};

export default AppPromptComposer;
