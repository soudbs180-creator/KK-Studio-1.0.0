import { KKIntent, GenerationIntent, BrowserTaskIntent } from './taskIntent';
import { TaskResult } from './taskResult';
import { capabilityRegistry } from '../capability/capabilityRegistry';
import { generationEngine } from '../generation/GenerationEngine';
import { browserActionRouter } from '../browser/BrowserActionRouter';
import { permissionPolicy } from '../permissions/PermissionPolicy';

export class TaskOrchestrator {
  private static instance: TaskOrchestrator;

  private constructor() {}

  public static getInstance(): TaskOrchestrator {
    if (!TaskOrchestrator.instance) {
      TaskOrchestrator.instance = new TaskOrchestrator();
    }
    return TaskOrchestrator.instance;
  }

  /**
   * Main dispatch method
   */
  public async orchestrate(intent: KKIntent): Promise<TaskResult> {
    const timestamp = Date.now();

    // 1. Safety and wind-control policies
    const requiresConfirm = await permissionPolicy.requiresConfirmation(intent);
    if (requiresConfirm) {
      console.log(`[TaskOrchestrator] WARNING: Action ${intent.type} requires user confirmation due to risk level.`);
    }

    try {
      switch (intent.type) {
        case 'generation':
          return await this.handleGeneration(intent, timestamp);
        case 'browser':
          return await this.handleBrowser(intent, timestamp);
        case 'slides':
          return await this.handleSlides(intent, timestamp);
        case 'ecommerce':
          return await this.handleEcommerce(intent, timestamp);
        case 'canvas':
          return await this.handleCanvas(intent, timestamp);
        default:
          throw new Error(`Unsupported intent type: ${(intent as any).type}`);
      }
    } catch (error: any) {
      return {
        success: false,
        intentType: intent.type || '',
        data: null,
        error: error.message || 'Unknown orchestration error',
        timestamp
      };
    }
  }

  private async handleGeneration(intent: GenerationIntent, timestamp: number): Promise<TaskResult> {
    // 1. Verify capability sources through registry
    const matchedSources = await capabilityRegistry.findSourcesForTask(intent.mediaType);
    if (matchedSources.length === 0) {
      throw new Error(`No available capability sources support task type: ${intent.mediaType}`);
    }

    // 2. Delegate to GenerationEngine
    const res = await generationEngine.generate(intent);
    return {
      success: true,
      intentType: 'generation',
      data: res,
      timestamp
    };
  }

  private async handleBrowser(intent: BrowserTaskIntent, timestamp: number): Promise<TaskResult> {
    // 1. Delegate to BrowserActionRouter to check permission and route
    const routeDecision = await browserActionRouter.route(intent, { isMobile: false });
    if (!routeDecision.allowed) {
      throw new Error(`Browser action blocked: ${routeDecision.reason}`);
    }

    // 2. Routed execution metadata response
    return {
      success: true,
      intentType: 'browser',
      data: {
        message: 'Browser task routed and executing',
        routeMode: routeDecision.routeMode,
        reason: routeDecision.reason
      },
      timestamp
    };
  }

  private async handleSlides(intent: any, timestamp: number): Promise<TaskResult> {
    return {
      success: true,
      intentType: 'slides',
      data: { message: 'Slides intent registered successfully' },
      timestamp
    };
  }

  private async handleEcommerce(intent: any, timestamp: number): Promise<TaskResult> {
    return {
      success: true,
      intentType: 'ecommerce',
      data: { message: 'Ecommerce intent registered successfully' },
      timestamp
    };
  }

  private async handleCanvas(intent: any, timestamp: number): Promise<TaskResult> {
    return {
      success: true,
      intentType: 'canvas',
      data: { message: 'Canvas intent registered successfully' },
      timestamp
    };
  }
}

export const taskOrchestrator = TaskOrchestrator.getInstance();
