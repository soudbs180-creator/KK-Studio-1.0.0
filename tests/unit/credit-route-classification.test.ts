import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { resolveModelExecutionLane } from '../../src/services/model/modelExecutionLane.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

describe('credit route classification', () => {
  test('classifies system credit models into the cloud execution lane only when the model route is system-owned', () => {
    assert.equal(
      resolveModelExecutionLane({
        modelId: 'gemini-3.1-flash-image-preview@system',
        isCreditModel: true,
      }),
      'cloud-credit-model',
    );

    assert.equal(
      resolveModelExecutionLane({
        modelId: 'gemini-3.1-flash-image-preview',
        isCreditModel: true,
      }),
      'local-user-api',
    );

    assert.equal(
      resolveModelExecutionLane({
        modelId: 'gemini-3.1-flash-image-preview',
        isCreditModel: false,
      }),
      'local-user-api',
    );
  });

  test('frontend generation flow persists execution-lane and credit spec markers on prompt nodes', () => {
    const appSource = readSource('src/App.tsx');
    const generationRuntimeSource = readSource('src/app/useGenerationRuntime.ts');
    const resolveBillingStateSource = readSource('src/app/resolveGenerationBillingState.ts');
    const geminiServiceSource = readSource('src/services/llm/geminiService.ts');
    const llmAdapterSource = readSource('src/services/llm/LLMAdapter.ts');
    const llmServiceSource = readSource('src/services/llm/LLMService.ts');
    const secureProxySource = readSource('src/services/model/secureModelProxy.ts');
    const typesSource = readSource('src/types.ts');
    const adminModelServiceSource = readSource('src/services/model/adminModelService.ts');

    assert.match(appSource, /import \{ resolveGenerationBillingState \} from '\.\/app\/resolveGenerationBillingState';/);
    assert.match(appSource, /const generationBillingState = resolveGenerationBillingState\(/);
    assert.match(resolveBillingStateSource, /import \{ type ModelExecutionLane, resolveModelExecutionLane \} from '\.\.\/services\/model\/modelExecutionLane';/);
    assert.match(resolveBillingStateSource, /const executionLane = resolveModelExecutionLane\(/);
    assert.match(appSource, /executionLane,/);
    assert.match(generationRuntimeSource, /executionLane: params\.generationBillingState\.executionLane,/);
    assert.match(appSource, /const executionLane = billingAttemptContext\.executionLane;/);
    assert.match(appSource, /creditRouteSpecId: resolvedCreditSpecId,/);
    assert.match(appSource, /creditRouteUnitId: resolvedCreditRoute\?\.routeUnitId,/);
    assert.match(geminiServiceSource, /executionLane: options\?\.executionLane,/);
    assert.match(geminiServiceSource, /creditRouteSpecId: options\?\.creditRouteSpecId,/);
    assert.match(geminiServiceSource, /creditRouteUnitId: options\?\.creditRouteUnitId,/);
    assert.match(llmAdapterSource, /executionLane\?: 'local-user-api' \| 'cloud-credit-model';/);
    assert.match(llmAdapterSource, /creditRouteSpecId\?: string;/);
    assert.match(llmAdapterSource, /creditRouteUnitId\?: string;/);
    assert.match(llmServiceSource, /creditRouteSpecId: options\.creditRouteSpecId,/);
    assert.match(llmServiceSource, /creditRouteUnitId: options\.creditRouteUnitId,/);
    assert.match(secureProxySource, /creditRouteSpecId\?: string;/);
    assert.match(secureProxySource, /creditRouteUnitId\?: string;/);
    assert.match(typesSource, /executionLane\?: 'local-user-api' \| 'cloud-credit-model';/);
    assert.match(typesSource, /creditRouteSpecId\?: string;/);
    assert.match(typesSource, /creditRouteUnitId\?: string;/);
    assert.match(adminModelServiceSource, /getCreditModelSpec\(/);
    assert.match(adminModelServiceSource, /getCreditRouteSnapshot\(/);
  });
});
