import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

function extractManualChunkGroup(source: string, name: string): string {
  const match = source.match(
    new RegExp(`name:\\s*'${name}',[\\s\\S]*?patterns:\\s*\\[([\\s\\S]*?)\\]\\s*,\\s*\\}`)
  );

  assert.ok(match, `expected manual chunk group "${name}" to be declared`);
  return match[1];
}

test('Vite manual chunks keep provider adapters off static ecommerce and generation runtime paths', () => {
  const source = readSource('apps/web/vite.config.ts');
  const modelServicesGroup = extractManualChunkGroup(source, 'model-services');
  const providerAdaptersGroup = extractManualChunkGroup(source, 'provider-adapters');
  const workspaceLayoutGroup = extractManualChunkGroup(source, 'workspace-layout');
  const ecommerceCoreGroup = extractManualChunkGroup(source, 'ecommerce-core');
  const ecommerceAnalysisToolsGroup = extractManualChunkGroup(source, 'ecommerce-analysis-tools');
  const ecommerceNormalizeToolsGroup = extractManualChunkGroup(source, 'ecommerce-normalize-tools');
  const ecommerceDocumentToolsGroup = extractManualChunkGroup(source, 'ecommerce-document-tools');
  const ecommerceExportToolsGroup = extractManualChunkGroup(source, 'ecommerce-export-tools');
  const ecommerceServicesGroup = extractManualChunkGroup(source, 'ecommerce-services');

  assert.doesNotMatch(
    source,
    /name:\s*'ai-takeover-runtime'/,
    'AI takeover is consumed by lazy ChatSidebar; forcing it into a manual chunk can make the main entry import shared code from that lazy chunk'
  );
  assert.ok(
    source.indexOf("name: 'model-services'") < source.indexOf("name: 'provider-adapters'"),
    'model-services must be checked before provider-adapters because manual chunk matching is first-match'
  );
  assert.match(modelServicesGroup, /'\/src\/services\/llm\/syncImageBridge\.ts'/);
  assert.match(providerAdaptersGroup, /'\/src\/services\/llm\/'/);
  assert.doesNotMatch(providerAdaptersGroup, /'\/src\/services\/llm\/syncImageBridge\.ts'/);
  assert.doesNotMatch(providerAdaptersGroup, /'\/src\/services\/ecommerce\/'/);
  assert.doesNotMatch(
    source,
    /name:\s*'chat-sidebar'/,
    'ChatSidebar is already a dynamic import; forcing a manual chunk can make the main entry import shared code back from the lazy chunk'
  );
  assert.match(workspaceLayoutGroup, /'\/src\/components\/layout\/PromptBar\.tsx'/);
  assert.match(workspaceLayoutGroup, /'\/src\/components\/MobileChatFeed\.tsx'/);
  assert.doesNotMatch(workspaceLayoutGroup, /ChatSidebar\.tsx/);
  assert.ok(
    source.indexOf("name: 'ecommerce-core'") < source.indexOf("name: 'ecommerce-normalize-tools'"),
    'ecommerce shared core must be checked before deferred normalize tools'
  );
  assert.ok(
    source.indexOf("name: 'ecommerce-core'") < source.indexOf("name: 'ecommerce-document-tools'"),
    'ecommerce shared core must be checked before deferred document tools'
  );
  assert.match(ecommerceCoreGroup, /'\/src\/services\/ecommerce\/assetRoleBindings\.ts'/);
  assert.match(ecommerceCoreGroup, /'\/src\/services\/ecommerce\/copyResolver\.ts'/);
  assert.match(ecommerceCoreGroup, /'\/src\/services\/ecommerce\/ecommerceModelPolicy\.ts'/);
  assert.match(ecommerceCoreGroup, /'\/src\/services\/ecommerce\/renderTaskBuilder\.ts'/);
  assert.match(ecommerceCoreGroup, /'\/src\/services\/ecommerce\/seriesTemplateExtractor\.ts'/);
  assert.match(ecommerceCoreGroup, /'\/src\/services\/ecommerce\/taskMerger\.ts'/);
  assert.ok(
    source.indexOf("name: 'ecommerce-analysis-tools'") < source.indexOf("name: 'ecommerce-services'"),
    'ecommerce analysis tools must be checked before the ecommerce catch-all chunk'
  );
  assert.ok(
    source.indexOf("name: 'ecommerce-normalize-tools'") < source.indexOf("name: 'ecommerce-document-tools'"),
    'ecommerce normalizer must be checked before the broader xlsx document fallback chunk'
  );
  assert.ok(
    source.indexOf("name: 'ecommerce-document-tools'") < source.indexOf("name: 'ecommerce-services'"),
    'ecommerce document tools must be checked before the ecommerce catch-all chunk'
  );
  assert.ok(
    source.indexOf("name: 'ecommerce-export-tools'") < source.indexOf("name: 'ecommerce-services'"),
    'ecommerce export tools must be checked before the ecommerce catch-all chunk'
  );
  assert.match(ecommerceAnalysisToolsGroup, /'\/src\/services\/ecommerce\/ecommerceAnalysisClient\.ts'/);
  assert.match(ecommerceAnalysisToolsGroup, /'\/src\/services\/ecommerce\/ecommerceAnalysisEnhancer\.ts'/);
  assert.doesNotMatch(ecommerceAnalysisToolsGroup, /'\/src\/services\/ecommerce\/xlsx\/'/);
  assert.match(ecommerceNormalizeToolsGroup, /'\/src\/services\/ecommerce\/normalize\/'/);
  assert.match(ecommerceNormalizeToolsGroup, /'\/src\/services\/ecommerce\/xlsx\/referenceBindingResolver\.ts'/);
  assert.doesNotMatch(ecommerceDocumentToolsGroup, /'\/src\/services\/ecommerce\/normalize\/'/);
  assert.match(ecommerceDocumentToolsGroup, /'\/src\/services\/ecommerce\/text\/'/);
  assert.match(ecommerceDocumentToolsGroup, /'\/src\/services\/ecommerce\/xlsx\/'/);
  assert.match(ecommerceDocumentToolsGroup, /'\/src\/services\/document\/nutrientDocumentService\.ts'/);
  assert.match(ecommerceExportToolsGroup, /'\/src\/services\/ecommerce\/groupExportManifest\.ts'/);
  assert.match(ecommerceServicesGroup, /'\/src\/services\/ecommerce\/'/);
  assert.match(source, /'provider-adapters-',/);
  assert.match(source, /'ChatSidebar-',/);
  assert.match(source, /'ecommerce-normalize-tools-',/);
  assert.match(source, /'ecommerce-analysis-tools-',/);
  assert.match(source, /'ecommerce-document-tools-',/);
  assert.match(source, /'ecommerce-export-tools-',/);
  assert.match(source, /'zip-vendor-',/);
  assert.match(source, /normalizedId\.includes\('\/node_modules\/jszip\/'\)[\s\S]*return 'zip-vendor';/);
});

