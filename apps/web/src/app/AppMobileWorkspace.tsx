import React from 'react';

import {
  MobileEcommercePanel,
  MobileTabBar,
  MobileWorkspaceSurface,
} from '../components/mobile';
import MobileCanvasV3Surface from '../components/mobile/MobileCanvasV3Surface';
import { selectMobileFeedResults } from '../components/mobile/mobileFeedSelectors';
import type { UserProfileView } from '../components/modals/UserProfileModal';
import type {
  Canvas,
  EcommerceFrameworkRuntimeState,
  MobileResultEntry,
  MobilePrimaryTab,
  MobileSurfaceScreen,
  RedrawRequest,
  ResponsiveSurface,
} from '../types';
import AppPromptComposer, { type AppPromptBarProps } from './AppPromptComposer';

interface AppMobileWorkspaceProps {
  isMobile: boolean;
  surface: ResponsiveSurface;
  workspaceSurface: 'workspace' | 'library' | 'favorites';
  mobileScreen: MobileSurfaceScreen;
  setMobileScreen: (screen: MobileSurfaceScreen) => void;
  onOpenSettings: () => void;
  userName: string;
  userAvatarUrl?: string;
  billingUiEnabled: boolean;
  balance: number;
  billingLoading: boolean;
  activeCanvas: Canvas | null | undefined;
  frameworkRuntime: Record<string, EcommerceFrameworkRuntimeState>;
  projectCount: number;
  focusWorkspace: () => void;
  setIsSearchOpen: (isOpen: boolean) => void;
  setWorkspaceSurface: (surface: 'workspace' | 'library' | 'favorites') => void;
  setIsChatOpen: (isOpen: boolean) => void;
  openProfileSurface: (view: UserProfileView) => void;
  onShowRecharge: () => void;
  activeEntryId: string | null;
  activeSourceImage: string | null;
  onEntryOpen: (entryId: string) => void;
  onPreviewImage: (imageId: string) => void;
  onUseResultAsSource: (imageId: string) => void;
  onPartialRedraw: (entry: MobileResultEntry, request: RedrawRequest) => void;
  onDownloadEntry: (entry: MobileResultEntry) => void;
  onDeleteImage: (imageId: string) => void;
  onEditEcommerceTask: (entry: MobileResultEntry) => void;
  onConfirmEcommerceDesktop: (entry: MobileResultEntry) => void;
  onGenerateEcommerceMobile: (entry: MobileResultEntry) => void;
  onToggleEcommerceSelected: (entry: MobileResultEntry, selected: boolean) => void;
  promptBarProps: AppPromptBarProps;
  overlays?: React.ReactNode;
}

