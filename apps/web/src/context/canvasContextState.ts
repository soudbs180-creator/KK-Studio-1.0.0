import { createContext } from 'react';
import { type Canvas, type PromptNode, type GeneratedImage, type CanvasGroup, type CanvasDrawing, type CanvasNoteNode, type WorkflowNode, type WorkflowPanelNode } from '../types';
import type { CanvasConnection } from '@kk/shared';
import { featureFlags } from '../config/featureFlags';
import { createEmptyWorkflowGraph } from '../workflow/types';
import type { CanvasCardFactoryResult, CanvasCreateCardInput } from './canvasCardFactory.ts';
import type { CanvasNoteRasterResult } from '../canvas/canvasNoteRasterizer.ts';

export const MAX_CANVASES = 10;

export type ArrangeMode = 'grid' | 'row' | 'column';

export interface CanvasState {
    canvases: Canvas[];
    activeCanvasId: string;
    history: {
        [key: string]: {
            past: Canvas[];
            future: Canvas[];
        }
    };
    fileSystemHandle: FileSystemDirectoryHandle | null;
    folderName: string | null;
    selectedNodeIds: string[];
    viewportCenter: { x: number; y: number };
}

export interface CanvasContextType {
    state: CanvasState;
    activeCanvas: Canvas | undefined;
    createCanvas: () => string | null;
    switchCanvas: (id: string) => void;
    deleteCanvas: (id: string) => void;
    renameCanvas: (id: string, newName: string) => void;
    addPromptNode: (node: PromptNode) => Promise<void>;
    updatePromptNode: (node: PromptNode) => Promise<void>;
    addImageNodes: (nodes: GeneratedImage[], parentUpdates?: Record<string, Partial<PromptNode>>) => Promise<void>;
    updatePromptNodePosition: (id: string, pos: { x: number; y: number }, options?: { moveChildren?: boolean; ignoreSelection?: boolean }) => void;
    updateImageNodePosition: (id: string, pos: { x: number; y: number }, options?: { ignoreSelection?: boolean }) => void;
    updateImageNodeDimensions: (id: string, dimensions: string) => void;
    updateImageNode: (id: string, updates: Partial<GeneratedImage>) => void;
    deleteImageNode: (id: string) => void;
    deletePromptNode: (id: string) => void;
    linkNodes: (promptId: string, imageId: string) => void;
    unlinkNodes: (promptId: string, imageId: string) => void;
    clearAllData: () => void;
    canCreateCanvas: boolean;
    undo: () => void;
    redo: () => void;
    pushToHistory: () => void;
    canUndo: boolean;
    canRedo: boolean;
    arrangeAllNodes: (mode?: ArrangeMode, nodeIds?: string[]) => void;
    getNextCardPosition: () => { x: number; y: number };
    connectLocalFolder: () => Promise<void>;
    disconnectLocalFolder: () => Promise<void>;
    changeLocalFolder: () => Promise<void>;
    refreshLocalFolder: () => Promise<void>;
    isConnectedToLocal: boolean;
    currentFolderName: string | null;
    selectedNodeIds: string[];
    selectNodes: (ids: string[], mode?: 'replace' | 'add' | 'remove' | 'toggle') => void;
    clearSelection: () => void;
    bringNodesToFront: (nodeIds: string[]) => void;
    moveSelectedNodes: (delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[], options?: { snapToGrid?: boolean }) => void;
    moveSelectedNodesImmediate: (delta: { x: number; y: number }, sourceNodeIdOrIds?: string | string[], options?: { snapToGrid?: boolean }) => void;
    findSmartPosition: (x: number, y: number, width: number, height: number, buffer?: number) => { x: number; y: number };
    findNextGroupPosition: () => { x: number; y: number };
    addGroup: (group: CanvasGroup) => void;
    removeGroup: (id: string) => void;
    updateGroup: (group: CanvasGroup) => void;
    setNodeTags: (ids: string[], tags: string[]) => void;
    isReady: boolean;
    setViewportCenter: (center: { x: number; y: number }) => void;
    migrateNodes: (nodeIds: string[], targetCanvasId: string) => void;
    mergeCanvasInto: (sourceCanvasId: string, targetCanvasId: string, options?: { deleteSource?: boolean }) => {
        movedPrompts: number;
        movedImages: number;
        deletedSource: boolean;
    };
    cleanupInvalidCards: (canvasId?: string) => {
        removedPrompts: number;
        removedImages: number;
        removedGroups: number;
    };
    urgentUpdatePromptNode: (node: PromptNode) => void;
    updateNodes: (updates: {
        promptNodes?: { id: string, updates: Partial<PromptNode> }[],
        imageNodes?: { id: string, updates: Partial<GeneratedImage> }[]
    }) => void;
    addWorkflowNode: (node: WorkflowNode) => void;
    updateWorkflowNode: (id: string, updates: Partial<WorkflowNode>) => void;
    updateWorkflowNodePosition: (id: string, pos: { x: number; y: number }) => void;
    deleteWorkflowNode: (id: string) => void;
    createWorkflowPanel: (title?: string) => WorkflowPanelNode;
    createCard: (input: CanvasCreateCardInput) => CanvasCardFactoryResult;
    addCanvasDrawing: (drawing: CanvasDrawing) => void;
    deleteCanvasDrawing: (id: string) => void;
    clearCanvasDrawings: () => void;
    updateCanvasDrawings: (ids: string[], updates: Partial<CanvasDrawing>) => void;
    moveCanvasDrawings: (ids: string[], delta: { x: number; y: number }) => void;
    addCanvasConnection: (connection: CanvasConnection) => void;
    deleteCanvasConnection: (id: string) => void;
    updateCanvasConnection: (id: string, updates: Partial<CanvasConnection>) => void;
    createCanvasConnection: (sourceNodeId: string, targetNodeId: string, sourcePort?: CanvasConnection['sourcePort'], targetPort?: CanvasConnection['targetPort']) => CanvasConnection | null;
    convertDrawingsToNote: (drawingIds: string[], title?: string) => CanvasNoteNode | null;
    editNoteNode: (id: string) => string[];
    rasterizeNote: (id: string, scale?: number) => Promise<(CanvasNoteRasterResult & { previewStorageId: string }) | null>;
    updateNoteNodePosition: (id: string, position: { x: number; y: number }) => void;
    deleteNoteNode: (id: string) => void;
}

export const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export interface CanvasStartupStatusContextType {
    isLoading: boolean;
    loadingProgress: number;
}

export const CanvasStartupStatusContext = createContext<CanvasStartupStatusContextType>({
    isLoading: true,
    loadingProgress: 0,
});

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const createCanvasWorkflow = (): Canvas['workflow'] | undefined =>
    featureFlags.experimentalWorkflowGraph ? createEmptyWorkflowGraph<WorkflowNode>() : undefined;

export const DEFAULT_CANVAS: Canvas = {
    id: 'default',
    name: '项目1',
    promptNodes: [],
    imageNodes: [],
    groups: [] as CanvasGroup[],
    drawings: [] as CanvasDrawing[],
    connections: [],
    noteNodes: [],
    workflow: createCanvasWorkflow(),
    presentationVersion: 2,
    lastModified: Date.now()
};

export const DEFAULT_STATE: CanvasState = {
    canvases: [DEFAULT_CANVAS],
    activeCanvasId: 'default',
    history: { 'default': { past: [], future: [] } },
    fileSystemHandle: null,
    folderName: null,
    selectedNodeIds: [],
    viewportCenter: { x: 0, y: 0 }
};
