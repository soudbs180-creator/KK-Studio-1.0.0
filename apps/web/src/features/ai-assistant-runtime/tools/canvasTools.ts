// 简体中文：画布操作相关的 AI 助手工具 (Canvas Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { resolveAgentNodeArrangeUpdates } from '../canvas/agentCanvasLayout.ts';

const getContextSelectedNodeIds = (ctx: any): string[] =>
  ctx?.selectedNodeIds || ctx?.activeCanvas?.selectedNodeIds || [];

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
        negativePrompt: { type: 'string', description: '负面词' }
      },
      required: ['prompt']
    },
    handler: async (input: { prompt: string; negativePrompt?: string }, ctx) => {
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
      } else {
        const lastPos = getNextCardPosition();
        const newNode = {
          id: 'takeover_opt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
          prompt: prompt,
          optimizedPromptEn: prompt,
          optimizedPromptZh: '本地优化成功',
          position: lastPos,
          aspectRatio: '1:1',
          imageSize: '1K',
          model: selectedModel?.id || 'gemini-2.5-flash',
          modelLabel: selectedModel?.name || 'Gemini 2.5 Flash',
          provider: selectedModel?.provider || 'Google',
          childImageIds: [],
          timestamp: Date.now(),
          parallelCount: 1
        };

        await addPromptNode(newNode);
        notify.success('已新建优化卡片', '未检测到选中卡片，已为您自动在画布中创建了一张提示词卡片。');
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
        preset: { type: 'string', enum: ['grid', 'row', 'column', 'compact-grid'] },
        columns: { type: 'number' },
        gap: { type: 'number' }
      }
    },
    handler: async (input: { nodeIds?: string[]; mode?: 'grid' | 'row' | 'column'; preset?: 'grid' | 'row' | 'column' | 'compact-grid'; columns?: number; gap?: number }, ctx) => {
      const mode = input?.mode || 'grid';
      const nodeIds = Array.isArray(input?.nodeIds) ? input.nodeIds.filter(Boolean) : [];

      if (nodeIds.length > 0 && typeof ctx.updateNodes === 'function' && ctx.activeCanvas) {
        const updates = resolveAgentNodeArrangeUpdates(ctx.activeCanvas, nodeIds, {
          mode,
          preset: input.preset,
          columns: input.columns,
          gap: input.gap
        });
        ctx.updateNodes(updates);
        ctx.notify?.success?.('画布已整理', `已按 ${input.preset || mode} 模式整理 ${nodeIds.length} 个节点。`);
        return {
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
      ctx.notify?.success?.('画布已整理', `已按 ${mode} 模式整理当前选区或画布。`);
      return {
        status: 'arranged',
        mode,
        selectedCount: getContextSelectedNodeIds(ctx).length
      };
    }
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
        aspectRatio: { type: 'string' }
      },
      required: ['prompts']
    },
    handler: async (input: { prompts: string[]; imageUrl?: string; model?: string; aspectRatio?: string }, ctx) => {
      const { prompts, imageUrl } = input;
      const { addPromptNode, addPromptNodes, addImageNodes, getNextCardPosition, notify, activeCanvas } = ctx;
      if (!prompts || prompts.length === 0) return;

      const lastPos = typeof getNextCardPosition === 'function'
        ? getNextCardPosition()
        : { x: 100, y: 100 };
      const model = input.model || ctx?.config?.model || ctx?.selectedModel?.id || 'gemini-2.5-flash';
      const aspectRatio = input.aspectRatio || ctx?.config?.aspectRatio || '16:9';
      const canvasId = activeCanvas?.id || ctx?.canvasId || 'default_canvas';
      
      // 空间位置感知避免重叠算法
      const existingPositions = [
        ...(activeCanvas?.promptNodes || []).map((n: any) => n.position),
        ...(activeCanvas?.imageNodes || []).map((n: any) => n.position),
        ...(activeCanvas?.audioNodes || []).map((n: any) => n.position)
      ].filter(Boolean);

      let startX = lastPos.x;
      let startY = lastPos.y;

      while (existingPositions.some(pos => Math.abs(pos.x - startX) < 150 && Math.abs(pos.y - startY) < 150)) {
        startY += 260; // 发生重叠时，向下平移避开
      }

      const now = Date.now();
      const imageNodes: any[] = [];
      const nodes = prompts.map((promptText, i) => {
        const promptNodeId = 'takeover_ppt_' + now + '_' + i + '_' + Math.random().toString(36).substring(2, 9);
        const imageNodeId = imageUrl
          ? 'takeover_img_' + now + '_' + i + '_' + Math.random().toString(36).substring(2, 9)
          : undefined;

        if (imageUrl && imageNodeId) {
          imageNodes.push({
            id: imageNodeId,
            url: imageUrl,
            prompt: promptText,
            aspectRatio,
            model,
            canvasId,
            parentPromptId: promptNodeId,
            position: { x: startX + i * 440 + 480, y: startY },
            timestamp: now
          });
        }

        return {
          id: promptNodeId,
          prompt: promptText,
          position: { x: startX + i * 440, y: startY },
          aspectRatio,
          imageSize: '1K',
          model,
          childImageIds: imageNodeId ? [imageNodeId] : [],
          timestamp: now
        };
      });

      // 批量事务处理：若支持批量写入则单次写入，避免 React 触发循环重绘
      if (typeof addPromptNodes === 'function') {
        await addPromptNodes(nodes);
      } else {
        await Promise.all(nodes.map(node => addPromptNode(node)));
      }
      if (imageNodes.length > 0 && typeof addImageNodes === 'function') {
        await addImageNodes(imageNodes);
      }
      notify.success('卡片已批量创建', `已成功在画布中生成了 ${prompts.length} 个大纲占位卡片。`);
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
        mimeType: { type: 'string', description: '音频多媒体 MIME 类型' }
      },
      required: ['url']
    },
    handler: async (input: { prompt?: string; url: string; mimeType?: string }, ctx) => {
      const { prompt, url, mimeType } = input;
      const { addAudioNode, addPromptNode, getNextCardPosition, notify } = ctx;
      const pos = getNextCardPosition();

      // 底层性能优化：使用原生 Audio 对象在后台异步抓取音频时长，避免 UI 渲染后的二次排版抖动
      let duration = 0;
      try {
        duration = await new Promise<number>((resolve) => {
          const tempAudio = new Audio();
          // 处理可能的跨域 CORS 设置，如果是原生播放，乐观配置
          tempAudio.crossOrigin = 'anonymous';
          tempAudio.src = url;
          tempAudio.preload = 'metadata';
          
          const timer = setTimeout(() => {
            tempAudio.src = ''; // 显式置空释放内存
            resolve(0); // 超时兜底，不阻塞卡片创建
          }, 1500);

          tempAudio.onloadedmetadata = () => {
            clearTimeout(timer);
            const dur = tempAudio.duration;
            tempAudio.src = ''; // 显式置空释放资源，防内存泄漏
            resolve(Number.isFinite(dur) ? dur : 0);
          };

          tempAudio.onerror = () => {
            clearTimeout(timer);
            tempAudio.src = '';
            resolve(0);
          };
        });
      } catch {
        duration = 0;
      }
      
      const node = {
        id: 'audio_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        prompt: prompt || 'TTS 音频',
        url,
        mimeType: mimeType || 'audio/mpeg',
        position: pos,
        status: 'idle',
        duration,
        timestamp: Date.now()
      };

      let done = false;
      if (typeof addAudioNode === 'function') {
        await addAudioNode(node);
        done = true;
      } else if (typeof addPromptNode === 'function') {
        // 环境韧性：降级为带有特殊标签的 PromptNode 呈现，避免缺失专门音频节点时报错崩溃
        await addPromptNode({
          ...node,
          aspectRatio: '1:1',
          optimizedPromptEn: url,
          optimizedPromptZh: '音频卡片（降级模式）',
          tags: ['audio']
        });
        done = true;
      }

      if (done) {
        notify.success('音频节点生成成功', `已挂载音频卡片至画布 (时长: ${duration.toFixed(1)}s)。`);
      } else {
        notify.warning('未检测到节点挂载能力', '无法在画布上创建音频节点。');
      }
    }
  }
];
