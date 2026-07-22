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
  mapAgentToolCallRow,
  mapKnowledgeDocumentRow,
  mapAgentSkillRow,
};
