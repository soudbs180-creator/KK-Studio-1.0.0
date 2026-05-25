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
        <div
          className="flex h-full flex-col rounded-[30px] border p-2"
          style={{
            background: 'var(--frost-card-framework-bg)',
            borderColor: 'var(--frost-card-framework-border)',
            boxShadow: 'var(--frost-card-framework-shadow)',
            WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
            backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)'
          }}
        >
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
