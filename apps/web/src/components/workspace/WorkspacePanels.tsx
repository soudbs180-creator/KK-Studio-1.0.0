import React, { type ReactNode } from 'react';
import type { AppSurface, WorkspacePanel } from '../../types';

interface WorkspacePanelsProps {
  activeSurface: AppSurface;
  activePanel: WorkspacePanel;
  renderChatSidebar?: () => ReactNode;
  renderLibraryPanel?: () => ReactNode;
  renderFavoritesPanel?: () => ReactNode;
  auxiliaryPanels?: ReactNode;
  isMobile?: boolean;
}

const WorkspacePanels: React.FC<WorkspacePanelsProps> = ({
  activeSurface,
  activePanel,
  renderChatSidebar,
  renderLibraryPanel,
  renderFavoritesPanel,
  auxiliaryPanels,
}) => (
  <>
    {activePanel === 'chat' ? renderChatSidebar?.() : null}
    {activeSurface === 'library' ? renderLibraryPanel?.() : null}
    {activeSurface === 'favorites' ? renderFavoritesPanel?.() : null}
    {auxiliaryPanels}
  </>
);

export default WorkspacePanels;
