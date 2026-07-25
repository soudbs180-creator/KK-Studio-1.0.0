import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ApiSettingsView self-wraps with MemoryRouter when mounted outside router context', () => {
  const source = readSource('apps/web/src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /import \{ MemoryRouter, useInRouterContext, useLocation, useNavigate, useParams \} from 'react-router';/);
  assert.match(source, /const ApiSettingsViewInner: React\.FC<\{ initialSupplier\?: Supplier \| null \}> = \(\{ initialSupplier = null \}\) => \{/);
  assert.match(source, /const inRouterContext = useInRouterContext\(\);/);
  assert.match(source, /if \(!inRouterContext\) \{\s*return \(\s*<MemoryRouter initialEntries=\{\[API_MANAGEMENT_HOME_PATH\]\}>[\s\S]*<ApiSettingsViewInner initialSupplier=\{initialSupplier\} \/>[\s\S]*<\/MemoryRouter>\s*\);\s*\}/);
});
