import React from 'react'
import { AlertCircle } from 'lucide-react'
import { KK_LAYER } from '@kk/ui'

import type { AppStartupStage } from '../../services/system/appStartup'
import {
  getDocumentLanguage,
  localizeUserFacingText,
  pickByResolvedLanguage,
} from '../../utils/localeText'

function getWorkspaceStartupStageLabel(stage: AppStartupStage) {
  const language = getDocumentLanguage()

  const labels: Record<AppStartupStage, string> = {
    signed_out: pickByResolvedLanguage(language, '正在准备登录环境...', 'Preparing the sign-in environment...'),
    session_ready: pickByResolvedLanguage(language, '正在确认会话...', 'Confirming your session...'),
    profile_ready: pickByResolvedLanguage(language, '正在同步工作区设置...', 'Syncing your workspace setup...'),
    workspace_ready: pickByResolvedLanguage(language, '正在加载工作区骨架...', 'Loading the workspace shell...'),
    background_ready: pickByResolvedLanguage(language, '正在完成后台预热...', 'Finishing background warm-up...'),
  }

  return labels[stage]
}

function SkeletonBlock({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`kk-workspace-startup-block animate-pulse rounded-2xl border ${className ?? ''}`}
      style={style}
    />
  )
}

export const WorkspaceStartupSkeleton: React.FC<{
  stage: AppStartupStage;
  warning?: string | null;
}> = ({ stage, warning }) => {
  const language = getDocumentLanguage()
  const title = pickByResolvedLanguage(language, '正在准备工作区', 'Preparing the workspace')
  const localizedWarning = localizeUserFacingText(warning) || warning

  return (
    <div
      data-testid="workspace-startup-skeleton"
      className="kk-workspace-startup-skeleton pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: KK_LAYER.toolbar }}
    >
      <div className="absolute inset-x-0 top-0 px-6 pt-4">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4">
          <SkeletonBlock className="h-11 w-[216px] rounded-full" />
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-10 w-24 rounded-full" />
            <SkeletonBlock className="h-10 w-10 rounded-full" />
            <SkeletonBlock className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-24 px-6">
        <div className="mx-auto w-full max-w-[1440px]">
          <div
            className="kk-workspace-startup-panel inline-flex max-w-[min(100%,560px)] flex-col gap-3 rounded-[28px] border px-5 py-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="kk-workspace-startup-title text-sm font-semibold">
                  {title}
                </div>
                <div className="kk-workspace-startup-muted mt-1 text-xs">
                  {getWorkspaceStartupStageLabel(stage)}
                </div>
              </div>
            </div>

            {localizedWarning ? (
              <div
                className="kk-workspace-startup-warning flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-xs"
              >
                <AlertCircle className="mt-0.5 shrink-0" size={14} />
                <span>{localizedWarning}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-[188px] bottom-[168px] px-6">
        <div className="mx-auto grid h-full w-full max-w-[1440px] grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)] gap-6">
          <div className="kk-workspace-startup-canvas-frame relative overflow-hidden rounded-[32px] border">
            <div className="absolute left-10 top-10 flex flex-col gap-5">
              <SkeletonBlock className="h-[128px] w-[280px]" />
              <SkeletonBlock className="h-[210px] w-[192px]" />
              <SkeletonBlock className="h-[210px] w-[192px]" />
            </div>
            <div className="absolute left-[360px] top-20 flex flex-col gap-5">
              <SkeletonBlock className="h-[132px] w-[296px]" />
              <SkeletonBlock className="h-[210px] w-[192px]" />
            </div>
            <div className="absolute left-[640px] top-40 flex flex-col gap-5">
              <SkeletonBlock className="h-[128px] w-[272px]" />
              <SkeletonBlock className="h-[210px] w-[192px]" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SkeletonBlock className="h-[112px] w-full" />
            <SkeletonBlock className="h-[112px] w-full" />
            <SkeletonBlock className="h-[112px] w-full" />
            <SkeletonBlock className="h-[112px] w-full" />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-6 pb-6">
        <div className="kk-workspace-startup-bottom-bar mx-auto w-full max-w-[1100px] rounded-[30px] border px-5 py-4">
          <div className="flex items-end gap-4">
            <SkeletonBlock className="h-[82px] min-w-0 flex-1 rounded-[26px]" />
            <SkeletonBlock className="h-12 w-12 rounded-2xl" />
            <SkeletonBlock className="h-12 w-12 rounded-2xl" />
            <SkeletonBlock className="h-12 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
