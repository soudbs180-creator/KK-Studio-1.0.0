import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ApiSettingsView defaults to a simple list mode and gates workbench sections behind advanced mode', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(viewSource, /const \[showAdvancedWorkbench, setShowAdvancedWorkbench\] = useState\(false\);/);
  assert.match(viewSource, /const \[showAdvancedDetails, setShowAdvancedDetails\] = useState\(false\);/);
  assert.match(viewSource, /title=\{pick\('API 配置', 'API setup'\)\}/);
  assert.match(viewSource, /默认只显示添加入口和已配置供应商。/);
  assert.match(viewSource, /The default view shows only add actions and configured provider cards\./);
  assert.match(viewSource, /showAdvancedWorkbench \? pick\('收起高级模式', 'Hide advanced mode'\) : pick\('高级模式', 'Advanced mode'\)/);
  assert.match(viewSource, /showAdvancedWorkbench \? \(/);
  assert.doesNotMatch(
    viewSource,
    /title=\{pick\('API 配置', 'API setup'\)\}[\s\S]*?metrics=\{[\s\S]*?<ApiWorkbenchOverviewSection/,
    'Default API setup hero should not render metric cards before the advanced workbench.',
  );
  assert.match(viewSource, /showAdvancedDetails \? pick\('收起更多高级项', 'Hide more advanced items'\) : pick\('更多高级项', 'More advanced items'\)/);
  assert.match(viewSource, /const handleToggleDiagnostics = \(\) => \{/);
  assert.match(viewSource, /if \(!showDiagnostics\) \{\s*setShowAdvancedDetails\(true\);/);
  assert.match(viewSource, /onToggleDiagnostics=\{handleToggleDiagnostics\}/);
  assert.match(viewSource, /<ApiWorkbenchOverviewSection/);
  assert.match(viewSource, /<ApiWorkbenchRoutePoolSection/);
  assert.match(viewSource, /<ApiWorkbenchCapabilitySection/);
  assert.match(viewSource, /showAdvancedDetails \? \(/);
  assert.match(viewSource, /<ApiWorkbenchOcrSection/);
});

test('ApiSettingsView simple mode keeps one compact add entry and a unified provider card list', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(viewSource, /const showSimpleProviderList = !showAdvancedWorkbench;/);
  assert.match(viewSource, /data-testid="api-simple-provider-add"/);
  assert.match(viewSource, /pick\('添加 API', 'Add API'\)/);
  assert.match(viewSource, /Official routes use built-in URLs\. Proxy providers need a name, request URL, and API key\./);
  assert.match(viewSource, /data-testid="api-proxy-provider-add"/);
  assert.match(viewSource, /showSimpleProviderList[\s\S]*thirdPartyProviders\.map\(\(provider\)/);
  assert.doesNotMatch(viewSource, /min-h-\[132px\]/);
  assert.doesNotMatch(viewSource, /No local APIs yet/);
});
