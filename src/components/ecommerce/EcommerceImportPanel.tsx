import React, { useRef } from 'react';
import { FileSpreadsheet, ImagePlus, PackageOpen, RotateCcw, Sparkles } from 'lucide-react';

interface EcommerceImportPanelProps {
  requirementFileName?: string;
  productFileCount: number;
  extraReferenceCount: number;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  onPickRequirementFile: (files: FileList | File[]) => void;
  onPickProductFiles: (files: FileList | File[]) => void;
  onPickExtraReferenceFiles: (files: FileList | File[]) => void;
  onAnalyzeFile: () => void;
  onResetAnalysis: () => void;
}

const buttonClass = 'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5';

const EcommerceImportPanel: React.FC<EcommerceImportPanelProps> = ({
  requirementFileName,
  productFileCount,
  extraReferenceCount,
  isAnalyzing,
  hasAnalysis,
  onPickRequirementFile,
  onPickProductFiles,
  onPickExtraReferenceFiles,
  onAnalyzeFile,
  onResetAnalysis,
}) => {
  const requirementInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const extraReferenceInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-2 rounded-xl border p-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">电商需求单导入</div>
          <div className="text-xs text-[var(--text-secondary)]">先上传运营需求文件与产品图，分析完成后再确认建卡。</div>
        </div>
        {hasAnalysis ? (
          <button
            type="button"
            className={buttonClass}
            style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}
            onClick={onResetAnalysis}
          >
            <RotateCcw size={14} />
            重新分析
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <button
          type="button"
          className={buttonClass}
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
          onClick={() => requirementInputRef.current?.click()}
        >
          <FileSpreadsheet size={14} />
          <span className="truncate">{requirementFileName || '上传需求单（xlsx/pdf/docx/doc/txt/md）'}</span>
        </button>

        <button
          type="button"
          className={buttonClass}
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
          onClick={() => productInputRef.current?.click()}
        >
          <PackageOpen size={14} />
          <span>{productFileCount > 0 ? `产品图 ${productFileCount} 张` : '上传产品图'}</span>
        </button>

        <button
          type="button"
          className={buttonClass}
          style={{ borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
          onClick={() => extraReferenceInputRef.current?.click()}
        >
          <ImagePlus size={14} />
          <span>{extraReferenceCount > 0 ? `补充参考图 ${extraReferenceCount} 张` : '补充参考图'}</span>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          style={{
            borderColor: isAnalyzing ? 'rgba(14, 165, 233, 0.4)' : 'rgba(59, 130, 246, 0.4)',
            background: isAnalyzing ? 'rgba(14, 165, 233, 0.12)' : 'rgba(59, 130, 246, 0.12)',
            color: 'var(--text-primary)',
          }}
          onClick={onAnalyzeFile}
          disabled={isAnalyzing}
        >
          <Sparkles size={14} className={isAnalyzing ? 'animate-spin' : ''} />
          {isAnalyzing ? '分析中…' : '分析需求单'}
        </button>
        <span className="text-xs text-[var(--text-tertiary)]">文本框里的内容会作为额外要求，叠加到每张电商卡提示词里。</span>
      </div>

      <input
        ref={requirementInputRef}
        type="file"
        accept=".xlsx,.pdf,.doc,.docx,.txt,.md"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onPickRequirementFile(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={productInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onPickProductFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={extraReferenceInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onPickExtraReferenceFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
};

export default EcommerceImportPanel;
