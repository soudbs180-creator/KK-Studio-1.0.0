import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();
const MIN_NORMAL_TEXT_CONTRAST = 4.5;

type RgbaColor = { r: number; g: number; b: number; a: number };



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

function extractCanonicalRootVariables(source: string): Record<string, string> {
  const rootBlocks = [...source.matchAll(/(?:^|\n):root\s*\{([\s\S]*?)\}/g)].map((match) => match[1]);
  let clayRoot: string | undefined;
  for (let index = rootBlocks.length - 1; index >= 0; index -= 1) {
    if (rootBlocks[index].includes('--clay-canvas')) {
      clayRoot = rootBlocks[index];
      break;
    }
  }
  assert.ok(clayRoot, 'Missing canonical Clay root variables');
  return extractCssVariables(clayRoot);
}

function extractThemeVariables(
  source: string,
  selector: string,
  occurrence: 'first' | 'last' = 'last',
): Record<string, string> {
  return {
    ...extractCanonicalRootVariables(source),
    ...extractCssVariables(extractCssBlock(source, selector, occurrence)),
  };
}

function assertNeutralDarkColor(value: string, variables: Record<string, string>, label: string): void {
  const color = parseCssColor(value, variables);
  assert.ok(Math.abs(color.r - color.g) <= 2, `${label} must stay neutral black-gray; got r/g ${color.r}/${color.g}`);
  assert.ok(Math.abs(color.g - color.b) <= 2, `${label} must stay neutral black-gray; got g/b ${color.g}/${color.b}`);
  assert.ok(color.r >= 8 && color.r <= 36, `${label} must remain in the controlled dark-gray range; got ${color.r}`);
}

