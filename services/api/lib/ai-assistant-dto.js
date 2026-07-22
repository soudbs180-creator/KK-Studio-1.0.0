// AI Assistant 数据库行到公开 DTO 的唯一映射边界，禁止把 snake_case 存储结构泄漏给 Web Client。

function compact(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null),
  );
}

function toIsoString(value) {
  if (value instanceof Date) return value.toISOString();
  return value == null ? undefined : String(value);
}

function mapAgentRunRow(row = {}, toolCalls = []) {
  return compact({
    id: row.id,
    sessionId: row.session_id,
    userMessage: row.user_message,
    intent: row.intent,
    plan: row.plan,
    status: row.status,
    toolCalls: Array.isArray(toolCalls) ? toolCalls : [],
    stepResults: Array.isArray(row.step_results) ? row.step_results : [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

function mapAgentRunEventRow(row = {}) {
  return compact({
    runId: row.run_id,
    sequence: Number(row.sequence),
    type: row.event_type,
    status: row.status,
    runUpdatedAt: toIsoString(row.run_updated_at),
    createdAt: toIsoString(row.created_at),
  });
}

function mapAgentSessionRow(row = {}) {
  return compact({
    sessionId: row.id,
    ownerId: row.user_id,
    collaborationMode: row.collaboration_mode,
    messages: Array.isArray(row.messages) ? row.messages : [],
    summary: row.summary,
    toolResults: Array.isArray(row.tool_results) ? row.tool_results : [],
    knowledgeRefs: Array.isArray(row.knowledge_refs) ? row.knowledge_refs : [],
    tokenBudget: row.token_budget,
    confirmations: Array.isArray(row.confirmations) ? row.confirmations : [],
    checkpoints: Array.isArray(row.checkpoints) ? row.checkpoints : [],
    lastHeartbeatAt: toIsoString(row.last_heartbeat_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

function mapAgentSessionListRow(row = {}) {
  return compact({
    sessionId: row.id,
    ownerId: row.user_id,
    collaborationMode: row.collaboration_mode,
    messageCount: Number(row.message_count || 0),
    lastHeartbeatAt: toIsoString(row.last_heartbeat_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

function mapAgentContextSnapshotRow(row = {}) {
  const snapshot = row.snapshot_data && typeof row.snapshot_data === 'object'
    ? row.snapshot_data
    : {};
  return compact({
    snapshotId: row.snapshot_id,
    sessionId: row.session_id,
    sequence: Number(row.sequence),
    activeSurface: snapshot.activeSurface,
    canvasId: snapshot.canvasId,
    canvasSummary: snapshot.canvasSummary,
    selectedNodeIds: snapshot.selectedNodeIds,
    viewport: snapshot.viewport,
    recentEvents: snapshot.recentEvents,
    inputBox: snapshot.inputBox,
    availableTools: snapshot.availableTools,
    capturedAt: toIsoString(row.captured_at),
    createdAt: toIsoString(row.created_at),
  });
}

function mapAgentToolCallRow(row = {}) {
  return compact({
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    toolName: row.tool_name,
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    status: row.status,
    outcome: row.outcome,
    failureClass: row.failure_class,
    errorCode: row.error_code,
    retryable: row.retryable,
    error: row.error,
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
    idempotencyKey: row.idempotency_key,
  });
}

function mapKnowledgeDocumentRow(row = {}) {
  return compact({
    id: row.id,
    userId: row.user_id,
    ownerScope: row.owner_scope,
    source: row.source,
    path: row.path,
    title: row.title,
    summary: row.summary,
    contentHash: row.content_hash,
    updatedAt: toIsoString(row.updated_at),
  });
}

function mapAgentSkillRow(row = {}) {
  return compact({
    id: row.id,
    userId: row.user_id,
    ownerScope: row.owner_scope,
    name: row.name,
    trigger: row.trigger_text,
    tools: Array.isArray(row.tools) ? row.tools : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    safety: Array.isArray(row.safety) ? row.safety : [],
    validation: Array.isArray(row.validation) ? row.validation : [],
    knowledgeUpdates: Array.isArray(row.knowledge_updates) ? row.knowledge_updates : [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

module.exports = {
  mapAgentRunRow,
  mapAgentRunEventRow,
  mapAgentSessionRow,
  mapAgentSessionListRow,
  mapAgentContextSnapshotRow,
  mapAgentToolCallRow,
  mapKnowledgeDocumentRow,
  mapAgentSkillRow,
};
