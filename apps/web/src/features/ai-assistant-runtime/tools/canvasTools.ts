// 简体中文：画布操作相关的 AI 助手工具 (Canvas Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import {
  createCanvasCardNodes,
  type CanvasCardFactoryResult,
  type CanvasCreateCardInput,
} from '../../../context/canvasCardFactory.ts';

const getContextSelectedNodeIds = (ctx: any): string[] =>
  ctx?.selectedNodeIds || ctx?.activeCanvas?.selectedNodeIds || [];

const capabilityUnavailable = (message: string, setupAction = 'open-workspace') => ({
  success: false as const,
  code: 'CAPABILITY_UNAVAILABLE' as const,
  message,
  setupAction
});

const createCardThroughFactory = async (
  input: CanvasCreateCardInput,
  ctx: any,
): Promise<CanvasCardFactoryResult | null> => {
  if (typeof ctx.createCard === 'function') {
    return await ctx.createCard(input);
  }

  const result = createCanvasCardNodes(input, {
    canvasId: ctx.activeCanvas?.id || ctx.canvasId || 'default_canvas',
    position: input.position || ctx.getNextCardPosition?.() || { x: 100, y: 100 },
    model: input.model || ctx.config?.model || ctx.selectedModel?.id,
  });
  const canPersistPrompts = result.promptNodes.length === 0
    || typeof ctx.addPromptNodes === 'function'
    || typeof ctx.addPromptNode === 'function';
  const canPersistImages = result.imageNodes.length === 0 || typeof ctx.addImageNodes === 'function';
  const canPersistNotes = result.noteNodes.length === 0 || typeof ctx.addNoteNode === 'function';
  const canPersistWorkflow = result.workflowNodes.length === 0 || typeof ctx.addWorkflowNode === 'function';
  if (!canPersistPrompts || !canPersistImages || !canPersistNotes || !canPersistWorkflow) return null;

  if (result.promptNodes.length > 0) {
    if (typeof ctx.addPromptNodes === 'function') {
      await ctx.addPromptNodes(result.promptNodes);
    } else {
      await Promise.all(result.promptNodes.map((node) => ctx.addPromptNode(node)));
    }
  }
  if (result.imageNodes.length > 0) await ctx.addImageNodes(result.imageNodes);
  if (result.noteNodes.length > 0) await Promise.all(result.noteNodes.map((node) => ctx.addNoteNode(node)));
  if (result.workflowNodes.length > 0) {
    result.workflowNodes.forEach((node) => ctx.addWorkflowNode(node));
  }
  return result;
};

const workflowAbortControllers = new Map<string, AbortController>();

