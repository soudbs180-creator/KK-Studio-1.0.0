import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KK_LAYER } from '@kk/ui';

interface PromptBarTopRowDesktopProps {
  children: React.ReactNode;
}

const PromptBarTopRowDesktop: React.FC<PromptBarTopRowDesktopProps> = ({ children }) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [floatingPosition, setFloatingPosition] = useState<{
    left: number;
    top: number;
    width: number;
    mode: string;
  } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const composer = anchor?.closest<HTMLElement>('#prompt-bar-container');
    if (!composer) return;

    const updatePosition = () => {
      const rect = composer.getBoundingClientRect();
      setFloatingPosition({
        left: rect.left,
        top: Math.max(8, rect.top - 40),
        width: rect.width,
        mode: composer.dataset.composerMode || '',
      });
    };

    updatePosition();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updatePosition);
    resizeObserver?.observe(composer);
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(updatePosition);
    mutationObserver?.observe(composer, {
      attributes: true,
      attributeFilter: ['data-composer-mode'],
    });
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, []);

  const floatingTools = floatingPosition ? (
    <div
      className="kk-composer-floating-tools kk-composer-floating-tools-host flex items-center justify-between gap-1.5"
      data-composer-floating-tools="true"
      data-composer-layout="desktop"
      data-composer-mode={floatingPosition.mode}
      style={{
        position: 'fixed',
        top: floatingPosition.top,
        right: 'auto',
        bottom: 'auto',
        left: floatingPosition.left,
        width: floatingPosition.width,
        // The picker menu overlaps the composer surface; keep the whole
        // portaled control row above canvas and composer stacking contexts.
        zIndex: KK_LAYER.dropdown,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  ) : null;

  return (
    <>
      <span ref={anchorRef} className="kk-composer-floating-tools-anchor" aria-hidden="true" />
      {typeof document !== 'undefined' && floatingTools
        ? createPortal(floatingTools, document.body)
        : null}
    </>
  );
};

export default PromptBarTopRowDesktop;
