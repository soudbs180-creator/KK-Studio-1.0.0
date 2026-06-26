import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const PptDeckCardRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
  highlighted,
}) => {
  const node = item?.node || item;
  const telemetry = node?.telemetry;

  // 1. Ghost Level
  if (detailLevel === 'ghost') {
    const pageCount = node?.pptDeck?.pages?.length || node?.pptSlides?.length || 8;
    return (
      <div 
        className="rounded-2xl border border-dashed border-amber-500/30 bg-zinc-950 pointer-events-auto p-4 flex flex-col justify-between"
        style={{ width: '320px', height: '220px', color: '#f4f4f5' }}
      >
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/30">演示文稿大纲 GHOST</span>
          <span className="text-amber-400 font-semibold">{node?.isGenerating ? '生成中' : '已就绪'}</span>
        </div>
        <div className="text-xs text-zinc-300 font-semibold truncate my-2">
          {node?.prompt || '未命名演示文稿大纲'}
        </div>
        <div className="flex flex-col gap-1 text-[9px] text-zinc-500 font-mono">
          <span>模型: {node?.model || 'Unknown'}</span>
          <span>通道: {telemetry?.route?.sourceType || 'api-platform'}</span>
          <span>费用: {telemetry?.cost?.chargedCredits ?? 10} Credits</span>
          <span>页数: {pageCount} 页</span>
        </div>
      </div>
    );
  }

  // 2. Skeleton Level (book/stacked deck wireframe skeleton)
  if (detailLevel === 'skeleton') {
    const pageCount = node?.pptDeck?.pages?.length || node?.pptSlides?.length || 8;
    return (
      <div 
        className="rounded-2xl border border-white/10 bg-zinc-900 pointer-events-auto flex flex-col p-5 gap-3 shadow-2xl relative"
        style={{ width: '420px', height: '280px', color: '#f4f4f5' }}
      >
        {/* Layer stack effect skeletons */}
        <div className="absolute top-[-6px] left-[10px] right-[10px] h-[6px] rounded-t-xl bg-zinc-800 border-t border-x border-white/5 animate-pulse" />
        <div className="absolute top-[-12px] left-[20px] right-[20px] h-[6px] rounded-t-xl bg-zinc-700 border-t border-x border-white/5 animate-pulse" />
        
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
          <span>演示文稿大纲 SKELETON</span>
          <span className="w-12 h-3 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="text-xs font-semibold truncate text-zinc-300">
          {node?.prompt || '未命名演示文稿大纲'}
        </div>
        <div className="flex flex-col gap-1 text-[10px] text-zinc-400 font-mono">
          <span>模型: {node?.model || 'Unknown'}</span>
          <span>渠道: {telemetry?.route?.sourceType || 'api-platform'}</span>
          <span>预计费用: {telemetry?.cost?.chargedCredits ?? 10} Credits | 页数: {pageCount} 页</span>
        </div>
        <div className="flex-1 rounded-lg bg-zinc-800/40 border border-white/5 flex flex-col p-3 gap-2 mt-2 animate-pulse">
          <div className="w-1/3 h-3 bg-zinc-700 rounded" />
          <div className="w-full h-2.5 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  // 3. Full / Compact rendering
  const isFull = detailLevel === 'full';
  const pageCount = node?.pptDeck?.pages?.length || node?.pptSlides?.length || 8;

  return (
    <div 
      className={`rounded-2xl border p-5 pointer-events-auto flex flex-col justify-between shadow-2xl relative bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-amber-500 ring-2 ring-amber-500/20' : highlighted ? 'border-amber-400/60' : 'border-white/10'
      }`}
      style={{
        width: '460px',
        height: isFull ? '320px' : '220px',
        color: '#f4f4f5',
        marginTop: '12px', // Make space for the top stacked layout
      }}
    >
      {/* Visual Layer Stack Effect */}
      <div className="absolute top-[-5px] left-[8px] right-[8px] h-[5px] rounded-t-xl bg-zinc-800 border-t border-x border-white/10" />
      <div className="absolute top-[-10px] left-[16px] right-[16px] h-[5px] rounded-t-xl bg-zinc-700 border-t border-x border-white/10 opacity-60" />

      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              PPT DECK
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              {node?.model || 'Deck-Composer-Pro'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '未命名演示文稿大纲'}
          </h4>
        </div>
        <div className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{pageCount} 页</span>
        </div>
      </div>

      {/* Slide Stack Overview Panel */}
      <div className="flex-1 rounded-lg border border-white/5 bg-zinc-900/40 p-3.5 my-2.5 flex flex-col justify-between shadow-inner">
        <div className="flex justify-between items-center text-[11px] text-zinc-400">
          <span>当前主题: {node?.pptDeck?.styleTheme || '商务科技蓝色'}</span>
          <span className="text-indigo-400 font-medium cursor-pointer hover:underline">编辑结构</span>
        </div>
        <div className="flex gap-2 mt-2">
          {/* Mock Miniature Slide Previews */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 aspect-[16/10] rounded border border-white/5 bg-zinc-950 flex flex-col justify-between p-1 shadow">
              <div className="w-4 h-0.5 bg-orange-400 rounded-full" />
              <div className="w-full h-1 bg-zinc-800 rounded" />
              <span className="text-[6px] text-zinc-500 font-mono text-right mt-auto">Slide {i}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Telemetry Display */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 flex flex-col gap-1.5">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-zinc-400">
            <div className="bg-zinc-900/40 p-1 rounded border border-white/5 flex flex-col">
              <span className="text-zinc-600 text-[8px] uppercase">生成耗时</span>
              <span className="text-white font-semibold">{telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '34.5s'}</span>
            </div>
            <div className="bg-zinc-900/40 p-1 rounded border border-white/5 flex flex-col">
              <span className="text-zinc-600 text-[8px] uppercase">平均每页</span>
              <span className="text-white font-semibold">{telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / pageCount / 1000).toFixed(1)}s` : '4.3s'}</span>
            </div>
            <div className="bg-zinc-900/40 p-1 rounded border border-white/5 flex flex-col">
              <span className="text-zinc-600 text-[8px] uppercase">消耗总计</span>
              <span className="text-white font-semibold text-amber-400">{telemetry?.cost?.chargedCredits || (pageCount * 5)} Credits</span>
            </div>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono flex justify-between">
            <span>凭证 ID: {telemetry?.cost?.ledgerId || 'tx_deck_847321'}</span>
            <button className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1">
              <span>导出 PPTX</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Platform'}</span>
          <span>{telemetry?.cost?.chargedCredits || (pageCount * 5)} Credits</span>
        </div>
      )}
    </div>
  );
};

export default PptDeckCardRenderer;
