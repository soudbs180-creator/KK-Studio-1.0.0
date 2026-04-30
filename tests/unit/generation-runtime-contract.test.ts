import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

describe('generation runtime extraction contract', () => {
  test('cancel generation ownership lives in useGenerationRuntime', () => {
    const hookPath = path.join(ROOT_DIR, 'src/app/useGenerationRuntime.ts');
    assert.equal(existsSync(hookPath), true, 'src/app/useGenerationRuntime.ts should exist');

    const hookSource = readSource('src/app/useGenerationRuntime.ts');
    const appSource = readSource('src/App.tsx');

    assert.match(hookSource, /interface UseGenerationRuntimeDeps \{/);
    assert.match(hookSource, /interface UseGenerationRuntimeResult \{/);
    assert.match(hookSource, /handleCancelGeneration: \(id\?: string\) => Promise<void>;/);
    assert.match(hookSource, /const handleCancelGeneration = useCallback\(async \(id\?: string\) => \{/);
    assert.match(hookSource, /const promptNodes = activeCanvas\?\.promptNodes \?\? \[\];/);
    assert.ok(hookSource.includes('cancelGenerationRequest(`${node.id}-${i}`);'));
    assert.match(hookSource, /await cancelSystemProxyTask\(node\.jobId\)/);
    assert.match(hookSource, /buildCancelledPromptNodePatch\(node\.model\)/);

    assert.match(appSource, /import \{ useGenerationRuntime \} from '\.\/app\/useGenerationRuntime';/);
    assert.match(appSource, /const \{\s*handleCancelGeneration,\s*\} = useGenerationRuntime\(\{/);
    assert.match(appSource, /cancelGenerationRequest: cancelGeneration,/);
    assert.match(appSource, /cancelSystemProxyTask: cancelSecureSystemProxyTask,/);
    assert.doesNotMatch(appSource, /const handleCancelGeneration = useCallback\(async \(id\?: string\) => \{/);
    assert.doesNotMatch(appSource, /buildCancelledPromptNodePatch\(node\.model\)/);
  });

  test('generation submit guard owns cooldown and duplicate signature state outside App', () => {
    const guardPath = path.join(ROOT_DIR, 'src/app/useGenerationSubmitGuard.ts');

    assert.equal(existsSync(guardPath), true);

    const appSource = readSource('src/App.tsx');
    const guardSource = readSource('src/app/useGenerationSubmitGuard.ts');

    assert.match(appSource, /from '\.\/app\/useGenerationSubmitGuard';/);
    assert.match(appSource, /const \{ tryStartGenerationSubmission \} = useGenerationSubmitGuard\(\);/);
    assert.match(appSource, /const submitGuard = tryStartGenerationSubmission\(\{/);
    assert.match(appSource, /if \(!submitGuard\.allowed\) return;/);

    assert.doesNotMatch(appSource, /const GENERATE_TRIGGER_COOLDOWN_MS =/);
    assert.doesNotMatch(appSource, /const GENERATE_SIGNATURE_DEDUP_MS =/);
    assert.doesNotMatch(appSource, /lastGenerateAtRef = useRef/);
    assert.doesNotMatch(appSource, /lastGenerateSignatureRef = useRef/);
    assert.doesNotMatch(appSource, /lastSignature\.value === submitSignature/);

    assert.match(guardSource, /const GENERATE_TRIGGER_COOLDOWN_MS = 500;/);
    assert.match(guardSource, /const GENERATE_SIGNATURE_DEDUP_MS = 4000;/);
    assert.match(guardSource, /export interface UseGenerationSubmitGuardDeps \{/);
    assert.match(guardSource, /export interface UseGenerationSubmitGuardResult \{/);
    assert.match(guardSource, /export function useGenerationSubmitGuard/);
    assert.match(guardSource, /const lastGenerateAtRef = useRef\(0\);/);
    assert.match(guardSource, /const lastGenerateSignatureRef = useRef<\{ value: string; at: number \} \| null>\(null\);/);
    assert.match(guardSource, /const submitSignature = JSON\.stringify\(\{/);
    assert.match(guardSource, /lastSignature\.value === submitSignature/);
    assert.match(guardSource, /notify\.warning\('已拦截重复发送'/);
  });
});
