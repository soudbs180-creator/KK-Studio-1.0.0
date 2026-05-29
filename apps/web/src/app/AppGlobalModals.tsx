import React, { Suspense } from 'react';
import { lazyWithRetry, lazyNamedWithRetry } from '../utils/lazyWithRetry';
import { GlobalLightbox } from '../components/image/GlobalLightbox';
import PptStackPreviewModal from '../components/image/PptStackPreviewModal';
import type { SettingsPanelProps } from '../components/settings/SettingsPanel';
import { GlobalModals } from '../components/workspace';
import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';
import type {
  Canvas,
  CanvasGroup,
  GeneratedImage,
  RedrawRequest,
  PptEditablePage,
  PromptNode,
} from '../types';

const UserProfileModal = lazyWithRetry(() => import('../components/modals/UserProfileModal'));
const SettingsPanel = lazyWithRetry(() => import('../components/settings/SettingsPanel'));
const SearchPalette = lazyWithRetry(() => import('../components/layout/SearchPalette'));
const TagInputModal = lazyWithRetry(() => import('../components/modals/TagInputModal'));
const TutorialOverlay = lazyWithRetry(() => import('../components/common/TutorialOverlay'));
const StorageSelectionModal = lazyWithRetry(() => import('../components/modals/StorageSelectionModal'));
const MigrateModal = lazyNamedWithRetry(() => import('../components/modals/MigrateModal'), 'MigrateModal');
const PptDeckEditorModal = lazyWithRetry(() => import('../components/image/PptDeckEditorModal'));
const RechargeModal = lazyWithRetry(() => import('../components/modals/RechargeModal'));

type PptDeckEditorState = { nodeId: string; initialIndex: number } | null;
type PptStackPreviewState = { images: GeneratedImage[]; initialIndex: number } | null;
type PptDeckEditorBundle = { promptNode: PromptNode; images: GeneratedImage[] };

export interface AppGlobalModalsProps {
  projectManager?: React.ReactNode;
  tagModal: {
    isOpen: boolean;
    onClose: () => void;
    initialTags: string[];
    onSave: (tags: string[]) => void;
    maxTags: number;
    maxChars: number;
    allTags: string[];
    inheritedTags: string[];
    isSubCard: boolean;
  };
  profileModal: {
    isOpen: boolean;
    onClose: () => void;
    user: RuntimeAuthUser | null;
    onSignOut: () => void | Promise<void>;
    initialView: UserProfileView;
    isMobile: boolean;
  };
  settingsPanel: {
    isOpen: boolean;
    sessionKey: number;
    initialView: SettingsPanelProps['initialView'];
    initialSupplier: SettingsPanelProps['initialSupplier'];
    onClose: () => void;
  };
  storageModal: {
    isOpen: boolean;
    onComplete: () => void;
  };
  lightbox: {
    images: GeneratedImage[] | null;
    initialIndex: number;
    onClose: () => void;
    onEditPptDeck: (image: GeneratedImage) => void;
    onEditText: (image: GeneratedImage) => void;
    onDownloadPptComposite: (imageId: string) => void;
    onPartialRedraw: (image: GeneratedImage, request: RedrawRequest) => void;
    onDeleteImage: (imageId: string) => void;
    onUseAsSource?: (image: GeneratedImage) => void; // 继续创作回调，桌面灯箱使用当前图片作为参考图。
  };
  pptStackPreview: {
    state: PptStackPreviewState;
    onClose: () => void;
  };
  pptDeckEditor: {
    state: PptDeckEditorState;
    resolveBundle: (nodeId: string) => PptDeckEditorBundle | null;
    onClose: () => void;
    onSave: (promptNodeId: string, pages: PptEditablePage[]) => void;
  };
  searchPalette: {
    isOpen: boolean;
    onClose: () => void;
    promptNodes: PromptNode[];
    groups: CanvasGroup[];
    onNavigate: (x: number, y: number, id?: string) => void;
    onMultiSelectConfirm?: (ids: string[]) => void;
  };
  tutorial: {
    isVisible: boolean;
    onComplete: () => void;
  };
  migrateModal: {
    isOpen: boolean;
    onClose: () => void;
    canvases: Canvas[];
    currentCanvasId: string;
    selectedCount: number;
    onMigrate: (targetCanvasId: string) => void;
  };
  rechargeModal: {
    enabled: boolean;
    isOpen: boolean;
  };
}

