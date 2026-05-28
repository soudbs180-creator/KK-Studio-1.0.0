import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Upload, X, Trash2, Image as ImageIcon, Sparkle, 
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Layers, CheckCircle2, Play 
} from 'lucide-react';
import { AspectRatio, ImageSize } from '../../types';
import { notify } from '../../services/system/notificationService';
import { generateImage } from '../../services/llm/geminiService';
import { llmService } from '../../services/llm/LLMService';

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
  const [prompt, setPrompt] = useState(config.prompt || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInspirationOpen, setIsInspirationOpen] = useState(false);
  
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
      <div className={`${w} ${h} rounded border-[1.5px] shrink-0 transition-all ${
        isActive ? 'border-rose-500' : 'border-white/20'
      }`} />
    );
  };

  // 灵感模板填词
  const handleSelectInspiration = (text: string, title: string) => {
    setPrompt(text);
    notify.success('已填入灵感词', `已选择“${title}”场景风格`);
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
            const result = await generateImage(
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
              throw new Error('生图接口未返回有效 url');
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
            errorMsg: finalError instanceof Error ? finalError.message : '生成失败，请重试'
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
      notify.warning('无法发起生图', '请先上传您的产品主体图 (左侧必填)');
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
          else reject(new Error('图片格式不兼容'));
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
      notify.error('参考图读取失败', readErr?.message || '请检查上传文件');
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
      const aiResponse = await llmService.chat({
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
      
      notify.success('AI 规划就绪', `成功为 ${batchCount} 张图片规划了差异化电商卖点！`);

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
      notify.success('批量生成结束', '所有电商生图卡片已按并发调度逻辑出图完毕！');
    } catch (err: any) {
      console.error('队列调度发生意外错误', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[995] flex flex-col bg-[#0A0A0C] text-[var(--text-primary)] font-sans overflow-hidden">
      
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

      {/* 顶部彩色极光发光圈，体现 Rich Aesthetics */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full bg-gradient-to-br from-[#FF5E62]/8 to-[#8A2387]/10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[-180px] left-1/4 w-[320px] h-[320px] rounded-full bg-gradient-to-br from-[#FF9966]/4 to-[#FF5E62]/8 blur-[90px] pointer-events-none z-0" />

      {/* 顶部 Header，毛玻璃拟态，高度精准锁定 */}
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#0A0A0C]/60 px-4 backdrop-blur-2xl z-10">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400 animate-pulse">
            <Layers size={16} />
          </div>
          <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
            AI 智能电商极速看板
          </span>
        </div>
        <button 
          type="button" 
          onClick={onClose} 
          className="p-1.5 text-[var(--text-secondary)] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] active:scale-90 rounded-full transition-all"
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
              核心产品主体 (必填)
            </div>
            {ecommerceProductFiles.length > 0 ? (
              <div className="relative h-[85px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] p-1.5 flex items-center gap-2">
                <img 
                  src={URL.createObjectURL(ecommerceProductFiles[0])} 
                  alt="产品主体" 
                  className="w-12 h-12 object-cover rounded-lg shrink-0 border border-white/5" 
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white/90 truncate">{ecommerceProductFiles[0].name}</div>
                  <div className="text-[9px] text-[var(--text-tertiary)] mt-0.5">{(ecommerceProductFiles[0].size / 1024).toFixed(1)} KB</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => onRemoveEcommerceProductFile?.(0)}
                  className="p-1.5 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg active:scale-90 transition-all shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <label className="group relative flex flex-col items-center justify-center h-[85px] rounded-xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.02] hover:border-rose-500/20 transition-all duration-300 active:scale-[0.98] cursor-pointer">
                <Upload size={18} className="text-rose-400 mb-1 group-hover:scale-105 transition-transform" />
                <span className="text-[10px] font-bold text-white/80">上传产品</span>
                <span className="text-[8px] text-[var(--text-tertiary)] scale-90 mt-0.5">自动抠图融合</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleProductUpload} />
              </label>
            )}
          </div>

          {/* 氛围参考 (右侧 40% 宽度) */}
          <div className="col-span-4 space-y-1.5">
            <div className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5" style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              氛围参考 (可选)
            </div>
            {ecommerceExtraReferenceFiles.length > 0 ? (
              <div className="relative h-[85px] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] p-1.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <img 
                    src={URL.createObjectURL(ecommerceExtraReferenceFiles[0])} 
                    alt="氛围参考" 
                    className="w-8 h-8 object-cover rounded-md shrink-0 border border-white/5" 
                  />
                  <span className="text-[9px] text-[var(--text-secondary)] truncate flex-1 leading-none">
                    {ecommerceExtraReferenceFiles[0].name}
                  </span>
                </div>
                <button 
                  type="button" 
                  onClick={() => onRemoveEcommerceExtraReferenceFile?.(0)}
                  className="w-full py-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 rounded-md active:scale-95 transition-all text-center"
                >
                  移除参考
                </button>
              </div>
            ) : (
              <label className="group relative flex flex-col items-center justify-center h-[85px] rounded-xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.02] hover:border-amber-500/20 transition-all duration-300 active:scale-[0.98] cursor-pointer">
                <ImageIcon size={18} className="text-amber-400 mb-1 group-hover:scale-105 transition-transform" />
                <span className="text-[10px] font-bold text-white/80">上传背景</span>
                <span className="text-[8px] text-[var(--text-tertiary)] scale-90 mt-0.5">借鉴色调打光</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
              </label>
            )}
          </div>
        </div>

        {/* ================= 2. 出图区 (Carousel 卡片详情滑动展示) ================= */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">🌟 AI 生成出图看板 (Carousel 左右滑动查看)</span>
            {tasks.length > 0 && (
              <span className="text-[10px] font-bold text-rose-400">
                图 {activeCarouselIndex + 1} / {tasks.length}
              </span>
            )}
          </div>

          <div className="relative w-full h-[280px] rounded-2xl border border-white/8 bg-white/[0.015] overflow-hidden flex flex-col justify-between p-3.5 shadow-xl shadow-black/30">
            {isAnalyzingPrompt ? (
              // AI 分析中的加载骨架
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="relative w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                  <Sparkles size={24} className="text-rose-400 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <div className="text-center space-y-1.5">
                  <div className="text-xs font-bold text-white/90 animate-pulse">正在为 {batchCount} 张图片智能分配电商卖点提示词...</div>
                  <div className="text-[9px] text-[var(--text-tertiary)] leading-relaxed max-w-[240px]">AI 正在深度解剖产品特性，自动锁定最佳的高抛光主图、生活使用以及细节展示视角。</div>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              // 初始状态
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.02] text-[var(--text-tertiary)] border border-white/5 shadow-md">
                  <Sparkles size={26} />
                </div>
                <div className="text-center space-y-1">
                  <div className="text-xs font-bold text-white/70">电商大片待魔法酝酿</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] max-w-[200px]">配置下方的电商平台、目标市场与数量，点击右下角发送立即排队并发生成。</div>
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
                        排队中
                      </div>
                      <div className="text-center space-y-1">
                        <div className="text-xs text-white/80">等待调度 Worker 启动...</div>
                        <div className="text-[9px] text-[var(--text-tertiary)]">并发度限制为 2，以最大化维持云端生成稳定性。</div>
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
                        <div className="text-xs font-bold text-white/90">正在进行第 {tasks[activeCarouselIndex].attempts}/3 次尝试生成...</div>
                        <div className="text-[9px] text-[var(--text-tertiary)]">正在多模态融合您的产品，并发渲染中。</div>
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
                        className="absolute bottom-1 right-1 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-rose-300 hover:text-white transition-colors flex items-center gap-1 active:scale-95"
                      >
                        下载大图
                      </a>
                    </div>
                  )}

                  {tasks[activeCarouselIndex].status === 'error' && (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle size={24} className="text-rose-500" />
                      <div className="text-center space-y-1">
                        <div className="text-xs font-bold text-rose-400">已达 3 次重试上限均失败</div>
                        <div className="text-[9px] text-white/50 px-4 max-w-[260px] truncate">{tasks[activeCarouselIndex].errorMsg}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 卡片底部描述信息 (像首页的详细卡片一样，展示商业策略) */}
                <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-1 select-none">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                      🎯 {tasks[activeCarouselIndex].angleName}
                    </span>
                    {tasks[activeCarouselIndex].status === 'success' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-0.5">
                        <CheckCircle2 size={8} /> 渲染成功
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
                      className={`p-1.5 rounded-full bg-black/70 border border-white/10 text-white active:scale-90 pointer-events-auto transition-all ${
                        activeCarouselIndex === 0 ? 'opacity-25 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                      }`}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCarouselIndex(prev => Math.min(tasks.length - 1, prev + 1))}
                      disabled={activeCarouselIndex === tasks.length - 1}
                      className={`p-1.5 rounded-full bg-black/70 border border-white/10 text-white active:scale-90 pointer-events-auto transition-all ${
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
        <div className="space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsInspirationOpen(!isInspirationOpen)}
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] active:scale-98 transition-all flex items-center justify-between text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Sparkle size={13} className="text-amber-400" />
              <span>{isInspirationOpen ? '💡 收起电商灵感库' : '💡 展开一键电商灵感库'}</span>
            </div>
            <div className={`text-[10px] text-[var(--text-tertiary)] transition-transform duration-300 ${
              isInspirationOpen ? 'rotate-180' : ''
            }`}>
              ▼
            </div>
          </button>

          {isInspirationOpen && (
            <div className="grid grid-cols-2 gap-2 pr-0.5 p-2 rounded-2xl border border-white/5 bg-white/[0.008] no-scrollbar animate-[fadeIn_0.3s_ease]">
              {INSPIRATION_TAGS.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectInspiration(tag.text, tag.title)}
                  className="flex items-center gap-2 py-2 px-2.5 rounded-xl text-[11px] font-semibold bg-white/[0.02] border border-white/5 text-[var(--text-secondary)] hover:text-white hover:bg-rose-500/5 hover:border-rose-500/20 active:scale-95 transition-all text-left truncate shadow-sm"
                >
                  <span className="text-sm shrink-0">{tag.emoji}</span>
                  <span className="truncate">{tag.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ================= 4. 参数与尺寸配置面板 (两合一模块) ================= */}
        <div className="space-y-3.5 shrink-0 p-3 rounded-2xl border border-white/5 bg-white/[0.008]">
          {/* Tab 切换控制栏 */}
          <div className="flex p-0.5 rounded-xl bg-white/[0.02] border border-white/5">
            <button
              type="button"
              onClick={() => setActiveConfigTab('ratio')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                activeConfigTab === 'ratio'
                  ? 'bg-gradient-to-r from-[#FF5E62]/10 to-[#8A2387]/10 text-rose-400 border border-rose-500/20 shadow-sm'
                  : 'text-[var(--text-secondary)] border border-transparent hover:text-white'
              }`}
              style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}
            >
              📐 构图比例
            </button>
            <button
              type="button"
              onClick={() => setActiveConfigTab('params')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                activeConfigTab === 'params'
                  ? 'bg-gradient-to-r from-[#FF5E62]/10 to-[#8A2387]/10 text-rose-400 border border-rose-500/20 shadow-sm'
                  : 'text-[var(--text-secondary)] border border-transparent hover:text-white'
              }`}
              style={{ fontFamily: '"HarmonyOS Sans SC", sans-serif' }}
            >
              ⚙️ 生成参数
            </button>
          </div>

          {/* Tab 1: 构图比例 */}
          {activeConfigTab === 'ratio' && (
            <div className="grid grid-cols-2 gap-2 animate-[fadeIn_0.2s_ease]">
              {RATIO_LIST.map((item) => {
                const isActive = activeRatio === item.ratio;
                return (
                  <button
                    key={item.ratio}
                    type="button"
                    onClick={() => handleRatioChange(item.ratio)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-tr from-rose-500/10 to-amber-500/5 border-rose-500/40 text-white shadow-md shadow-rose-500/2'
                        : 'bg-white/[0.01] border-white/5 text-[var(--text-secondary)] hover:border-white/10 hover:bg-white/[0.02] active:scale-[0.995]'
                    }`}
                  >
                    {renderRatioSkeleton(item.w, item.h, isActive)}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold transition-colors truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
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
                <span className="text-[9px] text-white/45">电商平台</span>
                <select 
                  value={platform} 
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-[#111115] border border-white/8 rounded-lg px-2 py-1 outline-none text-white/90 active:border-rose-500/30 transition-colors text-[10px]"
                >
                  {['亚马逊', '天猫', '淘宝', 'Shopee', '拼多多'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 目标市场 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/45">目标市场</span>
                <select 
                  value={targetMarket} 
                  onChange={(e) => setTargetMarket(e.target.value)}
                  className="w-full bg-[#111115] border border-white/8 rounded-lg px-2 py-1 outline-none text-white/90 active:border-rose-500/30 transition-colors text-[10px]"
                >
                  {['欧美', '日韩', '中国大陆', '东南亚'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 文案语种 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/45">文案语种</span>
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-[#111115] border border-white/8 rounded-lg px-2 py-1 outline-none text-white/90 active:border-rose-500/30 transition-colors text-[10px]"
                >
                  {['英文', '中文', '日文', '韩文'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* 模型选择 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/45">模型选择</span>
                <select 
                  value={modelType} 
                  onChange={(e) => setModelType(e.target.value)}
                  className="w-full bg-[#111115] border border-white/8 rounded-lg px-2 py-1 outline-none text-white/90 active:border-rose-500/30 transition-colors text-[10px]"
                >
                  {['gemini-2.5-flash-image'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* 分辨率选择 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/45">分辨率选择</span>
                <select 
                  value={resolution} 
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full bg-[#111115] border border-white/8 rounded-lg px-2 py-1 outline-none text-white/90 active:border-rose-500/30 transition-colors text-[10px]"
                >
                  {['1K', '2K', '4K'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* 出图张数 */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/45">出图张数 (1-10张)</span>
                <div className="flex items-center bg-[#111115] border border-white/8 rounded-lg h-[24px]">
                  <button 
                    type="button" 
                    onClick={() => setBatchCount(prev => Math.max(1, prev - 1))}
                    className="px-2.5 py-0.5 text-white/60 hover:text-white active:scale-75 select-none text-[10px]"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-[10px]">{batchCount}</span>
                  <button 
                    type="button" 
                    onClick={() => setBatchCount(prev => Math.min(10, prev + 1))}
                    className="px-2.5 py-0.5 text-white/60 hover:text-white active:scale-75 select-none text-[10px]"
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
      <div className="absolute bottom-0 left-0 right-0 bg-[#0A0A0C]/90 border-t border-white/5 p-3 pb-4 backdrop-blur-md flex items-end gap-2.5 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="上传主体后，简要描述产品和您想要的场景背景，AI 将生成差异化极速出图排队..."
          className="flex-1 h-[88px] max-h-[120px] rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-xs outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 text-white placeholder-white/20 resize-none transition-all no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        />
        
        <button
          type="button"
          onClick={handleGenerateSubmit}
          disabled={isSubmitting}
          className={`w-[45px] h-[45px] shrink-0 rounded-xl flex items-center justify-center text-white transition-all mb-0.5 ${
            isSubmitting
              ? 'bg-white/10 text-white/50 cursor-not-allowed'
              : 'bg-gradient-to-tr from-[#FF5E62] to-[#FF9966] hover:shadow-lg hover:shadow-rose-500/10 active:scale-[0.95]'
          }`}
          title="发起智能电商生图"
        >
          <Play 
            size={18} 
            fill={isSubmitting ? "none" : "currentColor"} 
            className={isSubmitting ? 'animate-spin' : ''} 
          />
        </button>
      </div>

    </div>
  );
};

export default MobileEcommercePanel;

