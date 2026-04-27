import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import type { AppStartupStage } from '../../services/system/appStartup';
import { getDocumentLanguage, localizeUserFacingText, pickByResolvedLanguage } from '../../utils/localeText';

function getStageLabel(stage: AppStartupStage) {
  const language = getDocumentLanguage();

  const labels: Record<AppStartupStage, string> = {
    signed_out: pickByResolvedLanguage(language, '正在准备登录环境...', 'Preparing the sign-in environment...'),
    session_ready: pickByResolvedLanguage(language, '正在确认会话...', 'Confirming your session...'),
    profile_ready: pickByResolvedLanguage(language, '正在同步工作区配置...', 'Syncing your workspace setup...'),
    workspace_ready: pickByResolvedLanguage(language, '正在加载工作区骨架...', 'Loading the workspace shell...'),
    background_ready: pickByResolvedLanguage(language, '正在完成后台预热...', 'Finishing background warm-up...'),
  };

  return labels[stage];
}

export const AppStartupScreen: React.FC<{
  stage: AppStartupStage;
  warning?: string | null;
}> = ({ stage, warning }) => {
  const language = getDocumentLanguage();
  const title = pickByResolvedLanguage(language, 'KK Studio 正在进入工作区', 'KK Studio is entering the workspace');
  const localizedWarning = localizeUserFacingText(warning) || warning;

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div
        className="settings-reference-card settings-reference-card--elevated w-full max-w-xl p-8 text-center backdrop-blur-xl"
        style={{
          borderColor: 'var(--settings-border-subtle, var(--border-light))',
          background:
            'linear-gradient(180deg, rgb(255 255 255 / 0.03) 0%, transparent 100%), var(--settings-section-bg, var(--bg-surface))',
          boxShadow: '0 28px 64px rgb(2 6 23 / 0.18)',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border"
          style={{
            borderColor: 'var(--settings-border-subtle, var(--border-light))',
            background: 'var(--settings-surface-overlay, var(--bg-elevated))',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-surface-md, 18px)',
          }}
        >
          <Loader2 className="animate-spin" size={20} />
        </div>
        <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getStageLabel(stage)}</p>
        {localizedWarning ? (
          <div
            className="mt-5 flex items-start gap-3 border px-4 py-3 text-left text-sm"
            style={{
              borderColor: 'var(--settings-state-warning-border, rgba(245, 158, 11, 0.24))',
              background: 'var(--settings-state-warning-bg, rgba(245, 158, 11, 0.12))',
              color: 'var(--settings-state-warning-text, #fde68a)',
              borderRadius: 'var(--radius-surface-sm, 16px)',
            }}
          >
            <AlertCircle className="mt-0.5 shrink-0" size={16} />
            <span>{localizedWarning}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
