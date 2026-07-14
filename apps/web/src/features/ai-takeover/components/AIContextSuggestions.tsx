import React from 'react';
import { Sparkles } from 'lucide-react';

import { AGENT_CONTROL_ACTIONS } from '../../ai-assistant-runtime';
import { useAITakeover } from '../context/AITakeoverContext';
import type { AssistantContextSuggestion } from '../types';

const SURFACE_LABELS = {
  canvas: '画布',
  library: '素材库',
  favorites: '收藏',
  settings: '设置',
  agent: '助手',
  unknown: '当前页面',
} as const;

export interface AIContextSuggestionsProps {
  onSelectSuggestion: (suggestion: AssistantContextSuggestion) => void;
}

export const AIContextSuggestions: React.FC<AIContextSuggestionsProps> = ({ onSelectSuggestion }) => {
  const { collaborationMode, contextSuggestions, canvasRuntimeState } = useAITakeover();

  if (collaborationMode !== 'assist') return null;

  const selectionCount = canvasRuntimeState.selection.count;
  const surfaceLabel = SURFACE_LABELS[canvasRuntimeState.currentPage] || SURFACE_LABELS.unknown;

  return (
    <section
      className="ai-context-suggestions mb-2 rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-3 py-2 shadow-[var(--frost-card-sub-shadow)]"
      aria-label="AI 上下文建议"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px]">
        <span className="flex items-center gap-1.5 font-black text-[var(--text-secondary)]">
          <Sparkles size={12} className="text-[var(--clay-brand-lavender)]" />
          AI 辅助建议
        </span>
        <span className="truncate text-[var(--text-tertiary)]">
          已同步{surfaceLabel}{selectionCount > 0 ? ` · 选中 ${selectionCount} 项` : ' · 未选对象'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {contextSuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            data-agent-action={AGENT_CONTROL_ACTIONS.applyContextSuggestion.uiAction}
            data-suggestion-id={suggestion.id}
            onClick={() => onSelectSuggestion(suggestion)}
            className="min-w-0 rounded-full border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-main-bg)] px-2.5 py-1 text-left text-[10px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
            title={suggestion.description}
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </section>
  );
};
