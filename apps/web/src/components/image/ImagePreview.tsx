import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { KK_LAYER } from '@kk/ui';

interface ImagePreviewProps {
  imageUrl: string;
  originRect: DOMRect;
  onClose: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ imageUrl, originRect, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (!active) return;
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      }
    };
    image.src = imageUrl;
    return () => {
      active = false;
    };
  }, [imageUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const handleDragStart = () => {
      handleClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('kk-drag-start', handleDragStart as EventListener);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('kk-drag-start', handleDragStart as EventListener);
    };
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 350);
  };

  const scale = 3;
  const maxTargetWidth = originRect.width * scale;
  const maxTargetHeight = originRect.height * scale;
  const aspectRatio = imageSize && imageSize.width > 0 && imageSize.height > 0
    ? imageSize.width / imageSize.height
    : originRect.width / Math.max(originRect.height, 1);

  let targetWidth = maxTargetWidth;
  let targetHeight = targetWidth / aspectRatio;

  if (targetHeight > maxTargetHeight) {
    targetHeight = maxTargetHeight;
    targetWidth = targetHeight * aspectRatio;
  }

  const targetLeft = originRect.left + originRect.width / 2 - targetWidth / 2;
  const targetTop = originRect.top - targetHeight + originRect.height;

  const currentLeft = isClosing ? originRect.left : (isAnimating ? originRect.left : targetLeft);
  const currentTop = isClosing ? originRect.top : (isAnimating ? originRect.top : targetTop);
  const currentWidth = isClosing ? originRect.width : (isAnimating ? originRect.width : targetWidth);
  const currentHeight = isClosing ? originRect.height : (isAnimating ? originRect.height : targetHeight);
  const currentOpacity = isClosing ? 0 : 1;

  return ReactDOM.createPortal(
    <div
      className="kk-image-preview-root fixed inset-0"
      style={{ zIndex: KK_LAYER.fullscreen }}
    >
      <div className="kk-image-preview-backdrop absolute inset-0" onClick={handleClose} />

      <div
        className="fixed"
        style={{
          left: currentLeft,
          top: currentTop,
          width: currentWidth,
          height: currentHeight,
          opacity: currentOpacity,
          transition: isClosing
            ? 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'all 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: 'bottom center',
          pointerEvents: 'none',
        }}
      >
        <img
          src={imageUrl}
          alt="放大查看"
          className="kk-image-preview-frame w-full h-full object-contain rounded-xl"
          style={{
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
          onClick={handleClose}
        />
      </div>
    </div>,
    document.body
  );
};

export default ImagePreview;