test('Mermaid converter stays native and out of the runtime vendor graph', () => {
  const viteSource = readSource('apps/web/vite.config.ts');
  const webPackageSource = readSource('apps/web/package.json');
  const appGlobalModalsSource = readSource('apps/web/src/app/AppGlobalModals.tsx');
  const mermaidRendererSource = readSource('apps/web/src/components/mermaid/MermaidRenderer.tsx');
  const mermaidTopologySource = readSource('apps/web/src/components/mermaid/mermaidTopology.ts');

  assert.match(
    appGlobalModalsSource,
    /const MermaidRenderer = lazyWithRetry\(\(\) => import\('\.\.\/components\/mermaid\/MermaidRenderer'\)\);/
  );
  assert.doesNotMatch(mermaidRendererSource, /from 'mermaid'|import\('mermaid'\)|mermaid\./);
  assert.match(mermaidRendererSource, /from '\.\/mermaidTopology\.ts';/);
  assert.match(mermaidTopologySource, /export function buildNativeMermaidPreviewSvg/);
  assert.match(mermaidTopologySource, /function computeNodeLevels/);
  assert.doesNotMatch(viteSource, /mermaid-vendor|MERMAID_VENDOR|isMermaidVendorModule/);
  assert.doesNotMatch(webPackageSource, /"mermaid"\s*:/);
});

