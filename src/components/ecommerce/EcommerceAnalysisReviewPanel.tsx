import React from 'react';
import { AlertTriangle, CheckSquare, Square } from 'lucide-react';

import type { EcommerceAnalysisResult } from '../../services/ecommerce/types.ts';

interface EcommerceAnalysisReviewPanelProps {
  analysis: EcommerceAnalysisResult;
  selection: Record<string, boolean>;
  onToggleSelection: (id: string, selected: boolean) => void;
  onConfirm: () => void;
}

const EcommerceAnalysisReviewPanel: React.FC<EcommerceAnalysisReviewPanelProps> = ({
  analysis,
  selection,
  onToggleSelection,
  onConfirm,
}) => {
  return (
    <div className="mb-2 rounded-xl border p-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">分析结果确认</div>
          <div className="text-xs text-[var(--text-secondary)]">
            主图 {analysis.mainImageItems.length} 条，A+ 模块 {analysis.aPlusGroup.modules.length} 条。
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-xs font-medium"
          style={{ borderColor: 'rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--text-primary)' }}
          onClick={onConfirm}
        >
          确认并建卡
        </button>
      </div>

      {analysis.reviewWarnings.length > 0 ? (
        <div className="mb-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--text-secondary)' }}>
          <div className="mb-1 flex items-center gap-2 font-medium text-[var(--text-primary)]">
            <AlertTriangle size={14} />
            需要人工确认
          </div>
          <div className="space-y-1">
            {analysis.reviewWarnings.slice(0, 4).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <section>
          <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">主图卡</div>
          <div className="space-y-2">
            {analysis.mainImageItems.map((item) => {
              const checked = selection[item.itemId] !== false;
              return (
                <button
                  key={item.itemId}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left"
                  style={{ borderColor: checked ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-light)', background: checked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}
                  onClick={() => onToggleSelection(item.itemId, !checked)}
                >
                  {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{item.sequence}. {item.theme || item.type}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{item.designRequirements}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-medium text-[var(--text-secondary)]">A+ 模块卡</div>
          <div className="space-y-2">
            {analysis.aPlusGroup.modules.map((item) => {
              const checked = selection[item.moduleId] !== false;
              return (
                <button
                  key={item.moduleId}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left"
                  style={{ borderColor: checked ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-light)', background: checked ? 'rgba(16, 185, 129, 0.08)' : 'transparent' }}
                  onClick={() => onToggleSelection(item.moduleId, !checked)}
                >
                  {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{item.moduleName}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      {item.declaredSizeText ? `文件尺寸：${item.declaredSizeText} · ` : ''}
                      {item.designRequirements}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default EcommerceAnalysisReviewPanel;
