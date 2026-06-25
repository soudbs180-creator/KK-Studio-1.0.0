import React, { Suspense } from 'react';
import type { AppSurface, Canvas, WorkspacePanel } from '../../types';
import type { SettingsSurfaceView } from '../../hooks/useWorkspaceSurface';
import { AssetLibraryPanel } from './AssetLibraryPanel';
import { FavoritesPanel } from '../../features/favorites';
import WorkspacePanels from './WorkspacePanels';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const ChatSidebar = lazyWithRetry(() => import('../layout/ChatSidebar'));

interface WorkspaceSurfacePanelsProps {
  activeSurface: AppSurface;
  activePanel: WorkspacePanel;
  isChatOpen: boolean;
  toggleChatPanel: () => void;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  openSettingsSurface: (view?: SettingsSurfaceView) => void;
  openLibrarySurface: () => void;
  openFavoritesSurface: () => void;
  openProfileSurface: (view?: any) => void;
  setIsSidebarHovered: (isHovered: boolean) => void;
  setChatSidebarWidth: (width: number) => void;
  workspaceSurface: Extract<AppSurface, 'workspace' | 'library' | 'favorites'>;
  activeCanvas: Canvas | null | undefined;
  focusWorkspace: () => void;
  handlePreviewFromLibrary: (imageId: string) => void;
  handleFocusLibraryImage: (imageId: string) => void;
  onRenameFavoriteImage?: (imageId: string, name: string) => void;
  config?: any;
  setConfig?: any;
  ecommerceState?: any;
  onGenerate?: any;
  canvasTransform?: { x: number; y: number; scale: number } | null;
  canvasRef?: any;
}

export function WorkspaceSurfacePanels({
  activeSurface,
  activePanel,
  isChatOpen,
  toggleChatPanel,
  setIsChatOpen,
  isMobile,
  openSettingsSurface,
  openLibrarySurface,
  openFavoritesSurface,
  openProfileSurface,
  setIsSidebarHovered,
  setChatSidebarWidth,
  workspaceSurface,
  activeCanvas,
  focusWorkspace,
  handlePreviewFromLibrary,
  handleFocusLibraryImage,
  onRenameFavoriteImage,
  config,
  setConfig,
  ecommerceState,
  onGenerate,
  canvasTransform,
  canvasRef,
}: WorkspaceSurfacePanelsProps) {
  return (
    <WorkspacePanels
      activeSurface={activeSurface}
      activePanel={activePanel}
      isMobile={isMobile}
      renderChatSidebar={() => (
        <div id="chat-sidebar-wrapper" style={{ pointerEvents: 'auto' }}>
          <Suspense fallback={null}>
            <ChatSidebar
              isOpen={isChatOpen}
              onToggle={toggleChatPanel}
              onClose={() => setIsChatOpen(false)}
              isMobile={isMobile}
              onOpenSettings={(view) => {
                openSettingsSurface(view || 'api-management');
              }}
              openLibrarySurface={openLibrarySurface}
              openFavoritesSurface={openFavoritesSurface}
              openProfileSurface={openProfileSurface}
              focusWorkspace={focusWorkspace}
              onHoverChange={(isHovered) => setIsSidebarHovered(isHovered)}
              onWidthChange={setChatSidebarWidth}
              config={config}
              setConfig={setConfig}
              ecommerceState={ecommerceState}
              onGenerate={onGenerate}
              canvasTransform={canvasTransform}
              canvasRef={canvasRef}
              workspaceSurface={workspaceSurface}
            />
          </Suspense>
        </div>
      )}

      renderLibraryPanel={() => (
        isMobile ? null : (
          <div id="asset-library-wrapper" style={{ pointerEvents: 'auto' }}>
            <AssetLibraryPanel
              isOpen={workspaceSurface === 'library'}
              isMobile={isMobile}
              images={activeCanvas?.imageNodes || []}
              promptCount={activeCanvas?.promptNodes.length || 0}
              onClose={focusWorkspace}
              onPreview={handlePreviewFromLibrary}
              onFocusImage={handleFocusLibraryImage}
            />
          </div>
        )
      )}

      renderFavoritesPanel={() => (
        <div id="favorites-panel-wrapper" style={{ pointerEvents: 'auto' }}>
          <FavoritesPanel
            isOpen={workspaceSurface === 'favorites'}
            isMobile={isMobile}
            onClose={focusWorkspace}
            onRenameImageAlias={onRenameFavoriteImage}
          />
        </div>
      )}
    />
  );
}
