import { type Canvas } from '../types';
import { featureFlags } from '../config/featureFlags';
import { syncCanvasWorkflow } from '../workflow/adapters/canvasToWorkflow';
import { migrateLegacyEcommerceFrameworkCanvas } from '../services/ecommerce/frameworkRuntime.ts';

type CanvasCompatibilityOptions = {
    preserveRestoredChildLayouts?: boolean;
};

const hasFinitePosition = (node: { position?: { x?: number; y?: number } }) => (
    Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y)
);

const preserveRestoredChildImageLayout = (canvas: Canvas): Canvas => {
    if (!canvas.imageNodes?.length) return canvas;

    let hasChanged = false;
    const imageNodes = canvas.imageNodes.map((imageNode) => {
        if (
            imageNode.userMoved !== undefined
            || !imageNode.parentPromptId
            || !hasFinitePosition(imageNode)
        ) {
            return imageNode;
        }

        hasChanged = true;
        return {
            ...imageNode,
            userMoved: true,
        };
    });

    return hasChanged ? { ...canvas, imageNodes } : canvas;
};

export const syncCanvasCompatibility = (canvas: Canvas, options?: CanvasCompatibilityOptions): Canvas => {
    const compatibleCanvas = migrateLegacyEcommerceFrameworkCanvas(
        syncCanvasWorkflow(canvas, featureFlags.experimentalWorkflowGraph)
    );

    return options?.preserveRestoredChildLayouts
        ? preserveRestoredChildImageLayout(compatibleCanvas)
        : compatibleCanvas;
};
