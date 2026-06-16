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

export interface WorkCard {
  id: string;
  num: string;
  eyebrow: LocaleText;
  title: LocaleText;
  desc: LocaleText;
  tags: LocaleText[];
  tone: 'coral' | 'lavender' | 'teal' | 'ochre';
}

export interface ProcessStep {
  num: string;
  title: LocaleText;
  desc: LocaleText;
}

export interface ThoughtItem {
  category: LocaleText;
  title: LocaleText;
  desc: LocaleText;
  meta: LocaleText;
}

export const navItems: NavItem[] = [
  { label: { zh: '作品', en: 'Work' }, href: '#work' },
  { label: { zh: '方法', en: 'Approach' }, href: '#approach' },
  { label: { zh: '能力', en: 'Services' }, href: '#services' },
  { label: { zh: '洞察', en: 'Thoughts' }, href: '#thoughts' },
  { label: { zh: '联系', en: 'Contact' }, href: '#contact' }
];

export const heroBadges: LocaleText[] = [
  { zh: 'Multimodal Canvas', en: 'Multimodal Canvas' },
  { zh: 'Model Routing', en: 'Model Routing' },
  { zh: 'Agent Workflow', en: 'Agent Workflow' }
];

export const trustHeadline: LocaleText = {
  zh: '为把 AI 从灵感推进到生产的团队而设计',
  en: 'Trusted by teams turning AI from spark into production'
};

export const useCaseTags: UseCaseTag[] = [
  { label: { zh: '电商批量素材', en: 'Bulk ecommerce assets' }, category: 'ecommerce' },
  { label: { zh: '商品主图生成', en: 'Product image generation' }, category: 'ecommerce' },
  { label: { zh: 'Prompt 可视化编排', en: 'Visual prompt composing' }, category: 'workflow' },
  { label: { zh: '多模型路由', en: 'Model routing' }, category: 'model' },
  { label: { zh: 'PPT 页面生产', en: 'PPT production' }, category: 'media' },
  { label: { zh: '视频与图像实验', en: 'Video and image studies' }, category: 'media' },
  { label: { zh: '局部重绘', en: 'Inpainting selection' }, category: 'media' },
  { label: { zh: 'Agent 自动接管', en: 'Agent handoff' }, category: 'agent' },
  { label: { zh: '参考图谱管理', en: 'Reference graph' }, category: 'workflow' },
  { label: { zh: '积分与任务审计', en: 'Credit audit' }, category: 'model' }
];

export const workCards: WorkCard[] = [
  {
    id: 'canvas-system',
    num: '01',
    eyebrow: { zh: 'Canvas System', en: 'Canvas System' },
    title: { zh: '把 Prompt、参考图与生成资产放进同一张工作画布。', en: 'Prompts, references and generated assets on one living canvas.' },
    desc: {
      zh: '不再用一次性聊天框管理复杂创作。KK Studio 用节点、连线、分组和缩放视口组织完整的 AI 生产上下文。',
      en: 'Move beyond one-off chat boxes. KK Studio uses nodes, links, groups and a zoomable viewport to keep the whole production context visible.'
    },
    tags: [
      { zh: '无限画布', en: 'Infinite canvas' },
      { zh: '节点编排', en: 'Node workflow' },
      { zh: '参考图', en: 'References' }
    ],
    tone: 'coral'
  },
  {
    id: 'model-relay',
    num: '02',
    eyebrow: { zh: 'Model Relay', en: 'Model Relay' },
    title: { zh: '在同一界面里切换模型、密钥与供应商路由。', en: 'Switch models, keys and providers without leaving the workspace.' },
    desc: {
      zh: '用统一的模型边界隐藏供应商差异，让创作者专注于结果、成本和可复现的生成流程。',
      en: 'A unified model boundary hides provider differences so creators can focus on output quality, cost and repeatable generation flows.'
    },
    tags: [
      { zh: '自有密钥', en: 'Own keys' },
      { zh: '路由审计', en: 'Route audit' },
      { zh: '多模型', en: 'Multi-model' }
    ],
    tone: 'lavender'
  },
  {
    id: 'ecommerce-studio',
    num: '03',
    eyebrow: { zh: 'Commerce Studio', en: 'Commerce Studio' },
    title: { zh: '从商品原图到批量主图，形成可管理的商业素材流水线。', en: 'From product shots to batch-ready commerce visuals.' },
    desc: {
      zh: '上传需求、原图和参考素材后，系统将任务拆解成可追踪的生成队列，并支持分组导出。',
      en: 'Upload requirements, source shots and references, then turn them into traceable generation queues with grouped export.'
    },
    tags: [
      { zh: '批量生成', en: 'Batch generation' },
      { zh: '任务队列', en: 'Task queue' },
      { zh: 'ZIP 导出', en: 'ZIP export' }
    ],
    tone: 'ochre'
  },
  {
    id: 'agent-runtime',
    num: '04',
    eyebrow: { zh: 'Agent Runtime', en: 'Agent Runtime' },
    title: { zh: '让 Agent 读取画布状态，继续推进复杂任务。', en: 'Let agents read canvas state and push complex work forward.' },
    desc: {
      zh: '基于画布状态、工具声明和持久任务队列，Agent 可以在更长的生产链路中承担拆解、重试和整理工作。',
      en: 'With canvas state, declared tools and durable queues, agents can plan, retry and organize work across longer production chains.'
    },
    tags: [
      { zh: '画布感知', en: 'State aware' },
      { zh: '工具注册', en: 'Tool registry' },
      { zh: '持久队列', en: 'Durable queue' }
    ],
    tone: 'teal'
  }
];

