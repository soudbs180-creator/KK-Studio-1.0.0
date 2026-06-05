import test from 'node:test';
import assert from 'node:assert/strict';

import { readSource } from '../support/workspacePaths.js';

test('desktop and mobile favorites entry points are exposed', () => {
  const projectManagerSource = readSource('apps/web/src/components/settings/ProjectManager.tsx');
  const mobileSurfaceSource = readSource('apps/web/src/components/mobile/MobileWorkspaceSurface.tsx');
  const workspacePanelsSource = readSource('apps/web/src/components/workspace/WorkspaceSurfacePanels.tsx');

  assert.match(projectManagerSource, /Heart,/);
  assert.match(projectManagerSource, /onFavorites\?: \(\) => void;/);
  assert.match(projectManagerSource, /data-testid="project-manager-favorites"/);
  assert.match(mobileSurfaceSource, /data-testid="mobile-more-menu-favorites"/);
  assert.match(mobileSurfaceSource, /onOpenFavorites: \(\) => void;/);
  assert.match(workspacePanelsSource, /<FavoritesPanel/);
  assert.match(workspacePanelsSource, /workspaceSurface === 'favorites'/);
});

test('@ reference panel is mounted by all composer surfaces', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const chatSidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const aiDockSource = readSource('apps/web/src/features/ai-takeover/components/AIAssistantDock.tsx');

  assert.match(promptBarSource, /favoriteComposerRegistry\.register\(\{/);
  assert.match(promptBarSource, /id: 'promptbar'/);
  assert.match(promptBarSource, /<ReferenceMentionPanel/);
  assert.match(chatSidebarSource, /id: 'assistant'/);
  assert.match(chatSidebarSource, /addAssistantAttachment: addCandidateAsAssistantAttachment/);
  assert.match(chatSidebarSource, /<ReferenceMentionPanel/);
  assert.match(aiDockSource, /id: 'ai-dock'/);
  assert.match(aiDockSource, /<ReferenceMentionPanel/);
});
