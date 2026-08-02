import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Edit2, Heart, Image as ImageIcon, Plus, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { WorkspaceActionButton, WorkspaceCard, WorkspaceSheetHeader } from '../../components/workspace/WorkspaceSurface';
import { insertIntoFocusedComposer } from './composerRegistry';
import { buildMentionText, filterFavorites, normalizeFavoriteName, type FavoriteFilterKind, type FavoriteSortMode } from './favoriteUtils';
import { favoriteImageToReferenceImage } from './referenceSources';
import { useFavoritesStore } from './favoritesStore';
import type { FavoriteImage, FavoriteItem, FavoritePrompt } from './types';
import {
  FAVORITES_PANEL_MARGIN,
  FAVORITES_PANEL_SCHEMA_VERSION,
  clampFavoritesPanelGeometry,
  resizeFavoritesPanelGeometry,
  type FavoritesPanelGeometry,
  type FavoritesPanelResizeMode,
} from './favoritesPanelGeometry';

interface FavoritesPanelProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
  onRenameImageAlias?: (imageId: string, name: string) => void;
}

const FAVORITES_PANEL_POSITION_STORAGE_KEY = 'kk_favorites_panel_position_v1';
const FAVORITES_PANEL_GEOMETRY_STORAGE_KEY = 'kk_favorites_panel_geometry_v2';
const DESKTOP_PANEL_WIDTH = 720;
const DESKTOP_PANEL_HEIGHT = 680;
const MOBILE_PANEL_HEIGHT_OFFSET = 112;

const categoryOptions: Array<{ id: FavoriteFilterKind; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'images', label: '图片' },
  { id: 'prompts', label: '提示词' },
];

const sortOptions: Array<{ id: FavoriteSortMode; label: string }> = [
  { id: 'updated-desc', label: '最近更新' },
  { id: 'created-desc', label: '最新收藏' },
  { id: 'name-asc', label: '名称排序' },
];

function createDefaultGeometry(): FavoritesPanelGeometry {
  if (typeof window === 'undefined') {
    return {
      schemaVersion: FAVORITES_PANEL_SCHEMA_VERSION,
      x: FAVORITES_PANEL_MARGIN,
      y: FAVORITES_PANEL_MARGIN,
      width: DESKTOP_PANEL_WIDTH,
      height: DESKTOP_PANEL_HEIGHT,
    };
  }
  const width = Math.min(DESKTOP_PANEL_WIDTH, window.innerWidth - FAVORITES_PANEL_MARGIN * 2);
  const height = Math.min(DESKTOP_PANEL_HEIGHT, window.innerHeight - FAVORITES_PANEL_MARGIN * 2);
  return clampFavoritesPanelGeometry({
    schemaVersion: FAVORITES_PANEL_SCHEMA_VERSION,
    x: Math.round((window.innerWidth - width) / 2),
    y: Math.round((window.innerHeight - height) / 2),
    width,
    height,
  }, { width: window.innerWidth, height: window.innerHeight });
}

function readStoredPanelGeometry(): FavoritesPanelGeometry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FAVORITES_PANEL_GEOMETRY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FavoritesPanelGeometry>;
      if (
        parsed.schemaVersion === FAVORITES_PANEL_SCHEMA_VERSION
        && typeof parsed.x === 'number'
        && typeof parsed.y === 'number'
        && typeof parsed.width === 'number'
        && typeof parsed.height === 'number'
      ) {
        return clampFavoritesPanelGeometry(parsed as FavoritesPanelGeometry, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    }
    const legacyRaw = window.localStorage.getItem(FAVORITES_PANEL_POSITION_STORAGE_KEY);
    if (!legacyRaw) return null;
    const legacy = JSON.parse(legacyRaw) as { left?: unknown; top?: unknown };
    if (typeof legacy.left !== 'number' || typeof legacy.top !== 'number') return null;
    return clampFavoritesPanelGeometry({
      ...createDefaultGeometry(),
      x: legacy.left,
      y: legacy.top,
    }, { width: window.innerWidth, height: window.innerHeight });
  } catch {
    return null;
  }
}

function persistPanelGeometry(geometry: FavoritesPanelGeometry) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITES_PANEL_GEOMETRY_STORAGE_KEY, JSON.stringify(geometry));
  } catch {
    // Geometry persistence is only a UI convenience; favorites data stays in IndexedDB.
  }
}

function getInitialPanelGeometry(isMobile: boolean): FavoritesPanelGeometry {
  if (typeof window === 'undefined' || !isMobile) {
    return readStoredPanelGeometry() || createDefaultGeometry();
  }
  return {
    schemaVersion: FAVORITES_PANEL_SCHEMA_VERSION,
    x: FAVORITES_PANEL_MARGIN,
    y: FAVORITES_PANEL_MARGIN,
    width: Math.max(300, window.innerWidth - FAVORITES_PANEL_MARGIN * 2),
    height: Math.max(360, window.innerHeight - MOBILE_PANEL_HEIGHT_OFFSET),
  };
}

