import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();
const MIN_NORMAL_TEXT_CONTRAST = 4.5;

type RgbaColor = { r: number; g: number; b: number; a: number };

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function parseCssColor(value: string, variables: Record<string, string> = {}): RgbaColor {
  const color = value.trim().replace(/\s*!important$/, '');
  const variableMatch = color.match(/^var\((--[^),]+)(?:,[^)]+)?\)$/);

  if (variableMatch) {
    const resolved = variables[variableMatch[1]];
    assert.ok(resolved, `Missing CSS variable ${variableMatch[1]}`);
    return parseCssColor(resolved, variables);
  }

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

  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(rgbMatch, `Unsupported CSS color: ${value}`);

  const rawParts = rgbMatch[1].trim();
  if (rawParts.includes('/')) {
    const [channels, alpha] = rawParts.split('/').map((part) => part.trim());
    const [r, g, b] = channels.split(/\s+/).map(Number);
    return { r, g, b, a: Number(alpha) };
  }

  const [r, g, b, alpha] = rawParts.split(',').map((part) => part.trim());
  return {
    r: Number(r),
    g: Number(g),
    b: Number(b),
    a: alpha === undefined ? 1 : Number(alpha),
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

function contrastRatio(
  foregroundValue: string,
  backgroundValue: string,
  variables: Record<string, string> = {},
  baseBackgroundValue?: string,
): number {
  const baseBackground = baseBackgroundValue ? parseCssColor(baseBackgroundValue, variables) : undefined;
  const rawBackground = parseCssColor(backgroundValue, variables);
  const background = rawBackground.a < 1 && baseBackground
    ? compositeColor(rawBackground, baseBackground)
    : rawBackground;
  const rawForeground = parseCssColor(foregroundValue, variables);
  const foreground = rawForeground.a < 1 ? compositeColor(rawForeground, background) : rawForeground;
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function extractCssBlock(source: string, selector: string, occurrence: 'first' | 'last' = 'last'): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...source.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'g'))];
  assert.ok(matches.length > 0, `Missing CSS block for ${selector}`);
  return (occurrence === 'first' ? matches[0] : matches[matches.length - 1])[1];
}

function extractCssVariables(block: string): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    variables[match[1]] = match[2].trim();
  }
  return variables;
}

function extractRuleProperty(source: string, selector: string, property: string): string {
  const block = extractCssBlock(source, selector);
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escapedProperty}:\\s*([^;]+);`));
  assert.ok(match, `Missing ${property} in ${selector}`);
  return match[1].trim();
}

test('shared app and settings theme surfaces keep normal text contrast', () => {
  const cssSource = readSource('src/index.css');
  const themeCases = [
    {
      name: 'global light',
      variables: extractCssVariables(extractCssBlock(cssSource, 'body:not(.dark-mode)')),
      baseBackground: '#ffffff',
      surfaces: ['--bg-surface', '--bg-elevated', '--bg-overlay', '--bg-input', '--toolbar-bg', '--toolbar-bg-dark'],
      textTokens: ['--text-primary', '--text-secondary', '--text-tertiary'],
    },
    {
      name: 'global dark',
      variables: extractCssVariables(extractCssBlock(cssSource, 'body.dark-mode', 'first')),
      baseBackground: '#000000',
      surfaces: ['--bg-surface', '--bg-elevated', '--bg-overlay', '--bg-input', '--toolbar-bg', '--toolbar-bg-dark'],
      textTokens: ['--text-primary', '--text-secondary', '--text-tertiary'],
    },
    {
      name: 'settings light',
      variables: extractCssVariables(extractCssBlock(cssSource, '.settings-panel')),
      baseBackground: '#ffffff',
      surfaces: [
        '--settings-section-bg',
        '--settings-surface-elevated',
        '--settings-surface-overlay',
        '--settings-input-bg',
        '--settings-button-secondary-bg',
      ],
      textTokens: ['--text-primary', '--text-secondary', '--text-tertiary'],
    },
    {
      name: 'settings dark',
      variables: extractCssVariables(extractCssBlock(cssSource, 'body.dark-mode .settings-panel')),
      baseBackground: '#000000',
      surfaces: [
        '--settings-section-bg',
        '--settings-surface-elevated',
        '--settings-surface-overlay',
        '--settings-input-bg',
        '--settings-button-secondary-bg',
        '--settings-chart-bg',
      ],
      textTokens: ['--text-primary', '--text-secondary', '--text-tertiary'],
    },
  ];

  for (const themeCase of themeCases) {
    for (const surfaceToken of themeCase.surfaces) {
      for (const textToken of themeCase.textTokens) {
        const contrast = contrastRatio(
          themeCase.variables[textToken],
          themeCase.variables[surfaceToken],
          themeCase.variables,
          themeCase.baseBackground,
        );
        assert.ok(
          contrast >= MIN_NORMAL_TEXT_CONTRAST,
          `${themeCase.name} ${textToken} must stay readable on ${surfaceToken}; got ${contrast.toFixed(2)}`,
        );
      }
    }
  }
});

test('settings navigation glass keeps all sidebar text readable', () => {
  const cssSource = readSource('src/index.css');
  const themeCases = [
    {
      name: 'settings light nav',
      variables: extractCssVariables(extractCssBlock(cssSource, '.settings-panel')),
      baseBackground: '#ffffff',
    },
    {
      name: 'settings dark nav',
      variables: extractCssVariables(extractCssBlock(cssSource, 'body.dark-mode .settings-panel')),
      baseBackground: '#000000',
    },
  ];

  for (const themeCase of themeCases) {
    for (const textToken of [
      '--settings-nav-text-primary',
      '--settings-nav-text-secondary',
      '--settings-nav-text-tertiary',
    ]) {
      const contrast = contrastRatio(
        themeCase.variables[textToken],
        themeCase.variables['--settings-nav-glass-bg'],
        themeCase.variables,
        themeCase.baseBackground,
      );
      assert.ok(
        contrast >= MIN_NORMAL_TEXT_CONTRAST,
        `${themeCase.name} ${textToken} must stay readable on --settings-nav-glass-bg; got ${contrast.toFixed(2)}`,
      );
    }
  }
});

test('light auth support text and placeholders stay readable', () => {
  const authCssSource = readSource('src/components/auth/LoginScreen.css');
  const whiteSurface = '#ffffff';

  for (const selector of [
    '.auth-page--light .auth-field-help',
    '.auth-page--light .auth-input-wrap input::placeholder',
  ]) {
    const color = extractRuleProperty(authCssSource, selector, 'color');
    const contrast = contrastRatio(color, whiteSurface);

    assert.ok(
      contrast >= MIN_NORMAL_TEXT_CONTRAST,
      `${selector} must stay readable on light auth surfaces; got ${contrast.toFixed(2)}`,
    );
  }
});
