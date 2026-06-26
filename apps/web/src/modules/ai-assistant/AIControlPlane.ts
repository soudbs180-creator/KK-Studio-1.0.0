import { taskOrchestrator } from '../../core/orchestration/TaskOrchestrator';
import { KKIntent } from '../../core/orchestration/taskIntent';
import { canvasRuntime } from '../../core/canvas/CanvasRuntime';

export class AIControlPlane {
  private static instance: AIControlPlane;

  private constructor() {}

  public static getInstance(): AIControlPlane {
    if (!AIControlPlane.instance) {
      AIControlPlane.instance = new AIControlPlane();
    }
    return AIControlPlane.instance;
  }

  /**
   * Run a multi-step workflow task orchestrated by the AI agent
   */
  public async executeWorkflow(
    userGoal: string,
    canvasContext: any,
    steps: KKIntent[]
  ): Promise<{
    success: boolean;
    results: any[];
    summary: string;
  }> {
    console.log(`[AIControlPlane] Orchestrating workflow for goal: "${userGoal}"`);
    const results: any[] = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[AIControlPlane] Executing step ${i + 1}/${steps.length}: ${step.type}`);
      const res = await taskOrchestrator.orchestrate(step);
      results.push(res);

      if (!res.success) {
        return {
          success: false,
          results,
          summary: `Workflow interrupted at step ${i + 1} (${step.type}): ${res.error}`
        };
      }

      if (step.type === 'generation' && res.data?.url) {
        canvasRuntime.createNode(canvasContext, {
          type: 'image_card',
          x: 100 + i * 250,
          y: 200,
          data: {
            url: res.data.url,
            prompt: step.prompt,
            model: step.modelId
          }
        });
      }
    }

    return {
      success: true,
      results,
      summary: `Successfully completed all ${steps.length} steps for goal: "${userGoal}"`
    };
  }
}

export const aiControlPlane = AIControlPlane.getInstance();
