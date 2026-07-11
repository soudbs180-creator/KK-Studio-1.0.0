import React, { Suspense } from 'react';
import { GlobalModals } from '../components/workspace';
import type { UserProfileView } from '../components/modals/UserProfileModal';
import type { RuntimeAuthUser } from '../services/auth/runtimeAuthTypes.ts';
import type { SettingsPanelProps } from '../components/settings/SettingsPanel';
import { isChunkLoadError, lazyNamedWithRetry, lazyWithRetry } from '../utils/lazyWithRetry';
import type {
  Canvas,
  CanvasGroup,
  GeneratedImage,
  PptEditablePage,
  PromptNode,
  RedrawRequest,
} from '../types';

const GlobalLightbox = lazyNamedWithRetry(() => import('../components/image/GlobalLightbox'), 'GlobalLightbox');
const PptStackPreviewModal = lazyWithRetry(() => import('../components/image/PptStackPreviewModal'));
const SettingsPanel = lazyWithRetry(() => import('../components/settings/SettingsPanel'));
const SearchPalette = lazyWithRetry(() => import('../components/layout/SearchPalette'));
const TagInputModal = lazyWithRetry(() => import('../components/modals/TagInputModal'));
const TutorialOverlay = lazyWithRetry(() => import('../components/common/TutorialOverlay'));
const StorageSelectionModal = lazyWithRetry(() => import('../components/modals/StorageSelectionModal'));
const MigrateModal = lazyNamedWithRetry(() => import('../components/modals/MigrateModal'), 'MigrateModal');
const PptDeckEditorModal = lazyWithRetry(() => import('../components/image/PptDeckEditorModal'));
const MarkdownToCardsModal = lazyWithRetry(() => import('../components/markdown/MarkdownToCardsModal'));
const MermaidRenderer = lazyWithRetry(() => import('../components/mermaid/MermaidRenderer'));

const LOAD_SETTINGS_CHUNK_HELPER =
  '\u8bbe\u7f6e\u8d44\u6e90\u521a\u521a\u66f4\u65b0\u6216\u5f00\u53d1\u670d\u52a1\u77ed\u6682\u91cd\u542f\uff0c\u91cd\u65b0\u52a0\u8f7d\u540e\u5373\u53ef\u7ee7\u7eed\u3002';
const LOAD_SETTINGS_GENERIC_HELPER =
  '\u8bbe\u7f6e\u6a21\u5757\u52a0\u8f7d\u65f6\u9047\u5230\u5f02\u5e38\uff0c\u5148\u5173\u95ed\u4e0d\u4f1a\u5f71\u54cd\u5f53\u524d\u753b\u5e03\u3002';
const SETTINGS_LOAD_FAILED_TITLE = '\u8bbe\u7f6e\u9875\u52a0\u8f7d\u5931\u8d25';
const SETTINGS_RELOAD_LABEL = '\u91cd\u65b0\u52a0\u8f7d\u8bbe\u7f6e\u9875';
const SETTINGS_CLOSE_LABEL = '\u5173\u95ed\u8bbe\u7f6e';
const CONVERTER_LOADING_LABEL = '\u6b63\u5728\u8f7d\u5165\u8f6c\u6362\u6a21\u5757...';

type SettingsPanelLoadBoundaryProps = {
  resetKey: string;
  onClose: () => void;
  children: React.ReactNode;
};

type SettingsPanelLoadBoundaryState = {
  error: Error | null;
};

