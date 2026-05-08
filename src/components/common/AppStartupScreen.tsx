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
    <div
      data-testid="app-startup-screen"
      className="app-startup-screen fixed inset-0 flex items-center justify-center px-6"
      style={{ backgroundColor: 'var(--app-startup-bg, var(--bg-base))' }}
    >
      <div
        className="app-startup-card w-full max-w-xl p-8 text-center backdrop-blur-xl"
        style={{
          borderColor: 'var(--app-startup-panel-border)',
          background:
            'linear-gradient(180deg, var(--app-startup-panel-sheen) 0%, transparent 100%), var(--app-startup-panel-bg)',
          boxShadow: 'var(--app-startup-panel-shadow)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderRadius: 'var(--radius-panel-xl, 20px)',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border"
          style={{
            borderColor: 'var(--app-startup-icon-border)',
            background: 'var(--app-startup-icon-bg)',
            color: 'var(--app-startup-muted)',
            borderRadius: 'var(--radius-surface-md, 18px)',
          }}
        >
          <Loader2 className="animate-spin" size={20} />
        </div>
        <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--app-startup-title)' }}>{title}</h2>
        <p className="text-sm" style={{ color: 'var(--app-startup-muted)' }}>{getStageLabel(stage)}</p>
        {localizedWarning ? (
          <div
            className="app-startup-warning mt-5 flex items-start gap-3 border px-4 py-3 text-left text-sm"
            style={{
              borderColor: 'var(--app-startup-warning-border)',
              background: 'var(--app-startup-warning-bg)',
              color: 'var(--app-startup-warning-text)',
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
