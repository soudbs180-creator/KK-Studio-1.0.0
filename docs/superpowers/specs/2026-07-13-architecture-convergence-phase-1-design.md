# Architecture Convergence Phase 1 Design

**Status:** Approved through the 2026-07-13 architecture audit and the user's instruction to start implementation.

## Goal

Make KK Studio v1.6.0's governance output reflect the real compatibility surface, and remove the most misleading current-document facts without changing runtime behavior.

## Scope

This phase delivers two independently verifiable controls:

1. `services/api/routes/compat/` becomes an explicitly registered compatibility layer. A registered directory covers its descendants, so governance does not require one registry record per route file.
2. Current guidance documents stop claiming v1.5.9 is current, linking to developer-machine paths, or directing implementation into the removed root `src/` runtime.

Historical handoff entries and dated progress records remain historical evidence. They are not rewritten to pretend they were created under v1.6.0.

## Compatibility registry design

Every registry entry must include an accountable `owner` and an ISO `reviewBy` date in addition to its purpose, canonical source, dependents, regression tests, and removal condition. Directory entries are allowed and cover files below that directory. The checker reports the number of registered layers and the number of discovered compatibility files covered by them.

The server compatibility entry represents the whole `services/api/routes/compat/` boundary. Its removal condition is contract migration, not arbitrary deletion: consumers must move to typed `/api/v1` contracts and each compatibility operation must have an explicit replacement or deprecation decision.

## Documentation design

`config/release-manifest.json` remains the only current version source. Current indexes, setup entrypoints, architecture source-of-truth documents, and active AI guidance must say v1.6.0. Repository links must be relative; examples that need a home directory use placeholders such as `<USERPROFILE>`.

Legacy reports and dated records may describe old versions, but current guidance must not present root `src/` as an implementation location. Where a document is still useful, paths are migrated to `apps/web/src/`; where its purpose is purely historical, it is scheduled for archive in a later cleanup phase.

## Verification

- A unit test runs the compatibility checker against an isolated fixture and proves directory registration covers descendant files.
- A unit test proves missing ownership/review metadata fails governance.
- Current governance and architecture checks pass against the repository.
- Encoding checks confirm all edited documents remain UTF-8.

## Deferred phases

- Phase 2: route Wuyin catalog access through the typed API client and remove the dead auth shim.
- Phase 3: classify the 81 runtime operations absent from OpenAPI as stable, internal, compatibility, or deprecated.
- Phase 4: replace remaining `compatibilityMode` branches with capability-surface routing where behavior is covered by tests.
