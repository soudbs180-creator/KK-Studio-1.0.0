import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CHAT_SESSION_STORAGE_KEY,
  TEMP_SESSION_ID,
  TEMP_SESSION_STORAGE_KEY,
  buildActiveBranchTrail,
  buildImportPreview,
  buildSessionTreeRows,
  createBranchSession,
  createSessionMap,
  ensureUniqueIds,
  loadInitialChatSessions,
  mergeImportedSessions,
  parseSessionImport,
  persistChatSessions,
  type ChatSessionItem,
  type Message,
} from '../../apps/web/src/components/layout/chat-sidebar/session/chatSessionData.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createMessage(id: string, content: string): Message {
  return { id, role: 'user', content, timestamp: 1 };
}

function createSession(id: string, title: string, messages: Message[], parentSessionId?: string): ChatSessionItem {
  return { id, title, messages, parentSessionId, updatedAt: Number(id.replace(/\D/g, '')) || 1 };
}

test('session tree search exposes matching descendants and their ancestry', () => {
  const root = createSession('session_1', 'root', [createMessage('message_1', 'root')]);
  const child = createSession('session_2', 'child', [createMessage('message_2', 'middle')], root.id);
  const leaf = createSession('session_3', 'leaf', [createMessage('message_3', 'needle')], child.id);
  const sessions = [root, child, leaf];
  const sessionMap = createSessionMap(sessions);
  const activeBranchTrail = buildActiveBranchTrail(leaf, sessionMap);

  const rows = buildSessionTreeRows({
    activeBranchTrail,
    expandedNodes: { [root.id]: false },
    search: 'needle',
    sessionMap,
    sessions,
    showArchived: false,
  });

  assert.deepEqual(rows.map((row) => [row.session.id, row.depth]), [
    [root.id, 0],
    [child.id, 1],
    [leaf.id, 2],
  ]);
});

test('session import preview distinguishes id conflicts, content duplicates and new sessions', () => {
  const original = createSession('session_1', 'existing', [createMessage('message_1', 'same')]);
  const conflicting = createSession('session_1', 'changed', [createMessage('message_2', 'changed')]);
  const duplicate = createSession('session_2', 'existing', [createMessage('message_3', 'same')]);
  const fresh = createSession('session_3', 'fresh', [createMessage('message_4', 'new')]);

  const stats = buildImportPreview([original], [conflicting, duplicate, fresh]);

  assert.equal(stats.conflictsById, 1);
  assert.equal(stats.duplicatesByFingerprint, 1);
  assert.equal(stats.newById, 2);
  const remapped = ensureUniqueIds([original], [conflicting, createSession('child', 'child', [], conflicting.id)]);
  assert.notEqual(remapped[0].id, original.id);
  assert.equal(remapped[1].parentSessionId, remapped[0].id);
});

test('branch creation and smart import merge preserve the existing newest-session semantics', () => {
  const parent = createSession('session_1', 'parent', [
    createMessage('message_1', 'hello'),
    createMessage('message_2', 'branch prompt'),
  ]);
  const branch = createBranchSession(parent.messages, 1, parent.id, 100);
  assert.equal(branch.title, '分支 · hello');
  assert.equal(branch.parentSessionId, parent.id);
  assert.equal(branch.branchFromMessageId, 'message_2');

  const older = { ...parent, updatedAt: 1 };
  const newer = { ...parent, title: 'newer', updatedAt: 2 };
  const duplicate = { ...newer, id: 'session_2' };
  const merged = mergeImportedSessions([older], [newer, duplicate]);
  assert.deepEqual(merged.map((session) => session.id), [newer.id]);
});

test('session import parser normalizes loose JSON without explicit any', () => {
  const parsed = parseSessionImport(JSON.stringify({
    activeSessionId: 'session_imported',
    sessions: [{ id: 'session_imported', title: '', messages: [] }],
  }), []);

  assert.equal(parsed.activeSessionId, 'session_imported');
  assert.equal(parsed.sessions[0].title, '导入会话');
  assert.equal(parsed.sessions[0].messages[0].id, 'welcome');
  assert.throws(() => parseSessionImport('{"sessions":null}', []), /格式不正确/);
});

test('session storage keeps the 20 newest persistent entries and restores an empty temporary session', () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });
  try {
    const persistentSessions = Array.from({ length: 22 }, (_, index) => (
      createSession(`session_${index + 1}`, `session ${index + 1}`, [])
    ));
    persistChatSessions([
      ...persistentSessions,
      { ...createSession(TEMP_SESSION_ID, 'temporary', []), isTemp: true },
    ]);

    const storedPersistent = JSON.parse(localStorage.getItem(CHAT_SESSION_STORAGE_KEY) || '[]') as ChatSessionItem[];
    assert.equal(storedPersistent.length, 20);
    assert.equal(sessionStorage.getItem(TEMP_SESSION_STORAGE_KEY), '[]');
    const restored = loadInitialChatSessions();
    assert.equal(restored[0].id, TEMP_SESSION_ID);
    assert.deepEqual(restored[0].messages, []);
  } finally {
    if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    if (sessionStorageDescriptor) Object.defineProperty(globalThis, 'sessionStorage', sessionStorageDescriptor);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
