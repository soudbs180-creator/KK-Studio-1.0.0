import React, { useState, useEffect, useRef, useMemo } from 'react';
import { KK_LAYER } from '@kk/ui';
import { useLocale } from '../../context/LocaleContext';
import { 
  Sparkles, Upload, X, Trash2, Image as ImageIcon, Sparkle, 
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Layers, CheckCircle2, ArrowUp
} from 'lucide-react';
import { AspectRatio, ImageSize } from '../../types';
import { notify } from '../../services/system/notificationService';
import PromptVoiceInputButton from '../layout/prompt-bar/PromptVoiceInputButton';

type GenerationServiceClass = import('../../features/generation/generateService').GenerationService;
type GenerateImageFn = GenerationServiceClass['generateImage'];
type ChatFn = GenerationServiceClass['chat'];

const generateMobileEcommerceImage = async (...args: Parameters<GenerateImageFn>) => {
  const { generationService: runGenerationService } = await import('../../features/generation/generateService');
  return runGenerationService.generateImage(...args);
};

const chatWithMobileEcommerceLlm = async (...args: Parameters<ChatFn>) => {
  const { generationService: runtimeLlmService } = await import('../../features/generation/generateService');
  return runtimeLlmService.chat(...args);
};

// 声明全局变量以支持只读环境标记
declare global {
  interface Window {
    __KK_SETTINGS_READONLY__?: boolean;
  }
}

// 推荐灵感词汇，针对真实电商主图的运营痛点重新提炼的黄金 6 大商业预设
const INSPIRATION_TAGS = [
  {
    emoji: '💄',
    title: '美妆奢品 · 极简火山岩',
    text: '高端极简美妆护肤品瓶子，稳固摆放在浅米色火山岩石上，背景是海滩清晨的日光，柔和细腻的逆光，极简深景深，商业摄影大片'
  },
  {
    emoji: '🥩',
    title: '生鲜食品 · 暖阳原木',
    text: '精致生鲜食品摆放在浅色原木托盘上，旁边散落迷迭香和干松果，背景是晨光微风，自然呼吸感，温暖柔和，高级食品大片'
  },
  {
    emoji: '💻',
    title: '3C数码 · 科技霓虹',
    text: '智能科技产品悬浮在暗色拉丝金属底座上，背景是深邃的科幻未来感，冰川水滴折射，蓝色科技霓虹光束，高清晰边缘高光'
  },
  {
    emoji: '💍',
    title: '珠宝奢饰 · 质感丝绸',
    text: '奢华精美珠宝首饰，静置在米白色真丝折痕缎面上，侧方Studio专业射光，边缘锋利的高光质感，微风轻微褶皱，高贵气场'
  },
  {
    emoji: '🏺',
    title: '家居日用 · 百叶窗影',
    text: '简约家居日用品摆放在雅致大理石台面上，百叶窗斜射过来的斑驳温暖晨光投影，树影摇曳，慵懒宁静，极简北欧生活质感'
  },
  {
    emoji: '🥤',
    title: '夏日饮品 · 冰爆水花',
    text: '夏日清爽饮品玻璃瓶身凝结晶莹冰润水滴，半沉浸在波光粼粼的淡蓝色冰泉水波中，阳光水波折射，动态小飞溅水花，冰爽动感'
  }
];

// 高阶构图比例列表数据 (与用户图片高度一致的可视化布局)
const RATIO_LIST = [
  { ratio: '1:1', title: '1:1 正方形, 头像', desc: '社交媒体主图、主商品卡片首选', w: 'w-5.5', h: 'h-5.5' },
  { ratio: '2:3', title: '2:3 社交媒体, 自拍', desc: '小红书、Pinterest 竖屏引流黄金比例', w: 'w-4.5', h: 'h-6.5' },
  { ratio: '3:4', title: '3:4 经典比例, 拍照', desc: '电商及高端服饰展示的高频高质比例', w: 'w-5', h: 'h-6.5' },
  { ratio: '4:3', title: '4:3 文章配图, 插画', desc: '宽屏景观、横版商品或说明配图', w: 'w-6.5', h: 'h-5' },
  { ratio: '9:16', title: '9:16 手机壁纸, 人像', desc: '垂直手机全屏故事或海报宣传画面', w: 'w-4', h: 'h-7' },
  { ratio: '16:9', title: '16:9 桌面壁纸, 风景', desc: '电影感宽荧幕，适用于网页横幅大图', w: 'w-7.5', h: 'h-4.5' },
];

// 单个任务状态结构
interface ImageTask {
  index: number;
  angleName: string;
  designIntent: string;
  optimizedPromptEn: string;
  status: 'idle' | 'analyzing' | 'queued' | 'generating' | 'success' | 'error';
  url?: string;
  attempts: number;
  errorMsg?: string;
}

export interface MobileEcommercePanelProps {
  onClose: () => void;
  // 以下是透传自 promptBarProps 极其相关的生图上下文和操作
  config: {
    prompt: string;
    aspectRatio: AspectRatio | string;
    imageSize: ImageSize | string;
    model: string;
    [key: string]: any;
  };
  setConfig: (config: any) => void;
  onGenerate: (promptOverride?: string) => void;
  
