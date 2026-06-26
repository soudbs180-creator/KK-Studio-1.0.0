import React from 'react';
import type { BrowserTaskResult } from './browserAssistantTypes';

interface TaskListProps {
  tasks: BrowserTaskResult[];
}

export const BrowserAssistantTaskList: React.FC<TaskListProps> = ({ tasks }) => {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/10 rounded-xl bg-slate-950/20">
        <span className="text-3xl mb-2">📋</span>
        <p className="text-xs text-slate-400">当前没有处于活动中或已归档的任务列表。</p>
      </div>
    );
  }

  const getStatusBadge = (status: BrowserTaskResult['status']) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">成功</span>;
      case 'failed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">失败</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">取消</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">执行中</span>;
    }
  };

  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
      {tasks.map((task, idx) => (
        <div
          key={task.auditLogId || idx}
          className="p-3.5 rounded-xl border border-white/5 bg-slate-950/40 hover:border-white/10 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              {task.siteId} · {task.actionType}
            </span>
            {getStatusBadge(task.status)}
          </div>

          {task.error && (
            <p className="text-[11px] leading-relaxed text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-500/10 mb-1">
              ⚠️ {task.error}
            </p>
          )}

          {task.extractedText && (
            <p className="text-[11px] leading-relaxed text-slate-300 line-clamp-2">
              {task.extractedText}
            </p>
          )}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[9px] text-slate-500">
            <span>审计ID: {task.auditLogId}</span>
            <span>{task.extractedImages && task.extractedImages.length > 0 ? `🖼️ 包含 ${task.extractedImages.length} 张图片` : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
