import assert from 'node:assert/strict';
import test from 'node:test';

test('completed generation item records stable asset metadata and reference lineage', async () => {
  const module = await import('../../services/api/lib/generation-v3/jobLifecycle.js');
  const { completeItem } = module.default || module;
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const client = {
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      if (text.includes('SELECT * FROM public.generation_job_items')) {
        return {
          rows: [{
            item_id: '550e8400-e29b-41d4-a716-446655440010',
            status: 'submitted',
            reservation_id: null,
            payload_json: { referenceAssetIds: ['source-asset-1', 'source-asset-2'] },
          }],
        };
      }
      return { rows: [] };
    },
  };

  await completeItem(
    'user-1',
    '550e8400-e29b-41d4-a716-446655440010',
    'https://assets.example.test/generated.png',
    { client },
  );

  const update = calls.find(({ text }) => text.includes('UPDATE public.generation_job_items SET'));
  assert.ok(update);
  const outputValue = update.values.find((value) => typeof value === 'string' && value.includes('assetRecordId'));
  assert.equal(typeof outputValue, 'string');
  const output = JSON.parse(String(outputValue));
  assert.match(output.assetRecordId, /^[0-9a-f-]{36}$/);
  assert.equal(output.assetUrl, 'https://assets.example.test/generated.png');
  assert.equal(update.values.includes('https://assets.example.test/generated.png'), true);
  assert.equal(calls.filter(({ text }) => text.includes('INSERT INTO public.asset_lineage_relations')).length, 2);
  assert.ok(calls.some(({ text }) => text.includes("set_config('app.current_user_id'")));
});
