// 简体中文：工具注册表与安全等级 (Tool Registry)

import { ToolPermission } from '../types';

export interface AssistantToolSchema {
  name: string;
  description: string;
  permission: ToolPermission;
  schema: any;
}

export const TOOL_REGISTRY: AssistantToolSchema[] = [
  {
    name: 'optimizePromptLocally',
    description: '在本地对用户的提示词进行模板匹配与效果词强化润色',
    permission: 'safe',
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: '提示词绘图主体' },
        style: { type: 'string', description: '附加画风说明' }
      },
      required: ['subject']
    }
  },
  {
    name: 'fillPrompt',
    description: '填充润色后的提示词到前端 Prompt 文本框中供后续使用',
    permission: 'safe',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '填充的提示词内容' },
        negativePrompt: { type: 'string', description: '负面词' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'locateCard',
    description: '在无限画布上查找匹配提示词的卡片，并将视口中心移动对齐聚焦它',
    permission: 'safe',
    schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '查找定位卡片的关键词' }
      },
      required: ['keyword']
    }
  },
  {
    name: 'highlightElement',
    description: '通过 CSS 选择器高亮界面元素并为其附加呼吸特效框',
    permission: 'safe',
    schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: '高亮目标 DOM 的 CSS 选择器' }
      },
      required: ['selector']
    }
  },
  {
    name: 'openSettings',
    description: '打开 KK Studio 全局设置页面并导航到指定子页签',
    permission: 'safe',
    schema: {
      type: 'object',
      properties: {
        tab: { type: 'string', description: '导航页面名称，例如 api-management' }
      },
      required: ['tab']
    }
  },
  {
    name: 'zipOutputs',
    description: '将生成导出的图片成果进行 ZIP 压缩，附加元数据清单并触发浏览器自动保存下载',
    permission: 'safe', // 普通打包是安全的
    schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['latest_batch', 'current_batch', 'selected_cards', 'all_canvas_outputs'], description: '打包范围' }
      },
      required: ['scope']
    }
  },
  {
    name: 'startGeneration',
    description: '使用当前选中的模型启动绘图任务，在画布上新建卡片并拉起图像生成',
    permission: 'confirm',
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '绘图英文提示词' },
        count: { type: 'number', description: '生成的数量张数' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'startBatchGeneration',
    description: '绑定图片资源文件夹，为每张图片依次拉起重绘生成任务并创建卡片',
    permission: 'confirm',
    schema: {
      type: 'object',
      properties: {
        plan: { type: 'object', description: '批量生图完整执行计划' }
      },
      required: ['plan']
    }
  },
  {
    name: 'fillApiKey',
    description: '【禁止工具】出于绝对安全隔离原则，禁止 AI 自动填写密钥',
    permission: 'forbidden',
    schema: {}
  }
];

export const getToolRegistrySchemas = () => TOOL_REGISTRY;
