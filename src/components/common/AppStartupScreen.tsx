import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import type { AppStartupStage } from '../../services/system/appStartup';
import { getDocumentLanguage, localizeUserFacingText, pickByResolvedLanguage } from '../../utils/localeText';

function getStageLabel(stage: AppStartupStage) {
  const language = getDocumentLanguage();

  const labels: Record<AppStartupStage, string> = {
    signed_out: pickByResolvedLanguage(language, '正在准备登录环境...', 'Preparing the sign-in environment...'),
    session_ready: pickByResolvedLanguage(language, '正在确认会话...', 'Confirming your session...'),
    profile_ready: pickByResolvedLanguage(language, '正在校验账号与 API 连通性...', 'Checking your account and API connectivity...'),
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
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
        <Loader2 className="mx-auto mb-4 animate-spin text-blue-400" size={32} />
        <h2 className="mb-2 text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/70">{getStageLabel(stage)}</p>
        {localizedWarning ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-100">
            <AlertCircle className="mt-0.5 shrink-0" size={16} />
            <span>{localizedWarning}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
