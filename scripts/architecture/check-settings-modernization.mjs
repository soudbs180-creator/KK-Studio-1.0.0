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

// 1. check-settings-single-entry
expectMatch(
  'apps/web/src/components/settings/SettingsWorkbenchPanel.tsx',
  /export const SettingsWorkbenchPanel\b/,
  'SettingsWorkbenchPanel must be declared and exported as the main entry.'
);

// 2. check-no-legacy-settings-panel-entry
function checkImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      checkImports(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
      if (
        relPath === 'apps/web/src/components/settings/SettingsPanel.tsx' ||
        relPath === 'apps/web/src/app/SettingsPageRoot.tsx' ||
        relPath === 'apps/web/src/app/AppGlobalModals.tsx'
      ) {
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("from './SettingsPanel'") || content.includes('from "../settings/SettingsPanel"') || content.includes('from \'../components/settings/SettingsPanel\'')) {
        errors.push(`${relPath} must import SettingsWorkbenchPanel instead of legacy SettingsPanel.`);
      }
    }
  }
}
checkImports(path.join(ROOT_DIR, 'apps/web/src'));

// 3. check-settings-mobile-capability-tree
expectMatch(
  'apps/web/src/components/settings/SettingsWorkbenchShell.tsx',
  /SettingsMobileDashboard\s*onNavigate=\{onNavigate\}/,
  'SettingsMobileShell must render SettingsMobileDashboard for mobile capability tree settings.'
);

// 4. check-root-mode-settings-routing
expectMatch(
  'apps/web/src/context/kkaiRuntimeContext.ts',
  /normalizedPathname === '\/settings' \|\| normalizedPathname\.startsWith\('\/settings\/'\)/,
  'Routing context must map /settings and /settings/* to the settings rootMode.'
);

// 5. check-workspace-new-shell-required
expectMatch(
  'apps/web/src/pages/Workspace/WorkspacePage.tsx',
  /TaskCenterTray/,
  'WorkspacePage must render the new architecture TaskCenterTray.'
);

// 6. check-ui-migration-version
expectMatch(
  'apps/web/src/context/AppearanceMotionContext.tsx',
  /APPEARANCE_MOTION_STORAGE_KEY\s*=\s*'kk_appearance_motion_preferences_v1'/,
  'LocalStorage UI migration key must exist and match preferences v1.'
);

// 7. check-no-legacy-settings-copy-visible
expectNoMatch(
  'apps/web/src/components/settings/settingsRegistry.ts',
  /四个核心入口/,
  'Legacy settings copy "四个核心入口" must not be present.'
);

if (errors.length > 0) {
  console.error('[Settings Modernization Check] Failed.');
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log('[Settings Modernization Check] Passed.');
