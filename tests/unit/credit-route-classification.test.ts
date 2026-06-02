import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { resolveModelExecutionLane } from '../../apps/web/src/services/model/modelExecutionLane.ts';

const ROOT_DIR = process.cwd();



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
    const appSource = readSource('apps/web/src/App.tsx');
    const generationRuntimeSource = readSource('apps/web/src/app/useGenerationRuntime.ts');
    const resolveBillingStateSource = readSource('apps/web/src/app/resolveGenerationBillingState.ts');
    const geminiServiceSource = readSource('apps/web/src/services/llm/geminiService.ts');
    const llmAdapterSource = readSource('apps/web/src/services/llm/LLMAdapter.ts');
    const llmServiceSource = readSource('apps/web/src/services/llm/LLMService.ts');
    const secureProxySource = readSource('apps/web/src/services/model/secureModelProxy.ts');
    const typesSource = readSource('apps/web/src/types.ts');
    const adminModelServiceSource = readSource('apps/web/src/services/model/adminModelService.ts');

    assert.match(generationRuntimeSource, /import \{ resolveGenerationBillingState \} from '\.\/resolveGenerationBillingState';/);
    assert.match(generationRuntimeSource, /const generationBillingState = resolveGenerationBillingState\(/);
    assert.match(generationRuntimeSource, /const billingStateContext = prepareGenerationBillingStateContext\(\{/);
    assert.match(appSource, /const initialSubmissionContext = await prepareInitialGenerationSubmissionContext\(\{/);
    assert.match(resolveBillingStateSource, /import \{ type ModelExecutionLane, resolveModelExecutionLane \} from '\.\.\/services\/model\/modelExecutionLane';/);
    assert.match(resolveBillingStateSource, /const executionLane = resolveModelExecutionLane\(/);
    assert.match(generationRuntimeSource, /executionLane: initialSubmissionContext\.executionLane,/);
    assert.match(generationRuntimeSource, /executionLane: params\.generationBillingState\.executionLane,/);
    assert.match(generationRuntimeSource, /executionLane: billingAttemptContext\.executionLane,/);
    assert.match(generationRuntimeSource, /executionLane: initialSubmissionContext\.executionLane,/);
    assert.doesNotMatch(appSource, /const executionLane = initialSubmissionContext\.executionLane;/);
    assert.match(generationRuntimeSource, /creditRouteSpecId: params\.resolvedCreditSpecId,/);
    assert.match(generationRuntimeSource, /creditRouteUnitId: params\.resolvedCreditRoute\?\.routeUnitId,/);
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
