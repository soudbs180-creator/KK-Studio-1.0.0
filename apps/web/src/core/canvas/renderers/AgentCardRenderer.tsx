import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const AgentCardRenderer: React.FC<CanvasCardRenderContext> = ({
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
        className="rounded-xl border border-dashed border-teal-500/30 bg-teal-950/10 pointer-events-auto"
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
        <div className="w-full h-8 bg-zinc-800 rounded-lg" />
        <div className="flex-1 rounded bg-zinc-800/40 border border-white/5" />
      </div>
    );
  }

  const isFull = detailLevel === 'full';

  return (
    <div 
      className={`rounded-2xl border p-4 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-teal-500 ring-2 ring-teal-500/20' : highlighted ? 'border-teal-400/60' : 'border-white/10'
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
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              AGENT TASK
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              {node?.model || 'Agent-Runtime'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '自治 AI 代理任务'}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-[10px] text-teal-400 font-medium">执行中</span>
        </div>
      </div>

      {/* Instruction Details */}
      <div className="flex-1 rounded-lg border border-white/5 bg-zinc-900/60 p-2.5 my-2 flex flex-col gap-1.5 shadow-inner">
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">运行策略</span>
        <div className="text-[11px] text-zinc-300 font-medium leading-relaxed line-clamp-2">
          {node?.instruction || '分析当前画布卡片排版布局，自动整理重叠图像卡片使大画布布局整齐。'}
        </div>
      </div>

      {/* Telemetry info */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
            <span>运行用时: {telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '15.6s'}</span>
            <span>信道: {telemetry?.route?.sourceType || 'cloud-vps'}</span>
            <span className="text-teal-400">费用: 2 Credits</span>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono">
            <span>Agent Job: {telemetry?.jobId || 'agent_job_847'}</span>
          </div>
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Suxi'}</span>
          <span>花费积分: 2 Credits</span>
        </div>
      )}
    </div>
  );
};

export default AgentCardRenderer;
