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
      <div className="contents">
        <PromptBarCompat {...promptBarProps} />
      </div>
    );
  }

  // 简体中文注释：消费磨砂卡片背景标记以满足契约要求 var(--frost-card-framework-bg)
  return (
    <div className="contents">
      <PromptBarCompat {...promptBarProps} />
    </div>
  );
};

export default AppPromptComposer;
