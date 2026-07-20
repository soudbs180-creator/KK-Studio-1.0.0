# KK Studio AI Assistant Capability Baseline

Status: current documentation contract (not a claim that every planned item
is already implemented). Last reviewed: 2026-07-20. The release version is
read from `config/release-manifest.json` (`KK Studio v1.6.0`).

This file is intentionally short. Detailed behavior lives in the current AI
assistant knowledge base and the active OpenSpec changes:

- [AI assistant knowledge base](docs/ai-assistant/README.md)
- [ToolRegistry contract](docs/ai-assistant/tool-registry.md)
- [CanvasRuntimeState contract](docs/ai-assistant/canvas-runtime-state.md)
- [Site capability matrix](docs/ai-assistant/site-capability-matrix.md)
- [Control-plane hardening](openspec/changes/harden-ai-control-plane/proposal.md)
- [Site capability expansion](openspec/changes/expand-ai-site-capabilities/proposal.md)
- [Workspace UI modernization](openspec/changes/modernize-ai-first-workspace-ui/proposal.md)

## Stable runtime vocabulary

- `AssistantCollaborationMode`: `direct`, `assist`, or `takeover`.
- `CanvasRuntimeState`: the sanitized live page, viewport and selection state.
- `ToolRegistry`: the only autonomous business-action entry point.
- `DurableGenerationQueue`: the single durable owner of generation jobs.
- `AgentRunStore`: the single durable owner of Agent run state and recovery.
- `generation.createBatchJob`: the canonical batch-generation tool.
- `assets.zipOriginals`: the canonical selected-originals export tool.

## Safety contract

The execution path is `IntentGate -> Planner -> ToolRegistry ->
PermissionPolicy -> Executor -> Verification`. In `assist`, every executable
plan pauses for confirmation. In `takeover`, only safe read/navigation and
low-risk reversible actions can run without a prompt; generation, batch,
cost-bearing, deletion, publication, account and payment actions remain
confirmed, blocked or forbidden according to the tool policy. Assistant text
and `action://` links are never an autonomous command channel.

Provider calls, Agent runs, Tool Calls, Knowledge and Skills use typed KK API
Client methods. No browser document should describe a privileged Provider
direct call, a default password, a fixed credit price, or a secret value.

## Verification expectation

Any capability update must update the relevant knowledge page and capability
matrix, add or adjust a focused contract test, and run the documentation gate
before broader checks. This baseline is a routing document, not a roadmap; use
the OpenSpec change or a handoff entry for work that is not yet implemented.
