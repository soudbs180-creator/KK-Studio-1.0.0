import React, { useState } from 'react';
import { Check, RotateCcw, ShieldCheck } from 'lucide-react';
import type { CanvasMigrationSummary } from '@kk/shared';
import {
  CANVAS_STORAGE_KEY,
  readCanvasMigrationSummary,
} from '../../context/canvasPersistence.ts';
import {
  acceptCanvasMigration,
  restoreCanvasMigrationBackup,
} from '../../context/canvasPresentationMigration.ts';

const readInitialSummary = (): CanvasMigrationSummary | null => (
  typeof window === 'undefined' ? null : readCanvasMigrationSummary(CANVAS_STORAGE_KEY)
);

export const CanvasMigrationNotice: React.FC = () => {
  const [summary, setSummary] = useState<CanvasMigrationSummary | null>(readInitialSummary);
  if (!summary) return null;

  const repairedCount = new Set(summary.repairedNodeIds || []).size;
  const flaggedCount = new Set(summary.flaggedNodeIds || []).size;
  const canvasCount = new Set(summary.migratedCanvasIds || []).size;

  return (
    <div
      role="status"
      className="canvas-migration-notice absolute left-1/2 top-3 flex max-w-[min(560px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-lg px-3 py-2 text-[var(--text-primary)]"
    >
      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">画布数据已安全修复</div>
        <div className="truncate text-[11px] text-[var(--text-secondary)]">
          {canvasCount} 个画布，{repairedCount} 个节点已修复{flaggedCount > 0 ? `，${flaggedCount} 个节点待检查` : ''}
        </div>
      </div>
      <button
        type="button"
        className="flex h-11 shrink-0 items-center gap-1 px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        onClick={() => {
          if (restoreCanvasMigrationBackup(CANVAS_STORAGE_KEY)) window.location.reload();
        }}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        撤销
      </button>
      <button
        type="button"
        aria-label="接受画布数据修复"
        title="接受画布数据修复"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        onClick={() => {
          acceptCanvasMigration(CANVAS_STORAGE_KEY);
          setSummary(null);
        }}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default CanvasMigrationNotice;