function extractRuleProperty(source: string, selector: string, property: string): string {
  const block = extractCssBlock(source, selector);
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escapedProperty}:\\s*([^;]+);`));
  assert.ok(match, `Missing ${property} in ${selector}`);
  return match[1].trim();
}

test('shared app and settings theme surfaces keep normal text contrast', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const themeCases = [
    {
      name: 'global light',
      variables: extractThemeVariables(cssSource, 'body:not(.dark-mode)'),
      baseBackground: '#ffffff',
      surfaces: ['--bg-surface', '--bg-elevated', '--bg-overlay', '--bg-input', '--toolbar-bg', '--toolbar-bg-dark'],
      textTokens: ['--text-primary', '--text-secondary', '--text-tertiary'],
    },
    {
      name: 'global dark',
      variables: extractThemeVariables(cssSource, 'body.dark-mode'),
      baseBackground: '#000000',
      surfaces: ['--bg-surface', '--bg-elevated', '--bg-overlay', '--bg-input', '--toolbar-bg', '--toolbar-bg-dark'],
      textTokens: ['--text-primary', '--text-secondary', '--text-tertiary'],
    },
    {
      name: 'settings light',
      variables: extractThemeVariables(cssSource, '.settings-panel'),
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
      variables: extractThemeVariables(cssSource, 'body.dark-mode .settings-panel'),
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

test('light Clay emphasis text remains readable on tinted frosted states', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const light = extractThemeVariables(cssSource, 'body:not(.dark-mode)');
  const settingsLight = extractThemeVariables(cssSource, '.settings-panel');
  const lightBase = '#ffffff';

  for (const [textToken, surfaceToken] of [
    ['--state-info-text', '--state-info-bg'],
    ['--search-palette-accent', '--search-palette-selected-bg'],
    ['--mobile-clay-stage-info-text', '--mobile-clay-stage-info-bg'],
    ['--accent-blue', '--selected-bg'],
  ] as const) {
    const contrast = contrastRatio(light[textToken], light[surfaceToken], light, lightBase);
    assert.ok(
      contrast >= MIN_NORMAL_TEXT_CONTRAST,
      `light ${textToken} must stay readable on ${surfaceToken}; got ${contrast.toFixed(2)}`,
    );
  }

  const settingsInfoContrast = contrastRatio(
    settingsLight['--settings-state-info-text'],
    settingsLight['--settings-state-info-bg'],
    settingsLight,
    lightBase,
  );
  assert.ok(
    settingsInfoContrast >= MIN_NORMAL_TEXT_CONTRAST,
    `settings light --settings-state-info-text must stay readable; got ${settingsInfoContrast.toFixed(2)}`,
  );
});

test('Clay theme tokens expose distinct readable light and dark surfaces', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const root = extractCanonicalRootVariables(cssSource);
  const light = extractThemeVariables(cssSource, 'body:not(.dark-mode)');
  const dark = extractThemeVariables(cssSource, 'body.dark-mode');
  const settingsLight = extractThemeVariables(cssSource, '.settings-panel');
  const settingsDark = extractThemeVariables(cssSource, 'body.dark-mode .settings-panel');

  assert.ok(root['--clay-canvas'] === '#fffaf0' || root['--clay-canvas'] === '#ffffff');
  assert.equal(root['--clay-ink'], '#0a0a0a');
  assert.equal(root['--clay-body'], '#3a3a3a');
  assert.equal(root['--clay-muted'], '#6a6a6a');
  assert.equal(root['--clay-brand-coral'], '#ff6b5a');
  assert.equal(light['--bg-canvas'], 'var(--clay-canvas)');
  assert.equal(light['--text-primary'], 'var(--clay-ink)');
  assert.equal(root['--clay-dark-canvas'], '#0b0b0c');
  assert.equal(root['--clay-dark-surface'], '#141414');
  assert.equal(root['--clay-dark-elevated'], '#1f1f1f');
  assert.equal(dark['--bg-canvas'], 'var(--clay-dark-canvas)');
  assert.equal(dark['--text-primary'], '#fffaf0');
  assert.equal(settingsLight['--settings-page-bg'], 'var(--clay-canvas)');
  assert.equal(settingsDark['--settings-page-bg'], 'var(--clay-dark-canvas)');

  for (const token of ['--clay-dark-canvas', '--clay-dark-surface', '--clay-dark-elevated']) {
    assertNeutralDarkColor(root[token], root, token);
  }
});

test('dark theme surface aliases stay neutral and old blue-black settings tokens do not return', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const dark = extractThemeVariables(cssSource, 'body.dark-mode');
  const settingsDark = extractThemeVariables(cssSource, 'body.dark-mode .settings-panel');

  const expectedDarkAliases: Record<string, string> = {
    '--bg-base': 'var(--clay-dark-canvas)',
    '--bg-surface': 'var(--clay-dark-surface)',
    '--bg-elevated': 'var(--clay-dark-elevated)',
    '--bg-overlay': 'var(--clay-dark-elevated)',
    '--bg-input': 'var(--frost-input-bg)',
    '--bg-canvas': 'var(--clay-dark-canvas)',
    '--toolbar-bg': 'var(--clay-dark-surface)',
    '--toolbar-bg-dark': 'var(--clay-dark-elevated)',
  };

  for (const [token, expected] of Object.entries(expectedDarkAliases)) {
    assert.equal(dark[token], expected, `${token} must resolve through the neutral Clay dark stack`);
  }

  const expectedSettingsDarkAliases: Record<string, string> = {
    '--settings-page-bg': 'var(--clay-dark-canvas)',
    '--settings-canvas-bg': 'var(--clay-dark-canvas)',
    '--settings-section-bg': 'var(--frost-card-main-bg)',
    '--settings-surface-elevated': 'var(--frost-card-main-bg)',
    '--settings-surface-overlay': 'var(--frost-card-sub-bg)',
    '--settings-surface-muted': 'var(--frost-card-sub-bg)',
    '--settings-input-bg': 'var(--frost-input-bg)',
    '--settings-button-secondary-bg': 'var(--frost-card-sub-bg)',
    '--settings-nav-glass-bg': 'var(--frost-card-framework-bg)',
  };

  for (const [token, expected] of Object.entries(expectedSettingsDarkAliases)) {
    assert.equal(settingsDark[token], expected, `${token} must use the shared frosted neutral dark surface`);
  }

  assert.doesNotMatch(cssSource, /--bg-canvas:\s*#0b0f16;/i);
  assert.doesNotMatch(cssSource, /--settings-page-bg:\s*#151b23;/i);
  assert.doesNotMatch(cssSource, /--settings-section-bg:\s*#1d2530;/i);
  assert.doesNotMatch(cssSource, /--settings-surface-elevated:\s*#2a3441;/i);
  assert.doesNotMatch(cssSource, /--settings-accent-rgb:\s*10 132 255;/i);
});

test('settings navigation glass keeps all sidebar text readable', () => {
  const cssSource = readSource('apps/web/src/index.css');
  const themeCases = [
    {
      name: 'settings light nav',
      variables: extractThemeVariables(cssSource, '.settings-panel'),
      baseBackground: '#ffffff',
    },
    {
      name: 'settings dark nav',
      variables: extractThemeVariables(cssSource, 'body.dark-mode .settings-panel'),
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
  const authCssSource = readSource('apps/web/src/components/auth/LoginScreen.css');
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
