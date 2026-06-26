import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const ExportCardRenderer: React.FC<CanvasCardRenderContext> = ({
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
        className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/10 pointer-events-auto"
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
        <div className="w-16 h-3.5 bg-zinc-700 rounded" />
        <div className="w-full h-8 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="flex-1 rounded bg-zinc-800/40 border border-white/5" />
      </div>
    );
  }

  const isFull = detailLevel === 'full';

  return (
    <div 
      className={`rounded-2xl border p-4 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : highlighted ? 'border-indigo-400/60' : 'border-white/10'
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
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              EXPORT FILE
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              {node?.format || 'ZIP'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '导出原图打包任务'}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400">已就绪</span>
        </div>
      </div>

      {/* Export status */}
      <div className="flex-1 rounded-lg border border-white/5 bg-zinc-900/60 p-2.5 my-2 flex flex-col justify-between shadow-inner">
        <div className="flex justify-between text-[10px] text-zinc-400">
          <span>打包格式: {node?.format || 'ZIP_ARCHIVE'}</span>
          <span>源文件数: {node?.sourceNodeIds?.length || 12}</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: '100%' }} />
          </div>
          <span className="text-[9px] font-mono text-zinc-400">100%</span>
        </div>
      </div>

      {/* Telemetry info */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
            <span>导出时长: {telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '5.8s'}</span>
            <span>触发信道: {telemetry?.route?.sourceType || 'local-model'}</span>
            <span className="text-indigo-400">费用: 0 Credits</span>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono">
            <span>Export Job: {telemetry?.jobId || 'export_job_912'}</span>
          </div>
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Local'}</span>
          <span>下载完成</span>
        </div>
      )}
    </div>
  );
};

export default ExportCardRenderer;