test('mobile ecommerce and ecommerce analysis services load LLM execution only on demand', () => {
  const chatSidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const canvasContextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const canvasCloudSyncSource = readSource('apps/web/src/context/useCanvasCloudSync.ts');
  const mobilePanelSource = readSource('apps/web/src/components/mobile/MobileEcommercePanel.tsx');
  const ecommerceClientSource = readSource('apps/web/src/services/ecommerce/ecommerceAnalysisClient.ts');
  const ecommerceEnhancerSource = readSource('apps/web/src/services/ecommerce/ecommerceAnalysisEnhancer.ts');
  const ecommerceTaskEditorSource = readSource('apps/web/src/components/ecommerce/EcommerceTaskEditorPanel.tsx');
  const aiTakeoverContextSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');
  const aiTakeoverLlmBrainSource = readSource('apps/web/src/features/ai-takeover/core/llmBrain.ts');
  const archiveRuntimeSource = readSource('apps/web/src/utils/archiveRuntime.ts');

  assert.doesNotMatch(chatSidebarSource, /import \{ generateImage \} from '\.\.\/\.\.\/services\/llm\/geminiService';/);
  assert.doesNotMatch(chatSidebarSource, /import \{ llmService \} from '\.\.\/\.\.\/services\/llm\/LLMService';/);
  assert.match(chatSidebarSource, /await import\('\.\.\/\.\.\/services\/llm\/geminiService'\)/);
  assert.match(chatSidebarSource, /await import\('\.\.\/\.\.\/services\/llm\/LLMService'\)/);

  assert.doesNotMatch(canvasContextSource, /import \{ syncService \} from '\.\.\/services\/system\/syncService';/);
  assert.match(canvasContextSource, /await import\('\.\.\/services\/system\/syncService'\)/);
  assert.doesNotMatch(canvasCloudSyncSource, /import \{ syncService \} from '\.\.\/services\/system\/syncService';/);
  assert.match(canvasCloudSyncSource, /import\('\.\.\/services\/system\/syncService'\)/);

  assert.doesNotMatch(aiTakeoverContextSource, /import \{ llmService \} from '\.\.\/\.\.\/\.\.\/services\/llm\/LLMService';/);
  assert.match(aiTakeoverContextSource, /await import\('\.\.\/\.\.\/\.\.\/services\/llm\/LLMService'\)/);
  assert.doesNotMatch(aiTakeoverLlmBrainSource, /import \{ llmService \} from '\.\.\/\.\.\/\.\.\/services\/llm\/LLMService';/);
  assert.match(aiTakeoverLlmBrainSource, /await import\('\.\.\/\.\.\/\.\.\/services\/llm\/LLMService'\)/);

  assert.doesNotMatch(mobilePanelSource, /import \{ generateImage \} from '\.\.\/\.\.\/services\/llm\/geminiService';/);
  assert.doesNotMatch(mobilePanelSource, /import \{ llmService \} from '\.\.\/\.\.\/services\/llm\/LLMService';/);
  assert.match(mobilePanelSource, /await import\('\.\.\/\.\.\/services\/llm\/geminiService'\)/);
  assert.match(mobilePanelSource, /await import\('\.\.\/\.\.\/services\/llm\/LLMService'\)/);

  const mobileFeedSource = readSource('apps/web/src/components/MobileChatFeed.tsx');
  assert.doesNotMatch(mobileFeedSource, /import JSZip from 'jszip';/);
  assert.doesNotMatch(mobileFeedSource, /import \{ saveAs \} from 'file-saver';/);
  assert.match(mobileFeedSource, /from '\.\.\/utils\/archiveRuntime';/);
  assert.match(mobileFeedSource, /createZipArchive\(\)/);
  assert.match(mobileFeedSource, /loadFileSaver\(\)/);

  assert.doesNotMatch(archiveRuntimeSource, /import JSZip from 'jszip';/);
  assert.doesNotMatch(archiveRuntimeSource, /from 'file-saver';/);
  assert.match(archiveRuntimeSource, /await import\('jszip'\)/);
  assert.match(archiveRuntimeSource, /await import\('file-saver'\)/);

  assert.doesNotMatch(ecommerceEnhancerSource, /import \{ llmService \} from '\.\.\/llm\/LLMService';/);
  assert.match(ecommerceEnhancerSource, /await import\('\.\.\/llm\/LLMService'\)/);

  assert.doesNotMatch(ecommerceTaskEditorSource, /import \{ optimizePromptForImage \} from '\.\.\/\.\.\/services\/llm\/promptOptimizerService';/);
  assert.match(ecommerceTaskEditorSource, /await import\('\.\.\/\.\.\/services\/llm\/promptOptimizerService'\)/);

  assert.doesNotMatch(ecommerceClientSource, /import \{ parseOpenXmlWorkbook \} from '\.\/xlsx\/openXmlWorkbookParser\.ts';/);
  assert.doesNotMatch(ecommerceClientSource, /import \{ normalizeEcommerceAnalysis \} from '\.\/normalize\/ecommerceAnalysisNormalizer\.ts';/);
  assert.doesNotMatch(ecommerceClientSource, /import \{ analyzeEcommerceTextFallback \} from '\.\/text\/fallbackTextAnalysis\.ts';/);
  assert.doesNotMatch(ecommerceClientSource, /import \{ nutrientDocumentService \} from '\.\.\/document\/nutrientDocumentService\.ts';/);
  assert.match(ecommerceClientSource, /import\('\.\/xlsx\/openXmlWorkbookParser\.ts'\)/);
  assert.match(ecommerceClientSource, /import\('\.\/normalize\/ecommerceAnalysisNormalizer\.ts'\)/);
  assert.match(ecommerceClientSource, /await import\('\.\/text\/fallbackTextAnalysis\.ts'\)/);
  assert.match(ecommerceClientSource, /await import\('\.\.\/document\/nutrientDocumentService\.ts'\)/);
});
