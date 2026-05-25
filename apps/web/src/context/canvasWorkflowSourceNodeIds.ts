import type { WorkflowNode } from '../types';
import { isWorkflowUtilityNodeKind } from '../workflow/schema.ts';

export function getWorkflowSourceNodeIds(node: WorkflowNode): string[] {
    if (!isWorkflowUtilityNodeKind(node.kind)) {
        return [];
    }

    const rawSourceIds = (node.data as { sourceNodeIds?: unknown } | undefined)?.sourceNodeIds;
    if (!Array.isArray(rawSourceIds)) {
        return [];
    }

    return Array.from(new Set(
        rawSourceIds.filter((sourceId): sourceId is string => (
            typeof sourceId === 'string' && sourceId.trim().length > 0
        ))
    ));
}
