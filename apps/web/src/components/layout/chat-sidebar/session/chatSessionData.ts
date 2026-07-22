export interface Attachment {
  id: string;
  type: 'image' | 'document' | 'video' | 'audio' | 'url';
  name: string;
  data: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  isImageGeneration?: boolean;
  modelId?: string;
}

export interface ChatSessionItem {
  isTemp?: boolean;
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  customTitle?: boolean;
  parentSessionId?: string;
  branchFromMessageId?: string;
  archived?: boolean;
}

export interface SessionContextMenu {
  x: number;
  y: number;
  sessionId: string;
}

export type SessionImportMode = 'replace' | 'append' | 'smart';

export interface SessionImportStats {
  imported: number;
  conflictsById: number;
  duplicatesByFingerprint: number;
  newById: number;
  conflictTitles: string[];
  duplicateTitles: string[];
  newTitles: string[];
  conflictIds: string[];
  duplicateIds: string[];
  newIds: string[];
  conflictPairs: Array<{ incoming: string; existing: string }>;
  duplicatePairs: Array<{ incoming: string; existing: string }>;
}

export interface SessionImportPreview {
  sessions: ChatSessionItem[];
  activeSessionId?: string;
  stats: SessionImportStats;
}

export interface SessionTreeRow {
  session: ChatSessionItem;
  depth: number;
  hasChildren: boolean;
}

export const CHAT_SESSION_STORAGE_KEY = 'kk_chat_sidebar_sessions_v1';
export const TEMP_SESSION_ID = 'session_temp';
export const TEMP_SESSION_STORAGE_KEY = 'kk_temp_session_messages';
export const CHAT_SESSION_TREE_EXPAND_KEY = 'kk_chat_sidebar_tree_expand_v1';

export function createWelcomeMessage(): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是 KK Studio 数字助手。\n有什么我可以帮您？\n\n试试输入 "/image 一只猫" 来生成图片！',
    timestamp: 0,
  };
}

export function cleanGreeting(text: string): string {
  const cleaned = text.trim().replace(/^(你好[，！,!]?|在吗[？?]?|hello[,\s]?|hi[,\s]?|哈喽[，！,!]?)/i, '');
  return cleaned.trim() || text.trim();
}

export function getFirstSubstantialQuestion(messages: Message[]): Message | undefined {
  return messages.find((message) => {
    if (message.role !== 'user' || !message.content || message.content === '(附件)') return false;
    const cleaned = cleanGreeting(message.content);
    return cleaned.length > 0 && !/^[\s,.:!?;，。：！？；、]+$/.test(cleaned);
  });
}

export function getSessionTitle(messages: Message[]): string {
  const firstQuestion = getFirstSubstantialQuestion(messages);
  return firstQuestion ? cleanGreeting(firstQuestion.content).slice(0, 18) : '新对话';
}

/** Creates a branch snapshot without coupling session data to sidebar UI state. */
export function createBranchSession(
  messages: Message[],
  messageIndex: number,
  parentSessionId: string,
  timestamp = Date.now(),
): ChatSessionItem {
  const branchMessages = messages.slice(0, messageIndex + 1);
  return {
    id: `session_${timestamp}`,
    title: `分支 · ${getSessionTitle(branchMessages)}`,
    customTitle: true,
    messages: branchMessages,
    updatedAt: timestamp,
    parentSessionId,
    branchFromMessageId: messages[messageIndex]?.id,
  };
}