const AppMobileWorkspace: React.FC<AppMobileWorkspaceProps> = ({
  isMobile,
  surface,
  workspaceSurface,
  mobileScreen,
  setMobileScreen,
  onOpenSettings,
  userName,
  userAvatarUrl,
  billingUiEnabled,
  balance,
  billingLoading,
  activeCanvas,
  frameworkRuntime,
  projectCount,
  focusWorkspace,
  setIsSearchOpen,
  setWorkspaceSurface,
  setIsChatOpen,
  openProfileSurface,
  onShowRecharge,
  activeEntryId,
  activeSourceImage,
  onEntryOpen,
  onPreviewImage,
  onUseResultAsSource,
  onPartialRedraw,
  onDownloadEntry,
  onDeleteImage,
  onEditEcommerceTask,
  onConfirmEcommerceDesktop,
  onGenerateEcommerceMobile,
  onToggleEcommerceSelected,
  promptBarProps,
  overlays,
}) => {
  const [primaryTab, setPrimaryTab] = React.useState<MobilePrimaryTab>('create');
  const resultEntries = React.useMemo<MobileResultEntry[]>(
    () => selectMobileFeedResults(activeCanvas?.promptNodes || [], activeCanvas?.imageNodes || [], frameworkRuntime),
    [activeCanvas?.imageNodes, activeCanvas?.promptNodes, frameworkRuntime],
  );

  React.useEffect(() => {
    if (workspaceSurface === 'library' || workspaceSurface === 'favorites') {
      setPrimaryTab('assets');
    }
  }, [workspaceSurface]);

  const handleSelectPrimaryTab = React.useCallback((tab: MobilePrimaryTab) => {
    const canonicalTab = tab === 'library'
      ? 'assets'
      : tab === 'chat'
        ? 'copilot'
        : tab === 'me'
          ? 'create'
          : tab;
    setPrimaryTab(canonicalTab);
    setMobileScreen('home');
    if (canonicalTab === 'assets') {
      setIsChatOpen(false);
      setWorkspaceSurface('library');
      return;
    }
    focusWorkspace();
    setIsChatOpen(canonicalTab === 'copilot');
  }, [focusWorkspace, setIsChatOpen, setMobileScreen, setWorkspaceSurface]);

  if (!isMobile) {
    return null;
  }

  // 🚀 如果当前切换到电商生图独立页面，渲染电商生图面板
  if (mobileScreen === 'ecommerce') {
    return (
      <MobileEcommercePanel
        onClose={() => setMobileScreen('home')}
        config={promptBarProps.config}
        setConfig={promptBarProps.setConfig}
        onGenerate={promptBarProps.onGenerate}
        ecommerceProductFiles={promptBarProps.ecommerceProductFiles}
        ecommerceExtraReferenceFiles={promptBarProps.ecommerceExtraReferenceFiles}
        onPickEcommerceProductFiles={promptBarProps.onPickEcommerceProductFiles}
        onPickEcommerceExtraReferenceFiles={promptBarProps.onPickEcommerceExtraReferenceFiles}
        onRemoveEcommerceProductFile={promptBarProps.onRemoveEcommerceProductFile}
        onRemoveEcommerceExtraReferenceFile={promptBarProps.onRemoveEcommerceExtraReferenceFile}
      />
    );
  }

  const mobileNavigation = (
    <MobileTabBar
      currentMode={promptBarProps.config.mode}
      currentTab={primaryTab}
      onSelectTab={handleSelectPrimaryTab}
    />
  );

  if (primaryTab === 'canvas') {
    return (
      <>
        <MobileCanvasV3Surface
          activeCanvas={activeCanvas}
          composer={<AppPromptComposer variant="mobile" promptBarProps={promptBarProps} />}
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          onOpenProfile={() => openProfileSurface('main')}
        />
        {mobileNavigation}
      </>
    );
  }

  return (
    <>
      <MobileWorkspaceSurface
        activeScreen={mobileScreen}
        surface={surface}
        workspaceSurface={workspaceSurface}
        onCloseHistory={() => {
          setWorkspaceSurface('workspace');
          setPrimaryTab('create');
        }}
        onScreenChange={setMobileScreen}
        onOpenSettings={onOpenSettings}
        title="KK Studio"
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        balance={balance}
        balanceLoading={billingLoading}
        projectName={activeCanvas?.name || '项目'}
        projectCount={projectCount}
        isLoading={promptBarProps.isGenerating}
        onOpenProjects={() => setMobileScreen('more-sheet')}
        onOpenSearch={() => {
          focusWorkspace();
          setIsSearchOpen(true);
          setMobileScreen('home');
        }}
        onOpenHistory={() => {
          setPrimaryTab('assets');
          setWorkspaceSurface('library');
          setMobileScreen('home');
        }}
        onOpenFavorites={() => {
          setPrimaryTab('assets');
          setWorkspaceSurface('favorites');
          setMobileScreen('home');
        }}
        onOpenChat={() => {
          setPrimaryTab('copilot');
          focusWorkspace();
          setIsChatOpen(true);
          setMobileScreen('home');
        }}
        onOpenProfile={() => openProfileSurface('main')}
        onBillingClick={billingUiEnabled ? () => openProfileSurface('main') : undefined}
        onRechargeClick={billingUiEnabled ? onShowRecharge : undefined}
        resultEntries={resultEntries}
        activeEntryId={activeEntryId}
        activeSourceImage={activeSourceImage}
        onEntryOpen={onEntryOpen}
        onPreviewImage={onPreviewImage}
        onUseResultAsSource={onUseResultAsSource}
        onPartialRedraw={onPartialRedraw}
        onDownloadEntry={onDownloadEntry}
        onDeleteImage={onDeleteImage}
        onEditEcommerceTask={onEditEcommerceTask}
        onConfirmEcommerceDesktop={onConfirmEcommerceDesktop}
        onGenerateEcommerceMobile={onGenerateEcommerceMobile}
        onToggleEcommerceSelected={onToggleEcommerceSelected}
        composer={<AppPromptComposer variant="mobile" promptBarProps={promptBarProps} />}
        overlays={overlays}
      />
      {mobileNavigation}
    </>
  );
};

export default AppMobileWorkspace;