  ecommerceProductFiles?: File[];
  ecommerceExtraReferenceFiles?: File[];
  onPickEcommerceProductFiles?: (files: FileList | File[]) => void;
  onPickEcommerceExtraReferenceFiles?: (files: FileList | File[]) => void;
  onRemoveEcommerceProductFile?: (index: number) => void;
  onRemoveEcommerceExtraReferenceFile?: (index: number) => void;
}

const MobileEcommercePanel: React.FC<MobileEcommercePanelProps> = ({
  onClose,
  config,
  setConfig,
  onGenerate,
  ecommerceProductFiles = [],
  ecommerceExtraReferenceFiles = [],
  onPickEcommerceProductFiles,
  onPickEcommerceExtraReferenceFiles,
  onRemoveEcommerceProductFile,
  onRemoveEcommerceExtraReferenceFile,
}) => {
  const { pick } = useLocale();
  const [prompt, setPrompt] = useState(config.prompt || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInspirationOpen, setIsInspirationOpen] = useState(false);

  const localizedInspirationTags = useMemo(() => [
    {
      emoji: '💄',
      title: pick('美妆奢品 · 极简火山岩', 'Luxury Cosmetics · Minimalist Volcanic Rock'),
      text: pick(
        '高端极简美妆护肤品瓶子，稳固摆放在浅米色火山岩石上，背景是海滩清晨的日光，柔和细腻的逆光，极简深景深，商业摄影大片',
        'High-end minimalist cosmetics skincare bottle, stably placed on light beige volcanic rock, background morning sunlight on beach, soft and delicate backlight, minimalist deep depth of field, commercial photography blockbuster'
      )
    },
    {
      emoji: '🥩',
      title: pick('生鲜食品 · 暖阳原木', 'Fresh Food · Warm Sun Log'),
      text: pick(
        '精致生鲜食品摆放在浅色原木托盘上，旁边散落迷迭香和干松果，背景是晨光微风，自然呼吸感，温暖柔和，高级食品大片',
        'Exquisite fresh food placed on a light-colored wooden tray, scattered rosemary and pine cones beside it, background morning light breeze, natural breathable atmosphere, warm and soft, premium food blockbuster'
      )
    },
    {
      emoji: '💻',
      title: pick('3C数码 · 科技霓虹', '3C Digital · Tech Neon'),
      text: pick(
        '智能科技产品悬浮在暗色拉丝金属底座上，背景是深邃的科幻未来感，冰川水滴折射，蓝色科技霓虹光束，高清晰边缘高光',
        'Smart tech product floating on a dark brushed metal base, deep sci-fi futuristic background, glacier water droplets refraction, blue tech neon light beam, high-definition edge highlights'
      )
    },
    {
      emoji: '💍',
      title: pick('珠宝奢饰 · 质感丝绸', 'Jewelry Luxury · Textured Silk'),
      text: pick(
        '奢华精美珠宝首饰，静置在米白色真丝折痕缎面上，侧方Studio专业射光，边缘锋利的高光质感，微风轻微褶皱，高贵气场',
        'Luxury exquisite jewelry, resting on cream-white silk creased satin surface, side studio professional spotlight, sharp edge highlight texture, gentle breeze light folds, noble aura'
      )
    },
    {
      emoji: '🏺',
      title: pick('家居日用 · 百叶窗影', 'Home & Living · Shutter Shadow'),
      text: pick(
        '简约家居日用品摆放在雅致大理意石台面上，百叶窗斜射过来的斑驳温暖晨光投影，树影摇曳，慵懒宁静，极简北欧生活质感',
        'Minimalist home daily necessities placed on elegant marble countertop, dappled warm morning light shadow projected from shutters, swaying tree shadows, lazy and quiet, minimalist Nordic living texture'
      )
    },
    {
      emoji: '🥤',
      title: pick('夏日饮品 · 冰爆水花', 'Summer Drink · Ice Water Splash'),
      text: pick(
        '夏日清爽饮品玻璃瓶身凝结晶莹冰润水滴，半沉浸在波光粼粼的淡蓝色冰泉水波中，阳光水波折射，动态小飞溅水花，冰爽动感',
        'Summer refreshing drink glass bottle condensed with crystal ice dew drops, semi-submerged in sparkling light blue ice spring water, sun water refraction, dynamic small splashing water splash, cool and dynamic'
      )
    }
  ], [pick]);

  const localizedRatioList = useMemo(() => [
    { ratio: '1:1', title: pick('1:1 正方形, 头像', '1:1 Square, Avatar'), desc: pick('社交媒体主图、主商品卡片首选', 'First choice for social media main images and product cards'), w: 'w-5.5', h: 'h-5.5' },
    { ratio: '2:3', title: pick('2:3 社交媒体, 自拍', '2:3 Social Media, Selfie'), desc: pick('小红书、Pinterest 竖屏引流黄金比例', 'Golden ratio for Xiaohongshu, Pinterest vertical portrait traffic'), w: 'w-4.5', h: 'h-6.5' },
    { ratio: '3:4', title: pick('3:4 经典比例, 拍照', '3:4 Classic Ratio, Photo'), desc: pick('电商及高端服饰展示的高频高质比例', 'High-frequency and high-quality ratio for e-commerce and premium apparel'), w: 'w-5', h: 'h-6.5' },
    { ratio: '4:3', title: pick('4:3 文章配图, 插画', '4:3 Article Image, Illustration'), desc: pick('宽屏景观、横版商品或说明配图', 'Widescreen landscapes, horizontal products or illustration images'), w: 'w-6.5', h: 'h-5' },
    { ratio: '9:16', title: pick('9:16 手机壁纸, 人像', '9:16 Phone Wallpaper, Portrait'), desc: pick('垂直手机全屏故事或海报宣传画面', 'Vertical full screen story or poster promotion screen'), w: 'w-4', h: 'h-7' },
    { ratio: '16:9', title: pick('16:9 桌面壁纸, 风景', '16:9 Desktop Wallpaper, Landscape'), desc: pick('电影感宽荧幕，适用于网页横幅大图', 'Cinematic widescreen, suitable for web homepage banner images'), w: 'w-7.5', h: 'h-4.5' },
  ], [pick]);
  
  // Carousel 视图焦点卡片索引
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  // 当前生成的图片任务池列表
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  // 是否正在进行 AI 智能提示词分配中
  const [isAnalyzingPrompt, setIsAnalyzingPrompt] = useState(false);

  // 高阶参数状态
  const [platform, setPlatform] = useState('亚马逊');
  const [targetMarket, setTargetMarket] = useState('欧美');
  const [language, setLanguage] = useState('英文');
  const [modelType, setModelType] = useState(config.model || 'gemini-2.5-flash-image');
  const [resolution, setResolution] = useState(config.imageSize || '1K');
  const [batchCount, setBatchCount] = useState(1);
  const [activeConfigTab, setActiveConfigTab] = useState<'ratio' | 'params'>('ratio');

  const activeRatio = config.aspectRatio || '1:1';
  const isReadOnly = typeof window !== 'undefined' && !!window.__KK_SETTINGS_READONLY__;

  // 处理产品上传
  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onPickEcommerceProductFiles?.(e.target.files);
    }
  };

  // 处理参考图上传
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onPickEcommerceExtraReferenceFiles?.(e.target.files);
    }
  };

  // 处理比例切换
  const handleRatioChange = (ratio: string) => {
    setConfig({
      ...config,
      aspectRatio: ratio
    });
  };

  // 比例几何预览渲染
  const renderRatioSkeleton = (w: string, h: string, isActive: boolean) => {
    return (
      <div
        className={`mobile-ecommerce-ratio-frame ${w} ${h} rounded shrink-0 transition-all`}
        data-state={isActive ? 'active' : 'idle'}
      />
    );
  };

  // 灵感模板填词
  const handleSelectInspiration = (text: string, title: string) => {
    setPrompt(text);
    notify.success(pick('已填入灵感词', 'Inspiration loaded'), pick(`已选择“${title}”场景风格`, `Selected style "${title}"`));
    setIsInspirationOpen(false); // 选择后收纳
  };

  // 并发任务队列处理器 (并发 2，重试 3)
  const executeTasksInQueue = async (tasksList: ImageTask[], referenceImages: any[]) => {
    let cursor = 0;
    const updatedTasks = [...tasksList];

    // 更新任务状态的辅助函数
    const updateTaskStatus = (index: number, patch: Partial<ImageTask>) => {
      updatedTasks[index] = { ...updatedTasks[index], ...patch };
      setTasks([...updatedTasks]);
    };

    const worker = async () => {
      while (cursor < tasksList.length) {
        const curIdx = cursor++;
        const currentTask = tasksList[curIdx];

        let attempts = 0;
        let success = false;
        let finalError: unknown = null;

        updateTaskStatus(curIdx, { status: 'generating' });

        while (attempts < 3 && !success) {
          attempts++;
          updateTaskStatus(curIdx, { attempts });

          try {
            // 调用 geminiService 底层的真实生图 API
            const result = await generateMobileEcommerceImage(
              currentTask.optimizedPromptEn,
              config.aspectRatio as AspectRatio || AspectRatio.SQUARE,
              resolution as ImageSize || ImageSize.SIZE_1K,
              referenceImages,
              modelType,
              '',
              `mob_gen_${Date.now()}_${curIdx}`,
              false,
              {
                preferredKeyId: config.preferredKeyId,
                executionLane: 'local-user-api'
              }
            );

            if (result && result.url) {
              updateTaskStatus(curIdx, { status: 'success', url: result.url });
              success = true;
            } else {
              throw new Error(pick('生图接口未返回有效 url', 'Generation interface failed to return a valid URL'));
            }
          } catch (err: any) {
            finalError = err;
            console.warn(`[Queue Worker] 第 ${attempts} 次生成任务 ${curIdx + 1} 失败`, err);
            if (attempts < 3) {
              // 稍微等待 1 秒后重试
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }

        if (!success) {
          updateTaskStatus(curIdx, { 
            status: 'error', 
            errorMsg: finalError instanceof Error ? finalError.message : pick('生成失败，请重试', 'Generation failed, please try again')
          });
        }
      }
    };

    // 并发 2 个 Worker 协程
    const workers = [worker(), worker()];
    await Promise.all(workers);
  };

  // 触发魔法生图总控：AI 矩阵分配 -> 初始化 tasks -> 启动并发队列
  const handleGenerateSubmit = async () => {
    if (isReadOnly) {
      notify.warning(
        '当前处于演示只读环境',
        '无法在演示实例中发起真实的 AI 图像生成。请连通并启动本地 KK-Studio 实例继续体验全功能。'
      );
      return;
    }

    if (ecommerceProductFiles.length === 0) {
      notify.warning(pick('无法发起生图', 'Cannot generate image'), pick('请先上传您的产品主体图 (左侧必填)', 'Please upload your product image first (required)'));
      return;
    }

    setIsSubmitting(true);
    setIsAnalyzingPrompt(true);
    setActiveCarouselIndex(0);

    // 1. 并发提取 base64 参考图
    const getBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const match = resultStr.match(/^data:(.+);base64,(.+)$/);
          if (match) resolve({ mimeType: match[1], data: match[2] });
          else reject(new Error(pick('图片格式不兼容', 'Incompatible image format')));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    };

    let referenceImages: any[] = [];
    try {
      const prodBase64 = await getBase64(ecommerceProductFiles[0]);
      referenceImages.push({
        id: 'prod_' + Date.now(),
        data: prodBase64.data,
        mimeType: prodBase64.mimeType
      });

      if (ecommerceExtraReferenceFiles.length > 0) {
        const refBase64 = await getBase64(ecommerceExtraReferenceFiles[0]);
        referenceImages.push({
          id: 'ref_' + Date.now(),
          data: refBase64.data,
          mimeType: refBase64.mimeType
        });
      }
    } catch (readErr: any) {
      notify.error(pick('参考图读取失败', 'Failed to read reference image'), readErr?.message || pick('请检查上传文件', 'Please check uploaded file'));
      setIsSubmitting(false);
      setIsAnalyzingPrompt(false);
      return;
    }

    // 2. 专业向 AI 智能提问，规划生成 N 个差异化电商高转化生图提示词矩阵
    let generatedPromptsMatrix: any[] = [];
    try {
      const userPromptContext = prompt.trim() || '高档商品摆盘大片，极简风格';
      
      const systemPrompt = `你是一个顶级跨境电商运营与视觉总监。你将根据用户选择的电商平台、目标市场、语种、产品简述，为用户规划一套（共 ${batchCount} 张）极动人心扉的高转化电商商品效果图组合。每张图必须拥有完全不同的商业卖点与展示视角，杜绝雷同。
对于这 ${batchCount} 张图的每一张，你必须规划出以下 JSON 数据：
1. index: 图片序号 (1 ~ ${batchCount})
2. angleName: 中文短标题（例如："主图特写 · 精致光泽"、"使用演示 · 日常操作"、"生活方式 · 空间展示" 等）
3. designIntent: 中文设计意图简述（说明本张图的核心视觉诉求与电商高转化打法，例如："通过微距突显材质纹理与奢奢品质心智..."）
4. optimizedPromptEn: 用于图像生成模型 (DALL-E 或 Gemini) 的高精度、细节详实、强调折射与阴影的电商专用英文生图提示词。

请严格且仅返回合法的 JSON 数组，严禁包含任何 Markdown 格式包裹（如不要带 \`\`\`json 前缀及后缀），不要有多余文字。
示例格式：
[
  {
    "index": 1,
    "angleName": "主图特写 · 奢感极简",
    "designIntent": "在微米级拉丝金属台面展示产品高抛光反射，营造尊贵身份标识心智...",
    "optimizedPromptEn": "highly-detailed studio shot of product on premium dark steel pedestal..."
  }
]`;

      const userMessage = `
用户描述的产品意图: "${userPromptContext}"
所用电商平台: ${platform}
目标市场: ${targetMarket}
文案语种: ${language}
需要生成的差异化张数: ${batchCount}
      `;

      // 前端直连 LLM 服务发起提问
      const aiResponse = await chatWithMobileEcommerceLlm({
        modelId: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        maxTokens: 2000,
        temperature: 0.3
      });

      // 强力清洗并解析返回的 JSON 数组
      const cleanJson = aiResponse.trim().replace(/^```json\s*/i, '').replace(/```\s*$/g, '');
      generatedPromptsMatrix = JSON.parse(cleanJson);
      
      if (!Array.isArray(generatedPromptsMatrix) || generatedPromptsMatrix.length === 0) {
        throw new Error('AI 返回的数据格式不符合规范');
      }
      
      notify.success(pick('AI 规划就绪', 'AI Plan Ready'), pick(`成功为 ${batchCount} 张图片规划了差异化电商卖点！`, `Successfully planned selling points for ${batchCount} images!`));

    } catch (aiErr) {
      console.warn('[LLM Matrix Failed] 智能分配出错，启动常规平级生图兜底', aiErr);
      
      // 容错降级兜底：当 AI 报错或返回无效数据时，生成同质化的生图任务
      generatedPromptsMatrix = Array.from({ length: batchCount }, (_, i) => ({
        index: i + 1,
        angleName: `创意渲染 #${i + 1}`,
        designIntent: `多任务并发生成第 ${i + 1} 张效果图，后台已自动补齐电商主体打光...`,
        optimizedPromptEn: `high quality commercial product shot, ${prompt || 'premium item render'}, studio lighting, elegant composition, high-end 3D product visualization, detailed background`
      }));
    }

    setIsAnalyzingPrompt(false);

    // 3. 构建 ImageTasks
    const initialTasks: ImageTask[] = generatedPromptsMatrix.map((item) => ({
      index: item.index,
      angleName: item.angleName || `电商视角 #${item.index}`,
      designIntent: item.designIntent || '高转化展示...',
      optimizedPromptEn: item.optimizedPromptEn,
      status: 'queued',
      attempts: 0
    }));

    setTasks(initialTasks);

    // 4. 正式启动并发队列
    try {
      await executeTasksInQueue(initialTasks, referenceImages);
      notify.success(pick('批量生成结束', 'Batch Generation Finished'), pick('所有电商生图卡片已按并发调度逻辑出图完毕！', 'All e-commerce images generated successfully!'));
    } catch (err: any) {
      console.error('队列调度发生意外错误', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="mobile-ecommerce-panel-root fixed inset-0 flex flex-col text-[var(--text-primary)] font-sans overflow-hidden"
      data-kk-mobile-overlay-layer="true"
      style={{ zIndex: KK_LAYER.modal }}
    >
      
      {/* 自定义局部无滚动条与 Shimmer 骨架流光 CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />

      {/* 顶部 Header，毛玻璃拟态，高度精准锁定 */}
      <div className="mobile-ecommerce-header relative flex shrink-0 items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="mobile-ecommerce-header__icon">
            <Layers size={16} />
          </div>
          <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
            {pick('AI 智能电商极速看板', 'AI E-commerce Board')}
          </span>
        </div>
        <button 
          type="button" 
          onClick={onClose} 
          className="mobile-ecommerce-header__close"
        >
          <X size={16} />
        </button>
      </div>

      {/* 一页极致排版核心内容区域 (高度占用极低，绝不产生长系统滚动条，在下部预留粘性输入框位置) */}
      <div className="relative flex-1 overflow-y-auto pb-[170px] px-4 py-4 space-y-4 no-scrollbar z-10">
        
        {/* ================= 1. 上传区 (左右并排 6比4 大小) ================= */}
        <div className="grid grid-cols-10 gap-3 shrink-0">
          
          {/* 产品主体 (左侧 60% 宽度) */}
          <div className="col-span-6 space-y-1.5">
            <div className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5" style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {pick('核心产品主体 (必填)', 'Product Body (Required)')}
            </div>
            {ecommerceProductFiles.length > 0 ? (
              <div className="mobile-ecommerce-upload-card relative h-[85px] rounded-xl overflow-hidden p-1.5 flex items-center gap-2">
                <img 
                  src={URL.createObjectURL(ecommerceProductFiles[0])} 
                  alt="产品主体" 
                  className="w-12 h-12 object-cover rounded-lg shrink-0 border border-[var(--mobile-clay-border-strong)]" 
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{ecommerceProductFiles[0].name}</div>
                  <div className="text-[9px] text-[var(--text-tertiary)] mt-0.5">{(ecommerceProductFiles[0].size / 1024).toFixed(1)} KB</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => onRemoveEcommerceProductFile?.(0)}
                  className="mobile-ecommerce-danger-action p-1.5 rounded-lg transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <label className="mobile-ecommerce-upload-dropzone group relative flex flex-col items-center justify-center h-[85px] rounded-xl cursor-pointer" data-tone="product">
                <Upload size={18} className="text-rose-400 mb-1 group-hover:scale-105 transition-transform" />
                <span className="text-[10px] font-bold text-[var(--text-primary)]/80">{pick('上传产品', 'Upload Product')}</span>
                <span className="text-[8px] text-[var(--text-tertiary)] scale-90 mt-0.5">{pick('自动抠图融合', 'Auto background removal')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
              </label>
            )}
          </div>

          {/* 氛围参考 (右侧 40% 宽度) */}
          <div className="col-span-4 space-y-1.5">
            <div className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5" style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {pick('氛围参考 (可选)', 'Vibe Reference (Optional)')}
            </div>
            {ecommerceExtraReferenceFiles.length > 0 ? (
              <div className="mobile-ecommerce-upload-card relative h-[85px] rounded-xl overflow-hidden p-1.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <img 
                    src={URL.createObjectURL(ecommerceExtraReferenceFiles[0])} 
                    alt="氛围参考" 
                    className="mobile-ecommerce-upload-thumb w-8 h-8 object-cover rounded-md shrink-0"
                  />
                  <span className="text-[9px] text-[var(--text-secondary)] truncate flex-1 leading-none">
                    {ecommerceExtraReferenceFiles[0].name}
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => onRemoveEcommerceExtraReferenceFile?.(0)}
                  className="mobile-ecommerce-danger-action w-full py-0.5 text-[9px] font-bold rounded-md transition-all text-center"
                >
                  {pick('移除参考', 'Remove')}
                </button>
              </div>
            ) : (
              <label className="mobile-ecommerce-upload-dropzone group relative flex flex-col items-center justify-center h-[85px] rounded-xl cursor-pointer" data-tone="reference">
                <ImageIcon size={18} className="text-amber-400 mb-1 group-hover:scale-105 transition-transform" />
                <span className="text-[10px] font-bold text-[var(--text-primary)]/80">{pick('上传背景', 'Upload BG')}</span>
                <span className="text-[8px] text-[var(--text-tertiary)] scale-90 mt-0.5">{pick('借鉴色调打光', 'Match color & lighting')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
              </label>
            )}
          </div>
        </div>

        {/* ================= 2. 出图区 (Carousel 卡片详情滑动展示) ================= */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">{pick('🌟 AI 生成出图看板 (Carousel 左右滑动查看)', '🌟 AI Generation Board (Swipe Carousel to view)')}</span>
            {tasks.length > 0 && (
              <span className="text-[10px] font-bold text-rose-400">
                {pick('图', 'Img')} {activeCarouselIndex + 1} / {tasks.length}
              </span>
            )}
          </div>

          <div className="mobile-ecommerce-preview-card relative w-full h-[280px] rounded-2xl overflow-hidden flex flex-col justify-between p-3.5">
            {isAnalyzingPrompt ? (
              // AI 分析中的加载骨架
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="relative w-14 h-14 rounded-2xl bg-[var(--mobile-clay-surface-bg)] flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                  <Sparkles size={24} className="text-rose-400 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <div className="text-center space-y-1.5">
                  <div className="text-xs font-bold text-[var(--text-primary)] animate-pulse">{pick('正在为 ' + batchCount + ' 张图片智能分配电商卖点提示词...', 'Planning e-commerce selling point prompts for ' + batchCount + ' images...')}</div>
                  <div className="text-[9px] text-[var(--text-tertiary)] leading-relaxed max-w-[240px]">{pick('AI 正在深度解剖产品特性，自动锁定最佳的高抛光主图、生活使用以及细节展示视角。', 'AI is deeply analyzing product features to automatically lock in the best high-polish main image, life-use, and detail display angles.')}</div>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              // 初始状态
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="p-3.5 rounded-2xl bg-[var(--mobile-clay-surface-bg)] text-[var(--text-tertiary)] border border-[var(--mobile-clay-border)] shadow-sm">
                  <Sparkles size={26} />
                </div>
                <div className="text-center space-y-1">
                  <div className="text-xs font-bold text-[var(--text-secondary)]">{pick('电商大片待魔法酝酿', 'E-commerce blockbusters in progress')}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] max-w-[200px]">{pick('配置下方的电商平台、目标市场与数量，点击右下角发送立即排队并发生成。', 'Configure the e-commerce platform, target market, and quantity below, then click generate to start.')}</div>
                </div>
              </div>
            ) : (
              // 任务轮播区 (Carousel)
              <>
                {/* 核心卡片容器 */}
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  {tasks[activeCarouselIndex].status === 'queued' && (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {pick('排队中', 'Queued')}
                      </div>
                      <div className="text-center space-y-1">
                        <div className="text-xs text-[var(--text-secondary)]">{pick('等待调度 Worker 启动...', 'Waiting for worker to start...')}</div>
                        <div className="text-[9px] text-[var(--text-tertiary)]">{pick('并发度限制为 2，以最大化维持云端生成稳定性。', 'Concurrency limit is 2 to maintain cloud generation stability.')}</div>
                      </div>
                    </div>
                  )}

                  {tasks[activeCarouselIndex].status === 'generating' && (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="relative w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center overflow-hidden border border-rose-500/20">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_1.2s_infinite]" />
                        <RefreshCw size={18} className="text-rose-400 animate-spin" />
                      </div>
                      <div className="text-center space-y-1">
                        <div className="text-xs font-bold text-[var(--text-primary)]">{pick('正在进行第 ' + tasks[activeCarouselIndex].attempts + '/3 次尝试生成...', 'Attempting generation (' + tasks[activeCarouselIndex].attempts + '/3)...')}</div>
                        <div className="text-[9px] text-[var(--text-tertiary)]">{pick('正在多模态融合您的产品，并发渲染中。', 'Fusing product features and rendering in progress.')}</div>
                      </div>
                    </div>
                  )}

                  {tasks[activeCarouselIndex].status === 'success' && tasks[activeCarouselIndex].url && (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img 
                        src={tasks[activeCarouselIndex].url} 
                        alt={tasks[activeCarouselIndex].angleName} 
                        className="w-full h-full object-contain rounded-xl"
                      />
                      <a
                        href={tasks[activeCarouselIndex].url}
                        download={`ecommerce_image_${activeCarouselIndex + 1}.png`}
                        className="mobile-ecommerce-download-action absolute bottom-1 right-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1"
                      >
                        {pick('下载大图', 'Download Image')}
                      </a>
                    </div>
                  )}

                  {tasks[activeCarouselIndex].status === 'error' && (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle size={24} className="text-rose-500" />
                      <div className="text-center space-y-1">
                        <div className="text-xs font-bold text-rose-400">{pick('已达 3 次重试上限均失败', 'Failed after 3 attempts')}</div>
                        <div className="text-[9px] text-[var(--text-tertiary)] px-4 max-w-[260px] truncate">{tasks[activeCarouselIndex].errorMsg}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 卡片底部描述信息 (像首页的详细卡片一样，展示商业策略) */}
                <div className="mt-2.5 pt-2 border-t border-[var(--mobile-clay-border)] flex flex-col gap-1 select-none">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                      🎯 {tasks[activeCarouselIndex].angleName}
                    </span>
                    {tasks[activeCarouselIndex].status === 'success' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-0.5">
                        <CheckCircle2 size={8} /> {pick('渲染成功', 'Rendered')}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                    {tasks[activeCarouselIndex].designIntent}
                  </p>
                </div>

                {/* 翻页切换 Chevron 控制栏与 Dots */}
                {tasks.length > 1 && (
                  <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-1 pointer-events-none select-none">
                    <button
                      type="button"
                      onClick={() => setActiveCarouselIndex(prev => Math.max(0, prev - 1))}
                      disabled={activeCarouselIndex === 0}
                      className={`p-1.5 rounded-full bg-[var(--mobile-clay-surface-bg)] border border-[var(--mobile-clay-border-strong)] text-[var(--text-primary)] active:scale-90 pointer-events-auto transition-all ${
                        activeCarouselIndex === 0 ? 'opacity-25 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCarouselIndex(prev => Math.min(tasks.length - 1, prev + 1))}
                      disabled={activeCarouselIndex === tasks.length - 1}
                      className={`p-1.5 rounded-full bg-[var(--mobile-clay-surface-bg)] border border-[var(--mobile-clay-border-strong)] text-[var(--text-primary)] active:scale-90 pointer-events-auto transition-all ${
                        activeCarouselIndex === tasks.length - 1 ? 'opacity-25 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ================= 3. 灵感区 (折叠收纳式灵感库) ================= */}
        <div className="mobile-ecommerce-inspiration shrink-0">
          <button
            type="button"
            onClick={() => setIsInspirationOpen(!isInspirationOpen)}
            className="mobile-ecommerce-section-trigger w-full py-2.5 px-4 rounded-xl transition-all flex items-center justify-between text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Sparkle size={13} className="text-amber-400" />
              <span>{isInspirationOpen ? pick('💡 收起电商灵感库', '💡 Collapse Inspiration Lib') : pick('💡 展开一键电商灵感库', '💡 Expand Inspiration Lib')}</span>
            </div>
            <div className={`text-[10px] text-[var(--text-tertiary)] transition-transform duration-300 ${
              isInspirationOpen ? 'rotate-180' : ''
            }`}>
              ▼
            </div>
          </button>

          {isInspirationOpen && (
            <div className="mobile-ecommerce-chip-grid grid grid-cols-3 gap-2 pr-0.5 p-2 no-scrollbar animate-[fadeIn_0.3s_ease]">
              {localizedInspirationTags.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectInspiration(tag.text, tag.title)}
                  className="mobile-ecommerce-chip flex items-center gap-2 py-2 px-2.5 rounded-xl text-[11px] font-semibold transition-all text-left truncate"
                >
                  <span className="text-sm shrink-0">{tag.emoji}</span>
                  <span className="truncate">{tag.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ================= 4. 参数与尺寸配置面板 (两合一模块) ================= */}
        <div className="mobile-ecommerce-control-section space-y-3.5 shrink-0 p-3 rounded-2xl">
          {/* Tab 切换控制栏 */}
          <div className="mobile-ecommerce-segmented flex p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveConfigTab('ratio')}
              data-state={activeConfigTab === 'ratio' ? 'active' : 'idle'}
              className="mobile-ecommerce-segmented-button flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all"
              style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}
            >
              {pick('📐 构图比例', '📐 Aspect Ratio')}
            </button>
            <button
              type="button"
              onClick={() => setActiveConfigTab('params')}
              data-state={activeConfigTab === 'params' ? 'active' : 'idle'}
              className="mobile-ecommerce-segmented-button flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all"
              style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}
            >
              {pick('⚙️ 生成参数', '⚙️ Parameters')}
            </button>
          </div>

          {/* Tab 1: 构图比例 */}
          {activeConfigTab === 'ratio' && (
            <div className="grid grid-cols-2 gap-2 animate-[fadeIn_0.2s_ease]">
              {localizedRatioList.map((item) => {
                const isActive = activeRatio === item.ratio;
                return (
                  <button
                    key={item.ratio}
                    type="button"
                    onClick={() => handleRatioChange(item.ratio)}
                    data-state={isActive ? 'active' : 'idle'}
                    aria-pressed={activeRatio === item.ratio}
                    className="mobile-ecommerce-ratio-option flex items-center gap-2.5 p-2 rounded-xl text-left transition-all duration-300"
                  >
                    {renderRatioSkeleton(item.w, item.h, isActive)}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold transition-colors truncate ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                        {item.title.split(', ')[0]}
                      </div>
                      <div className="text-[8px] text-[var(--text-tertiary)] mt-0.5 truncate leading-none">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: 高阶参数 */}
          {activeConfigTab === 'params' && (
            <div className="grid grid-cols-2 gap-2.5 text-xs animate-[fadeIn_0.2s_ease]">
              {/* 电商平台 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">{pick('电商平台', 'Platform')}</span>
                <select 
                  value={platform} 
                  onChange={(e) => setPlatform(e.target.value)}
                  className="mobile-ecommerce-field-select w-full rounded-lg px-2 py-1 outline-none transition-colors text-[10px]"
                >
                  {['亚马逊', '天猫', '淘宝', 'Shopee', '拼多多'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 目标市场 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">{pick('目标市场', 'Target Market')}</span>
                <select 
                  value={targetMarket} 
                  onChange={(e) => setTargetMarket(e.target.value)}
                  className="mobile-ecommerce-field-select w-full rounded-lg px-2 py-1 outline-none transition-colors text-[10px]"
                >
                  {['欧美', '日韩', '中国大陆', '东南亚'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 文案语种 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">{pick('文案语种', 'Language')}</span>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mobile-ecommerce-field-select w-full rounded-lg px-2 py-1 outline-none transition-colors text-[10px]"
                >
                  {['英文', '中文', '日文', '韩文'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* 模型选择 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">{pick('模型选择', 'Model')}</span>
                <select 
                  value={modelType} 
                  onChange={(e) => setModelType(e.target.value)}
                  className="mobile-ecommerce-field-select w-full rounded-lg px-2 py-1 outline-none transition-colors text-[10px]"
                >
                  {['gemini-2.5-flash-image'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 分辨率选择 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">{pick('分辨率选择', 'Resolution')}</span>
                <select 
                  value={resolution} 
                  onChange={(e) => setResolution(e.target.value)}
                  className="mobile-ecommerce-field-select w-full rounded-lg px-2 py-1 outline-none transition-colors text-[10px]"
                >
                  {['1K', '2K', '4K'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* 出图张数 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[var(--text-tertiary)]">{pick('出图张数 (1-10张)', 'Batch Count (1-10)')}</span>
                <div className="mobile-ecommerce-stepper flex items-center rounded-lg h-[24px]">
                  <button 
                    type="button" 
                    onClick={() => setBatchCount(prev => Math.max(1, prev - 1))}
                    className="mobile-ecommerce-stepper-button px-2.5 py-0.5 select-none text-[10px]"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-[10px]">{batchCount}</span>
                  <button 
                    type="button" 
                    onClick={() => setBatchCount(prev => Math.min(10, prev + 1))}
                    className="mobile-ecommerce-stepper-button px-2.5 py-0.5 select-none text-[10px]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ================= 6. 粘性底端输入控制栏 (Bottom Sticky Bar) ================= */}
      <div className="mobile-ecommerce-bottom-bar absolute bottom-0 left-0 right-0 p-3 pb-4 flex items-center gap-2.5 z-20">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={pick('上传主体后，简要描述产品和您想要的场景背景，AI 将生成差异化极速出图排队...', 'After uploading product body, briefly describe product and scenery, AI will batch queue generation...')}
          className="mobile-ecommerce-prompt flex-1 h-12 max-h-[120px] rounded-2xl px-3.5 py-3 text-xs outline-none resize-none transition-all no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        />
        <PromptVoiceInputButton
          value={prompt}
          onValueChange={setPrompt}
          className="mobile-ecommerce-voice"
        />

        <button
          type="button"
          onClick={handleGenerateSubmit}
          disabled={isSubmitting}
          data-state={isSubmitting ? 'busy' : 'ready'}
          className="mobile-ecommerce-submit h-12 w-12 shrink-0 rounded-full flex items-center justify-center transition-all"
          title={pick('发起智能电商生图', 'Start AI E-commerce Gen')}
        >
          <ArrowUp size={19} className={isSubmitting ? 'animate-pulse' : ''} />
        </button>
      </div>

    </div>
  );
};

export default MobileEcommercePanel;
