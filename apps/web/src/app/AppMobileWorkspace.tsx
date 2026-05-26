import React from 'react';

import { MobileWorkspaceSurface, MobileEcommercePanel } from '../components/mobile';
import { selectMobileFeedResults } from '../components/mobile/mobileFeedSelectors';
import type { UserProfileView } from '../components/modals/UserProfileModal';
import type {
  Canvas,
  EcommerceFrameworkRuntimeState,
  MobileResultEntry,
  MobileSurfaceScreen,
  PartialRedrawRequest,
  ResponsiveSurface,
} from '../types';
import AppPromptComposer, { type AppPromptBarProps } from './AppPromptComposer';

interface AppMobileWorkspaceProps {
  isMobile: boolean;
  surface: ResponsiveSurface;
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
  setWorkspaceSurface: (surface: 'workspace' | 'library') => void;
  setIsChatOpen: (isOpen: boolean) => void;
  openProfileSurface: (view: UserProfileView) => void;
  onShowRecharge: () => void;
  activeEntryId: string | null;
  activeSourceImage: string | null;
  onEntryOpen: (entryId: string) => void;
  onPreviewImage: (imageId: string) => void;
  onUseResultAsSource: (imageId: string) => void;
  onPartialRedraw: (entry: MobileResultEntry, request: PartialRedrawRequest) => void;
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
  const resultEntries = React.useMemo<MobileResultEntry[]>(
    () => selectMobileFeedResults(activeCanvas?.promptNodes || [], activeCanvas?.imageNodes || [], frameworkRuntime),
    [activeCanvas?.imageNodes, activeCanvas?.promptNodes, frameworkRuntime],
  );

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

  return (
    <MobileWorkspaceSurface
      activeScreen={mobileScreen}
      surface={surface}
      onScreenChange={setMobileScreen}
      onOpenSettings={onOpenSettings}
      title="KK Studio"
      userName={userName}
      userAvatarUrl={userAvatarUrl}
      balance={balance}
      balanceLoading={billingLoading}
      projectName={activeCanvas?.name || '项目'}
      projectCount={projectCount}
      onOpenProjects={() => setMobileScreen('more-sheet')}
      onOpenSearch={() => {
        focusWorkspace();
        setIsSearchOpen(true);
        setMobileScreen('home');
      }}
      onOpenHistory={() => {
        setWorkspaceSurface('library');
        setMobileScreen('home');
      }}
      onOpenChat={() => {
        focusWorkspace();
        setIsChatOpen(true);
        setMobileScreen('home');
      }}
      onOpenProfile={() => openProfileSurface('main')}
      onBillingClick={billingUiEnabled ? () => openProfileSurface('billing') : undefined}
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
      composer={(
        <AppPromptComposer
          variant="mobile"
          promptBarProps={promptBarProps}
        />
      )}
      overlays={overlays}
    />
  );
};

export default AppMobileWorkspace;
