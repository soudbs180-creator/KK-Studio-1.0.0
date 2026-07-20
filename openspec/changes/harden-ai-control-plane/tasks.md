Status: historical

# Tasks: harden-ai-control-plane

- [x] Remove automatic `action://` execution while preserving explicit user clicks.
- [x] Add and export the typed `AssistantExecutionContext` with live state, stores, grants and cancellation.
- [x] Normalize ToolRegistry impact, cost, recovery, idempotency and failure metadata.
- [x] Require mutating tools to expose input validation and outcome verification.
- [x] Consume `AgentPlanStep.verification` and persist explicit step outcomes.
- [x] Require user-sourced run grants and stop dependent execution after cancellation.
- [x] Route Agent Run, Tool Call, Knowledge and Skill synchronization through the typed KK API Client.
- [x] Add `016_ai_assistant_user_scope.sql` and user-scope AI Assistant service queries.
- [x] Wire the current AI schema and migration into VPS bootstrap/deploy and local database setup.
- [x] Add focused security, API boundary, migration, verification and cancellation tests.
- [x] Update active AI Assistant documentation from verified source facts; append the phase Handoff at delivery.
- [x] Run architecture, governance, typecheck, build, full tests and phase smoke validation.
