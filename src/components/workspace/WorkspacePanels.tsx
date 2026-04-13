import React, { type ReactNode } from 'react';
import type { AppSurface, WorkspacePanel } from '../../types';

interface WorkspacePanelsProps {
  activeSurface: AppSurface;
  activePanel: WorkspacePanel;
  renderChatSidebar?: () => ReactNode;
  renderLibraryPanel?: () => ReactNode;
  auxiliaryPanels?: ReactNode;
}

const WorkspacePanels: React.FC<WorkspacePanelsProps> = ({
  activeSurface,
  activePanel,
  renderChatSidebar,
  renderLibraryPanel,
  auxiliaryPanels,
}) => (
  <>
    {activePanel === 'chat' ? renderChatSidebar?.() : null}
    {activeSurface === 'library' ? renderLibraryPanel?.() : null}
    {auxiliaryPanels}
  </>
);

export default WorkspacePanels;
