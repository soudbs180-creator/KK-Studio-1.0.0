# KK Studio Clay UI System

Last updated: 2026-05-01

## Canonical Direction

New KK Studio UI work must follow the Clay design direction from the cached `getdesign` template. The product should read as warm, clear, and visually decisive: cream canvas `#fffaf0`, near-black ink `#0a0a0a`, readable body copy `#3a3a3a`, muted copy `#6a6a6a`, flat hairline cards, and saturated color-block accents.

Light mode is warm and bright. Dark mode is a true dark Clay theme on neutral black-gray surfaces, not a blue, indigo, or teal workspace variant.

Current user override: inputs, main cards, sub cards, and framework cards use controlled frosted material. This means translucent backgrounds, blur, hairline borders, readable text contrast, and tokenized low shadows with solid fallbacks.

## Visual Hierarchy

| Layer | Treatment | Examples |
| --- | --- | --- |
| Canvas | warm cream, no cool-gray cast | main workspace background |
| Product surfaces | controlled frosted main/sub card or hairline fallback | panels, cards, lists |
| Color block | saturated pink/teal/lavender/peach/ochre/coral | primary emphasis, selected high-value cards |
| Command surface | frosted framework card with clear border | search palette, modal, settings shell |
| Dark theme | neutral black-gray canvas and cream text | dark canvas and cards |

## Color Rules

- Canvas: `#fffaf0`.
- Surface soft: `#faf5e8`; surface card: `#f5f0e0`; surface strong: `#ebe6d6`.
- Primary text and primary CTA: `#0a0a0a`.
- Body text: `#3a3a3a`; muted text: `#6a6a6a`.
- Hairline: `#e5e5e5`.
- Dark canvas: `#0b0b0c`; dark surface: `#141414`; dark elevated: `#1f1f1f`.
- Brand blocks: `#ff4d8b`, `#1a3a3a`, `#b8a4ed`, `#ffb084`, `#e8b94a`, `#a4d4c5`, `#ff6b5a`.
- Semantic success/warning/error colors are allowed only for real status meaning.

## Radius And Shadows

- Standard controls: 12px.
- Content cards: 16px.
- Feature cards and major sheets: 24px.
- Inputs, main cards, sub cards, and framework cards use shared controlled frosted tokens.
- Do not add heavy shadows, blue glows, or stacked one-off glass effects.

## Controls

- Buttons use 44px touch-safe height where practical.
- Primary buttons use near-black or Clay accent fills with clear contrast.
- Inputs use controlled frosted warm surfaces and visible focus states.
- Selected states should use Clay accent tokens, not generic blue/purple utility classes.
- Footer/action controls must stay inside their panel with ellipsis-safe labels.

## Search Palette

Desktop search is a command surface with a 24px radius and flat border. Mobile search is a bottom sheet with its own top radius and safe-area spacing. Both themes use Clay tokens, no heavy panel shadow, and no inline focus mutation.

## Settings And API Pages

Settings pages keep action areas visually stronger than repeated informational modules. Mobile and desktop shells use separate padding and layout rules. Advanced diagnostics, route pools, OCR, and platform tooling stay behind advanced disclosure unless directly relevant.

## Typography

Display headings use `Plain Black` if available, otherwise `Inter`, weight 500, with negative letter spacing. UI and body copy use `Inter`, normal spacing, and compact product sizes.

## Motion

Use the shared Clay motion scale:

- Fast hover: 120ms.
- Standard controls: 160ms.
- Panels/sheets: 240ms.
- Ease: `cubic-bezier(0.16, 1, 0.3, 1)`.

Avoid broad `transition-all` for theme-critical surfaces. Theme toggles should not flicker or animate large background/box-shadow changes.
