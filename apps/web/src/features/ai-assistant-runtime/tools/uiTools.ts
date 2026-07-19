// 简体中文：UI交互与布局变更相关的 AI 助手工具 (UI Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { knowledgeStore } from '../knowledge/KnowledgeStore.ts';

// ==========================================
// 1. 布局变更节流双缓冲池 (rAF Layout Throttle)
// ==========================================
const pendingLayoutUpdates = new Map<string, any>();
let layoutAnimationFrameId: number | null = null;

const applyPendingLayoutUpdates = (updateToolWindowLayout: Function) => {
  layoutAnimationFrameId = null;
  pendingLayoutUpdates.forEach((layoutInput, instanceId) => {
    try {
      updateToolWindowLayout(instanceId, layoutInput);
    } catch (e) {
      console.error(`[rAF Layout] Failed to update layout for ${instanceId}:`, e);
    }
  });
  pendingLayoutUpdates.clear();
};

const capabilityUnavailable = (message: string, setupAction = 'open-workspace') => ({
  success: false as const,
  code: 'CAPABILITY_UNAVAILABLE' as const,
  message,
  setupAction
});

// ==========================================
// 2. 原生音频控制总线 (Exclusive Audio Broker)
// ==========================================
interface KkAudioBroker {
  instances: Map<string, HTMLAudioElement>;
  register: (nodeId: string, audioEl: HTMLAudioElement) => void;
  unregister: (nodeId: string) => void;
  play: (nodeId: string) => void;
  pauseAllExcept: (nodeId: string) => void;
}

if (typeof window !== 'undefined' && !(window as any).__KK_AUDIO_BROKER__) {
  const instances = new Map<string, HTMLAudioElement>();
  (window as any).__KK_AUDIO_BROKER__ = {
    instances,
    register: (nodeId: string, audioEl: HTMLAudioElement) => {
      instances.set(nodeId, audioEl);
    },
    unregister: (nodeId: string) => {
      const el = instances.get(nodeId);
      if (el) {
        try {
          el.pause();
          el.src = ''; // 显式置空资源，阻断内存泄漏
          el.load();
        } catch {}
      }
      instances.delete(nodeId);
    },
    play: (nodeId: string) => {
      instances.forEach((el, id) => {
        if (id !== nodeId) {
          try {
            el.pause();
          } catch {}
        }
      });
      const target = instances.get(nodeId);
      if (target) {
        target.play().catch(e => console.warn('[AudioBroker] Play failed:', e));
      }
    },
    pauseAllExcept: (nodeId: string) => {
      instances.forEach((el, id) => {
        if (id !== nodeId) {
          try {
            el.pause();
          } catch {}
        }
      });
    }
  } as KkAudioBroker;
}

// ==========================================
// 3. Iframe 垃圾回收与多实例控制 (Iframe Reclaimer)
// ==========================================
if (typeof window !== 'undefined' && !(window as any).__KK_IFRAME_REGISTRY__) {
  const activeIframes = new Map<string, HTMLIFrameElement>();
  (window as any).__KK_IFRAME_REGISTRY__ = {
    activeIframes,
    register: (instanceId: string, iframeEl: HTMLIFrameElement) => {
      activeIframes.set(instanceId, iframeEl);
    },
    unregister: (instanceId: string) => {
      const iframe = activeIframes.get(instanceId);
      if (iframe) {
        try {
          iframe.onload = null;
          iframe.src = 'about:blank';
          if (iframe.contentWindow) {
            try {
              iframe.contentWindow.document.write('');
              iframe.contentWindow.close();
            } catch {}
          }
          iframe.remove();
        } catch (e) {
          console.warn('[IframeRegistry] Error reclaiming iframe:', e);
        }
      }
      activeIframes.delete(instanceId);
    }
  };
}

