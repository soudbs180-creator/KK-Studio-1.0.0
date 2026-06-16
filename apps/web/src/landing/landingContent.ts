// 简体中文：Landing Page 中英文文案与模块化配置数据源
export interface LocaleText {
  zh: string;
  en: string;
}

export interface NavItem {
  label: LocaleText;
  href: string;
}

export interface UseCaseTag {
  label: LocaleText;
  category: 'ecommerce' | 'workflow' | 'model' | 'agent' | 'media';
}

export interface FeatureCard {
  id: string;
  num: string;
  badge: LocaleText;
  title: LocaleText;
  desc: LocaleText;
  color: string; // Clay block color
}

export interface ProcessStep {
  num: string;
  title: LocaleText;
  desc: LocaleText;
}

export const navItems: NavItem[] = [
  { label: { zh: '无限画布', en: 'Canvas' }, href: '#canvas-preview' },
  { label: { zh: '产品叙事', en: 'Narrative' }, href: '#narrative' },
  { label: { zh: '生产流', en: 'Process' }, href: '#process' },
  { label: { zh: '模型路由', en: 'Models' }, href: '#models' },
  { label: { zh: '积分说明', en: 'Pricing' }, href: '#pricing' }
];

export const heroBadges: LocaleText[] = [
  { zh: '多模态 AI 画布', en: 'Multimodal AI Canvas' },
  { zh: '智能路由中继', en: 'Model Routing' },
  { zh: 'Agent 协同生产', en: 'Agent Workflow' }
];

export const useCaseTags: UseCaseTag[] = [
  { label: { zh: '电商批量素材生成', en: 'Bulk Ecommerce Assets' }, category: 'ecommerce' },
  { label: { zh: '商品主图智能延展', en: 'Product Image Expansion' }, category: 'ecommerce' },
  { label: { zh: 'Prompt 节点化排版', en: 'Visual Prompt Composing' }, category: 'workflow' },
  { label: { zh: '全球顶尖大模型路由', en: 'Model Relay & Routing' }, category: 'model' },
  { label: { zh: 'PPT 页面生成与编辑', en: 'PPT Layout Generation' }, category: 'media' },
  { label: { zh: '多模型并发结果对比', en: 'Multi-Model Benchmarking' }, category: 'model' },
  { label: { zh: '局部重绘选区编辑', en: 'Inpainting Canvas Selection' }, category: 'media' },
  { label: { zh: '任务级 Agent 自动接管', en: 'Durable Agent Execution' }, category: 'agent' },
  { label: { zh: '电商商品切图与抠图', en: 'Ecommerce Background Removal' }, category: 'ecommerce' },
  { label: { zh: '参考图库多节点管理', en: 'Visual Reference Hub' }, category: 'workflow' }
];

