// 简体中文：内置提示词库预置模板

import type { PromptTemplate } from '../types';

export const PROMPT_LIBRARY: PromptTemplate[] = [
  {
    id: 'portrait_classic',
    name: '唯美复古肖像',
    category: 'portrait',
    triggerWords: ['肖像', '人像', '女孩', '男人', '复古', '唯美', '写真'],
    tags: ['portrait', 'vintage', 'soft-lighting'],
    toolTypes: ['image-generation'],
    basePrompt: 'A beautiful cinematic portrait of {subject}, vintage styling, {style}, captured on 35mm film.',
    negativePrompt: 'low quality, blurry, deformed hands, extra fingers, cartoon, drawing',
    variables: [
      { key: 'subject', required: true, defaultValue: 'a young woman with soft eyes' },
      { key: 'style', required: false, defaultValue: 'classic film aesthetics, moody shadows' }
    ],
    styleBoosters: ['cinematic lighting', 'warm tones', 'retro grain'],
    qualityBoosters: ['8k resolution', 'highly detailed skin texture', 'photorealistic'],
    compositionBoosters: ['close-up shot', 'shallow depth of field', 'bokeh background']
  },
  {
    id: 'anime_cyberpunk',
    name: '赛博朋克二次元',
    category: 'anime',
    triggerWords: ['二次元', '动漫', '赛博朋克', '未来科技', '机甲少女', '霓虹'],
    tags: ['anime', 'cyberpunk', 'neon'],
    toolTypes: ['image-generation', 'batch-generation'],
    basePrompt: 'Anime style illustration of {subject}, cyberpunk city background, neon glows, vibrant colors, {style}.',
    negativePrompt: 'realistic, photorealistic, 3d render, ugly, monochrome, sketches',
    variables: [
      { key: 'subject', required: true, defaultValue: 'a mecha pilot girl with colorful hair' },
      { key: 'style', required: false, defaultValue: 'dynamic pose, futuristic details' }
    ],
    styleBoosters: ['neon glow effect', 'vibrant color palette', 'cel-shaded lighting'],
    qualityBoosters: ['masterpiece quality', 'sharp lines', 'award winning anime art'],
    compositionBoosters: ['dynamic camera angle', 'wide shot', 'dramatic lighting']
  },
  {
    id: 'product_ecommerce',
    name: '轻奢极简电商背景',
    category: 'ecommerce',
    triggerWords: ['电商', '产品', '化妆品', '瓶子', '轻奢', '摆拍', '展示架'],
    tags: ['product', 'ecommerce', 'minimalist'],
    toolTypes: ['image-generation', 'batch-generation'],
    basePrompt: 'High-end studio product photography of {subject}, minimal luxury setup, mockup style, soft shadow, elegant podium, {style}.',
    negativePrompt: 'messy background, text, watermarks, bad lighting, cheap look',
    variables: [
      { key: 'subject', required: true, defaultValue: 'a luxury cosmetic bottle' },
      { key: 'style', required: false, defaultValue: 'monochromatic beige tones, clean lines' }
    ],
    styleBoosters: ['luxury atmosphere', 'soft diffused lighting', 'subtle marble textures'],
    qualityBoosters: ['commercial photography quality', 'sharp focus', 'professional lighting studio'],
    compositionBoosters: ['centered product layout', 'eye-level shot', 'clean background']
  },
  {
    id: 'mecha_sci_fi',
    name: '硬核未来科幻机甲',
    category: 'mecha',
    triggerWords: ['机甲', '科幻', '机器人', '钢铁', '太空', '装甲'],
    tags: ['sci-fi', 'mecha', 'hardcore'],
    toolTypes: ['image-generation', 'batch-generation'],
    basePrompt: 'A detailed robotic mecha {subject}, heavy armored plating, glowing energy cores, standing in {style}.',
    negativePrompt: 'organic, soft, biological, low-res, cartoonish',
    variables: [
      { key: 'subject', required: true, defaultValue: 'humanoid robot warrior' },
      { key: 'style', required: false, defaultValue: 'a futuristic hanger bay' }
    ],
    styleBoosters: ['metallic scratches', 'dust particles', 'volumetric fog'],
    qualityBoosters: ['highly detailed mechanical joints', 'unreal engine 5 render', '8k resolution'],
    compositionBoosters: ['three-quarter view', 'low angle shot for heroic scale']
  }
];
