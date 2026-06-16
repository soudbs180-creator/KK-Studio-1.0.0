import { useCallback, useEffect, useRef, useState } from 'react';
import * as React from 'react';
import type { GeneratedImage, PromptNode } from '../types';
import type { WorkflowUtilityCanvasNode } from './appCanvasTypes';
import type { CanvasPoint, LiveSceneSnapshot } from '../canvas/liveScene';
import { resolveLiveSceneNodePosition } from '../canvas/liveScene';
import type { CanvasPerformanceProfile } from '../canvas/performanceProfile';
import { traceLocalPerformance } from '../services/system/localPerformanceTrace';
import { canvasLivePositionStore } from './canvasLivePositionStore';

export type ConnectorRenderSnapshot = {
  promptIds: string[];
  imageIds: string[];
  workflowUtilityIds: string[];
  positionByNodeId: Record<string, CanvasPoint>;
};

const EMPTY_CONNECTOR_RENDER_SNAPSHOT: ConnectorRenderSnapshot = {
  promptIds: [],
  imageIds: [],
  workflowUtilityIds: [],
  positionByNodeId: {},
};

export interface UseConnectorRendererDeps {
  liveSceneState: LiveSceneSnapshot;
  liveSceneRef: React.RefObject<LiveSceneSnapshot>;
  visiblePromptNodes: PromptNode[];
  visibleImageNodes: GeneratedImage[];
  visibleWorkflowUtilityNodes: WorkflowUtilityCanvasNode[];
  promptNodesById: Map<string, PromptNode>;
  imageNodesById: Map<string, GeneratedImage>;
  workflowUtilityNodesById: Map<string, WorkflowUtilityCanvasNode>;
  canvasPerformanceProfile: CanvasPerformanceProfile;
}

export interface UseConnectorRendererResult {
  connectorRenderSnapshot: ConnectorRenderSnapshot;
  connectorRenderPromptNodes: PromptNode[];
  connectorRenderVisibleImageNodes: GeneratedImage[];
  connectorRenderWorkflowUtilityNodesById: Map<string, WorkflowUtilityCanvasNode>;
  resolveLivePromptPosition: (promptNode: PromptNode | undefined | null) => CanvasPoint | null;
  resolveLiveImagePosition: (imageNode: GeneratedImage | undefined | null) => CanvasPoint | null;
  resolveConnectorRenderPosition: (
    nodeId: string | undefined | null,
    fallbackPosition: CanvasPoint | undefined | null
  ) => CanvasPoint | null;
}

