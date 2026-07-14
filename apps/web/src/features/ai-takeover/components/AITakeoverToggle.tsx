import React from 'react';
import { Cpu, MousePointer2, Sparkles } from 'lucide-react';

import { AGENT_CONTROL_ACTIONS } from '../../ai-assistant-runtime';
import { useAITakeover } from '../context/AITakeoverContext';
import type { AssistantCollaborationMode } from '../types';

const MODE_OPTIONS: ReadonlyArray<{
  mode: AssistantCollaborationMode;
  id: string;
  label: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: string;
}> = [
  {
    mode: 'direct',
    id: 'btn-ai-direct-mode',
    label: '直接',
    title: '直接操作：继续点击、拖拽和编辑画布',
    icon: MousePointer2,
    action: AGENT_CONTROL_ACTIONS.setDirectMode.uiAction,
  },
  {
    mode: 'assist',
    id: 'btn-ai-assist-mode',
    label: '辅助',
    title: 'AI 辅助：同步当前页面与选区，提出下一步建议',
    icon: Sparkles,
    action: AGENT_CONTROL_ACTIONS.setAssistMode.uiAction,
  },
  {
    mode: 'takeover',
    id: 'btn-ai-takeover-toggle',
    label: '接管',
    title: 'AI 接管：根据目标跨页面、跨工具完成任务',
    icon: Cpu,
    action: AGENT_CONTROL_ACTIONS.setTakeoverMode.uiAction,
  },
];

export interface AITakeoverToggleProps {
  onModeChange?: (mode: AssistantCollaborationMode) => void;
}

export const AITakeoverToggle: React.FC<AITakeoverToggleProps> = ({ onModeChange }) => {
  const { collaborationMode, setCollaborationMode } = useAITakeover();

  return (
    <div
      role="radiogroup"
      aria-label="AI 协作方式"
      className="assistant-collaboration-mode-switch flex min-w-0 shrink-0 items-center rounded-full border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] p-0.5 shadow-[var(--frost-card-sub-shadow)]"
      data-mode={collaborationMode}
    >
      {MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = collaborationMode === option.mode;

        return (
          <button
            key={option.mode}
            id={option.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-mode={option.mode}
            data-agent-action={option.action}
            onClick={() => {
              setCollaborationMode(option.mode);
              onModeChange?.(option.mode);
            }}
            className={`flex h-6 min-w-0 items-center gap-1 rounded-full px-2 text-[10px] font-bold transition-all active:scale-95 ${
              isActive
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]'
            }`}
            title={option.title}
          >
            <Icon size={11} className={option.mode === 'takeover' && isActive ? 'animate-pulse' : undefined} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
