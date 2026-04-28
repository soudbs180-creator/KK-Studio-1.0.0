import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

type RgbaColor = { r: number; g: number; b: number; a: number };

function parseCssColor(value: string): RgbaColor {
  const color = value.trim();

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    assert.equal(hex.length, 6, `Expected a 6-digit hex color, received ${value}`);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(rgbaMatch, `Unsupported CSS color: ${value}`);

  const parts = rgbaMatch[1].split(',').map((part) => part.trim());
  return {
    r: Number(parts[0]),
    g: Number(parts[1]),
    b: Number(parts[2]),
    a: parts[3] === undefined ? 1 : Number(parts[3]),
  };
}

function compositeColor(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  return {
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  };
}

function channelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: RgbaColor): number {
  return (
    0.2126 * channelToLinear(color.r)
    + 0.7152 * channelToLinear(color.g)
    + 0.0722 * channelToLinear(color.b)
  );
}

function contrastRatio(foregroundValue: string, backgroundValue: string): number {
  const background = parseCssColor(backgroundValue);
  const foreground = parseCssColor(foregroundValue);
  const effectiveForeground = foreground.a < 1 ? compositeColor(foreground, background) : foreground;
  const foregroundLuminance = relativeLuminance(effectiveForeground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function extractCssBlock(source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[1];
}

function extractCssVariable(block: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escapedName}:\\s*([^;]+);`));
  assert.ok(match, `Missing CSS variable ${name}`);
  return match[1].trim();
}

test('dark canvas keeps the dot grid visible instead of collapsing into pure black', () => {
  const cssSource = readSource('src/index.css');

  assert.doesNotMatch(
    cssSource,
    /body\.dark-mode\s*\{[\s\S]*--bg-canvas:\s*#000000;/,
  );
  assert.doesNotMatch(
    cssSource,
    /body\.dark-mode\s*\{[\s\S]*--grid-dot:\s*rgba\(255,\s*255,\s*255,\s*0\.08\);/,
  );
});

test('canvas panning does not disable frosted card surfaces while zooming still keeps the fast-path fallback', () => {
  const cssSource = readSource('src/index.css');

  assert.doesNotMatch(
    cssSource,
    /\.canvas-container\.is-dragging\s+\[data-canvas-surface\][\s\S]*backdrop-filter:\s*none\s*!important;/,
  );
  assert.match(
    cssSource,
    /\.canvas-container\.is-zooming\s+\[data-canvas-surface\][\s\S]*backdrop-filter:\s*none\s*!important;/,
  );
});

test('prompt cards use the same theme surface fill as image cards in dark and light mode', () => {
  const source = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const imageCardSource = readSource('src/components/image/ImageCard2.tsx');

  assert.match(
    source,
    /const promptGlassFill = 'var\(--bg-surface\)';/,
  );
  assert.match(source, /backgroundColor:\s*promptGlassFill,/);
  assert.match(imageCardSource, /backgroundColor:\s*'var\(--bg-surface\)'/);
});

test('prompt card theme surface text tokens meet normal text contrast in light and dark themes', () => {
  const cssSource = readSource('src/index.css');
  const lightTheme = extractCssBlock(cssSource, ':root');
  const darkTheme = extractCssBlock(cssSource, 'body.dark-mode');

  for (const [themeName, themeBlock] of [
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const) {
    const surface = extractCssVariable(themeBlock, '--bg-surface');

    for (const [token, minimumRatio] of [
      ['--text-primary', 4.5],
      ['--text-secondary', 4.5],
      ['--text-tertiary', 4.5],
    ] as const) {
      const textColor = extractCssVariable(themeBlock, token);
      assert.ok(
        contrastRatio(textColor, surface) >= minimumRatio,
        `${themeName} ${token} must stay readable on --bg-surface`,
      );
    }
  }
});

test('prompt cards avoid transform-focused will-change hints during drag so backdrop blur stays attached to the canvas', () => {
  const source = readSource('src/components/canvas/PromptNodeComponent.tsx');

  assert.doesNotMatch(
    source,
    /willChange:\s*isDragging\s*\?\s*'transform,\s*left,\s*top'\s*:\s*'auto'/,
  );
  assert.match(
    source,
    /willChange:\s*isDragging\s*\?\s*'left,\s*top'\s*:\s*'auto'/,
  );
});

test('canvas groups avoid transform-only will-change hints while dragging their frosted shells', () => {
  const source = readSource('src/components/canvas/CanvasGroupComponent.tsx');

  assert.doesNotMatch(
    source,
    /willChange:\s*isDragging\s*\?\s*'transform'\s*:\s*'auto'/,
  );
  assert.match(
    source,
    /willChange:\s*isDragging\s*\?\s*'width,\s*height'\s*:\s*'auto'/,
  );
});

test('canvas groups thicken both shell and label frosted fills while dragging to avoid a washed-out overlay', () => {
  const source = readSource('src/components/canvas/CanvasGroupComponent.tsx');

  assert.match(
    source,
    /const groupGlassFill = highlighted\s*\?\s*'rgba\(99,\s*102,\s*241,\s*0\.10\)'\s*:\s*isDragging\s*\?\s*'rgba\(20,\s*20,\s*24,\s*0\.18\)'\s*:\s*'rgba\(0,\s*0,\s*0,\s*0\.10\)';/,
  );
  assert.match(
    source,
    /const groupHeaderGlassFill = highlighted\s*\?\s*'rgba\(99,\s*102,\s*241,\s*0\.15\)'\s*:\s*isDragging\s*\?\s*'rgba\(20,\s*20,\s*24,\s*0\.62\)'\s*:\s*'rgba\(20,\s*20,\s*24,\s*0\.45\)';/,
  );
  assert.match(source, /backgroundColor:\s*groupGlassFill,/);
  assert.match(source, /backgroundColor:\s*groupHeaderGlassFill,/);
});
