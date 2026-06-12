// apps/web/src/components/layout/LayerPortal.tsx
// 中文注释：浮层组件 Portal 投递器，统一解决 Z-Index 遮挡与边界溢出

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { KK_LAYER } from '@kk/ui';

interface LayerPortalProps {
  children: React.ReactNode;
  zIndex?: number;
}

export const LayerPortal: React.FC<LayerPortalProps> = ({
  children,
  zIndex = KK_LAYER.dropdown
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const portalDiv = document.createElement('div');
    portalDiv.className = 'kk-layer-portal-container';
    portalDiv.style.position = 'absolute';
    portalDiv.style.top = '0';
    portalDiv.style.left = '0';
    portalDiv.style.width = '100%';
    portalDiv.style.zIndex = String(zIndex);
    portalDiv.style.pointerEvents = 'none'; // 确保穿透，只有子节点响应事件

    document.body.appendChild(portalDiv);
    setContainer(portalDiv);

    return () => {
      document.body.removeChild(portalDiv);
    };
  }, [zIndex]);

  if (!container) return null;

  // 通过包裹一层 pointer-events-auto 让子节点能接收交互
  return ReactDOM.createPortal(
    <div style={{ pointerEvents: 'auto' }}>
      {children}
    </div>,
    container
  );
};
