import type { ToolPermission } from '../../ai-takeover/types.ts';
import type { BrowserBridgeCommandKind } from './browserBridge.ts';

export type BrowserToolName =
  | 'browser.getStatus'
  | 'browser.openAssistant'
  | 'browser.extractProduct'
  | 'browser.generateExternal'
  | 'browser.publishDraft'
  | 'browser.writeBackDom';

export interface BrowserActionDefinition {
  key: string;
  toolName: BrowserToolName;
  commandKind?: BrowserBridgeCommandKind;
  permission: ToolPermission;
  label: string;
  requiresUserGesture: boolean;
}

export const BROWSER_ACTIONS = {
  getStatus: {
    key: 'getStatus',
    toolName: 'browser.getStatus',
    commandKind: 'get_status',
    permission: 'safe',
    label: '检查 Browser Bridge 连接状态',
    requiresUserGesture: false
  },
  openAssistant: {
    key: 'openAssistant',
    toolName: 'browser.openAssistant',
    commandKind: undefined,
    permission: 'safe',
    label: '打开 Browser Assistant 设置页',
    requiresUserGesture: false
  },
  extractProduct: {
    key: 'extractProduct',
    toolName: 'browser.extractProduct',
    commandKind: 'extract_product',
    permission: 'confirm',
    label: '提取外部商品页摘要',
    requiresUserGesture: true
  },
  generateExternal: {
    key: 'generateExternal',
    toolName: 'browser.generateExternal',
    commandKind: 'generate_external',
    permission: 'confirm',
    label: '外部网页直通生图',
    requiresUserGesture: true
  },
  publishDraft: {
    key: 'publishDraft',
    toolName: 'browser.publishDraft',
    commandKind: 'publish_draft',
    permission: 'confirm',
    label: '保存外部社媒草稿',
    requiresUserGesture: true
  },
  writeBackDom: {
    key: 'writeBackDom',
    toolName: 'browser.writeBackDom',
    commandKind: 'write_back_dom',
    permission: 'dangerous',
    label: '回写外部网页 DOM',
    requiresUserGesture: true
  }
} as const satisfies Record<string, BrowserActionDefinition>;

export const BROWSER_ACTION_LIST = Object.values(BROWSER_ACTIONS);

export const getBrowserActionByToolName = (toolName: BrowserToolName): BrowserActionDefinition | undefined =>
  BROWSER_ACTION_LIST.find(action => action.toolName === toolName);

export const getBrowserActionByCommandKind = (
  commandKind: BrowserBridgeCommandKind
): BrowserActionDefinition | undefined =>
  BROWSER_ACTION_LIST.find(action => action.commandKind === commandKind);

export type BrowserLocalAgentToolName = 'canvas.createPromptCards' | 'assets.zipOriginals';

export interface BrowserLocalActionDefinition {
  key: string;
  actionName: string;
  agentToolName?: BrowserLocalAgentToolName;
  label: string;
  requiresUserGesture: boolean;
}

export const BROWSER_LOCAL_ACTIONS = {
  importProductToCanvas: {
    key: 'importProductToCanvas',
    actionName: 'import-product-cards',
    agentToolName: 'canvas.createPromptCards',
    label: 'Import extracted product into the canvas',
    requiresUserGesture: true
  },
  createCanvasPromptCard: {
    key: 'createCanvasPromptCard',
    actionName: 'import-product-cards',
    agentToolName: 'canvas.createPromptCards',
    label: 'Create canvas prompt cards from Browser Assistant results',
    requiresUserGesture: true
  },
  zipOriginals: {
    key: 'zipOriginals',
    actionName: 'zip-originals',
    agentToolName: 'assets.zipOriginals',
    label: 'Package original assets as ZIP',
    requiresUserGesture: true
  },
  locateZippedFile: {
    key: 'locateZippedFile',
    actionName: 'locate-zipped-file',
    agentToolName: undefined,
    label: 'Locate the exported ZIP file',
    requiresUserGesture: true
  },
  runPipeline: {
    key: 'runPipeline',
    actionName: 'run-pipeline',
    agentToolName: undefined,
    label: 'Run Browser Assistant product pipeline',
    requiresUserGesture: true
  },
  importClipboardPayload: {
    key: 'importClipboardPayload',
    actionName: 'import-clipboard',
    agentToolName: undefined,
    label: 'Import sensed clipboard payload into the canvas',
    requiresUserGesture: true
  }
} as const satisfies Record<string, BrowserLocalActionDefinition>;

export const BROWSER_LOCAL_ACTION_LIST = Object.values(BROWSER_LOCAL_ACTIONS);

export type BrowserLocalActionName = (typeof BROWSER_LOCAL_ACTION_LIST)[number]['actionName'];

export const getBrowserLocalActionByActionName = (
  actionName: BrowserLocalActionName
): BrowserLocalActionDefinition | undefined =>
  BROWSER_LOCAL_ACTION_LIST.find(action => action.actionName === actionName);
