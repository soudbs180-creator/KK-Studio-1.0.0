import React from 'react';
import {
  FileSpreadsheet,
  ImagePlus,
  PackageOpen,
  Sparkles,
  X,
} from 'lucide-react';

import { buildEcommerceUploadPreviewModel } from './ecommerceImportPreview.ts';

interface EcommerceImportPanelProps {
  requirementFileName?: string;
  productFileCount: number;
  extraReferenceCount: number;
  productFiles?: File[];
  extraReferenceFiles?: File[];
  analyzedProductName?: string;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  onPickRequirementFile: (files: FileList | File[]) => void;
  onPickProductFiles: (files: FileList | File[]) => void;
  onPickExtraReferenceFiles: (files: FileList | File[]) => void;
  onClearRequirementFile: () => void;
  onRemoveProductFile: (index: number) => void;
  onRemoveExtraReferenceFile: (index: number) => void;
  onAnalyzeFile: () => void;
  onResetAnalysis?: () => void;
}

const MAX_VISIBLE_PREVIEWS = 4;
const EMPTY_FILES: File[] = [];

function useFilePreviewUrls(files: File[]): string[] {
  const [urls, setUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (files.length === 0 || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setUrls((current) => (current.length === 0 ? current : []));
      return undefined;
    }

    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  return urls;
}

const chipClass = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
const cardClass = 'rounded-[16px] border px-3 py-3';
const cardButtonClass = 'w-full text-left transition-all duration-200 hover:opacity-90';
const thumbClass = 'relative h-[60px] w-[60px] overflow-hidden rounded-[14px] border';

const EcommerceImportPanel: React.FC<EcommerceImportPanelProps> = ({
  requirementFileName,
  productFileCount,
  extraReferenceCount,
  productFiles = EMPTY_FILES,
  extraReferenceFiles = EMPTY_FILES,
  analyzedProductName,
  isAnalyzing,
  hasAnalysis,
  onPickRequirementFile,
  onPickProductFiles,
  onPickExtraReferenceFiles,
  onClearRequirementFile,
  onRemoveProductFile,
  onRemoveExtraReferenceFile,
  onAnalyzeFile,
}) => {
  const requirementInputRef = React.useRef<HTMLInputElement>(null);
  const productInputRef = React.useRef<HTMLInputElement>(null);
  const extraReferenceInputRef = React.useRef<HTMLInputElement>(null);

  const resolvedProductFiles = React.useMemo(() => productFiles.slice(0, MAX_VISIBLE_PREVIEWS), [productFiles]);
  const resolvedExtraReferenceFiles = React.useMemo(() => extraReferenceFiles.slice(0, MAX_VISIBLE_PREVIEWS), [extraReferenceFiles]);
  const resolvedProductCount = Math.min(productFiles.length || productFileCount, MAX_VISIBLE_PREVIEWS);
  const resolvedExtraReferenceCount = Math.min(extraReferenceFiles.length || extraReferenceCount, MAX_VISIBLE_PREVIEWS);
  const hasRequirementFile = Boolean(requirementFileName);
  const hasProductFiles = resolvedProductCount > 0;
  const hasExtraReferences = resolvedExtraReferenceCount > 0;
  const coreReadyCount = [hasRequirementFile, hasProductFiles].filter(Boolean).length;
  const productPreviewUrls = useFilePreviewUrls(resolvedProductFiles);
  const extraReferencePreviewUrls = useFilePreviewUrls(resolvedExtraReferenceFiles);
  const uploadPreviewModel = React.useMemo(() => buildEcommerceUploadPreviewModel({
    analyzedProductName,
    productFiles: resolvedProductFiles,
    extraReferenceFiles: resolvedExtraReferenceFiles,
  }), [analyzedProductName, resolvedExtraReferenceFiles, resolvedProductFiles]);

  const statusLabel = isAnalyzing
    ? '分析中'
    : hasRequirementFile
      ? hasAnalysis ? '可重跑' : '可分析'
      : '待上传';

  const renderPreviewStrip = (
    items: Array<{ id: string; displayLabel: string }>,
    urls: string[],
    onRemove: (index: number) => void,
  ) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={thumbClass}
            style={{
              borderColor: 'var(--frost-card-sub-border)',
              background: 'var(--frost-card-sub-bg)',
            }}
          >
            {urls[index] ? (
              <img
                src={urls[index]}
                alt={item.displayLabel}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--text-secondary)]">
                {item.displayLabel.slice(0, 1)}
              </div>
            )}
              <button
                type="button"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-black/60 text-white transition-all hover:bg-black/75"
                style={{ borderColor: 'rgba(255, 255, 255, 0.18)' }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove(index);
                }}
                aria-label={`删除${item.displayLabel}`}
              >
                <X size={11} />
              </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div
        className="mb-2 rounded-[18px] border px-3 py-3"
        style={{
          background: 'var(--frost-card-framework-bg)',
          borderColor: 'var(--frost-card-sub-border)',
        }}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">电商需求单导入</div>
            <span
              className={chipClass}
              style={{
                borderColor: 'var(--frost-card-sub-border)',
                background: 'var(--frost-card-sub-bg)',
                color: 'var(--text-secondary)',
              }}
            >
              基础项 {coreReadyCount}/2
            </span>
            <span
              className={chipClass}
              style={{
                borderColor: isAnalyzing ? 'var(--state-info-border)' : 'var(--mobile-clay-active-border)',
                background: isAnalyzing ? 'var(--state-info-bg)' : 'var(--mobile-clay-active-bg)',
                color: 'var(--text-primary)',
              }}
            >
              {statusLabel}
            </span>
          </div>

          <div className="text-[11px] leading-5 text-[var(--text-secondary)]">
            需求单参考图逐条绑定；产品图和补充参考图是全局素材。
            {analyzedProductName ? ` 已识别产品：${analyzedProductName}` : ''}
          </div>

          <div className="grid gap-2 md:grid-cols-[1.08fr_1fr_1fr]">
            <div
              className={cardClass}
              style={{
                borderColor: hasRequirementFile ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                background: hasRequirementFile ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
              }}
            >
              <button
                type="button"
                className={cardButtonClass}
                onClick={() => requirementInputRef.current?.click()}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border"
                    style={{
                      borderColor: hasRequirementFile ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                      background: hasRequirementFile ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <FileSpreadsheet size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-medium text-[var(--text-primary)]">上传需求单</div>
                      <span
                        className={chipClass}
                        style={{
                          borderColor: hasRequirementFile ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                          background: hasRequirementFile ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
                          color: hasRequirementFile ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {hasRequirementFile ? '已上传' : '必选'}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                      {hasRequirementFile ? '已导入需求单，可点击重新上传替换。' : '支持 xlsx / pdf / doc / docx / txt / md'}
                    </div>
                  </div>
                </div>
              </button>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {hasRequirementFile ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-[12px] border px-3 text-[11px] font-medium transition-all duration-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      borderColor: 'var(--frost-card-sub-border)',
                      color: 'var(--text-secondary)',
                    }}
                    onClick={() => onClearRequirementFile()}
                    disabled={isAnalyzing}
                  >
                    清除
                  </button>
                ) : null}

                <button
                  type="button"
                  className="ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-[12px] border px-3 text-sm font-semibold transition-all duration-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: 'var(--frost-card-sub-border)',
                    background: 'var(--frost-card-sub-bg)',
                    boxShadow: 'none',
                    color: 'var(--text-primary)',
                  }}
                  onClick={onAnalyzeFile}
                  disabled={isAnalyzing || !hasRequirementFile}
                >
                  <Sparkles size={14} className={isAnalyzing ? 'animate-spin' : ''} />
                  {isAnalyzing ? '分析中…' : hasAnalysis ? '重新分析' : '分析需求单'}
                </button>
              </div>
            </div>

            <div
              className={cardClass}
              style={{
                borderColor: hasProductFiles ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                background: hasProductFiles ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
              }}
            >
              <button
                type="button"
                className={cardButtonClass}
                onClick={() => productInputRef.current?.click()}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border"
                    style={{
                      borderColor: hasProductFiles ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                      background: hasProductFiles ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <PackageOpen size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-medium text-[var(--text-primary)]">上传产品图</div>
                      <span
                        className={chipClass}
                        style={{
                          borderColor: hasProductFiles ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                          background: hasProductFiles ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
                          color: hasProductFiles ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {hasProductFiles ? `${resolvedProductCount}/4` : '必选'}
                      </span>
                      <span
                        className={chipClass}
                        style={{
                          borderColor: 'var(--mobile-clay-active-border)',
                          background: 'var(--mobile-clay-active-bg)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        全局共享
                      </span>
                    </div>

                    {uploadPreviewModel.productItems.length === 0 ? (
                      <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                        最多上传 4 张，可放一个产品的多个角度，或多个产品。
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>

              {renderPreviewStrip(uploadPreviewModel.productItems, productPreviewUrls, onRemoveProductFile)}
            </div>

            <div
              className={cardClass}
              style={{
                borderColor: hasExtraReferences ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                background: hasExtraReferences ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
              }}
            >
              <button
                type="button"
                className={cardButtonClass}
                onClick={() => extraReferenceInputRef.current?.click()}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border"
                    style={{
                      borderColor: hasExtraReferences ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                      background: hasExtraReferences ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <ImagePlus size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-medium text-[var(--text-primary)]">补充参考图</div>
                      <span
                        className={chipClass}
                        style={{
                          borderColor: hasExtraReferences ? 'var(--mobile-clay-active-border)' : 'var(--frost-card-sub-border)',
                          background: hasExtraReferences ? 'var(--mobile-clay-active-bg)' : 'var(--frost-card-sub-bg)',
                          color: hasExtraReferences ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {hasExtraReferences ? `${resolvedExtraReferenceCount}/4` : '可选'}
                      </span>
                      <span
                        className={chipClass}
                        style={{
                          borderColor: 'var(--mobile-clay-active-border)',
                          background: 'var(--mobile-clay-active-bg)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        全局共享
                      </span>
                    </div>

                    {uploadPreviewModel.extraReferenceItems.length === 0 ? (
                      <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                        最多上传 4 张，风格、场景、版式参考会全局生效。
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>

              {renderPreviewStrip(uploadPreviewModel.extraReferenceItems, extraReferencePreviewUrls, onRemoveExtraReferenceFile)}
            </div>
          </div>
        </div>
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
    </>
  );
};

export default EcommerceImportPanel;
