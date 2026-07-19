// 简体中文：资产和下载打包相关的 AI 助手工具 (Asset Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { zipOutputs, type ZipOutputsResult } from '../../assets/zipOutputs.ts';
import { resolveImageNodesForDownload, resolveOriginalSource } from '../../assets/resolveOriginalAssets.ts';

const resolveConfirmedSelectedNodeIds = (
  input: { selectedNodeIds?: string[] },
  ctx: any,
): string[] => {
  const selectedNodeIds = Array.isArray(input.selectedNodeIds)
    ? input.selectedNodeIds
    : ctx?.selectedNodeIds || ctx?.activeCanvas?.selectedNodeIds || [];
  const normalized = Array.from(new Set<string>(
    (selectedNodeIds as unknown[])
      .map((id) => String(id).trim())
      .filter((id): id is string => id.length > 0),
  ));
  if (!Array.isArray(input.selectedNodeIds)) return normalized;
  const canvasNodeIds = new Set([
    ...(ctx?.activeCanvas?.imageNodes || []).map((node: any) => String(node.id || '')),
    ...(ctx?.activeCanvas?.promptNodes || []).map((node: any) => String(node.id || '')),
  ].filter(Boolean));
  const unknownIds = normalized.filter((id) => !canvasNodeIds.has(id));
  if (unknownIds.length > 0) {
    throw new TypeError(`Selected asset nodes are no longer present on the confirmed canvas: ${unknownIds.join(', ')}`);
  }
  return normalized;
};

export type AssetZipToolOutcome = ZipOutputsResult & {
  status: 'completed' | 'completed_with_errors' | 'failed';
  executionOutcome: 'success' | 'partial_success' | 'retryable_failure';
  message?: string;
};

export const buildAssetZipToolOutcome = (result: ZipOutputsResult): AssetZipToolOutcome => {
  if (result.count <= 0) {
    return {
      ...result,
      status: 'failed',
      executionOutcome: 'retryable_failure',
      message: result.failedCount > 0
        ? `All ${result.failedCount} asset download(s) failed.`
        : 'No assets were added to the ZIP archive.',
    };
  }
  if (result.failedCount > 0) {
    return {
      ...result,
      status: 'completed_with_errors',
      executionOutcome: 'partial_success',
    };
  }
  return {
    ...result,
    status: 'completed',
    executionOutcome: 'success',
  };
};

export const assetTools: AgentToolDefinition[] = [
  // 1. zipOutputs - 打包图片输出
  {
    name: 'zipOutputs',
    description: '将生成导出的图片成果进行 ZIP 压缩，附加元数据清单并触发浏览器自动保存下载',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['latest_batch', 'current_batch', 'selected_cards', 'all_canvas_outputs'], description: '打包范围' },
        selectedNodeIds: { type: 'array', items: { type: 'string' }, description: '确认预览时冻结的选区节点 ID' }
      },
      required: ['scope']
    },
    handler: async (input: { scope: any; selectedNodeIds?: string[] }, ctx) => {
      const { scope } = input;
      const { activeCanvas, notify } = ctx;

      try {
        notify.info('正在打包', '正在提取生成图像并进行压缩归档...');
        
        const result = await zipOutputs(scope, {
          projectName: activeCanvas?.name || 'KKStudio',
          canvasId: activeCanvas?.id,
          batchId: 'takeover_zip_' + Date.now(),
          imageNodes: activeCanvas?.imageNodes || [],
          selectedNodeIds: resolveConfirmedSelectedNodeIds(input, ctx),
          promptNodes: activeCanvas?.promptNodes || [],
          preferOriginal: true
        });

        const outcome = buildAssetZipToolOutcome(result);
        if (outcome.executionOutcome === 'retryable_failure') {
          notify.error('打包失败', `没有原图成功写入 ZIP，${result.failedCount} 张图片下载失败。请检查网络或素材来源后重试。`);
        } else if (outcome.executionOutcome === 'partial_success') {
          notify.warning('打包完成（部分失败）', `已打包 ${result.count} 张图片，但有 ${result.failedCount} 张图片下载失败。详情已记录在 ZIP 内的 manifest.json。`);
        } else {
          notify.success('打包下载完成', 'ZIP 压缩包及 manifest.json 已成功保存！');
        }
        return outcome;
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
        scope: { type: 'string', enum: ['latest_batch', 'current_batch', 'selected_cards', 'all_canvas_outputs', 'asset_collection_outputs'] },
        selectedNodeIds: { type: 'array', items: { type: 'string' } }
      },
      required: ['scope']
    },
    handler: async (input: { scope: string; selectedNodeIds?: string[] }, ctx) => {
      const images = resolveImageNodesForDownload({
        scope: input.scope,
        selectedNodeIds: resolveConfirmedSelectedNodeIds(input, ctx),
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
