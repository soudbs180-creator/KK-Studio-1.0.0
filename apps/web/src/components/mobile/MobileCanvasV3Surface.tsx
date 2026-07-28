import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  Focus,
  Link2,
  Minus,
  Plus,
  X,
} from 'lucide-react';

import {
  CanvasEdgeLayer,
  CanvasV3Card,
  createImageCardViewModel,
  createPromptCardViewModel,
  createWorkflowCardViewModel,
  resolveCanvasV3DetailLevel,
  type CanvasCardViewModel,
  type CanvasV3EdgeRenderItem,
} from '../../canvas/v3';
import { useCanvas } from '../../context/CanvasContext';
import type { Canvas } from '../../types';

interface MobileCanvasV3SurfaceProps {
  activeCanvas?: Canvas | null;
  composer: React.ReactNode;
  userName: string;
  userAvatarUrl?: string;
  onOpenProfile: () => void;
}

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface SceneCard {
  viewModel: CanvasCardViewModel;
  x: number;
  y: number;
}

interface MobileCanvasScene {
  cards: SceneCard[];
  edges: CanvasV3EdgeRenderItem[];
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startPosition: { x: number; y: number };
}

interface PinchState {
  distance: number;
  anchorX: number;
  anchorY: number;
  transform: ViewTransform;
}

const CARD_ESTIMATED_HEIGHT = 164;
const WORLD_PADDING = 72;
const MIN_SCALE = 0.42;
const MOBILE_READABLE_SCALE = 0.72;
const TABLET_READABLE_SCALE = 1;
const MAX_SCALE = 1.15;

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const getPointerCenter = (pointers: Map<number, { x: number; y: number }>) => {
  const values = [...pointers.values()];
  return {
    x: values.reduce((sum, pointer) => sum + pointer.x, 0) / values.length,
    y: values.reduce((sum, pointer) => sum + pointer.y, 0) / values.length,
  };
};

const getPointerDistance = (pointers: Map<number, { x: number; y: number }>) => {
  const [first, second] = [...pointers.values()];
  return Math.hypot(second.x - first.x, second.y - first.y);
};

const buildViewModels = (canvas?: Canvas | null): CanvasCardViewModel[] => {
  if (!canvas) return [];
  const promptCards = canvas.promptNodes.map(createPromptCardViewModel);
  const imageCards = canvas.imageNodes.map(createImageCardViewModel);
  const workflowCards = (canvas.workflow?.nodes || [])
    .filter((node) => node.kind !== 'prompt' && node.kind !== 'image')
    .map((node) => createWorkflowCardViewModel({
      id: node.id,
      kind: node.kind,
      label: node.label,
      position: node.position,
      width: node.width,
      data: node.data as unknown as Record<string, unknown>,
    }));
  return [...promptCards, ...imageCards, ...workflowCards];
};

