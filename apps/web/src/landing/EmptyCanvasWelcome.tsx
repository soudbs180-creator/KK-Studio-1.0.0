// 简体中文：已登录空画布欢迎态组件
import React from 'react';
import { Sparkles, ArrowRight, MousePointerClick, FileUp, Key } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { pickByResolvedLanguage } from '../utils/localeText';
import { WORKFLOW_TEMPLATES, type WorkflowTemplateId } from '../workflow/templates/workflowTemplates';

interface EmptyCanvasWelcomeProps {
  onApplyWorkflowTemplate: (templateId: WorkflowTemplateId) => void;
  onOpenSettings: () => void;
}

export const EmptyCanvasWelcome: React.FC<EmptyCanvasWelcomeProps> = ({
  onApplyWorkflowTemplate,
  onOpenSettings
}) => {
  const { language } = useLocale();

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-6 empty-canvas-welcome-layer">
      <div className="w-full max-w-2xl rounded-3xl border border-[#e5e5e5] bg-white/70 backdrop-blur-md p-8 md:p-12 shadow-sm pointer-events-auto flex flex-col items-center text-center transition-all duration-300 empty-canvas-welcome-panel">
        
        {/* Animated Brand Icon */}
        <div className="w-10 h-10 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center mb-6">
          <Sparkles size={20} />
        </div>

        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-[#0a0a0a] mb-4 leading-tight">
          {t({ zh: '欢迎使用 KK Studio 画布', en: 'Welcome to KK Studio Canvas' })}
        </h2>
        
        {/* Subheading */}
        <p className="text-xs md:text-sm text-[#3a3a3a] leading-relaxed max-w-md mb-8 font-light">
          {t({
            zh: '这是一个无限创作空间。你可以在此自由地编排 Prompt 节点、路由全球模型并自动执行 AI Agent。',
            en: 'An infinite creative sandbox. Compose prompts, route models, and orchestrate visual workflows seamlessly.'
          })}
        </p>

        {/* Quick Operations Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8 text-left">
          <div className="p-4 rounded-xl border border-gray-100 bg-[#fffaf0]/80">
            <div className="flex items-center gap-2 text-[#0a0a0a] font-medium text-xs mb-2">
              <MousePointerClick size={14} className="text-rose-500" />
              <span>{t({ zh: '双击空白处', en: 'Double Click' })}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal font-light">
              {t({ zh: '在画布任意位置双击，即可创建首个 Prompt 创作卡片。', en: 'Double-click anywhere on the canvas to create your first prompt card.' })}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-[#fffaf0]/80">
            <div className="flex items-center gap-2 text-[#0a0a0a] font-medium text-xs mb-2">
              <FileUp size={14} className="text-emerald-500" />
              <span>{t({ zh: '拖入素材图', en: 'Drag References' })}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal font-light">
              {t({ zh: '直接拖拽商品原图或本地参考图进画布，自动转为图片节点。', en: 'Drag product shots or references onto the canvas to instantly make image nodes.' })}
            </p>
          </div>

          <button
            type="button"
            className="w-full p-4 rounded-xl border border-gray-100 bg-[#fffaf0]/80 cursor-pointer hover:border-gray-300 transition-colors text-left"
            onClick={onOpenSettings}
          >
            <div className="flex items-center gap-2 text-[#0a0a0a] font-medium text-xs mb-2">
              <Key size={14} className="text-[#b8a4ed]" />
              <span>{t({ zh: '配置 API 密钥', en: 'API Settings' })}</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-normal font-light">
              {t({ zh: '点击在此处配置并激活您的个人大模型 API 访问密钥。', en: 'Click here to configure and secure your global model API credentials.' })}
            </p>
          </button>
        </div>

        {/* Quick Apply Workflow Templates */}
        <div className="w-full border-t border-t-gray-100 pt-6 text-left">
          <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase block mb-4">
            {t({ zh: '快速载入工作流预设 / PRESETS', en: 'LOAD WORKFLOW TEMPLATE' })}
          </span>
          <div className="flex flex-col gap-3">
            {WORKFLOW_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onApplyWorkflowTemplate(tmpl.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-white hover:border-[#adadad] hover:bg-gray-50 transition-all text-left group"
              >
                <div>
                  <h4 className="text-xs font-semibold text-[#0a0a0a] mb-1">
                    {tmpl.title}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-light">
                    {tmpl.description}
                  </p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-[#0a0a0a] group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
export default EmptyCanvasWelcome;
