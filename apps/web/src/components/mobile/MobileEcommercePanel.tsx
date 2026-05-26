import React, { useState } from 'react';
import { Sparkles, Upload, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { AspectRatio } from '../../types';

// 文件预览组件，使用 Object URL 来避免高强度的 base64 处理，提高移动端性能
const FilePreview: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [url, setUrl] = useState('');

  React.useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    // 组件卸载时释放 URL，防止移动端内存泄漏
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 p-2 flex items-center gap-3">
      {url && <img src={url} alt="预览" className="w-16 h-16 object-cover rounded-lg shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate text-[var(--text-primary)]">{file.name}</div>
        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
      </div>
      <button 
        type="button" 
        onClick={onRemove} 
        className="p-2 text-red-400 hover:bg-white/5 rounded-full active:scale-90 shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export interface MobileEcommercePanelProps {
  onClose: () => void;
  // 以下是透传自 promptBarProps 极其相关的生图上下文和操作
  config: {
    prompt: string;
    aspectRatio: AspectRatio | string;
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
  const activeRatio = config.aspectRatio || '1:1';

  // 统一通过 setConfig 同步比例选择
  const handleRatioChange = (ratio: string) => {
    setConfig((prev: any) => ({
      ...prev,
      aspectRatio: ratio as AspectRatio,
    }));
  };

  // 产品图选择处理器
  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onPickEcommerceProductFiles) {
      onPickEcommerceProductFiles(e.target.files);
    }
  };

  // 参考图/背景选择处理器
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onPickEcommerceExtraReferenceFiles) {
      onPickEcommerceExtraReferenceFiles(e.target.files);
    }
  };

  // 触发生成，同步提示词并调用生成接口，生图后返回主页
  const handleGenerateClick = () => {
    // 强制设置生图模式为电商
    setConfig((prev: any) => ({
      ...prev,
      prompt: prompt,
      mode: 'ecommerce',
    }));
    
    // 稍微延迟调用以便 state 同步
    setTimeout(() => {
      onGenerate(prompt);
      onClose();
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[995] flex flex-col bg-[#141416] text-[var(--text-primary)]">
      {/* 顶部 Header，高度压缩至 48px (h-12)，扁平化无阴影 */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 backdrop-blur-xl">
        <div className="text-sm font-semibold">电商生图</div>
        <button 
          type="button" 
          onClick={onClose} 
          className="p-1 text-[var(--text-secondary)] active:scale-95"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
      </div>

      {/* 主滑动区域，提供极度清爽且适应移动端单手操作的排版 */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-none">
        
        {/* 1. 产品图上传或展示区块 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <ImageIcon size={14} className="text-[var(--accent-color)]" />
            产品图 (核心主体)
          </label>
          {ecommerceProductFiles.length > 0 ? (
            <div className="space-y-2">
              {ecommerceProductFiles.map((file, index) => (
                <FilePreview 
                  key={`prod-${index}`} 
                  file={file} 
                  onRemove={() => onRemoveEcommerceProductFile?.(index)} 
                />
              ))}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] py-8 px-4 text-center cursor-pointer active:bg-white/5 transition-colors">
              <Upload className="text-[var(--accent-color)] mb-2" size={22} />
              <span className="text-xs font-semibold">上传/选择产品图</span>
              <span className="text-[10px] text-[var(--text-tertiary)] mt-1">支持 PNG、JPG 格式主体图</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleProductUpload} 
              />
            </label>
          )}
        </div>

        {/* 2. 场景参考图上传区块 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <ImageIcon size={14} className="text-[var(--accent-pink)]" />
            参考背景/构图 (可选)
          </label>
          {ecommerceExtraReferenceFiles.length > 0 ? (
            <div className="space-y-2">
              {ecommerceExtraReferenceFiles.map((file, index) => (
                <FilePreview 
                  key={`ref-${index}`} 
                  file={file} 
                  onRemove={() => onRemoveEcommerceExtraReferenceFile?.(index)} 
                />
              ))}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] py-8 px-4 text-center cursor-pointer active:bg-white/5 transition-colors">
              <Upload className="text-[var(--accent-pink)] mb-2" size={22} />
              <span className="text-xs font-semibold">上传参考图/背景</span>
              <span className="text-[10px] text-[var(--text-tertiary)] mt-1">控制场景构图、配色与视觉氛围</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleReferenceUpload} 
              />
            </label>
          )}
        </div>

        {/* 3. 提示词输入区块 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">使用场景描述</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：一个高级护肤品瓶子摆放在海滩岩石上，背景是日落时的微风海浪，清晨温暖的逆光，极简质感，3D大片效果"
            className="w-full h-24 rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 text-xs outline-none focus:border-[var(--accent-color)] text-white placeholder-white/30 resize-none transition-colors"
          />
        </div>

        {/* 4. 横向 Pill 比例选择，符合单手快捷点击 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">生成比例</label>
          <div className="flex gap-2">
            {['1:1', '3:4', '9:16'].map((ratio) => {
              const isActive = activeRatio === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => handleRatioChange(ratio)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[var(--accent-coral)] to-[var(--accent-pink)] text-white shadow-md'
                      : 'bg-white/5 border border-white/8 text-[var(--text-secondary)]'
                  }`}
                >
                  {ratio}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. 立即生图大按钮 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGenerateClick}
            className="w-full py-4 rounded-[22px] bg-gradient-to-r from-[var(--accent-coral)] to-[var(--accent-pink)] text-white font-bold text-sm shadow-lg shadow-pink-500/10 active:scale-[0.985] transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={16} fill="currentColor" />
            立即生图
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileEcommercePanel;
