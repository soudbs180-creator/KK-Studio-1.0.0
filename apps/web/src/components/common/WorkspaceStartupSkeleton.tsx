import React from 'react'
import { AlertCircle } from 'lucide-react'

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
      className={`animate-pulse rounded-2xl border ${className ?? ''}`}
      style={{
        borderColor: 'rgba(148, 163, 184, 0.16)',
        background: 'rgba(255, 255, 255, 0.04)',
        ...style,
      }}
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
      className="pointer-events-none fixed inset-0 z-[110] overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.78) 48%, rgba(15, 23, 42, 0.92) 100%)',
        backdropFilter: 'blur(10px)',
      }}
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
            className="inline-flex max-w-[min(100%,560px)] flex-col gap-3 rounded-[28px] border px-5 py-4 shadow-2xl"
            style={{
              borderColor: 'rgba(148, 163, 184, 0.2)',
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#e5e7eb',
            }}
          >
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary, #f8fafc)' }}>
                  {title}
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary, rgba(226, 232, 240, 0.74))' }}>
                  {getWorkspaceStartupStageLabel(stage)}
                </div>
              </div>
            </div>

            {localizedWarning ? (
              <div
                className="flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-xs"
                style={{
                  borderColor: 'rgba(245, 158, 11, 0.26)',
                  background: 'rgba(120, 53, 15, 0.24)',
                  color: '#fde68a',
                }}
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
          <div className="relative overflow-hidden rounded-[32px] border" style={{
            borderColor: 'rgba(148, 163, 184, 0.16)',
            background: 'rgba(15, 23, 42, 0.46)',
          }}>
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
        <div className="mx-auto w-full max-w-[1100px] rounded-[30px] border px-5 py-4" style={{
          borderColor: 'rgba(148, 163, 184, 0.18)',
          background: 'rgba(15, 23, 42, 0.76)',
        }}>
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
