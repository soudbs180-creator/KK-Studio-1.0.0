// 简体中文：资产和下载打包相关的 AI 助手工具 (Asset Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { zipOutputs } from '../../assets/zipOutputs.ts';
import { resolveImageNodesForDownload, resolveOriginalSource } from '../../assets/resolveOriginalAssets.ts';

const getContextSelectedNodeIds = (ctx: any): string[] =>
  ctx?.selectedNodeIds || ctx?.activeCanvas?.selectedNodeIds || [];

export const assetTools: AgentToolDefinition[] = [
  // 1. zipOutputs - 打包图片输出
  {
    name: 'zipOutputs',
    description: '将生成导出的图片成果进行 ZIP 压缩，附加元数据清单并触发浏览器自动保存下载',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['latest_batch', 'current_batch', 'selected_cards', 'all_canvas_outputs'], description: '打包范围' }
      },
      required: ['scope']
    },
    handler: async (input: { scope: any }, ctx) => {
      const { scope } = input;
      const { activeCanvas, notify } = ctx;

      try {
        notify.info('正在打包', '正在提取生成图像并进行压缩归档...');
        
        const result = await zipOutputs(scope, {
          projectName: activeCanvas?.name || 'KKStudio',
          canvasId: activeCanvas?.id,
          batchId: 'takeover_zip_' + Date.now(),
          imageNodes: activeCanvas?.imageNodes || [],
          selectedNodeIds: getContextSelectedNodeIds(ctx),
          promptNodes: activeCanvas?.promptNodes || [],
          preferOriginal: true
        });

        if (result && result.failedCount > 0) {
          notify.warning('打包完成（部分失败）', `已打包 ${result.count} 张图片，但有 ${result.failedCount} 张图片下载失败。详情已记录在 ZIP 内的 manifest.json。`);
        } else {
          notify.success('打包下载完成', 'ZIP 压缩包及 manifest.json 已成功保存！');
        }
      } catch (err: any) {
        notify.error('打包下载失败', err.message || '未知错误');
        throw err;
      }
    }
  },

  // 2. assets.resolveOriginals - 解析原图来源摘要
  {
    name: 'assets.resolveOriginals',
    description: '解析当前范围内图片节点的原图来源优先级摘要，不下载文件也不暴露完整原图地址',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['latest_batch', 'current_batch', 'selected_cards', 'all_canvas_outputs', 'asset_collection_outputs'] }
      },
      required: ['scope']
    },
    handler: async (input: { scope: string }, ctx) => {
      const images = resolveImageNodesForDownload({
        scope: input.scope,
        selectedNodeIds: getContextSelectedNodeIds(ctx),
        activeCanvas: {
          promptNodes: ctx.activeCanvas?.promptNodes || [],
          imageNodes: ctx.activeCanvas?.imageNodes || []
        }
      });

      return {
        scope: input.scope,
        count: images.length,
        items: images.map((image: any, index: number) => {
          const source = resolveOriginalSource(image, index);
          return {
            nodeId: image.id,
            parentPromptId: image.parentPromptId,
            sourceKind: source.sourceKind,
            filename: source.filename,
            hasSource: source.sourceKind !== 'missing',
            storageIdPresent: Boolean(image.storageId)
          };
        })
      };
    }
  }
];
