import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

type ApiProviderPresetsModule = typeof import('../../apps/web/src/components/settings/apiProviderPresets.ts');

let hasInstalledTypeScriptResolver = false;

function installTypeScriptExtensionResolver(): void {
  if (hasInstalledTypeScriptResolver) return;
  hasInstalledTypeScriptResolver = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (
        context.parentURL?.startsWith('file:')
        && (specifier.startsWith('./') || specifier.startsWith('../'))
        && path.extname(specifier) === ''
      ) {
        const parentDirectory = path.dirname(fileURLToPath(context.parentURL));

        for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
          const candidatePath = path.resolve(parentDirectory, `${specifier}${extension}`);

          if (existsSync(candidatePath)) {
            return {
              shortCircuit: true,
              url: pathToFileURL(candidatePath).href,
            };
          }
        }
      }

      return nextResolve(specifier, context);
    },
  });
}

async function loadApiProviderPresets(): Promise<ApiProviderPresetsModule> {
  installTypeScriptExtensionResolver();
  return await import('../../apps/web/src/components/settings/apiProviderPresets.ts') as ApiProviderPresetsModule;
}

test('api provider presets include official and relay presets used by the model center', async () => {
  const { PROVIDER_PRESETS } = await loadApiProviderPresets();

  assert.ok(
    PROVIDER_PRESETS.some((preset) => preset.kind === 'official'),
    'Expected at least one official provider preset.',
  );
  assert.ok(
    PROVIDER_PRESETS.some((preset) => preset.kind === 'relay'),
    'Expected at least one relay provider preset.',
  );

  const openAiPreset = PROVIDER_PRESETS.find((preset) => preset.name === 'OpenAI');
  assert.equal(openAiPreset?.kind, 'official');
  assert.equal(openAiPreset?.baseUrl, 'https://api.openai.com/v1');
  assert.equal(openAiPreset?.format, 'openai');

  const wuyinPreset = PROVIDER_PRESETS.find((preset) => preset.name === '速创 API');
  assert.equal(wuyinPreset?.kind, 'relay');
  assert.equal(wuyinPreset?.baseUrl, 'https://api.wuyinkeji.com');
  assert.equal(wuyinPreset?.format, 'openai');
});

test('findProviderPresetForDraft matches normalized names and base URLs', async () => {
  const { findProviderPresetForDraft } = await loadApiProviderPresets();

  assert.equal(
    findProviderPresetForDraft('  openai  ', '')?.name,
    'OpenAI',
    'Expected names to be trimmed and case-insensitive.',
  );
  assert.equal(
    findProviderPresetForDraft('', ' HTTPS://API.OPENAI.COM/V1/// ')?.name,
    'OpenAI',
    'Expected base URLs to be trimmed, case-insensitive, and trailing-slash-insensitive.',
  );
  assert.equal(
    findProviderPresetForDraft('unknown provider', ' https://api.wuyinkeji.com/// ')?.name,
    '速创 API',
    'Expected normalized base URL matching to work independently from the draft name.',
  );
});

test('getProviderPresetLinks returns explicit links, website fallback, and filters blanks', async () => {
  const { PROVIDER_PRESETS, getProviderPresetLinks } = await loadApiProviderPresets();
  const openAiPreset = PROVIDER_PRESETS.find((preset) => preset.name === 'OpenAI');
  const worldRouterPreset = PROVIDER_PRESETS.find((preset) => preset.name === 'WorldRouter');

  assert.ok(openAiPreset, 'OpenAI preset should exist.');
  assert.deepEqual(getProviderPresetLinks(openAiPreset), openAiPreset.keyLinks);

  assert.ok(worldRouterPreset, 'WorldRouter preset should exist.');
  assert.deepEqual(getProviderPresetLinks(worldRouterPreset), [{
    labelZh: '打开官网',
    labelEn: 'Open website',
    url: 'https://www.worldrouter.ai',
  }]);

  assert.deepEqual(
    getProviderPresetLinks({
      ...openAiPreset,
      keyLinks: [
        { labelZh: '空链接', labelEn: 'Blank link', url: '   ' },
        { labelZh: '有效链接', labelEn: 'Valid link', url: 'https://example.test/key' },
      ],
    }),
    [{ labelZh: '有效链接', labelEn: 'Valid link', url: 'https://example.test/key' }],
  );
  assert.deepEqual(getProviderPresetLinks(null), []);
});

test('toProviderFormFromPreset resets sensitive and user-edited fields while preserving preset identity', async () => {
  const { PROVIDER_PRESETS, toProviderFormFromPreset } = await loadApiProviderPresets();
  const openAiPreset = PROVIDER_PRESETS.find((preset) => preset.name === 'OpenAI');

  assert.ok(openAiPreset, 'OpenAI preset should exist.');

  const draft = toProviderFormFromPreset(openAiPreset);

  assert.equal(draft.name, openAiPreset.name);
  assert.equal(draft.baseUrl, openAiPreset.baseUrl);
  assert.equal(draft.format, openAiPreset.format);
  assert.equal(draft.color, openAiPreset.color);
  assert.equal(draft.apiKey, '');
  assert.equal(draft.apiKeyPreview, '');
  assert.equal(draft.modelsText, '');
  assert.equal(draft.group, '');
  assert.equal(draft.mode, 'unlimited');
  assert.equal(draft.value, '');
  assert.equal(draft.isActive, true);
});
