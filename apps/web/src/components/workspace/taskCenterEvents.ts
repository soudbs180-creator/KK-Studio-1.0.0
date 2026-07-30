export const TASK_CENTER_OPEN_EVENT = 'kk:task-center-open';

/** Requests the shared task center without coupling callers to tray state. */
export function requestTaskCenterOpen(target: EventTarget = window): void {
  target.dispatchEvent(new Event(TASK_CENTER_OPEN_EVENT));
}
