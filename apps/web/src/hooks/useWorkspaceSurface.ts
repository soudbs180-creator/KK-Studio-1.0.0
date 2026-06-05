import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import type { Supplier } from '../services/billing/supplierService';
import type { AppSurface, MobilePrimaryTab, WorkspacePanel } from '../types';
import type { UserProfileView } from '../components/modals/UserProfileModal';
import { isCompactResponsiveSurface, resolveResponsiveSurface } from '../utils/responsiveSurface';

export type SettingsSurfaceView =
  | 'dashboard'
  | 'api-management'
  | 'consumption-records'
  | 'storage-settings'
  | 'system-logs'
  | 'user-profile';

interface UseWorkspaceSurfaceOptions {
  showSettingsPanel: boolean;
  showProfileModal: boolean;
  handleShowMobileNav: () => void;
  openSettingsPanel: (view?: SettingsSurfaceView, supplier?: Supplier | null) => void;
  setProfileInitialView: Dispatch<SetStateAction<UserProfileView>>;
  setShowProfileModal: Dispatch<SetStateAction<boolean>>;
  setShowUserMenu: Dispatch<SetStateAction<boolean>>;
}

export function useWorkspaceSurface({
  showSettingsPanel,
  showProfileModal,
  handleShowMobileNav,
  openSettingsPanel,
  setProfileInitialView,
  setShowProfileModal,
  setShowUserMenu,
}: UseWorkspaceSurfaceOptions) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatSidebarWidth, setChatSidebarWidth] = useState(420);
  const [responsiveSurface, setResponsiveSurface] = useState(() => resolveResponsiveSurface(window.innerWidth));
  const isMobile = isCompactResponsiveSurface(responsiveSurface);
  const [workspaceSurface, setWorkspaceSurface] = useState<Extract<AppSurface, 'workspace' | 'library' | 'favorites'>>('workspace');

  const activeAppSurface: AppSurface = showSettingsPanel
    ? 'settings'
    : showProfileModal
      ? 'profile'
      : isChatOpen
        ? 'chat'
        : workspaceSurface;

  const activeWorkspacePanel: WorkspacePanel = isChatOpen
    ? 'chat'
    : workspaceSurface === 'library'
      ? 'history'
      : workspaceSurface === 'favorites'
        ? 'favorites'
        : null;

  const currentMobileTab: MobilePrimaryTab = activeAppSurface === 'library'
    ? 'library'
    : activeAppSurface === 'chat'
      ? 'chat'
      : activeAppSurface === 'profile'
        ? 'me'
        : 'create';

  useEffect(() => {
    const handleResize = () => {
      const nextSurface = resolveResponsiveSurface(window.innerWidth);
      setResponsiveSurface(nextSurface);
      if (!isCompactResponsiveSurface(nextSurface) && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  const focusWorkspace = useCallback(() => {
    setWorkspaceSurface('workspace');
  }, []);

  const openLibrarySurface = useCallback(() => {
    setWorkspaceSurface('library');
    setShowUserMenu(false);
    setIsChatOpen(false);
  }, [setShowUserMenu]);

  const openFavoritesSurface = useCallback(() => {
    setWorkspaceSurface('favorites');
    setShowUserMenu(false);
    setIsChatOpen(false);
  }, [setShowUserMenu]);

  const toggleChatPanel = useCallback(() => {
    setWorkspaceSurface('workspace');
    setIsChatOpen((prev) => !prev);
  }, []);

  const openProfileSurface = useCallback((view: UserProfileView = 'main') => {
    setWorkspaceSurface('workspace');
    setProfileInitialView(view);
    setShowProfileModal(true);
    setShowUserMenu(false);
  }, [setProfileInitialView, setShowProfileModal, setShowUserMenu]);

  const openSettingsSurface = useCallback((
    view: SettingsSurfaceView = 'dashboard',
    supplier: Supplier | null = null,
  ) => {
    setWorkspaceSurface('workspace');
    openSettingsPanel(view, supplier);
    setShowUserMenu(false);
  }, [openSettingsPanel, setShowUserMenu]);

  const handleSelectMobileTab = useCallback((tab: MobilePrimaryTab) => {
    handleShowMobileNav();

    if (tab === 'create') {
      focusWorkspace();
      setIsChatOpen(false);
      return;
    }

    if (tab === 'library') {
      openLibrarySurface();
      return;
    }

    if (tab === 'chat') {
      focusWorkspace();
      setIsChatOpen(true);
      return;
    }

    setIsChatOpen(false);
    openProfileSurface('main');
  }, [focusWorkspace, handleShowMobileNav, openLibrarySurface, openProfileSurface]);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isChatOpen,
    setIsChatOpen,
    chatSidebarWidth,
    setChatSidebarWidth,
    isMobile,
    workspaceSurface,
    setWorkspaceSurface,
    activeAppSurface,
    activeWorkspacePanel,
    currentMobileTab,
    focusWorkspace,
    openLibrarySurface,
    openFavoritesSurface,
    toggleChatPanel,
    openProfileSurface,
    openSettingsSurface,
    handleSelectMobileTab,
  };
}
