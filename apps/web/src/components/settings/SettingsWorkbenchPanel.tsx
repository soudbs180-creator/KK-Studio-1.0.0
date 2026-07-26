import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';

import type { Supplier } from '../../services/billing/supplierService';
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';
import {
  getCurrentSettingsViewId,
  resolveCanonicalSettingsViewId,
  buildSettingsPath,
  type SettingsViewId,
} from './settingsRegistry';
import { SettingsRouterShell } from './SettingsWorkbenchShell';
import '../../styles/settings.css';
import '../../styles/settings-console.css';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: SettingsViewId;
  initialSupplier?: Supplier | null;
  presentation?: 'overlay' | 'page';
  initialPathname?: string;
  isChatOpen?: boolean;
  chatSidebarWidth?: number;
}

const SettingsPageHistorySync: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const syncedPathRef = useRef('');
  const initializedRef = useRef(false);
  const currentRouterPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    syncedPathRef.current = currentRouterPath;
  }, [currentRouterPath]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const nextWindowPath = currentRouterPath;
    const currentWindowPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    syncedPathRef.current = nextWindowPath;

    if (!initializedRef.current) {
      initializedRef.current = true;

      if (currentWindowPath !== nextWindowPath) {
        window.history.replaceState(window.history.state, '', nextWindowPath);
        window.dispatchEvent(new CustomEvent('kk-app-locationchange', { detail: { pathname: window.location.pathname } }));
      }
      return;
    }

    if (currentWindowPath !== nextWindowPath) {
      window.history.pushState(window.history.state, '', nextWindowPath);
      window.dispatchEvent(new CustomEvent('kk-app-locationchange', { detail: { pathname: window.location.pathname } }));
    }
  }, [currentRouterPath, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const handlePopstate = () => {
      const nextWindowPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (!window.location.pathname.startsWith('/settings')) {
        window.location.assign(nextWindowPath);
        return;
      }

      if (nextWindowPath === syncedPathRef.current) {
        return;
      }

      syncedPathRef.current = nextWindowPath;
      navigate(nextWindowPath, { replace: true });
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [enabled, navigate]);

  return null;
};

// 简体中文：真正的设置页面根容器，唯一合法主开发入口。
export const SettingsWorkbenchPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  initialView = 'dashboard',
  initialSupplier = null,
  presentation = 'overlay',
  initialPathname,
  isChatOpen = false,
  chatSidebarWidth = 420,
}) => {
  // 简体中文：核心判定，桌面端绝不因为右侧 AI 侧边栏挤压而误判为移动端（将断点由 isCompactResponsiveWidth 换为 isPhoneResponsiveWidth）
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false
  ));
  const normalizedInitialPathname = initialPathname && initialPathname.startsWith('/settings') ? initialPathname : null;
  const safeInitialView = normalizedInitialPathname
    ? getCurrentSettingsViewId(normalizedInitialPathname)
    : resolveCanonicalSettingsViewId(initialView);
  const initialEntry = normalizedInitialPathname || (
    safeInitialView === 'capability-sources' && initialSupplier
      ? `/settings/capability-sources`
      : buildSettingsPath(safeInitialView)
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen || presentation !== 'overlay') return;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen, presentation]);

  if (!isOpen) return null;

  const shellContent = (
    <MemoryRouter initialEntries={[initialEntry]} key={initialEntry}>
      <SettingsPageHistorySync enabled={presentation === 'page'} />
      {/* 简体中文：路由与外壳分发 */}
      <SettingsRouterShell
        initialSupplier={initialSupplier}
        onClose={onClose}
        initialView={safeInitialView}
        isMobile={isMobile}
      />
    </MemoryRouter>
  );

  const content = presentation === 'page' ? (
    <div
      className="settings-panel settings-page-root settings-console-host"
      data-testid="settings-page-root"
      style={{
        ['--chat-sidebar-width' as any]: !isMobile && isChatOpen ? `${chatSidebarWidth}px` : '0px',
      }}
    >
      {shellContent}
    </div>
  ) : (
    <div
      className="settings-panel settings-shell-backdrop settings-console-host"
      style={{
        left: '0px',
        top: '0px',
        bottom: '0px',
        right: !isMobile && isChatOpen ? `${chatSidebarWidth}px` : '0px',
        ['--chat-sidebar-width' as any]: !isMobile && isChatOpen ? `${chatSidebarWidth}px` : '0px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {shellContent}
    </div>
  );

  if (presentation === 'page') {
    return content;
  }

  return createPortal(content, document.body);
};

export type { SettingsViewId } from './settingsRegistry';
export default SettingsWorkbenchPanel;
