const PROJECT_PANEL_VIEWPORT_GAP = 12;

/** Keeps the project panel aligned to its trigger without letting it escape the viewport. */
export function computeProjectPanelLeft(
  triggerLeft: number,
  panelWidth: number,
  viewportWidth: number,
) {
  const maximumLeft = Math.max(PROJECT_PANEL_VIEWPORT_GAP, viewportWidth - panelWidth - PROJECT_PANEL_VIEWPORT_GAP);
  return Math.min(Math.max(triggerLeft, PROJECT_PANEL_VIEWPORT_GAP), maximumLeft);
}
