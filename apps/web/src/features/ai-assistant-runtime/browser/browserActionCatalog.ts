import type { ToolPermission } from '../../ai-takeover/types.ts';
import type { BrowserBridgeCommandKind } from './browserBridge.ts';

export type BrowserToolName =
  | 'browser.getStatus'
  | 'browser.openAssistant'
  | 'browser.extractProduct'
  | 'browser.generateExternal'
  | 'browser.publishDraft'
  | 'browser.inspectPage'
  | 'browser.openDesktopProject'
  | 'browser.checkLocalLlm'
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
  inspectPage: {
    key: 'inspectPage',
    toolName: 'browser.inspectPage',
    commandKind: 'inspect_page',
    permission: 'confirm',
    label: 'Inspect external browser viewport and sanitized DOM summary',
    requiresUserGesture: true
  },
  openDesktopProject: {
    key: 'openDesktopProject',
    toolName: 'browser.openDesktopProject',
    commandKind: 'open_desktop_project',
    permission: 'confirm',
    label: 'Open the current project in a connected desktop IDE through Browser Bridge',
    requiresUserGesture: true
  },
  checkLocalLlm: {
    key: 'checkLocalLlm',
    toolName: 'browser.checkLocalLlm',
    commandKind: 'check_local_llm',
    permission: 'safe',
    label: 'Check the local LLM gateway through Browser Bridge without direct browser probing',
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

export type BrowserLocalAgentToolName = 'canvas.createPromptCards' | 'assets.zipOriginals' | 'browser.getStatus';

export interface BrowserLocalActionDefinition {
  key: string;
  actionName: `browser.local.${string}`;
  agentToolName?: BrowserLocalAgentToolName;
  label: string;
  requiresUserGesture: boolean;
}

export const BROWSER_LOCAL_ACTIONS = {
  importProductToCanvas: {
    key: 'importProductToCanvas',
    actionName: 'browser.local.importProductToCanvas',
    agentToolName: 'canvas.createPromptCards',
    label: 'Import extracted product into the canvas',
    requiresUserGesture: true
  },
  createCanvasPromptCard: {
    key: 'createCanvasPromptCard',
    actionName: 'browser.local.createCanvasPromptCard',
    agentToolName: 'canvas.createPromptCards',
    label: 'Create canvas prompt cards from Browser Assistant results',
    requiresUserGesture: true
  },
  zipOriginals: {
    key: 'zipOriginals',
    actionName: 'browser.local.zipOriginals',
    agentToolName: 'assets.zipOriginals',
    label: 'Package original assets as ZIP',
    requiresUserGesture: true
  },
  locateZippedFile: {
    key: 'locateZippedFile',
    actionName: 'browser.local.locateZippedFile',
    agentToolName: undefined,
    label: 'Locate the exported ZIP file',
    requiresUserGesture: true
  },
  runPipeline: {
    key: 'runPipeline',
    actionName: 'browser.local.runPipeline',
    agentToolName: undefined,
    label: 'Run Browser Assistant product pipeline',
    requiresUserGesture: true
  },
  importClipboardPayload: {
    key: 'importClipboardPayload',
    actionName: 'browser.local.importClipboardPayload',
    agentToolName: 'canvas.createPromptCards',
    label: 'Import sensed clipboard payload into the canvas',
    requiresUserGesture: true
  },
  checkSessionStatus: {
    key: 'checkSessionStatus',
    actionName: 'browser.local.checkSessionStatus',
    agentToolName: 'browser.getStatus',
    label: 'Check Browser Bridge account session status',
    requiresUserGesture: true
  },
  toggleSessionEnabled: {
    key: 'toggleSessionEnabled',
    actionName: 'browser.local.toggleSessionEnabled',
    agentToolName: undefined,
    label: 'Toggle Browser Bridge account session scheduling',
    requiresUserGesture: true
  },
  addSessionInstance: {
    key: 'addSessionInstance',
    actionName: 'browser.local.addSessionInstance',
    agentToolName: undefined,
    label: 'Add a Browser Bridge account session instance',
    requiresUserGesture: true
  },
  checkSocialChannelStatus: {
    key: 'checkSocialChannelStatus',
    actionName: 'browser.local.checkSocialChannelStatus',
    agentToolName: 'browser.getStatus',
    label: 'Check Browser Bridge social draft channel status',
    requiresUserGesture: true
  },
  toggleSocialChannelEnabled: {
    key: 'toggleSocialChannelEnabled',
    actionName: 'browser.local.toggleSocialChannelEnabled',
    agentToolName: undefined,
    label: 'Toggle Browser Bridge social draft channel',
    requiresUserGesture: true
  },
  installPluginPackage: {
    key: 'installPluginPackage',
    actionName: 'browser.local.installPluginPackage',
    agentToolName: undefined,
    label: 'Open Browser Bridge offline extension install guidance',
    requiresUserGesture: true
  },
  toggleClipboardSync: {
    key: 'toggleClipboardSync',
    actionName: 'browser.local.toggleClipboardSync',
    agentToolName: undefined,
    label: 'Toggle Browser Assistant clipboard sensing',
    requiresUserGesture: true
  },
  readClipboardPayload: {
    key: 'readClipboardPayload',
    actionName: 'browser.local.readClipboardPayload',
    agentToolName: undefined,
    label: 'Read browser clipboard payload for canvas import',
    requiresUserGesture: true
  },
  toggleWasmSandbox: {
    key: 'toggleWasmSandbox',
    actionName: 'browser.local.toggleWasmSandbox',
    agentToolName: undefined,
    label: 'Toggle local WASM sandbox features',
    requiresUserGesture: true
  },
  translateInspectionToCanvas: {
    key: 'translateInspectionToCanvas',
    actionName: 'browser.local.translateInspectionToCanvas',
    agentToolName: 'canvas.createPromptCards',
    label: 'Translate Browser Bridge inspection summary into canvas prompt cards',
    requiresUserGesture: true
  },
  previewTakeoverPlan: {
    key: 'previewTakeoverPlan',
    actionName: 'browser.local.previewTakeoverPlan',
    agentToolName: undefined,
    label: 'Preview Browser Assistant routing through AgentRuntime',
    requiresUserGesture: true
  },
  setTakeoverSamplePrompt: {
    key: 'setTakeoverSamplePrompt',
    actionName: 'browser.local.setTakeoverSamplePrompt',
    agentToolName: undefined,
    label: 'Fill a Browser Assistant takeover sample prompt',
    requiresUserGesture: true
  },
  switchPlaygroundTab: {
    key: 'switchPlaygroundTab',
    actionName: 'browser.local.switchPlaygroundTab',
    agentToolName: undefined,
    label: 'Switch Browser Assistant runtime playground tab',
    requiresUserGesture: true
  },
  setRoutingMode: {
    key: 'setRoutingMode',
    actionName: 'browser.local.setRoutingMode',
    agentToolName: undefined,
    label: 'Set Browser Assistant model routing mode',
    requiresUserGesture: true
  },
  dismissClipboardPayload: {
    key: 'dismissClipboardPayload',
    actionName: 'browser.local.dismissClipboardPayload',
    agentToolName: undefined,
    label: 'Dismiss sensed clipboard payload',
    requiresUserGesture: true
  }
} as const satisfies Record<string, BrowserLocalActionDefinition>;

export const BROWSER_LOCAL_ACTION_LIST = Object.values(BROWSER_LOCAL_ACTIONS);

export type BrowserLocalActionName = (typeof BROWSER_LOCAL_ACTION_LIST)[number]['actionName'];

export const getBrowserLocalActionByActionName = (
  actionName: BrowserLocalActionName
): BrowserLocalActionDefinition | undefined =>
  BROWSER_LOCAL_ACTION_LIST.find(action => action.actionName === actionName);
