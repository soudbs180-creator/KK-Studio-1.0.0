import {
  AspectRatio,
  GenerationMode,
  ImageSize,
  type Canvas,
  type EcommerceFrameworkQueueCounts,
  type EcommerceFrameworkQueueItem,
  type EcommerceFrameworkRuntimeState,
  type EcommerceFrameworkSchedulerConfig,
  type EcommerceGroupSheet,
  type PromptNode,
} from '../../types.ts';

const DEFAULT_LOCAL_CONCURRENCY = 4;
const DEFAULT_REMOTE_CONCURRENCY = 2;

function cloneQueueItem(item: EcommerceFrameworkQueueItem): EcommerceFrameworkQueueItem {
  return { ...item };
}

export function createDefaultEcommerceFrameworkSchedulerConfig(
  overrides: Partial<EcommerceFrameworkSchedulerConfig> = {},
): EcommerceFrameworkSchedulerConfig {
  return {
    maxLocalConcurrency: overrides.maxLocalConcurrency ?? DEFAULT_LOCAL_CONCURRENCY,
    maxRemoteConcurrency: overrides.maxRemoteConcurrency ?? DEFAULT_REMOTE_CONCURRENCY,
  };
}

export function createEcommerceFrameworkRuntimeState(params: {
  frameworkId: string;
  activeSheet: EcommerceGroupSheet;
  config?: Partial<EcommerceFrameworkSchedulerConfig>;
}): EcommerceFrameworkRuntimeState {
  return {
    frameworkId: params.frameworkId,
    activeSheet: params.activeSheet,
    paused: false,
    config: createDefaultEcommerceFrameworkSchedulerConfig(params.config),
    queue: [],
    lastUpdatedAt: Date.now(),
  };
}

export function enqueueEcommerceFrameworkItems(
  runtime: EcommerceFrameworkRuntimeState,
  items: Array<
    Pick<EcommerceFrameworkQueueItem, 'queueId' | 'nodeId' | 'phase' | 'laneKey' | 'laneType' | 'sourceSheet'>
  >,
): EcommerceFrameworkRuntimeState {
  const existingKeys = new Set(
    runtime.queue
      .filter((item) => item.status === 'queued' || item.status === 'dispatching' || item.status === 'running' || item.status === 'paused')
      .map((item) => `${item.nodeId}:${item.phase}`),
  );
  const nextQueue = runtime.queue.map(cloneQueueItem);

  items.forEach((item) => {
    const dedupeKey = `${item.nodeId}:${item.phase}`;
    if (existingKeys.has(dedupeKey)) {
      return;
    }

    existingKeys.add(dedupeKey);
    nextQueue.push({
      queueId: item.queueId,
      frameworkId: runtime.frameworkId,
      nodeId: item.nodeId,
      phase: item.phase,
      laneKey: item.laneKey,
      laneType: item.laneType,
      sourceSheet: item.sourceSheet,
      status: runtime.paused ? 'paused' : 'queued',
      enqueuedAt: Date.now(),
    });
  });

  return {
    ...runtime,
    queue: nextQueue,
    lastUpdatedAt: Date.now(),
  };
}

export function resolveEcommerceFrameworkQueueCounts(
  runtime?: EcommerceFrameworkRuntimeState | null,
): EcommerceFrameworkQueueCounts {
  const counts: EcommerceFrameworkQueueCounts = {
    queued: 0,
    dispatching: 0,
    running: 0,
    completed: 0,
    failed: 0,
    paused: 0,
    total: 0,
  };

  (runtime?.queue || []).forEach((item) => {
    counts.total += 1;
    counts[item.status] += 1;
  });

  return counts;
}

export function pauseEcommerceFrameworkRuntime(
  runtime: EcommerceFrameworkRuntimeState,
): EcommerceFrameworkRuntimeState {
  return {
    ...runtime,
    paused: true,
    queue: runtime.queue.map((item) => (
      item.status === 'queued'
        ? { ...item, status: 'paused' }
        : cloneQueueItem(item)
    )),
    lastUpdatedAt: Date.now(),
  };
}

export function resumeEcommerceFrameworkRuntime(
  runtime: EcommerceFrameworkRuntimeState,
): EcommerceFrameworkRuntimeState {
  return {
    ...runtime,
    paused: false,
    queue: runtime.queue.map((item) => (
      item.status === 'paused'
        ? { ...item, status: 'queued' }
        : cloneQueueItem(item)
    )),
    lastUpdatedAt: Date.now(),
  };
}

export function cancelEcommerceFrameworkNodeQueue(
  runtime: EcommerceFrameworkRuntimeState,
  nodeId: string,
): EcommerceFrameworkRuntimeState {
  return {
    ...runtime,
    queue: runtime.queue
      .filter((item) => !(
        item.nodeId === nodeId
        && (item.status === 'queued' || item.status === 'paused')
      ))
      .map(cloneQueueItem),
    lastUpdatedAt: Date.now(),
  };
}

