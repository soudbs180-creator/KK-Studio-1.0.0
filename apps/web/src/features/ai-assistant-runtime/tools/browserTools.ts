import type { AgentToolDefinition } from './ToolRegistry.ts';
import {
  browserBridgeAdapter,
  createBrowserBridgeCommand,
  sanitizeBrowserBridgeUrl,
} from '../browser/browserBridge.ts';
import { BROWSER_ACTIONS } from '../browser/browserActionCatalog.ts';

const getBridgeClient = (ctx: any) => ctx?.browserBridge;
const getBridgeSnapshot = (ctx: any) => ctx?.browserBridgeSnapshot || ctx?.browserAssistantSnapshot;

const {
  getStatus,
  openAssistant,
  extractProduct,
  generateExternal,
  publishDraft,
  writeBackDom
} = BROWSER_ACTIONS;

export const browserTools: AgentToolDefinition[] = [
  {
    name: getStatus.toolName,
    description: '读取 Browser Assistant 本地守护进程、Chrome 插件、平台和会话池状态',
    permission: getStatus.permission,
    inputSchema: {},
    handler: async (_input: unknown, ctx) => browserBridgeAdapter.getStatus({
      client: getBridgeClient(ctx),
      snapshot: getBridgeSnapshot(ctx)
    })
  },
  {
    name: openAssistant.toolName,
    description: '打开 Browser Assistant 设置页入口',
    permission: openAssistant.permission,
    inputSchema: {},
    handler: async (_input: unknown, ctx) => {
      if (typeof ctx?.onOpenSettings === 'function') {
        ctx.onOpenSettings('browser-assistant');
      }
      ctx?.notify?.success?.('已打开浏览器助手', '已切换到 Browser Assistant 与多端控制设置页。');
      return {
        status: 'opened',
        view: 'browser-assistant'
      };
    }
  },
  {
    name: extractProduct.toolName,
    description: '通过 Browser Bridge 提取外部商品页的标题、价格、主图和描述摘要',
    permission: extractProduct.permission,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        targets: {
          type: 'array',
          items: { type: 'string', enum: ['price', 'title', 'image', 'description'] }
        },
        label: { type: 'string' }
      },
      required: ['url']
    },
    handler: async (input: { url: string; targets?: string[]; label?: string }, ctx) => {
      const url = sanitizeBrowserBridgeUrl(input.url);
      const command = createBrowserBridgeCommand({
        kind: extractProduct.commandKind,
        target: url,
        payload: {
          targets: input.targets || ['price', 'title', 'image', 'description'],
          label: input.label
        },
        requiresUserGesture: extractProduct.requiresUserGesture
      });

      return browserBridgeAdapter.execute(command, {
        client: getBridgeClient(ctx),
        snapshot: getBridgeSnapshot(ctx)
      });
    }
  },
  {
    name: generateExternal.toolName,
    description: '通过已连接的 Browser Bridge 和外部网页平台会话池创建网页直通生图任务',
    permission: generateExternal.permission,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        platformId: { type: 'string' },
        count: { type: 'number' },
        sessionIds: { type: 'array', items: { type: 'string' } },
        sessionCount: { type: 'number' }
      },
      required: ['prompt']
    },
    handler: async (input: { prompt: string; platformId?: string; count?: number; sessionIds?: string[]; sessionCount?: number }, ctx) => {
      const command = createBrowserBridgeCommand({
        kind: generateExternal.commandKind,
        target: input.platformId || 'browser_generation_platform',
        payload: {
          prompt: input.prompt,
          platformId: input.platformId || 'leonardo',
          count: Math.max(1, Math.min(Number(input.count || 1), 20)),
          sessionIds: input.sessionIds || [],
          sessionCount: input.sessionCount
        },
        requiresUserGesture: generateExternal.requiresUserGesture
      });

      return browserBridgeAdapter.execute(command, {
        client: getBridgeClient(ctx),
        snapshot: getBridgeSnapshot(ctx)
      });
    }
  },
  {
    name: publishDraft.toolName,
    description: '通过 Browser Bridge 将素材保存到外部社媒草稿箱，不执行公开发布',
    permission: publishDraft.permission,
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        imageUrl: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['channelId']
    },
    handler: async (input: { channelId: string; imageUrl?: string; title?: string; body?: string }, ctx) => {
      const command = createBrowserBridgeCommand({
        kind: publishDraft.commandKind,
        target: input.channelId,
        payload: {
          imageUrl: input.imageUrl,
          title: input.title,
          body: input.body,
          publishMode: 'draft_only'
        },
        requiresUserGesture: publishDraft.requiresUserGesture
      });

      return browserBridgeAdapter.execute(command, {
        client: getBridgeClient(ctx),
        snapshot: getBridgeSnapshot(ctx)
      });
    }
  },
  {
    name: writeBackDom.toolName,
    description: '通过 Browser Bridge 将用户确认后的字段回写到当前外部网页 DOM',
    permission: writeBackDom.permission,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        title: { type: 'string' },
        price: { type: 'string' }
      },
      required: ['title', 'price']
    },
    handler: async (input: { target?: string; title: string; price: string }, ctx) => {
      const command = createBrowserBridgeCommand({
        kind: writeBackDom.commandKind,
        target: input.target || 'active_tab',
        payload: {
          title: input.title,
          price: input.price
        },
        requiresUserGesture: writeBackDom.requiresUserGesture
      });

      return browserBridgeAdapter.execute(command, {
        client: getBridgeClient(ctx),
        snapshot: getBridgeSnapshot(ctx)
      });
    }
  }
];
