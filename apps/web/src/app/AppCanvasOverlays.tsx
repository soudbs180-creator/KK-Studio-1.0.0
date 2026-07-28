import React from 'react';

import { type ArrangeMode} from '../context/CanvasContext';
import { SelectionMenu } from '../components/canvas/SelectionMenu';
import type { SelectionBoxState } from './appCanvasTypes';

export type SelectionMenuOverlay = {
  position: { x: number; y: number };
  placement: 'right' | 'left' | 'bottom';
  selectedCount: number;
  cardGroupCount: number;
  isolatedPromptCount: number;
  isolatedResultCount: number;
  onDelete: () => void;
  onGroup: () => void;
  onTag: () => void;
  onMigrate?: () => void;
  onArrange?: (mode: ArrangeMode) => void;
  canArrange?: boolean; // 简体中文注释：标识当前选择卡片是否符合排列整理的条件
  onFavorite?: () => void;
  isAllFavorite?: boolean;
};

interface AppCanvasOverlaysProps {
  selectionBox: SelectionBoxState;
  selectionMenu: SelectionMenuOverlay | null;
}

const AppCanvasOverlays: React.FC<AppCanvasOverlaysProps> = ({
  selectionBox,
  selectionMenu,
}) => (
  <>
    {selectionBox && selectionBox.active && (
      <div
        id="canvas-selection-box"
        className="fixed z-[9999] pointer-events-none rounded-lg border border-indigo-500 bg-indigo-500/10"
        style={{
          left: Math.min(selectionBox.start.x, selectionBox.current.x),
          top: Math.min(selectionBox.start.y, selectionBox.current.y),
          width: Math.abs(selectionBox.current.x - selectionBox.start.x),
          height: Math.abs(selectionBox.current.y - selectionBox.start.y),
          willChange: 'left, top, width, height',
        }}
      />
    )}

    {selectionMenu && (
      <SelectionMenu
        position={selectionMenu.position}
        placement={selectionMenu.placement}
        selectedCount={selectionMenu.selectedCount}
        cardGroupCount={selectionMenu.cardGroupCount}
        isolatedPromptCount={selectionMenu.isolatedPromptCount}
        isolatedResultCount={selectionMenu.isolatedResultCount}
        onDelete={selectionMenu.onDelete}
        onGroup={selectionMenu.onGroup}
        onTag={selectionMenu.onTag}
        onMigrate={selectionMenu.onMigrate}
        onArrange={selectionMenu.onArrange}
        canArrange={selectionMenu.canArrange}
        onFavorite={selectionMenu.onFavorite}
        isAllFavorite={selectionMenu.isAllFavorite}
      />
    )}
  </>
);

export default AppCanvasOverlays;
