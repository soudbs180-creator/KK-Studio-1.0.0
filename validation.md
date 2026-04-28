# KK-Studio v1.4.2 Refactor Validation Matrix

Last updated: 2026-04-29

Use `npm.cmd` for npm scripts on Windows.

## Baseline Gates

Documentation and agent-rule changes:

```powershell
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

Code changes:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

Full local gate when feasible:

```powershell
npm.cmd run verify:changes
```


## Milestone 1: Refactor Ledger Alignment

Commands:

```powershell
npm.cmd run governance:agent-docs
npm.cmd run check:encoding
```

Expected result:
- Both commands exit 0.
- If governance does not inspect root ledger files directly, the command still must pass.

## Milestone 2: Connector Renderer Extraction Hardening

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/canvas-connector-throttling-contract.test.ts" `
  "tests/unit/canvas-local-performance-trace-contract.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts"
```

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Milestone 3: Prompt Group Layout Runtime

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/prompt-group-regroup-behavior.test.ts" `
  "tests/unit/canvas-live-scene-contract.test.ts" `
  "tests/unit/canvas-connector-throttling-contract.test.ts"
```

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Milestone 4: Generation Runtime

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/generation-runtime-contract.test.ts" `
  "tests/unit/billing-remaining-balance-contract.test.ts"
```

If a listed test does not exist yet, create focused contract coverage before moving production logic.

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Milestone 5: PPT Runtime

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ppt-deck-module-contract.test.ts" `
  "tests/unit/pptx-export-contract.test.ts"
```

If a listed test does not exist yet, create focused contract coverage before moving production logic.

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Milestone 6: Ecommerce Runtime

Targeted tests:

```powershell
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none `
  "tests/unit/ecommerce-framework-contract.test.ts" `
  "tests/unit/ecommerce-import-review-contract.test.ts"
```

If a listed test does not exist yet, create focused contract coverage before moving production logic.

Milestone gate:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

## Milestone 7: CanvasContext and keyManager Split

Targeted tests:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
```

Add focused tests around the public API being split before moving implementation code.

Milestone gate:

```powershell
npm.cmd run build
npm.cmd run check:encoding
```

## Milestone 8: Global Quality Governance

Commands:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

Add narrower targeted tests when a cleanup touches a behavior boundary.

## Milestone 9: apps/web Migration

Commands:

```powershell
npm.cmd run architecture:check
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run check:encoding
```

Run any available smoke tests for moved UI surfaces before committing a migration batch.

## Failure Policy

- New failures introduced by the current milestone must be fixed before commit.
- Historical failures may be recorded only with command output and a narrow risk note.
- Do not continue to the next milestone while a new failure remains open.
