import React from 'react';
import PromptNodeComponent from '../../../components/canvas/PromptNodeComponent';
import { isCreditBillingTarget } from '../../../utils/creditBilling';
import ImageNode from '../../../components/image/ImageCard';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const ImageGenerationGroupRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
  highlighted,
  zoomScale,
  isMobile,
  canvasTransform,
  generatingGroupIds,
  focusedGroupId,
  promptGroupLayerById,
  promptGroupStackZIndexById,
  promptGroupRegroupLayoutsById,
  imageCardHeightById,
  imageNodesById,
  promptGroupNodeIdsById,
  promptGroupLayoutStateByIdRef,
  imageLoadSchedulingById,
  selectedNodeIds,
  highlightedIdVal,
  snapToGrid,
  isCanvasTransforming,
  nowTimestamp,
  ecommerceFrameworkTaskNodesById,
  handlePromptGroupChildDragCommit,
  handlePromptGroupChildDragDelta,
  handlePromptGroupDragCommit,
  handlePromptGroupDragDelta,
  handlePromptGroupNodeHeightChange,
  handlePromptGroupNodeSelect,
  handlePromptGroupTagRemove,
  handleConnectStart,
  handleCanvasNodeDragStateChange,
  handleCanvasCardClick,
  handleLiveNodePositionChange,
  handleFocusPromptGroup,
  getSharedImageNodeProps,
  getSharedPromptNodeActionProps,
  handlePinDraft,
  resolveLiveImagePosition,
  resolveLivePromptPosition,
  buildPromptGroupRenderLayout,
  visibleImageIdSet,
  handleImageCardHeightChange,
}) => {
  const node = item.node;
  const groupView = item.groupView;
  const visibleChildImages = groupView.childImages;

  const promptWidth = 320;
  const promptHeight = node.height || 180;
  const promptPos = resolveLivePromptPosition(node) ?? node.position;
  const left = promptPos.x - promptWidth / 2;
  const top = promptPos.y - promptHeight;
  const groupStackZIndex = promptGroupStackZIndexById.get(node.id) ?? ((groupView.baseOrder * 100) + 10);

  const isCreditModel = isCreditBillingTarget(node);
  const promptGroupLayoutState = promptGroupLayoutStateByIdRef.current[node.id];
  const sourceImageNode = node.sourceImageId ? imageNodesById.get(node.sourceImageId) : null;
  const groupNodeIds = promptGroupNodeIdsById.get(node.id) || [node.id];

  const {
    isGroupFocused,
    promptDetailLevel,
    shadowBoost,
    connectorLayerZIndex,
    promptCardZIndex,
    groupConnectorStroke,
    groupConnectorDash,
    connectorSvgLeft,
    connectorSvgTop,
    connectorSvgWidth,
    connectorSvgHeight,
    connectorOpacity,
    renderedPromptNode,
    childVisualLayouts,
    groupConnectorLayouts,
  } = buildPromptGroupRenderLayout({
    item,
    groupStackZIndex,
    focusedGroupId,
    generatingGroupIds,
    canvasScale: zoomScale,
    promptGroupLayoutState,
    regroupLayoutsById: promptGroupRegroupLayoutsById.get(node.id) ?? new Map(),
    imageCardHeightById,
    resolveLivePromptPosition,
    resolveLiveImagePosition,
  });

  return (
    <>
      {groupConnectorLayouts.length > 0 && (
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          shapeRendering="geometricPrecision"
          width={connectorSvgWidth}
          height={connectorSvgHeight}
          viewBox={`0 0 ${connectorSvgWidth} ${connectorSvgHeight}`}
          style={{
            width: `${connectorSvgWidth}px`,
            height: `${connectorSvgHeight}px`,
            left: `${connectorSvgLeft}px`,
            top: `${connectorSvgTop}px`,
            overflow: 'visible',
            zIndex: connectorLayerZIndex,
          }}
        >
          <g>
            {groupConnectorLayouts
              .filter((segment: any) => visibleImageIdSet.has(segment.imageId))
              .map((segment: any) => (
                <path
                  id={`connector-${segment.key}`}
                  key={segment.key}
                  d={segment.path}
                  fill="none"
                  stroke="var(--connector-color, #6366f1)"
                  strokeWidth={groupConnectorStroke}
                  strokeDasharray={groupConnectorDash}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={connectorOpacity}
                />
              ))}
          </g>
        </svg>
      )}

      <PromptNodeComponent
        node={renderedPromptNode}
        detailLevel={promptDetailLevel}
        groupLayerZIndex={promptGroupLayerById.get(node.id) ?? node.zIndex ?? 0}
        stackZIndexOverride={promptCardZIndex}
        shadowBoost={shadowBoost}
        actualChildImageCount={visibleChildImages.length}
        onPositionChange={handleLiveNodePositionChange}
        isSelected={isSelected}
        highlighted={highlightedIdVal === node.id || isGroupFocused}
        onBringToFront={() => handleFocusPromptGroup(node.id, { keepSelection: true })}
        onSelect={() => handlePromptGroupNodeSelect(node.id, node.id)}
        onClickPrompt={getSharedPromptNodeActionProps(renderedPromptNode).onClickPrompt}
        onConnectStart={handleConnectStart}
        zoomScale={zoomScale}
        snapToGrid={snapToGrid}
        isCanvasTransforming={isCanvasTransforming}
        isMobile={isMobile}
        sourcePosition={sourceImageNode ? (resolveLiveImagePosition(sourceImageNode) ?? sourceImageNode.position) : undefined}
        ecommerceFrameworkTaskNodes={ecommerceFrameworkTaskNodesById.get(renderedPromptNode.id) || []}
        {...getSharedPromptNodeActionProps(renderedPromptNode)}
        onLivePositionChange={handleLiveNodePositionChange}
        onHeightChange={(id, height) => {
          handlePromptGroupNodeHeightChange(node, id, height);
        }}
        onPin={handlePinDraft}
        onRemoveTag={handlePromptGroupTagRemove}
        onDragDelta={(delta, sourceNodeId) => {
          handlePromptGroupDragDelta({
            node,
            childImages: visibleChildImages,
            groupNodeIds,
            delta,
            sourceNodeId,
          });
        }}
        onDragCommit={(delta, sourceNodeId, finalPosition) => {
          handlePromptGroupDragCommit({
            node,
            childImages: visibleChildImages,
            delta,
            sourceNodeId,
            finalPosition,
          });
        }}
        canvasTransform={canvasTransform}
        onDragStateChange={handleCanvasNodeDragStateChange}
      />

      {childVisualLayouts.map((childLayout: any, childIndex: number) => (
        <React.Fragment key={childLayout.childNode.id}>
          <ImageNode
            id={`image-card-${childLayout.childNode.id}`}
            {...getSharedImageNodeProps(childLayout.childNode)}
            isCreditModelOverride={isCreditModel}
            detailLevel={detailLevel}
            loadPriority={imageLoadSchedulingById.get(childLayout.childNode.id)?.loadPriority ?? 0}
            loadBand={imageLoadSchedulingById.get(childLayout.childNode.id)?.loadBand ?? 0}
            groupLayerZIndex={promptGroupLayerById.get(node.id) ?? childLayout.childNode.zIndex ?? 0}
            stackZIndexOverride={promptCardZIndex + 10 + childIndex}
            shadowBoost={shadowBoost}
            position={childLayout.visualPosition}
            onLivePositionChange={handleLiveNodePositionChange}
            onHeightChange={handleImageCardHeightChange}
            isVisible={true}
            isCanvasTransforming={isCanvasTransforming}
            highlighted={highlightedIdVal === childLayout.childNode.id || isGroupFocused}
            isSelected={selectedNodeIds.includes(childLayout.childNode.id)}
            onSelect={() => handlePromptGroupNodeSelect(node.id, childLayout.childNode.id)}
            onDragStateChange={handleCanvasNodeDragStateChange}
            onDragDelta={(delta, sourceNodeId) => {
              handlePromptGroupChildDragDelta({
                groupId: node.id,
                delta,
                sourceNodeId,
              });
            }}
            onDragCommit={(delta, sourceNodeId) => {
              handlePromptGroupChildDragCommit({
                groupId: node.id,
                delta,
                sourceNodeId,
              });
            }}
          />
        </React.Fragment>
      ))}
    </>
  );
};
export default ImageGenerationGroupRenderer;