export function useConnectorRenderer(deps: UseConnectorRendererDeps): UseConnectorRendererResult {
  const {
    liveSceneState,
    liveSceneRef,
    visiblePromptNodes,
    visibleImageNodes,
    visibleWorkflowUtilityNodes,
    promptNodesById,
    imageNodesById,
    workflowUtilityNodesById,
    canvasPerformanceProfile,
  } = deps;

  const buildConnectorRenderSnapshot = useCallback((): ConnectorRenderSnapshot => {
    return traceLocalPerformance('canvas-interaction.connector-render-snapshot', () => {
      const positionByNodeId: ConnectorRenderSnapshot['positionByNodeId'] = {};

      visiblePromptNodes.forEach((promptNode) => {
        positionByNodeId[promptNode.id] = resolveLiveSceneNodePosition(
          liveSceneState,
          promptNode.id,
          promptNodesById.get(promptNode.id)?.position ?? promptNode.position,
        );
      });

      visibleImageNodes.forEach((imageNode) => {
        positionByNodeId[imageNode.id] = resolveLiveSceneNodePosition(
          liveSceneState,
          imageNode.id,
          imageNodesById.get(imageNode.id)?.position ?? imageNode.position,
        );
      });

      visibleWorkflowUtilityNodes.forEach((workflowNode) => {
        positionByNodeId[workflowNode.id] = resolveLiveSceneNodePosition(
          liveSceneState,
          workflowNode.id,
          workflowUtilityNodesById.get(workflowNode.id)?.position ?? workflowNode.position,
        );
      });

      return {
        promptIds: visiblePromptNodes.map((promptNode) => promptNode.id),
        imageIds: visibleImageNodes.map((imageNode) => imageNode.id),
        workflowUtilityIds: visibleWorkflowUtilityNodes.map((workflowNode) => workflowNode.id),
        positionByNodeId,
      };
    }, {
      promptCount: visiblePromptNodes.length,
      imageCount: visibleImageNodes.length,
      workflowUtilityCount: visibleWorkflowUtilityNodes.length,
    });
  }, [
    imageNodesById,
    liveSceneState,
    promptNodesById,
    visibleImageNodes,
    visiblePromptNodes,
    visibleWorkflowUtilityNodes,
    workflowUtilityNodesById,
  ]);

  const connectorVisibilitySignature = React.useMemo(
    () => [
      visiblePromptNodes.map((promptNode) => promptNode.id).join(','),
      visibleImageNodes.map((imageNode) => imageNode.id).join(','),
      visibleWorkflowUtilityNodes.map((workflowNode) => workflowNode.id).join(','),
    ].join('|'),
    [visibleImageNodes, visiblePromptNodes, visibleWorkflowUtilityNodes]
  );

  const connectorRenderSnapshotRef = useRef<ConnectorRenderSnapshot>(EMPTY_CONNECTOR_RENDER_SNAPSHOT);
  const connectorRenderSnapshotBuilderRef = useRef(buildConnectorRenderSnapshot);
  const connectorRenderSnapshotTimerRef = useRef<number | null>(null);
  const connectorRenderSnapshotLastCapturedAtRef = useRef(0);
  const connectorVisibilitySignatureRef = useRef('');
  const [connectorRenderSnapshotVersion, setConnectorRenderSnapshotVersion] = useState(0);

  useEffect(() => {
    connectorRenderSnapshotBuilderRef.current = buildConnectorRenderSnapshot;
  }, [buildConnectorRenderSnapshot]);

  const shouldThrottleConnectorSnapshot = canvasPerformanceProfile.edgeMode !== 'full'
    || canvasPerformanceProfile.renderMode !== 'standard';
  const connectorSnapshotThrottleMs = shouldThrottleConnectorSnapshot
    ? canvasPerformanceProfile.edgeThrottleMs
    : 0;

  const commitConnectorRenderSnapshot = useCallback((capturedAt?: number) => {
    connectorRenderSnapshotRef.current = connectorRenderSnapshotBuilderRef.current();
    connectorRenderSnapshotLastCapturedAtRef.current = capturedAt ?? performance.now();
    setConnectorRenderSnapshotVersion((version) => version + 1);
  }, []);

  const scheduleConnectorRenderSnapshot = useCallback((forceImmediate = false) => {
    if (forceImmediate || connectorSnapshotThrottleMs <= 0) {
      if (connectorRenderSnapshotTimerRef.current !== null) {
        window.clearTimeout(connectorRenderSnapshotTimerRef.current);
        connectorRenderSnapshotTimerRef.current = null;
      }
      commitConnectorRenderSnapshot(forceImmediate ? performance.now() : undefined);
      return;
    }

    const now = performance.now();
    const elapsed = now - connectorRenderSnapshotLastCapturedAtRef.current;
    if (elapsed >= connectorSnapshotThrottleMs) {
      if (connectorRenderSnapshotTimerRef.current !== null) {
        window.clearTimeout(connectorRenderSnapshotTimerRef.current);
        connectorRenderSnapshotTimerRef.current = null;
      }
      commitConnectorRenderSnapshot(now);
      return;
    }

    if (connectorRenderSnapshotTimerRef.current !== null) {
      return;
    }

    const remaining = Math.max(0, connectorSnapshotThrottleMs - elapsed);
    connectorRenderSnapshotTimerRef.current = window.setTimeout(() => {
      connectorRenderSnapshotTimerRef.current = null;
      commitConnectorRenderSnapshot();
    }, remaining);
  }, [commitConnectorRenderSnapshot, connectorSnapshotThrottleMs]);

  useEffect(() => {
    const visibilityChanged = connectorVisibilitySignatureRef.current !== connectorVisibilitySignature;
    connectorVisibilitySignatureRef.current = connectorVisibilitySignature;
    scheduleConnectorRenderSnapshot(visibilityChanged);
  }, [connectorVisibilitySignature, liveSceneState, scheduleConnectorRenderSnapshot]);

  useEffect(() => () => {
    if (connectorRenderSnapshotTimerRef.current !== null) {
      window.clearTimeout(connectorRenderSnapshotTimerRef.current);
      connectorRenderSnapshotTimerRef.current = null;
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connectorRenderSnapshot = React.useMemo(
    () => connectorRenderSnapshotRef.current,
    [connectorRenderSnapshotVersion]
  );

  const connectorRenderPromptNodes = React.useMemo(
    () => connectorRenderSnapshot.promptIds
      .map((nodeId) => promptNodesById.get(nodeId))
      .filter((node): node is PromptNode => Boolean(node)),
    [connectorRenderSnapshot, promptNodesById]
  );

  const connectorRenderVisibleImageNodes = React.useMemo(
    () => connectorRenderSnapshot.imageIds
      .map((nodeId) => imageNodesById.get(nodeId))
      .filter((node): node is GeneratedImage => Boolean(node)),
    [connectorRenderSnapshot, imageNodesById]
  );

  const connectorRenderWorkflowUtilityNodesById = React.useMemo(
    () => new Map(
      connectorRenderSnapshot.workflowUtilityIds
        .map((nodeId) => workflowUtilityNodesById.get(nodeId))
        .filter((node): node is WorkflowUtilityCanvasNode => Boolean(node))
        .map((node) => [node.id, node] as const)
    ),
    [connectorRenderSnapshot, workflowUtilityNodesById]
  );

  const resolveLivePromptPosition = useCallback((promptNode: PromptNode | undefined | null) => {
    if (!promptNode) return null;
    const livePos = canvasLivePositionStore.getPosition(promptNode.id);
    if (livePos) return livePos;
    return resolveLiveSceneNodePosition(
      liveSceneRef.current,
      promptNode.id,
      promptNodesById.get(promptNode.id)?.position ?? promptNode.position,
    );
  }, [promptNodesById]);

  const resolveLiveImagePosition = useCallback((imageNode: GeneratedImage | undefined | null) => {
    if (!imageNode) return null;
    const livePos = canvasLivePositionStore.getPosition(imageNode.id);
    if (livePos) return livePos;
    return resolveLiveSceneNodePosition(
      liveSceneRef.current,
      imageNode.id,
      imageNodesById.get(imageNode.id)?.position ?? imageNode.position,
    );
  }, [imageNodesById]);

  const resolveConnectorRenderPosition = useCallback((
    nodeId: string | undefined | null,
    fallbackPosition: CanvasPoint | undefined | null
  ) => {
    if (!nodeId) return fallbackPosition ?? null;
    return connectorRenderSnapshot.positionByNodeId[nodeId] ?? fallbackPosition ?? null;
  }, [connectorRenderSnapshot]);

  return {
    connectorRenderSnapshot,
    connectorRenderPromptNodes,
    connectorRenderVisibleImageNodes,
    connectorRenderWorkflowUtilityNodesById,
    resolveLivePromptPosition,
    resolveLiveImagePosition,
    resolveConnectorRenderPosition,
  };
}
