import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('ChatSidebar delegates persisted sessions and tree projection to a strict controller', () => {
  const sidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const sessionDataSource = readSource('apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts');
  const sessionStateSource = readSource('apps/web/src/components/layout/chat-sidebar/session/useChatSessionState.ts');
  const ratchetSource = readSource('config/maintainability-ratchet.json');

  assert.match(sidebarSource, /useChatSessionState\(\{/);
  assert.doesNotMatch(sidebarSource, /const \[sessions, setSessions\] = useState/);
  assert.doesNotMatch(sidebarSource, /localStorage\.setItem\(CHAT_SESSION_STORAGE_KEY/);
  assert.match(sessionDataSource, /CHAT_SESSION_STORAGE_KEY = 'kk_chat_sidebar_sessions_v1'/);
  assert.match(sessionDataSource, /TEMP_SESSION_STORAGE_KEY = 'kk_temp_session_messages'/);
  assert.match(sessionDataSource, /CHAT_SESSION_TREE_EXPAND_KEY = 'kk_chat_sidebar_tree_expand_v1'/);
  assert.match(sessionStateSource, /buildSessionTreeRows\(\{/);
  assert.match(sessionStateSource, /persistChatSessions\(sessions\)/);
  assert.match(sessionStateSource, /synchronizeActiveMessages/);
  assert.doesNotMatch(`${sessionDataSource}\n${sessionStateSource}`, /\bany\b/);
  assert.doesNotMatch(`${sessionDataSource}\n${sessionStateSource}`, /console\.log/);
  assert.match(ratchetSource, /apps\/web\/src\/components\/layout\/chat-sidebar\/session/);
});
