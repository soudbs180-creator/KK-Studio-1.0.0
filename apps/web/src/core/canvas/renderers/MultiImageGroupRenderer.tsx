import React from 'react';
import { Images, LayoutGrid, Layers3 } from 'lucide-react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry.ts';
import ImageGenerationGroupRenderer from './ImageGenerationGroupRenderer.tsx';

export const MultiImageGroupRenderer: React.FC<CanvasCardRenderContext> = (props) => {
  const node = props.item.node;
  const groupView = props.item.groupView;
  const allChildren = groupView.childImages || [];
  const view = node.presentation?.view || {};
  const expanded = view.expanded === true;
  const primaryId = allChildren.some((child: any) => child.id === view.primaryMediaNodeId)
    ? view.primaryMediaNodeId
    : allChildren[0]?.id;
  const orderedChildren = [
    ...allChildren.filter((child: any) => child.id === primaryId),
    ...allChildren.filter((child: any) => child.id !== primaryId),
  ];
  const visibleChildren = expanded ? orderedChildren : orderedChildren.slice(0, 1);
  const visibleIds = new Set(visibleChildren.map((child: any) => child.id));
  const nextItem = {
    ...props.item,
    childNodes: visibleChildren,
    groupView: {
      ...groupView,
      childImages: visibleChildren,
      intraGroupEdges: groupView.intraGroupEdges.filter((edge: any) => visibleIds.has(edge.toId)),
    },
  };
  const updateView = (updates: { expanded?: boolean; primaryMediaNodeId?: string }) => {
    const onUpdateNode = props.getSharedPromptNodeActionProps(node).onUpdateNode;
    onUpdateNode?.({
      ...node,
      presentation: {
        ...node.presentation,
        view: { ...view, ...updates },
      },
    });
  };
  const promptPosition = props.resolveLivePromptPosition(node) ?? node.position;
  const showControls = allChildren.length > 1 && props.detailLevel !== 'ghost' && props.detailLevel !== 'skeleton';
  const primaryIndex = Math.max(0, allChildren.findIndex((child: any) => child.id === primaryId));

  return (
    <>
      <ImageGenerationGroupRenderer
        {...props}
        item={nextItem}
        totalChildImageCount={allChildren.length}
      />
      {showControls && (
        <div
          data-multi-image-controls="true"
          className="absolute flex h-11 items-center gap-1 rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-main-bg)] p-1 shadow-lg"
          style={{
            left: promptPosition.x - 66,
            top: promptPosition.y - (node.height || 200) - 52,
            zIndex: (props.promptGroupStackZIndexById.get(node.id) || 1) + 60,
          }}
        >
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]"
            title={expanded ? 'Collapse image stack' : 'Expand image grid'}
            aria-label={expanded ? 'Collapse image stack' : 'Expand image grid'}
            onClick={(event) => {
              event.stopPropagation();
              updateView({ expanded: !expanded });
            }}
          >
            {expanded ? <Layers3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]"
            title="Set next image as primary"
            aria-label="Set next image as primary"
            onClick={(event) => {
              event.stopPropagation();
              const next = allChildren[(primaryIndex + 1) % allChildren.length];
              updateView({ primaryMediaNodeId: next.id });
            }}
          >
            <Images className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
};

export default MultiImageGroupRenderer;
