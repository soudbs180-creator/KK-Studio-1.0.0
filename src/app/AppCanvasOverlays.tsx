import React from 'react';

import { ArrangeMode } from '../context/CanvasContext';
import { SelectionMenu } from '../components/canvas/SelectionMenu';
import type { SelectionBoxState } from './appCanvasTypes';

export type SelectionMenuOverlay = {
  position: { x: number; y: number };
  selectedCount: number;
  groupCount: number;
  imageCount: number;
  videoCount: number;
  onDelete: () => void;
  onGroup: () => void;
  onTag: () => void;
  onMigrate?: () => void;
  onArrange?: (mode: ArrangeMode) => void;
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
        className="fixed z-[9999] pointer-events-none rounded-lg border border-indigo-500 bg-indigo-500/10"
        style={{
          left: Math.min(selectionBox.start.x, selectionBox.current.x),
          top: Math.min(selectionBox.start.y, selectionBox.current.y),
          width: Math.abs(selectionBox.current.x - selectionBox.start.x),
          height: Math.abs(selectionBox.current.y - selectionBox.start.y),
        }}
      />
    )}

    {selectionMenu && (
      <SelectionMenu
        position={selectionMenu.position}
        selectedCount={selectionMenu.selectedCount}
        groupCount={selectionMenu.groupCount}
        imageCount={selectionMenu.imageCount}
        videoCount={selectionMenu.videoCount}
        onDelete={selectionMenu.onDelete}
        onGroup={selectionMenu.onGroup}
        onTag={selectionMenu.onTag}
        onMigrate={selectionMenu.onMigrate}
        onArrange={selectionMenu.onArrange}
      />
    )}
  </>
);

export default AppCanvasOverlays;
