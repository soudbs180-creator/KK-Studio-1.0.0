import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('App does not retain compiler-proven unused imports and locals', () => {
  const source = readSource('apps/web/src/App.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/app-unused-cleanup-contract\.test\.ts/);
  assert.doesNotMatch(source, /import PendingNode from '\.\/components\/canvas\/PendingNode';/);
  assert.doesNotMatch(source, /import ChatSidebar from '\.\/components\/layout\/ChatSidebar';/);
  assert.doesNotMatch(source, /import \{ generateImage, cancelGeneration \} from '\.\/services\/llm\/geminiService';/);
  assert.doesNotMatch(source, /import \{ llmService \} from '\.\/services\/llm\/LLMService';/);
  assert.doesNotMatch(source, /import \{ analyzeEcommerceRequirementFile \} from '\.\/services\/ecommerce\/ecommerceAnalysisClient\.ts';/);
  assert.doesNotMatch(source, /import \{ cancelSecureSystemProxyTask \} from '\.\/services\/model\/secureModelProxy';/);
  assert.match(source, /await import\('\.\/services\/llm\/geminiService'\)/);
  assert.match(source, /await import\('\.\/services\/llm\/LLMService'\)/);
  assert.match(source, /await import\('\.\/services\/ecommerce\/ecommerceAnalysisClient\.ts'\)/);
  assert.match(source, /await import\('\.\/services\/model\/secureModelProxy'\)/);
  assert.doesNotMatch(source, /import \{ SelectionMenu \} from '\.\/components\/canvas\/SelectionMenu';/);
  assert.doesNotMatch(source, /import \{ modelCaller \} from '\.\/services\/model\/modelCaller';/);
  assert.doesNotMatch(source, /import \{ getModelPricing,/);
  assert.doesNotMatch(source, /Image as ImageIcon/);
  assert.doesNotMatch(source, /migrateLegacyEcommerceFrameworkCanvas/);
  assert.doesNotMatch(source, /import \{ getViewportOffsets \} from '\.\/utils\/canvasCenter';/);
  assert.doesNotMatch(source, /import \{ clampGenerationDurationMs \} from '\.\/utils\/timeUtils';/);
  assert.doesNotMatch(source, /toReferenceImageDataUrl/);
  assert.doesNotMatch(source, /resolveLiveSceneNodePosition/);
  assert.doesNotMatch(source, /buildCompletedPromptNodePatch/);
  assert.doesNotMatch(source, /import ConnectionDot from '\.\/components\/canvas\/ConnectionDot';/);
  assert.doesNotMatch(source, /import \{ Search \} from 'lucide-react';/);
  assert.doesNotMatch(source, /const \{ advanceTo, stage \} = useAppStartup\(\);/);
  assert.doesNotMatch(source, /urgentUpdatePromptNode,\s*\/\/ hot-path prompt updates/);
  assert.doesNotMatch(source, /\bunlinkNodes,/);
  assert.doesNotMatch(source, /\bmoveSelectedNodes,/);
  assert.doesNotMatch(source, /\bupdateWorkflowNode,/);
  assert.doesNotMatch(source, /const \[pendingPrompt, setPendingPrompt\]/);
  assert.doesNotMatch(source, /\bpollTaskStatus,/);
  assert.doesNotMatch(source, /cancelGeneration: cancelGen/);
  assert.doesNotMatch(source, /const handleCutConnection = /);
  assert.doesNotMatch(source, /const handlePinImage = /);
  assert.doesNotMatch(source, /Pin Image -> Convert to Lonely Main Card/);
  assert.doesNotMatch(source, /\bsettlePromptGroupRegroup,/);
  assert.doesNotMatch(source, /const visibleWorkflowUtilityNodesById = /);
  assert.doesNotMatch(source, /\bconnectorRenderSnapshot,/);
  assert.doesNotMatch(source, /\bconnectorRenderVisibleImageNodes,/);
  assert.doesNotMatch(source, /\bgetSelectionScreenCenter,/);
  assert.doesNotMatch(source, /\bselectNodeFromCurrentEvent,/);
  assert.doesNotMatch(source, /\bgetPromptChildrenForWorkflow,/);
  assert.doesNotMatch(source, /\bnotifyWorkflowCard,/);
  assert.doesNotMatch(source, /\bgetWorkflowInsertPosition,/);
  assert.doesNotMatch(source, /\bexportWorkflowImagesAsZip,/);
  assert.doesNotMatch(source, /\bcreateTemplatePromptNode,/);
  assert.doesNotMatch(source, /onDragStart=\{\(id, event\) =>/);
});
