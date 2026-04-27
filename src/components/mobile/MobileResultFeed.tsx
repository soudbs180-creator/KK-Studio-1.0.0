import React from 'react';

import { Sparkles } from 'lucide-react';

import type { MobileResultEntry, ResponsiveSurface, ResultViewMode } from '../../types';
import { getAdaptiveResultColumnCount } from '../../utils/responsiveSurface';
import MobileResultTile from './MobileResultTile';

interface MobileResultFeedProps {
  resultEntries: MobileResultEntry[];
  activeEntryId?: string | null;
  activeSourceImage?: string | null;
  surface: ResponsiveSurface;
  viewMode: ResultViewMode;
  onViewModeChange: (viewMode: ResultViewMode) => void;
  onEntryOpen: (entryId: string) => void;
  onUseAsSource: (imageId: string) => void;
}

const getFallbackWidth = (surface: ResponsiveSurface): number => {
  if (surface === 'phone') {
    return 768;
  }

  if (surface === 'tablet') {
    return 1024;
  }

  return 1280;
};

const MobileResultFeed: React.FC<MobileResultFeedProps> = ({
  resultEntries,
  activeEntryId,
  activeSourceImage,
  surface,
  viewMode,
  onViewModeChange,
  onEntryOpen,
  onUseAsSource,
}) => {
  const totalResults = resultEntries.length;
  const hasSelectedSource =
    Boolean(activeSourceImage) && resultEntries.some((entry) => entry.imageId === activeSourceImage);
  const counterLabel = totalResults === 0 ? 'Waiting' : `${totalResults} results`;
  const measuredWidth = typeof window !== 'undefined' ? window.innerWidth : getFallbackWidth(surface);
  const columnCount = getAdaptiveResultColumnCount({
    surface,
    width: measuredWidth,
    viewMode,
  });

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            Results
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            Tap any result to inspect the full prompt and actions.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)]/85 p-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {(['standard', 'detail'] as ResultViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`rounded-full px-2.5 py-1 transition ${
                  viewMode === mode ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                {mode === 'detail' ? '详细' : '标准'}
              </button>
            ))}
          </div>
          <div className="whitespace-nowrap rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)]/85 px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
            {hasSelectedSource ? `${counterLabel} / source selected` : counterLabel}
          </div>
        </div>
      </div>

      {totalResults === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-[var(--border-light)] bg-[var(--bg-secondary)]/82 px-6 py-8 text-center shadow-[0_22px_52px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div className="mb-3 rounded-full bg-[var(--bg-tertiary)] p-3 text-[var(--text-secondary)]">
            <Sparkles size={18} />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">No results yet</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            New generations will appear here after you send a prompt.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <div
            className="pb-1"
            style={{ columnCount, columnGap: '0.75rem' }}
          >
            {resultEntries.map((entry) => (
              <MobileResultTile
                key={entry.id}
                entry={entry}
                isActive={activeEntryId === entry.id}
                isSource={activeSourceImage === entry.imageId}
                viewMode={viewMode}
                onEntryOpen={onEntryOpen}
                onUseAsSource={onUseAsSource}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MobileResultFeed;
