import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('ChatSidebar delegates model catalog and selected-model state to a strict controller', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const modelStateSource = readSource('apps/web/src/components/layout/chat-sidebar/model/useChatModelCatalog.ts');
  const ratchetSource = readSource('config/maintainability-ratchet.json');

  assert.match(sidebarSource, /useChatModelCatalog\(\{/);
  assert.match(sidebarSource, /useSelectedChatModelState\(KKAI_FEATURE_FLAGS\.billing\)/);
  assert.doesNotMatch(sidebarSource, /const buildAvailableChatModels =/);
  assert.doesNotMatch(sidebarSource, /const resolveAssistantPreferredModelGlobal =/);

  assert.match(modelStateSource, /subscribeCapabilityRouteAssignments\(updateModels\)/);
  assert.match(modelStateSource, /keyManager\.subscribe\(updateModels\)/);
  assert.match(modelStateSource, /isCapabilityRouteAssignmentModelDisabled\('assistant', options\.selectedModel\.id\)/);
  assert.doesNotMatch(modelStateSource, /\bany\b/);
  assert.doesNotMatch(modelStateSource, /console\.log/);

  assert.match(
    ratchetSource,
    /apps\/web\/src\/components\/layout\/chat-sidebar\/model/,
  );
});
