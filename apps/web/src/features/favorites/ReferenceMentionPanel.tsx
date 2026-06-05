import React, { useMemo, useState } from 'react';
import { FileText, Heart, Image as ImageIcon, Tag } from 'lucide-react';
import { filterMentionCandidates } from './referenceSources';
import type { ReferenceMentionCandidate, ReferenceMentionTab } from './types';

interface ReferenceMentionPanelProps {
  open: boolean;
  query: string;
  tabs: ReferenceMentionTab[];
  onSelect: (candidate: ReferenceMentionCandidate) => void;
  onClose?: () => void;
  className?: string;
}

const tabIcons = {
  upload: ImageIcon,
  tag: Tag,
  favorite: Heart,
} as const;

function candidateIcon(candidate: ReferenceMentionCandidate) {
  if (candidate.kind === 'uploaded-file') return FileText;
  if (candidate.source === 'favorite') return Heart;
  if (candidate.source === 'tag') return Tag;
  return ImageIcon;
}

export const ReferenceMentionPanel: React.FC<ReferenceMentionPanelProps> = ({
  open,
  query,
  tabs,
  onSelect,
  onClose,
  className = '',
}) => {
  const firstNonEmptyTab = tabs.find((tab) => tab.items.length > 0)?.id || tabs[0]?.id || 'upload';
  const [activeTab, setActiveTab] = useState<string>(firstNonEmptyTab);

  const filteredTabs = useMemo(() => (
    tabs.map((tab) => ({
      ...tab,
      items: filterMentionCandidates(tab.items, query),
    }))
  ), [query, tabs]);

  const active = filteredTabs.find((tab) => tab.id === activeTab) || filteredTabs[0];

  if (!open) return null;

  return (
    <div className={`reference-mention-panel ${className}`.trim()} role="listbox" data-testid="reference-mention-panel">
      <div className="reference-mention-tabs">
        {filteredTabs.map((tab) => {
          const Icon = tabIcons[tab.id] || ImageIcon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`reference-mention-tab ${tab.id === active?.id ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              <span className="reference-mention-count">{tab.items.length}</span>
            </button>
          );
        })}
      </div>

      <div className="reference-mention-list">
        {active?.items.length ? active.items.slice(0, 12).map((candidate) => {
          const Icon = candidateIcon(candidate);
          return (
            <button
              key={candidate.id}
              type="button"
              className="reference-mention-item"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(candidate);
                onClose?.();
              }}
              title={candidate.name}
            >
              <span className="reference-mention-preview">
                {candidate.previewUrl ? (
                  <img src={candidate.previewUrl} alt={candidate.name} />
                ) : (
                  <Icon size={16} />
                )}
              </span>
              <span className="reference-mention-copy">
                <span className="reference-mention-name">{candidate.mentionText}</span>
                <span className="reference-mention-meta">
                  {candidate.fileOnly ? 'Assistant context' : candidate.source === 'tag' ? 'Tagged image' : candidate.source === 'favorite' ? 'Liked image' : 'Uploaded content'}
                </span>
              </span>
            </button>
          );
        }) : (
          <div className="reference-mention-empty">No matching references</div>
        )}
      </div>
    </div>
  );
};

export default ReferenceMentionPanel;