export const canvasTools: AgentToolDefinition[] = [
  // 1. fillPrompt - 填充提示词到卡片
  {
    name: 'fillPrompt',
    description: '填充润色后的提示词到前端 Prompt 文本框中或当前选中卡片中',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '填充的提示词内容' },
        negativePrompt: { type: 'string', description: '负面词' },
        idempotencyKey: { type: 'string' }
      },
      required: ['prompt']
    },
    handler: async (input: { prompt: string; negativePrompt?: string; idempotencyKey?: string }, ctx) => {
      const { prompt } = input;
      const { activeCanvas, selectedModel, updatePromptNode, addPromptNode, getNextCardPosition, notify } = ctx;

      const selectedNodeIds = getContextSelectedNodeIds(ctx);
      const selectedPromptNode = activeCanvas?.promptNodes?.find((n: any) => selectedNodeIds.includes(n.id));

      if (selectedPromptNode) {
        await updatePromptNode({
          ...selectedPromptNode,
          prompt: prompt,
          optimizedPromptEn: prompt,
          optimizedPromptZh: '本地优化成功'
        });
        notify.success('卡片已优化', '已将优化提示词直接写入当前选中的卡片中。');
        return { status: 'updated', nodeId: selectedPromptNode.id };
      } else {
        const lastPos = getNextCardPosition();
        const card = createCanvasCardNodes({
          kind: 'prompt-only',
          prompt,
          idempotencyKey: input.idempotencyKey,
          position: lastPos,
          aspectRatio: '1:1',
          imageSize: '1K',
          model: selectedModel?.id || 'gemini-2.5-flash',
        }, {
          canvasId: activeCanvas?.id || ctx.canvasId || 'default_canvas',
          position: lastPos,
          model: selectedModel?.id || 'gemini-2.5-flash',
        });
        const newNode = {
          ...card.promptNodes[0],
          optimizedPromptEn: prompt,
          optimizedPromptZh: '本地优化成功',
          modelLabel: selectedModel?.name || 'Gemini 2.5 Flash',
          provider: selectedModel?.provider || 'Google',
          parallelCount: 1
        };

        const liveCanvas = ctx.getActiveCanvas?.() || activeCanvas;
        if (!(liveCanvas?.promptNodes || []).some((node: any) => node.id === newNode.id)) {
          await addPromptNode(newNode);
        }
        notify.success('已新建优化卡片', '未检测到选中卡片，已为您自动在画布中创建了一张提示词卡片。');
        return { status: 'created', nodeId: newNode.id };
      }
    }
  },

  // 2. locateCard - 画布卡片定位
  {
    name: 'locateCard',
    description: '在无限画布上查找匹配提示词的卡片，并将视口中心移动对齐聚焦它',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '查找定位卡片的关键词' }
      },
      required: ['keyword']
    },
    handler: async (input: { keyword: string }, ctx) => {
      const { keyword } = input;
      const { activeCanvas, notify } = ctx;

      if (!keyword) {
        notify.warning('未指定定位关键词');
        return;
      }

      const nodes = activeCanvas?.promptNodes || [];
      const matched = nodes.find((n: any) =>
        (n.prompt || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.optimizedPromptEn || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.optimizedPromptZh || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.tags || []).some((t: string) => t.toLowerCase().includes(keyword.toLowerCase()))
      );

      if (matched) {
        const locateEvent = new CustomEvent('canvas-center-on-node', {
          detail: {
            x: matched.position.x,
            y: matched.position.y,
            nodeId: matched.id
          }
        });
        window.dispatchEvent(locateEvent);
        if (typeof ctx.selectNodes === 'function') {
          ctx.selectNodes([matched.id], 'replace');
        }
        notify.success('卡片定位成功', `已为您平滑定位至包含“${keyword}”的卡片并选中。`);
      } else {
        notify.warning('定位失败', `在当前画布上未找到包含“${keyword}”的卡片。`);
      }
    }
  },

  // 3. canvas.getState - 读取当前画布摘要
  {
    name: 'canvas.getState',
    description: '读取当前画布、节点数量与选区摘要',
    permission: 'safe',
    inputSchema: {},
    handler: async (_input: unknown, ctx) => ({
      canvasId: ctx.activeCanvas?.id,
      canvasName: ctx.activeCanvas?.name,
      promptCount: ctx.activeCanvas?.promptNodes?.length || 0,
      imageCount: ctx.activeCanvas?.imageNodes?.length || 0,
      groupCount: ctx.activeCanvas?.groups?.length || 0,
      selectedNodeIds: getContextSelectedNodeIds(ctx)
    })
  },

  // 4. canvas.getSelectedNodes - 读取当前选中节点摘要
  {
    name: 'canvas.getSelectedNodes',
    description: '读取当前选中的 Prompt 与 Image 节点摘要',
    permission: 'safe',
    inputSchema: {},
    handler: async (_input: unknown, ctx) => {
      const selected = new Set(getContextSelectedNodeIds(ctx));
      return {
        promptNodes: (ctx.activeCanvas?.promptNodes || []).filter((node: any) => selected.has(node.id)),
        imageNodes: (ctx.activeCanvas?.imageNodes || []).filter((node: any) => selected.has(node.id))
      };
    }
  },

  // 5. canvas.arrangeNodes - 整理画布节点布局
  {
    name: 'canvas.arrangeNodes',
    description: '整理当前选区或当前画布中的节点布局，实际排版规则由 CanvasContext.arrangeAllNodes 执行',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' } },
        mode: { type: 'string', enum: ['grid', 'row', 'column'], description: '布局模式' },
        layout: { type: 'string', enum: ['grid', 'row', 'column'], description: 'Layout mode compatibility alias' },
        preset: { type: 'string', enum: ['grid', 'row', 'column', 'compact-grid'] },
        columns: { type: 'number' },
        gap: { type: 'number' }
      }
    },
    handler: async (input: { nodeIds?: string[]; mode?: 'grid' | 'row' | 'column'; layout?: 'grid' | 'row' | 'column'; preset?: 'grid' | 'row' | 'column' | 'compact-grid'; columns?: number; gap?: number }, ctx) => {
      const mode = input?.mode || input?.layout || 'grid';
      const nodeIds = Array.isArray(input?.nodeIds) ? input.nodeIds.filter(Boolean) : [];

      if (nodeIds.length > 0) {
        if (!ctx.activeCanvas) {
          throw new Error('canvas.arrangeNodes requires an active canvas when nodeIds are provided.');
        }
        const supportedNodeIds = new Set([
          ...(ctx.activeCanvas.promptNodes || []).map((node: any) => node.id),
          ...(ctx.activeCanvas.imageNodes || []).map((node: any) => node.id),
          ...(ctx.activeCanvas.noteNodes || []).map((node: any) => node.id),
          ...(ctx.activeCanvas.workflow?.nodes || []).map((node: any) => node.id),
          ...(ctx.activeCanvas.groups || []).map((group: any) => group.id),
        ]);
        const missingNodeIds = nodeIds.filter((nodeId) => !supportedNodeIds.has(nodeId));
        if (missingNodeIds.length > 0) {
          throw new Error(`canvas.arrangeNodes cannot resolve nodeIds: ${missingNodeIds.join(', ')}`);
        }
        if (typeof ctx.arrangeAllNodes !== 'function') {
          throw new Error('canvas.arrangeNodes requires arrangeAllNodes in ExecutorContext.');
        }
        ctx.arrangeAllNodes(mode, nodeIds);
        ctx.notify?.success?.('画布已整理', `已按 ${input.preset || mode} 模式整理 ${nodeIds.length} 个节点。`);
        return {
          success: true as const,
          executionOutcome: 'success' as const,
          status: 'arranged',
          mode,
          preset: input.preset,
          selectedCount: nodeIds.length
        };
      }

      if (typeof ctx.arrangeAllNodes !== 'function') {
        throw new Error('canvas.arrangeNodes requires arrangeAllNodes in ExecutorContext.');
      }

      ctx.arrangeAllNodes(mode);
      const liveCanvas = ctx.getActiveCanvas?.() || ctx.activeCanvas;
      const selectedCount = getContextSelectedNodeIds(ctx).length;
      const canvasNodeCount = [
        ...(liveCanvas?.promptNodes || []),
        ...(liveCanvas?.imageNodes || []),
        ...(liveCanvas?.noteNodes || []),
        ...(liveCanvas?.workflow?.nodes || []),
        ...(liveCanvas?.groups || []),
      ].length;
      ctx.notify?.success?.('画布已整理', `已按 ${mode} 模式整理当前选区或画布。`);
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: 'arranged',
        mode,
        selectedCount,
        affectedCount: selectedCount || canvasNodeCount
      };
    }
  },
  {
    name: 'canvas.createCard',
    description: 'Create a typed canvas card through the canonical card factory.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['prompt-result-group', 'prompt-only', 'media-only', 'ecommerce', 'ppt-deck', 'audio', 'text', 'notebook', 'multi-image', 'workflow-panel', 'unknown'] },
        title: { type: 'string' },
        prompt: { type: 'string' },
        layoutMode: { type: 'string', enum: ['row', 'column', 'grid'] },
        aspectRatio: { type: 'string' },
        imageSize: { type: 'string' },
        model: { type: 'string' },
        idempotencyKey: { type: 'string' },
        media: { type: 'array', items: { type: 'object' } },
        pptSlides: { type: 'array', items: { type: 'string' } },
        diagnostic: { type: 'string' },
      },
      required: ['kind'],
    },
    handler: async (input: CanvasCreateCardInput, ctx) => {
      const result = await createCardThroughFactory(input, ctx);
      if (!result) return capabilityUnavailable(`Canvas card creation is not bound for kind: ${input.kind}.`);
      ctx.notify?.success?.('卡片已创建', `已创建 ${input.kind} 卡片。`);
      return { status: 'created', kind: input.kind, nodeId: result.primaryNodeId };
    },
  },
  {
    name: 'canvas.convertDrawingsToNote',
    description: 'Move selected vector drawings into an editable notebook card.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        drawingIds: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
      },
      required: ['drawingIds'],
    },
    handler: async (input: { drawingIds: string[]; title?: string }, ctx) => {
      if (typeof ctx.convertDrawingsToNote !== 'function') {
        return capabilityUnavailable('Canvas drawing conversion handler is not bound.');
      }
      const note = await ctx.convertDrawingsToNote(input.drawingIds, input.title);
      if (!note) {
        return { success: false as const, code: 'INVALID_INPUT' as const, message: 'No convertible drawings were found.' };
      }
      return { status: 'created', kind: 'notebook', nodeId: note.id };
    },
  },
  {
    name: 'canvas.rasterizeNote',
    description: 'Rasterize an editable notebook card on demand for AI reference without persisting Base64.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        scale: { type: 'number' },
      },
      required: ['nodeId'],
    },
    handler: async (input: { nodeId: string; scale?: number }, ctx) => {
      if (typeof ctx.rasterizeNote !== 'function') {
        return capabilityUnavailable('Notebook rasterization handler is not bound.');
      }
      const result = await ctx.rasterizeNote(input.nodeId, input.scale);
      if (!result) return { success: false as const, code: 'INVALID_INPUT' as const, message: `Notebook card not found: ${input.nodeId}` };
      return { status: 'rasterized', nodeId: input.nodeId, ...result };
    },
  },
  {
    name: 'workflow.createPanel',
    description: 'Create an editable workflow panel card through the canonical card factory.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        steps: { type: 'array', items: { type: 'object' } },
        idempotencyKey: { type: 'string' },
      },
    },
    handler: async (input: { title?: string; steps?: CanvasCreateCardInput['workflowSteps']; idempotencyKey?: string }, ctx) => {
      const result = await createCardThroughFactory({
        kind: 'workflow-panel',
        title: input.title,
        workflowSteps: input.steps,
        idempotencyKey: input.idempotencyKey,
      }, ctx);
      if (!result) return capabilityUnavailable('Workflow panel creation handler is not bound.');
      return { status: 'created', kind: 'workflow-panel', nodeId: result.primaryNodeId };
    },
  },
  {
    name: 'workflow.controlPanel',
    description: 'Run, pause, cancel, or retry an editable workflow panel through ToolRegistry.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        action: { type: 'string', enum: ['run', 'pause', 'cancel', 'retry'] },
      },
      required: ['nodeId', 'action'],
    },
    handler: async (input: { nodeId: string; action: 'run' | 'pause' | 'cancel' | 'retry' }, ctx) => {
      const panel = ctx.activeCanvas?.workflow?.nodes?.find((node: any) => node.id === input.nodeId && node.kind === 'workflow-panel');
      if (!panel || typeof ctx.updateWorkflowNode !== 'function') {
        return capabilityUnavailable('Workflow panel runtime is not bound.');
      }
      const updateData = (data: any) => ctx.updateWorkflowNode(panel.id, { data });
      if (input.action === 'pause' || input.action === 'cancel') {
        workflowAbortControllers.get(panel.id)?.abort(input.action);
        workflowAbortControllers.delete(panel.id);
        updateData({ ...panel.data, status: input.action === 'pause' ? 'paused' : 'cancelled' });
        return { status: input.action, nodeId: panel.id };
      }
      if (ctx.trigger !== 'user-action') {
        throw new Error('Workflow run/retry requires a direct user action until every nested tool and input is expanded into the confirmed plan.');
      }
      if (typeof ctx.executeTool !== 'function') {
        return capabilityUnavailable('Workflow ToolRegistry executor is not bound.');
      }

      workflowAbortControllers.get(panel.id)?.abort('restart');
      const controller = new AbortController();
      workflowAbortControllers.set(panel.id, controller);
      let steps = (panel.data.steps || []).map((step: any) => ({ ...step }));
      const candidates = steps.filter((step: any) => step.enabled !== false && (input.action !== 'retry' || step.status === 'failed'));
      updateData({ ...panel.data, status: 'running', error: undefined, steps });
      const outputNodeIds = new Set<string>(panel.data.outputNodeIds || []);

      try {
        for (const candidate of candidates) {
          if (controller.signal.aborted) break;
          const index = steps.findIndex((step: any) => step.id === candidate.id);
          const toolName = String(candidate.parameters?.toolName || '').trim();
          if (!toolName || toolName.startsWith('workflow.')) {
            throw new Error(`Workflow step "${candidate.label}" requires a non-workflow toolName.`);
          }
          steps[index] = { ...steps[index], status: 'running', error: undefined };
          updateData({ ...panel.data, status: 'running', steps, outputNodeIds: Array.from(outputNodeIds) });
          let toolInput: any = candidate.parameters?.input || {};
          if (typeof toolInput === 'string' && toolInput.trim()) {
            toolInput = JSON.parse(toolInput);
          }
          const output = await ctx.executeTool(toolName, toolInput, { signal: controller.signal });
          [output?.nodeId, ...(output?.nodeIds || []), ...(output?.resultImageNodeIds || [])]
            .filter(Boolean)
            .forEach((nodeId: string) => outputNodeIds.add(nodeId));
          steps[index] = { ...steps[index], status: 'completed', error: undefined };
        }
        const status = controller.signal.aborted
          ? (String(controller.signal.reason) === 'pause' ? 'paused' : 'cancelled')
          : 'completed';
        updateData({ ...panel.data, status, steps, outputNodeIds: Array.from(outputNodeIds) });
        return { status, nodeId: panel.id, outputNodeIds: Array.from(outputNodeIds) };
      } catch (error: any) {
        const runningIndex = steps.findIndex((step: any) => step.status === 'running');
        if (runningIndex >= 0) steps[runningIndex] = { ...steps[runningIndex], status: 'failed', error: error?.message || String(error) };
        updateData({ ...panel.data, status: 'failed', error: error?.message || String(error), steps, outputNodeIds: Array.from(outputNodeIds) });
        throw error;
      } finally {
        if (workflowAbortControllers.get(panel.id) === controller) workflowAbortControllers.delete(panel.id);
      }
    },
    verify: async (output: any, input: { nodeId: string }) => ({
      success: Boolean(
        output
        && output.nodeId === input.nodeId
        && ['run', 'running', 'paused', 'cancelled', 'completed', 'failed'].includes(String(output.status)),
      ),
      message: 'Workflow panel command did not return a verifiable status for the requested node.',
    }),
  },
  {
    name: 'canvas.createPromptCards',
    description: '在画布上批量创建占位的提示词卡片组',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          items: { type: 'string' }
        },
        imageUrl: { type: 'string' },
        model: { type: 'string' },
        aspectRatio: { type: 'string' },
        idempotencyKey: { type: 'string' }
      },
      required: ['prompts']
    },
    handler: async (input: { prompts: string[]; imageUrl?: string; model?: string; aspectRatio?: string; idempotencyKey?: string }, ctx) => {
      const { prompts, imageUrl } = input;
      const { getNextCardPosition, notify } = ctx;
      if (!prompts || prompts.length === 0) {
        return {
          success: false as const,
          code: 'INVALID_INPUT' as const,
          message: 'canvas.createPromptCards requires at least one prompt.'
        };
      }

      const start = typeof getNextCardPosition === 'function' ? getNextCardPosition() : { x: 100, y: 100 };
      const created = await Promise.all(prompts.map((promptText, index) => createCardThroughFactory({
        kind: imageUrl ? 'prompt-result-group' : 'prompt-only',
        prompt: promptText,
        position: { x: start.x + index * 440, y: start.y },
        model: input.model,
        aspectRatio: input.aspectRatio,
        media: imageUrl ? [{ url: imageUrl, prompt: promptText }] : [],
        layoutMode: 'row',
        idempotencyKey: `${input.idempotencyKey || 'canvas.createPromptCards'}:card:${index}`,
      }, ctx)));
      if (created.some((result) => !result)) {
        return capabilityUnavailable('Canvas prompt card creation handler is not bound.');
      }
      notify.success('卡片已批量创建', `已创建 ${prompts.length} 张卡片。`);
      return {
        status: 'created',
        count: prompts.length,
        imageCount: created.reduce((sum, result) => sum + (result?.imageNodes.length || 0), 0),
        nodeIds: created.flatMap((result) => result ? [result.primaryNodeId] : []),
      };
    }
  },
  {
    name: 'canvas.createAudioCard',
    description: '在画布上创建音频卡片节点，用于播放语音或音乐',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '音频来源提示词或文案' },
        url: { type: 'string', description: '音频资源 URL 链接' },
        mimeType: { type: 'string', description: '音频多媒体 MIME 类型' },
        idempotencyKey: { type: 'string' }
      },
      required: ['url']
    },
    handler: async (input: { prompt?: string; url: string; mimeType?: string; idempotencyKey?: string }, ctx) => {
      const { prompt, url, mimeType } = input;
      const { notify } = ctx;
      const created = await createCardThroughFactory({
        kind: 'audio',
        prompt,
        media: [{ url, mimeType }],
        idempotencyKey: input.idempotencyKey,
      }, ctx);
      if (!created) return capabilityUnavailable('Canvas audio node creation handler is not bound.');
      notify.success('音频卡片已创建', '播放器将在加载资源后读取真实时长。');
      return { status: 'created', nodeId: created.primaryNodeId };
    }
  }
];
