import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import { type GeneratedImage } from '../../types';

interface PptStackPreviewModalProps {
  images: GeneratedImage[];
  initialIndex?: number;
  onClose: () => void;
}

const PptStackPreviewModal: React.FC<PptStackPreviewModalProps> = ({
  images,
  initialIndex = 0,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const target = document.getElementById(`ppt-stack-page-${initialIndex}`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [initialIndex]);

  return ReactDOM.createPortal(
    <div
      className="kk-image-modal-backdrop kk-ppt-stack-preview fixed inset-0"
      style={{ zIndex: KK_LAYER.fullscreen }}
      onClick={onClose}
    >
      <div
        className="kk-image-modal-panel kk-ppt-stack-shell absolute inset-0 flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kk-ppt-stack-header flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="text-sm font-semibold">PPT 整屏预览</div>
            <div className="kk-ppt-muted text-xs">已拼接显示 {images.length} 页副卡</div>
          </div>
          <button
            onClick={onClose}
            className="kk-image-modal-icon-button inline-flex items-center justify-center rounded-full"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="kk-image-modal-panel mx-auto w-full max-w-[1100px] overflow-hidden rounded-2xl border">
            {images.map((image, index) => (
              <div
                id={`ppt-stack-page-${index}`}
                key={image.id}
                className="kk-ppt-stack-page relative border-b last:border-b-0"
                data-active={index === initialIndex}
              >
                <div className="kk-ppt-page-badge absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-xs font-medium">
                  {image.alias || `第 ${index + 1} 页`}
                </div>
                <img
                  src={image.originalUrl || image.url}
                  alt={image.alias || `PPT page ${index + 1}`}
                  className="block w-full h-auto"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PptStackPreviewModal;
