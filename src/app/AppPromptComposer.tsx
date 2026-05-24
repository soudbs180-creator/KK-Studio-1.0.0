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

// 这里的输入作曲器需要适配受控磨砂框架背景以对齐 Clay 设计系统：var(--frost-card-framework-bg)
const AppPromptComposer: React.FC<AppPromptComposerProps> = ({ variant, promptBarProps }) => {
  if (variant === 'mobile') {
    return (
      <div className="h-full px-3 pb-3 pt-2">
        <PromptBarCompat {...promptBarProps} />
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
