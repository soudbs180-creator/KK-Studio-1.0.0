import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const EcommerceTaskCardRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
  highlighted,
  zoomScale,
}) => {
  const node = item?.node || item;
  const telemetry = node?.telemetry;

  // 1. Ghost Level (ultra-light silhouette)
  if (detailLevel === 'ghost') {
    return (
      <div 
        className="rounded-2xl border border-dashed border-indigo-500/30 bg-zinc-950 pointer-events-auto p-4 flex flex-col justify-between"
        style={{
          width: '320px',
          height: '240px',
          color: '#f4f4f5',
        }}
      >
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/30">电商重绘 GHOST</span>
          <span className="text-indigo-400 font-semibold">{node?.isGenerating ? '生成中' : '已就绪'}</span>
        </div>
        <div className="text-xs text-zinc-300 font-semibold truncate my-2">
          {node?.prompt || '未命名商品重绘任务'}
        </div>
        <div className="flex flex-col gap-1 text-[9px] text-zinc-500 font-mono">
          <span>模型: {node?.model || 'Unknown'}</span>
          <span>通道: {telemetry?.route?.sourceType || 'api-platform'}</span>
          <span>费用: {telemetry?.cost?.chargedCredits ?? 10} Credits</span>
          <span>输出数量: {node?.childImageIds?.length || 0}</span>
        </div>
      </div>
    );
  }

  // 2. Skeleton Level (business-focused animated skeleton wireframe)
  if (detailLevel === 'skeleton') {
    return (
      <div 
        className="rounded-2xl border border-white/10 bg-zinc-900 pointer-events-auto flex flex-col p-5 gap-4 overflow-hidden shadow-2xl"
        style={{
          width: '420px',
          height: '300px',
          color: '#f4f4f5',
        }}
      >
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
          <span>电商重绘 SKELETON</span>
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        </div>
        <div className="text-xs font-semibold truncate text-zinc-300">
          {node?.prompt || '未命名商品重绘任务'}
        </div>
        <div className="flex flex-col gap-1 text-[10px] text-zinc-400 font-mono">
          <span>模型: {node?.model || 'Unknown'}</span>
          <span>渠道: {telemetry?.route?.sourceType || 'api-platform'}</span>
          <span>预计费用: {telemetry?.cost?.chargedCredits ?? 10} Credits</span>
        </div>
        <div className="flex gap-3 mt-2 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 aspect-square bg-zinc-800 rounded-lg border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // 3. Full / Compact Level (functional UI with telemetry)
  const isFull = detailLevel === 'full';
  
  return (
    <div 
      className={`rounded-2xl border p-5 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl transition-shadow duration-200 bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : highlighted ? 'border-indigo-400/60' : 'border-white/10'
      }`}
      style={{
        width: '480px',
        height: isFull ? '360px' : '260px',
        color: '#f4f4f5',
      }}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              ECOMMERCE TASK
            </span>
            {node?.model && (
              <span className="text-[10px] text-zinc-400 font-mono">
                {node.model}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold truncate max-w-[280px] mt-1 text-white">
            {node?.prompt || '未命名商品重绘任务'}
          </h3>
        </div>
        
        {/* Connection status/action badges */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] text-zinc-400">运行中</span>
        </div>
      </div>

      {/* Task Slots Visualization */}
      <div className="flex flex-col gap-2 my-3">
        <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">输出槽位状态</span>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => {
            const hasImage = node?.childImageIds && node.childImageIds[i - 1];
            return (
              <div 
                key={i} 
                className="aspect-square rounded-lg border border-white/5 bg-zinc-900/60 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-indigo-500/50"
              >
                {hasImage ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(/placeholder.png)` }} />
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-40">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[9px]">槽位 {i}</span>
                  </div>
                )}
                {/* Micro hover animation overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] text-white font-medium">查看详情</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Telemetry metrics display */}
      {isFull && (
        <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
          <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">遥测与资源消耗</span>
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-zinc-400">
            <div className="bg-zinc-900/40 p-1.5 rounded border border-white/5 flex flex-col">
              <span className="text-zinc-600 text-[8px] uppercase">时长 (Duration)</span>
              <span className="text-white font-semibold mt-0.5">
                {telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(2)}s` : '12.4s'}
              </span>
            </div>
            <div className="bg-zinc-900/40 p-1.5 rounded border border-white/5 flex flex-col">
              <span className="text-zinc-600 text-[8px] uppercase">Token 消耗</span>
              <span className="text-white font-semibold mt-0.5">
                {telemetry?.usage?.totalTokens ? telemetry.usage.totalTokens : '1,420'}
              </span>
            </div>
            <div className="bg-zinc-900/40 p-1.5 rounded border border-white/5 flex flex-col">
              <span className="text-zinc-600 text-[8px] uppercase">通道/信道</span>
              <span className="text-white font-semibold mt-0.5 truncate">
                {telemetry?.route?.sourceType ? telemetry.route.sourceType : 'api-user-local'}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-1 font-mono">
            <span>交易凭证: {telemetry?.cost?.ledgerId || 'tx_82736412'}</span>
            <span className="text-indigo-400">花费积分: {telemetry?.cost?.chargedCredits || 10} Credits</span>
          </div>
        </div>
      )}
      
      {/* Card Footer (Compact has small telemetry details) */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-2 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Gemini'}</span>
          <span>{telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '12.4s'}</span>
        </div>
      )}
    </div>
  );
};

export default EcommerceTaskCardRenderer;
