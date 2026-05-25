import { useCallback } from 'react';
import type { InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import type { GenerationConfig, PromptNode, GeneratedImage, GenerationMode as GenerationModeType, AgentWorkflowNode, PreviewWorkflowNode, SaveWorkflowNode } from '../types';
import { AspectRatio, GenerationMode } from '../types';
import { getViewportPreferredPosition } from '../utils/canvasUtils';
import { getViewportOffsets } from '../utils/canvasCenter';
import { normalizePptSlidesForCount } from '../utils/pptUtils';
import {
  type WorkflowTemplateId,
  createAgentWorkflowNode,
  createPreviewWorkflowNode,
  createSaveWorkflowNode,
} from '../workflow/templates/workflowTemplates';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface UseWorkflowActionsDeps {
  activeCanvas: { name?: string; imageNodes: GeneratedImage[]; promptNodes: PromptNode[] } | null | undefined;
  config: GenerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
  canvasRef: React.RefObject<InfiniteCanvasHandle | null>;
  canvasTransform: { x: number; y: number; scale: number };
  isSidebarOpen: boolean;
  isChatOpen: boolean;
  isMobile: boolean;
  chatSidebarWidth: number;
  selectedNodeIds: string[];
  findSmartPosition: (x: number, y: number, width: number, height: number, padding: number) => { x: number; y: number };
  addPromptNode: (node: PromptNode) => Promise<void>;
  addWorkflowNode: (node: any) => void;
  selectNodes: (ids: string[], mode?: 'replace' | 'toggle' | 'add' | 'remove') => void;
  bringNodesToFront: (ids: string[]) => void;
  setActiveSourceImage: (id: string | null) => void;
  setWorkspaceSurface: (surface: 'workspace' | 'library') => void;
  handleOpenPreview: (imageId: string) => void;
  handleNavigateToNode: (x: number, y: number, id?: string) => void;
  handleExportPptxEditable: (node: PromptNode) => Promise<void>;
  resolveCanvasNodePosition: (nodeId?: string | null) => { x: number; y: number } | null;
  resolvePrimaryWorkflowSourcePrompt: (sourceNodeIds: string[]) => PromptNode | null;
  resolvePrimaryWorkflowSourceImage: (sourceNodeIds: string[]) => GeneratedImage | null;
  resolveWorkflowLinkedImages: (sourceNodeIds: string[]) => GeneratedImage[];
  resolveWorkflowSourceIdsFromSelection: () => string[];
}

function notifyWorkflowCard(
  level: 'success' | 'warning' | 'info' | 'error',
  title: string,
  message: string,
) {
  import('../services/system/notificationService').then(({ notify }) => {
    notify[level](title, message);
  });
}

export function useWorkflowActions(deps: UseWorkflowActionsDeps) {
  const {
    activeCanvas,
    config,
    setConfig,
    canvasRef,
    canvasTransform,
    isSidebarOpen,
    isChatOpen,
    isMobile,
    chatSidebarWidth,
    findSmartPosition,
    addPromptNode,
    addWorkflowNode,
    selectNodes,
    bringNodesToFront,
    setActiveSourceImage,
    setWorkspaceSurface,
    handleOpenPreview,
    handleNavigateToNode,
    handleExportPptxEditable,
    resolveCanvasNodePosition,
    resolvePrimaryWorkflowSourcePrompt,
    resolvePrimaryWorkflowSourceImage,
    resolveWorkflowLinkedImages,
    resolveWorkflowSourceIdsFromSelection,
  } = deps;

  const getWorkflowInsertPosition = useCallback((options?: {
    anchorNodeId?: string | null;
    anchorPosition?: { x: number; y: number } | null;
    offsetX?: number;
    offsetY?: number;
    width?: number;
    height?: number;
  }) => {
    const width = options?.width || 284;
    const height = options?.height || 176;
    const anchorPosition = options?.anchorPosition
      || resolveCanvasNodePosition(options?.anchorNodeId)
      || getViewportPreferredPosition(
        canvasRef.current?.getCurrentTransform() || canvasTransform,
        canvasRef.current?.getCanvasRect() || null,
        180,
        getViewportOffsets(isSidebarOpen, isChatOpen, isMobile, chatSidebarWidth),
      );

    return findSmartPosition(
      anchorPosition.x + (options?.offsetX || 0),
      anchorPosition.y + (options?.offsetY || 0),
      width,
      height,
      32,
    );
  }, [
    canvasTransform,
    chatSidebarWidth,
    findSmartPosition,
    isChatOpen,
    isMobile,
    isSidebarOpen,
    resolveCanvasNodePosition,
  ]);

  const exportWorkflowImagesAsZip = useCallback(async (images: GeneratedImage[], nameHint: string) => {
    const validImages = images.filter((imageNode) => Boolean(imageNode.originalUrl || imageNode.url));
    if (validImages.length === 0) {
      notifyWorkflowCard('warning', '暂无可导出图片', '当前卡片还没有可下载的图片结果。');
      return false;
    }

    try {
      const zip = new JSZip();
      const safeFolderName = (nameHint || 'kk-studio-export').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'kk-studio-export';
      const folder = zip.folder(safeFolderName) || zip;

      let exportedCount = 0;
      for (let index = 0; index < validImages.length; index += 1) {
        const imageNode = validImages[index];
        try {
          const response = await fetch(imageNode.originalUrl || imageNode.url);
          const blob = await response.blob();
          const mimeExtension = blob.type.split('/')[1] || imageNode.mimeType?.split('/')[1] || 'png';
          const fileStem = (imageNode.alias || imageNode.fileName || `image_${index + 1}`)
            .replace(/[\\/:*?"<>|]+/g, '_')
            .trim()
            || `image_${index + 1}`;
          folder.file(`${String(index + 1).padStart(2, '0')}_${fileStem}.${mimeExtension}`, blob);
          exportedCount += 1;
        } catch (error) {
          console.error('[workflow.save] Failed to export image', error);
        }
      }

      if (exportedCount === 0) {
        notifyWorkflowCard('error', '导出失败', '没有成功获取到可导出的图片数据。');
        return false;
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${safeFolderName}.zip`);
      notifyWorkflowCard('success', '导出完成', `已导出 ${exportedCount} 张图片。`);
      return true;
    } catch (error: any) {
      console.error('[workflow.save] Export failed', error);
      notifyWorkflowCard('error', '导出失败', error?.message || '请稍后重试。');
      return false;
    }
  }, []);

  const createTemplatePromptNode = useCallback((options: {
    position: { x: number; y: number };
    prompt: string;
    mode?: GenerationModeType;
    sourceImageId?: string;
  }): PromptNode => {
    const promptText = options.prompt.trim();
    const mode = options.mode || config.mode;
    const slideCount = Math.max(config.parallelCount || 1, config.pptSlides?.length || 0, mode === GenerationMode.PPT ? 4 : 1);

    return {
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      prompt: promptText,
      originalPrompt: promptText,
      promptOptimizationEnabled: !!config.enablePromptOptimization,
      thinkingMode: config.thinkingMode || 'minimal',
      enableGrounding: !!config.enableGrounding,
      enableImageSearch: !!config.enableImageSearch,
      position: options.position,
      aspectRatio: mode === GenerationMode.PPT ? AspectRatio.LANDSCAPE_16_9 : config.aspectRatio,
      imageSize: config.imageSize,
      model: config.model,
      childImageIds: [],
      referenceImages: options.sourceImageId ? [] : [...config.referenceImages],
      timestamp: Date.now(),
      sourceImageId: options.sourceImageId,
      parallelCount: slideCount,
      mode,
      tags: [],
      videoResolution: config.videoResolution,
      videoDuration: config.videoDuration,
      videoAudio: config.videoAudio,
      audioDuration: config.audioDuration,
      audioLyrics: config.audioLyrics,
      pptSlides: mode === GenerationMode.PPT
        ? normalizePptSlidesForCount(config.pptSlides, promptText, slideCount)
        : config.pptSlides,
      pptStyleLocked: config.pptStyleLocked !== false,
      maskUrl: config.maskUrl,
    };
  }, [config]);

  const handleWorkflowPreviewAction = useCallback((node: PreviewWorkflowNode) => {
    const sourceNodeIds: string[] = node.data.sourceNodeIds ?? [];
    const sourceImage = resolvePrimaryWorkflowSourceImage(sourceNodeIds);
    if (sourceImage) {
      setWorkspaceSurface('workspace');
      handleOpenPreview(sourceImage.id);
      return;
    }

    const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(sourceNodeIds);
    if (sourcePrompt) {
      selectNodes([sourcePrompt.id], 'replace');
      handleNavigateToNode(sourcePrompt.position.x, sourcePrompt.position.y, sourcePrompt.id);
      return;
    }

    notifyWorkflowCard('info', '预览卡未连接结果', '先把它挂到图片卡或主卡上，再从这里快速查看。');
  }, [
    handleNavigateToNode,
    handleOpenPreview,
    resolvePrimaryWorkflowSourceImage,
    resolvePrimaryWorkflowSourcePrompt,
    selectNodes,
  ]);

  const handleWorkflowSaveAction = useCallback(async (node: SaveWorkflowNode) => {
    const sourceNodeIds: string[] = node.data.sourceNodeIds ?? [];
    const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(sourceNodeIds);
    const linkedImages = resolveWorkflowLinkedImages(sourceNodeIds);

    if ((node.data.format || 'zip').toLowerCase() === 'pptx') {
      if (sourcePrompt && sourcePrompt.mode === GenerationMode.PPT) {
        await handleExportPptxEditable(sourcePrompt);
        return;
      }

      notifyWorkflowCard('warning', '缺少 PPT 主卡', '保存卡已设为 PPTX 导出，但当前没有连接到 PPT 主卡。');
      return;
    }

    const fallbackImages = linkedImages.length > 0
      ? linkedImages
      : (activeCanvas?.imageNodes || []);

    await exportWorkflowImagesAsZip(
      fallbackImages,
      sourcePrompt?.prompt.slice(0, 24) || activeCanvas?.name || 'kk-studio-export',
    );
  }, [
    activeCanvas,
    exportWorkflowImagesAsZip,
    handleExportPptxEditable,
    resolveWorkflowLinkedImages,
    resolvePrimaryWorkflowSourcePrompt,
  ]);

  const handleWorkflowAgentAction = useCallback((node: AgentWorkflowNode) => {
    const nextPrompt = String(node.data.instruction || node.data.notes || '').trim();
    if (!nextPrompt) {
      notifyWorkflowCard('warning', '增强卡暂时为空', '先给这张卡写一点提示增强说明，再一键填入输入栏。');
      return;
    }

    const sourceImage = resolvePrimaryWorkflowSourceImage(node.data.sourceNodeIds || []);
    if (sourceImage) {
      setActiveSourceImage(sourceImage.id);
      selectNodes([sourceImage.id], 'replace');
    }

    setWorkspaceSurface('workspace');
    setConfig((prev) => ({
      ...prev,
      prompt: nextPrompt,
      referenceImages: sourceImage ? [] : prev.referenceImages,
    }));

    notifyWorkflowCard(
      'success',
      '已填入提示增强',
      sourceImage ? '已保留关联图片作为 follow-up 起点。' : '增强提示已写入输入栏，可继续微调后再生成。',
    );
  }, [
    resolvePrimaryWorkflowSourceImage,
    selectNodes,
    setConfig,
  ]);

  const handleAddWorkflowUtilityCard = useCallback((kind: 'preview' | 'save' | 'agent') => {
    const sourceNodeIds = resolveWorkflowSourceIdsFromSelection();
    const anchorId = sourceNodeIds[0];
    const basePosition = getWorkflowInsertPosition({
      anchorNodeId: anchorId,
      offsetX: anchorId ? 360 : 0,
      offsetY: anchorId ? 24 : 0,
      width: 284,
      height: 176,
    });

    if (kind === 'preview') {
      const previewNode = createPreviewWorkflowNode(basePosition, {
        title: '预览卡',
        summary: sourceNodeIds.length > 0 ? '聚合上游结果，方便快速检查画面。' : '先连接一张图片卡或主卡，再从这里统一预览结果。',
        sourceNodeIds,
      });
      addWorkflowNode(previewNode);
      selectNodes([previewNode.id], 'replace');
      bringNodesToFront([previewNode.id]);
      return;
    }

    if (kind === 'save') {
      const sourcePrompt = resolvePrimaryWorkflowSourcePrompt(sourceNodeIds);
      const saveNode = createSaveWorkflowNode(basePosition, {
        title: '保存卡',
        format: sourcePrompt?.mode === GenerationMode.PPT ? 'pptx' : 'zip',
        sourceNodeIds,
      });
      addWorkflowNode(saveNode);
      selectNodes([saveNode.id], 'replace');
      bringNodesToFront([saveNode.id]);
      return;
    }

    const agentNode = createAgentWorkflowNode(basePosition, {
      title: '提示增强卡',
      instruction: '保持主体一致，补足镜头语言、材质细节和画面氛围，再继续生成。',
      sourceNodeIds,
    });
    addWorkflowNode(agentNode);
    selectNodes([agentNode.id], 'replace');
    bringNodesToFront([agentNode.id]);
  }, [
    addWorkflowNode,
    bringNodesToFront,
    getWorkflowInsertPosition,
    resolvePrimaryWorkflowSourcePrompt,
    resolveWorkflowSourceIdsFromSelection,
    selectNodes,
  ]);

  const handleApplyWorkflowTemplate = useCallback(async (templateId: WorkflowTemplateId) => {
    if (!activeCanvas) {
      notifyWorkflowCard('warning', '当前没有可用画布', '请先打开一个项目，再插入模板。');
      return;
    }

    if (templateId === 'image-follow-up-image') {
      const sourceImage = resolvePrimaryWorkflowSourceImage(resolveWorkflowSourceIdsFromSelection());
      if (!sourceImage) {
        notifyWorkflowCard('warning', '需要先选一张图片', '这个模板会围绕现有图片创建 follow-up 主卡。');
        return;
      }

      const promptPosition = getWorkflowInsertPosition({
        anchorPosition: sourceImage.position,
        offsetX: 360,
        offsetY: 28,
        width: 380,
        height: 220,
      });
      const promptNode = createTemplatePromptNode({
        position: promptPosition,
        prompt: config.prompt.trim() || '继续延展这张图，保持主体与风格一致，补充新的镜头或细节。',
        sourceImageId: sourceImage.id,
      });

      await addPromptNode(promptNode);

      const previewNode = createPreviewWorkflowNode(
        getWorkflowInsertPosition({
          anchorPosition: promptPosition,
          offsetX: 360,
          offsetY: 0,
          width: 284,
          height: 176,
        }),
        {
          title: '预览卡',
          summary: '挂在 follow-up 链路旁，快速核对上游图片与后续结果。',
          sourceNodeIds: [sourceImage.id, promptNode.id],
        },
      );
      const agentNode = createAgentWorkflowNode(
        getWorkflowInsertPosition({
          anchorPosition: promptPosition,
          offsetX: 680,
          offsetY: 12,
          width: 284,
          height: 176,
        }),
        {
          title: '提示增强卡',
          instruction: '保持主体一致，延续构图与材质风格，只扩展新的动作、镜头或场景细节。',
          sourceNodeIds: [sourceImage.id, promptNode.id],
        },
      );

      addWorkflowNode(previewNode);
      addWorkflowNode(agentNode);
      selectNodes([promptNode.id], 'replace');
      bringNodesToFront([promptNode.id, previewNode.id, agentNode.id]);
      notifyWorkflowCard('success', '已插入 follow-up 模板', '原有图片链路没变，只额外挂上了预览卡和提示增强卡。');
      return;
    }

    if (templateId === 'ppt-prompt-export') {
      const promptText = config.prompt.trim() || '为这个主题生成一套可直接导出的 PPT 多页画面方案。';
      const promptPosition = getWorkflowInsertPosition({
        width: 380,
        height: 220,
      });
      const promptNode = createTemplatePromptNode({
        position: promptPosition,
        prompt: promptText,
        mode: GenerationMode.PPT,
      });
      const saveNode = createSaveWorkflowNode(
        getWorkflowInsertPosition({
          anchorPosition: promptPosition,
          offsetX: 360,
          offsetY: 20,
          width: 284,
          height: 176,
        }),
        {
          title: 'PPT 导出卡',
          format: 'pptx',
          sourceNodeIds: [promptNode.id],
        },
      );

      await addPromptNode(promptNode);
      addWorkflowNode(saveNode);
      selectNodes([promptNode.id], 'replace');
      bringNodesToFront([promptNode.id, saveNode.id]);
      notifyWorkflowCard('success', '已插入 PPT 模板', '模板仍然使用你现有的 PPT 主卡与导出链路。');
      return;
    }

    const promptPosition = getWorkflowInsertPosition({
      width: 380,
      height: 220,
    });
    const promptNode = createTemplatePromptNode({
      position: promptPosition,
      prompt: config.prompt.trim() || '在这里填写要生成的主提示词。',
    });
    const saveNode = createSaveWorkflowNode(
      getWorkflowInsertPosition({
        anchorPosition: promptPosition,
        offsetX: 360,
        offsetY: 20,
        width: 284,
        height: 176,
      }),
      {
        title: '保存卡',
        format: 'zip',
        sourceNodeIds: [promptNode.id],
      },
    );

    await addPromptNode(promptNode);
    addWorkflowNode(saveNode);
    selectNodes([promptNode.id], 'replace');
    bringNodesToFront([promptNode.id, saveNode.id]);
    notifyWorkflowCard('success', '已插入卡片模板', '主卡还是你原来的主卡，只在旁边补了一个导出入口。');
  }, [
    activeCanvas,
    addPromptNode,
    addWorkflowNode,
    bringNodesToFront,
    config,
    createTemplatePromptNode,
    getWorkflowInsertPosition,
    resolvePrimaryWorkflowSourceImage,
    resolveWorkflowSourceIdsFromSelection,
    selectNodes,
  ]);

  return {
    notifyWorkflowCard,
    getWorkflowInsertPosition,
    exportWorkflowImagesAsZip,
    createTemplatePromptNode,
    handleWorkflowPreviewAction,
    handleWorkflowSaveAction,
    handleWorkflowAgentAction,
    handleAddWorkflowUtilityCard,
    handleApplyWorkflowTemplate,
  };
}
