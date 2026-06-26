import React from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react';

import type { AppStartupStage } from '../../services/system/appStartup';
import { getDocumentLanguage, localizeUserFacingText, pickByResolvedLanguage } from '../../utils/localeText';

const stageTargetMap: Record<AppStartupStage, number> = {
  signed_out: 20,
  session_ready: 45,
  profile_ready: 70,
  workspace_ready: 90,
  background_ready: 100,
};

const stageRank: Record<AppStartupStage, number> = {
  signed_out: 0,
  session_ready: 1,
  profile_ready: 2,
  workspace_ready: 3,
  background_ready: 4,
};

const APP_STARTUP_STATUS_ITEMS = [
  {
    stage: 'signed_out',
    label: {
      zh: '准备登录环境',
      en: 'Preparing the sign-in environment',
    },
  },
  {
    stage: 'session_ready',
    label: {
      zh: '确认会话',
      en: 'Confirming your session',
    },
  },
  {
    stage: 'profile_ready',
    label: {
      zh: '同步工作区设置',
      en: 'Syncing your workspace setup',
    },
  },
  {
    stage: 'workspace_ready',
    label: {
      zh: '加载工作区外壳',
      en: 'Loading the workspace shell',
    },
  },
] satisfies ReadonlyArray<{
  stage: AppStartupStage;
  label: {
    zh: string;
    en: string;
  };
}>;

type StartupStatusState = 'complete' | 'active' | 'idle';

function getStatusState(itemStage: AppStartupStage, currentStage: AppStartupStage): StartupStatusState {
  if (currentStage === 'background_ready') return 'complete';
  if (itemStage === currentStage) return 'active';
  return stageRank[itemStage] < stageRank[currentStage] ? 'complete' : 'idle';
}

function getActiveStartupItem(stage: AppStartupStage) {
  const currentRank = stageRank[stage] ?? 0;
  return APP_STARTUP_STATUS_ITEMS.find((item) => item.stage === stage)
    || [...APP_STARTUP_STATUS_ITEMS].reverse().find((item) => stageRank[item.stage] <= currentRank)
    || APP_STARTUP_STATUS_ITEMS[0];
}

export const AppStartupScreen: React.FC<{
  stage: AppStartupStage;
  warning?: string | null;
}> = ({ stage, warning }) => {
  const language = getDocumentLanguage();
  const activeItem = getActiveStartupItem(stage);
  const loadingText = pickByResolvedLanguage(language, activeItem.label.zh, activeItem.label.en);
  const localizedWarning = localizeUserFacingText(warning) || warning;

  const [smoothProgress, setSmoothProgress] = React.useState(0);

  React.useEffect(() => {
    const target = stageTargetMap[stage] || 20;

    if (stage === 'background_ready') {
      const interval = window.setInterval(() => {
        setSmoothProgress((prev) => {
          if (prev >= 100) {
            window.clearInterval(interval);
            return 100;
          }
          const step = Math.max((100 - prev) * 0.15, 1);
          const next = prev + step;
          return next >= 100 ? 100 : next;
        });
      }, 16);
      return () => window.clearInterval(interval);
    }

    const interval = window.setInterval(() => {
      setSmoothProgress((prev) => {
        if (prev < target) {
          const step = Math.max((target - prev) * 0.08, 0.5);
          return Math.min(prev + step, target);
        }

        return prev < 98 ? prev + 0.03 : prev;
      });
    }, 30);

    return () => window.clearInterval(interval);
  }, [stage]);

  const progress = Math.min(Math.round(smoothProgress), 100);
  const eyebrow = pickByResolvedLanguage(language, '启动中', 'Starting up');
  const title = pickByResolvedLanguage(
    language,
    'KK Studio 正在恢复你的创作工作区',
    'KK Studio is restoring your workspace',
  );
  const subtitle = pickByResolvedLanguage(
    language,
    '正在确认会话、加载个人设置，并准备创作画布。',
    'Confirming your session, loading profile settings, and preparing the creative canvas.',
  );

  return (
    <div
      data-testid="app-startup-screen"
      className="app-startup-screen"
      style={{
        background: 'var(--app-startup-bg)',
        color: 'var(--app-startup-title)',
      }}
    >
      <div data-testid="app-startup-shell" className="app-startup-shell">
        <section
          className="app-startup-card"
          aria-live="polite"
          aria-busy={progress < 100}
          style={{
            background: 'var(--app-startup-panel-bg)',
            borderColor: 'var(--app-startup-panel-border)',
            boxShadow: 'var(--app-startup-panel-shadow)',
          }}
        >
          <div className="app-startup-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <div className="app-startup-card__header">
            <div data-testid="app-startup-brand-mark" className="app-startup-brand-mark">
              <Sparkles size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="app-startup-eyebrow" style={{ color: 'var(--app-startup-muted)' }}>
                {eyebrow}
              </p>
              <h2 style={{ color: 'var(--app-startup-title)' }}>{title}</h2>
            </div>
          </div>

          <p className="app-startup-subtitle" style={{ color: 'var(--app-startup-muted)' }}>
            {subtitle}
          </p>

          <div className="app-startup-stage-line">
            <span>{loadingText}</span>
            <strong>{progress}%</strong>
          </div>

          <div
            data-testid="app-startup-progress-track"
            className="app-startup-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={loadingText}
          >
            <span style={{ width: `${progress}%` }} />
          </div>

          <div data-testid="app-startup-status-list" className="app-startup-status-list">
            {APP_STARTUP_STATUS_ITEMS.map((item) => {
              const state = getStatusState(item.stage, stage);
              const Icon = state === 'complete' ? CheckCircle2 : CircleDashed;
              return (
                <div key={item.stage} className="app-startup-status-item" data-state={state}>
                  <Icon size={14} aria-hidden="true" />
                  <span>{pickByResolvedLanguage(language, item.label.zh, item.label.en)}</span>
                </div>
              );
            })}
          </div>

          {localizedWarning ? (
            <div
              className="app-startup-warning"
              style={{
                background: 'var(--app-startup-warning-bg)',
                borderColor: 'var(--app-startup-warning-border)',
                color: 'var(--app-startup-warning-text)',
              }}
            >
              <AlertCircle size={16} aria-hidden="true" />
              <span>{localizedWarning}</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};
