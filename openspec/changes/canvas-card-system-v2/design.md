Status: historical

# Design: canvas-card-system-v2

## Runtime boundaries

1. Persisted legacy domain records are sanitized and migrated to presentation version 2.
2. A scene adapter resolves card kind, exact bounds, layout mode, ports, and LOD policy.
3. `CanvasCardShell` owns geometry and interaction; content renderers own business UI.
4. A single layout service handles UI and agent-targeted arrangement.
5. ToolRegistry creates cards through a shared factory and verifies exact target IDs.

## Responsive surfaces

- Phone: existing result feed.
- Tablet portrait: result feed.
- Tablet landscape: compact touch canvas.
- Desktop: full canvas with compact composer and 44px tool rail.

## Migration

Before the first V2 migration, store the original serialized state under a versioned
backup key. Infer legacy group orientation from geometry, repair deterministic invalid
values, persist a summary, and expose backup restore. Never delete ambiguous records.