const buildScene = (
  viewModels: CanvasCardViewModel[],
  positionOverrides: Record<string, { x: number; y: number }>,
  workflowEdges: Canvas['workflow'] extends infer T
    ? T extends { edges: infer E }
      ? E
      : never
    : never,
): MobileCanvasScene => {
  if (viewModels.length === 0) {
    return { cards: [], edges: [], width: 640, height: 640 };
  }
  const baseMinX = Math.min(...viewModels.map((card) => card.position.x));
  const baseMinY = Math.min(...viewModels.map((card) => card.position.y));
  const offsetX = WORLD_PADDING - baseMinX;
  const offsetY = WORLD_PADDING - baseMinY;
  const cards = viewModels.map((viewModel) => {
    const position = positionOverrides[viewModel.id] || viewModel.position;
    return { viewModel, x: position.x + offsetX, y: position.y + offsetY };
  });
  const byId = new Map(cards.map((card) => [card.viewModel.id, card]));
  const relations = [
    ...viewModels
      .filter((card) => card.parentId)
      .map((card) => ({
        id: `${card.parentId}:${card.id}`,
        from: card.parentId as string,
        to: card.id,
        role: 'result' as const,
        state: 'active' as const,
      })),
    ...((workflowEdges || []) as NonNullable<Canvas['workflow']>['edges']),
  ];
  const uniqueRelations = [...new Map(relations.map((edge) => [edge.id, edge])).values()];
  const edges = uniqueRelations.flatMap<CanvasV3EdgeRenderItem>((edge) => {
    const source = byId.get(edge.from);
    const target = byId.get(edge.to);
    if (!source || !target) return [];
    return [{
      viewModel: {
        id: edge.id,
        sourceNodeId: edge.from,
        sourcePortId: `${edge.from}:output`,
        targetNodeId: edge.to,
        targetPortId: `${edge.to}:input`,
        role: edge.role || 'result',
        state: edge.state || 'active',
      },
      source: { x: source.x + source.viewModel.width, y: source.y + 72 },
      target: { x: target.x, y: target.y + 72 },
    }];
  });
  const width = Math.max(640, ...cards.map((card) => card.x + card.viewModel.width + WORLD_PADDING));
  const height = Math.max(640, ...cards.map((card) => card.y + CARD_ESTIMATED_HEIGHT + WORLD_PADDING));
  return { cards, edges, width, height };
};

const CanvasCardBody: React.FC<{ viewModel: CanvasCardViewModel }> = ({ viewModel }) => {
  if (viewModel.media?.sourceUrl) {
    return (
      <div className="kk-mobile-canvas-card__media">
        <img src={viewModel.media.sourceUrl} alt="" draggable={false} />
      </div>
    );
  }
  return (
    <p className="kk-mobile-canvas-card__copy">
      {viewModel.summary || viewModel.title}
    </p>
  );
};

/**
 * Mobile Canvas V3 uses the persisted canvas as its source of truth while
 * keeping gesture transforms and in-flight drag coordinates local to this view.
 */
