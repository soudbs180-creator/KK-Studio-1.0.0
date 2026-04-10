import React from 'react';

import ChatSidebar from '../layout/ChatSidebar';
import type { Canvas, AppSurface, WorkspacePanel } from '../../types';
import { AssetLibraryPanel } from './AssetLibraryPanel';
import WorkspacePanels from './WorkspacePanels';

interface WorkspaceSurfacePanelsProps {
  activeSurface: AppSurface;
  activePanel: WorkspacePanel;
  isChatOpen: boolean;
  toggleChatPanel: () => void;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  openSettingsSurface: (view?: 'api-management') => void;
  setIsSidebarHovered: React.Dispatch<React.SetStateAction<boolean>>;
  setChatSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  workspaceSurface: Extract<AppSurface, 'workspace' | 'library'>;
  activeCanvas: Canvas | null | undefined;
  focusWorkspace: () => void;
  handlePreviewFromLibrary: (imageId: string) => void;
  handleFocusLibraryImage: (imageId: string) => void;
}

export function WorkspaceSurfacePanels({
  activeSurface,
  activePanel,
  isChatOpen,
  toggleChatPanel,
  setIsChatOpen,
  isMobile,
  openSettingsSurface,
  setIsSidebarHovered,
  setChatSidebarWidth,
  workspaceSurface,
  activeCanvas,
  focusWorkspace,
  handlePreviewFromLibrary,
  handleFocusLibraryImage,
}: WorkspaceSurfacePanelsProps) {
  return (
    <WorkspacePanels
      activeSurface={activeSurface}
      activePanel={activePanel}
      chatSidebar={(
        <ChatSidebar
          isOpen={isChatOpen}
          onToggle={toggleChatPanel}
          onClose={() => setIsChatOpen(false)}
          isMobile={isMobile}
          onOpenSettings={openSettingsSurface}
          onHoverChange={setIsSidebarHovered}
          onWidthChange={setChatSidebarWidth}
        />
      )}
      libraryPanel={(
        <AssetLibraryPanel
          isOpen={workspaceSurface === 'library'}
          isMobile={isMobile}
          images={activeCanvas?.imageNodes || []}
          promptCount={activeCanvas?.promptNodes.length || 0}
          onClose={focusWorkspace}
          onPreview={handlePreviewFromLibrary}
          onFocusImage={handleFocusLibraryImage}
        />
      )}
    />
  );
}

export default WorkspaceSurfacePanels;