class SettingsPanelLoadBoundary extends React.Component<SettingsPanelLoadBoundaryProps, SettingsPanelLoadBoundaryState> {
  state: SettingsPanelLoadBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SettingsPanelLoadBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[SettingsPanel] Failed to load settings module:', error);
  }

  componentDidUpdate(prevProps: SettingsPanelLoadBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    try {
      window.sessionStorage.removeItem('kk-auto-reload-chunk-fail');
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set('__kk_settings_retry__', Date.now().toString());
    window.location.href = `${url.pathname}${url.search}${url.hash}`;
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const helper = isChunkLoadError(this.state.error)
      ? LOAD_SETTINGS_CHUNK_HELPER
      : LOAD_SETTINGS_GENERIC_HELPER;

    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--mobile-clay-overlay-bg, rgba(10, 10, 10, 0.24))',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div
          style={{
            width: 'min(520px, 100%)',
            border: '1px solid var(--border-default, rgba(17, 24, 39, 0.14))',
            borderRadius: 18,
            padding: 20,
            background: 'var(--bg-surface, #ffffff)',
            color: 'var(--text-primary, #0a0a0a)',
            boxShadow: 'var(--frost-card-framework-shadow, none)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>
            {SETTINGS_LOAD_FAILED_TITLE}
          </div>
          <div style={{ marginTop: 8, color: 'var(--text-secondary, #3a3a3a)', fontSize: 13, lineHeight: 1.7 }}>
            {helper}
          </div>
          <pre
            style={{
              marginTop: 14,
              maxHeight: 110,
              overflow: 'auto',
              border: '1px solid var(--border-subtle, rgba(17, 24, 39, 0.10))',
              borderRadius: 12,
              padding: 12,
              background: 'var(--bg-tertiary, #ffffff)',
              color: 'var(--text-secondary, #3a3a3a)',
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={this.retry}
              style={{
                minHeight: 38,
                border: 0,
                borderRadius: 10,
                padding: '0 14px',
                background: 'var(--accent-coral, #ff6b5a)',
                color: '#ffffff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {SETTINGS_RELOAD_LABEL}
            </button>
            <button
              type="button"
              onClick={this.props.onClose}
              style={{
                minHeight: 38,
                border: '1px solid var(--border-default, rgba(17, 24, 39, 0.14))',
                borderRadius: 10,
                padding: '0 14px',
                background: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-primary, #0a0a0a)',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {SETTINGS_CLOSE_LABEL}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

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
    isChatOpen?: boolean;
    chatSidebarWidth?: number;
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
    onUseAsSource?: (image: GeneratedImage) => void;
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
  markdownModal: {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (cards: any[]) => void;
  };
  mermaidModal: {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (data: any) => void;
  };
}

const SuspenseGlassSpinner: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/10 backdrop-blur-md rounded-3xl gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
    <span className="text-xs text-white/40 tracking-wider font-medium">
      {CONVERTER_LOADING_LABEL}
    </span>
  </div>
);

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
  markdownModal,
  mermaidModal,
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

    {settingsPanel.isOpen && (
      <SettingsPanelLoadBoundary
        resetKey={`${settingsPanel.sessionKey}-${settingsPanel.initialView}-${settingsPanel.initialSupplier?.id || 'none'}`}
        onClose={settingsPanel.onClose}
      >
        <Suspense fallback={null}>
          <SettingsPanel
            key={`${settingsPanel.sessionKey}-${settingsPanel.initialView}-${settingsPanel.initialSupplier?.id || 'none'}`}
            isOpen={settingsPanel.isOpen}
            onClose={settingsPanel.onClose}
            initialView={settingsPanel.initialView}
            initialSupplier={settingsPanel.initialSupplier}
            isChatOpen={settingsPanel.isChatOpen}
            chatSidebarWidth={settingsPanel.chatSidebarWidth}
          />
        </Suspense>
      </SettingsPanelLoadBoundary>
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
      <Suspense fallback={null}>
        <PptStackPreviewModal
          images={pptStackPreview.state.images}
          initialIndex={pptStackPreview.state.initialIndex}
          onClose={pptStackPreview.onClose}
        />
      </Suspense>
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

    {markdownModal.isOpen && (
      <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={markdownModal.onClose}>
        <div className="w-[880px] h-[640px] bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <Suspense fallback={<SuspenseGlassSpinner />}>
            <MarkdownToCardsModal
              onInsertCards={markdownModal.onInsert}
              onClose={markdownModal.onClose}
            />
          </Suspense>
        </div>
      </div>
    )}

    {mermaidModal.isOpen && (
      <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={mermaidModal.onClose}>
        <div className="w-[960px] h-[680px] bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <Suspense fallback={<SuspenseGlassSpinner />}>
            <MermaidRenderer
              onInsertCards={mermaidModal.onInsert}
              onClose={mermaidModal.onClose}
            />
          </Suspense>
        </div>
      </div>
    )}
  </GlobalModals>
);

export default AppGlobalModals;
