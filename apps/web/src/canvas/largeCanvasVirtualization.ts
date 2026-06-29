import type { GeneratedImage } from '../types';
import type { ScheduledImageLoadState } from '../app/appCanvasTypes';
import { ImageQuality } from '../services/image/imageQuality.ts';
import type { CachedCardMeta } from '../services/storage/offlineDb';

export interface CanvasLayerMetaSelectionArgs {
  cardMetaById: Map<string, CachedCardMeta>;
  visibleCardIds: Set<string>;
  selectedNodeIds: Set<string>;
  activeSourceImage: string | null;
}

export interface ViewportImageLoadSchedulingArgs {
  imageNodes: Array<Pick<GeneratedImage, 'id' | 'position'>>;
  collapsedCanvasGroupNodeIds: Set<string>;
  canvasTransform: { x: number; y: number; scale: number };
  viewportWidth: number;
  viewportHeight: number;
}

export function buildCanvasLayerMetaLookup(cardMetas: CachedCardMeta[]): Map<string, CachedCardMeta> {
  const lookup = new Map<string, CachedCardMeta>();
  cardMetas.forEach((meta) => {
    if (meta.type === 'image') {
      lookup.set(meta.id, meta);
    }
  });
  return lookup;
}

export function selectCanvasLayerMetasForPaint({
  cardMetaById,
  visibleCardIds,
  selectedNodeIds,
  activeSourceImage,
}: CanvasLayerMetaSelectionArgs): CachedCardMeta[] {
  const selected: CachedCardMeta[] = [];

  visibleCardIds.forEach((id) => {
    if (selectedNodeIds.has(id) || id === activeSourceImage) {
      return;
    }

    const meta = cardMetaById.get(id);
    if (meta?.type === 'image') {
      selected.push(meta);
    }
  });

  return selected;
}

export function buildViewportImageLoadScheduling({
  imageNodes,
  collapsedCanvasGroupNodeIds,
  canvasTransform,
  viewportWidth,
  viewportHeight,
}: ViewportImageLoadSchedulingArgs): Map<string, ScheduledImageLoadState> {
  const scheduling = new Map<string, ScheduledImageLoadState>();
  const scale = canvasTransform.scale || 1;
  const viewportLeft = -canvasTransform.x / scale;
  const viewportTop = -canvasTransform.y / scale;
  const viewportRight = (viewportWidth - canvasTransform.x) / scale;
  const viewportBottom = (viewportHeight - canvasTransform.y) / scale;
  const viewportCenterX = (viewportLeft + viewportRight) / 2;
  const viewportCenterY = (viewportTop + viewportBottom) / 2;

  const viewportImages: Array<{ node: Pick<GeneratedImage, 'id' | 'position'>; distance: number }> = [];
  const aboveViewportImages: Array<{ node: Pick<GeneratedImage, 'id' | 'position'>; distance: number }> = [];
  const belowViewportImages: Array<Pick<GeneratedImage, 'id' | 'position'>> = [];
  const lateralImages: Array<{ node: Pick<GeneratedImage, 'id' | 'position'>; distance: number }> = [];

  imageNodes.forEach((node) => {
    if (collapsedCanvasGroupNodeIds.has(node.id)) {
      return;
    }

    const width = 800;
    const height = 1200;
    const left = node.position.x - width / 2;
    const top = node.position.y - height;
    const right = left + width;
    const bottom = top + height;
    const intersectsViewport = !(left > viewportRight || right < viewportLeft || top > viewportBottom || bottom < viewportTop);

    if (intersectsViewport) {
      viewportImages.push({
        node,
        distance: Math.abs(node.position.x - viewportCenterX) + Math.abs(node.position.y - viewportCenterY),
      });
      return;
    }

    if (bottom < viewportTop) {
      aboveViewportImages.push({
        node,
        distance: viewportTop - bottom,
      });
      return;
    }

    if (top > viewportBottom) {
      belowViewportImages.push(node);
      return;
    }

    lateralImages.push({
      node,
      distance: Math.min(
        Math.abs(left - viewportRight),
        Math.abs(right - viewportLeft)
      ),
    });
  });

  viewportImages
    .sort((left, right) => left.distance - right.distance)
    .forEach(({ node }, index) => {
      scheduling.set(node.id, {
        loadBand: 0,
        loadPriority: 1400 - index,
        prefetchQuality: ImageQuality.PREVIEW,
      });
    });

  aboveViewportImages
    .sort((left, right) => left.distance - right.distance)
    .forEach(({ node }, index) => {
      scheduling.set(node.id, {
        loadBand: 1,
        loadPriority: 1100 - index,
        prefetchQuality: ImageQuality.THUMBNAIL,
      });
    });

  lateralImages
    .sort((left, right) => left.distance - right.distance)
    .forEach(({ node }, index) => {
      scheduling.set(node.id, {
        loadBand: 1,
        loadPriority: 1000 - index,
        prefetchQuality: ImageQuality.THUMBNAIL,
      });
    });

  const orderedBelowViewportImages = [...belowViewportImages].sort((left, right) => left.position.y - right.position.y);
  const belowSegmentSize = Math.max(1, Math.ceil(orderedBelowViewportImages.length / 3));

  orderedBelowViewportImages.forEach((node, index) => {
    const segment = Math.min(2, Math.floor(index / belowSegmentSize));
    const loadBand = (segment === 0 ? 1 : segment === 1 ? 2 : 3) as 1 | 2 | 3;
    const priorityBase = segment === 0 ? 900 : segment === 1 ? 700 : 500;

    scheduling.set(node.id, {
      loadBand,
      loadPriority: priorityBase - (index % belowSegmentSize),
      prefetchQuality: loadBand === 1 ? ImageQuality.THUMBNAIL : ImageQuality.MICRO,
    });
  });

  return scheduling;
}
