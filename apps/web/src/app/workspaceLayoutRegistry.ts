export interface WorkspaceLayoutRequest {
  isMobile: boolean;
  isChatOpen: boolean;
  chatSidebarWidth: number;
  navigationPanelWidth?: number;
}

export interface WorkspaceLayoutInsets {
  left: number;
  right: number;
}

const DESKTOP_CANVAS_RAIL_INSET = 72;
const DESKTOP_EDGE_GAP = 12;
const DESKTOP_PANEL_GAP = 12;
const DESKTOP_CHAT_NAVIGATION_GAP = 24;

export interface WorkspaceLayoutOccupancy {
  navigationPanelWidth: number;
}

type WorkspaceLayoutListener = () => void;

let workspaceLayoutOccupancy: WorkspaceLayoutOccupancy = {
  navigationPanelWidth: 0,
};
const workspaceLayoutListeners = new Set<WorkspaceLayoutListener>();

/** Returns the latest widths published by floating workspace surfaces. */
export function getWorkspaceLayoutOccupancy(): WorkspaceLayoutOccupancy {
  return workspaceLayoutOccupancy;
}

/** Publishes navigation width without coupling composer layout to DOM selectors. */
export function setWorkspaceNavigationPanelWidth(width: number): void {
  const navigationPanelWidth = Math.max(0, Math.round(width));
  if (navigationPanelWidth === workspaceLayoutOccupancy.navigationPanelWidth) {
    return;
  }

  workspaceLayoutOccupancy = { navigationPanelWidth };
  workspaceLayoutListeners.forEach((listener) => listener());
}

/** Subscribes a floating consumer to workspace occupancy changes. */
export function subscribeWorkspaceLayoutOccupancy(listener: WorkspaceLayoutListener): () => void {
  workspaceLayoutListeners.add(listener);
  return () => workspaceLayoutListeners.delete(listener);
}

/**
 * Centralizes occupied workspace edges so floating consumers align to the
 * same usable canvas rectangle instead of inspecting unrelated DOM nodes.
 */
export function resolveWorkspaceLayoutInsets(request: WorkspaceLayoutRequest): WorkspaceLayoutInsets {
  if (request.isMobile) {
    return { left: DESKTOP_EDGE_GAP, right: DESKTOP_EDGE_GAP };
  }

  const chatRightInset = request.isChatOpen
    ? request.chatSidebarWidth + DESKTOP_PANEL_GAP
    : DESKTOP_EDGE_GAP;
  const navigationRightOffset = request.isChatOpen
    ? request.chatSidebarWidth + DESKTOP_CHAT_NAVIGATION_GAP
    : DESKTOP_EDGE_GAP;
  const navigationRightInset = request.navigationPanelWidth
    ? request.navigationPanelWidth + navigationRightOffset + DESKTOP_PANEL_GAP
    : DESKTOP_EDGE_GAP;

  return {
    left: DESKTOP_CANVAS_RAIL_INSET,
    right: Math.max(DESKTOP_EDGE_GAP, chatRightInset, navigationRightInset),
  };
}