export function formatSessionMeta(session: ChatSessionItem): string {
  const count = Math.max(0, (session.messages || []).filter((message) => message.id !== 'welcome').length);
  const date = new Date(session.updatedAt || Date.now());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${count}条 · ${hours}:${minutes}`;
}

export function makeSessionFingerprint(session: ChatSessionItem): string {
  const messages = session.messages || [];
  const lastMessage = messages[messages.length - 1];
  return `${session.title || ''}::${messages.length}::${(lastMessage?.content || '').slice(0, 64)}`;
}

export function getSessionLabel(session: ChatSessionItem): string {
  const count = Math.max(0, (session.messages || []).filter((message) => message.id !== 'welcome').length);
  return `${session.title || '未命名会话'} (${count})`;
}

export function ensureUniqueIds(existing: ChatSessionItem[], imported: ChatSessionItem[]): ChatSessionItem[] {
  const usedIds = new Set(existing.map((session) => session.id));
  const idMap = new Map<string, string>();
  const sessionsWithIds = imported.map((session, index) => {
    let nextId = session.id || `session_import_${Date.now()}_${index}`;
    if (usedIds.has(nextId)) nextId = `${nextId}_import_${Date.now()}_${index}`;
    usedIds.add(nextId);
    idMap.set(session.id, nextId);
    return { ...session, id: nextId };
  });
  return sessionsWithIds.map((session) => ({
    ...session,
    parentSessionId: session.parentSessionId
      ? idMap.get(session.parentSessionId) || session.parentSessionId
      : undefined,
  }));
}

function createImportStats(imported: number): SessionImportStats {
  return {
    imported,
    conflictsById: 0,
    duplicatesByFingerprint: 0,
    newById: 0,
    conflictTitles: [],
    duplicateTitles: [],
    newTitles: [],
    conflictIds: [],
    duplicateIds: [],
    newIds: [],
    conflictPairs: [],
    duplicatePairs: [],
  };
}

function recordIdComparison(session: ChatSessionItem, existing: ChatSessionItem | undefined, stats: SessionImportStats): void {
  const label = getSessionLabel(session);
  if (!existing) {
    stats.newById += 1;
    stats.newTitles.push(label);
    stats.newIds.push(session.id);
    return;
  }
  stats.conflictsById += 1;
  stats.conflictTitles.push(label);
  stats.conflictIds.push(session.id);
  if (stats.conflictPairs.length < 20) {
    stats.conflictPairs.push({ incoming: label, existing: getSessionLabel(existing) });
  }
}

function recordFingerprintComparison(session: ChatSessionItem, existing: ChatSessionItem | undefined, stats: SessionImportStats): void {
  if (!existing) return;
  stats.duplicatesByFingerprint += 1;
  stats.duplicateTitles.push(getSessionLabel(session));
  stats.duplicateIds.push(session.id);
  if (stats.duplicatePairs.length < 20) {
    stats.duplicatePairs.push({ incoming: getSessionLabel(session), existing: getSessionLabel(existing) });
  }
}

export function buildImportPreview(existing: ChatSessionItem[], imported: ChatSessionItem[]): SessionImportStats {
  const existingById = new Map(existing.map((session) => [session.id, session]));
  const existingByFingerprint = new Map(existing.map((session) => [makeSessionFingerprint(session), session]));
  const stats = createImportStats(imported.length);
  imported.forEach((session) => {
    recordIdComparison(session, existingById.get(session.id), stats);
    recordFingerprintComparison(session, existingByFingerprint.get(makeSessionFingerprint(session)), stats);
  });
  return stats;
}

/** Applies the established newest-by-id then newest-by-content smart import strategy. */
export function mergeImportedSessions(
  existing: ChatSessionItem[],
  imported: ChatSessionItem[],
): ChatSessionItem[] {
  const sessionsById = new Map(existing.map((session) => [session.id, session]));
  imported.forEach((session) => {
    const currentSession = sessionsById.get(session.id);
    if (!currentSession || (session.updatedAt || 0) >= (currentSession.updatedAt || 0)) {
      sessionsById.set(session.id, session);
    }
  });
  const sessionsByFingerprint = new Map<string, ChatSessionItem>();
  sessionsById.forEach((session) => {
    const fingerprint = makeSessionFingerprint(session);
    const currentSession = sessionsByFingerprint.get(fingerprint);
    if (!currentSession || (session.updatedAt || 0) > (currentSession.updatedAt || 0)) {
      sessionsByFingerprint.set(fingerprint, session);
    }
  });
  return [...sessionsByFingerprint.values()]
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, 50);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeImportedSession(value: unknown, index: number): ChatSessionItem {
  const session = isRecord(value) ? value : {};
  const messages = Array.isArray(session.messages) && session.messages.length > 0
    ? session.messages as Message[]
    : [createWelcomeMessage()];
  return {
    id: typeof session.id === 'string' && session.id ? session.id : `session_import_${Date.now()}_${index}`,
    title: typeof session.title === 'string' && session.title ? session.title : '导入会话',
    messages,
    updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : Date.now(),
    customTitle: Boolean(session.customTitle),
    parentSessionId: typeof session.parentSessionId === 'string' ? session.parentSessionId : undefined,
    branchFromMessageId: typeof session.branchFromMessageId === 'string' ? session.branchFromMessageId : undefined,
    archived: Boolean(session.archived),
  };
}

/** Parses the version-1 import envelope at the session boundary using unknown-safe guards. */
export function parseSessionImport(rawValue: string, existing: ChatSessionItem[]): SessionImportPreview {
  const parsedValue: unknown = JSON.parse(rawValue);
  if (!isRecord(parsedValue) || !Array.isArray(parsedValue.sessions)) {
    throw new Error('格式不正确');
  }
  const sessions = parsedValue.sessions.map(normalizeImportedSession);
  if (sessions.length === 0) throw new Error('没有可导入会话');
  return {
    sessions,
    activeSessionId: typeof parsedValue.activeSessionId === 'string' ? parsedValue.activeSessionId : undefined,
    stats: buildImportPreview(existing, sessions),
  };
}

function parseStoredArray<T>(rawValue: string | null): T[] {
  if (!rawValue) return [];
  const parsedValue: unknown = JSON.parse(rawValue);
  return Array.isArray(parsedValue) ? parsedValue as T[] : [];
}

/** Loads persistent and tab-scoped sessions without changing the established storage keys. */
export function loadInitialChatSessions(): ChatSessionItem[] {
  let sessions: ChatSessionItem[] = [];
  try {
    sessions = parseStoredArray<ChatSessionItem>(globalThis.localStorage?.getItem(CHAT_SESSION_STORAGE_KEY));
  } catch {
    sessions = [];
  }
  if (sessions.length === 0) {
    sessions = [{ id: `session_${Date.now()}`, title: '新对话', messages: [createWelcomeMessage()], updatedAt: Date.now() }];
  }
  try {
    const temporaryRawValue = globalThis.sessionStorage?.getItem(TEMP_SESSION_STORAGE_KEY);
    if (temporaryRawValue) {
      const temporaryMessages = parseStoredArray<Message>(temporaryRawValue);
      const temporarySession: ChatSessionItem = {
        id: TEMP_SESSION_ID, title: '临时对话', messages: temporaryMessages, updatedAt: Date.now(), isTemp: true,
      };
      sessions = [temporarySession, ...sessions.filter((session) => session.id !== TEMP_SESSION_ID)];
    }
  } catch {
    // Storage is best-effort; the persistent session remains available.
  }
  return sessions;
}

export function persistChatSessions(sessions: ChatSessionItem[]): void {
  try {
    const persistentSessions = sessions.filter((session) => !session.isTemp);
    globalThis.localStorage?.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify(persistentSessions.slice(0, 20)));
    const temporarySession = sessions.find((session) => session.isTemp);
    if (temporarySession) {
      globalThis.sessionStorage?.setItem(TEMP_SESSION_STORAGE_KEY, JSON.stringify(temporarySession.messages));
    } else {
      globalThis.sessionStorage?.removeItem(TEMP_SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage failures must not block the chat shell.
  }
}

export function loadSessionTreeExpansion(): Record<string, boolean> {
  try {
    const rawValue = globalThis.localStorage?.getItem(CHAT_SESSION_TREE_EXPAND_KEY);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : {};
    return parsedValue && typeof parsedValue === 'object' ? parsedValue as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

export function persistSessionTreeExpansion(expandedNodes: Record<string, boolean>): void {
  try {
    globalThis.localStorage?.setItem(CHAT_SESSION_TREE_EXPAND_KEY, JSON.stringify(expandedNodes));
  } catch {
    // Storage failures must not block the chat shell.
  }
}

export function createSessionMap(sessions: ChatSessionItem[]): Map<string, ChatSessionItem> {
  return new Map(sessions.map((session) => [session.id, session]));
}

export function buildActiveBranchTrail(
  activeSession: ChatSessionItem | null,
  sessionMap: Map<string, ChatSessionItem>,
): ChatSessionItem[] {
  const trail: ChatSessionItem[] = [];
  const visitedIds = new Set<string>();
  let currentSession = activeSession;
  while (currentSession && !visitedIds.has(currentSession.id)) {
    trail.unshift(currentSession);
    visitedIds.add(currentSession.id);
    currentSession = currentSession.parentSessionId
      ? sessionMap.get(currentSession.parentSessionId) || null
      : null;
  }
  return trail;
}

interface TreeProjectionOptions {
  activeBranchTrail: ChatSessionItem[];
  expandedNodes: Record<string, boolean>;
  search: string;
  sessionMap: Map<string, ChatSessionItem>;
  sessions: ChatSessionItem[];
  showArchived: boolean;
}

function collectSearchPathIds(options: TreeProjectionOptions, query: string): Set<string> {
  const visibleIds = new Set<string>();
  if (!query) return visibleIds;
  options.sessions.forEach((session) => {
    const matchesTitle = (session.title || '').toLowerCase().includes(query);
    const matchesMessage = (session.messages || []).some((message) => (
      (message.content || '').toLowerCase().includes(query)
    ));
    if (!matchesTitle && !matchesMessage) return;
    let currentSession: ChatSessionItem | null = session;
    while (currentSession) {
      visibleIds.add(currentSession.id);
      currentSession = currentSession.parentSessionId
        ? options.sessionMap.get(currentSession.parentSessionId) || null
        : null;
    }
  });
  return visibleIds;
}

function createChildMap(sessions: ChatSessionItem[]): Map<string, ChatSessionItem[]> {
  const childMap = new Map<string, ChatSessionItem[]>();
  sessions.forEach((session) => {
    if (!session.parentSessionId) return;
    const children = childMap.get(session.parentSessionId) || [];
    children.push(session);
    childMap.set(session.parentSessionId, children);
  });
  childMap.forEach((children) => children.sort((left, right) => right.updatedAt - left.updatedAt));
  return childMap;
}

function appendTreeRows(
  session: ChatSessionItem,
  depth: number,
  rows: SessionTreeRow[],
  childMap: Map<string, ChatSessionItem[]>,
  isExpanded: (session: ChatSessionItem, depth: number) => boolean,
): void {
  const children = childMap.get(session.id) || [];
  rows.push({ session, depth, hasChildren: children.length > 0 });
  if (!isExpanded(session, depth)) return;
  children.forEach((child) => appendTreeRows(child, depth + 1, rows, childMap, isExpanded));
}

/** Projects the branch tree while preserving the existing search and expansion semantics. */
export function buildSessionTreeRows(options: TreeProjectionOptions): SessionTreeRow[] {
  const query = options.search.toLowerCase().trim();
  const searchPathIds = collectSearchPathIds(options, query);
  const visibleSessions = options.sessions.filter((session) => (
    (options.showArchived || !session.archived) && (!query || searchPathIds.has(session.id))
  ));
  const childMap = createChildMap(visibleSessions);
  const roots = visibleSessions
    .filter((session) => !session.parentSessionId || !options.sessionMap.has(session.parentSessionId))
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const activePathIds = new Set(options.activeBranchTrail.map((session) => session.id));
  const isExpanded = (session: ChatSessionItem, depth: number) => query
    ? true
    : options.expandedNodes[session.id] ?? (depth === 0 || activePathIds.has(session.id));
  const rows: SessionTreeRow[] = [];
  roots.forEach((root) => appendTreeRows(root, 0, rows, childMap, isExpanded));
  return rows;
}
