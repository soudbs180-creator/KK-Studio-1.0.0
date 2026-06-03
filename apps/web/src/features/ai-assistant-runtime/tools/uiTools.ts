// 简体中文：UI交互与布局变更相关的 AI 助手工具 (UI Tools)

import type { AgentToolDefinition } from './ToolRegistry.ts';
import { knowledgeStore } from '../knowledge/KnowledgeStore.ts';

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
      
      const locateFn = (window as any).__KK_LOCATE_API_CARD__;
      if (locateFn) {
        const ok = locateFn(idOrName);
        if (ok) {
          notify.success(`已为您定位到供应商卡片: ${idOrName}`, '');
        } else {
          notify.warning(`未找到匹配的供应商卡片: ${idOrName}`, '');
        }
      } else {
        notify.warning('API 定位功能未就绪，请先进入设置页面', '');
      }
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

      if (onOpenSettings) {
        onOpenSettings(tab);
      } else {
        notify.warning('无法打开设置面板');
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

      if (setConfig) {
        setConfig((prev: any) => ({
          ...prev,
          prompt: prompt
        }));
        notify.success('输入框已填入优化提示词', '');
      } else {
        notify.warning('未绑定输入配置', '');
      }
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

      if (setConfig) {
        setConfig((prev: any) => ({
          ...prev,
          mode: mode
        }));
        notify.success(`已切换至【${mode === 'image' ? '图片' : mode === 'video' ? '视频' : mode === 'audio' ? '音频' : mode === 'ppt' ? 'PPT' : '电商'}】模式`, '');
      } else {
        notify.warning('未绑定输入配置', '');
      }
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
  }
];