export const uiTools: AgentToolDefinition[] = [
  // 1. highlightElement - DOM 元素高亮
  {
    name: 'highlightElement',
    description: '通过 CSS 选择器高亮界面元素并为其附加呼吸特效框',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '高亮目标 DOM 的 CSS 选择器' }
      },
      required: ['selector']
    },
    handler: async (input: { selector: string }) => {
      const { selector } = input;
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        return capabilityUnavailable('DOM highlight host is not available.');
      }

      setTimeout(() => {
        const el = document.querySelector(selector) as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const triggerMaskHighlight = (window as any).triggerMaskHighlight;
          if (triggerMaskHighlight) {
            triggerMaskHighlight(el);
          } else {
            // 降级使用普通的闪烁高亮类
            el.classList.add('highlight-glow-ring');
            setTimeout(() => {
              el.classList.remove('highlight-glow-ring');
            }, 3000);
          }
        }
      }, 200);
      return {
        status: 'scheduled',
        selector
      };
    }
  },

  // 1.5. locateApiCard - 定位 API 供应商卡片
  {
    name: 'locateApiCard',
    description: '通过 API 供应商 ID 或名称定位其卡片，并自动滚动且进行磨砂高亮显示',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        idOrName: { type: 'string', description: 'API 供应商 ID 或名称（如 deepseek-1007-1 或 智谱）' }
      },
      required: ['idOrName']
    },
    handler: async (input: { idOrName: string }, ctx) => {
      const { idOrName } = input;
      const { notify } = ctx;
      
      const locateFn = typeof window !== 'undefined' ? (window as any).__KK_LOCATE_API_CARD__ : null;
      if (typeof locateFn !== 'function') {
        notify.warning('API 定位功能未就绪，请先进入设置页面', '');
        return capabilityUnavailable('API provider card locator is not bound.', 'open-settings');
      }

      const ok = locateFn(idOrName);
      if (!ok) {
        notify.warning(`未找到匹配的供应商卡片: ${idOrName}`, '');
        return {
          success: false as const,
          code: 'NOT_FOUND' as const,
          message: `API provider card not found: ${idOrName}`
        };
      }

      notify.success(`已为您定位到供应商卡片: ${idOrName}`, '');
      return {
        status: 'located',
        idOrName
      };
    }
  },

  // 2. openSettings - 打开系统设置
  {
    name: 'openSettings',
    description: '打开 KK Studio 全局设置页面并导航到指定子页签',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        tab: { type: 'string', description: '导航页面名称，例如 api-management' }
      },
      required: ['tab']
    },
    handler: async (input: { tab: string }, ctx) => {
      const { tab } = input;
      const { onOpenSettings, notify } = ctx;

      if (typeof onOpenSettings !== 'function') {
        notify.warning('无法打开设置面板');
        return capabilityUnavailable('Settings host handler is not bound.', 'open-settings');
      }

      onOpenSettings(tab);
      return {
        status: 'opened',
        tab
      };
    }
  },

  // 2.5. navigateToSurface - 顶级页面表面切换跳转
  {
    name: 'ui.navigateToSurface',
    description: '辅助用户智能跳转切换至不同顶级工作表面，如主画布、素材库、收藏夹、个人中心、后台管理等',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        surface: { 
          type: 'string', 
          enum: ['workspace', 'library', 'favorites', 'profile', 'settings', 'admin'],
          description: '目标切换页面' 
        }
      },
      required: ['surface']
    },
    handler: async (input: { surface: string }, ctx) => {
      const { surface } = input;
      const { 
        focusWorkspace, 
        openLibrarySurface, 
        openFavoritesSurface, 
        openProfileSurface, 
        onOpenSettings,
        notify 
      } = ctx;

      switch (surface) {
        case 'workspace':
          if (focusWorkspace) {
            focusWorkspace();
            notify.success('已为您跳转至主画布工作区', '');
            return { status: 'navigated', surface };
          } else {
            notify.warning('无法执行画布跳转');
            return capabilityUnavailable('Workspace focus host handler is not bound.');
          }
        case 'library':
          if (openLibrarySurface) {
            openLibrarySurface();
            notify.success('已为您打开素材库', '');
            return { status: 'navigated', surface };
          } else {
            notify.warning('无法执行素材库跳转');
            return capabilityUnavailable('Library surface host handler is not bound.');
          }
        case 'favorites':
          if (openFavoritesSurface) {
            openFavoritesSurface();
            notify.success('已为您打开收藏夹', '');
            return { status: 'navigated', surface };
          } else {
            notify.warning('无法执行收藏夹跳转');
            return capabilityUnavailable('Favorites surface host handler is not bound.');
          }
        case 'profile':
          if (openProfileSurface) {
            openProfileSurface('main');
            notify.success('已为您打开个人中心', '');
            return { status: 'navigated', surface };
          } else {
            notify.warning('无法执行个人中心跳转');
            return capabilityUnavailable('Profile surface host handler is not bound.');
          }
        case 'settings':
          if (onOpenSettings) {
            onOpenSettings('dashboard');
            notify.success('已为您打开系统设置', '');
            return { status: 'navigated', surface };
          } else {
            notify.warning('无法执行设置跳转');
            return capabilityUnavailable('Settings surface host handler is not bound.', 'open-settings');
          }
        case 'admin':
          if (typeof window === 'undefined') {
            notify.warning('无法执行后台跳转');
            return capabilityUnavailable('Browser navigation host is not available.');
          }
          window.history.pushState(null, '', '/admin');
          window.dispatchEvent(new CustomEvent('kk-app-locationchange'));
          notify.success('已为您跳转到后台管理页面', '');
          return { status: 'navigated', surface };
        default:
          notify.warning(`未知的跳转表面: ${surface}`);
          return {
            success: false as const,
            code: 'INVALID_INPUT' as const,
            message: `Unknown surface: ${surface}`
          };
      }
    }
  },

  // 3. fillInputPrompt - 填充提示词输入框
  {
    name: 'fillInputPrompt',
    description: '优化输入框提示词',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '提示词' }
      },
      required: ['prompt']
    },
    handler: async (input: { prompt: string }, ctx) => {
      const { prompt } = input;
      const { setConfig, notify } = ctx;

      if (typeof setConfig !== 'function') {
        notify.warning('未绑定输入配置', '');
        return capabilityUnavailable('Prompt input host config setter is not bound.');
      }

      await Promise.resolve(setConfig((prev: any) => ({
        ...prev,
        prompt: prompt
      })));
      notify.success('输入框已填入优化提示词', '');
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: 'filled'
      };
    }
  },

  // 4. changeMode - 切换模式
  {
    name: 'changeMode',
    description: '切换当前画布生成模式',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: '模式' }
      },
      required: ['mode']
    },
    handler: async (input: { mode: any }, ctx) => {
      const { mode } = input;
      const { setConfig, notify } = ctx;

      if (typeof setConfig !== 'function') {
        notify.warning('未绑定输入配置', '');
        return capabilityUnavailable('Generation mode host config setter is not bound.');
      }

      await Promise.resolve(setConfig((prev: any) => ({
        ...prev,
        mode: mode
      })));
      notify.success(`已切换至【${mode === 'image' ? '图片' : mode === 'video' ? '视频' : mode === 'audio' ? '音频' : mode === 'ppt' ? 'PPT' : '电商'}】模式`, '');
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: 'changed',
        mode
      };
    }
  },

  // 5. ui.recordLayoutChange - 记录 UI 布局变更
  {
    name: 'ui.recordLayoutChange',
    description: '记录 UI 入口、选择器、面板位置或布局变更，供 ui-map 和后续 Agent 同步',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        component: { type: 'string' },
        summary: { type: 'string' },
        selector: { type: 'string' },
        previousLocation: { type: 'string' },
        newLocation: { type: 'string' },
        affectedTools: { type: 'array', items: { type: 'string' } },
        validation: { type: 'array', items: { type: 'string' } }
      },
      required: ['component', 'summary']
    },
    handler: async (input: any) => knowledgeStore.recordLayoutChange(input)
  },
  {
    name: 'ui.switchPptEditorMode',
    description: '切换 PPT 编辑器的显示模式（缩略图列表与大纲编辑）',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['thumbnail', 'outline'] }
      },
      required: ['mode']
    },
    handler: async (input: { mode: 'thumbnail' | 'outline' }, ctx) => {
      const { setPptEditorMode, notify } = ctx;
      if (typeof setPptEditorMode !== 'function') {
        notify.warning('PPT 编辑器模式切换能力未接入', '');
        return capabilityUnavailable('PPT editor mode host handler is not bound.');
      }

      await Promise.resolve(setPptEditorMode(input.mode));
      notify.success('编辑器模式已切换', `已成功切换为 PPT ${input.mode === 'outline' ? '大纲' : '缩略图'}编辑模式。`);
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: 'changed',
        mode: input.mode
      };
    }
  },
  {
    name: 'ui.openToolWindow',
    description: '打开工具箱中的外部 Iframe 工具或 React 内部组件窗口',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        toolId: { type: 'string', description: '工具唯一标识' },
        url: { type: 'string', description: '外部 Iframe URL（若为外部工具）' },
        options: { type: 'object', description: '窗口初始化大小、位置等参数' }
      },
      required: ['toolId']
    },
    handler: async (input: { toolId: string; url?: string; options?: any }, ctx) => {
      const { openToolWindowInstance, notify } = ctx;
      if (typeof openToolWindowInstance !== 'function') {
        notify.warning('工具窗口能力未接入', '');
        return capabilityUnavailable('Tool window host handler is not bound.');
      }

      await openToolWindowInstance(input.toolId, input.url, input.options);
      notify.success('工具窗口已打开', `工具 ${input.toolId} 窗口实例创建成功。`);
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: 'opened',
        toolId: input.toolId
      };
    }
  },
  {
    name: 'ui.pinTool',
    description: '常驻或取消常驻工具箱中的特定工具至侧边常驻栏',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        toolId: { type: 'string' },
        pinned: { type: 'boolean' }
      },
      required: ['toolId', 'pinned']
    },
    handler: async (input: { toolId: string; pinned: boolean }, ctx) => {
      const { togglePinTool, notify } = ctx;
      if (typeof togglePinTool !== 'function') {
        notify.warning('工具常驻能力未接入', '');
        return capabilityUnavailable('Tool pin host handler is not bound.');
      }

      await Promise.resolve(togglePinTool(input.toolId, input.pinned));
      notify.success(input.pinned ? '工具已常驻' : '已取消工具常驻', '');
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: input.pinned ? 'pinned' : 'unpinned',
        toolId: input.toolId
      };
    }
  },
  {
    name: 'ui.updateWindowLayout',
    description: '动态更新已打开工具窗口的位置、尺寸、最小化或置顶层级状态',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        minimized: { type: 'boolean' }
      },
      required: ['instanceId']
    },
    handler: async (input: { instanceId: string; x?: number; y?: number; width?: number; height?: number; minimized?: boolean }, ctx) => {
      const { updateToolWindowLayout, notify } = ctx;
      if (typeof updateToolWindowLayout !== 'function') {
        notify.warning('工具窗口布局能力未接入', '');
        return capabilityUnavailable('Tool window layout host handler is not bound.');
      }

      // 双缓冲合并最新状态到 rAF 渲染缓冲池中
      const existing = pendingLayoutUpdates.get(input.instanceId) || {};
      pendingLayoutUpdates.set(input.instanceId, { ...existing, ...input });

      if (!layoutAnimationFrameId) {
        layoutAnimationFrameId = requestAnimationFrame(() => applyPendingLayoutUpdates(updateToolWindowLayout));
      }

      if (input.minimized !== undefined) {
        notify.success(input.minimized ? '已最小化窗口' : '已还原窗口', '');
      }
      return {
        success: true as const,
        executionOutcome: 'success' as const,
        status: 'scheduled',
        instanceId: input.instanceId
      };
    }
  },
  {
    name: 'audio.playbackControl',
    description: '控制画布上音频多媒体播放器的播放、暂停或进度',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: '音频卡片节点 ID' },
        action: { type: 'string', enum: ['PLAY', 'PAUSE', 'STOP'] }
      },
      required: ['nodeId', 'action']
    },
    handler: async (input: { nodeId: string; action: 'PLAY' | 'PAUSE' | 'STOP' }, ctx) => {
      const { controlAudioPlayback, notify } = ctx;
      
      // 毫秒级原生排他性播放，消除重音叠音
      const broker = typeof window !== 'undefined' ? (window as any).__KK_AUDIO_BROKER__ : null;
      let handled = false;
      if (broker) {
        if (input.action === 'PLAY') {
          if (broker.instances?.has(input.nodeId)) {
            broker.play(input.nodeId);
            handled = true;
          }
        } else if (input.action === 'PAUSE' || input.action === 'STOP') {
          const target = broker.instances.get(input.nodeId);
          if (target) {
            try {
              target.pause();
              if (input.action === 'STOP') {
                target.currentTime = 0;
              }
            } catch {}
            handled = true;
          }
        }
      }

      if (typeof controlAudioPlayback === 'function') {
        controlAudioPlayback(input.nodeId, input.action);
        handled = true;
      }

      if (!handled) {
        notify.warning('音频播放控制能力未接入', '');
        return capabilityUnavailable('Audio playback host handler is not bound.');
      }

      notify.success(`音频指令 ${input.action} 执行成功`, '');
      return {
        status: 'controlled',
        nodeId: input.nodeId,
        action: input.action
      };
    }
  }
];
