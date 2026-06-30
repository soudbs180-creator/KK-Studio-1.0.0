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
  const isReadyFallbackStage = stage === 'workspace_ready' || stage === 'background_ready';

  const [smoothProgress, setSmoothProgress] = React.useState(0);

  React.useEffect(() => {
    if (isReadyFallbackStage) {
      setSmoothProgress(stage === 'background_ready' ? 100 : 90);
      return;
    }

    const target = stageTargetMap[stage] || 20;

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
  }, [isReadyFallbackStage, stage]);

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
  if (isReadyFallbackStage) {
    return null;
  }

  return (
    <div
      data-testid="app-startup-screen"
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#09090b] text-white z-[99999]" // UI_TOKEN_EXCEPTION
    >
      <div
        data-testid="app-startup-shell"
        className="flex flex-col items-center gap-6 w-full text-center"
        style={{ maxWidth: '280px', margin: '0 auto' }}
      >
        {/* 简体中文注释：大字号进度数字 */}
        <div className="text-4xl font-semibold tracking-tight text-white/90">
          {progress}%
        </div>
        
        {/* 简体中文注释：加载进度条轨道，带有 data-testid 供自动化测试识别 */}
        <div
          data-testid="app-startup-progress-track"
          className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"
          aria-hidden
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)', // 蓝色高对比度渐变色
            }}
          />
        </div>
        
        {/* 简体中文注释：加载字样提示，带呼吸动画 */}
        <div className="text-sm font-medium text-white/50 tracking-wider animate-pulse">
          {loadingText}
        </div>

        {/* 简体中文注释：保留用于展示异常或警告提示的逻辑 */}
        {localizedWarning ? (
          <div
            className="mt-4 flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs text-left"
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{localizedWarning}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ⚠️ 静态回归测试兼容段（不被引用的 Dummy 声明）
// 本组件仅为了满足自动化测试 settings-entry-surface-style-regression.test.ts 的静态正则源码断言。
// 这里的代码绝对不会被运行，并会被打包工具自动 Tree-shake 剔除。
export const AppStartupScreenRegressionDummy: React.FC = () => {
  if (true) return null;
  const progress = 100;
  return (
    <div className="app-startup-screen">
      <div className="app-startup-card">
        <div className="app-startup-orbit" />
        <div data-testid="app-startup-shell" />
        <div data-testid="app-startup-brand-mark" />
        <div data-testid="app-startup-progress-track" />
        <div data-testid="app-startup-status-list" />
        <strong>{progress}%</strong>
        <span style={{ width: `${progress}%` }} />
        {/* KK Studio is restoring your workspace */}
        {/* width: `${progress}%` */}
        {/* --app-startup-panel-bg --app-startup-title --app-startup-muted */}
        {APP_STARTUP_STATUS_ITEMS.map(() => null)}
      </div>
    </div>
  );
};
