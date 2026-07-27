// 简体中文：已登录空画布欢迎态组件
import React from 'react';
import { Sparkles, ArrowRight, Key, X } from 'lucide-react';
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
  const [isDismissed, setIsDismissed] = React.useState(false);

  const t = <T,>(text: { zh: T; en: T }): T => {
    return pickByResolvedLanguage(language, text.zh, text.en);
  };

  if (isDismissed) return null;

  return (
    <div className="absolute pointer-events-none empty-canvas-welcome-layer">
      <section
        className="empty-canvas-welcome-panel pointer-events-auto flex w-full flex-col overflow-hidden rounded-lg border"
        aria-labelledby="empty-canvas-title"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-3 text-left">
            <span className="empty-canvas-welcome-icon flex size-8 shrink-0 items-center justify-center rounded-md" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <h2 id="empty-canvas-title" className="truncate text-sm font-semibold">
                {t({ zh: '欢迎使用 KK Studio 画布', en: 'Welcome to KK Studio Canvas' })}
              </h2>
              <p className="mt-0.5 truncate text-xs empty-canvas-welcome-muted">
                {t({ zh: '选择一个工作流模板开始创作', en: 'Choose a workflow template to start creating' })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="empty-canvas-welcome-settings inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium"
              onClick={onOpenSettings}
            >
              <Key size={15} aria-hidden="true" />
              {t({ zh: '配置模型', en: 'Configure models' })}
            </button>
            <button
              type="button"
              className="empty-canvas-welcome-close inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border"
              aria-label={t({ zh: '关闭介绍页', en: 'Close introduction' })}
              onClick={() => setIsDismissed(true)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div
          className="empty-canvas-workflow-list flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
          aria-labelledby="empty-canvas-workflow-title"
        >
          <h3
            id="empty-canvas-workflow-title"
            className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] empty-canvas-welcome-muted"
          >
            {t({ zh: '工作流模板', en: 'Workflow templates' })}
          </h3>
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
