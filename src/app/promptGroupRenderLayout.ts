import type { CanvasCardDetailLevel } from '../canvas/performanceProfile';
import { buildDockedVerticalConnectorPath } from '../canvas/connectorGeometry';
import type { GeneratedImage, PromptNode } from '../types';
import { getCardDimensions } from '../utils/styleUtils';
import type {
  Point,
  PromptGroupLayoutPresentationState,
  PromptGroupRegroupLayout,
  PromptGroupRenderItem,
} from './appCanvasTypes';

interface BuildPromptGroupRenderLayoutArgs {
  item: PromptGroupRenderItem;
  groupStackZIndex: number;
  focusedGroupId: string | null;
  generatingGroupIds: string[];
  canvasScale: number;
  promptGroupLayoutState: PromptGroupLayoutPresentationState | undefined;
  regroupLayoutsById: Map<string, PromptGroupRegroupLayout>;
  imageCardHeightById: Record<string, number>;
  resolveLivePromptPosition: (promptNode: PromptNode | undefined | null) => Point | null;
  resolveLiveImagePosition: (imageNode: GeneratedImage | undefined | null) => Point | null;
}

function resolveChildImageHeight(childNode: GeneratedImage, renderedWidth: number) {
  const { totalHeight: theoreticalHeight } = getCardDimensions(childNode.aspectRatio, true);
  let imageHeight = theoreticalHeight;

  if (childNode.dimensions && typeof childNode.dimensions === 'string') {
    const match = childNode.dimensions.match(/(\d+)\s*[xX]\s*(\d+)/);
    if (match?.[1] && match?.[2]) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      if (width > 0 && height > 0) {
        imageHeight = (renderedWidth / (width / height)) + 40;
      }
    }
  }

  return imageHeight;
}

export function buildPromptGroupRenderLayout({
  item,
  groupStackZIndex,
  focusedGroupId,
  generatingGroupIds,
  canvasScale,
  promptGroupLayoutState,
  regroupLayoutsById,
  imageCardHeightById,
  resolveLivePromptPosition,
  resolveLiveImagePosition,
}: BuildPromptGroupRenderLayoutArgs) {
  const { groupView } = item;
  const node = groupView.rootPrompt;
  const isGroupFocused = focusedGroupId === node.id && groupView.isOverlapping;
  const isGeneratingGroup = generatingGroupIds.includes(node.id);
  const promptDetailLevel: CanvasCardDetailLevel = item.detailLevel === 'thumbnail-shell' ? 'compact' : item.detailLevel;
  const groupConnectorZoom = Math.max(canvasScale || 1, 0.5);
  const groupConnectorStroke = Math.max(0.95, Math.min(2.4, 1.1 / groupConnectorZoom));
  const groupConnectorDashLength = Math.max(2.5, Math.min(8, 3.5 / groupConnectorZoom));
  const groupConnectorGapLength = Math.max(3.5, Math.min(12, 6 / groupConnectorZoom));
  const promptCardZIndex = groupStackZIndex + 20;
  const connectorLayerZIndex = Math.max(0, groupStackZIndex - 1);
  const promptConnectorPosition = resolveLivePromptPosition(node) ?? node.position;
  const renderedPromptNode = (
    promptConnectorPosition.x === node.position.x && promptConnectorPosition.y === node.position.y
  )
    ? node
    : { ...node, position: promptConnectorPosition };
  const shadowBoost = isGroupFocused || isGeneratingGroup || groupView.isOverlapping || Boolean(promptGroupLayoutState);
  const connectorCanvasPadding = 128;

  const childVisualLayouts = groupView.childImages.map((childNode) => {
    const livePosition = resolveLiveImagePosition(childNode) ?? childNode.position;
    const regroupLayout = regroupLayoutsById.get(childNode.id);
    const { width: renderedWidth } = getCardDimensions(childNode.aspectRatio, true);
    const resolvedImageHeight = imageCardHeightById[childNode.id] ?? resolveChildImageHeight(childNode, renderedWidth);

    return {
      childNode,
      renderedWidth,
      resolvedImageHeight,
      livePosition,
      visualPosition: regroupLayout?.renderPosition ?? livePosition,
      settledPosition: regroupLayout?.settledPosition ?? livePosition,
    };
  });

  const connectorBounds = {
    minX: groupView.bounds.x,
    maxX: groupView.bounds.x + groupView.bounds.width,
    minY: groupView.bounds.y,
    maxY: groupView.bounds.y + groupView.bounds.height,
  };
  const connectorSvgLeft = connectorBounds.minX - connectorCanvasPadding;
  const connectorSvgTop = connectorBounds.minY - connectorCanvasPadding;
  const connectorSvgWidth = Math.max(1, (connectorBounds.maxX - connectorBounds.minX) + (connectorCanvasPadding * 2));
  const connectorSvgHeight = Math.max(1, (connectorBounds.maxY - connectorBounds.minY) + (connectorCanvasPadding * 2));

  const groupConnectorLayouts = childVisualLayouts.map((layout) => ({
    key: `${node.id}-${layout.childNode.id}`,
    path: buildDockedVerticalConnectorPath(
      promptConnectorPosition.x - connectorSvgLeft,
      promptConnectorPosition.y - connectorSvgTop,
      layout.visualPosition.x - connectorSvgLeft,
      (layout.visualPosition.y - layout.resolvedImageHeight) - connectorSvgTop,
    ),
  }));

  return {
    node,
    isGroupFocused,
    promptDetailLevel,
    shadowBoost,
    connectorLayerZIndex,
    promptCardZIndex,
    groupConnectorStroke,
    groupConnectorDash: `${groupConnectorDashLength} ${groupConnectorGapLength}`,
    connectorSvgLeft,
    connectorSvgTop,
    connectorSvgWidth,
    connectorSvgHeight,
    connectorOpacity: isGroupFocused ? 0.68 : 0.4,
    renderedPromptNode,
    childVisualLayouts,
    groupConnectorLayouts,
  };
}
