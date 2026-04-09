import React from 'react';
import ChatSidebar from '../layout/ChatSidebar';
import type { AppSurface, Canvas, WorkspacePanel } from '../../types';
import type { SettingsSurfaceView } from '../../hooks/useWorkspaceSurface';
import { AssetLibraryPanel } from './AssetLibraryPanel';
import WorkspacePanels from './WorkspacePanels';

interface WorkspaceSurfacePanelsProps {
  activeSurface: AppSurface;
  activePanel: WorkspacePanel;
  isChatOpen: boolean;
  toggleChatPanel: () => void;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  openSettingsSurface: (view?: SettingsSurfaceView) => void;
  setIsSidebarHovered: (isHovered: boolean) => void;
  setChatSidebarWidth: (width: number) => void;
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
      renderChatSidebar={() => (
        <div id="chat-sidebar-wrapper">
          <ChatSidebar
            isOpen={isChatOpen}
            onToggle={toggleChatPanel}
            onClose={() => setIsChatOpen(false)}
            isMobile={isMobile}
            onOpenSettings={(view) => {
              openSettingsSurface(view || 'api-management');
            }}
            onHoverChange={(isHovered) => setIsSidebarHovered(isHovered)}
            onWidthChange={setChatSidebarWidth}
          />
        </div>
      )}
      renderLibraryPanel={() => (
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
