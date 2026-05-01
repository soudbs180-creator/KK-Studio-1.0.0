# KK Studio Clay UI Manual

Last updated: 2026-05-01

## Direction

KK Studio follows the cached `getdesign` Clay system from `npx getdesign@latest add clay`. The interface is cream-first, high-contrast, and flat: a warm canvas `#fffaf0`, near-black ink `#0a0a0a`, readable body text `#3a3a3a`, muted text `#6a6a6a`, and saturated feature color blocks for emphasis.

This replaces the previous blue/glass direction. Light mode is warm cream with dark ink. Dark mode uses neutral black-gray surfaces, not a blue or teal-tinted workspace.

User override for this UI audit: inputs, main cards, sub cards, and framework cards use controlled frosted material. The material is translucent, blurred, bordered, and readable; it is not heavy glassmorphism and does not reintroduce blue glow or cinematic shadows.

## Tokens

- Canvas: `#fffaf0`; soft surface: `#faf5e8`; card surface: `#f5f0e0`; strong surface: `#ebe6d6`.
- Ink and primary CTA: `#0a0a0a`; active CTA: `#1f1f1f`; dark canvas: `#0b0b0c`; dark surface: `#141414`; dark elevated: `#1f1f1f`.
- Body text: `#3a3a3a`; muted text: `#6a6a6a`; hairline: `#e5e5e5`.
- Color blocks: pink `#ff4d8b`, teal `#1a3a3a`, lavender `#b8a4ed`, peach `#ffb084`, ochre `#e8b94a`, mint `#a4d4c5`, coral `#ff6b5a`.
- Motion: 160ms standard duration, `cubic-bezier(0.16, 1, 0.3, 1)`.

## Radius, Shadow, And Frosted Depth

- Buttons and inputs: 12px radius.
- Content cards: 16px radius.
- Feature cards and major sheets: 24px radius.
- Depth comes from warm surface contrast, controlled frosted material, and bold color-block hierarchy, not heavy shadows.
- Inputs, main cards, sub cards, and framework cards use shared frosted tokens with solid fallbacks.
- Dense tables and high-density lists may use near-solid frosted fallback so text remains readable.
- Default shadows stay low and tokenized. Use no heavy shadows.
- Saturated cards carry the visual weight directly through color, not glow.

## Component Rules

- Primary actions use near-black or Clay coral/pink accents with clear white text.
- Inputs use controlled frosted warm surfaces with visible borders and focus rings.
- Search, settings, modal, and canvas surfaces must keep readable foreground/background contrast in both light and dark themes.
- Mobile and desktop surfaces can share tokens, but their layout logic and spacing must be separate.
- Avoid blue or purple as generic selected states; use Clay pink/coral/teal depending on semantic weight.

## Typography

Display moments use `Plain Black` when available, falling back to `Inter`, weight 500, with negative letter spacing. Body and UI copy use `Inter`. Display text should feel rounded and editorial, while product UI remains concise and readable.

## Responsive

Desktop uses command surfaces and multi-column settings layouts. Mobile uses bottom sheets, safe-area padding, larger touch targets, and separate onboarding steps. Do not mix desktop targets into phone tutorials or phone-only controls into desktop tutorials.

## Dark Mode

Dark mode is a real dark Clay theme on neutral black-gray surfaces: canvas `#0b0b0c`, surface `#141414`, elevated cards `#1f1f1f`, cream primary text `#fffaf0`, and soft light secondary text. It must not inherit blue, indigo, or teal canvas backgrounds.