const AppGlobalModals: React.FC<AppGlobalModalsProps> = ({
  projectManager,
  tagModal,
  profileModal,
  settingsPanel,
  storageModal,
  lightbox,
  pptStackPreview,
  pptDeckEditor,
  searchPalette,
  tutorial,
  migrateModal,
  rechargeModal,
}) => (
  <GlobalModals>
    {tagModal.isOpen && (
      <Suspense fallback={null}>
        <TagInputModal
          isOpen={tagModal.isOpen}
          onClose={tagModal.onClose}
          initialTags={tagModal.initialTags}
          onSave={tagModal.onSave}
          maxTags={tagModal.maxTags}
          maxChars={tagModal.maxChars}
          allTags={tagModal.allTags}
          inheritedTags={tagModal.inheritedTags}
          isSubCard={tagModal.isSubCard}
        />
      </Suspense>
    )}

    {profileModal.isOpen && (
      <Suspense fallback={null}>
        <UserProfileModal
          isOpen={profileModal.isOpen}
          onClose={profileModal.onClose}
          user={profileModal.user}
          onSignOut={profileModal.onSignOut}
          initialView={profileModal.initialView}
          isMobile={profileModal.isMobile}
        />
      </Suspense>
    )}

    {settingsPanel.isOpen && (
      <Suspense fallback={null}>
        <SettingsPanel
          key={`${settingsPanel.sessionKey}-${settingsPanel.initialView}-${settingsPanel.initialSupplier?.id || 'none'}`}
          isOpen={settingsPanel.isOpen}
          onClose={settingsPanel.onClose}
          initialView={settingsPanel.initialView}
          initialSupplier={settingsPanel.initialSupplier}
        />
      </Suspense>
    )}

    {storageModal.isOpen && (
      <Suspense fallback={null}>
        <StorageSelectionModal
          isOpen={storageModal.isOpen}
          onComplete={storageModal.onComplete}
        />
      </Suspense>
    )}

    {projectManager}

    {lightbox.images && (
      <Suspense fallback={null}>
        <GlobalLightbox
          images={lightbox.images}
          initialIndex={lightbox.initialIndex}
          onClose={lightbox.onClose}
          onEditPptDeck={lightbox.onEditPptDeck}
          onEditText={lightbox.onEditText}
          onDownloadPptComposite={lightbox.onDownloadPptComposite}
          onPartialRedraw={lightbox.onPartialRedraw}
          onDeleteImage={lightbox.onDeleteImage}
          onUseAsSource={lightbox.onUseAsSource}
        />
      </Suspense>
    )}

    {pptStackPreview.state && (
      <PptStackPreviewModal
        images={pptStackPreview.state.images}
        initialIndex={pptStackPreview.state.initialIndex}
        onClose={pptStackPreview.onClose}
      />
    )}

    {pptDeckEditor.state && (() => {
      const bundle = pptDeckEditor.resolveBundle(pptDeckEditor.state.nodeId);
      if (!bundle) {
        return null;
      }

      return (
        <Suspense fallback={null}>
          <PptDeckEditorModal
            promptNode={bundle.promptNode}
            images={bundle.images}
            initialIndex={pptDeckEditor.state.initialIndex}
            onClose={pptDeckEditor.onClose}
            onSave={(pages) => pptDeckEditor.onSave(bundle.promptNode.id, pages)}
          />
        </Suspense>
      );
    })()}

    {searchPalette.isOpen && (
      <Suspense fallback={null}>
        <SearchPalette
          isOpen={searchPalette.isOpen}
          onClose={searchPalette.onClose}
          promptNodes={searchPalette.promptNodes}
          groups={searchPalette.groups}
          onNavigate={searchPalette.onNavigate}
          onMultiSelectConfirm={searchPalette.onMultiSelectConfirm}
        />
      </Suspense>
    )}

    {tutorial.isVisible && (
      <Suspense fallback={null}>
        <TutorialOverlay onComplete={tutorial.onComplete} />
      </Suspense>
    )}

    {migrateModal.isOpen && (
      <Suspense fallback={null}>
        <MigrateModal
          isOpen={migrateModal.isOpen}
          onClose={migrateModal.onClose}
          canvases={migrateModal.canvases}
          currentCanvasId={migrateModal.currentCanvasId}
          selectedCount={migrateModal.selectedCount}
          onMigrate={migrateModal.onMigrate}
        />
      </Suspense>
    )}

    {rechargeModal.enabled && rechargeModal.isOpen && (
      <Suspense fallback={null}>
        <RechargeModal />
      </Suspense>
    )}
  </GlobalModals>
);

export default AppGlobalModals;
