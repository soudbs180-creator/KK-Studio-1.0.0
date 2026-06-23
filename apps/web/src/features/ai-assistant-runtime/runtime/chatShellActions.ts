// 简体中文：ChatSidebar 普通聊天外壳按钮的稳定动作目录，避免与 AI Takeover 专用动作混用。
type ChatShellActionDefinition = {
  uiAction: string;
  toolName?: string;
};

export const CHAT_SHELL_ACTIONS = {
  toggleSidebar: {
    uiAction: 'chat-toggle-sidebar',
    toolName: undefined,
  },
  closeMobileSidebar: {
    uiAction: 'chat-close-mobile-sidebar',
    toolName: undefined,
  },
  selectModel: {
    uiAction: 'chat-select-model',
    toolName: undefined,
  },
  renameCurrentSession: {
    uiAction: 'chat-rename-current-session',
    toolName: undefined,
  },
  clearCurrentSession: {
    uiAction: 'chat-clear-current-session',
    toolName: undefined,
  },
  createTemporarySession: {
    uiAction: 'chat-create-temporary-session',
    toolName: undefined,
  },
  createSession: {
    uiAction: 'chat-create-session',
    toolName: undefined,
  },
  toggleHistoryPanel: {
    uiAction: 'chat-toggle-history-panel',
    toolName: undefined,
  },
  exportSessions: {
    uiAction: 'chat-export-sessions',
    toolName: undefined,
  },
  importSessions: {
    uiAction: 'chat-import-sessions',
    toolName: undefined,
  },
  toggleArchivedSessions: {
    uiAction: 'chat-toggle-archived-sessions',
    toolName: undefined,
  },
  toggleSessionExpand: {
    uiAction: 'chat-toggle-session-expand',
    toolName: undefined,
  },
  switchSession: {
    uiAction: 'chat-switch-session',
    toolName: undefined,
  },
  renameSession: {
    uiAction: 'chat-rename-session',
    toolName: undefined,
  },
  duplicateSession: {
    uiAction: 'chat-duplicate-session',
    toolName: undefined,
  },
  archiveSession: {
    uiAction: 'chat-archive-session',
    toolName: undefined,
  },
  deleteSession: {
    uiAction: 'chat-delete-session',
    toolName: undefined,
  },
  editUserMessage: {
    uiAction: 'chat-edit-user-message',
    toolName: undefined,
  },
  editPreviousUserMessage: {
    uiAction: 'chat-edit-previous-user-message',
    toolName: undefined,
  },
  regenerateAssistantMessage: {
    uiAction: 'chat-regenerate-assistant-message',
    toolName: undefined,
  },
  branchFromMessage: {
    uiAction: 'chat-branch-from-message',
    toolName: undefined,
  },
  copyMessage: {
    uiAction: 'chat-copy-message',
    toolName: undefined,
  },
  removeAttachment: {
    uiAction: 'chat-remove-attachment',
    toolName: undefined,
  },
  openAttachmentMenu: {
    uiAction: 'chat-open-attachment-menu',
    toolName: undefined,
  },
  toggleAgentMode: {
    uiAction: 'chat-toggle-agent-mode',
    toolName: undefined,
  },
  stopGeneration: {
    uiAction: 'chat-stop-generation',
    toolName: undefined,
  },
  sendComposerMessage: {
    uiAction: 'chat-send-composer-message',
    toolName: undefined,
  },
  toggleImportPreviewAll: {
    uiAction: 'chat-toggle-import-preview-all',
    toolName: undefined,
  },
  toggleImportPreviewExcluded: {
    uiAction: 'chat-toggle-import-preview-excluded',
    toolName: undefined,
  },
  excludeVisibleImportSessions: {
    uiAction: 'chat-exclude-visible-import-sessions',
    toolName: undefined,
  },
  clearImportExcludedSessions: {
    uiAction: 'chat-clear-import-excluded-sessions',
    toolName: undefined,
  },
  importSessionsSmartMerge: {
    uiAction: 'chat-import-sessions-smart-merge',
    toolName: undefined,
  },
  importSessionsAppend: {
    uiAction: 'chat-import-sessions-append',
    toolName: undefined,
  },
  importSessionsReplace: {
    uiAction: 'chat-import-sessions-replace',
    toolName: undefined,
  },
  cancelSessionImportPreview: {
    uiAction: 'chat-cancel-session-import-preview',
    toolName: undefined,
  },
} as const satisfies Record<string, ChatShellActionDefinition>;

export type ChatShellActionKey = keyof typeof CHAT_SHELL_ACTIONS;
export type ChatShellUiAction = typeof CHAT_SHELL_ACTIONS[ChatShellActionKey]['uiAction'];
type ChatShellActionWithTool = Extract<typeof CHAT_SHELL_ACTIONS[ChatShellActionKey], { toolName: string }>;
export type ChatShellToolName = ChatShellActionWithTool extends never ? never : ChatShellActionWithTool['toolName'];