export const featureCards: FeatureCard[] = [
  {
    id: 'infinite-canvas',
    num: '01',
    badge: { zh: '无限创意空间', en: 'Infinite Canvas' },
    title: { zh: '在同一张画布上组织 Prompt、参考图与生成资产', en: 'Arrange Prompts, references, and results on a single board' },
    desc: {
      zh: '打破传统聊天框的维度限制。在无限可缩放画布中，你可以自由地框选图片、将图片连线作为参考注入 Prompt 节点，让所有的灵感、实验状态与批量任务流可视化排版。',
      en: 'Break free from the chat box. On an infinite, zoomable canvas, wire up images as prompt inputs, group elements, and organize your complete production steps visually.'
    },
    color: '#ff4d8b' // Pink
  },
  {
    id: 'model-routing',
    num: '02',
    badge: { zh: '中立接入与智能路由', en: 'Model Routing' },
    title: { zh: '统一管理 API 与自有密钥，无缝热切各供应商模型', en: 'Manage APIs and credentials, hot-swap model endpoints seamlessly' },
    desc: {
      zh: '无需忍受平台方专有协议绑死。支持 OpenAI、Claude、DeepSeek 等顶尖模型中继，支持配置个人专属密钥，智能适配多模态模型输入输出，保证创作无边界、计费可审计。',
      en: 'No vendor lock-in. Relay to OpenAI, Claude, DeepSeek, and custom endpoints under unified schemas. Toggle models dynamically and secure your API credentials locally.'
    },
    color: '#b8a4ed' // Lavender
  },
  {
    id: 'ecommerce-workflow',
    num: '03',
    badge: { zh: '电商批量流水线', en: 'Ecommerce Workflow' },
    title: { zh: '导入商品原图与排版规格，自动批量输出电商素材', en: 'Import product images, auto-generate batch ecommerce assets' },
    desc: {
      zh: '专为电商团队打造的商业级素材流水线。从商品抠图、场景 Prompt 套用、多维版面排布到多模型并行生成，KK Studio 支持以结构化表格管理批量任务，一键打包导出 ZIP 原图。',
      en: 'A commercial-grade material pipeline built for ecommerce. From auto-background removal to prompt templating and batch generation, KK Studio handles raw assets with ease.'
    },
    color: '#ffb084' // Peach
  },
  {
    id: 'agent-runtime',
    num: '04',
    badge: { zh: '智能体异步接管', en: 'Agent Runtime' },
    title: { zh: '基于画布感知的 Agent 执行引擎，自主流转创作任务', en: 'State-aware Agent runtime executing complex task lists' },
    desc: {
      zh: 'KK Studio 配备先进 of Agent 自动化接管逻辑。通过声明式 ToolRegistry 工具箱与 CanvasRuntimeState 视口感知，Agent 可以自主规划批处理任务、轮询队列，即使暂时离线，生产依然继续。',
      en: 'Equipped with a high-fault-tolerant Agent runtime. Driven by standard ToolRegistry and CanvasRuntimeState, the agent plans multi-step pipelines and resolves errors asynchronously.'
    },
    color: '#a4d4c5' // Teal
  }
];

export const processSteps: ProcessStep[] = [
  {
    num: '01',
    title: { zh: '输入与捕获 / Capture', en: 'Capture Ideas & Files' },
    desc: {
      zh: '双击画布快速创建节点，或将本地参考图、电商商品原图、需求文件一键拖拽入无限画布，将创作素材转化为可视化资产。',
      en: 'Double-click to create nodes, or drag references, raw product images, and requirements documents directly onto the canvas to capture your workspace state.'
    }
  },
  {
    num: '02',
    title: { zh: '编排与连线 / Compose', en: 'Compose Pipelines' },
    desc: {
      zh: '通过直观的节点连线将参考图、基础 Prompt 与模型路由卡片连接，让模型的路由规则、生成条件和批处理队列跃然纸上。',
      en: 'Draw connection links between reference nodes, base prompt inputs, and routing cards. Visualizing model routing and batch queues simplifies configuration.'
    }
  },
  {
    num: '03',
    title: { zh: '调度与生成 / Generate', en: 'Generate at Scale' },
    desc: {
      zh: '并发调度多模型提供商进行大批量图片生成、视频渲染或 PPT 文档排版。你可以通过能量轨迹和状态进度条精准把控全局进度。',
      en: 'Dispatch batch generation across multiple suppliers. Monitor real-time status bars and watch render processes execute parallelly in prompt group cards.'
    }
  },
  {
    num: '04',
    title: { zh: '审计与管治 / Govern', en: 'Audit & Govern' },
    desc: {
      zh: '基于用户自有密钥进行额度扣减与细粒度积分预扣审计，失败任务自动全额退回，提供企业级的任务安全审计与生产管理。',
      en: 'Track token usage with real-time balance pre-deduction and transactional audit logs. Failsafe auto-refund secures billing and guarantees stable production.'
    }
  }
];

export const ctaCopy = {
  title: { zh: '以 Prompt 启程，编排为高生产力工作流。', en: 'Start with a prompt. Scale into a workflow.' },
  subtitle: {
    zh: 'KK Studio 将一次性 AI 试验，改造为可批量、可管理、可审计的生产级创作工作系统。',
    en: 'Upgrade one-time AI generations into a reusable, batch-driven, and fully-auditable production operating system.'
  },
  primaryBtn: { zh: '立即进入工作台', en: 'Start Creating' },
  secondaryBtn: { zh: '查看配置指南', en: 'Configure APIs' }
};
