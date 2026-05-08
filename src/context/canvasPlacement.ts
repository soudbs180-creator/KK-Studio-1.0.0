import type { Canvas } from '../types.ts';
import { isWorkflowUtilityNodeKind } from '../workflow/schema.ts';

export type CanvasPosition = { x: number; y: number };

export function resolveNextCardPosition(canvas?: Canvas | null): CanvasPosition {
    const CARD_WIDTH = 280;
    const CARD_HEIGHT = 320;
    const GAP_X = 20;
    const GAP_Y = 20;
    const MAX_WIDTH = 1600;
    const SLOT_WIDTH = CARD_WIDTH + GAP_X;
    const SLOT_HEIGHT = CARD_HEIGHT + GAP_Y;
    const columnsPerRow = Math.floor(MAX_WIDTH / SLOT_WIDTH);

    if (!canvas) return { x: 0, y: 0 };

    const totalCards = canvas.promptNodes.length + canvas.imageNodes.length;
    const col = totalCards % columnsPerRow;
    const row = Math.floor(totalCards / columnsPerRow);

    return { x: col * SLOT_WIDTH, y: row * SLOT_HEIGHT };
}

const hasRectOverlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
    buffer: number
): boolean => (
    a.x < b.x + b.width + buffer
    && a.x + a.width + buffer > b.x
    && a.y < b.y + b.height + buffer
    && a.y + a.height + buffer > b.y
);

function getCandidateRect(cx: number, cy: number, width: number, height: number) {
    return {
        x: cx - width / 2,
        y: cy - height,
        width,
        height,
    };
}

function getImageCardSize(dimensions?: string): { width: number; height: number } {
    let width = 280;
    let height = 320;

    if (dimensions) {
        const [rawWidth, rawHeight] = dimensions.split('x').map(Number);
        if (rawWidth && rawHeight) {
            const ratio = rawWidth / rawHeight;
            width = ratio > 1 ? 320 : (ratio < 1 ? 200 : 280);
            height = (width / ratio) + 40;
        }
    }

    return { width, height };
}

export function resolveSmartCanvasPosition(
    canvas: Canvas | null | undefined,
    targetX: number,
    targetY: number,
    width: number,
    height: number,
    buffer = 20
): CanvasPosition {
    if (!canvas) return { x: targetX, y: targetY };

    const checkCollision = (cx: number, cy: number): boolean => {
        const candidateRect = getCandidateRect(cx, cy, width, height);

        for (const group of canvas.groups) {
            if (hasRectOverlap(candidateRect, {
                x: group.bounds.x,
                y: group.bounds.y,
                width: group.bounds.width,
                height: group.bounds.height,
            }, buffer)) {
                return true;
            }
        }

        for (const prompt of canvas.promptNodes) {
            if (hasRectOverlap(candidateRect, {
                x: prompt.position.x - 160,
                y: prompt.position.y - 200,
                width: 320,
                height: 200,
            }, buffer)) {
                return true;
            }
        }

        for (const image of canvas.imageNodes) {
            const imageSize = getImageCardSize(image.dimensions);
            if (hasRectOverlap(candidateRect, {
                x: image.position.x - imageSize.width / 2,
                y: image.position.y - imageSize.height,
                width: imageSize.width,
                height: imageSize.height,
            }, buffer)) {
                return true;
            }
        }

        for (const workflowNode of canvas.workflow?.nodes || []) {
            if (!isWorkflowUtilityNodeKind(workflowNode.kind)) continue;

            const nodeWidth = workflowNode.width || 280;
            const nodeHeight = workflowNode.height || 180;
            if (hasRectOverlap(candidateRect, {
                x: workflowNode.position.x - nodeWidth / 2,
                y: workflowNode.position.y - nodeHeight,
                width: nodeWidth,
                height: nodeHeight,
            }, buffer)) {
                return true;
            }
        }

        return false;
    };

    if (!checkCollision(targetX, targetY)) return { x: targetX, y: targetY };

    const shifts = [
        { dx: 0, dy: height + buffer },
        { dx: width + buffer, dy: 0 },
        { dx: -(width + buffer), dy: 0 },
        { dx: 0, dy: -(height + buffer) },
        { dx: width + buffer, dy: height + buffer },
        { dx: -(width + buffer), dy: height + buffer },
        { dx: (width + buffer) * 2, dy: 0 },
        { dx: 0, dy: (height + buffer) * 2 },
    ];

    for (const shift of shifts) {
        const x = targetX + shift.dx;
        const y = targetY + shift.dy;
        if (!checkCollision(x, y)) return { x, y };
    }

    return { x: targetX, y: targetY + height + buffer + 100 };
}

export function resolveNextGroupPosition(canvas?: Canvas | null): CanvasPosition {
    const SUB_CARD_WIDTH = 280;
    const SUB_CARD_GAP = 16;
    const GROUP_BASE_WIDTH = 380;
    const GROUP_HEIGHT = 600;
    const GAP_X = 40;
    const GAP_Y = 80;
    const GROUPS_PER_ROW = 30;

    if (!canvas) return { x: 0, y: 200 };

    const groupCount = canvas.promptNodes.length;
    if (groupCount === 0) {
        return { x: 0, y: 200 };
    }

    const getGroupWidth = (promptId: string): number => {
        const childCount = canvas.imageNodes.filter(
            image => image.parentPromptId === promptId
        ).length;

        const cols = Math.min(Math.max(childCount, 1), 2);
        const width = cols * SUB_CARD_WIDTH + (cols - 1) * SUB_CARD_GAP + 40;
        return Math.max(GROUP_BASE_WIDTH, width);
    };

    const row = Math.floor(groupCount / GROUPS_PER_ROW);
    const startRowIndex = row * GROUPS_PER_ROW;
    let xOffset = 0;

    for (let index = startRowIndex; index < groupCount; index += 1) {
        const prompt = canvas.promptNodes[index];
        if (prompt) {
            xOffset += getGroupWidth(prompt.id) + GAP_X;
        }
    }

    const x = xOffset + GROUP_BASE_WIDTH / 2;
    const y = 200 + row * (GROUP_HEIGHT + GAP_Y);

    return { x, y };
}
