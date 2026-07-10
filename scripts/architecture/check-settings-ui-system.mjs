import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

const errors = [];

function readSource(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`${relativePath} is missing.`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function expectMatch(relativePath, pattern, message) {
  const source = readSource(relativePath);
  if (source && !pattern.test(source)) {
    errors.push(`${relativePath}: ${message}`);
  }
}

function expectNoMatch(relativePath, pattern, message) {
  const source = readSource(relativePath);
  if (source && pattern.test(source)) {
    errors.push(`${relativePath}: ${message}`);
  }
}

expectMatch(
  'packages/ui/src/core/tokens.ts',
  /export const UI_SYSTEM_TOKENS[\s\S]*breakpoints:[\s\S]*phoneSmall:\s*375[\s\S]*desktopLarge:\s*1440[\s\S]*touchTargetMin:\s*"44px"/,
  'UI system tokens must keep responsive breakpoints and the 44px touch target floor.',
);

expectMatch(
  'packages/ui/src/core/tokens.ts',
  /uiSystem:\s*UI_SYSTEM_TOKENS/,
  'TOKENS must expose UI_SYSTEM_TOKENS through uiSystem.',
);

expectMatch(
  'apps/web/src/components/settings/SettingsScaffold.tsx',
  /SETTINGS_UI_SYSTEM[\s\S]*SettingsSystemCard[\s\S]*SettingsSystemField/,
  'Settings scaffold must expose shared UI system primitives.',
);

expectMatch(
  'apps/web/src/styles/settings.css',
  /\.settings-system-page[\s\S]*\.settings-system-card[\s\S]*\.settings-system-field[\s\S]*@media \(min-width:\s*768px\)[\s\S]*@media \(min-width:\s*1024px\)/,
  'settings.css must keep the responsive settings-system class contract.',
);

expectMatch(
  'apps/web/src/context/AppearanceMotionContext.tsx',
  /APPEARANCE_MOTION_STORAGE_KEY\s*=\s*'kk_appearance_motion_preferences_v1'[\s\S]*--kk-ui-glass-opacity[\s\S]*--kk-ui-glass-blur[\s\S]*--kk-ui-motion-scale/,
  'appearance and motion preferences must persist and apply document CSS variables.',
);

expectMatch(
  'apps/web/src/components/settings/settingsRegistry.ts',
  /'appearance-motion'[\s\S]*titleZh:\s*'高级性能设置'[\s\S]*id:\s*'appearance-motion'[\s\S]*labelZh:\s*'高级性能'/,
  'appearance-motion must remain the canonical advanced-performance registry entry.',
);

expectMatch(
  'apps/web/src/components/settings/settingsRouteConfig.tsx',
  /AppearanceMotionView[\s\S]*kind:\s*'appearance-motion'/,
  'appearance-motion must remain wired into the settings route factory.',
);

expectMatch(
  'apps/web/src/components/settings/views/AppearanceMotionView.tsx',
  /SettingsSystemCard[\s\S]*SettingsSystemField[\s\S]*SETTINGS_RESPONSIVE_GRID_CLASSNAME[\s\S]*useAppearanceMotion/,
  'appearance-motion view must consume shared settings primitives and the appearance context.',
);

expectNoMatch(
  'apps/web/src/components/settings/views/AppearanceMotionView.tsx',
  /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/,
  'appearance-motion view must not introduce raw color literals.',
);

if (errors.length > 0) {
  console.error('[Settings UI System Check] Failed.');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('[Settings UI System Check] Passed.');
