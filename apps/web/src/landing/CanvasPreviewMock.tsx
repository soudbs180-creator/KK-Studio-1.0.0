// 简体中文：静态纯 CSS+React 模拟 KK Studio 画布预览组件
import React from 'react';
import { Sparkles, Database, Table, Cpu, ShieldCheck } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';

export const CanvasPreviewMock: React.FC = () => {
  const { language } = useLocale();

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  return (
    <div className="relative w-full h-[500px] md:h-[600px] rounded-3xl border border-[#e5e5e5] bg-[#fffaf0] overflow-hidden shadow-sm flex items-center justify-center select-none">
      {/* 模拟画板网格背景 */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.25]"
        style={{
          backgroundImage: `
            radial-gradient(circle, #0a0a0a 1px, transparent 1px),
            radial-gradient(circle, #0a0a0a 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 12px 12px'
        }}
      />

      {/* SVG 连线层 */}
      <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
        {/* Connection 1: Prompt -> Route */}
        <path
          d="M 220 200 C 300 200, 320 280, 420 280"
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="1.5"
          opacity="0.25"
        />
        <path
          d="M 220 200 C 300 200, 320 280, 420 280"
          fill="none"
          stroke="var(--kk-color-brand-coral, #ff6b5a)"
          strokeWidth="1.5"
          className="mock-flow-line"
        />

        {/* Connection 2: Image Reference -> Prompt */}
        <path
          d="M 200 400 C 120 400, 120 200, 200 200"
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="1.5"
          opacity="0.15"
        />

        {/* Connection 3: Route -> Output Batch */}
        <path
          d="M 540 280 C 640 280, 620 180, 720 180"
          fill="none"
          stroke="var(--kk-color-brand-coral, #ff6b5a)"
          strokeWidth="1.5"
          className="mock-flow-line"
          style={{ animationDirection: 'reverse' }}
        />
        <path
          d="M 540 280 C 640 280, 620 380, 720 380"
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="1.5"
          opacity="0.25"
        />
      </svg>

      {/* Card 1: Prompt Composer Node (Left-Top) */}
      <div className="absolute top-[80px] left-[40px] md:left-[80px] z-20 w-[240px] md:w-[280px] rounded-2xl border border-[#e5e5e5] bg-white/90 p-4 shadow-lg backdrop-blur-md transition-transform duration-300 hover:-translate-y-1">
        <div className="flex items-center justify-between mb-3 border-b pb-2 border-b-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d8b]" />
            <span className="text-xs font-semibold tracking-wider uppercase text-[#0a0a0a]">Prompt Composer</span>
          </div>
          <span className="text-[10px] text-gray-400">Node-01</span>
        </div>
        <p className="text-xs text-[#3a3a3a] leading-relaxed font-mono bg-[#faf5e8] p-2.5 rounded-lg border border-[#e5e5e5]/50">
          "{t({ zh: '一张精致的电商主图，珊瑚色背景，柔和日光，产品置于暖白色黏土展台上，3d 真实渲染…', en: 'A premium product shot, coral background, soft sunlight, clay podium...' })}"
        </p>
        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-[10px] bg-gray-100 text-[#6a6a6a] px-2 py-0.5 rounded">#podium</span>
          <span className="text-[10px] bg-gray-100 text-[#6a6a6a] px-2 py-0.5 rounded">#sunlight</span>
        </div>
      </div>

      {/* Card 2: Model Router Node (Center) */}
      <div className="absolute top-[230px] left-[150px] md:left-[360px] z-20 w-[200px] md:w-[240px] rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-transform duration-300 hover:-translate-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="text-[#b8a4ed] w-4 h-4" />
          <span className="text-xs font-semibold text-[#0a0a0a]">{t({ zh: '多模型智能路由', en: 'Model Router' })}</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] border-b pb-1.5 border-b-gray-100">
            <span className="text-[#6a6a6a]">GPT-4o (Supplier A)</span>
            <span className="text-emerald-600 font-medium">{t({ zh: '激活', en: 'Active' })}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] border-b pb-1.5 border-b-gray-100">
            <span className="text-[#6a6a6a]">Claude 3.5 Sonnet</span>
            <span className="text-emerald-600 font-medium">{t({ zh: '备用', en: 'Standby' })}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] opacity-60">
            <span className="text-[#6a6a6a]">DeepSeek R1</span>
            <span className="text-gray-400">{t({ zh: '挂起', en: 'Paused' })}</span>
          </div>
        </div>
      </div>

      {/* Card 3: Image Output Node (Right-Top) */}
      <div className="absolute top-[60px] right-[40px] md:right-[80px] z-20 w-[180px] md:w-[220px] rounded-2xl border border-[#e5e5e5] bg-white p-2.5 shadow-lg transition-transform duration-300 hover:-translate-y-1">
        <div className="relative aspect-square w-full rounded-xl bg-orange-50 overflow-hidden mb-2.5 border border-gray-100">
          {/* Mock podium & product */}
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-100 via-orange-50 to-amber-100 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/30 blur-md absolute top-4 left-4" />
            <div className="w-24 h-6 bg-[#fffaf0] border border-[#e5e5e5] rounded-full transform rotate-3 absolute bottom-8 shadow-sm flex items-center justify-center text-[10px] text-gray-500 font-serif">KK Studio</div>
            <div className="w-10 h-16 bg-gradient-to-b from-[#ff6b5a] to-[#ffb084] rounded-lg shadow-md transform -rotate-6 z-10" />
          </div>
          <div className="absolute top-2 left-2 bg-[#ff4d8b] text-white text-[9px] font-medium px-2 py-0.5 rounded-full">
            100% {t({ zh: '生成完毕', en: 'Done' })}
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-[#0a0a0a]">Podium_Asset_01.png</span>
          <span className="text-[10px] text-gray-400">1.2 MB</span>
        </div>
      </div>

      {/* Card 4: Agent Timeline Node (Right-Bottom) */}
      <div className="absolute bottom-[40px] right-[20px] md:right-[120px] z-20 w-[240px] md:w-[260px] rounded-2xl border border-black/10 bg-[#0a0a0a] text-white p-4 shadow-xl transition-transform duration-300 hover:-translate-y-1">
        <div className="flex items-center justify-between mb-3 border-b pb-2 border-b-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/90">Agent Timeline</span>
          </div>
          <span className="text-[10px] text-teal-400 font-mono">Durable Runtime</span>
        </div>
        <div className="flex flex-col gap-2 font-mono text-[10px] text-gray-300">
          <div className="flex gap-2 text-gray-400">
            <span>[12:02]</span>
            <span>Initialize Ecommerce Slot batch...</span>
          </div>
          <div className="flex gap-2 text-teal-300">
            <span>[12:03]</span>
            <span>Auto-crop product background -&gt; OK</span>
          </div>
          <div className="flex gap-2">
            <span>[12:03]</span>
            <span className="animate-pulse">Running Model Router proxy...</span>
          </div>
        </div>
      </div>

      {/* Floating Small Info Cards */}
      <div className="absolute bottom-[160px] left-[30px] md:left-[100px] z-20 bg-white/95 border border-[#e5e5e5] rounded-xl px-3 py-2 shadow-md flex items-center gap-2">
        <ShieldCheck className="text-emerald-500 w-4 h-4" />
        <span className="text-xs font-medium text-[#3a3a3a]">{t({ zh: '个人密钥隔离', en: 'Credential Isolated' })}</span>
      </div>

      <div className="absolute top-[30px] left-[200px] md:left-[300px] z-20 bg-white/95 border border-[#e5e5e5] rounded-xl px-3 py-2 shadow-md flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="text-xs font-medium text-[#3a3a3a]">{t({ zh: '积分余额预扣自愈', en: 'Deduct Safe' })}</span>
      </div>
    </div>
  );
};
export default CanvasPreviewMock;
