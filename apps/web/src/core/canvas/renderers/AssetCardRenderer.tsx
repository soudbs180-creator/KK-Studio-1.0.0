import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const AssetCardRenderer: React.FC<CanvasCardRenderContext> = ({
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
        style={{ width: '240px', height: '120px' }}
      />
    );
  }

  if (detailLevel === 'skeleton') {
    return (
      <div 
        className="rounded-2xl border border-white/10 bg-zinc-900/90 pointer-events-auto flex flex-col p-4 gap-3 shadow-2xl animate-pulse"
        style={{ width: '300px', height: '160px' }}
      >
        <div className="w-16 h-3.5 bg-zinc-700 rounded" />
        <div className="w-full h-8 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="w-2/3 h-3 bg-zinc-800 rounded animate-pulse" />
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
        width: '320px',
        height: isFull ? '220px' : '150px',
        color: '#f4f4f5',
      }}
    >
      {/* Header */}
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-indigo-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">资产卡片</div>
          <h4 className="text-xs font-semibold text-white truncate mt-0.5">
            {node?.prompt || '未命名资产文件'}
          </h4>
        </div>
      </div>

      {/* File Info */}
      <div className="rounded-lg bg-zinc-900/40 border border-white/5 p-2.5 my-2 flex justify-between items-center text-[10px] text-zinc-400 font-mono">
        <span>类型: {node?.mimeType || 'IMAGE/PNG'}</span>
        <span>大小: {node?.sizeBytes ? `${(node.sizeBytes / 1024).toFixed(1)} KB` : '420 KB'}</span>
      </div>

      {/* Telemetry info */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 mt-1 flex flex-col gap-1 text-[9px] text-zinc-500 font-mono">
          <div className="flex justify-between">
            <span>创建时间: {node?.timestamp ? new Date(node.timestamp).toLocaleDateString() : '2026/06/27'}</span>
            <span className="text-indigo-400 cursor-pointer hover:underline">下载原图</span>
          </div>
          {telemetry?.cost?.ledgerId && (
            <span>Ledger ID: {telemetry.cost.ledgerId}</span>
          )}
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="text-[9px] text-zinc-500 font-mono text-right border-t border-white/5 pt-1.5">
          <span>存储 ID: {node?.storageId ? node.storageId.slice(0, 8) : 'sha256_82'}</span>
        </div>
      )}
    </div>
  );
};

export default AssetCardRenderer;
