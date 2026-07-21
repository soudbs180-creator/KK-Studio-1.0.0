import type {
  CapabilityEdgeDto,
  CapabilityGraphSnapshotDto,
  CapabilityNodeDto,
} from '@kk/shared';

export interface ProviderConnectionCapabilityRow {
  connectionId: string;
  connectionName: string;
  status: 'connected' | 'available' | 'restricted' | 'offline' | 'error';
  providerName: string;
  modelName: string;
  capabilityName: string;
  channel?: string;
  requestProfile?: string;
}

type NodeById = ReadonlyMap<string, CapabilityNodeDto>;

function readConstraint(edge: CapabilityEdgeDto, name: string): string | undefined {
  const value = edge.constraints[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function findTargetNode(
  edges: readonly CapabilityEdgeDto[],
  nodesById: NodeById,
  from: string,
  relation: CapabilityEdgeDto['relation'],
): CapabilityNodeDto | undefined {
  const edge = edges.find((candidate) => candidate.from === from && candidate.relation === relation);
  return edge ? nodesById.get(edge.to) : undefined;
}

function buildBindingRow(
  connection: Extract<CapabilityNodeDto, { type: 'ProviderConnection' }>,
  providerName: string,
  binding: CapabilityEdgeDto,
  nodesById: NodeById,
  edges: readonly CapabilityEdgeDto[],
): ProviderConnectionCapabilityRow {
  const model = nodesById.get(binding.to);
  const capability = model ? findTargetNode(edges, nodesById, model.id, 'supports') : undefined;
  return {
    connectionId: connection.connectionId,
    connectionName: connection.displayName,
    status: connection.status,
    providerName,
    modelName: model?.type === 'Model' ? model.displayName : '—',
    capabilityName: capability?.type === 'Capability' ? capability.displayName : '—',
    channel: readConstraint(binding, 'channel'),
    requestProfile: readConstraint(binding, 'requestProfile'),
  };
}

/**
 * Projects the normalized graph into stable rows so the UI never guesses provider relationships.
 */
export function buildConnectionCapabilityRows(
  snapshot: CapabilityGraphSnapshotDto,
): ProviderConnectionCapabilityRow[] {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const connections = snapshot.nodes.filter(
    (node): node is Extract<CapabilityNodeDto, { type: 'ProviderConnection' }> => (
      node.type === 'ProviderConnection'
    ),
  );

  return connections.flatMap((connection) => {
    const connectionNodeId = connection.id;
    const provider = findTargetNode(snapshot.edges, nodesById, connectionNodeId, 'connectsTo');
    const providerName = provider?.type === 'Provider' ? provider.displayName : connection.providerId;
    const bindings = snapshot.edges.filter(
      (edge) => edge.from === connectionNodeId && edge.relation === 'binds',
    );
    if (bindings.length === 0) {
      return [{
        connectionId: connection.connectionId,
        connectionName: connection.displayName,
        status: connection.status,
        providerName,
        modelName: '—',
        capabilityName: '—',
      }];
    }
    return bindings.map((binding) => (
      buildBindingRow(connection, providerName, binding, nodesById, snapshot.edges)
    ));
  });
}
