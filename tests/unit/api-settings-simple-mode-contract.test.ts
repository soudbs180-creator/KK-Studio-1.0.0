import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('ApiSettingsView defaults to a simple list mode and gates workbench sections behind advanced mode', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(viewSource, /const \[showAdvancedWorkbench, setShowAdvancedWorkbench\] = useState\(false\);/);
  assert.match(viewSource, /const \[showAdvancedDetails, setShowAdvancedDetails\] = useState\(false\);/);
  assert.match(viewSource, /title=\{pick\('[^']*', 'Model center'\)\}/);
  assert.match(viewSource, /<ApiWorkbenchModelCenterSection/);
  assert.match(viewSource, /By default, routing prefers the available channel with the highest budget or token limit\./);
  assert.match(viewSource, /showAdvancedWorkbench \? pick\('[^']*', 'Hide advanced mode'\) : pick\('[^']*', 'Advanced mode'\)/);
  assert.match(viewSource, /if \(!showAdvancedWorkbench\) return null;/);
  assert.match(viewSource, /\{renderAdvancedPanels\(\)\}/);
  assert.doesNotMatch(
    viewSource,
    /title=\{pick\('[^']*', 'Model center'\)\}[\s\S]*?metrics=\{[\s\S]*?<ApiWorkbenchOverviewSection/,
    'Default model center hero should not render metric cards before the advanced workbench.',
  );
  assert.match(viewSource, /showAdvancedDetails \? pick\('[^']*', 'Hide more advanced items'\) : pick\('[^']*', 'More advanced items'\)/);
  assert.match(viewSource, /const handleToggleDiagnostics = \(\) => \{/);
  assert.match(viewSource, /if \(!showDiagnostics\) \{\s*setShowAdvancedDetails\(true\);/);
  assert.match(viewSource, /onToggleDiagnostics=\{handleToggleDiagnostics\}/);
  assert.match(viewSource, /<ApiWorkbenchOverviewSection/);
  assert.match(viewSource, /<ApiWorkbenchRoutePoolSection/);
  assert.match(viewSource, /<ApiWorkbenchCapabilitySection/);
  assert.match(viewSource, /showAdvancedDetails \? \(/);
  assert.match(viewSource, /<ApiWorkbenchOcrSection/);
});

test('ApiSettingsView simple mode keeps model-center add entries and a unified provider card list', () => {
  const viewSource = readSource('src/components/settings/ApiSettingsView.tsx');
  const sectionsSource = readSource('src/components/settings/apiWorkbenchSections.tsx');

  assert.match(viewSource, /<ApiWorkbenchModelCenterSection/);
  assert.match(sectionsSource, /data-testid="api-simple-provider-add"/);
  assert.match(sectionsSource, /pick\('[^']*', 'Local API'\)/);
  assert.match(viewSource, /presets=\{modelCenterPresets\}/);
  assert.match(sectionsSource, /data-testid="api-proxy-provider-add"/);
  assert.match(viewSource, /modelCenterRoutes[\s\S]*thirdPartyProviders\.map\(\(provider\)/);
  assert.doesNotMatch(viewSource, /min-h-\[132px\]/);
  assert.doesNotMatch(viewSource, /No local APIs yet/);
});
