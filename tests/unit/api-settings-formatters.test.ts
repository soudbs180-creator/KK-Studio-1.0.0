import assert from 'node:assert/strict';
import { test } from 'node:test';

async function loadFormatterModule() {
  return await import('../../apps/web/src/components/settings/apiSettingsFormatters.ts');
}

test('apiSettingsFormatters formats currency and token values for settings summaries', async () => {
  const { formatTokens, formatUsd } = await loadFormatterModule();

  assert.equal(formatUsd(12.3), '$12.30');
  assert.equal(formatUsd(0), '$0.00');
  assert.equal(formatTokens(10_000), '1万 词元');
});

test('apiSettingsFormatters handles invalid and valid date values', async () => {
  const { formatDateTime } = await loadFormatterModule();
  const validDate = new Date(2026, 5, 9, 12, 34);
  const expectedValidLabel = validDate.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  assert.equal(formatDateTime(null), '暂无记录');
  assert.equal(formatDateTime(''), '暂无记录');
  assert.equal(formatDateTime('not-a-date'), '暂无记录');
  assert.equal(formatDateTime(validDate.getTime()), expectedValidLabel);
});

test('apiSettingsFormatters formats latency tiers from empty to seconds', async () => {
  const { formatLatency } = await loadFormatterModule();

  assert.equal(formatLatency(null), '暂无');
  assert.equal(formatLatency(0), '暂无');
  assert.equal(formatLatency(125), '125ms');
  assert.equal(formatLatency(1500), '1.5s');
  assert.equal(formatLatency(10_000), '10s');
});

test('apiSettingsFormatters strips URL protocols and trailing slashes for domain labels', async () => {
  const { extractDomain } = await loadFormatterModule();

  assert.equal(extractDomain(''), '未填写基础地址');
  assert.equal(extractDomain('   '), '未填写基础地址');
  assert.equal(extractDomain('https://api.openai.com/v1/'), 'api.openai.com/v1');
  assert.equal(extractDomain('http://localhost:3000//'), 'localhost:3000');
  assert.equal(extractDomain('api.example.com/'), 'api.example.com');
});

test('apiSettingsFormatters keeps budget mode options round-trippable with legacy token wording', async () => {
  const { UI_BUDGET_OPTIONS, getModeLabel, getModeOption, parseModeOption } = await loadFormatterModule();

  assert.deepEqual([...UI_BUDGET_OPTIONS], ['不限额', '金额预算', '词元上限']);
  assert.equal(getModeLabel('unlimited'), '不限额');
  assert.equal(getModeLabel('amount'), '金额预算');
  assert.equal(getModeLabel('tokens'), '词元上限');
  assert.equal(parseModeOption(getModeOption('unlimited')), 'unlimited');
  assert.equal(parseModeOption(getModeOption('amount')), 'amount');
  assert.equal(parseModeOption(getModeOption('tokens')), 'tokens');
  assert.equal(getModeOption('tokens'), '词元上限');
  assert.equal(parseModeOption('令牌上限'), 'tokens');
});

test('apiSettingsFormatters preserves API protocol and official provider labels', async () => {
  const { getOfficialProviderLabel, getProtocolLabel } = await loadFormatterModule();

  assert.equal(getProtocolLabel('openai'), 'OpenAI 协议');
  assert.equal(getProtocolLabel('gemini'), 'Gemini 协议');
  assert.equal(getProtocolLabel('claude'), 'Claude 协议');
  assert.equal(getProtocolLabel('auto'), '自动识别');
  assert.equal(getOfficialProviderLabel('Google'), '谷歌官方接口');
  assert.equal(getOfficialProviderLabel('OpenAI'), 'OpenAI 官方接口');
});

test('apiSettingsFormatters masks blank, short, redacted, and long secrets consistently', async () => {
  const { maskSecretDisplay } = await loadFormatterModule();

  assert.equal(maskSecretDisplay('   '), '尚未填写');
  assert.equal(maskSecretDisplay('1234567890'), '已填写');
  assert.equal(maskSecretDisplay('__kk_redacted__:secret'), '••••••••••••');
  assert.equal(maskSecretDisplay('sk-readonly-0000'), '••••••••••••');
  assert.equal(maskSecretDisplay('sk-live-abcdef123456'), 'sk-liv••••3456');
});
