# Capability Spec: canvas-card-system-v2

## Requirements

1. Every visible canvas entity resolves to a versioned card presentation and finite bounds.
2. Unknown or damaged entities render a diagnostic fallback instead of disappearing.
3. Layout direction belongs to the affected group and survives reload.
4. Targeted arrangement never changes nodes outside the requested ID set.
5. Viewport restoration is scoped by canvas and responsive surface and must intersect content.
6. Legacy migration creates a restorable backup before changing presentation data.
7. Notebook conversion moves selected vector elements into an editable card and is undoable.
8. Workflow panels expose editable steps, execution state, retry, and output thumbnails.
9. Phone behavior remains the existing result-feed experience.
10. Tablet portrait remains in result-feed mode while tablet landscape uses the touch canvas; soft-keyboard resizing cannot switch surfaces.
11. Canvas performance settings are consumed by culling, drag suspension, zoom motion, connector throttling, and card-detail selection at runtime.
12. Generation mode and cloud-fallback settings are consumed by the canonical ProviderRouteEngine; strict local mode cannot silently execute a cloud route.
13. UI actions and AI tools create and arrange cards through the same card factory, layout service, permission policy, executor, and verification chain.
14. The desktop tool rail remains 44px wide, touch targets remain at least 44px, and the composer respects the calculated available viewport.
