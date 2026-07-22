import {
  AgentContextSnapshotInputDtoSchema,
  type AgentContextSnapshotInputDto,
} from '@kk/shared';
import type { SanitizedProjectContext } from '../types.ts';

const MAX_SNAPSHOT_LIST_ITEMS = 200;

export interface AgentContextSnapshotCaptureOptions {
  snapshotId: string;
  capturedAt: string;
  availableTools: string[];
}

type SnapshotEventType = AgentContextSnapshotInputDto['recentEvents'][number]['type'];

function mapSnapshotEventType(eventType: string): SnapshotEventType | undefined {
  const normalizedType = eventType.trim().toLowerCase();
  if (normalizedType.includes('selection')) return 'selection_changed';
  if (/viewport|zoom|pan/.test(normalizedType)) return 'viewport_changed';
  if (/deleted|removed/.test(normalizedType)) return 'node_deleted';
  if (/created|added/.test(normalizedType)) return 'node_created';
  if (/updated|changed|moved|resized/.test(normalizedType)) return 'node_updated';
  return undefined;
}

function normalizeIds(values: string[], limit = MAX_SNAPSHOT_LIST_ITEMS): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .filter((value) => value.length <= 200)
    .slice(0, limit);
}

function toIsoTimestamp(timestamp: number): string | undefined {
  if (!Number.isFinite(timestamp)) return undefined;
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return undefined;
  }
}

function projectRecentEvents(
  context: SanitizedProjectContext,
): AgentContextSnapshotInputDto['recentEvents'] {
  return (context.runtime?.recentEvents || []).flatMap((event) => {
    const type = mapSnapshotEventType(event.type);
    const occurredAt = toIsoTimestamp(event.timestamp);
    const id = String(event.id || '').trim();
    return type && id && id.length <= 200 && occurredAt
      ? [{ id, type, occurredAt }]
      : [];
  }).slice(-100);
}

/** Builds a strict metadata-only capture; raw prompts, names, summaries, and bytes never enter it. */
export function buildAgentContextSnapshotInput(
  context: SanitizedProjectContext,
  options: AgentContextSnapshotCaptureOptions,
): AgentContextSnapshotInputDto | undefined {
  const runtime = context.runtime;
  const viewportRect = runtime?.viewport.rect;
  if (!runtime || !viewportRect || viewportRect.width <= 0 || viewportRect.height <= 0) return undefined;
  const promptBarInput = runtime.promptBarInput || context.promptBarInput;
  const canvasId = String(runtime.canvas.id || context.canvas.id || '').trim();
  const candidate = {
    snapshotId: options.snapshotId,
    activeSurface: runtime.currentPage,
    ...(canvasId ? { canvasId } : {}),
    canvasSummary: {
      nodeCount: runtime.canvas.promptCount + runtime.canvas.imageCount + runtime.canvas.groupCount
        + runtime.canvas.noteCount + runtime.canvas.workflowPanelCount,
      selectedNodeCount: runtime.selection.count,
      generatedAssetCount: runtime.canvas.imageCount,
    },
    selectedNodeIds: normalizeIds(runtime.selection.selectedNodeIds),
    viewport: {
      x: runtime.viewport.x,
      y: runtime.viewport.y,
      width: viewportRect.width,
      height: viewportRect.height,
      zoom: runtime.viewport.scale,
    },
    recentEvents: projectRecentEvents(context),
    ...(promptBarInput ? {
      inputBox: {
        hasText: promptBarInput.prompt.trim().length > 0,
        attachmentCount: Math.min(20, Math.max(0, promptBarInput.referenceImagesCount)),
      },
    } : {}),
    availableTools: normalizeIds(options.availableTools),
    capturedAt: options.capturedAt,
  };
  const parsed = AgentContextSnapshotInputDtoSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}
