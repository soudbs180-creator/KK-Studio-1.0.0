export type CanvasInteractionPhase =
  | 'idle'
  | 'pan'
  | 'zoom'
  | 'node-drag'
  | 'regroup-settle'

export type PromptGroupLayoutMode = 'expanded' | 'regrouping' | 'docked'

export type CanvasPoint = { x: number; y: number }

export interface PromptGroupLiveSceneChild {
  id: string
  logicalPosition: CanvasPoint
  dockedPosition: CanvasPoint
  renderPosition?: CanvasPoint
}

export interface PromptGroupLiveSceneSnapshot {
  promptId: string
  layoutMode: PromptGroupLayoutMode
  regroupProgress: number
  promptLogicalPosition: CanvasPoint
  promptRenderPosition: CanvasPoint
  childLogicalPositionsById: Record<string, CanvasPoint>
  childRenderPositionsById: Record<string, CanvasPoint>
}

export interface LiveSceneSnapshot {
  interactionPhase: CanvasInteractionPhase
  liveNodePositionById: Record<string, CanvasPoint>
  nodeRenderPositionById: Record<string, CanvasPoint>
  promptGroups: Record<string, PromptGroupLiveSceneSnapshot>
}

export interface BuildPromptGroupLiveSceneSnapshotOptions {
  promptId: string
  promptPosition: CanvasPoint
  childNodes: PromptGroupLiveSceneChild[]
  layoutMode: PromptGroupLayoutMode
  regroupProgress: number
  interactionPhase: CanvasInteractionPhase
  liveNodePositionById?: Record<string, CanvasPoint>
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const interpolatePoint = (from: CanvasPoint, to: CanvasPoint, progress: number): CanvasPoint => ({
  x: from.x + ((to.x - from.x) * progress),
  y: from.y + ((to.y - from.y) * progress),
})

const easeOutCubic = (value: number) => 1 - ((1 - value) ** 3)

const easeOutQuad = (value: number) => 1 - ((1 - value) ** 2)

export const getRegroupTransitionProgress = (rawProgress: number) => {
  const progress = clamp01(rawProgress)
  if (progress <= 0) return 0
  if (progress >= 1) return 1

  if (progress < 0.4) {
    return easeOutCubic(progress / 0.4) * 0.68
  }

  return 0.68 + (easeOutQuad((progress - 0.4) / 0.6) * 0.32)
}

export const buildPromptGroupLiveSceneSnapshot = ({
  promptId,
  promptPosition,
  childNodes,
  layoutMode,
  regroupProgress,
  interactionPhase,
  liveNodePositionById = {},
}: BuildPromptGroupLiveSceneSnapshotOptions): LiveSceneSnapshot => {
  const promptLogicalPosition = liveNodePositionById[promptId] ?? promptPosition
  const easedProgress = layoutMode === 'regrouping'
    ? getRegroupTransitionProgress(regroupProgress)
    : layoutMode === 'docked'
      ? 1
      : 0

  const childLogicalPositionsById: Record<string, CanvasPoint> = {}
  const childRenderPositionsById: Record<string, CanvasPoint> = {}
  const nodeRenderPositionById: Record<string, CanvasPoint> = {
    [promptId]: promptLogicalPosition,
  }

  childNodes.forEach((childNode) => {
    const logicalPosition = liveNodePositionById[childNode.id] ?? childNode.logicalPosition
    const renderPosition = childNode.renderPosition ?? (
      layoutMode === 'expanded'
        ? logicalPosition
        : layoutMode === 'docked'
          ? childNode.dockedPosition
          : interpolatePoint(logicalPosition, childNode.dockedPosition, easedProgress)
    )

    childLogicalPositionsById[childNode.id] = logicalPosition
    childRenderPositionsById[childNode.id] = renderPosition
    nodeRenderPositionById[childNode.id] = renderPosition
  })

  return {
    interactionPhase,
    liveNodePositionById: {
      ...liveNodePositionById,
      [promptId]: promptLogicalPosition,
    },
    nodeRenderPositionById,
    promptGroups: {
      [promptId]: {
        promptId,
        layoutMode,
        regroupProgress: easedProgress,
        promptLogicalPosition,
        promptRenderPosition: promptLogicalPosition,
        childLogicalPositionsById,
        childRenderPositionsById,
      },
    },
  }
}

export const resolveLiveSceneNodePosition = (
  snapshot: LiveSceneSnapshot | null | undefined,
  nodeId: string,
  fallback: CanvasPoint,
) => {
  if (!snapshot) return fallback
  return snapshot.nodeRenderPositionById[nodeId]
    ?? snapshot.liveNodePositionById[nodeId]
    ?? fallback
}
