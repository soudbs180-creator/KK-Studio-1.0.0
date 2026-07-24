// 简体中文：全新无限画布控制台 (New Infinite Canvas Console)
// 包含顶栏视口浮动控制、节点后处理工具栏、底座 Floating Dock 与 AI 协作中心

import React, { useState } from 'react';
import { BrandVIFlowModal } from '../../features/brand-vi/BrandVIFlowModal';
import { SkillManagerPanel } from '../../features/skills/SkillManagerPanel';
import { ImagePostProcessingToolbar } from './ImagePostProcessingToolbar';
import type { AgentSkillManifest } from '@kk/shared';

export interface NewInfiniteCanvasConsoleProps {
  canvasName: string;
  zoomScale: number;
  selectedNodeIds: string[];
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onAddPromptCard: () => void;
  onBatchGenerate: (prompts: string[]) => void;
  onExecuteImageAction: (action: string, params?: any) => void;
  children?: React.ReactNode;
}

export const NewInfiniteCanvasConsole: React.FC<NewInfiniteCanvasConsoleProps> = ({
  canvasName,
  zoomScale,
  selectedNodeIds,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onAddPromptCard,
  onBatchGenerate,
  onExecuteImageAction,
  children
}) => {
  const [isBrandViModalOpen, setIsBrandViModalOpen] = useState(false);
  const [isSkillManagerOpen, setIsSkillManagerOpen] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);

  // Mock / System pre-installed skills
  const [skills, setSkills] = useState<AgentSkillManifest[]>([
    {
      id: 'skill-brand-vi',
      name: 'Miora 品牌 VI 专家模式',
      version: '1.0.0',
      description: '自动分析品牌调性，提炼色板、字体并批量生成全套 VI 视觉物料',
      category: 'design',
      author: 'KK Studio Core Team',
      permissions: ['canvas:read', 'canvas:write', 'storage:write'],
      parameters: { type: 'object', properties: {} },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'skill-ppt-export',
      name: 'PPT 演示文稿结构化生成',
      version: '1.2.0',
      description: '生成真正可编辑图层的 OpenXML PPTX 结构与讲稿卡片',
      category: 'workflow',
      author: 'KK Studio Core Team',
      permissions: ['canvas:read', 'canvas:write'],
      parameters: { type: 'object', properties: {} },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'skill-image-vectorize',
      name: 'SVG 矢量图形提取',
      version: '2.0.1',
      description: '将位图自动转换为高精度 SVG 矢量文件卡片',
      category: 'utility',
      author: 'Awesome Claude Skills',
      permissions: ['canvas:read', 'canvas:write'],
      parameters: { type: 'object', properties: {} },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]);

  const handleToggleSkill = (skillId: string, enabled: boolean) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, enabled } : s))
    );
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans text-slate-100">
      {/* Background Canvas Layer Grid */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          gridEnabled ? 'opacity-30' : 'opacity-0'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255, 255, 255, 0.15) 1px, transparent 1px)', // UI_TOKEN_EXCEPTION
          backgroundSize: `${24 * zoomScale}px ${24 * zoomScale}px`
        }}
      />

      {/* 1. Top Navigation & Control Rail */}
      <header className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Project & Canvas Info */}
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-lg">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
            KK
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wide text-slate-100 flex items-center gap-2">
              {canvasName || '无限创意画布'}
              <span className="px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                v1.6.0 Pro
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">已选中 {selectedNodeIds.length} 个节点</p>
          </div>
        </div>

        {/* Center: Viewport Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-lg text-xs">
          <button
            onClick={onZoomOut}
            className="w-7 h-7 flex items-center justify-center hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors"
            title="缩小视口"
          >
            －
          </button>
          <button
            onClick={onResetZoom}
            className="px-2.5 py-1 text-slate-300 hover:text-white font-mono hover:bg-slate-800 rounded-xl transition-colors"
            title="重置为 100%"
          >
            {Math.round(zoomScale * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="w-7 h-7 flex items-center justify-center hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors"
            title="放大视口"
          >
            ＋
          </button>

          <div className="w-px h-4 bg-slate-800 mx-1" />

          <button
            onClick={() => setGridEnabled(!gridEnabled)}
            className={`px-2.5 py-1 rounded-xl transition-colors ${
              gridEnabled ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="切换网格参考线"
          >
            🌐 网格
          </button>
        </div>

        {/* Right: Quick Actions */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setIsSkillManagerOpen(true)}
            className="px-3 py-1.5 bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/50 backdrop-blur-md text-xs font-medium text-slate-200 hover:text-white rounded-2xl shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>🧩</span> 技能中心
          </button>
          <button
            onClick={() => setIsBrandViModalOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white rounded-2xl shadow-lg shadow-indigo-950/40 transition-all flex items-center gap-1.5"
          >
            <span>✨</span> 品牌 VI 专家模式
          </button>
        </div>
      </header>

      {/* 2. Floating Post-Processing Toolbar (Appears when cards are selected) */}
      <ImagePostProcessingToolbar
        selectedNodeId={selectedNodeIds[0] || ''}
        isVisible={selectedNodeIds.length === 1}
        onExecuteAction={(action, params) => onExecuteImageAction(action, params)}
      />

      {/* 3. Main Infinite Canvas Render Area */}
      <main className="w-full h-full">{children}</main>

      {/* 4. Bottom Floating Tools Dock */}
      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2 p-2 bg-slate-900/85 border border-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl">
        <button
          onClick={onAddPromptCard}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <span className="text-sm">＋</span> 新建提示词卡片
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        <button
          onClick={() => onAddPromptCard()}
          className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl text-xs transition-colors flex items-center gap-1.5"
          title="生成文生图卡片"
        >
          <span>🖼️</span> 图像生成
        </button>

        <button
          onClick={() => setIsBrandViModalOpen(true)}
          className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl text-xs transition-colors flex items-center gap-1.5"
          title="品牌调性与物料生成"
        >
          <span>🎨</span> 品牌物料
        </button>

        <button
          onClick={() => setIsSkillManagerOpen(true)}
          className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl text-xs transition-colors flex items-center gap-1.5"
          title="技能与自动化工作流"
        >
          <span>⚙️</span> 工作流节点
        </button>
      </footer>

      {/* 5. Modals & Side Panels */}
      <BrandVIFlowModal
        isOpen={isBrandViModalOpen}
        onClose={() => setIsBrandViModalOpen(false)}
        onSaveProfile={async () => {}}
        onBatchGenerateToCanvas={(prompts) => onBatchGenerate(prompts)}
      />

      <SkillManagerPanel
        isOpen={isSkillManagerOpen}
        onClose={() => setIsSkillManagerOpen(false)}
        skills={skills}
        onToggleSkill={handleToggleSkill}
      />
    </div>
  );
};
