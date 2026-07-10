// 简体中文：已登录空画布欢迎态组件
import React from 'react';
import { Sparkles, ArrowRight, Key } from 'lucide-react';
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
    <div className="absolute pointer-events-none empty-canvas-welcome-layer">
      <section
        className="empty-canvas-welcome-panel pointer-events-auto flex w-full flex-col overflow-hidden rounded-lg border"
        aria-labelledby="empty-canvas-title"
      >
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-3 text-left">
            <span className="empty-canvas-welcome-icon flex size-8 shrink-0 items-center justify-center rounded-md" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <h2 id="empty-canvas-title" className="truncate text-sm font-semibold">
                {t({ zh: '选择工作流开始', en: 'Start with a workflow' })}
              </h2>
              <p className="mt-0.5 truncate text-xs empty-canvas-welcome-muted">
                {t({ zh: 'KK Studio 画布', en: 'KK Studio Canvas' })}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="empty-canvas-welcome-settings inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium"
            onClick={onOpenSettings}
          >
            <Key size={15} aria-hidden="true" />
            {t({ zh: '配置模型', en: 'Configure models' })}
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-3">
          <div className="flex flex-col gap-1.5">
            {WORKFLOW_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => onApplyWorkflowTemplate(tmpl.id)}
                className="empty-canvas-workflow-row group flex min-h-14 w-full items-center justify-between gap-4 rounded-md border px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-semibold">
                    {tmpl.title}
                  </h3>
                  <p className="mt-1 truncate text-[11px] empty-canvas-welcome-muted">
                    {tmpl.description}
                  </p>
                </div>
                <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
export default EmptyCanvasWelcome;
