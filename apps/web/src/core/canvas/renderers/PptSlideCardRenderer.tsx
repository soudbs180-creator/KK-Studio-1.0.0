import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const PptSlideCardRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
  highlighted,
}) => {
  const node = item?.node || item;
  const telemetry = node?.telemetry;

  // 1. Ghost Level
  if (detailLevel === 'ghost') {
    return (
      <div 
        className="rounded-2xl border border-dashed border-orange-500/30 bg-zinc-950 pointer-events-auto p-3 flex flex-col justify-between"
        style={{ width: '280px', height: '157px', color: '#f4f4f5' }}
      >
        <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/30">幻灯片单页 GHOST</span>
          <span className="text-orange-400 font-semibold">{node?.isGenerating ? '生成中' : '已就绪'}</span>
        </div>
        <div className="text-[11px] text-zinc-300 font-semibold truncate my-1">
          {node?.prompt || '未命名幻灯片'}
        </div>
        <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
          <span>模型: {node?.model || 'Unknown'}</span>
          <span>费用: {telemetry?.cost?.chargedCredits ?? 5} Credits</span>
        </div>
      </div>
    );
  }

  // 2. Skeleton Level (16:9 container with paragraph lines)
  if (detailLevel === 'skeleton') {
    return (
      <div 
        className="rounded-2xl border border-white/10 bg-zinc-900 pointer-events-auto flex flex-col p-4 gap-3 shadow-2xl animate-pulse"
        style={{ width: '380px', height: '213px', color: '#f4f4f5' }} // 16:9 aspect ratio
      >
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
          <span>幻灯片单页 SKELETON</span>
          <span className="w-2 h-2 rounded-full bg-orange-500" />
        </div>
        <div className="text-xs font-semibold truncate text-zinc-300">
          {node?.prompt || '未命名幻灯片'}
        </div>
        <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
          <span>模型: {node?.model || 'Unknown'}</span>
          <span>渠道: {telemetry?.route?.sourceType || 'api-platform'}</span>
          <span>预计费用: {telemetry?.cost?.chargedCredits ?? 5} Credits</span>
        </div>
        <div className="flex-1 rounded bg-zinc-800/60 flex flex-col p-3 gap-2 mt-1">
          <div className="w-2/3 h-3 bg-zinc-700 rounded" />
          <div className="w-full h-2.5 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  // 3. Full / Compact rendering
  const isFull = detailLevel === 'full';

  return (
    <div 
      className={`rounded-2xl border p-4 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-orange-500 ring-2 ring-orange-500/20' : highlighted ? 'border-orange-400/60' : 'border-white/10'
      }`}
      style={{
        width: '420px',
        height: isFull ? '260px' : '185px',
        color: '#f4f4f5',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
              PPT SLIDE
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              {node?.model || 'Slide-Generator'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '未命名幻灯片'}
          </h4>
        </div>
        <div className="text-[10px] text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
          Slide #{node?.pptSlides ? node.pptSlides.indexOf(node.id) + 1 : 1}
        </div>
      </div>

      {/* Mini Slide Preview Block */}
      <div className="flex-1 rounded-lg border border-white/5 bg-zinc-900/60 p-3 my-2 flex flex-col gap-1.5 shadow-inner">
        <div className="w-12 h-1 bg-orange-400 rounded-full" />
        <div className="text-[11px] font-bold text-white leading-tight truncate">
          {node?.prompt || '大纲主题内容'}
        </div>
        <div className="text-[9px] text-zinc-400 line-clamp-2 leading-relaxed">
          {node?.originalPrompt || '根据大纲内容排版，已优化视觉呈现。段落层次分明，配图符合语境。'}
        </div>
      </div>

      {/* Telemetry Display */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
            <span>时长: {telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '18.4s'}</span>
            <span>模型: {telemetry?.model?.name || 'gemini-2.5-flash'}</span>
            <span className="text-orange-400">费用: {telemetry?.cost?.chargedCredits || 5} Credits</span>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono flex justify-between">
            <span>交易凭证: {telemetry?.cost?.ledgerId || 'tx_slide_012'}</span>
          </div>
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Platform'}</span>
          <span>{telemetry?.cost?.chargedCredits || 5} Credits</span>
        </div>
      )}
    </div>
  );
};

export default PptSlideCardRenderer;
