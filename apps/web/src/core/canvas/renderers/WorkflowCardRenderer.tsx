import React from 'react';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const WorkflowCardRenderer: React.FC<CanvasCardRenderContext> = ({
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
        className="rounded-xl border border-dashed border-violet-500/30 bg-violet-950/10 pointer-events-auto"
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
        <div className="w-20 h-3.5 bg-zinc-700 rounded" />
        <div className="w-full h-8 bg-zinc-800 rounded-lg" />
        <div className="flex-1 rounded bg-zinc-800/40 border border-white/5" />
      </div>
    );
  }

  const isFull = detailLevel === 'full';

  return (
    <div 
      className={`rounded-2xl border p-4 pointer-events-auto flex flex-col justify-between overflow-hidden shadow-2xl bg-zinc-950/90 backdrop-blur-lg ${
        isSelected ? 'border-violet-500 ring-2 ring-violet-500/20' : highlighted ? 'border-violet-400/60' : 'border-white/10'
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
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              WORKFLOW UTILITY
            </span>
            <span className="text-[10px] text-zinc-400 font-mono truncate">
              {node?.model || 'Workflow-Runner'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white mt-1 truncate">
            {node?.prompt || '系统工作流管道'}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-[10px] text-zinc-400">已就绪</span>
        </div>
      </div>

      {/* Workflow Stats */}
      <div className="flex-1 rounded-lg border border-white/5 bg-zinc-900/60 p-2.5 my-2 flex flex-col gap-1 shadow-inner">
        <div className="flex justify-between text-[10px] text-zinc-400">
          <span>任务类型: {node?.workflowType || 'IMAGE_BATCH_PROCESS'}</span>
          <span>连接节点数: {node?.childNodes?.length || 4}</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: '75%' }} />
        </div>
        <span className="text-[8px] text-zinc-500 mt-1 font-mono">管道编译正常，执行就绪。</span>
      </div>

      {/* Telemetry info */}
      {isFull && (
        <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
            <span>编译用时: {telemetry?.timing?.totalDurationMs ? `${(telemetry.timing.totalDurationMs / 1000).toFixed(1)}s` : '1.4s'}</span>
            <span>触发来源: {telemetry?.route?.sourceType || 'local-opencli'}</span>
            <span className="text-violet-400">费用: 0 Credits</span>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono">
            <span>Workflow ID: {telemetry?.jobId || 'wf_utility_928'}</span>
          </div>
        </div>
      )}

      {/* Compact footer */}
      {!isFull && (
        <div className="flex justify-between items-center border-t border-white/5 pt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>{telemetry?.model?.provider || 'Local'}</span>
          <span>执行正常</span>
        </div>
      )}
    </div>
  );
};

export default WorkflowCardRenderer;