export const processSteps: ProcessStep[] = [
  {
    num: '01',
    title: { zh: 'Capture / 捕获', en: 'Capture' },
    desc: {
      zh: '将 Prompt、商品原图、参考图、需求文件和灵感碎片拖入画布，建立第一层创作上下文。',
      en: 'Bring prompts, product shots, references, requirement files and raw ideas into the canvas to build the first layer of context.'
    }
  },
  {
    num: '02',
    title: { zh: 'Compose / 编排', en: 'Compose' },
    desc: {
      zh: '通过节点、连线和分组，把模型输入、参考关系、批处理任务和输出目标编排成清晰路径。',
      en: 'Use nodes, links and groups to compose model inputs, reference relationships, batch jobs and output targets into a clear path.'
    }
  },
  {
    num: '03',
    title: { zh: 'Generate / 生成', en: 'Generate' },
    desc: {
      zh: '调度图像、视频、PPT 和电商任务，以可追踪队列并行推进，随时查看结果和失败状态。',
      en: 'Dispatch image, video, PPT and commerce jobs in traceable queues, then inspect results, retries and failures as they happen.'
    }
  },
  {
    num: '04',
    title: { zh: 'Govern / 管治', en: 'Govern' },
    desc: {
      zh: '用积分预扣、失败退款、密钥隔离和导出记录，让 AI 创作从实验走向可审计的生产系统。',
      en: 'Use credit holds, refund-on-failure, key isolation and export records to turn AI exploration into an auditable production system.'
    }
  }
];

export const serviceItems: LocaleText[] = [
  { zh: '图像生成与局部重绘', en: 'Image generation and inpainting' },
  { zh: '电商主图与批量素材', en: 'Ecommerce hero and batch assets' },
  { zh: 'PPT 视觉稿与页面生产', en: 'PPT decks and page production' },
  { zh: '多模型 API 路由与密钥隔离', en: 'Model API routing and key isolation' },
  { zh: 'Agent 工作流与持久任务队列', en: 'Agent workflow and durable queues' },
  { zh: '生成资产整理、下载与审计', en: 'Asset organization, export and audit' }
];

export const thoughtItems: ThoughtItem[] = [
  {
    category: { zh: 'Studio Note', en: 'Studio Note' },
    title: { zh: '为什么 AI 创作需要画布，而不是更长的聊天记录。', en: 'Why AI production needs a canvas, not a longer chat history.' },
    desc: { zh: '复杂创作由素材、模型、版本和任务关系组成，画布让这些关系被看见。', en: 'Serious production is made from assets, models, versions and task relationships. A canvas makes those relationships visible.' },
    meta: { zh: 'Product Thinking', en: 'Product Thinking' }
  },
  {
    category: { zh: 'Workflow', en: 'Workflow' },
    title: { zh: '把一次性生成变成可复用流水线。', en: 'Turning one-off generations into repeatable systems.' },
    desc: { zh: '从 Prompt 到导出包，每一步都应当可追踪、可重试、可复用。', en: 'From prompt to export, every step should be traceable, retryable and reusable.' },
    meta: { zh: 'Workflow Design', en: 'Workflow Design' }
  },
  {
    category: { zh: 'Commerce', en: 'Commerce' },
    title: { zh: '电商团队如何用多模型流程压缩素材生产周期。', en: 'How commerce teams compress asset production with multi-model flows.' },
    desc: { zh: '批量素材的瓶颈不是单张图，而是需求、参考、版本和导出的管理。', en: 'The bottleneck is rarely one image. It is requirements, references, versions and export management.' },
    meta: { zh: 'Commerce Ops', en: 'Commerce Ops' }
  }
];

export const ctaCopy = {
  title: { zh: '所有创作星座，汇入一张画布。', en: 'All your creative constellations, under one canvas.' },
  subtitle: {
    zh: '从灵感到商品素材、从 Prompt 到 Agent 队列，KK Studio 把 AI 创作组织成可管理、可复用、可审计的生产系统。',
    en: 'From spark to commerce assets, from prompts to agent queues, KK Studio organizes AI work into a manageable, reusable and auditable production system.'
  },
  primaryBtn: { zh: '开始创作', en: 'Start creating' },
  secondaryBtn: { zh: '配置模型', en: 'Configure models' }
};
