// 简体中文：画布图像节点浮动后处理工具栏 (Image Post-Processing Floating Toolbar)
// Miora G3 节点级图像编辑工具箱集成

import React from 'react';
import type { ImagePostProcessingAction } from '@kk/shared';

export interface ImagePostProcessingToolbarProps {
  selectedNodeId: string;
  isVisible: boolean;
  onExecuteAction: (action: ImagePostProcessingAction, params?: Record<string, any>) => void;
}

export const ImagePostProcessingToolbar: React.FC<ImagePostProcessingToolbarProps> = ({
  selectedNodeId,
  isVisible,
  onExecuteAction,
}) => {
  if (!isVisible || !selectedNodeId) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-xl shadow-xl text-xs text-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
      <button
        onClick={() => onExecuteAction('remove_background')}
        className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-1"
        title="AI 一键智能去背/抠图"
      >
        <span>✨</span> 智能去背
      </button>

      <button
        onClick={() => onExecuteAction('upscale', { scaleFactor: 4 })}
        className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-1"
        title="4K 高清超级放大"
      >
        <span>🔍</span> 4K HD 放大
      </button>

      <button
        onClick={() => onExecuteAction('inpainting')}
        className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-1"
        title="选区局部重绘/换字/替换元素"
      >
        <span>🎨</span> 选区重绘
      </button>

      <button
        onClick={() => onExecuteAction('outpainting')}
        className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-1"
        title="AI 智能图像扩展"
      >
        <span>🖼️</span> 智能扩图
      </button>

      <button
        onClick={() => onExecuteAction('vectorize')}
        className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-1"
        title="转换矢量 SVG 格式"
      >
        <span>📐</span> 矢量化 SVG
      </button>
    </div>
  );
};