export function markEcommerceFrameworkQueueItemStatus(
  runtime: EcommerceFrameworkRuntimeState,
  queueId: string,
  status: EcommerceFrameworkQueueItem['status'],
  patch: Partial<EcommerceFrameworkQueueItem> = {},
): EcommerceFrameworkRuntimeState {
  return {
    ...runtime,
    queue: runtime.queue.map((item) => (
      item.queueId === queueId
        ? {
            ...item,
            ...patch,
            status,
            startedAt: status === 'running' ? (patch.startedAt ?? item.startedAt ?? Date.now()) : item.startedAt,
            finishedAt: status === 'completed' || status === 'failed' ? (patch.finishedAt ?? Date.now()) : patch.finishedAt ?? item.finishedAt,
          }
        : cloneQueueItem(item)
    )),
    lastUpdatedAt: Date.now(),
  };
}

export function resolveEcommerceFrameworkDispatchPlan(
  runtime: EcommerceFrameworkRuntimeState,
): EcommerceFrameworkQueueItem[] {
  if (runtime.paused) {
    return [];
  }

  const countsByLane = new Map<string, number>();
  let runningLocal = 0;
  let runningRemote = 0;

  runtime.queue.forEach((item) => {
    if (item.status !== 'dispatching' && item.status !== 'running') {
      return;
    }

    countsByLane.set(item.laneKey, (countsByLane.get(item.laneKey) || 0) + 1);
    if (item.laneType === 'local') {
      runningLocal += 1;
      return;
    }
    runningRemote += 1;
  });

  const selectedQueueIds = new Set<string>();
  const remoteCandidates: EcommerceFrameworkQueueItem[] = [];
  for (const item of runtime.queue) {
    if (item.status !== 'queued') {
      continue;
    }

    if (item.laneType === 'local') {
      if (runningLocal >= runtime.config.maxLocalConcurrency) {
        continue;
      }
      runningLocal += 1;
      countsByLane.set(item.laneKey, (countsByLane.get(item.laneKey) || 0) + 1);
      selectedQueueIds.add(item.queueId);
      continue;
    }

    remoteCandidates.push(item);
  }

  const remoteSlots = Math.max(0, runtime.config.maxRemoteConcurrency - runningRemote);
  const remainingRemoteCandidates = [...remoteCandidates];
  for (let slot = 0; slot < remoteSlots && remainingRemoteCandidates.length > 0; slot += 1) {
    let selectedIndex = 0;
    let selectedLaneCount = countsByLane.get(remainingRemoteCandidates[0].laneKey) || 0;

    for (let index = 1; index < remainingRemoteCandidates.length; index += 1) {
      const item = remainingRemoteCandidates[index];
      const laneCount = countsByLane.get(item.laneKey) || 0;
      if (laneCount < selectedLaneCount) {
        selectedIndex = index;
        selectedLaneCount = laneCount;
      }
    }

    const [selectedItem] = remainingRemoteCandidates.splice(selectedIndex, 1);
    countsByLane.set(selectedItem.laneKey, (countsByLane.get(selectedItem.laneKey) || 0) + 1);
    selectedQueueIds.add(selectedItem.queueId);
  }

  return runtime.queue
    .filter((item) => selectedQueueIds.has(item.queueId))
    .map(cloneQueueItem);
}

function isFrameworkNode(node: PromptNode): boolean {
  return node.mode === GenerationMode.ECOMMERCE && node.ecommerce?.kind === 'framework';
}

function isEcommercePromptNode(node: PromptNode): boolean {
  return node.mode === GenerationMode.ECOMMERCE && !!node.ecommerce;
}

function buildFrameworkLabel(productName: string): string {
  return `${productName || '电商'} Framework`;
}

function buildFrameworkNode(params: {
  frameworkId: string;
  productName: string;
  position: { x: number; y: number };
}): PromptNode {
  const label = buildFrameworkLabel(params.productName);

  return {
    id: params.frameworkId,
    prompt: label,
    originalPrompt: label,
    position: params.position,
    aspectRatio: AspectRatio.LANDSCAPE_16_9,
    imageSize: ImageSize.SIZE_1K,
    model: 'gemini-3.1-flash-image-preview',
    childImageIds: [],
    timestamp: Date.now(),
    mode: GenerationMode.ECOMMERCE,
    parallelCount: 1,
    thinkingMode: 'high',
    referenceImages: [],
    ecommerce: {
      kind: 'framework',
      sourceSheet: '主图',
      sourceRowKey: 'framework-root',
      selectedForGeneration: false,
      stage: 'ready',
      desktopStage: 'not_applicable',
      mobileStage: 'not_applicable',
      theme: label,
      displayLabel: label,
      frameworkMeta: {
        activeSheet: '主图',
        groupIds: {},
        taskNodeIds: [],
        schedulerConfig: createDefaultEcommerceFrameworkSchedulerConfig(),
      },
    },
  };
}

function resolveFrameworkPosition(promptNodes: PromptNode[]): { x: number; y: number } {
  const ecommerceNodes = promptNodes.filter(isEcommercePromptNode);
  const minX = Math.min(...ecommerceNodes.map((node) => node.position.x));
  const minY = Math.min(...ecommerceNodes.map((node) => node.position.y));

  return {
    x: minX - 420,
    y: minY,
  };
}

