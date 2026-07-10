import React from 'react';
import PromptNodeComponent from '../../../components/canvas/PromptNodeComponent';
import { resolvePromptGroupCreditDisplay } from '../../../utils/creditBilling';
import ImageNode from '../../../components/image/ImageCard';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const VideoGenerationGroupRenderer: React.FC<CanvasCardRenderContext> = ({
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
  subCardLayoutMode,
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

  const promptGroupCreditDisplay = resolvePromptGroupCreditDisplay(node);
  // 3. Full / Compact rendering
  const promptGroupLayoutState = promptGroupLayoutStateByIdRef.current[node.id];
  const groupStackZIndex = promptGroupStackZIndexById.get(node.id) ?? ((groupView.baseOrder * 100) + 10);
  const sourceImageNode = node.sourceImageId ? imageNodesById.get(node.sourceImageId) : null;
  const groupNodeIds = promptGroupNodeIdsById.get(node.id) || [node.id];

  const renderPromptCard = (
    renderedPromptNode: typeof node,
    renderedDetailLevel: typeof detailLevel,
    stackZIndex: number,
    hasShadowBoost: boolean,
    isGroupFocused: boolean,
  ) => (
    <PromptNodeComponent
      node={{
        ...renderedPromptNode,
        modelLabel: renderedPromptNode.modelLabel || 'Video Model',
      }}
      detailLevel={renderedDetailLevel}
      groupLayerZIndex={promptGroupLayerById.get(node.id) ?? node.zIndex ?? 0}
      stackZIndexOverride={stackZIndex}
      shadowBoost={hasShadowBoost}
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
  );

  if (detailLevel === 'ghost' || detailLevel === 'skeleton') {
    const lightweightPosition = resolveLivePromptPosition(node) ?? node.position;
    const lightweightNode = lightweightPosition.x === node.position.x && lightweightPosition.y === node.position.y
      ? node
      : { ...node, position: lightweightPosition };
    const lightweightDetailLevel = detailLevel === 'skeleton' ? 'compact' : 'ghost';

    return renderPromptCard(lightweightNode, lightweightDetailLevel, groupStackZIndex + 20, false, false);
  }

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
    layoutMode: subCardLayoutMode,
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

      {/* Main Prompt Card */}
      {renderPromptCard(renderedPromptNode, promptDetailLevel, promptCardZIndex, shadowBoost, isGroupFocused)}

      {/* Video Result Frames (Atomic Unit Rendering - No internal sub-culling) */}
      {childVisualLayouts.map((childLayout: any, childIndex: number) => {
        const imageProps = getSharedImageNodeProps(childLayout.childNode);
        return (
          <React.Fragment key={childLayout.childNode.id}>
            <div className="relative pointer-events-auto" style={{ zIndex: promptCardZIndex + 10 + childIndex }}>
              <ImageNode
                id={`image-card-${childLayout.childNode.id}`}
                {...imageProps}
                isCreditModelOverride={promptGroupCreditDisplay.isCreditModel}
                creditCostOverride={promptGroupCreditDisplay.creditCost}
                detailLevel={detailLevel}
                loadPriority={imageLoadSchedulingById.get(childLayout.childNode.id)?.loadPriority ?? 0}
                loadBand={imageLoadSchedulingById.get(childLayout.childNode.id)?.loadBand ?? 0}
                groupLayerZIndex={promptGroupLayerById.get(node.id) ?? childLayout.childNode.zIndex ?? 0}
                stackZIndexOverride={promptCardZIndex + 10 + childIndex}
                shadowBoost={shadowBoost}
                position={childLayout.visualPosition}
                onLivePositionChange={handleLiveNodePositionChange}
                onHeightChange={handleImageCardHeightChange}
                isVisible={true} // Atomic rendering: child is always rendered if parent is mounted
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
              {/* Custom Overlays for Video Node */}
              <div 
                className="absolute flex items-center justify-center bg-black/30 hover:bg-black/10 rounded-lg pointer-events-none"
                style={{
                  left: `${childLayout.visualPosition.x - 200}px`,
                  top: `${childLayout.visualPosition.y - 300}px`,
                  width: '400px',
                  height: '300px',
                }}
              >
                {/* Play Button Icon Overlay */}
                <div className="w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/30 cursor-pointer shadow-lg">
                  <svg className="w-6 h-6 fill-current text-white translate-x-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                
                {/* Video Info Badge */}
                <div className="absolute bottom-3 right-3 bg-zinc-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-zinc-300 font-semibold flex items-center gap-1.5 border border-white/10">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  <span>MP4</span>
                  <span>4.0s</span>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default VideoGenerationGroupRenderer;