function itemSubtitle(item: FavoriteItem): string {
  if (item.kind === 'favorite-image') {
    return [item.model, ...(item.tags || [])].filter(Boolean).join('、') || '收藏图片';
  }

  return item.tags?.length ? item.tags.join('、') : '收藏提示词';
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  isOpen,
  isMobile,
  onClose,
  onRenameImageAlias,
}) => {
  const { items, loaded, load, updateFavorite, removeFavorite, addPromptFavorite } = useFavoritesStore();
  const panelRef = useRef<HTMLElement | null>(null);
  const geometryRef = useRef<FavoritesPanelGeometry>(getInitialPanelGeometry(isMobile));
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    width: number;
    height: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    geometry: FavoritesPanelGeometry;
    mode: FavoritesPanelResizeMode;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FavoriteFilterKind>('all');
  const [sortMode, setSortMode] = useState<FavoriteSortMode>('updated-desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [geometry, setGeometry] = useState<FavoritesPanelGeometry>(() => getInitialPanelGeometry(isMobile));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (isOpen && !loaded) {
      void load();
    }
  }, [isOpen, loaded, load]);

  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  useEffect(() => {
    if (!isOpen) return;
    setGeometry(getInitialPanelGeometry(isMobile));
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleResize = () => {
      setGeometry((current) => {
        const next = isMobile
          ? getInitialPanelGeometry(true)
          : clampFavoritesPanelGeometry(current, {
            width: window.innerWidth,
            height: window.innerHeight,
          });
        if (!isMobile) persistPanelGeometry(next);
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, isOpen]);

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

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, textarea, select')) return;
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    event.preventDefault();
  }, [isMobile]);

  const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampFavoritesPanelGeometry({
      ...geometryRef.current,
      x: drag.startLeft + event.clientX - drag.startX,
      y: drag.startTop + event.clientY - drag.startY,
      width: drag.width,
      height: drag.height,
    }, { width: window.innerWidth, height: window.innerHeight });
    setGeometry(next);
  }, []);

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistPanelGeometry(geometryRef.current);
    setIsDragging(false);
  }, []);

  const handleResizeStart = useCallback((
    event: React.PointerEvent<HTMLButtonElement>,
    mode: FavoritesPanelResizeMode,
  ) => {
    if (isMobile) return;
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      geometry: geometryRef.current,
      mode,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
    event.preventDefault();
  }, [isMobile]);

  const handleResizeMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    setGeometry(resizeFavoritesPanelGeometry(
      resize.geometry,
      resize.mode,
      event.clientX - resize.startX,
      event.clientY - resize.startY,
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, []);

  const handleResizeEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    persistPanelGeometry(geometryRef.current);
    setIsResizing(false);
  }, []);

  if (!isOpen) return null;

  const panelStyle: CSSProperties = {
    ...(isMobile ? {} : {
      left: geometry.x,
      top: geometry.y,
      width: geometry.width,
      height: geometry.height,
    }),
  };

  return (
    <section
      ref={panelRef}
      className={`workspace-favorites-panel is-floating ${isMobile ? 'is-mobile' : 'is-desktop'} ${isDragging ? 'is-dragging' : ''} ${isResizing ? 'is-resizing' : ''}`}
      data-testid="favorites-panel"
      style={panelStyle}
    >
      <WorkspaceCard className="workspace-favorites-card">
        <div
          className="workspace-favorites-drag-handle"
          data-testid="favorites-panel-drag-handle"
          title="拖动收藏面板"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <WorkspaceSheetHeader
            eyebrow="全局收藏"
            title="收藏"
            description="收藏图片和提示词，点击插入会写入当前聚焦的输入框。"
            actions={(
              <WorkspaceActionButton aria-label="关闭收藏" onClick={onClose}>
                <X size={16} />
              </WorkspaceActionButton>
            )}
          />
        </div>

        <div className="workspace-favorites-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索收藏图片或提示词"
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
            placeholder="新增一条收藏提示词..."
            rows={2}
          />
          <button type="button" onClick={handleAddPrompt} disabled={!newPrompt.trim()}>
            <Plus size={14} />
            <span>新增</span>
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
              <div className="workspace-favorites-empty">暂无收藏</div>
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
                      <button type="button" onClick={saveEdit}>保存</button>
                      <button type="button" onClick={() => setEditingId(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>{selected.name}</h3>
                    <p>{selected.kind === 'favorite-prompt' ? selected.prompt : selected.prompt || itemSubtitle(selected)}</p>
                    <div className="workspace-favorites-detail-actions">
                      <button type="button" onClick={() => insertItem(selected)}>
                        <Send size={14} />
                        <span>插入</span>
                      </button>
                      <button type="button" onClick={() => beginEdit(selected)}>
                        <Edit2 size={14} />
                        <span>{selected.kind === 'favorite-image' ? '重命名' : '编辑'}</span>
                      </button>
                      <button type="button" onClick={() => removeFavorite(selected.id)}>
                        <Trash2 size={14} />
                        <span>删除</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="workspace-favorites-empty">请选择一个收藏</div>
            )}
          </WorkspaceCard>
        </div>
      </WorkspaceCard>
      {!isMobile ? (
        <>
          <button
            type="button"
            className="workspace-favorites-resize-handle is-width"
            aria-label="调整收藏面板宽度"
            onPointerDown={(event) => handleResizeStart(event, 'width')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
          <button
            type="button"
            className="workspace-favorites-resize-handle is-height"
            aria-label="调整收藏面板高度"
            onPointerDown={(event) => handleResizeStart(event, 'height')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
          <button
            type="button"
            className="workspace-favorites-resize-handle is-proportional"
            aria-label="等比缩放收藏面板"
            onPointerDown={(event) => handleResizeStart(event, 'proportional')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          />
        </>
      ) : null}
    </section>
  );
};

export default FavoritesPanel;
