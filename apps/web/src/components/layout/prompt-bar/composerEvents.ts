/**
 * Shared UI event used to open the existing workflow browser from Composer
 * without coupling generation state to the project-management component.
 */
export const KK_OPEN_WORKFLOW_BROWSER_EVENT = 'kk-open-workflow-browser';

type WorkflowBrowserSubscriber = () => void;

const workflowBrowserSubscribers = new Set<WorkflowBrowserSubscriber>();
let workflowBrowserRequestPending = false;

/**
 * Opens the workflow browser even when the lazily loaded project controls have
 * not mounted yet. The pending request is consumed by the first subscriber.
 */
export function requestWorkflowBrowser(): void {
  if (workflowBrowserSubscribers.size === 0) {
    workflowBrowserRequestPending = true;
  }

  workflowBrowserSubscribers.forEach((subscriber) => subscriber());
  window.dispatchEvent(new CustomEvent(KK_OPEN_WORKFLOW_BROWSER_EVENT));
}

/** Registers the existing workflow browser as the single Composer destination. */
export function subscribeWorkflowBrowser(subscriber: WorkflowBrowserSubscriber): () => void {
  workflowBrowserSubscribers.add(subscriber);

  if (workflowBrowserRequestPending) {
    workflowBrowserRequestPending = false;
    queueMicrotask(subscriber);
  }

  return () => workflowBrowserSubscribers.delete(subscriber);
}
