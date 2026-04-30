import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Globe,
  HardDrive,
  Loader2,
  Shield,
  Zap,
} from 'lucide-react';

import { useCanvas } from '../../context/CanvasContext';
import {
  getLocalFolderHandle,
  isFileSystemAccessSupported,
  setStorageMode,
  type StorageMode,
} from '../../services/storage/storagePreference';
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';

interface StorageSelectionModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const FeatureRow: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({
  icon,
  title,
  desc,
}) => (
  <div className="flex items-start gap-2.5">
    <div className="mt-0.5 text-[var(--storage-selection-text-secondary)]">{icon}</div>
    <div>
      <div className="text-xs font-medium" style={{ color: 'var(--storage-selection-text-primary)' }}>
        {title}
      </div>
      <div className="text-[11px] leading-5" style={{ color: 'var(--storage-selection-text-muted)' }}>
        {desc}
      </div>
    </div>
  </div>
);

const StorageSelectionModal: React.FC<StorageSelectionModalProps> = ({ isOpen, onComplete }) => {
  const { connectLocalFolder, disconnectLocalFolder, isConnectedToLocal } = useCanvas();

  const [selectedMode, setSelectedMode] = useState<StorageMode>('browser');
  const [selectingLocal, setSelectingLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false,
  );

  const supportsLocal = isFileSystemAccessSupported();

  useEffect(() => {
    const onResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!isOpen) return null;

  const chooseLocal = () => {
    setError('');
    setSelectedMode('local');

    if (!supportsLocal) {
      setError('当前浏览器不支持本地文件夹授权，请继续使用浏览器缓存。');
    }
  };

  const chooseBrowser = async () => {
    setError('');
    setSelectedMode('browser');

    try {
      await disconnectLocalFolder();
    } catch (disconnectError) {
      console.error('[StorageSelectionModal] Failed to disconnect local folder:', disconnectError);
      setError('切换到浏览器存储失败，请稍后重试。');
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');

    try {
      if (selectedMode === 'local' && !isConnectedToLocal) {
        setSelectingLocal(true);
        await connectLocalFolder();
        const handle = await getLocalFolderHandle();

        if (!handle) {
          setError('本地文件夹尚未连接，请先完成文件夹授权。');
          return;
        }
      }

      const ok = await setStorageMode(selectedMode);
      if (!ok) {
        setError('保存存储设置失败，请稍后重试。');
        return;
      }

      onComplete();
    } finally {
      setSelectingLocal(false);
      setSaving(false);
    }
  };

  const optionBaseStyle = {
    borderColor: 'var(--storage-selection-border)',
    background: 'var(--storage-selection-option-bg)',
  } as const;

  const optionSelectedStyle = {
    borderColor: 'var(--storage-selection-border-strong)',
    background: 'var(--storage-selection-option-selected-bg)',
  } as const;

  return (
    <div
      className={`storage-selection-modal fixed inset-0 z-[3000] flex justify-center ${isMobile ? 'mobile-overlay-safe items-end px-2' : 'items-center px-4 py-4'}`}
      style={{ background: 'var(--storage-selection-overlay-bg)', backdropFilter: 'blur(14px)' }}
    >
      <div
        className={`w-full border ${isMobile ? 'ios-mobile-sheet mobile-sheet-viewport flex min-h-0 flex-col rounded-t-[26px] rounded-b-none' : 'max-w-[640px] rounded-3xl p-6'}`}
        style={{
          background: 'var(--storage-selection-card-bg)',
          borderColor: 'var(--storage-selection-border)',
          boxShadow: 'var(--storage-selection-shadow)',
        }}
      >
        <div className={`${isMobile ? 'mobile-sheet-header-safe px-4 pb-4 pt-4 text-center' : 'mb-5 text-center'}`}>
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border"
            style={{
              borderColor: 'var(--storage-selection-border)',
              background: 'var(--storage-selection-icon-bg)',
              color: 'var(--storage-selection-text-primary)',
              boxShadow: 'var(--storage-selection-icon-shadow)',
            }}
          >
            <HardDrive size={24} />
          </div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--storage-selection-text-primary)' }}>
            选择你的存储方案
          </h2>
          <p className="mx-auto mt-2 max-w-[500px] text-xs leading-6" style={{ color: 'var(--storage-selection-text-muted)' }}>
            默认使用浏览器缓存就可以开始使用；如果你更在意原图安全，可以启用本地存储，为原图增加一层额外备份。
          </p>
        </div>

        <div className={`${isMobile ? 'mobile-sheet-scroll flex-1 px-4' : ''}`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => void chooseBrowser()}
              className="rounded-2xl border p-4 text-left transition"
              style={selectedMode === 'browser' ? optionSelectedStyle : optionBaseStyle}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="rounded-xl border p-2"
                    style={{
                      borderColor: 'var(--storage-selection-border)',
                      background: 'var(--storage-selection-icon-bg)',
                      color: 'var(--storage-selection-text-secondary)',
                    }}
                  >
                    <Globe size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold" style={{ color: 'var(--storage-selection-text-primary)' }}>
                        浏览器缓存
                      </div>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                        style={{
                          borderColor: 'var(--storage-selection-border)',
                          background: 'var(--storage-selection-icon-bg)',
                          color: 'var(--storage-selection-text-secondary)',
                        }}
                      >
                        默认
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-5" style={{ color: 'var(--storage-selection-text-muted)' }}>
                      零配置，直接可用。图片保存在当前浏览器本地数据库，适合快速开始和日常使用。
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--storage-selection-border)' }}>
                <FeatureRow icon={<Zap size={14} />} title="适合人群" desc="想先快速用起来，不想额外选择文件夹。" />
                <FeatureRow icon={<Shield size={14} />} title="风险提示" desc="如果清理浏览器缓存或更换浏览器，原图可能丢失。" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => void chooseLocal()}
              disabled={!supportsLocal}
              className="rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
              style={selectedMode === 'local' ? optionSelectedStyle : optionBaseStyle}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="rounded-xl border p-2"
                    style={{
                      borderColor: 'var(--storage-selection-border)',
                      background: 'var(--storage-selection-icon-bg)',
                      color: 'var(--storage-selection-text-secondary)',
                    }}
                  >
                    <FolderOpen size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold" style={{ color: 'var(--storage-selection-text-primary)' }}>
                        本地存储
                      </div>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                        style={{
                          borderColor: 'var(--storage-selection-border)',
                          background: 'var(--storage-selection-icon-bg)',
                          color: 'var(--storage-selection-text-secondary)',
                        }}
                      >
                        双层保护
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-5" style={{ color: 'var(--storage-selection-text-muted)' }}>
                      在浏览器缓存之外，再把原图额外备份到你选择的本地文件夹，更适合长期保存和防止原图丢失。
                    </div>
                  </div>
                </div>

                {isConnectedToLocal ? (
                  <span
                    className="inline-flex max-w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px]"
                    style={{
                      borderColor: 'var(--settings-state-success-border, rgba(22, 163, 74, 0.18))',
                      background: 'var(--settings-state-success-bg, rgba(22, 163, 74, 0.1))',
                      color: 'var(--settings-state-success-text, #047857)',
                    }}
                  >
                    <CheckCircle2 size={12} /> 已连接
                  </span>
                ) : null}
              </div>

              <div className="mt-4 space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--storage-selection-border)' }}>
                <FeatureRow icon={<Shield size={14} />} title="适合人群" desc="有长期保存需求，或担心浏览器缓存被清理。" />
                <FeatureRow icon={<FolderOpen size={14} />} title="恢复能力" desc="即使浏览器缓存丢失，也可以优先从本地备份恢复原图。" />
              </div>
            </button>
          </div>

          <div
            className="mt-4 rounded-2xl border p-4"
            style={{
              borderColor: 'var(--storage-selection-border)',
              background: 'var(--storage-selection-option-bg)',
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--storage-selection-text-primary)' }}>
              当前推荐
            </div>
            <div className="mt-1 text-xs leading-6" style={{ color: 'var(--storage-selection-text-muted)' }}>
              如果你只是先体验，直接用“浏览器缓存”就行；如果你的重点是保住原图，建议开启“本地存储（双层保护）”，这样即使浏览器缓存丢失，也还能从本地恢复。
            </div>
          </div>

          {!supportsLocal ? (
            <div
              className="mt-3 rounded-xl border p-3 text-xs"
              style={{
                borderColor: 'var(--settings-state-warning-border, rgba(245, 158, 11, 0.2))',
                background: 'var(--settings-state-warning-bg, rgba(245, 158, 11, 0.12))',
                color: 'var(--settings-state-warning-text, #b45309)',
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5" />
                <p>当前浏览器不支持本地文件夹授权。若要使用本地存储，请改用最新版 Chrome 或 Edge。</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              className="mt-3 rounded-xl border px-3 py-2 text-xs"
              style={{
                borderColor: 'var(--settings-state-danger-border, rgba(239, 68, 68, 0.2))',
                background: 'var(--settings-state-danger-bg, rgba(239, 68, 68, 0.1))',
                color: 'var(--settings-state-danger-text, #b91c1c)',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className={`flex items-center justify-end gap-2 ${isMobile ? 'mobile-sheet-footer-safe px-4 pb-4 pt-3' : 'mt-5'}`}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectingLocal || saving}
            className="inline-flex h-11 max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border px-5 text-sm font-medium disabled:opacity-60"
            style={{
              borderColor: 'transparent',
              background: 'var(--storage-selection-primary-bg)',
              color: 'var(--storage-selection-primary-text)',
              boxShadow: 'var(--storage-selection-primary-shadow)',
            }}
          >
            {(selectingLocal || saving) ? <Loader2 size={15} className="shrink-0 animate-spin" /> : null}
            {selectedMode === 'local' && !isConnectedToLocal ? '选择文件夹并保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageSelectionModal;
