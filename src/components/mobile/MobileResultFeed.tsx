import React from 'react';

import { Sparkles } from 'lucide-react';

import type { MobileResultEntry } from '../../types';
import MobileResultTile from './MobileResultTile';

interface MobileResultFeedProps {
  resultEntries: MobileResultEntry[];
  activeEntryId?: string | null;
  activeSourceImage?: string | null;
  onEntryOpen: (entryId: string) => void;
}

const MobileResultFeed: React.FC<MobileResultFeedProps> = ({
  resultEntries,
  activeEntryId,
  activeSourceImage,
  onEntryOpen,
}) => {
  const totalResults = resultEntries.length;
  const hasSelectedSource =
    Boolean(activeSourceImage) && resultEntries.some((entry) => entry.imageId === activeSourceImage);
  const counterLabel = totalResults === 0 ? '等待生成' : `${totalResults} 张结果`;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
            创作结果
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            中间区域只看图，点开任意结果再查看完整提示词和操作。
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)]/85 px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
          {hasSelectedSource ? `${counterLabel} · 已选参考图` : counterLabel}
        </div>
      </div>

      {totalResults === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] border border-[var(--border-light)] bg-[var(--bg-secondary)]/82 px-6 py-8 text-center shadow-[0_22px_52px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div className="mb-3 rounded-full bg-[var(--bg-tertiary)] p-3 text-[var(--text-secondary)]">
            <Sparkles size={18} />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">还没有生成结果</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            从底部输入区发送提示词后，新的结果会优先进入这里。首页默认只展示图片内容，详细信息在详情页查看。
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <div className="grid grid-cols-6 gap-3 pb-1 [grid-auto-flow:dense]">
            {resultEntries.map((entry) => (
              <MobileResultTile
                key={entry.id}
                entry={entry}
                isActive={activeEntryId === entry.id}
                isSource={activeSourceImage === entry.imageId}
                onEntryOpen={onEntryOpen}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MobileResultFeed;
