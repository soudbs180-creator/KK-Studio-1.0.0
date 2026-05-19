import React from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react';

import type { AppStartupStage } from '../../services/system/appStartup';
import { getDocumentLanguage, localizeUserFacingText, pickByResolvedLanguage } from '../../utils/localeText';

const APP_STARTUP_STAGE_ORDER: AppStartupStage[] = [
  'signed_out',
  'session_ready',
  'profile_ready',
  'workspace_ready',
  'background_ready',
];

const APP_STARTUP_STATUS_ITEMS: Array<{
  stage: AppStartupStage;
  label: (language: ReturnType<typeof getDocumentLanguage>) => string;
}> = [
  {
    stage: 'session_ready',
    label: (language) => pickByResolvedLanguage(language, '\u4f1a\u8bdd', 'Session'),
  },
  {
    stage: 'profile_ready',
    label: (language) => pickByResolvedLanguage(language, '\u914d\u7f6e', 'Profile'),
  },
  {
    stage: 'workspace_ready',
    label: (language) => pickByResolvedLanguage(language, '\u5de5\u4f5c\u533a', 'Workspace'),
  },
];

function getStageLabel(stage: AppStartupStage) {
  const language = getDocumentLanguage();

  const labels: Record<AppStartupStage, string> = {
    signed_out: pickByResolvedLanguage(language, '\u6b63\u5728\u51c6\u5907\u767b\u5f55\u73af\u5883...', 'Preparing the sign-in environment...'),
    session_ready: pickByResolvedLanguage(language, '\u6b63\u5728\u786e\u8ba4\u4f1a\u8bdd...', 'Confirming your session...'),
    profile_ready: pickByResolvedLanguage(language, '\u6b63\u5728\u540c\u6b65\u5de5\u4f5c\u533a\u914d\u7f6e...', 'Syncing your workspace setup...'),
    workspace_ready: pickByResolvedLanguage(language, '\u6b63\u5728\u52a0\u8f7d\u5de5\u4f5c\u533a\u9aa8\u67b6...', 'Loading the workspace shell...'),
    background_ready: pickByResolvedLanguage(language, '\u6b63\u5728\u5b8c\u6210\u540e\u53f0\u9884\u70ed...', 'Finishing background warm-up...'),
  };

  return labels[stage];
}

function getStageProgress(stage: AppStartupStage) {
  const stageIndex = Math.max(APP_STARTUP_STAGE_ORDER.indexOf(stage), 0);
  return Math.round(((stageIndex + 1) / APP_STARTUP_STAGE_ORDER.length) * 100);
}

function getStatusState(itemStage: AppStartupStage, activeStage: AppStartupStage) {
  const activeIndex = APP_STARTUP_STAGE_ORDER.indexOf(activeStage);
  const itemIndex = APP_STARTUP_STAGE_ORDER.indexOf(itemStage);

  if (activeIndex > itemIndex) {
    return 'complete';
  }

  if (activeIndex === itemIndex) {
    return 'active';
  }

  return 'pending';
}

export const AppStartupScreen: React.FC<{
  stage: AppStartupStage;
  warning?: string | null;
}> = ({ stage, warning }) => {
  const language = getDocumentLanguage();
  const title = pickByResolvedLanguage(language, 'KK Studio \u6b63\u5728\u6062\u590d\u5de5\u4f5c\u533a', 'KK Studio is restoring your workspace');
  const eyebrow = pickByResolvedLanguage(language, '\u542f\u52a8\u4e2d', 'Starting up');
  const subtitle = pickByResolvedLanguage(
    language,
    '\u6b63\u5728\u786e\u8ba4\u4f1a\u8bdd\u3001\u52a0\u8f7d\u914d\u7f6e\u5e76\u51c6\u5907\u521b\u4f5c\u753b\u5e03\u3002',
    'Confirming your session, loading profile settings, and preparing the creative canvas.',
  );
  const progress = getStageProgress(stage);
  const localizedWarning = localizeUserFacingText(warning) || warning;

  return (
    <div
      data-testid="app-startup-screen"
      className="app-startup-screen fixed inset-0"
      style={{ backgroundColor: 'var(--app-startup-bg, var(--bg-base))' }}
    >
      <div
        data-testid="app-startup-shell"
        className="app-startup-shell"
      >
        <div className="app-startup-rails" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <section
          className="app-startup-card"
          style={{
            borderColor: 'var(--app-startup-panel-border)',
            background:
              'linear-gradient(180deg, var(--app-startup-panel-sheen) 0%, transparent 100%), var(--app-startup-panel-bg)',
            boxShadow: 'var(--app-startup-panel-shadow)',
          }}
        >
          <div className="app-startup-card__header">
            <div
              data-testid="app-startup-brand-mark"
              className="app-startup-brand-mark"
            >
              <Sparkles size={24} />
            </div>
            <div>
              <p className="app-startup-eyebrow">{eyebrow}</p>
              <h2 style={{ color: 'var(--app-startup-title)' }}>{title}</h2>
            </div>
          </div>

          <p
            className="app-startup-subtitle"
            style={{ color: 'var(--app-startup-muted)' }}
          >
            {subtitle}
          </p>

          <div className="app-startup-stage-line">
            <span>{getStageLabel(stage)}</span>
            <strong>{progress}%</strong>
          </div>
          <div
            data-testid="app-startup-progress-track"
            className="app-startup-progress-track"
            aria-hidden
          >
            <span style={{ width: `${progress}%` }} />
          </div>

          <div
            data-testid="app-startup-status-list"
            className="app-startup-status-list"
          >
            {APP_STARTUP_STATUS_ITEMS.map((item) => {
              const state = getStatusState(item.stage, stage);
              const Icon = state === 'complete' ? CheckCircle2 : CircleDashed;

              return (
                <div
                  key={item.stage}
                  className="app-startup-status-item"
                  data-state={state}
                >
                  <Icon size={16} />
                  <span>{item.label(language)}</span>
                </div>
              );
            })}
          </div>

          {localizedWarning ? (
            <div
              className="app-startup-warning"
              style={{
                borderColor: 'var(--app-startup-warning-border)',
                background: 'var(--app-startup-warning-bg)',
                color: 'var(--app-startup-warning-text)',
              }}
            >
              <AlertCircle size={16} />
              <span>{localizedWarning}</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
