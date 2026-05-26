import { type Canvas} from '../types';
import { featureFlags } from '../config/featureFlags';
import { syncCanvasWorkflow } from '../workflow/adapters/canvasToWorkflow';
import { migrateLegacyEcommerceFrameworkCanvas } from '../services/ecommerce/frameworkRuntime.ts';

export const syncCanvasCompatibility = (canvas: Canvas): Canvas =>
    migrateLegacyEcommerceFrameworkCanvas(
        syncCanvasWorkflow(canvas, featureFlags.experimentalWorkflowGraph)
    );
