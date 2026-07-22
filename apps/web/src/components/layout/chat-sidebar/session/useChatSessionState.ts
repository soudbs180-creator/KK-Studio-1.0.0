import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import {
  buildActiveBranchTrail,
  buildSessionTreeRows,
  cleanGreeting,
  createSessionMap,
  createWelcomeMessage,
  getFirstSubstantialQuestion,
  loadInitialChatSessions,
  loadSessionTreeExpansion,
  persistChatSessions,
  persistSessionTreeExpansion,
  type ChatSessionItem,
  type Message,
  type SessionTreeRow,
} from './chatSessionData';
import {
  applyChatContextCompression,
  type ChatContextCompressionResult,
} from './chatContextCompression';

interface ChatSessionStateOptions {
  messages: Message[];
  preferredKeyId?: string;
  selectedModelId: string;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  summarizeTitle: (question: string, modelId: string, preferredKeyId?: string) => Promise<string>;
}

interface ChatSessionState {
  activeBranchTrail: ChatSessionItem[];
  activeSession: ChatSessionItem | null;
  activeSessionId: string;
  expandedNodes: Record<string, boolean>;
  sessionSearch: string;
  sessionTreeRows: SessionTreeRow[];
  sessions: ChatSessionItem[];
  setActiveSessionId: Dispatch<SetStateAction<string>>;
  commitContextCompression: (sessionId: string, compression: ChatContextCompressionResult) => void;
  setExpandedNodes: Dispatch<SetStateAction<Record<string, boolean>>>;
  setSessionSearch: Dispatch<SetStateAction<string>>;
  setSessions: Dispatch<SetStateAction<ChatSessionItem[]>>;
  setShowArchived: Dispatch<SetStateAction<boolean>>;
  showArchived: boolean;
}

interface SessionMessageUpdate {
  sessions: ChatSessionItem[];
  summaryQuestion?: string;
}

function synchronizeActiveMessages(
  sessions: ChatSessionItem[],
  activeSessionId: string,
  setMessages: Dispatch<SetStateAction<Message[]>>,
  setActiveSessionId: Dispatch<SetStateAction<string>>,
): void {
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  if (!activeSession) {
    if (sessions.length > 0) setActiveSessionId(sessions[0].id);
    return;
  }
  setMessages((currentMessages) => {
    if (JSON.stringify(currentMessages) === JSON.stringify(activeSession.messages)) return currentMessages;
    return activeSession.messages?.length ? activeSession.messages : [createWelcomeMessage()];
  });
}

function applyMessagesToActiveSession(
  sessions: ChatSessionItem[],
  activeSessionId: string,
  messages: Message[],
): SessionMessageUpdate {
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  if (!activeSession || JSON.stringify(activeSession.messages) === JSON.stringify(messages)) return { sessions };
  const firstQuestion = getFirstSubstantialQuestion(messages);
  const shouldSummarize = Boolean(firstQuestion && !activeSession.customTitle);
  const updatedSessions = sessions.map((session) => {
    if (session.id !== activeSessionId) return session;
    const localTitle = shouldSummarize && firstQuestion
      ? cleanGreeting(firstQuestion.content).slice(0, 16) || '新对话'
      : session.title;
    return {
      ...session,
      messages,
      title: localTitle,
      customTitle: shouldSummarize ? true : session.customTitle,
      updatedAt: Date.now(),
    };
  });
  return { sessions: updatedSessions, summaryQuestion: shouldSummarize ? firstQuestion?.content : undefined };
}

async function applyGeneratedTitle(
  sessionId: string,
  question: string,
  options: ChatSessionStateOptions,
  setSessions: Dispatch<SetStateAction<ChatSessionItem[]>>,
): Promise<void> {
  const title = await options.summarizeTitle(question, options.selectedModelId, options.preferredKeyId);
  if (!title) return;
  setSessions((sessions) => sessions.map((session) => session.id === sessionId ? {
    ...session,
    title,
    customTitle: true,
    updatedAt: Date.now(),
  } : session));
}

