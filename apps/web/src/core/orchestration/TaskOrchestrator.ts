import type { KKIntent, GenerationIntent, BrowserTaskIntent } from './taskIntent';
import type { TaskResult } from './taskResult';
import { capabilityRegistry } from '../capability/capabilityRegistry.ts';
import { generationEngine } from '../generation/GenerationEngine.ts';
import { browserActionRouter } from '../browser/BrowserActionRouter.ts';
import { permissionPolicy } from '../permissions/PermissionPolicy.ts';

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
    let outlineText = intent.outlineText;
    if (!outlineText) {
      const textResult = await generationEngine.generate({
        type: 'generation',
        mediaType: 'text',
        modelId: intent.stylePreset || 'gemini-2.5-flash',
        prompt: `请为主题为“${intent.topic}”的幻灯片生成一份 ${intent.slideCount} 页的内容大纲，格式为每行一个主题，不要有多余的字。`,
      });
      outlineText = textResult.content || textResult.text || '';
    }

    const lines = (outlineText || '')
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean)
      .slice(0, intent.slideCount);

    while (lines.length < intent.slideCount) {
      lines.push(`第 ${lines.length + 1} 页：${intent.topic}`);
    }

    const images: any[] = [];
    const modelId = intent.stylePreset || 'gemini-2.5-flash-image';

    for (let i = 0; i < lines.length; i++) {
      const pagePrompt = `PPT 第 ${i + 1} 页：${lines[i]}。16:9 演示文稿风格，中文排版清晰，信息层次分明。`;
      const imageResult = await generationEngine.generate({
        type: 'generation',
        mediaType: 'image',
        modelId: modelId,
        prompt: pagePrompt,
        params: {
          aspectRatio: '16:9',
          imageSize: '1K',
          imageCount: 1,
        }
      });
      images.push(imageResult);
    }

    return {
      success: true,
      intentType: 'slides',
      data: {
        topic: intent.topic,
        outline: lines,
        images: images.map(img => img.url || (img.urls && img.urls[0]) || ''),
      },
      timestamp
    };
  }

  private async handleEcommerce(intent: any, timestamp: number): Promise<TaskResult> {
    const images: any[] = [];
    const modelId = 'gemini-2.5-flash-image';

    for (let i = 0; i < intent.batchSize; i++) {
      const imageResult = await generationEngine.generate({
        type: 'generation',
        mediaType: 'image',
        modelId: modelId,
        prompt: `电商产品图背景重绘：${intent.scenePrompt}，布局模板为：${intent.layoutTemplate || '默认'}`,
        params: {
          aspectRatio: '1:1',
          imageSize: '1K',
          referenceImages: [{ id: intent.productImageId, role: 'product' }],
        }
      });
      images.push(imageResult);
    }

    return {
      success: true,
      intentType: 'ecommerce',
      data: {
        images: images.map(img => img.url || (img.urls && img.urls[0]) || ''),
      },
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
