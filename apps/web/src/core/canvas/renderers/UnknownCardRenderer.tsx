import React from 'react';
import CanvasCardShell from '../../../components/canvas/CanvasCardShell.tsx';
import { createCanvasCardPresentation } from '../../../context/canvasPresentationMigration.ts';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry.ts';

const UnknownCardRenderer: React.FC<CanvasCardRenderContext> = ({
  item,
  detailLevel,
  isSelected,
}) => {
  const node = item?.node || item || {};
  const presentation = node.presentation?.kind === 'unknown'
    ? node.presentation
    : createCanvasCardPresentation('unknown', 'column', 'standard', 'Unsupported or damaged card data');
  return (
    <CanvasCardShell
      id={String(node.id || 'unknown')}
      position={node.position || { x: 0, y: 0 }}
      presentation={presentation}
      height={168}
      zIndex={node.zIndex}
      selected={isSelected}
      detailLevel={detailLevel}
    >
      <div className="flex h-full min-h-[168px] flex-col justify-between gap-3 p-4">
        <div>
          <div className="text-xs font-semibold text-amber-300">Card data needs attention</div>
          <div className="mt-2 text-sm leading-5 text-zinc-300">
            {presentation.diagnostic || 'This card type is not supported by the current renderer.'}
          </div>
        </div>
        <code className="truncate text-[11px] text-zinc-500">{String(node.id || 'missing-id')}</code>
      </div>
    </CanvasCardShell>
  );
};

export default UnknownCardRenderer;
