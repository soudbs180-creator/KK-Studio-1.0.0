import type {
  AssistantCollaborationMode,
  AssistantContextSuggestion,
  CanvasRuntimeState,
} from '../types.ts';

export const ASSISTANT_COLLABORATION_MODE_STORAGE_KEY = 'kk_assistant_collaboration_mode_v1';

export const ASSISTANT_COLLABORATION_MODE_OPTIONS: ReadonlyArray<{
  mode: AssistantCollaborationMode;
  label: string;
  description: string;
}> = [
  {
    mode: 'direct',
    label: '直接操作',
    description: '继续点击、拖拽和编辑画布，AI 不会自动执行操作。',
  },
  {
    mode: 'assist',
    label: 'AI 辅助',
    description: 'AI 同步当前页面与选区，提出建议并等待你决定是否执行。',
  },
  {
    mode: 'takeover',
    label: 'AI 接管',
    description: 'AI 通过统一执行链跨页面、跨工具完成目标，高风险步骤仍需确认。',
  },
];

export const normalizeAssistantCollaborationMode = (
  value: unknown,
): AssistantCollaborationMode => (
  value === 'assist' || value === 'takeover' || value === 'direct'
    ? value
    : 'direct'
);

const addSuggestion = (
  suggestions: AssistantContextSuggestion[],
  suggestion: AssistantContextSuggestion,
) => {
  if (suggestions.some((item) => item.id === suggestion.id)) return;
  suggestions.push(suggestion);
};

export const buildAssistantContextSuggestions = (
  runtime: CanvasRuntimeState,
  limit = 4,
): AssistantContextSuggestion[] => {
  const suggestions: AssistantContextSuggestion[] = [];
  const targetNodeIds = [...runtime.selection.selectedNodeIds];
  const selectedPromptCount = runtime.selection.promptNodeIds.length;
  const selectedImageCount = runtime.selection.imageNodeIds.length
    + runtime.selection.childImageNodeIdsFromSelectedPrompts.length;
  const selectedNoteCount = runtime.selection.noteNodeIds.length;
  const selectedWorkflowCount = runtime.selection.workflowNodeIds.length;
  const hasFailedPrompt = runtime.selectedNodes.prompts.some((node) => node.status === 'failed');
  const canvasItemCount = runtime.canvas.promptCount
    + runtime.canvas.imageCount
    + runtime.canvas.noteCount
    + runtime.canvas.workflowPanelCount;

  if (runtime.currentPage === 'library') {
    addSuggestion(suggestions, {
      id: 'library-to-canvas',
      label: '整理素材到画布',
      description: '基于当前素材库页面建立可编辑的画布分组。',
      prompt: '把我当前浏览的素材按主题整理到画布，并先给出可编辑计划。',
      targetNodeIds: [],
    });
  } else if (runtime.currentPage === 'favorites') {
    addSuggestion(suggestions, {
      id: 'favorites-to-canvas',
      label: '用收藏创建方案',
      description: '将当前收藏作为参考，先规划一套可编辑方案。',
      prompt: '使用我当前的收藏内容创建一套画布方案，先展示计划，不要直接执行。',
      targetNodeIds: [],
    });
  } else if (runtime.currentPage === 'settings') {
    addSuggestion(suggestions, {
      id: 'review-current-settings',
      label: '检查当前设置',
      description: '根据当前设置页面给出配置建议，不读取或回显任何密钥。',
      prompt: '检查我当前所在的设置页面，说明可优化的配置和安全注意事项；不要读取、回显或要求我在聊天中发送密钥。',
      targetNodeIds: [],
    });
  } else if (runtime.currentPage === 'agent') {
    addSuggestion(suggestions, {
      id: 'continue-agent-task',
      label: '继续当前任务',
      description: '读取当前任务与持久队列状态，建议安全的下一步。',
      prompt: '根据当前助手任务、待确认计划和持久队列状态，总结进度并建议下一步；先不要执行。',
      targetNodeIds: [],
    });
  }

  if (hasFailedPrompt) {
    addSuggestion(suggestions, {
      id: 'retry-failed-selection',
      label: '检查失败任务',
      description: '检查选中卡片的错误并给出安全重试步骤。',
      prompt: '检查当前选区中的失败生成任务，说明原因并给出可重试的修复计划。',
      targetNodeIds,
    });
  }

  if (runtime.selection.count > 1 && runtime.selection.capabilities.canArrange) {
    addSuggestion(suggestions, {
      id: 'arrange-selection',
      label: '整理当前选区',
      description: `按内容关系整理已选中的 ${runtime.selection.count} 个对象。`,
      prompt: '把当前选中的对象整理成紧凑网格，保持内容关系，并先预览影响范围。',
      targetNodeIds,
    });
  }

  if (selectedImageCount > 0) {
    addSuggestion(suggestions, {
      id: 'create-image-variants',
      label: '生成同风格变体',
      description: '以选中图片为参考，保持主体与品牌风格。',
      prompt: '基于当前选中的图片生成同一品牌风格的变体，先给出数量、成本和排版计划。',
      targetNodeIds,
    });
    addSuggestion(suggestions, {
      id: 'export-selected-originals',
      label: '导出选中原图',
      description: '检查原图可用性并准备 ZIP 清单。',
      prompt: '检查当前选区的原图是否齐全，并准备导出选中原图 ZIP 的执行计划。',
      targetNodeIds,
    });
  }

  if (selectedPromptCount > 0) {
    addSuggestion(suggestions, {
      id: 'optimize-selected-prompts',
      label: '优化选中提示词',
      description: '读取选中 Prompt 的内容与结果状态后提出改进。',
      prompt: '分析并优化当前选中的提示词，保留原意，先列出建议和预期变化。',
      targetNodeIds,
    });
    addSuggestion(suggestions, {
      id: 'generate-selected-prompts',
      label: '继续生成方案',
      description: '根据选中 Prompt 规划下一轮生成。',
      prompt: '根据当前选中的提示词规划下一轮生成，先展示数量、成本和影响范围。',
      targetNodeIds,
    });
  }

  if (selectedNoteCount > 0 || selectedWorkflowCount > 0) {
    addSuggestion(suggestions, {
      id: 'continue-structured-work',
      label: '继续结构化任务',
      description: '根据选中的记事本或工作流面板建议下一步。',
      prompt: '读取当前选中的记事本或工作流面板，总结状态并建议下一步，不要直接修改。',
      targetNodeIds,
    });
  }

  if (runtime.selection.count === 0 && canvasItemCount === 0) {
    addSuggestion(suggestions, {
      id: 'start-first-canvas-plan',
      label: '创建第一套方案',
      description: '从目标、尺寸和素材需求开始建立计划。',
      prompt: '帮我从零创建一套画布方案，先澄清目标、尺寸、数量和参考素材。',
      targetNodeIds: [],
    });
  } else if (runtime.selection.count === 0) {
    addSuggestion(suggestions, {
      id: 'review-whole-canvas',
      label: '检查整个画布',
      description: `检查画布上的 ${canvasItemCount} 个内容对象并提出下一步。`,
      prompt: '检查当前整个画布的内容、布局和失败任务，给出下一步建议，不要直接执行。',
      targetNodeIds: [],
    });
    addSuggestion(suggestions, {
      id: 'arrange-whole-canvas',
      label: '规划全局排版',
      description: '分析当前分组与边界，预览全局排版方案。',
      prompt: '分析当前画布并提出全局排版计划，先展示影响范围和可撤销策略。',
      targetNodeIds: [],
    });
  }

  return suggestions.slice(0, Math.max(0, limit));
};