function resolveFrameworkProductName(promptNodes: PromptNode[]): string {
  const themedNode = promptNodes.find((node) => String(node.ecommerce?.theme || '').trim().length > 0);
  return String(themedNode?.ecommerce?.theme || '').trim() || '电商';
}

export function migrateLegacyEcommerceFrameworkCanvas(canvas: Canvas): Canvas {
  const promptNodes: PromptNode[] = (canvas.promptNodes || []).map((node) => ({ ...node, ecommerce: node.ecommerce ? { ...node.ecommerce } : node.ecommerce }));
  const ecommerceNodes = promptNodes.filter(isEcommercePromptNode);
  if (ecommerceNodes.length === 0) {
    return canvas;
  }

  const frameworkNodes = ecommerceNodes.filter(isFrameworkNode);
  let frameworkNode: PromptNode | undefined = frameworkNodes[0];

  if (!frameworkNode) {
    const frameworkId = `ecom-framework-${canvas.id}`;
    frameworkNode = buildFrameworkNode({
      frameworkId,
      productName: resolveFrameworkProductName(ecommerceNodes),
      position: resolveFrameworkPosition(ecommerceNodes),
    });
    promptNodes.unshift(frameworkNode);
  }

  const groupIdsBySheet: Partial<Record<EcommerceGroupSheet, string>> = {};
  const taskNodeIds: string[] = [];
  const frameworkId = frameworkNode.id;

  const normalizedPromptNodes = promptNodes.map((node) => {
    if (!node.ecommerce || node.id === frameworkId) {
      return node;
    }

    if (node.ecommerce.kind === 'a-plus-group') {
      groupIdsBySheet[node.ecommerce.sourceSheet] = node.id;
      return {
        ...node,
        hiddenInCanvas: true,
        ecommerce: {
          ...node.ecommerce,
          frameworkId,
          parentNodeId: frameworkId,
        },
      };
    }

    const inferredGroupId = node.ecommerce.groupId || groupIdsBySheet[node.ecommerce.sourceSheet];
    taskNodeIds.push(node.id);
    return {
      ...node,
      hiddenInCanvas: true,
      ecommerce: {
        ...node.ecommerce,
        frameworkId,
        groupId: inferredGroupId,
        parentNodeId: inferredGroupId || frameworkId,
      },
    };
  });

  const frameworkIndex = normalizedPromptNodes.findIndex((node) => node.id === frameworkId);
  const nextFrameworkNode = normalizedPromptNodes[frameworkIndex];
  normalizedPromptNodes[frameworkIndex] = {
    ...nextFrameworkNode,
    ecommerce: {
      ...nextFrameworkNode.ecommerce!,
      frameworkMeta: {
        activeSheet: nextFrameworkNode.ecommerce?.frameworkMeta?.activeSheet || '主图',
        groupIds: {
          ...groupIdsBySheet,
          ...nextFrameworkNode.ecommerce?.frameworkMeta?.groupIds,
        },
        taskNodeIds,
        schedulerConfig: nextFrameworkNode.ecommerce?.frameworkMeta?.schedulerConfig
          || createDefaultEcommerceFrameworkSchedulerConfig(),
      },
    },
  };

  return {
    ...canvas,
    promptNodes: normalizedPromptNodes,
  };
}

export function resolveEcommerceFrameworkSummary(
  promptNodes: PromptNode[],
  frameworkId: string,
  runtime?: EcommerceFrameworkRuntimeState | null,
): {
  frameworkId: string;
  activeSheet: EcommerceGroupSheet;
  paused: boolean;
  frameworkLabel: string;
  queued: number;
  dispatching: number;
  running: number;
  completed: number;
  failed: number;
  pausedItems: number;
  total: number;
} {
  const frameworkNode = promptNodes.find((node) => node.id === frameworkId && node.ecommerce?.kind === 'framework');
  const counts = resolveEcommerceFrameworkQueueCounts(runtime);

  return {
    frameworkId,
    activeSheet: runtime?.activeSheet || frameworkNode?.ecommerce?.frameworkMeta?.activeSheet || '主图',
    paused: runtime?.paused || false,
    frameworkLabel: frameworkNode?.ecommerce?.displayLabel || frameworkNode?.prompt || 'Framework',
    queued: counts.queued,
    dispatching: counts.dispatching,
    running: counts.running,
    completed: counts.completed,
    failed: counts.failed,
    pausedItems: counts.paused,
    total: counts.total,
  };
}

export function resolveFrameworkLane(params: {
  keySlotId?: string;
  provider?: string;
  baseUrl?: string;
}): {
  laneKey: string;
  laneType: 'local' | 'remote';
} {
  const providerLabel = String(params.provider || 'provider').trim().toLowerCase() || 'provider';
  const baseUrl = String(params.baseUrl || '').trim().toLowerCase();
  const isLocal = /(^https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(baseUrl);

  return {
    laneKey: `${isLocal ? 'local' : 'remote'}:${params.keySlotId || providerLabel}`,
    laneType: isLocal ? 'local' : 'remote',
  };
}
