export const TASK_CENTER_OPEN_EVENT = 'kk:task-center-open';
export const TASK_CENTER_TOGGLE_EVENT = 'kk:task-center-toggle';

/** Requests the shared task center without coupling callers to tray state. */
export function requestTaskCenterOpen(target: EventTarget = window): void {
  target.dispatchEvent(new Event(TASK_CENTER_OPEN_EVENT));
}

/** Toggles the shared task center from a persistent desktop trigger. */
export function requestTaskCenterToggle(target: EventTarget = window): void {
  target.dispatchEvent(new Event(TASK_CENTER_TOGGLE_EVENT));
}