function useActiveSessionSynchronization(
  sessions: ChatSessionItem[],
  activeSessionId: string,
  setMessages: Dispatch<SetStateAction<Message[]>>,
  setActiveSessionId: Dispatch<SetStateAction<string>>,
): void {
  useEffect(() => {
    synchronizeActiveMessages(sessions, activeSessionId, setMessages, setActiveSessionId);
  }, [activeSessionId, sessions, setActiveSessionId, setMessages]);
}

function useMessagesToActiveSession(
  sessions: ChatSessionItem[],
  activeSessionId: string,
  options: ChatSessionStateOptions,
  setSessions: Dispatch<SetStateAction<ChatSessionItem[]>>,
): void {
  const previousActiveSessionId = useRef(activeSessionId);
  const summarizingSessionIds = useRef(new Set<string>());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  useEffect(() => {
    if (previousActiveSessionId.current !== activeSessionId) {
      previousActiveSessionId.current = activeSessionId;
      return;
    }
    const update = applyMessagesToActiveSession(sessionsRef.current, activeSessionId, options.messages);
    if (update.sessions === sessionsRef.current) return;
    sessionsRef.current = update.sessions;
    setSessions(update.sessions);
    if (!update.summaryQuestion || summarizingSessionIds.current.has(activeSessionId)) return;
    summarizingSessionIds.current.add(activeSessionId);
    void applyGeneratedTitle(activeSessionId, update.summaryQuestion, options, setSessions);
  }, [
    activeSessionId,
    options.messages,
    options.preferredKeyId,
    options.selectedModelId,
    options.summarizeTitle,
    setSessions,
  ]);
}

function useSessionPersistence(
  sessions: ChatSessionItem[],
  expandedNodes: Record<string, boolean>,
): void {
  useEffect(() => persistChatSessions(sessions), [sessions]);
  useEffect(() => persistSessionTreeExpansion(expandedNodes), [expandedNodes]);
}

/** Owns persisted chat sessions, active-message synchronization and the history tree projection. */
export function useChatSessionState(options: ChatSessionStateOptions): ChatSessionState {
  const [sessions, setSessions] = useState<ChatSessionItem[]>(loadInitialChatSessions);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id || `session_${Date.now()}`);
  const [sessionSearch, setSessionSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(loadSessionTreeExpansion);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const commitContextCompression = (sessionId: string, compression: ChatContextCompressionResult) => {
    setSessions((currentSessions) => applyChatContextCompression(currentSessions, sessionId, compression));
    if (activeSessionIdRef.current !== sessionId) return;
    options.setMessages((currentMessages) => currentMessages.some((message) => (
      message.id === compression.boundaryMessage.id
    )) ? currentMessages : [...currentMessages, compression.boundaryMessage]);
  };
  const sessionMap = useMemo(() => createSessionMap(sessions), [sessions]);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );
  const activeBranchTrail = useMemo(
    () => buildActiveBranchTrail(activeSession, sessionMap),
    [activeSession, sessionMap],
  );
  const sessionTreeRows = useMemo(() => buildSessionTreeRows({
    activeBranchTrail,
    expandedNodes,
    search: sessionSearch,
    sessionMap,
    sessions,
    showArchived,
  }), [activeBranchTrail, expandedNodes, sessionMap, sessionSearch, sessions, showArchived]);
  useActiveSessionSynchronization(sessions, activeSessionId, options.setMessages, setActiveSessionId);
  useMessagesToActiveSession(sessions, activeSessionId, options, setSessions);
  useSessionPersistence(sessions, expandedNodes);
  return {
    activeBranchTrail, activeSession, activeSessionId, expandedNodes, sessionSearch, sessionTreeRows,
    sessions, commitContextCompression, setActiveSessionId, setExpandedNodes,
    setSessionSearch, setSessions, setShowArchived, showArchived,
  };
}
