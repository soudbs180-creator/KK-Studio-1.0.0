import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAssistantContextSuggestions,
  normalizeAssistantCollaborationMode,
} from '../../apps/web/src/features/ai-takeover/core/collaborationMode.ts';
import type { CanvasRuntimeState } from '../../apps/web/src/features/ai-takeover/types.ts';
import { readSource } from '../support/workspacePaths.js';

const createRuntime = ({
  currentPage = 'canvas',
  promptNodeIds = [],
  imageNodeIds = [],
  canvasItemCount = 0,
}: {
  currentPage?: CanvasRuntimeState['currentPage'];
  promptNodeIds?: string[];
  imageNodeIds?: string[];
  canvasItemCount?: number;
} = {}): CanvasRuntimeState => {
  const selectedNodeIds = [...promptNodeIds, ...imageNodeIds];
  return {
    projectVersion: 'test',
    currentPage,
    canvas: {
      id: 'canvas-1',
      name: 'Canvas',
      promptCount: canvasItemCount,
      imageCount: 0,
      groupCount: 0,
      noteCount: 0,
      workflowPanelCount: 0,
      cardKinds: {},
      layoutModes: [],
    },
    viewport: { x: 0, y: 0, scale: 1, center: { x: 0, y: 0 } },
    selection: {
      selectedNodeIds,
      promptNodeIds,
      imageNodeIds,
      childImageNodeIdsFromSelectedPrompts: [],
      groupIds: [],
      noteNodeIds: [],
      workflowNodeIds: [],
      capabilities: {
        canArrange: true,
        canConvertDrawingsToNote: false,
        canCreateCard: true,
        canCreateWorkflowPanel: true,
      },
      count: selectedNodeIds.length,
    },
    groups: [],
    selectedNodes: {
      prompts: promptNodeIds.map((id) => ({
        id,
        prompt: 'prompt',
        status: 'idle',
        childImageIds: [],
      })),
      images: imageNodeIds.map((id) => ({
        id,
        urlPresent: true,
        originalUrlPresent: true,
        apiResultUrlPresent: false,
        storageIdPresent: false,
      })),
      notes: [],
      workflowPanels: [],
    },
    recentEvents: [],
  };
};

test('assistant exposes one synchronized direct, assist, and takeover mode switch', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const toggleSource = readSource('apps/web/src/features/ai-takeover/components/AITakeoverToggle.tsx');

  assert.match(sidebarSource, /<AITakeoverToggle/);
  assert.doesNotMatch(sidebarSource, /\bagentMode\b/);
  assert.match(toggleSource, /role="radiogroup"/);
  assert.match(toggleSource, /id:\s*['"]btn-ai-direct-mode['"]/);
  assert.match(toggleSource, /id:\s*['"]btn-ai-assist-mode['"]/);
  assert.match(toggleSource, /id:\s*['"]btn-ai-takeover-toggle['"]/);
  assert.match(toggleSource, /setCollaborationMode/);
});

test('assist mode renders live page and selection suggestions without executing them', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const suggestionsSource = readSource('apps/web/src/features/ai-takeover/components/AIContextSuggestions.tsx');
  const contextSource = readSource('apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx');

  assert.match(sidebarSource, /<AIContextSuggestions/);
  assert.match(sidebarSource, /collaborationMode !== 'direct'/);
  assert.match(suggestionsSource, /collaborationMode !== 'assist'/);
  assert.match(suggestionsSource, /contextSuggestions/);
  assert.match(suggestionsSource, /canvasRuntimeState/);
  assert.doesNotMatch(suggestionsSource, /sendMessage|confirmPendingPlan|executePendingRun/);
  assert.match(
    contextSource,
    /collaborationMode === 'assist'[\s\S]{0,500}agentRunStore\.updateRun\(record\.id,[\s\S]{0,220}status: 'waiting_confirmation'/,
  );
});

test('collaboration mode normalization defaults invalid persisted values to direct', () => {
  assert.equal(normalizeAssistantCollaborationMode('direct'), 'direct');
  assert.equal(normalizeAssistantCollaborationMode('assist'), 'assist');
  assert.equal(normalizeAssistantCollaborationMode('takeover'), 'takeover');
  assert.equal(normalizeAssistantCollaborationMode('legacy-agent'), 'direct');
  assert.equal(normalizeAssistantCollaborationMode(null), 'direct');
});

test('context suggestions follow the current selection and preserve exact target ids', () => {
  const runtime = createRuntime({ promptNodeIds: ['prompt-1'], imageNodeIds: ['image-1'] });
  const suggestions = buildAssistantContextSuggestions(runtime);

  assert.deepEqual(suggestions[0]?.targetNodeIds, ['prompt-1', 'image-1']);
  assert.ok(suggestions.some((suggestion) => suggestion.id === 'arrange-selection'));
  assert.ok(suggestions.some((suggestion) => suggestion.id === 'create-image-variants'));
  assert.ok(suggestions.some((suggestion) => suggestion.id === 'export-selected-originals'));
});

test('context suggestions reflect page changes and an empty selection', () => {
  const librarySuggestions = buildAssistantContextSuggestions(createRuntime({ currentPage: 'library' }));
  const canvasSuggestions = buildAssistantContextSuggestions(createRuntime({ canvasItemCount: 3 }));
  const settingsSuggestions = buildAssistantContextSuggestions(createRuntime({ currentPage: 'settings' }));
  const agentSuggestions = buildAssistantContextSuggestions(createRuntime({ currentPage: 'agent' }));

  assert.equal(librarySuggestions[0]?.id, 'library-to-canvas');
  assert.equal(canvasSuggestions[0]?.id, 'review-whole-canvas');
  assert.equal(settingsSuggestions[0]?.id, 'review-current-settings');
  assert.equal(agentSuggestions[0]?.id, 'continue-agent-task');
});

test('desktop assistant opens over library and favorites without changing the current page', () => {
  const surfaceHookSource = readSource('apps/web/src/hooks/useWorkspaceSurface.ts');
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(surfaceHookSource, /isChatOpen\s*&&\s*isMobile\s*\?\s*'chat'/);
  assert.match(surfaceHookSource, /const toggleChatPanel = useCallback\(\(\) => \{\s*setIsChatOpen/);
  assert.doesNotMatch(
    surfaceHookSource,
    /const toggleChatPanel = useCallback\(\(\) => \{[\s\S]{0,120}setWorkspaceSurface\('workspace'\)/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /const CollapsedDesktopChatSidebar[\s\S]{0,300}workspaceSurface !== 'workspace'/,
  );
});

test('assistant runtime and chat state remain mounted while the sidebar is collapsed', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const panelsSource = readSource('apps/web/src/components/workspace/WorkspacePanels.tsx');

  assert.match(
    sidebarSource,
    /<AITakeoverProvider[\s\S]*?<ChatSidebarInner[\s\S]*?<\/AITakeoverProvider>/,
  );
  assert.doesNotMatch(sidebarSource, /!props\.isOpen && !props\.isMobile \? \(/);
  assert.match(panelsSource, /renderChatSidebar\?\.\(\)/);
  assert.doesNotMatch(panelsSource, /activePanel === 'chat' \|\| !isMobile/);
});

test('assistant runtime receives the actual visible app surface', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const panelsSource = readSource('apps/web/src/components/workspace/WorkspaceSurfacePanels.tsx');

  assert.match(panelsSource, /workspaceSurface=\{activeSurface\}/);
  assert.match(sidebarSource, /workspaceSurface === 'settings'\) return 'settings'/);
  assert.match(sidebarSource, /workspaceSurface === 'chat'\) return 'agent'/);
});
