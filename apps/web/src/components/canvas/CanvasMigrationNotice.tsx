import React, { useEffect } from 'react';
import type { CanvasMigrationSummary } from '@kk/shared';
import {
  CANVAS_STORAGE_KEY,
  readCanvasMigrationSummary,
} from '../../context/canvasPersistence.ts';
import { acceptCanvasMigration } from '../../context/canvasPresentationMigration.ts';
import { notify } from '../../services/system/notificationService.ts';

const readInitialSummary = (): CanvasMigrationSummary | null => (
  typeof window === 'undefined' ? null : readCanvasMigrationSummary(CANVAS_STORAGE_KEY)
);

export const CanvasMigrationNotice: React.FC = () => {
  useEffect(() => {
    const summary = readInitialSummary();
    if (!summary) return;
    const repairedCount = new Set(summary.repairedNodeIds || []).size;
    const flaggedCount = new Set(summary.flaggedNodeIds || []).size;
    const canvasCount = new Set(summary.migratedCanvasIds || []).size;

    notify.info(
      '画布数据已安全修复',
      `${canvasCount} 个画布，${repairedCount} 个节点已修复${flaggedCount > 0 ? `，${flaggedCount} 个节点待检查` : ''}`
    );
    acceptCanvasMigration(CANVAS_STORAGE_KEY);
  }, []);

  return null;
};

export default CanvasMigrationNotice;
