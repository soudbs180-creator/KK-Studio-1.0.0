import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Heart, Image as ImageIcon, Plus, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { WorkspaceActionButton, WorkspaceCard, WorkspaceSheetHeader } from '../../components/workspace/WorkspaceSurface';
import { insertIntoFocusedComposer } from './composerRegistry';
import { buildMentionText, filterFavorites, normalizeFavoriteName, type FavoriteFilterKind, type FavoriteSortMode } from './favoriteUtils';
import { favoriteImageToReferenceImage } from './referenceSources';
import { useFavoritesStore } from './favoritesStore';
import type { FavoriteImage, FavoriteItem, FavoritePrompt } from './types';

interface FavoritesPanelProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
  onRenameImageAlias?: (imageId: string, name: string) => void;
}

const categoryOptions: Array<{ id: FavoriteFilterKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'prompts', label: 'Prompts' },
];

const sortOptions: Array<{ id: FavoriteSortMode; label: string }> = [
  { id: 'updated-desc', label: 'Recent' },
  { id: 'created-desc', label: 'Created' },
  { id: 'name-asc', label: 'Name' },
];

function itemSubtitle(item: FavoriteItem): string {
  if (item.kind === 'favorite-image') {
    return [item.model, ...(item.tags || [])].filter(Boolean).join(' · ') || 'Favorite image';
  }

  return item.tags?.length ? item.tags.join(' · ') : 'Favorite prompt';
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  isOpen,
  isMobile,
  onClose,
  onRenameImageAlias,
}) => {
  const { items, loaded, load, updateFavorite, removeFavorite, addPromptFavorite } = useFavoritesStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FavoriteFilterKind>('all');
  const [sortMode, setSortMode] = useState<FavoriteSortMode>('updated-desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  useEffect(() => {
    if (isOpen && !loaded) {
      void load();
    }
  }, [isOpen, loaded, load]);

  const filtered = useMemo(
    () => filterFavorites(items, query, category, sortMode),
    [category, items, query, sortMode],
  );

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
    if (selectedId && !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null);
    }
  }, [filtered, selectedId]);

  if (!isOpen) return null;

  const beginEdit = (item: FavoriteItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrompt(item.kind === 'favorite-prompt' ? item.prompt : '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const item = items.find((entry) => entry.id === editingId);
    if (!item) return;

    const nextName = normalizeFavoriteName(editName, item.name);
    if (item.kind === 'favorite-image') {
      await updateFavorite(item.id, { name: nextName } as Partial<FavoriteImage>);
      if (item.sourceImageId) {
        onRenameImageAlias?.(item.sourceImageId, nextName);
      }
    } else {
      await updateFavorite(item.id, {
        name: nextName,
        prompt: normalizeFavoriteName(editPrompt, item.prompt),
      } as Partial<FavoritePrompt>);
    }

    setEditingId(null);
  };

  const insertItem = (item: FavoriteItem) => {
    if (item.kind === 'favorite-prompt') {
      insertIntoFocusedComposer({ text: item.prompt });
      return;
    }

    const referenceImage = favoriteImageToReferenceImage(item);
    insertIntoFocusedComposer({
      text: buildMentionText(item.name),
      candidate: {
        id: `favorite-panel-${item.id}`,
        source: 'favorite',
        kind: 'favorite-image',
        name: item.name,
        mentionText: buildMentionText(item.name),
        previewUrl: item.thumbnailObjectUrl || item.thumbnailUrl || item.originalObjectUrl || item.originalUrl || item.url,
        mimeType: item.mimeType || 'image/png',
        favoriteId: item.id,
        sourceImageId: item.sourceImageId,
        storageId: item.storageId || item.sourceImageId || item.id,
        referenceImage,
      },
    });
  };

  const handleAddPrompt = async () => {
    const text = newPrompt.trim();
    if (!text) return;
    const favorite = await addPromptFavorite({ prompt: text }, text.length > 36 ? `${text.slice(0, 36)}...` : text);
    setNewPrompt('');
    setSelectedId(favorite.id);
  };

  return (
    <>
      <div className="workspace-panel-backdrop" onClick={onClose} />
      <section className={`workspace-favorites-panel ${isMobile ? 'is-mobile' : 'is-desktop'}`} data-testid="favorites-panel">
        <WorkspaceCard className="workspace-favorites-card">
          <WorkspaceSheetHeader
            eyebrow="Favorites"
            title="Liked Library"
            description="Images and prompts you can insert into the active composer."
            actions={(
              <WorkspaceActionButton aria-label="Close favorites" onClick={onClose}>
                <X size={16} />
              </WorkspaceActionButton>
            )}
          />

          <div className="workspace-favorites-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search favorites"
            />
          </div>

          <div className="workspace-favorites-controls">
            <div className="workspace-favorites-segments">
              {categoryOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === category ? 'is-active' : ''}
                  onClick={() => setCategory(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as FavoriteSortMode)}>
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="workspace-favorites-add">
            <textarea
              value={newPrompt}
              onChange={(event) => setNewPrompt(event.target.value)}
              placeholder="Add a favorite prompt..."
              rows={2}
            />
            <button type="button" onClick={handleAddPrompt} disabled={!newPrompt.trim()}>
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          <div className="workspace-favorites-body">
            <div className="workspace-favorites-list">
              {filtered.length ? filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-favorites-row ${selected?.id === item.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="workspace-favorites-row-preview">
                    {item.kind === 'favorite-image' && (item.thumbnailObjectUrl || item.thumbnailUrl || item.url || item.originalObjectUrl || item.originalUrl) ? (
                      <img src={item.thumbnailObjectUrl || item.thumbnailUrl || item.url || item.originalObjectUrl || item.originalUrl} alt={item.name} />
                    ) : item.kind === 'favorite-image' ? (
                      <ImageIcon size={17} />
                    ) : (
                      <Sparkles size={17} />
                    )}
                  </span>
                  <span className="workspace-favorites-row-copy">
                    <span className="workspace-favorites-row-title">{item.name}</span>
                    <span className="workspace-favorites-row-subtitle">{itemSubtitle(item)}</span>
                  </span>
                </button>
              )) : (
                <div className="workspace-favorites-empty">No favorites yet</div>
              )}
            </div>

            <WorkspaceCard className="workspace-favorites-detail">
              {selected ? (
                <>
                  <div className="workspace-favorites-detail-preview">
                    {selected.kind === 'favorite-image' ? (
                      selected.thumbnailObjectUrl || selected.thumbnailUrl || selected.originalObjectUrl || selected.originalUrl || selected.url ? (
                        <img src={selected.thumbnailObjectUrl || selected.thumbnailUrl || selected.originalObjectUrl || selected.originalUrl || selected.url} alt={selected.name} />
                      ) : (
                        <ImageIcon size={28} />
                      )
                    ) : (
                      <Heart size={28} />
                    )}
                  </div>

                  {editingId === selected.id ? (
                    <div className="workspace-favorites-edit">
                      <input value={editName} onChange={(event) => setEditName(event.target.value)} />
                      {selected.kind === 'favorite-prompt' ? (
                        <textarea value={editPrompt} onChange={(event) => setEditPrompt(event.target.value)} rows={5} />
                      ) : null}
                      <div className="workspace-favorites-detail-actions">
                        <button type="button" onClick={saveEdit}>Save</button>
                        <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3>{selected.name}</h3>
                      <p>{selected.kind === 'favorite-prompt' ? selected.prompt : selected.prompt || itemSubtitle(selected)}</p>
                      <div className="workspace-favorites-detail-actions">
                        <button type="button" onClick={() => insertItem(selected)}>
                          <Send size={14} />
                          <span>Insert</span>
                        </button>
                        <button type="button" onClick={() => beginEdit(selected)}>
                          <Edit2 size={14} />
                          <span>{selected.kind === 'favorite-image' ? 'Rename' : 'Edit'}</span>
                        </button>
                        <button type="button" onClick={() => removeFavorite(selected.id)}>
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="workspace-favorites-empty">Select a favorite</div>
              )}
            </WorkspaceCard>
          </div>
        </WorkspaceCard>
      </section>
    </>
  );
};

export default FavoritesPanel;
