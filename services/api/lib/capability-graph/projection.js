// Capability Graph 投影是纯函数；输入必须来自 canonical catalog 与用户隔离后的数据库行。

function mapConnectionStatus(status) {
  if (status === 'available') return 'connected';
  if (status === 'offline' || status === 'revoked') return 'offline';
  if (status === 'error') return 'error';
  return 'restricted';
}

function mediaTypeFromCapability(capabilityId) {
  const prefix = String(capabilityId).split('.')[0];
  return ['image', 'video', 'audio', 'ppt', 'browser', 'data'].includes(prefix)
    ? prefix
    : undefined;
}

function buildProviderNodes(providers, generatedAt) {
  return providers.map((provider) => ({
    id: `provider:${provider.id}`,
    type: 'Provider',
    status: 'available',
    ownerScope: 'global',
    source: 'canonical-provider-catalog',
    version: '1',
    updatedAt: generatedAt,
    providerId: provider.id,
    displayName: provider.label,
  }));
}

function buildConnectionProjection(connections) {
  const nodes = [];
  const edges = [];
  for (const connection of connections) {
    const nodeId = `connection:${connection.connectionId}`;
    nodes.push({
      id: nodeId,
      type: 'ProviderConnection',
      status: mapConnectionStatus(connection.status),
      ownerScope: 'user',
      source: 'provider_connections',
      version: '1',
      updatedAt: connection.updatedAt,
      connectionId: connection.connectionId,
      providerId: connection.providerId,
      displayName: connection.displayName,
      hasSecret: connection.hasSecret,
    });
    edges.push({
      from: nodeId,
      to: `provider:${connection.providerId}`,
      relation: 'connectsTo',
      status: connection.status === 'available' ? 'active' : 'degraded',
      source: 'provider_connections',
      constraints: {},
      permissions: 'safe',
      version: '1',
    });
  }
  return { nodes, edges };
}

function ensureBindingNodes(binding, modelNodes, capabilityNodes) {
  const modelNodeId = `model:${binding.providerId}:${binding.modelId}`;
  const capabilityNodeId = `capability:${binding.capabilityId}`;
  if (!modelNodes.has(modelNodeId)) {
    modelNodes.set(modelNodeId, {
      id: modelNodeId,
      type: 'Model',
      status: binding.status === 'active' ? 'available' : 'restricted',
      ownerScope: 'user',
      source: 'capability_bindings',
      version: '1',
      updatedAt: binding.updatedAt,
      modelId: binding.modelId,
      providerId: binding.providerId,
      displayName: binding.modelId,
    });
  }
  if (!capabilityNodes.has(capabilityNodeId)) {
    capabilityNodes.set(capabilityNodeId, {
      id: capabilityNodeId,
      type: 'Capability',
      status: binding.status === 'active' ? 'available' : 'restricted',
      ownerScope: 'user',
      source: 'capability_bindings',
      version: '1',
      updatedAt: binding.updatedAt,
      capabilityId: binding.capabilityId,
      displayName: binding.capabilityId,
      mediaType: mediaTypeFromCapability(binding.capabilityId),
    });
  }
  return { modelNodeId, capabilityNodeId };
}

function buildBindingProjection(bindings) {
  const modelNodes = new Map();
  const capabilityNodes = new Map();
  const edges = [];
  for (const binding of bindings) {
    const { modelNodeId, capabilityNodeId } = ensureBindingNodes(binding, modelNodes, capabilityNodes);
    const edgeStatus = binding.status === 'active' ? 'active' : 'disabled';
    edges.push({
      from: `connection:${binding.connectionId}`,
      to: modelNodeId,
      relation: 'binds',
      status: edgeStatus,
      source: 'capability_bindings',
      constraints: { channel: binding.channel, requestProfile: binding.requestProfile, ...binding.constraints },
      permissions: 'safe',
      version: '1',
    }, {
      from: modelNodeId,
      to: capabilityNodeId,
      relation: 'supports',
      status: edgeStatus,
      source: 'capability_bindings',
      constraints: {},
      permissions: 'safe',
      version: '1',
    });
  }
  return { nodes: [...modelNodes.values(), ...capabilityNodes.values()], edges };
}

/** 从安全 DTO 与 canonical catalog 生成可序列化的 v1 snapshot。 */
function projectCapabilityGraph({ providers, connections, bindings, generatedAt = new Date().toISOString() }) {
  const connectionProjection = buildConnectionProjection(connections);
  const bindingProjection = buildBindingProjection(bindings);
  return {
    version: 'v1',
    generatedAt,
    nodes: [
      ...buildProviderNodes(providers, generatedAt),
      ...connectionProjection.nodes,
      ...bindingProjection.nodes,
    ],
    edges: [...connectionProjection.edges, ...bindingProjection.edges],
  };
}

module.exports = {
  projectCapabilityGraph,
};