const MobileCanvasV3Surface: React.FC<MobileCanvasV3SurfaceProps> = ({
  activeCanvas,
  composer,
  userName,
  userAvatarUrl,
  onOpenProfile,
}) => {
  const {
    linkNodes,
    updateImageNodePosition,
    updatePromptNodePosition,
    updateWorkflowNodePosition,
  } = useCanvas();
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformFrameRef = useRef<number | null>(null);
  const positionFrameRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<ViewTransform | null>(null);
  const pendingPositionsRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  const positionOverridesRef = useRef<Record<string, { x: number; y: number }>>({});
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; transform: ViewTransform } | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const fittedCanvasIdRef = useRef<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 390, height: 844 });
  const [transform, setTransform] = useState<ViewTransform>({ x: 20, y: 72, scale: 0.8 });
  const transformRef = useRef(transform);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const viewModels = useMemo(() => buildViewModels(activeCanvas), [activeCanvas]);
  const scene = useMemo(
    () => buildScene(viewModels, positionOverrides, activeCanvas?.workflow?.edges || []),
    [activeCanvas?.workflow?.edges, positionOverrides, viewModels],
  );
  const selectedCard = scene.cards.find((card) => card.viewModel.id === selectedNodeId) || null;

  const scheduleTransform = useCallback((nextTransform: ViewTransform) => {
    transformRef.current = nextTransform;
    pendingTransformRef.current = nextTransform;
    if (transformFrameRef.current !== null) return;
    transformFrameRef.current = window.requestAnimationFrame(() => {
      if (pendingTransformRef.current) setTransform(pendingTransformRef.current);
      transformFrameRef.current = null;
    });
  }, []);

  const scheduleNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    const nextPositions = { ...positionOverridesRef.current, [nodeId]: position };
    positionOverridesRef.current = nextPositions;
    pendingPositionsRef.current = nextPositions;
    if (positionFrameRef.current !== null) return;
    positionFrameRef.current = window.requestAnimationFrame(() => {
      if (pendingPositionsRef.current) setPositionOverrides(pendingPositionsRef.current);
      positionFrameRef.current = null;
    });
  }, []);

  const fitScene = useCallback(() => {
    const horizontalScale = (viewportSize.width - 28) / scene.width;
    const verticalScale = (viewportSize.height - 218) / scene.height;
    const scale = clampScale(Math.min(0.92, horizontalScale, verticalScale));
    scheduleTransform({
      x: Math.round((viewportSize.width - scene.width * scale) / 2),
      y: Math.round(62 + Math.max(0, (viewportSize.height - 218 - scene.height * scale) / 2)),
      scale,
    });
  }, [scene.height, scene.width, scheduleTransform, viewportSize.height, viewportSize.width]);

  const focusPrimaryScene = useCallback(() => {
    const primaryCard = scene.cards.find((card) => card.viewModel.kind === 'prompt') || scene.cards[0];
    if (!primaryCard) {
      fitScene();
      return;
    }
    const readableScale = viewportSize.width >= 600 ? TABLET_READABLE_SCALE : MOBILE_READABLE_SCALE;
    scheduleTransform({
      x: 14 - primaryCard.x * readableScale,
      y: 92 - primaryCard.y * readableScale,
      scale: readableScale,
    });
  }, [fitScene, scene.cards, scheduleTransform, viewportSize.width]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    positionOverridesRef.current = {};
    setPositionOverrides({});
    setSelectedNodeId(null);
    setConnectingFromId(null);
    fittedCanvasIdRef.current = null;
  }, [activeCanvas?.id]);

  useEffect(() => {
    if (!activeCanvas?.id || fittedCanvasIdRef.current === activeCanvas.id || viewportSize.width <= 0) return;
    fittedCanvasIdRef.current = activeCanvas.id;
    focusPrimaryScene();
  }, [activeCanvas?.id, focusPrimaryScene, viewportSize.width]);

  useEffect(() => () => {
    if (transformFrameRef.current !== null) window.cancelAnimationFrame(transformFrameRef.current);
    if (positionFrameRef.current !== null) window.cancelAnimationFrame(positionFrameRef.current);
  }, []);

  const startPinch = useCallback(() => {
    if (pointersRef.current.size < 2) return;
    const center = getPointerCenter(pointersRef.current);
    const currentTransform = transformRef.current;
    pinchRef.current = {
      distance: Math.max(1, getPointerDistance(pointersRef.current)),
      anchorX: (center.x - currentTransform.x) / currentTransform.scale,
      anchorY: (center.y - currentTransform.y) / currentTransform.scale,
      transform: currentTransform,
    };
    panStartRef.current = null;
  }, []);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      startPinch();
      return;
    }
    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      transform: transformRef.current,
    };
    setSelectedNodeId(null);
    setConnectingFromId(null);
  }, [startPinch]);

  const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const center = getPointerCenter(pointersRef.current);
      const scale = clampScale(
        pinchRef.current.transform.scale
          * (getPointerDistance(pointersRef.current) / pinchRef.current.distance),
      );
      scheduleTransform({
        x: center.x - pinchRef.current.anchorX * scale,
        y: center.y - pinchRef.current.anchorY * scale,
        scale,
      });
      return;
    }
    const panStart = panStartRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) return;
    scheduleTransform({
      ...panStart.transform,
      x: panStart.transform.x + event.clientX - panStart.x,
      y: panStart.transform.y + event.clientY - panStart.y,
    });
  }, [scheduleTransform]);

  const handleCanvasPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    panStartRef.current = null;
    if (pointersRef.current.size === 1) {
      const [pointerId, pointer] = [...pointersRef.current.entries()][0];
      panStartRef.current = {
        pointerId,
        x: pointer.x,
        y: pointer.y,
        transform: transformRef.current,
      };
    }
  }, []);

  const persistNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    if (activeCanvas?.promptNodes.some((node) => node.id === nodeId)) {
      updatePromptNodePosition(nodeId, position, { ignoreSelection: true });
      return;
    }
    if (activeCanvas?.imageNodes.some((node) => node.id === nodeId)) {
      updateImageNodePosition(nodeId, position, { ignoreSelection: true });
      return;
    }
    if (activeCanvas?.workflow?.nodes.some((node) => node.id === nodeId)) {
      updateWorkflowNodePosition(nodeId, position);
    }
  }, [activeCanvas, updateImageNodePosition, updatePromptNodePosition, updateWorkflowNodePosition]);

  const connectCards = useCallback((sourceId: string, targetId: string) => {
    const promptIds = new Set(activeCanvas?.promptNodes.map((node) => node.id) || []);
    const imageIds = new Set(activeCanvas?.imageNodes.map((node) => node.id) || []);
    if (promptIds.has(sourceId) && imageIds.has(targetId)) linkNodes(sourceId, targetId);
    if (imageIds.has(sourceId) && promptIds.has(targetId)) linkNodes(targetId, sourceId);
    setConnectingFromId(null);
  }, [activeCanvas?.imageNodes, activeCanvas?.promptNodes, linkNodes]);

  const handleCardPointerDown = useCallback((
    event: React.PointerEvent<HTMLDivElement>,
    card: SceneCard,
  ) => {
    event.stopPropagation();
    if (connectingFromId && connectingFromId !== card.viewModel.id) {
      connectCards(connectingFromId, card.viewModel.id);
      setSelectedNodeId(card.viewModel.id);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(card.viewModel.id);
    setComposerExpanded(false);
    dragRef.current = {
      pointerId: event.pointerId,
      nodeId: card.viewModel.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: positionOverridesRef.current[card.viewModel.id] || card.viewModel.position,
    };
  }, [connectCards, connectingFromId]);

  const handleCardPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const scale = transformRef.current.scale;
    scheduleNodePosition(drag.nodeId, {
      x: drag.startPosition.x + (event.clientX - drag.startClientX) / scale,
      y: drag.startPosition.y + (event.clientY - drag.startClientY) / scale,
    });
  }, [scheduleNodePosition]);

  const handleCardPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const finalPosition = positionOverridesRef.current[drag.nodeId] || drag.startPosition;
    persistNodePosition(drag.nodeId, finalPosition);
    dragRef.current = null;
  }, [persistNodePosition]);

  const zoomBy = useCallback((factor: number) => {
    const center = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
    const current = transformRef.current;
    const scale = clampScale(current.scale * factor);
    const worldX = (center.x - current.x) / current.scale;
    const worldY = (center.y - current.y) / current.scale;
    scheduleTransform({
      x: center.x - worldX * scale,
      y: center.y - worldY * scale,
      scale,
    });
  }, [scheduleTransform, viewportSize.height, viewportSize.width]);

  const centerSelectedCard = useCallback(() => {
    if (!selectedCard) return;
    const scale = Math.max(0.72, transformRef.current.scale);
    scheduleTransform({
      x: viewportSize.width / 2 - (selectedCard.x + selectedCard.viewModel.width / 2) * scale,
      y: viewportSize.height / 2 - selectedCard.y * scale,
      scale,
    });
  }, [scheduleTransform, selectedCard, viewportSize.height, viewportSize.width]);

  return (
    <section
      ref={viewportRef}
      data-testid="mobile-canvas-v3"
      className="kk-mobile-canvas-v3 fixed inset-0 overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerEnd}
      onPointerCancel={handleCanvasPointerEnd}
    >
      <div className="kk-mobile-canvas-v3__topbar">
        <button type="button" className="kk-mobile-canvas-v3__profile" onClick={onOpenProfile} aria-label="账户">
          {userAvatarUrl ? <img src={userAvatarUrl} alt="" /> : <span>{userName.slice(0, 1).toUpperCase()}</span>}
        </button>
        <div className="kk-mobile-canvas-v3__title">
          <strong>{activeCanvas?.name || '画布'}</strong>
          <span>{scene.cards.length} 张卡片</span>
        </div>
        <div className="kk-mobile-canvas-v3__view-tools" aria-label="画布视图">
          <button type="button" onClick={() => zoomBy(0.85)} aria-label="缩小"><Minus size={17} /></button>
          <button type="button" onClick={() => zoomBy(1.18)} aria-label="放大"><Plus size={17} /></button>
          <button type="button" onClick={fitScene} aria-label="适应画布"><Focus size={17} /></button>
        </div>
      </div>

      {connectingFromId ? (
        <div className="kk-mobile-canvas-v3__connection-hint">
          <Link2 size={15} />
          轻触目标卡片完成连接
          <button type="button" onClick={() => setConnectingFromId(null)} aria-label="取消连接"><X size={15} /></button>
        </div>
      ) : null}

      <div
        className="kk-mobile-canvas-v3__world"
        style={{
          width: scene.width,
          height: scene.height,
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
        }}
      >
        <CanvasEdgeLayer
          edges={scene.edges}
          width={scene.width}
          height={scene.height}
          reducedMotion={window.matchMedia('(prefers-reduced-motion: reduce)').matches}
        />
        {scene.cards.map((card) => (
          <div
            key={card.viewModel.id}
            className="kk-mobile-canvas-card"
            style={{ left: card.x, top: card.y }}
            onPointerDown={(event) => handleCardPointerDown(event, card)}
            onPointerMove={handleCardPointerMove}
            onPointerUp={handleCardPointerEnd}
            onPointerCancel={handleCardPointerEnd}
            onContextMenu={(event) => {
              event.preventDefault();
              setSelectedNodeId(card.viewModel.id);
            }}
          >
            <CanvasV3Card
              viewModel={card.viewModel}
              renderState={{
                detailLevel: resolveCanvasV3DetailLevel(transform.scale),
                selected: selectedNodeId === card.viewModel.id,
                dragging: dragRef.current?.nodeId === card.viewModel.id,
                mobile: true,
              }}
            >
              <CanvasCardBody viewModel={card.viewModel} />
            </CanvasV3Card>
          </div>
        ))}
      </div>

      {scene.cards.length === 0 ? (
        <div className="kk-mobile-canvas-v3__empty">
          <strong>从一次创作开始</strong>
          <span>生成内容后，卡片与连接会自动出现在这里。</span>
        </div>
      ) : null}

      {selectedCard ? (
        <aside className="kk-mobile-canvas-inspector" aria-label="卡片检查器">
          <div className="kk-mobile-canvas-inspector__handle" />
          <div className="kk-mobile-canvas-inspector__heading">
            <div>
              <strong>{selectedCard.viewModel.title}</strong>
              <span>{selectedCard.viewModel.statusLabel} · {selectedCard.viewModel.metadata.map((item) => item.value).join(' · ')}</span>
            </div>
            <button type="button" onClick={() => setSelectedNodeId(null)} aria-label="关闭检查器"><X size={17} /></button>
          </div>
          <div className="kk-mobile-canvas-inspector__actions">
            <button type="button" onClick={centerSelectedCard}><Focus size={16} />定位</button>
            <button
              type="button"
              data-active={connectingFromId === selectedCard.viewModel.id || undefined}
              onClick={() => setConnectingFromId(selectedCard.viewModel.id)}
            >
              <Link2 size={16} />连接
            </button>
          </div>
        </aside>
      ) : composerExpanded ? (
        <div className="kk-mobile-canvas-composer">
          <button
            type="button"
            className="kk-mobile-canvas-composer__collapse"
            onClick={() => setComposerExpanded(false)}
            aria-label="收起输入框"
          >
            <ChevronDown size={17} />
          </button>
          {composer}
        </div>
      ) : (
        <button
          type="button"
          className="kk-mobile-canvas-composer-trigger"
          onClick={() => setComposerExpanded(true)}
        >
          <Plus size={17} />
          输入提示词
        </button>
      )}
    </section>
  );
};

export default MobileCanvasV3Surface;
