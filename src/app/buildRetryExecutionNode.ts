import { normalizeModelId } from '../services/auth/keyManager';
import type { PromptNode } from '../types';
import { resolveModelDisplayName } from '../utils/modelDisplayName';

type RetryRouteState = Pick<PromptNode, 'keySlotId' | 'provider' | 'providerLabel'>;

interface BuildRetryExecutionNodeArgs {
  node: PromptNode;
  resolveNodeRouteState: (node: Pick<PromptNode, 'model' | 'keySlotId' | 'provider' | 'providerLabel'>) => RetryRouteState;
}

export function buildRetryExecutionNode({
  node,
  resolveNodeRouteState,
}: BuildRetryExecutionNodeArgs): PromptNode {
  const normalizedRetryModel = normalizeModelId(node.model);
  const normalizedRetryNode: PromptNode = {
    ...node,
    model: normalizedRetryModel,
    modelLabel: resolveModelDisplayName(normalizedRetryModel, node.modelLabel || node.model),
  };

  return {
    ...normalizedRetryNode,
    ...resolveNodeRouteState(normalizedRetryNode),
  };
}
