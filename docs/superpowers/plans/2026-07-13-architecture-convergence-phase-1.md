# Architecture Convergence Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make compatibility and active-document governance accurately enforce KK Studio v1.6.0's current architecture.

**Architecture:** Extend the existing compatibility registry checker rather than creating a parallel governance system. Treat registered directories as ownership boundaries for descendant compatibility files, require accountable metadata, and update the curated current-document surface to match `config/release-manifest.json`.

**Tech Stack:** Node.js 24, `node:test`, JSON registry, Markdown governance documents.

## Global Constraints

- Version source of truth remains `config/release-manifest.json` (`1.6.0`).
- Web runtime remains `apps/web/`; do not recreate root `src/`.
- Historical handoff entries must retain their original historical facts.
- Use test-first changes for executable governance behavior.
- Finish with architecture, governance, typecheck, build, Handoff, `agents:commit`, and push.

---

### Task 1: Directory-level compatibility registration

**Files:**
- Create: `tests/unit/compatibility-registry-governance.test.ts`
- Modify: `scripts/governance/check-compatibility-registry.mjs`
- Modify: `docs/architecture/COMPATIBILITY_LAYER_REGISTRY.json`

**Interfaces:**
- Consumes: registry entries containing `path`, `role`, `owner`, `reviewBy`, purpose, dependency, test, and removal metadata.
- Produces: directory entries that cover descendant files discovered by compatibility naming patterns.

- [x] **Step 1: Write a failing directory-coverage test**

Create an isolated fixture with `server/routes/compat/example.js`, a directory registry entry for `server/routes/compat`, and an existing regression test path. Execute the real checker with the fixture as `cwd` and assert exit code `0`.

- [x] **Step 2: Verify the test fails**

Run:

```powershell
node --test --test-isolation=none tests/unit/compatibility-registry-governance.test.ts
```

Expected: FAIL because the checker currently requires the discovered child file itself to be registered.

- [x] **Step 3: Add metadata failure coverage**

Add a second fixture that omits `owner` and `reviewBy`; assert non-zero exit and errors naming both fields.

- [x] **Step 4: Implement the minimal checker change**

Normalize registry paths, detect whether each registered path is a directory, and consider a discovery match covered when it equals a registered path or is below a registered directory. Validate non-empty `owner` and ISO `reviewBy` metadata.

- [x] **Step 5: Register current compatibility boundaries**

Replace the obsolete `generatedFromPlan` description with a v1.6.0 governance source, add ownership/review metadata to existing entries, and add one `server/routes/compat` directory entry with concrete regression tests and a contract-migration removal condition.

- [x] **Step 6: Verify green**

Run the focused unit test and `node scripts/governance/check-compatibility-registry.mjs`. Expected: PASS and explicit coverage of the server compatibility directory.

### Task 2: Current-document fact convergence

**Files:**
- Modify: `scripts/governance/check-current-facts.mjs`
- Modify: `tests/unit/runtime-governance-upgrade.test.ts`
- Modify: current indexes, setup entrypoints, architecture source-of-truth documents, and active AI guidance identified by the audit.

**Interfaces:**
- Consumes: `manifest.displayVersion`, curated current-document paths, prohibited current-path patterns.
- Produces: governance failures when a current guidance document claims v1.5.9 is current, contains a developer-machine path, or points to removed root `src/` implementation paths.

- [x] **Step 1: Add failing governance assertions**

Assert the current-facts checker includes the current index/setup/architecture documents, rejects developer-machine paths, and distinguishes `apps/web/src/` from removed root `src/` references.

- [x] **Step 2: Verify red**

Run the focused runtime governance test. Expected: FAIL because these controls are not yet present.

- [x] **Step 3: Implement current-document checks**

Add explicit current guidance lists and regular expressions for absolute user paths and root legacy source paths. Keep handoff and dated historical records outside current-claim enforcement.

- [x] **Step 4: Update current guidance**

Change current-version claims to v1.6.0, replace local links with repository-relative links or `<USERPROFILE>` examples, and update root `src/` implementation guidance to `apps/web/src/`.

- [x] **Step 5: Verify green**

Run the focused unit test, current-facts check, full governance check, docs architecture check, and encoding checks. Expected: PASS.

### Task 3: Project verification and synchronization

**Files:**
- Modify: `docs/development/session-handoff.md`

**Interfaces:**
- Consumes: completed changes and fresh validation output.
- Produces: the next numbered Handoff entry and an Agent Sync commit.

- [x] **Step 1: Run required validation**

Run the repository-equivalent commands for `architecture:check`, `governance:check`, `typecheck`, and `build` using the bundled Node runtime. Record any aggregate npm limitation accurately.

- [x] **Step 2: Append Handoff**

Record scope, files, decisions, validation, unrun commands and reasons, risks, and next phase.

- [x] **Step 3: Commit and push**

Run the direct equivalent of `npm run agents:commit`, confirm the worktree is clean, and push the resulting commit to the configured remote.

## Self-review

- Spec coverage: compatibility governance and current-document drift each have an implementation and verification task.
- Placeholder scan: no TBD/TODO/implement-later placeholders remain.
- Type consistency: registry metadata names are consistently `owner` and `reviewBy`; current version comes from `manifest.displayVersion`.
