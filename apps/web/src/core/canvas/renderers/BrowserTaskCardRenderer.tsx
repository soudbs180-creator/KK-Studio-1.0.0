import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const BrowserTaskCardRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
  highlighted,
}) => {
  const node = item?.node || item;
  const telemetry = node?.telemetry;

  if (detailLevel === 'ghost') {
    return (
      <div 
        className="rounded-xl border border-dashed border-blue-500/30 bg-blue-950/10 pointer-events-auto"
        style={{ width: '280px', height: '140px' }}
      />
    );
  }

  if (detailLevel === 'skeleton') {
    return (
      <div 
        className="rounded-2xl border border-white/10 bg-zinc-900/90 pointer-events-auto flex flex-col p-4 gap-3 shadow-2xl animate-pulse"
        style={{ width: '380px', height: '220px' }}
      >
        <div className="flex gap-2">
          <div className="w-12 h-3 bg-zinc-700 rounded" />
          <div className="w-24 h-3 bg-zinc-800 rounded" />
        </div>
        <div className="w-full h-8 bg-zinc-800 rounded-lg" />
        <div className="flex-1 rounded bg-zinc-800/40 border border-white/5" />
      </div>
    );
  }

  const isFull = detailLevel === 'full';

  return (
    <div 
      className={`rounded-2xl border p-4 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : highlighted ? 'border-blue-400/60' : 'border-white/10'
      }`}
      style={{
        width: '420px',
        height: isFull ? '280px' : '190px',
        color: '#f4f4f5',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              BROWSER NODE
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              URL-Fetcher
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '浏览器自动化动作'}
          </h4>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          <span className="text-[10px] text-zinc-400">已就绪</span>
        </div>
      </div>

      {/* Mini Window Preview */}
      <div className="flex-1 rounded-lg border border-white/5 bg-zinc-900/60 p-2.5 my-2 flex flex-col gap-1.5 shadow-inner">
        <div className="flex items-center gap-1 bg-zinc-950/60 px-2 py-1 rounded text-[9px] font-mono text-zinc-400 border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="truncate">{node?.url || 'https://google.com'}</span>
        </div>
        <div className="flex-1 rounded bg-zinc-950/40 border border-white/5 flex items-center justify-center">
          <span className="text-[10px] text-zinc-600 font-semibold">无网页快照</span>
        </div>
      </div>

      {/* Telemetry Display */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
            <span>抓取用时: {telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '3.2s'}</span>
            <span>来源: {telemetry?.route?.sourceType || 'local-opencli'}</span>
            <span className="text-blue-400">费用: 0 Credits</span>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono">
            <span>Task ID: {telemetry?.jobId || 'task_browser_093'}</span>
          </div>
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Local'}</span>
          <span>抓取时长: 3.2s</span>
        </div>
      )}
    </div>
  );
};

export default BrowserTaskCardRenderer;
