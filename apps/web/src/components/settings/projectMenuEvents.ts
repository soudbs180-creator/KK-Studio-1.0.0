export const PROJECT_MENU_TOGGLE_EVENT = 'kk:project-menu-toggle';

/** Opens or closes the one Project Manager surface shared by workspace chrome. */
export function requestProjectMenuToggle(target: EventTarget = window) {
  target.dispatchEvent(new CustomEvent(PROJECT_MENU_TOGGLE_EVENT));
}
