
import React, { useDeferredValue, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowUp, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, FileText, Film, GitBranch, Layout, Loader2, MessageSquare, Mic, Pencil, Plus, RotateCcw, Square, User, X, Search, Download, Upload, Archive, Edit2, Trash2, Minus, Cpu, AlertTriangle, FolderOpen, Image as Picture, Eye, Lock, Pause, Play, Ghost } from 'lucide-react';
import { KK_LAYER, KK_LAYOUT, normalizeAssistantSidebarWidth } from '@kk/ui';

// 简体中文：自定义扫把（Broom）图标组件，弥补内置图标库版本缺失
const Broom: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }> = ({ size = 24, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M4 20h16" />
        <path d="m11 15 4.5-4.5" />
        <path d="m13 13 4.5-4.5" />
        <path d="M15 11 19.5 6.5" />
        <path d="m20 4-4.5 4.5" />
        <path d="M11 15 8 18" />
        <path d="m8 18-2 2" />
        <path d="M13 13 10 16" />
        <path d="m10 16-2 2" />
    </svg>
);
import { notify } from '../../services/system/notificationService';
import { keyManager } from '../../services/auth/keyManager';
import { getRuntimeOwnerId } from '../../services/auth/runtimeSessionProfile';
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { getModelDisplayInfo, getModelThemeColor } from '../../services/model/modelCapabilities';
import { getModelCredits } from '../../services/model/modelPricing';
import { refreshModelLibraryData } from '../../services/model/modelLibraryRefresh';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { toggleModelPin, getPinnedModels, filterAndSortModels } from '../../utils/modelSorting';
import { writeTextToClipboard } from '../../utils/clipboard';
import ReactDOM from 'react-dom';
import { AspectRatio, ImageSize } from '../../types';
import type { PromptNode } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useCanvas } from '../../context/CanvasContext';
import { useImageGeneration } from '../../hooks/useImageGeneration';
import type { SettingsSurfaceView } from '../../hooks/useWorkspaceSurface';
import { getCardDimensions } from '../../utils/styleUtils';
import ModelLogo from '../common/ModelLogo';
import {
    AITakeoverProvider,
    AIContextSuggestions,
    AITakeoverToggle,
    useAITakeover,
    type AssistantWorkspaceSurface,
} from '../../features/ai-takeover';
import {
    AGENT_CONTROL_ACTIONS,
    CHAT_SHELL_ACTIONS,
    durableGenerationQueue,
    type AssistantSiteCapabilityPorts,
    type GenerationBatchJob,
} from '../../features/ai-assistant-runtime';
import { useAssetStore } from '../../features/assets/assetStore';
import {
    ReferenceMentionPanel,
    buildReferenceMentionTabs,
    computeReferenceMentionAnchor,
    favoriteComposerRegistry,
    useFavoritesStore,
    type MentionReferencePayload,
    type ReferenceMentionAnchor,
    type ReferenceMentionCandidate,
} from '../../features/favorites';
import { estimateTokens, getModelContextLimit } from '../../utils/contextHelper';
import {
    buildAvailableChatModels,
    resolveAssistantPreferredKeyId,
    useChatModelCatalog,
    useSelectedChatModelState,
    type ChatModel,
} from './chat-sidebar/model/useChatModelCatalog';
import {
    TEMP_SESSION_ID,
    TEMP_SESSION_STORAGE_KEY,
    createBranchSession,
    createNewChatSession,
    createTemporaryChatSession,
    createWelcomeMessage,
    duplicateChatSession,
    ensureUniqueIds,
    formatSessionMeta,
    getSessionLabel,
    mergeImportedSessions,
    parseSessionImport,
    type Attachment,
    type ChatSessionItem,
    type Message,
    type SessionContextMenu,
    type SessionImportMode,
    type SessionImportPreview,
} from './chat-sidebar/session/chatSessionData';
import { useChatSessionState } from './chat-sidebar/session/useChatSessionState';
import {
    createChatContextCompression,
    prepareChatContextCompression,
} from './chat-sidebar/session/chatContextCompression';
import { resolveChatAgentRunSessionId } from './chat-sidebar/session/chatAgentRunSessionBinding';

interface ChatSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose?: () => void;
    isMobile: boolean;
    onOpenSettings?: (view?: SettingsSurfaceView) => void;
    openLibrarySurface?: () => void;
    openFavoritesSurface?: () => void;
    openProfileSurface?: (view?: any) => void;
    focusWorkspace?: () => void;
    onHoverChange?: (isHovered: boolean) => void; // 通知父组件hover状态变化
    onWidthChange?: (width: number) => void;
    config?: any;
    setConfig?: any;
    ecommerceState?: any;
    onGenerate?: any;
    canvasTransform?: { x: number; y: number; scale: number } | null;
    canvasRef?: any;
    workspaceSurface?: string;
    openToolWindowInstance?: (toolId: string, url?: string, options?: any) => void;
    updateToolWindowLayout?: (instanceId: string, layout: Partial<any>) => void;
    setPptEditorMode?: (mode: string) => void;
    togglePinTool?: (toolId: string, pinned: boolean) => void;
}


type ChatSidebarModelMenuItem = ChatModel & {
    displayName: string;
    displayInfo: ReturnType<typeof getModelDisplayInfo>;
    advantage: string;
    isPinned: boolean;
};

type ChatSidebarModelMenuButtonProps = {
    model: ChatSidebarModelMenuItem;
    selected: boolean;
    onSelect: (model: ChatSidebarModelMenuItem) => void;
    onOpenContextMenu: (event: React.MouseEvent<HTMLButtonElement>, modelId: string) => void;
};

const ChatSidebarModelMenuButton = React.memo(function ChatSidebarModelMenuButton({
    model,
    selected,
    onSelect,
    onOpenContextMenu,
}: ChatSidebarModelMenuButtonProps) {
    return (
        <button
            onClick={() => onSelect(model)}
            onContextMenu={(event) => onOpenContextMenu(event, model.id)}
            data-chat-shell-action={CHAT_SHELL_ACTIONS.selectModel.uiAction}
            className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg border text-sm text-left transition-all ${selected ? 'border-[var(--frost-card-sub-border)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'}`}
            style={selected ? {
                background: 'var(--frost-card-sub-bg)',
                boxShadow: 'var(--frost-card-sub-shadow)',
            } : undefined}
        >
            <span className="mt-0.5 relative shrink-0 inline-flex h-5 w-5 items-center justify-center">
                <ModelLogo
                    modelId={model.id}
                    provider={model.provider}
                    modelName={model.displayInfo.displayName}
                    size={18}
                    active={selected}
                />
                {model.isPinned && <span className="absolute -top-1 -right-1 text-[8px]">📌</span>}
            </span>
            <div className="flex flex-col gap-0.5 w-full min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className={`font-medium truncate min-w-0 ${getModelThemeColor(model.id)}`}>
                        {model.displayInfo.displayName}
                    </span>
                    {model.displayInfo.badgeText && (
                        <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border opacity-80 shrink-0 ${model.displayInfo.badgeColor}`}
                            style={{ whiteSpace: 'nowrap', ...(model.displayInfo.badgeStyle || {}) }}
                        >
                            {model.displayInfo.badgeText}
                        </span>
                    )}
                </div>
                <span className="text-[10px] opacity-70 leading-tight truncate min-w-0">{model.advantage}</span>
            </div>
        </button>
    );
});

const MODEL_MENU_SKELETON_COUNT = 3;

type ModelMenuLoadingState = 'idle' | 'refreshing_with_cache' | 'bootstrapping_without_cache';
type ChatOptions = import('../../services/llm/LLMAdapter').ChatOptions;
type GenerationServiceClass = import('../../features/generation/generateService').GenerationService;
type GenerateImageFn = GenerationServiceClass['generateImage'];

const chatWithLlm = async (options: ChatOptions): Promise<string> => {
    const { generationService } = await import('../../features/generation/generateService');
    return generationService.chat(options);
};

const generateImageOnDemand = async (...args: Parameters<GenerateImageFn>): Promise<ReturnType<GenerateImageFn>> => {
    const { generationService } = await import('../../features/generation/generateService');
    return generationService.generateImage(...args);
};

const getDurableQueueJobNodeIds = (job: GenerationBatchJob): string[] => Array.from(new Set([
    ...(job.outputGroup?.nodeIds || []),
    ...job.prompts.map(prompt => prompt.promptNodeId).filter((id): id is string => Boolean(id)),
    ...job.prompts.flatMap(prompt => prompt.resultImageNodeIds || []),
]));

const getDurableQueueStatusLabel = (job: GenerationBatchJob): string => {
    if (job.status === 'running') return '运行中';
    if (job.status === 'paused') return '已暂停';
    if (job.status === 'queued') return '排队中';
    if (job.status === 'cancelled') return '已取消';
    if (job.status === 'completed_with_errors') return '部分完成';
    if (job.status === 'failed') return '失败';
    if (job.prompts.some(prompt => prompt.status === 'failed')) return '有失败';
    if (job.status === 'completed') return '已完成';
    return '失败';
};

const getDurableQueueStatusClass = (job: GenerationBatchJob): string => {
    if (job.status === 'running') return 'border-[var(--state-info-border)] bg-[var(--state-info-bg)] text-[var(--state-info-text)]';
    if (job.status === 'paused') return 'border-[var(--state-warning-border)] bg-[var(--state-warning-bg)] text-[var(--state-warning-text)]';
    if (job.status === 'queued') return 'border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)]';
    if (job.status === 'cancelled') return 'border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-tertiary)]';
    if (job.prompts.some(prompt => prompt.status === 'failed')) return 'border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] text-[var(--state-danger-text)]';
    return 'border-[var(--state-success-border)] bg-[var(--state-success-bg)] text-[var(--state-success-text)]';
};

const getDurableQueueJobCounts = (job: GenerationBatchJob) => {
    const total = job.prompts.length;
    const completed = job.prompts.filter(prompt => prompt.status === 'completed').length;
    const failed = job.prompts.filter(prompt => prompt.status === 'failed').length;
    const retryableFailed = job.prompts.filter(prompt => prompt.status === 'failed' && prompt.retryable !== false).length;
    const running = job.prompts.filter(prompt => prompt.status === 'running').length;
    const queued = job.prompts.filter(prompt => prompt.status === 'queued').length;
    const percent = job.progress?.percent ?? (total > 0 ? Math.round(((completed + failed) / total) * 100) : 0);
    const firstFailure = job.prompts.find(prompt => prompt.status === 'failed' && prompt.error)?.error || '';

    return { total, completed, failed, retryableFailed, running, queued, percent, firstFailure };
};

const summarizeSessionTitle = async (
    questionContent: string,
    modelId: string,
    preferredKeyId?: string
): Promise<string> => {
    try {
        const prompt = `请简要总结以下用户的问题/需求，生成一个通俗易懂、非常简短的会话标题（不超过 10 个字，直接返回标题，不要有任何解释、标点符号或前缀，也不要说“分支”、“总结”等字眼）：\n"${questionContent}"`;
        const response = await chatWithLlm({
            modelId,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            preferredKeyId
        });
        const summary = response?.trim();
        if (summary && summary.length > 0 && summary.length < 30) {
            return summary.replace(/^["'“‘|]|[”’"']$/g, '').trim();
        }
        return '';
    } catch (e) {
        console.warn('[ChatSidebar] Summarize title failed:', e);
        return '';
    }
};

const buildMessageWithAttachments = (
    userText: string,
    atts: Attachment[]
): { messageContent: string; inlineData: { mimeType: string; data: string }[] } => {
    let messageContent = userText;
    const inlineData: { mimeType: string; data: string }[] = [];

    for (const att of atts) {
        if (att.type === 'image' || att.type === 'video' || att.type === 'audio') {
            const base64Match = att.data.match(/^data:([^;]+);base64,(.+)$/);
            if (base64Match) {
                inlineData.push({
                    mimeType: base64Match[1],
                    data: base64Match[2]
                });
            }
        } else if (att.type === 'document') {
            messageContent += `\n\n[文档: ${att.name}]`;
        }
    }

    return { messageContent, inlineData };
};

// 简体中文：预置对项目的理解以及常见报错调试的知识库
interface KnowledgeItem {
    keywords: string[];
    title: string;
    content: string;
}

const LOCAL_KNOWLEDGE: KnowledgeItem[] = [
    {
        keywords: ['新建', '创建', '画布', '项目', '怎么建', '加画布', '新增项目', '新项目'],
        title: '新建画布与项目',
        content: '在 KK-Studio 中，您可以在左侧项目管理器中轻松新建画布项目。请点击 [高亮新建画布按钮](action://highlight-#btn-create-canvas) 来创建一块全新的无限画布。'
    },
    {
        keywords: ['删除', '节点', '卡片', '清空', '删掉', '怎么删', '移除'],
        title: '删除画布节点或卡片',
        content: '如果您想删除画布上的任何内容：\n1. 选中要删除的提示词卡片或生成图片卡片。\n2. 点击卡片上方弹出的操作菜单中的垃圾桶图标。\n3. 您也可以直接按下键盘上的 `Delete` 或 `Backspace` 键来删除选中的节点。'
    },
    {
        keywords: ['连接', '连线', '关联', '画线', '拉线', '线怎么画', '箭头'],
        title: '节点之间的连线与关联',
        content: '在画布上，当您从已生成图片的底部向下拖拽时，会拉出一根绿色的连线。松手后将其与新建提示词卡片相连，就可以在它们之间建立绘图上下文关联，非常适合进行重绘、局部修改等追问操作。'
    },
    {
        keywords: ['放大', '缩小', '缩放', '看不清', '大小', '视野', '重置', '移动', '滚轮'],
        title: '画布缩放与重置视图',
        content: '1. 您可以使用鼠标滚轮在画布上进行自由缩放，或按住鼠标中键/空格键拖拽画布来移动视野。\n2. 您也可以点击左下角精致的 [高亮缩放控制面板](action://highlight-.desktop-zoom-rail) 按钮进行调整，双击缩放数值可重置为 100%。'
    },
    {
        keywords: ['充值', '积分', '不够', '没积分', '余额', '买积分', '充钱'],
        title: '关于积分与充值',
        content: '使用系统默认提供的模型会消耗积分。由于默认注册积分为 0，您可以直接点击 [立即去充值](action://open-recharge) 或是点击 [高亮充值按钮](action://highlight-#btn-desktop-recharge) 来获取积分。'
    },
    {
        keywords: ['设置', '配置', 'key', '密钥', 'api', '接ai', '连接ai', '接口', '专属key'],
        title: '如何配置 API 密钥',
        content: '如果您有自己的 Gemini 或 OpenAI API Key，可以将其填入本地设置中。这样，对话和生成将直接使用您的专属密钥，不再扣除系统积分！\n您可以点击 [跳转到API设置页面](action://open-settings-api) 进行配置，也可以 [高亮设置按钮](action://highlight-#btn-desktop-settings) 来打开面板。'
    },
    {
        keywords: ['报错', '错误', '不工作', '失败', '断开', '调试', '故障', '限流'],
        title: '常见错误与调试',
        content: '报错通常由于以下几种情况引起：\n1. **积分不足**：若使用默认模型，请点击 [去充值](action://open-recharge)。\n2. **API 密钥失效**：请检查您的 API Key 是否输入正确，点击 [去设置API](action://open-settings-api)。\n3. **网络超时**：请检查您的网络连接并刷新页面重试。'
    }
];

const matchLocalKnowledge = (query: string): string | null => {
    const lowerQuery = (query || '').toLowerCase();
    for (const item of LOCAL_KNOWLEDGE) {
        if (item.keywords.some(kw => lowerQuery.includes(kw))) {
            return `### 💡 ${item.title}\n\n${item.content}`;
        }
    }
    return null;
};

interface NormalChatSidebarProps extends ChatSidebarProps {
    selectedModel: ChatModel;
    setSelectedModel: (m: ChatModel) => void;
}

const NormalChatSidebar: React.FC<NormalChatSidebarProps> = (props) => {
    const { isOpen, onToggle, onClose, isMobile, onOpenSettings, onHoverChange, onWidthChange, selectedModel, setSelectedModel } = props;
    const { user, isTempUser, loading: authLoading } = useAuth();
    // 简体中文：AI接管与本地资源池相关状态和 Hook 注入
    const {
        collaborationMode,
        aiTakeoverMode,
        messages,
        setMessages,
        isThinking: takeoverIsThinking,
        sendMessage: sendTakeoverMessage,
        pendingPlan,
        executePendingPlan,
        cancelPendingPlan,
        currentRun,
        agentRunTimeline,
        setSelectedModel: ctxSetSelectedModel
    } = useAITakeover();
    const isAgentCollaboration = collaborationMode !== 'direct';

    const visibleTakeoverTimeline = useMemo(() => {
        if (!currentRun && takeoverIsThinking) {
            return agentRunTimeline.map((step, index) => ({
                ...step,
                status: index === 0 ? 'done' as const : index === 1 ? 'active' as const : 'pending' as const,
            }));
        }

        return agentRunTimeline;
    }, [agentRunTimeline, currentRun, takeoverIsThinking]);
    const shouldShowTakeoverTimeline = isAgentCollaboration && Boolean(currentRun || takeoverIsThinking || pendingPlan);

    const [durableQueueJobs, setDurableQueueJobs] = useState<GenerationBatchJob[]>(() => durableGenerationQueue.getJobs());
    useEffect(() => durableGenerationQueue.subscribe(setDurableQueueJobs), []);
    const activeDurableJobs = useMemo(() => durableQueueJobs.filter(job => (
        job.status === 'queued' ||
        job.status === 'running' ||
        job.status === 'paused' ||
        job.prompts.some(prompt => prompt.status === 'failed') ||
        getDurableQueueJobNodeIds(job).length > 0
    )).slice(0, 4), [durableQueueJobs]);
    const shouldShowDurableQueuePanel = isAgentCollaboration && activeDurableJobs.length > 0;

    const apiKeyStatus = keyManager.hasValidKeys() ? 'configured_masked' : 'missing';

    const [showTakeoverMenu, setShowTakeoverMenu] = useState(false);
    const [showResourcePanel, setShowResourcePanel] = useState(false);

    const takeoverImgInputRef = useRef<HTMLInputElement>(null);
    const takeoverDirInputRef = useRef<HTMLInputElement>(null);
    const takeoverFileInputRef = useRef<HTMLInputElement>(null);

    const {
        images: takeoverImages,
        files: takeoverFiles,
        addImage: addTakeoverImage,
        addFile: addTakeoverFile,
        removeAsset: removeTakeoverAsset,
        addImageCollection: addTakeoverImageCollection
    } = useAssetStore();
    const favoriteItems = useFavoritesStore(state => state.items);

    const handleTakeoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (fileList) {
            Array.from(fileList).forEach(file => addTakeoverImage(file));
        }
    };

    const handleTakeoverDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (fileList) {
            addTakeoverImageCollection(
                Array.from(fileList).map(file => ({
                    file,
                    relativePath: file.webkitRelativePath
                }))
            );
        }
    };

    const handleTakeoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (fileList) {
            Array.from(fileList).forEach(file => addTakeoverFile(file));
        }
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getUploadStateText = (state: string) => {
        switch (state) {
            case 'linked': return '已连接';
            case 'local_ready': return '已连接，本地可用，尚未上传';
            case 'indexed': return '已索引';
            case 'uploaded': return '已上传';
            case 'used': return '正在使用';
            case 'failed': return '失败';
            case 'blocked_sensitive': return '敏感文件被隔离';
            default: return state;
        }
    };

    useEffect(() => {
        if (!showTakeoverMenu) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('#btn-takeover-menu-container') && !target.closest('#btn-takeover-plus-button')) {
                setShowTakeoverMenu(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, [showTakeoverMenu]);

    // 2. Chat State
    const chatMessages = messages as Message[];
    const {
        activeBranchTrail,
        activeSession,
        activeSessionId,
        expandedNodes,
        sessionSearch,
        sessionTreeRows,
        sessions,
        commitContextCompression,
        setActiveSessionId,
        setExpandedNodes,
        setSessionSearch,
        setSessions,
        setShowArchived,
        showArchived,
    } = useChatSessionState({
        messages: chatMessages,
        preferredKeyId: resolveAssistantPreferredKeyId(),
        selectedModelId: selectedModel.id,
        setMessages: setMessages as React.Dispatch<React.SetStateAction<Message[]>>,
        summarizeTitle: summarizeSessionTitle,
    });
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    useEffect(() => {
        setIsHistoryExpanded(false);
    }, [activeSessionId]);

    const { maxTokens, supportsCompression, label: maxTokensLabel } = useMemo(() => {
        return getModelContextLimit(selectedModel?.id);
    }, [selectedModel?.id]);

    const totalTokensUsed = useMemo(() => {
        let total = 0;
        messages.forEach(msg => {
            total += estimateTokens(msg.content);
        });
        return total;
    }, [messages]);

    const percentUsed = useMemo(() => {
        return Math.min(100, Math.round((totalTokensUsed / maxTokens) * 100));
    }, [totalTokensUsed, maxTokens]);

    const isNearLimit = percentUsed >= 80;

    const handleCompressContext = async () => {
        if (isCompressing || messages.filter(m => m.id !== 'welcome').length <= 1) return;
        setIsCompressing(true);
        registerActivity();

        try {
            const compressionSessionId = activeSessionId;
            const prepared = prepareChatContextCompression(messages as Message[]);
            const promptText = "请为我们之前的对话内容进行一次高度精炼的摘要总结，提炼出核心的事实、当前的任务状态和关键决策。要求言简意赅，不要有任何客套话。";
            const responseText = await chatWithLlm({
                modelId: selectedModel.id,
                messages: [
                    ...prepared.history,
                    { role: 'user', content: promptText }
                ],
                preferredKeyId: resolveAssistantPreferredKeyId(),
            });

            if (!responseText) throw new Error("大模型未能返回摘要内容");
            const compression = createChatContextCompression({
                summaryText: responseText,
                coveredMessageCount: prepared.coveredMessageCount,
                modelId: selectedModel.id,
                timestamp: Date.now(),
            });
            if (!compression) throw new Error("摘要证据不符合 Session 约束");
            commitContextCompression(compressionSessionId, compression);
            notify.success("上下文压缩成功！", "已通过大模型摘要进行上下文压缩并归档。");
        } catch (error: unknown) {
            console.error("Context compression failed:", error);
            notify.error("上下文压缩失败", error instanceof Error ? error.message : "未知错误");
        } finally {
            setIsCompressing(false);
        }
    };

    const { balance, loading: billingLoading, setShowRechargeModal } = useBilling();
    const { activeCanvas, addPromptNode, getNextCardPosition } = useCanvas();
    const handleLocateDurableJob = useCallback((job: GenerationBatchJob) => {
        const outputNodeIds = getDurableQueueJobNodeIds(job);
        const canvasNodes = [
            ...(activeCanvas?.promptNodes || []),
            ...(activeCanvas?.imageNodes || []),
        ];
        const targetNode = canvasNodes.find((node: any) => outputNodeIds.includes(node.id));

        if (!targetNode?.position) {
            notify.info('队列定位', '当前任务还没有可定位的画布产物。');
            return;
        }

        window.dispatchEvent(new CustomEvent('canvas-center-on-node', {
            detail: {
                x: targetNode.position.x,
                y: targetNode.position.y,
                nodeId: targetNode.id,
            },
        }));
        notify.success('已定位队列输出', job.outputGroup?.label || `Job ${job.id.slice(-6)}`);
    }, [activeCanvas?.imageNodes, activeCanvas?.promptNodes]);
    const { executeGeneration } = useImageGeneration({
        isMobile,
        getCardDimensions: (ratio, hasToolbar) => getCardDimensions(ratio, hasToolbar),
        rememberPreferredKeyForMode: () => {}
    });
    const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');

    const referenceMentionTabs = useMemo(() => buildReferenceMentionTabs({
        assistantImages: takeoverImages,
        assistantFiles: takeoverFiles,
        promptNodes: activeCanvas?.promptNodes || [],
        imageNodes: activeCanvas?.imageNodes || [],
        favorites: favoriteItems,
    }), [
        activeCanvas?.imageNodes,
        activeCanvas?.promptNodes,
        favoriteItems,
        takeoverFiles,
        takeoverImages,
    ]);

    const handleActionClick = useCallback((url: string) => {
        const isTakeoverAction = url === 'action://takeover-prompt-only' ||
                                 url === 'action://takeover-prompt-doc' ||
                                 url.startsWith('action://takeover-image-to-video') ||
                                 url.startsWith('action://takeover-bulk-generate');

        if (isTakeoverAction) {
            if (url === 'action://takeover-prompt-only') {
                sendTakeoverMessage('帮我只优化提示词并填充，不进行图片生成。');
            } else if (url === 'action://takeover-prompt-doc') {
                sendTakeoverMessage('请帮我把优化的生图模板方案整理一份文案形式输出。');
            } else if (url.startsWith('action://takeover-image-to-video')) {
                // 1. 获取画布上最新的图片节点
                const images = activeCanvas?.imageNodes || [];
                const latestImage = images.length > 0 ? images[images.length - 1] : null;

                if (latestImage && props.setConfig) {
                    // 2. 切换到视频模式，并设置参考图
                    props.setConfig((prev: any) => ({
                        ...prev,
                        mode: 'video', // 切换到视频模式
                        referenceImages: [{
                            id: latestImage.id,
                            url: latestImage.url,
                            label: (latestImage.displayLabel || latestImage.prompt || '生图参考').substring(0, 30)
                        }]


                    }));
                    notify.success('AI 接管：已帮您将最新图片设为参考图并切换至视频模式。', '您可以直接在输入框继续细化视频描述，然后点击发送！');
                } else {
                    notify.warning('AI 接管', '未能在当前画布上找到生成好的图片。');
                }
            } else {
                const parsedUrl = url.replace('action://', 'http://dummy');
                try {
                    const u = new URL(parsedUrl);
                    const prompts = u.searchParams.get('prompts') || '';

                    if (url.startsWith('action://takeover-bulk-generate') && prompts) {
                        sendTakeoverMessage(`使用提示词开始生成：${prompts}`);
                    } else {
                        const mockAnchor = document.createElement('a');
                        mockAnchor.href = url;
                        mockAnchor.click();
                    }
                } catch (err) {
                    console.error('Action parse error:', err);
                }
            }
            return;
        }

        if (url.startsWith('action://highlight-')) {
            const selector = url.replace('action://highlight-', '');
            if (selector === '#btn-create-canvas') {
                const trigger = document.querySelector('#project-manager-trigger') as HTMLElement;
                if (trigger) {
                    trigger.click();
                }
            }
            setTimeout(() => {
                const el = document.querySelector(selector) as HTMLElement;
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight-glow-ring');
                    setTimeout(() => {
                        el.classList.remove('highlight-glow-ring');
                    }, 3000);
                    notify.success('已为您高亮定位对应操作区域', '');
                } else {
                    notify.warning('未找到对应界面元素，请先展开相应功能区', '');
                }
            }, 100);
        } else if (url === 'action://open-recharge') {
            setShowRechargeModal(true);
        } else if (url === 'action://open-library') {
            if (props.openLibrarySurface) props.openLibrarySurface();
        } else if (url === 'action://open-favorites') {
            if (props.openFavoritesSurface) props.openFavoritesSurface();
        } else if (url === 'action://open-profile') {
            if (props.openProfileSurface) props.openProfileSurface('main');
        } else if (url === 'action://open-workspace') {
            if (props.focusWorkspace) props.focusWorkspace();
        } else if (url === 'action://open-admin') {
            window.history.pushState(null, '', '/admin');
            window.dispatchEvent(new CustomEvent('kk-app-locationchange'));
            notify.success('正在为您跳转到后台管理页面', '');
        } else if (url === 'action://open-settings-logs') {
            if (onOpenSettings) onOpenSettings('system-logs');
        } else if (url === 'action://open-settings-api') {
            if (onOpenSettings) onOpenSettings('api-management');
            // 延迟高亮智能定位到 API Key 输入框
            setTimeout(() => {
                const inputs = Array.from(document.querySelectorAll('input, textarea')) as HTMLElement[];
                const keyInput = inputs.find(el => {
                    const placeholder = el.getAttribute('placeholder') || '';
                    const id = el.getAttribute('id') || '';
                    const name = el.getAttribute('name') || '';
                    return id.toLowerCase().includes('key') || 
                           name.toLowerCase().includes('key') || 
                           placeholder.toLowerCase().includes('key') || 
                           placeholder.toLowerCase().includes('密钥') ||
                           placeholder.toLowerCase().includes('token');
                });
                const el = keyInput || document.querySelector('.settings-api-key-input') || document.querySelector('input[type="password"]');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('highlight-glow-ring');
                    el.focus();
                    setTimeout(() => {
                        el.classList.remove('highlight-glow-ring');
                    }, 3000);
                    notify.success('已为您打开设置并定位至 API 密钥输入框', '');
                } else {
                    notify.warning('已打开 API 管理，请手动在下方输入框填写密钥', '');
                }
            }, 300);
        } else if (url === 'action://open-settings') {
            if (onOpenSettings) onOpenSettings();
        } else if (url.startsWith('action://takeover-bulk-generate')) {
            let prompts: string[] = [];
            try {
                const parsedUrl = new URL(url.replace('action://', 'http://dummy'));
                const promptsParam = parsedUrl.searchParams.get('prompts') || '';
                prompts = promptsParam.split(',').map(p => p.trim()).filter(Boolean);
            } catch (err) {
                console.error('Parse takeover-bulk-generate url failed:', err);
            }

            if (prompts.length === 0) {
                notify.warning('AI 接管失败', '未解析到有效提示词');
                return;
            }

            sendTakeoverMessage(`请为以下提示词创建图片生成计划，但先不要生成，必须等待我确认：${prompts.join('，')}`);
            return;
        } else if (url.startsWith('action://takeover-locate')) {
            let keyword = '';
            try {
                const parsedUrl = new URL(url.replace('action://', 'http://dummy'));
                keyword = (parsedUrl.searchParams.get('keyword') || '').trim();
            } catch (err) {
                console.error('Parse takeover-locate url failed:', err);
            }

            if (!keyword) {
                notify.warning('AI接管定位失败', '未指定要查找的关键字');
                return;
            }

            // 搜索匹配卡片
            const nodes = activeCanvas?.promptNodes || [];
            const matchedNode = nodes.find(n => 
                (n.prompt || '').toLowerCase().includes(keyword.toLowerCase()) ||
                (n.optimizedPromptEn || '').toLowerCase().includes(keyword.toLowerCase()) ||
                (n.optimizedPromptZh || '').toLowerCase().includes(keyword.toLowerCase())
            );

            if (matchedNode) {
                // 触发定位事件，交由 App.tsx 处理平滑平移和高亮闪烁
                const locateEvent = new CustomEvent('canvas-center-on-node', {
                    detail: {
                        x: matchedNode.position.x,
                        y: matchedNode.position.y,
                        nodeId: matchedNode.id
                    }
                });
                window.dispatchEvent(locateEvent);
                notify.success(`AI接管：已为您平滑定位到包含“${keyword}”的卡片`, '');
            } else {
                notify.warning('AI接管定位', `未在当前画布上找到包含“${keyword}”的卡片`);
            }
        }
    }, [onOpenSettings, setShowRechargeModal, addPromptNode, getNextCardPosition, selectedModel, executeGeneration, activeCanvas]);

    // 简体中文：解析 action 链接，生成交互按钮
    const renderMessageContent = useCallback((content: string) => {
        const regex = /\[([^\]]+)\]\((action:\/\/[^\)]+)\)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }

            const label = match[1];
            const actionUrl = match[2];

            parts.push(
                <button
                    type="button"
                    key={match.index}
                    onClick={() => handleActionClick(actionUrl)}
                    data-agent-action={AGENT_CONTROL_ACTIONS.runInlineActionLink.uiAction}
                    className="inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-pink-500 hover:brightness-110 active:scale-95 transition-all shadow-[0_2px_8px_rgba(99,102,241,0.3)] select-none cursor-pointer"
                >
                    ✨ {label}
                </button>
            );

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return parts.length > 0 ? parts : content;
    }, [handleActionClick]);

    const billingUiEnabled = KKAI_FEATURE_FLAGS.billing;
    const canAccessSystemCreditModels = billingUiEnabled && !!user && !isTempUser;
    const canBrowseSystemCreditModels = billingUiEnabled;
    const { availableModels, setAvailableModels } = useChatModelCatalog({
        canBrowseSystemCreditModels,
        onSelectedModelChange: ctxSetSelectedModel,
        selectedModel,
        setSelectedModel,
    });

    // 1. Model State Management
    // selectedModel, setSelectedModel 已由 props 传入
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [modelMenuLoadingState, setModelMenuLoadingState] = useState<ModelMenuLoadingState>('idle');
    const [modelSearch, setModelSearch] = useState('');
    const deferredModelSearch = useDeferredValue(modelSearch);
    const modelMenuButtonRef = useRef<HTMLButtonElement>(null);
    const modelMenuRequestRef = useRef(0);
    const [modelMenuLayout, setModelMenuLayout] = useState<{ left: number; bottom: number; width: number } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, modelId: string } | null>(null);
    const [sessionContextMenu, setSessionContextMenu] = useState<SessionContextMenu | null>(null);
    const [pinnedUpdate, setPinnedUpdate] = useState(0); // Trigger re-render for sorting

    // [NEW] Model Customizations (read from localStorage)
    const [modelCustomizations, setModelCustomizations] = useState<Record<string, { alias?: string; description?: string }>>(() => {
        try {
            const stored = localStorage.getItem('kk_model_customizations');
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    });

    // Listen for storage changes (to sync with PromptBar updates)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'kk_model_customizations' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    setModelCustomizations(parsed && typeof parsed === 'object' ? parsed : {});
                } catch {
                    setModelCustomizations({});
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        // Also poll/check on focus in case change happened in same window but different component
        const handleFocus = () => {
            try {
                const stored = localStorage.getItem('kk_model_customizations');
                if (stored) setModelCustomizations(JSON.parse(stored));
            } catch { }
        };
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    useEffect(() => {
        // Close menu on click anywhere
        const closeMenu = () => {
            setContextMenu(null);
            setSessionContextMenu(null);
        };
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const updateModelMenuLayout = useCallback(() => {
        const btn = modelMenuButtonRef.current;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const viewportPadding = 8;
        const menuWidth = Math.min(360, Math.max(280, window.innerWidth - viewportPadding * 2));
        const alignedLeft = rect.right - menuWidth;
        const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
        const left = Math.min(Math.max(viewportPadding, alignedLeft), maxLeft);
        const bottom = Math.max(viewportPadding, window.innerHeight - rect.top + 8);

        setModelMenuLayout({ left, bottom, width: menuWidth });
    }, []);

    useEffect(() => {
        if (!showModelMenu) return;

        updateModelMenuLayout();
        const onReposition = () => updateModelMenuLayout();

        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);

        return () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [showModelMenu, updateModelMenuLayout]);

    const getRequiredCredits = useCallback((model?: ChatModel | null) => {
        if (!model?.isSystemInternal) return 0;
        return Math.max(0, Number(getModelCredits(model.id) || 0));
    }, []);

    const ensureModelAccess = useCallback((model: ChatModel | undefined | null, feature: string) => {
        if (!model?.isSystemInternal) {
            return true;
        }

        if (!billingUiEnabled) {
            notify.error('本地版已禁用积分模型', `KKAI 本地版不提供管理员积分模型${feature}入口。`);
            return false;
        }

        if (authLoading) {
            notify.info('账号状态确认中', '正在校验登录状态，请稍后再试。');
            return false;
        }

        if (!canAccessSystemCreditModels) {
            notify.error('请先登录', `管理员配置的积分模型需要登录账号后使用积分才能${feature}。`);
            return false;
        }

        const requiredCredits = getRequiredCredits(model);
        if (requiredCredits > 0 && balance < requiredCredits) {
            notify.error('积分不足', `使用当前管理员模型${feature}需要 ${requiredCredits} 积分，当前余额: ${remainingBalanceDisplay}，请充值。`);
            setShowRechargeModal(true);
            return false;
        }

        return true;
    }, [authLoading, balance, billingUiEnabled, canAccessSystemCreditModels, getRequiredCredits, setShowRechargeModal]);

    const [importPreview, setImportPreview] = useState<SessionImportPreview | null>(null);
    const [importPreviewSearch, setImportPreviewSearch] = useState('');
    const [importPreviewShowAll, setImportPreviewShowAll] = useState(false);
    const [importExcludedIds, setImportExcludedIds] = useState<string[]>([]);
    const [importPreviewOnlyExcluded, setImportPreviewOnlyExcluded] = useState(false);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sessionImportRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [mentionState, setMentionState] = useState<{
        open: boolean;
        query: string;
        start: number;
        end: number;
        anchor?: ReferenceMentionAnchor;
    }>({ open: false, query: '', start: 0, end: 0 });
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [isDropActive, setIsDropActive] = useState(false);

    // 3. Layout State
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const saved = localStorage.getItem('kk_chat_width');
        return normalizeAssistantSidebarWidth(saved ?? KK_LAYOUT.workspace.assistantSidebarDefaultWidth);
    });

    // 🚀 Sync width to parent in real-time during live resize drag
    useEffect(() => {
        if (onWidthChange) {
            onWidthChange(sidebarWidth);
        }
    }, [sidebarWidth, onWidthChange]);

    // 简体中文：AI 协作模式与侧边栏宽度联动，辅助/接管为上下文面板保留稳定宽度。
    useEffect(() => {
        if (isAgentCollaboration) {
            setSidebarWidth(KK_LAYOUT.workspace.assistantSidebarTakeoverWidth);
        } else {
            const saved = localStorage.getItem('kk_chat_width');
            setSidebarWidth(normalizeAssistantSidebarWidth(saved ?? KK_LAYOUT.workspace.assistantSidebarDefaultWidth));
        }
    }, [isAgentCollaboration]);


    // 4. Drag State (must be declared before scheduleAutoClose uses it)
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const startPosRef = useRef({ x: 0, y: 0 });

    // 简体中文：侧边栏宽度拉伸调整相关状态与 Refs
    const [isResizing, setIsResizing] = useState(false);
    const dragStartWidthRef = useRef<number>(KK_LAYOUT.workspace.assistantSidebarDefaultWidth);
    const dragStartXRef = useRef(0);
    const resizeMaskRef = useRef<HTMLDivElement | null>(null);

    // [NEW] History Panel State
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);

    // Track keyboard visibility using visualViewport API
    useEffect(() => {
        if (!isMobile) return;

        const handleViewportResize = () => {
            const vv = window.visualViewport;
            if (vv) {
                const heightDiff = window.innerHeight - vv.height;
                setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
            }
        };

        window.visualViewport?.addEventListener('resize', handleViewportResize);
        window.visualViewport?.addEventListener('scroll', handleViewportResize);

        return () => {
            window.visualViewport?.removeEventListener('resize', handleViewportResize);
            window.visualViewport?.removeEventListener('scroll', handleViewportResize);
        };
    }, [isMobile]);

    // 自动收起逻辑（5分钟全局页面无操作自动关闭）
    const [isHovering, setIsHovering] = useState(false);
    const lastActivityRef = useRef<number>(Date.now());
    const autoCloseTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const clearAutoClose = useCallback(() => {
        if (autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
        }
    }, []);

    const closeChat = useCallback(() => {
        if (onClose) {
            onClose();
        } else {
            onToggle();
        }
    }, [onClose, onToggle]);

    const scheduleAutoClose = useCallback(() => {
        clearAutoClose();
        if (!isOpen || isDragging || isResizing) return;
        
        // 5分钟无任何页面活动自动收纳 (300,000 毫秒)
        const timeoutMs = 300000;
        const elapsed = Date.now() - lastActivityRef.current;
        const delay = Math.max(timeoutMs - elapsed, 0);
        
        autoCloseTimerRef.current = window.setTimeout(() => {
            if (isOpen) closeChat();
        }, delay) as any;
    }, [clearAutoClose, closeChat, isDragging, isResizing, isOpen]);

    const registerActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        scheduleAutoClose();
    }, [scheduleAutoClose]);

    // 全局页面活动检测监听
    useEffect(() => {
        if (!isOpen) return;

        const handleActivity = () => {
            registerActivity();
        };

        // 监听全局各类用户活动事件以进行页面活跃状态判定
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('mousedown', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('scroll', handleActivity, true);
        window.addEventListener('touchstart', handleActivity);

        // 首次激活时开始定时计算
        registerActivity();

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('mousedown', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('scroll', handleActivity, true);
            window.removeEventListener('touchstart', handleActivity);
            clearAutoClose();
        };
    }, [isOpen, registerActivity, clearAutoClose]);

    const closeModelMenu = useCallback(() => {
        modelMenuRequestRef.current += 1;
        setModelMenuLoadingState('idle');
        setShowModelMenu(false);
    }, []);

    const handleToggleModelMenu = useCallback(async () => {
        registerActivity();

        if (showModelMenu) {
            closeModelMenu();
            return;
        }

        updateModelMenuLayout();
        const requestId = modelMenuRequestRef.current + 1;
        modelMenuRequestRef.current = requestId;
        setShowModelMenu(true);
        let nextAvailableModels = availableModels;
        const hasCachedModels = nextAvailableModels.length > 0;
        setModelMenuLoadingState(hasCachedModels ? 'refreshing_with_cache' : 'bootstrapping_without_cache');

        const applyRefreshedModels = (models: ChatModel[]) => {
            setAvailableModels(models);

            const matchedSelectedModel = models.find(model => model.id === selectedModel.id);
            if (!matchedSelectedModel) {
                setSelectedModel(models[0]);
                return;
            }

            if (
                matchedSelectedModel.name !== selectedModel.name
                || matchedSelectedModel.description !== selectedModel.description
            ) {
                setSelectedModel(matchedSelectedModel);
            }
        };

        if (hasCachedModels) {
            void refreshModelLibraryData({ force: false })
                .then(() => {
                    if (modelMenuRequestRef.current !== requestId) {
                        return;
                    }

                    nextAvailableModels = buildAvailableChatModels(canBrowseSystemCreditModels);
                    if (nextAvailableModels.length > 0) {
                        applyRefreshedModels(nextAvailableModels);
                    }
                    setModelMenuLoadingState('idle');
                })
                .catch((error) => {
                    console.warn('[ChatSidebar] Background model library refresh failed:', error);
                    if (modelMenuRequestRef.current !== requestId) {
                        return;
                    }

                    setModelMenuLoadingState('idle');
                });
            return;
        }

        try {
            await refreshModelLibraryData({ force: nextAvailableModels.length === 0 });
        } catch (error) {
            console.warn('[ChatSidebar] Model library refresh failed before menu open:', error);
        }

        if (modelMenuRequestRef.current !== requestId) {
            return;
        }

        nextAvailableModels = buildAvailableChatModels(canBrowseSystemCreditModels);

        if (nextAvailableModels.length === 0) {
            setModelMenuLoadingState('idle');
            setShowModelMenu(false);
            onOpenSettings?.('api-management');
            return;
        }

        applyRefreshedModels(nextAvailableModels);
        setModelMenuLoadingState('idle');
    }, [
        availableModels,
        canBrowseSystemCreditModels,
        closeModelMenu,
        onOpenSettings,
        registerActivity,
        selectedModel.description,
        selectedModel.id,
        selectedModel.name,
        showModelMenu,
        updateModelMenuLayout,
    ]);

    useEffect(() => {
        if (!isOpen) {
            clearAutoClose();
            return;
        }
        lastActivityRef.current = Date.now();
        scheduleAutoClose();
        return clearAutoClose;
    }, [isOpen, scheduleAutoClose, clearAutoClose]);

    // Cleanup timer on unmount or when closed
    useEffect(() => {
        return () => {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen && autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = null;
        }
    }, [isOpen]);

    // Draggable Position State (Default Right-Bottom)
    const [position, setPosition] = useState(() => {
        // Clear old position and use new default
        localStorage.removeItem('kk_chat_pos');

        if (isMobile) {
            return { x: 20, y: (window.innerHeight - 180) };
        }
        // Fixed position: 24px from right and bottom
        return { x: window.innerWidth - 24 - 64, y: window.innerHeight - 24 - 64 };
    });

    useEffect(() => {
        localStorage.setItem('kk_chat_pos', JSON.stringify(position));
    }, [position]);

    const lastAssistantIndex = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') return i;
        }
        return -1;
    }, [messages]);

    const pinnedModels = useMemo(() => getPinnedModels(), [pinnedUpdate]);

    const filteredModelMenuItems = useMemo<ChatSidebarModelMenuItem[]>(() => {
        return filterAndSortModels(availableModels, deferredModelSearch, modelCustomizations).map((model: ChatModel) => {
            const custom = modelCustomizations[model.id] || {};
            return {
                ...model,
                displayName: custom.alias || model.name || model.id,
                displayInfo: getModelDisplayInfo(model),
                advantage: custom.description || model.description || (model.provider ? `${model.provider} 模型` : '自定义模型'),
                isPinned: pinnedModels.includes(model.id),
            };
        });
    }, [availableModels, deferredModelSearch, modelCustomizations, pinnedModels]);
    const isModelMenuBootstrapping = modelMenuLoadingState === 'bootstrapping_without_cache';
    const isModelMenuRefreshingWithCache = modelMenuLoadingState === 'refreshing_with_cache';

    const handleSelectModelFromMenu = useCallback((model: ChatSidebarModelMenuItem) => {
        setSelectedModel(model);
        closeModelMenu();
        setModelSearch('');
    }, [closeModelMenu]);

    const handleModelContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>, modelId: string) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, modelId });
    }, []);

    const lastSessionIdRef = useRef(activeSessionId);
    const activeMessages = chatMessages;

    const activeIsThinking = isAgentCollaboration ? takeoverIsThinking : isThinking;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        const isSessionSwitch = lastSessionIdRef.current !== activeSessionId;
        lastSessionIdRef.current = activeSessionId;

        if (isSessionSwitch) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeMessages, isOpen, activeSessionId]);

    // Cleanup drag listeners
    useEffect(() => {
        let rafId: number | null = null;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            // Cancel previous animation frame
            if (rafId) {
                cancelAnimationFrame(rafId);
            }

            // Throttle using requestAnimationFrame for smooth dragging
            rafId = requestAnimationFrame(() => {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;

                setPosition({
                    x: Math.max(0, Math.min(window.innerWidth - 64, startPosRef.current.x + dx)),
                    y: Math.max(0, Math.min(window.innerHeight - 64, startPosRef.current.y + dy))
                });
            });
        };

        const handleMouseUp = () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // 简体中文：侧边栏拉伸宽度全局拖拽与释放逻辑（透明遮罩层防穿透 iframe 与 canvas）
    useEffect(() => {
        if (!isResizing) return;

        // 创建全屏透明遮罩层，防止鼠标移入 iframe 或 canvas 时无法释放
        const mask = document.createElement('div');
        mask.style.position = 'fixed';
        mask.style.top = '0';
        mask.style.left = '0';
        mask.style.width = '100vw';
        mask.style.height = '100vh';
        mask.style.zIndex = '999999';
        mask.style.cursor = 'ew-resize';
        mask.style.backgroundColor = 'transparent';
        document.body.appendChild(mask);
        resizeMaskRef.current = mask;

        // 锁定全局光标和禁止拖动文本选中
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';

        let rafId: number | null = null;

        const handleMouseMove = (e: MouseEvent) => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const deltaX = dragStartXRef.current - e.clientX;
                const newWidth = normalizeAssistantSidebarWidth(dragStartWidthRef.current + deltaX);
                setSidebarWidth(newWidth);
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            const deltaX = dragStartXRef.current - e.clientX;
            const newWidth = normalizeAssistantSidebarWidth(dragStartWidthRef.current + deltaX);
            localStorage.setItem('kk_chat_width', newWidth.toString());
            setIsResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (mask.parentNode) {
                mask.parentNode.removeChild(mask);
            }
            resizeMaskRef.current = null;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizing]);

    const appendFilesAsAttachments = useCallback(async (files: File[]) => {
        if (!files || files.length === 0) return;

        const newAttachments: Attachment[] = [];
        for (const file of files) {
            const reader = new FileReader();
            const attachment = await new Promise<Attachment>((resolve) => {
                reader.onloadend = () => {
                    let type: Attachment['type'] = 'document';
                    if (file.type.startsWith('image/')) type = 'image';
                    else if (file.type.startsWith('video/')) type = 'video';
                    else if (file.type.startsWith('audio/')) type = 'audio';

                    resolve({
                        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                        type,
                        name: file.name,
                        data: reader.result as string,
                        mimeType: file.type,
                        size: file.size
                    });
                };
                reader.readAsDataURL(file);
            });
            newAttachments.push(attachment);
        }

        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
            registerActivity();
        }
    }, [registerActivity]);

    const closeReferenceMentionPanel = useCallback(() => {
        setMentionState(prev => prev.open ? { ...prev, open: false, query: '' } : prev);
    }, []);

    const updateReferenceMentionFromTextarea = useCallback((target: HTMLTextAreaElement) => {
        const value = target.value;
        const caret = target.selectionStart ?? value.length;
        const beforeCaret = value.slice(0, caret);
        const atIndex = beforeCaret.lastIndexOf('@');

        if (atIndex < 0) {
            closeReferenceMentionPanel();
            return;
        }

        const token = beforeCaret.slice(atIndex + 1);
        if (/[\s,，。；;:：()[\]{}<>]/.test(token)) {
            closeReferenceMentionPanel();
            return;
        }

        setMentionState({
            open: true,
            query: token,
            start: atIndex,
            end: caret,
            anchor: computeReferenceMentionAnchor(target, atIndex),
        });
    }, [closeReferenceMentionPanel]);

    const resolveAttachmentType = useCallback((mimeType?: string): Attachment['type'] => {
        const value = String(mimeType || '').toLowerCase();
        if (value.startsWith('image/')) return 'image';
        if (value.startsWith('video/')) return 'video';
        if (value.startsWith('audio/')) return 'audio';
        return 'document';
    }, []);

    const addCandidateAsAssistantAttachment = useCallback(async (candidate?: ReferenceMentionCandidate) => {
        if (!candidate) return;

        const asset = candidate.assistantAsset;
        if (asset?.kind === 'file' && asset.sensitive) {
            notify.warning('Sensitive file blocked', candidate.name);
            return;
        }

        if (asset?.localFile) {
            await appendFilesAsAttachments([asset.localFile]);
            return;
        }

        const data = candidate.referenceImage?.url
            || candidate.referenceImage?.data
            || candidate.previewUrl
            || candidate.originalUrl
            || candidate.apiResultUrl
            || candidate.url
            || (asset?.kind === 'file' ? asset.uploadedUrl || asset.id : undefined)
            || candidate.id;

        const attachment: Attachment = {
            id: `mention_${candidate.id}_${Date.now()}`,
            type: resolveAttachmentType(candidate.mimeType),
            name: candidate.name,
            data,
            mimeType: candidate.mimeType,
            size: asset?.size,
        };

        setAttachments(prev => {
            const duplicate = prev.some((item) => item.name === attachment.name && item.data === attachment.data);
            return duplicate ? prev : [...prev, attachment];
        });
        registerActivity();
    }, [appendFilesAsAttachments, registerActivity, resolveAttachmentType]);

    const applyAssistantInputChange = useCallback((nextValue: string, caret?: number) => {
        setInput(nextValue);
        window.requestAnimationFrame(() => {
            const textarea = inputRef.current;
            if (!textarea) return;
            textarea.focus();
            if (typeof caret === 'number') {
                textarea.setSelectionRange(caret, caret);
            }
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
        });
    }, []);

    const insertAssistantComposerPayload = useCallback((payload: MentionReferencePayload) => {
        const text = payload.text || '';
        if (!text) return;

        const textarea = inputRef.current;
        const current = textarea?.value ?? input;
        const start = textarea?.selectionStart ?? current.length;
        const end = textarea?.selectionEnd ?? start;
        const nextValue = `${current.slice(0, start)}${text}${current.slice(end)}`;
        const caret = start + text.length;

        applyAssistantInputChange(nextValue, caret);
        void addCandidateAsAssistantAttachment(payload.candidate);
    }, [addCandidateAsAssistantAttachment, applyAssistantInputChange, input]);

    useEffect(() => favoriteComposerRegistry.register({
        id: 'assistant',
        label: 'AI assistant',
        insert: insertAssistantComposerPayload,
        focus: () => inputRef.current?.focus(),
        addAssistantAttachment: addCandidateAsAssistantAttachment,
    }), [addCandidateAsAssistantAttachment, insertAssistantComposerPayload]);

    const replaceActiveMentionWithCandidate = useCallback((candidate: ReferenceMentionCandidate) => {
        const current = inputRef.current?.value ?? input;
        const start = Math.max(0, mentionState.start);
        const end = Math.max(start, mentionState.end);
        const mentionText = candidate.mentionText || `@${candidate.name}`;
        const rawPrefix = current.slice(0, start);
        const rawSuffix = current.slice(end);
        const prefix = rawPrefix && !/[\s(（,，:：]$/.test(rawPrefix) ? `${rawPrefix} ` : rawPrefix;
        const suffixSpacer = rawSuffix && !/^[\s,，。；;:：)\]）]/.test(rawSuffix) ? ' ' : '';
        const nextValue = `${prefix}${mentionText}${suffixSpacer}${rawSuffix}`;
        const caret = prefix.length + mentionText.length + suffixSpacer.length;

        setMentionState(prev => ({ ...prev, open: false, query: '' }));
        applyAssistantInputChange(nextValue, caret);
        void addCandidateAsAssistantAttachment(candidate);
    }, [addCandidateAsAssistantAttachment, applyAssistantInputChange, input, mentionState.end, mentionState.start]);

    // 处理文档选择
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        await appendFilesAsAttachments(files);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleInputPaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboard = e.clipboardData;
        if (!clipboard) return;

        const dedupeFiles = (files: File[]): File[] => {
            const map = new Map<string, File>();
            files.forEach(file => {
                const key = `${file.name}::${file.type}::${file.size}::${file.lastModified}`;
                if (!map.has(key)) {
                    map.set(key, file);
                }
            });
            return Array.from(map.values());
        };

        const fromFiles = Array.from(clipboard.files || []);
        const fromItems = Array.from(clipboard.items || [])
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter((f): f is File => !!f);

        const merged = dedupeFiles([...fromFiles, ...fromItems]);
        if (merged.length === 0) return;

        e.preventDefault();
        await appendFilesAsAttachments(merged);
        notify.success('已添加参考附件', `粘贴导入 ${merged.length} 个文档`);
    }, [appendFilesAsAttachments]);

    const handleDropToAttach = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDropActive(false);

        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length === 0) return;

        await appendFilesAsAttachments(files);
        notify.success('已添加参考附件', `拖拽导入 ${files.length} 个文档`);
    }, [appendFilesAsAttachments]);

    // 删除附件
    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // ✨ 图片生成逻辑（支持参考图编辑）
    const handleImageGeneration = async (prompt: string, refs: Attachment[] = [], editMode?: 'edit') => {
        setIsThinking(true);
        registerActivity();

        try {
            // 1. 查找可用的绘图模型
            const allModels = availableModels;

            // 🚀 Use Selected Model if it supports image generation
            let imageModel = allModels.find(m => m.id === selectedModel.id && (m.type === 'image' || m.type === 'image+chat'));

            // Fallback strategy
            if (!imageModel) {
                imageModel = allModels.find(m => m.type === 'image' && !m.id.includes('video')) ||
                    allModels.find(m => m.id.includes('imagen')) ||
                    allModels.find(m => m.id.includes('stable-diffusion') || m.id.includes('flux')) ||
                    allModels.find(m => m.type === 'image+chat' && m.id.includes('gemini'));
            }

            if (!imageModel) {
                throw new Error("未找到可用的绘图模型，请在设置中添加支持绘图的模型 (如 Imagen 3/4, Gemini Flash Image等)");
            }

            if (!ensureModelAccess(imageModel, '生成图片')) {
                return;
            }

            const referenceImages = refs
                .filter(a => a.type === 'image' && a.data.startsWith('data:'))
                .map((a) => {
                    const matched = a.data.match(/^data:([^;]+);base64,(.+)$/);
                    if (!matched) return null;
                    return {
                        id: a.id,
                        data: matched[2],
                        mimeType: matched[1]
                    };
                })
                .filter(Boolean) as Array<{ id: string; data: string; mimeType: string }>;

            const lowerModelId = (imageModel.id || '').toLowerCase();
            let targetSize: ImageSize = ImageSize.SIZE_1K;
            if (lowerModelId.includes('4k') || lowerModelId.includes('gemini-3-pro-image-preview') || lowerModelId.includes('nano-banana-pro')) {
                targetSize = ImageSize.SIZE_4K;
            } else if (lowerModelId.includes('2k')) {
                targetSize = ImageSize.SIZE_2K;
            }

            // 2. 调用生成服务
            const result = await generateImageOnDemand(
                prompt,
                AspectRatio.SQUARE, // 默认方形
                targetSize,
                referenceImages as any,
                imageModel.id as any,
                '', // apiKey auto-resolved
                undefined,
                false,
                editMode ? { editMode } : undefined
            );

            if (result.referenceImagesDropped && result.referenceImagesDropped > 0) {
                notify.warning(
                    '参考图已自动裁剪',
                    `本次实际使用 ${result.referenceImagesUsed || 0} 张参考图，忽略 ${result.referenceImagesDropped} 张`
                );
            }

            const sourceLines = (result.groundingSources || []).slice(0, 5).map((src, idx) => {
                const title = src.title || src.uri;
                return `${idx + 1}. ${title}\n${src.uri}`;
            });
            const sourceText = sourceLines.length > 0
                ? `\n\n🔎 来源参考:\n${sourceLines.join('\n')}`
                : '';

            // 3. 构建结果消息
            const actionLabel = editMode ? '修改图片' : '生成图片';
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `✨ 已为您${actionLabel}: "${prompt}" (使用模型: ${imageModel.name})${sourceText}`,
                timestamp: Date.now(),
                isImageGeneration: true,
                attachments: [{
                    id: Date.now().toString(),
                    type: 'image',
                    name: `generated-${Date.now()}.png`,
                    data: result.url,
                    mimeType: 'image/png'
                }]
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error: any) {
            console.error('Image Generation Error:', error);
            notify.error('图片生成失败', error.message);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `⚠️ 图片生成失败: ${error.message}`,
                timestamp: Date.now()
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || activeIsThinking) return;

        const userText = input.trim();
        const hasKeys = keyManager.hasValidKeys();

        if (collaborationMode !== 'direct') {
            setInput('');
            setAttachments([]);
            const sessionBinding = resolveChatAgentRunSessionId({
                session: activeSession, collaborationMode, maxTokens,
            });
            await sendTakeoverMessage(userText, sessionBinding);
            return;
        }

        if (!ensureModelAccess(selectedModel, '进行对话')) return;

        // ✨ 检查是否为生成图片指令
        // Regex: /image prompt OR 画 prompt OR 生成 prompt OR 画猫
        const imageRegex = /^(\/image|画|生成|draw|gen)[\s]*(.+)/i;
        const match = userText.match(imageRegex);

        const currentAttachments = [...attachments]; // 保存当前附件

        // 🚀 多模态能力预检与拦截
        const hasMultimodalAttachment = currentAttachments.some(
            att => att.type === 'image' || att.type === 'video'
        );
        if (hasMultimodalAttachment && !selectedModel.isVision) {
            notify.error(
                '模型不支持多模态',
                `当前模型 "${selectedModel.name || selectedModel.id}" 不支持图片或视频输入。请切换至支持 Vision 的模型（如 Gemini 2.0 Flash / GPT-4o / Claude 3.5 Sonnet 等）后再试。`
            );
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: userText || '(附件)',
            timestamp: Date.now(),
            attachments: currentAttachments.length > 0 ? currentAttachments : undefined
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setAttachments([]); // 清空附件

        // 如果匹配到绘图指令，且没有附件(普通模式)，则走绘图流程
        if (match && currentAttachments.length === 0) {
            const prompt = match[2];
            handleImageGeneration(prompt);
            return;
        }

        // 🚀 Guard: Pure Image Models cannot chat
        if (selectedModel.type === 'image') {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `⚠️ "${getModelDisplayInfo(selectedModel).displayName}" 是纯绘图模型，不支持文本对话。\n\n请尝试输入 "/image ${userText}" 来生成图片。`,
                timestamp: Date.now()
            }]);
            return;
        }

        setIsThinking(true);
        registerActivity();

        const assistantMsgId = `assistant_${Date.now()}`;
        setMessages(prev => [...prev, {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            modelId: selectedModel.id
        }]);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            // 过滤分界线前的消息
            let boundaryIndex = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].content.includes('上下文压缩分界线')) {
                    boundaryIndex = i;
                    break;
                }
            }
            const filteredMsgs = boundaryIndex !== -1 ? messages.slice(boundaryIndex) : messages;

            // 构建历史记录
            const history = filteredMsgs
                .filter(m => m.id !== 'welcome')
                .map(m => ({ role: m.role, content: m.content }));

            const { messageContent, inlineData } = buildMessageWithAttachments(userText, currentAttachments);

            history.push({ role: 'user', content: messageContent });

            // 调用API (传递附件数据)
            const responseText = await chatWithLlm({
                modelId: selectedModel.id,
                messages: history,
                inlineData: inlineData.length > 0 ? inlineData : undefined,
                stream: false,
                preferredKeyId: resolveAssistantPreferredKeyId(),
                signal: controller.signal
            });

            const finalText = responseText || '...';
            setMessages(prev => prev.map(m => {
                if (m.id !== assistantMsgId) return m;
                return { ...m, content: finalText };
            }));

            import('../../services/billing/costService').then(({ recordCost }) => {
                const fullText = history.map(m => m.content).join('') + userText + responseText;
                recordCost(
                    selectedModel.id as any,
                    '1K' as any,
                    0,
                    fullText
                );
            });

        } catch (error: any) {
            console.error('Chat Error:', error);
            const isAborted = error?.name === 'AbortError';
            if (!isAborted) {
                notify.error('AI 生成失败', error.message || '请检查网络或 API Key');
            }

            setMessages(prev => prev.map(m => {
                if (m.id !== assistantMsgId) return m;
                if (isAborted) {
                    return { ...m, content: m.content || '⏹️ 已停止生成' };
                }
                return { ...m, content: `⚠️ 出错了: ${error.message || '未知错误'}` };
            }));
        } finally {
            abortControllerRef.current = null;
            setIsThinking(false);
        }
    };

    const handleStopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    const handleEditResend = useCallback((msg: Message) => {
        if (msg.role !== 'user') return;
        setInput(msg.content === '(附件)' ? '' : msg.content);
        setAttachments(msg.attachments || []);
        setTimeout(() => {
            inputRef.current?.focus();
            const v = inputRef.current?.value || '';
            inputRef.current?.setSelectionRange(v.length, v.length);
        }, 0);
    }, []);

    const handleCopyMessage = useCallback(async (msg: Message) => {
        const text = (msg.content || '').trim();
        if (!text) return;
        try {
            await writeTextToClipboard(text);
            setCopiedMessageId(msg.id);
            setTimeout(() => {
                setCopiedMessageId(prev => (prev === msg.id ? null : prev));
            }, 1200);
        } catch {
            notify.warning('复制失败', '当前环境不支持剪贴板写入');
        }
    }, []);

    const handleEditFromAssistant = useCallback((assistantMessageId: string) => {
        const assistantIndex = messages.findIndex(m => m.id === assistantMessageId);
        if (assistantIndex < 0) return;
        for (let i = assistantIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                handleEditResend(messages[i]);
                return;
            }
        }
        notify.warning('未找到可编辑的上一条提问', '请直接输入新的内容');
    }, [handleEditResend, messages]);

    const handleBranchFrom = useCallback((index: number) => {
        const forkBase = messages.slice(0, index + 1);
        if (forkBase.length === 0) return;

        const branchSession = createBranchSession(messages, index, activeSessionId);
        setSessions(prev => [branchSession, ...prev]);
        setActiveSessionId(branchSession.id);
        setInput('');
        setAttachments([]);
        notify.success('已创建分支会话', '可以在新分支继续对话');
    }, [activeSessionId, messages]);

    const handleRegenerateAssistant = useCallback(async (assistantId: string) => {
        if (isThinking) return;
        if (!ensureModelAccess(selectedModel, '进行对话')) return;

        const assistantIndex = messages.findIndex(m => m.id === assistantId);
        if (assistantIndex < 0) return;

        let userIndex = -1;
        for (let i = assistantIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                userIndex = i;
                break;
            }
        }
        if (userIndex < 0) return;

        const userMsg = messages[userIndex];
        const sourceText = userMsg.content === '(附件)' ? '' : userMsg.content;
        const sourceAttachments = userMsg.attachments || [];
        const { messageContent, inlineData } = buildMessageWithAttachments(sourceText, sourceAttachments);

        let boundaryIndex = -1;
        for (let i = userIndex - 1; i >= 0; i--) {
            if (messages[i].content.includes('上下文压缩分界线')) {
                boundaryIndex = i;
                break;
            }
        }
        const filteredMsgs = boundaryIndex !== -1 ? messages.slice(boundaryIndex, userIndex) : messages.slice(0, userIndex);

        const history = filteredMsgs
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content }));

        history.push({ role: 'user', content: messageContent });

        setIsThinking(true);
        registerActivity();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: '', modelId: selectedModel.id } : m)));

        try {
            const responseText = await chatWithLlm({
                modelId: selectedModel.id,
                messages: history,
                inlineData: inlineData.length > 0 ? inlineData : undefined,
                stream: false,
                preferredKeyId: resolveAssistantPreferredKeyId(),
                signal: controller.signal
            });

            const finalText = responseText || '...';
            setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: finalText } : m)));
        } catch (error: any) {
            const isAborted = error?.name === 'AbortError';
            if (!isAborted) {
                notify.error('重新生成失败', error.message || '请检查网络或 API Key');
            }
            setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                return { ...m, content: isAborted ? (m.content || '⏹️ 已停止生成') : `⚠️ 出错了: ${error.message || '未知错误'}` };
            }));
        } finally {
            abortControllerRef.current = null;
            setIsThinking(false);
        }
    }, [ensureModelAccess, isThinking, messages, registerActivity, resolveAssistantPreferredKeyId, selectedModel]);

    const handleClearCurrentSession = useCallback(() => {
        const welcomeMsg = createWelcomeMessage();
        setMessages([welcomeMsg]);
        setInput('');
        setAttachments([]);
        setSessions(prev => prev.map(session => {
            if (session.id !== activeSessionId) return session;
            return {
                ...session,
                messages: [welcomeMsg],
                agentSummary: undefined,
                updatedAt: Date.now()
            };
        }));
    }, [activeSessionId]);

    const handleNewTempSession = useCallback(() => {
        sessionStorage.removeItem(TEMP_SESSION_STORAGE_KEY);
        const tempSession = createTemporaryChatSession();
        setSessions(prev => [tempSession, ...prev.filter(s => s.id !== TEMP_SESSION_ID)]);
        setActiveSessionId(TEMP_SESSION_ID);
        setInput('');
        setAttachments([]);
    }, []);

    const handleNewSession = useCallback(() => {
        const item = createNewChatSession();
        const id = item.id;
        setSessions(prev => [item, ...prev.filter(s => s.id !== TEMP_SESSION_ID)]);
        setActiveSessionId(id);
        setInput('');
        setAttachments([]);
        sessionStorage.removeItem(TEMP_SESSION_STORAGE_KEY);
    }, []);

    const handleSwitchSession = useCallback((id: string) => {
        if (id === activeSessionId) return;
        setActiveSessionId(id);
        setInput('');
        setAttachments([]);
        if (id !== TEMP_SESSION_ID) {
            setSessions(prev => prev.filter(s => s.id !== TEMP_SESSION_ID));
            sessionStorage.removeItem(TEMP_SESSION_STORAGE_KEY);
        }
    }, [activeSessionId]);

    const handleDeleteSession = useCallback((id: string) => {
        if (sessions.length <= 1) {
            notify.warning('无法删除', '至少保留一个会话');
            return;
        }

        const next = sessions.filter(s => s.id !== id);
        setSessions(next);
        if (id === TEMP_SESSION_ID) {
            sessionStorage.removeItem(TEMP_SESSION_STORAGE_KEY);
        }
        if (activeSessionId === id) {
            setActiveSessionId(next[0].id);
        }
    }, [activeSessionId, sessions]);

    const handleRenameSession = useCallback((id: string) => {
        const target = sessions.find(s => s.id === id);
        if (!target) return;

        const renamed = window.prompt('重命名会话', target.title || '新对话');
        if (renamed === null) return;

        const title = renamed.trim() || '新对话';
        setSessions(prev => prev.map(session => {
            if (session.id !== id) return session;
            return {
                ...session,
                title,
                customTitle: true,
                updatedAt: Date.now()
            };
        }));
    }, [sessions]);

    const toggleSessionExpand = useCallback((id: string) => {
        setExpandedNodes(prev => ({
            ...prev,
            [id]: !(prev[id] ?? true)
        }));
    }, []);

    const handleToggleArchiveSession = useCallback((id: string) => {
        setSessions(prev => prev.map(session => {
            if (session.id !== id) return session;
            return {
                ...session,
                archived: !session.archived,
                updatedAt: Date.now()
            };
        }));
    }, []);

    const handleDuplicateSession = useCallback((id: string) => {
        const target = sessions.find(s => s.id === id);
        if (!target) return;
        const cloned = duplicateChatSession(target);
        setSessions(prev => [cloned, ...prev]);
        setActiveSessionId(cloned.id);
        setSessionContextMenu(null);
    }, [sessions]);

    const handleExportSessions = useCallback(() => {
        try {
            const payload = {
                version: 1,
                exportedAt: Date.now(),
                activeSessionId,
                sessions
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kk-chat-sessions-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            notify.success('导出成功', '会话已导出为 JSON');
        } catch (error: any) {
            notify.error('导出失败', error?.message || '未知错误');
        }
    }, [activeSessionId, sessions]);

    const applyImportMode = useCallback((mode: SessionImportMode) => {
        if (!importPreview) return;

        const excluded = new Set(importExcludedIds);
        const importedSessions = importPreview.sessions.filter(s => !excluded.has(s.id));
        if (importedSessions.length === 0) {
            notify.warning('没有可导入会话', '请取消部分排除项后重试');
            return;
        }

        if (mode === 'replace') {
            const next = importedSessions.slice(0, 50);
            setSessions(next);
            setActiveSessionId(importPreview.activeSessionId || next[0].id);
            setImportPreview(null);
            setImportPreviewSearch('');
            setImportPreviewShowAll(false);
            setImportExcludedIds([]);
            setImportPreviewOnlyExcluded(false);
            notify.success('导入成功', `覆盖导入 ${next.length} 个会话`);
            return;
        }

        if (mode === 'append') {
            const appendList = ensureUniqueIds(sessions, importedSessions);
            const merged = [...appendList, ...sessions].slice(0, 50);
            setSessions(merged);
            setActiveSessionId(importPreview.activeSessionId && appendList.some(s => s.id === importPreview.activeSessionId)
                ? importPreview.activeSessionId
                : appendList[0]?.id || activeSessionId);
            setImportPreview(null);
            setImportPreviewSearch('');
            setImportPreviewShowAll(false);
            setImportExcludedIds([]);
            setImportPreviewOnlyExcluded(false);
            notify.success('导入成功', `追加导入 ${appendList.length} 个会话`);
            return;
        }

        const smartMerged = mergeImportedSessions(sessions, importedSessions);
        setSessions(smartMerged);

        const preferredActive = importPreview.activeSessionId || activeSessionId;
        const hasPreferred = smartMerged.some(s => s.id === preferredActive);
        setActiveSessionId(hasPreferred ? preferredActive : smartMerged[0].id);
        setImportPreview(null);
        setImportPreviewSearch('');
        setImportPreviewShowAll(false);
        setImportExcludedIds([]);
        setImportPreviewOnlyExcluded(false);
        notify.success('导入成功', `智能合并后保留 ${smartMerged.length} 个会话`);
    }, [activeSessionId, importExcludedIds, importPreview, sessions]);

    const handleImportSessions = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                setImportPreview(parseSessionImport(String(reader.result || '{}'), sessions));
                setImportPreviewSearch('');
                setImportPreviewShowAll(false);
                setImportExcludedIds([]);
                setImportPreviewOnlyExcluded(false);
            } catch (error: any) {
                notify.error('导入失败', error?.message || 'JSON 解析失败');
            }
        };
        reader.readAsText(file, 'utf-8');
    }, [sessions]);

    return (
        <>
            {/* 侧边栏折叠时吸附在最右侧的展开按钮 */}
            {!isOpen && !isMobile && (
            <button
                onClick={onToggle}
                type="button"
                id="btn-desktop-ai-assistant"
                aria-controls="ai-assistant-sidebar"
                aria-expanded={false}
                aria-label="Open AI assistant"
                data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleSidebar.uiAction}
                className="kk-workspace-edge-toggle fixed right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-12 rounded-l-lg border-l border-t border-b transition-all group"
                    style={{
                        zIndex: KK_LAYER.drawer,
                        borderWidth: '1px 0 1px 1px',
                        borderStyle: 'solid',
                    }}
                    title="展开 AI 助手"
                >
                    <ChevronLeft size={16} className="text-[var(--text-secondary)] transition-transform group-hover:-translate-x-0.5" />
                </button>
            )}

            {/* 2. Chat Card Popover (Morph Transformation) */}
            {(isOpen || !isMobile) && (
                <div
                    id="ai-assistant-sidebar"
                    role="complementary"
                    aria-label="AI assistant"
                    aria-hidden={!isOpen}
                    inert={!isOpen ? true : undefined}
                    onMouseEnter={() => {
                        setIsHovering(true);
                        clearAutoClose();
                        onHoverChange?.(true); // 通知App组件
                    }}
                    onMouseLeave={() => {
                        setIsHovering(false);
                        scheduleAutoClose();
                        onHoverChange?.(false); // 通知App组件
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                        registerActivity();
                        e.stopPropagation();
                    }}
                    onMouseUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => {
                        // 移动端全屏模式下，阻止 touch 事件冒泡会导致子组件（按钮、输入框等）无法触发点击和触摸事件，因此在移动端严禁阻止冒泡。
                        if (!isMobile) {
                            e.stopPropagation();
                        }
                    }}
                    onTouchEnd={(e) => {
                        if (!isMobile) {
                            e.stopPropagation();
                        }
                    }}
                    onWheel={registerActivity}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape' && !event.defaultPrevented && isOpen) {
                            event.preventDefault();
                            closeChat();
                        }
                    }}
                    className={`fixed kk-workspace-sidebar kk-workspace-chrome-surface flex flex-col ${isMobile
                        ? 'left-0 right-0 top-0 bottom-0 border-none pb-0'
                        : 'top-0 right-0 bottom-0 border-l border-[var(--border-light)]'
                        }`}
                    style={isMobile ? {
                        zIndex: KK_LAYER.drawer,
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '100%',
                        width: '100%',
                        background: 'var(--bg-primary)',
                        paddingTop: 'env(safe-area-inset-top, 0px)',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        transition: 'none'
                    } : {
                        zIndex: KK_LAYER.drawer,
                        // Full height sidebar on the right
                        width: `${sidebarWidth}px`,
                        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                        pointerEvents: isOpen ? 'auto' : 'none',
                        transition: 'transform var(--kk-motion-panel) var(--kk-motion-ease-standard)'
                    }}
                >
                    {/* 侧边栏展开时吸附在最左侧外边缘的收缩按钮 */}
                    {!isMobile && (
                        <button
                            type="button"
                            onClick={onToggle}
                            aria-controls="ai-assistant-sidebar"
                            aria-expanded={true}
                            aria-label="Close AI assistant"
                            data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleSidebar.uiAction}
                            className="kk-workspace-edge-toggle absolute -left-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-12 rounded-l-lg border-l border-t border-b transition-all group"
                            style={{
                                zIndex: KK_LAYER.drawer + 1,
                                borderWidth: '1px 0 1px 1px',
                                borderStyle: 'solid',
                            }}
                            title="折叠 AI 助手（收起）"
                        >
                            <ChevronRight size={16} className="text-[var(--text-secondary)] transition-transform group-hover:translate-x-0.5" />
                        </button>
                    )}

                    {/* Resize Handle */}
                    {!isMobile && (
                        <div
                            onMouseDown={(e: React.MouseEvent) => {
                                e.preventDefault();
                                dragStartXRef.current = e.clientX;
                                dragStartWidthRef.current = sidebarWidth;
                                setIsResizing(true);
                            }}
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--primary)] transition-colors z-50"
                        />
                    )}

                    {/* 内层包裹容器，具有 overflow-hidden 确保侧边栏所有主要内容不产生溢出，同时允许挂在最左侧边缘的关闭按钮完美伸出容器外部而不被截断 */}
                    <div className="w-full h-full flex flex-col overflow-hidden relative">

                    {/* Session Header */}
                    <div
                        className={`relative z-10 flex flex-col border-b shrink-0 ${isMobile ? 'pt-1.5' : 'pt-4'}`}
                        style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border-light)',
                        }}
                    >
                        <div className="flex items-center justify-between px-4 pb-3 pt-2">
                            {/* 左侧：返回/关闭（仅移动端显示，高原生体验） */}
                            {isMobile ? (
                                <button
                                    type="button"
                                    onClick={onClose || onToggle}
                                    aria-label="Close AI assistant"
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.closeMobileSidebar.uiAction}
                                    className="kk-workspace-icon-control -ml-2 rounded-full flex items-center justify-center shrink-0"
                                    title="返回"
                                >
                                    <ChevronLeft size={22} />
                                </button>
                            ) : null}

                            {/* 中间：会话标题重命名 */}
                            <div className={`flex-1 min-w-0 flex items-center ${isMobile ? 'justify-center px-2' : 'gap-2'}`}>
                                <button
                                    type="button"
                                    onClick={() => handleRenameSession(activeSessionId)}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.renameCurrentSession.uiAction}
                                    className={`flex items-center max-w-full group hover:bg-[var(--toolbar-hover)] px-2.5 py-1 rounded-lg transition-colors cursor-text ${isMobile ? 'justify-center gap-1.5' : 'gap-2'}`}
                                    title="点击重命名"
                                >
                                    {!isMobile && <MessageSquare size={16} className="text-[var(--primary)] shrink-0" />}
                                    <span className="font-semibold text-sm text-[var(--text-primary)] truncate flex items-center gap-1">
                                        {activeSession?.isTemp && <Ghost size={14} className="text-amber-500 shrink-0 mr-1" style={{ display: 'inline-block', verticalAlign: 'middle' }} />}
                                        {activeSession?.title || '新对话'}
                                    </span>
                                </button>
                            </div>

                            {/* 右侧：控制动作组 */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleClearCurrentSession}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.clearCurrentSession.uiAction}
                                    className="kk-workspace-icon-control flex items-center justify-center rounded-md"
                                    title="清除当前对话（清空）"
                                >
                                    <Broom size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNewTempSession}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.createTemporarySession.uiAction}
                                    className="kk-workspace-icon-control flex items-center justify-center rounded-md"
                                    title="开启临时对话（不保存，关闭或切换后清理）"
                                >
                                    <Ghost size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNewSession}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.createSession.uiAction}
                                    className="kk-workspace-icon-control flex items-center justify-center rounded-md"
                                    title="新建对话（保留历史）"
                                >
                                    <Plus size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleHistoryPanel.uiAction}
                                    className={`kk-workspace-icon-control flex items-center justify-center rounded-md ${showHistoryPanel ? 'text-[var(--primary)] bg-[var(--primary-light)]' : ''}`}
                                    title="历史记录与分支"
                                >
                                    <Layout size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Context Limit Indicator 栏 */}
                        <div className="mx-auto my-2.5 px-5 py-2.5 rounded-full border border-[var(--border-light)]/30 bg-[var(--bg-primary)]/60 backdrop-blur-md flex flex-col gap-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.15)] w-[88%] max-w-[340px] select-none transition-all duration-300 hover:border-[var(--primary)]/50">
                            <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                                <span className="flex items-center gap-1">
                                    <span>🧠 上下文:</span>
                                    <span className="font-semibold text-[var(--text-secondary)]">
                                        {totalTokensUsed >= 1000 ? `${(totalTokensUsed / 1000).toFixed(1)}k` : totalTokensUsed} / {maxTokensLabel}
                                    </span>
                                    <span>({percentUsed}%)</span>
                                </span>

                                <button
                                    onClick={handleCompressContext}
                                    disabled={isCompressing || messages.filter(m => m.id !== 'welcome').length <= 1}
                                    data-agent-action={AGENT_CONTROL_ACTIONS.compressContext.uiAction}
                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer select-none border ${
                                        isNearLimit
                                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30 animate-pulse'
                                            : 'bg-[var(--frost-card-sub-bg)] border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]'
                                    } disabled:opacity-30 disabled:pointer-events-none`}
                                    title={isNearLimit ? "上下文即将满，建议立即压缩以节省额度！" : "点击对历史对话进行总结和压缩"}
                                >
                                    {isCompressing ? (
                                        <>
                                            <Loader2 size={10} className="animate-spin" />
                                            <span>压缩中...</span>
                                        </>
                                    ) : (
                                        <span>🗜️ 压缩</span>
                                    )}
                                </button>
                            </div>

                            {/* 进度条 */}
                            <div className="w-full bg-[var(--border-light)]/30 rounded-full h-1 relative overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        percentUsed >= 80
                                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                            : ''
                                    }`}
                                    style={{ 
                                        width: `${percentUsed}%`,
                                        background: percentUsed >= 80 
                                            ? undefined 
                                            : 'linear-gradient(90deg, var(--clay-brand-lavender) 0%, var(--primary) 100%)'
                                    }}
                                />
                            </div>

                            {isNearLimit && (
                                <div className="text-[9px] text-amber-400/90 flex items-center justify-center gap-1 mt-0.5 animate-pulse">
                                    <AlertTriangle size={10} />
                                    <span>上下文用量已超 80%，请及时压缩。</span>
                                </div>
                            )}
                        </div>

                        {/* Expandable History Panel */}
                        {showHistoryPanel && (
                            <div className="flex flex-col border-t border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] max-h-[40vh] overflow-hidden">
                                {/* Panel Controls */}
                                <div className="flex items-center px-4 py-2 gap-2 border-b border-[var(--frost-card-sub-border)]">
                                    <input
                                        ref={sessionImportRef}
                                        type="file"
                                        accept="application/json"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImportSessions(file);
                                            e.currentTarget.value = '';
                                        }}
                                    />
                                    <div className="relative flex-1 min-w-0">
                                        <input
                                            value={sessionSearch}
                                            onChange={(e) => setSessionSearch(e.target.value)}
                                            placeholder="搜索历史记录..."
                                            className="w-full h-7 pl-8 pr-2 rounded-md bg-[var(--frost-input-bg)] border border-[var(--frost-input-border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-coral)] transition-colors"
                                        />
                                        <div className="absolute left-2.5 top-1.5 text-[var(--text-tertiary)] pointer-events-none">
                                            <Search size={14} />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleExportSessions}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.exportSessions.uiAction}
                                            className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                            title="导出全部会话"
                                        >
                                            <Download size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => sessionImportRef.current?.click()}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.importSessions.uiAction}
                                            className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                            title="导入会话"
                                        >
                                            <Upload size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowArchived(prev => !prev)}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleArchivedSessions.uiAction}
                                            className={`p-1.5 rounded-md transition-colors ${showArchived ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                            title={showArchived ? "隐藏已归档" : "显示已归档"}
                                        >
                                            <Archive size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tree List */}
                                <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
                                    {sessionTreeRows.map(row => (
                                        <div
                                            key={row.session.id}
                                            className="flex items-center group py-1"
                                            style={{ paddingLeft: `${row.depth * 16}px` }}
                                        >
                                            {/* Parent toggle */}
                                            <div className="w-5 flex justify-center shrink-0">
                                                {row.hasChildren ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSessionExpand(row.session.id)}
                                                        data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleSessionExpand.uiAction}
                                                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
                                                    >
                                                        {(expandedNodes[row.session.id] ?? (row.depth === 0 || activeBranchTrail.some(p => p.id === row.session.id))) ? (
                                                            <ChevronDown size={14} />
                                                        ) : (
                                                            <ChevronRight size={14} />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="w-1 h-1 rounded-full bg-white/10 opacity-50" />
                                                )}
                                            </div>

                                            {/* Item Content */}
                                            <button
                                                type="button"
                                                onClick={() => handleSwitchSession(row.session.id)}
                                                data-chat-shell-action={CHAT_SHELL_ACTIONS.switchSession.uiAction}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setSessionContextMenu({ x: e.clientX, y: e.clientY, sessionId: row.session.id });
                                                }}
                                                className={`flex-1 flex flex-col text-left px-2 py-1.5 min-w-0 rounded-lg transition-colors ${row.session.id === activeSessionId
                                                    ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                                                    : 'text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'
                                                    }`}
                                            >
                                                <div className="truncate text-xs font-medium">
                                                    {row.session.parentSessionId && <span className="text-emerald-500/80 mr-1 text-[10px]">🌿</span>}
                                                    {row.session.title || '新对话'}
                                                </div>
                                                <div className="truncate text-[10px] opacity-60 flex items-center justify-between mt-0.5">
                                                    <span>{formatSessionMeta(row.session)}</span>
                                                    <span>{Math.max(0, row.session.messages.filter(m => m.id !== 'welcome').length)} 条</span>
                                                </div>
                                            </button>

                                            {/* Quick Actions (Hover overlay) */}
                                            <div className="hidden group-hover:flex items-center gap-0.5 px-1 shrink-0 ml-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRenameSession(row.session.id)}
                                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.renameSession.uiAction}
                                                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
                                                    title="重命名"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleArchiveSession(row.session.id)}
                                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.archiveSession.uiAction}
                                                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                                    title={row.session.archived ? '取消归档' : '归档'}
                                                >
                                                    <Archive size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSession(row.session.id)}
                                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.deleteSession.uiAction}
                                                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="删除"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {sessionTreeRows.length === 0 && (
                                        <div className="py-8 text-center text-[var(--text-tertiary)] text-xs">
                                            暂无历史记录
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Messages */}
                    <div className={`flex-1 overflow-y-auto space-y-4 scrollbar-thin ${isMobile ? 'px-3 py-3' : 'px-6 py-4'}`}>
                        {(() => {
                            let boundaryIndex = -1;
                            for (let i = activeMessages.length - 1; i >= 0; i--) {
                                if (activeMessages[i].content.includes('上下文压缩分界线')) {
                                    boundaryIndex = i;
                                    break;
                                }
                            }

                            const items: React.ReactNode[] = [];

                            if (boundaryIndex !== -1) {
                                items.push(
                                    <div key="archive-fold-toggle" className="flex flex-col items-center my-3 w-full animate-in fade-in duration-300">
                                        <button
                                            type="button"
                                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                            data-agent-action={AGENT_CONTROL_ACTIONS.toggleTakeoverHistory.uiAction}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-all select-none cursor-pointer"
                                        >
                                            <span>{isHistoryExpanded ? '🔼 收起已归档历史' : `🔽 展开已压缩的 ${boundaryIndex} 条历史对话`}</span>
                                        </button>
                                    </div>
                                );
                            }

                            activeMessages.forEach((msg, idx) => {
                                if (boundaryIndex !== -1 && idx < boundaryIndex && !isHistoryExpanded) {
                                    return;
                                }

                                const isBoundary = msg.content.includes('上下文压缩分界线');

                                items.push(
                                    <div key={msg.id} className={`flex ${isBoundary ? 'w-full flex-col items-center my-4 animate-in fade-in duration-300' : `gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}`}>
                                        {isBoundary ? (
                                            <div className="w-full flex flex-col items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-500/5 border border-dashed border-amber-500/30 shadow-[inset_0_1px_3px_rgba(245,158,11,0.05)]">
                                                <div className="flex items-center gap-2 text-xs font-black text-amber-500/90 tracking-wider uppercase select-none">
                                                    <span>🗜️ 上下文压缩分界线 (已归档历史)</span>
                                                </div>
                                                <div className="w-full text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed text-left">
                                                    {renderMessageContent(msg.content.replace('--- 📌 上下文压缩分界线 (已归档历史) ---\n', ''))}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user'
                                                    ? 'bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)]'
                                                    : 'bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-pink-500 text-white'
                                                    }`}>
                                                    {msg.role === 'user' ? (
                                                        <User size={14} className="text-[var(--text-tertiary)]" />
                                                    ) : (
                                                        <Bot size={16} className="animate-icon-breathe" />
                                                    )}
                                                </div>
                                                <div className={`${isMobile ? 'max-w-[90%]' : 'max-w-[82%]'} flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                    {/* 消息文本 */}
                                                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                                        ? 'bg-[var(--frost-card-sub-bg)] text-[var(--text-primary)] rounded-tr-md border border-[var(--frost-card-sub-border)]'
                                                        : 'bg-[var(--frost-card-sub-bg)] text-[var(--text-primary)] border border-[var(--frost-card-sub-border)] rounded-tl-md'
                                                        }`}>
                                                        {msg.role === 'assistant' && !msg.content ? (
                                                            <div className="flex items-center gap-1.5 h-5">
                                                                <div className="w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                                <div className="w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                                <div className="w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-bounce" />
                                                            </div>
                                                        ) : (
                                                            <div className="whitespace-pre-wrap">{renderMessageContent(msg.content)}</div>
                                                        )}
                                                    </div>

                                                    {/* 附件/生成结果展示 */}
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {msg.attachments.map(att => (
                                                                <div key={att.id} className="relative group overflow-hidden rounded-xl border border-[var(--border-light)] shadow-sm transition-transform hover:scale-[1.02]">
                                                                    {att.type === 'image' ? (
                                                                        <a href={att.data} target="_blank" rel="noopener noreferrer" className="block cursor-zoom-in">
                                                                            <img
                                                                                src={att.data}
                                                                                alt={att.name}
                                                                                className="max-w-[240px] max-h-[240px] object-cover bg-[var(--frost-card-sub-bg)]"
                                                                            />
                                                                        </a>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--frost-card-sub-bg)] cursor-default">
                                                                            {att.type === 'video' && <Film size={16} className="text-[var(--clay-brand-lavender)]" />}
                                                                            {att.type === 'audio' && <Mic size={16} className="text-[var(--clay-brand-mint)]" />}
                                                                            {att.type === 'document' && <FileText size={16} className="text-[var(--clay-brand-lavender)]" />}
                                                                            <span className="text-xs text-[var(--text-secondary)] truncate max-w-[150px]">{att.name}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {msg.id !== 'welcome' && (
                                                        <div className={`flex items-center gap-1 text-[10px] transition-opacity ${isMobile
                                                            ? 'opacity-85'
                                                            : 'opacity-0 group-hover:opacity-100'
                                                            } ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                            {msg.role === 'user' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEditResend(msg)}
                                                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.editUserMessage.uiAction}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                                    title="编辑后重发"
                                                                >
                                                                    <Pencil size={12} />
                                                                    {!isMobile && <span>编辑</span>}
                                                                </button>
                                                            )}
                                                            {msg.role === 'assistant' && idx === lastAssistantIndex && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRegenerateAssistant(msg.id)}
                                                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.regenerateAssistantMessage.uiAction}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)] disabled:opacity-50"
                                                                    disabled={isThinking}
                                                                    title="重试这一轮回答"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                    {!isMobile && <span>重试</span>}
                                                                </button>
                                                            )}
                                                            {msg.role === 'assistant' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEditFromAssistant(msg.id)}
                                                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.editPreviousUserMessage.uiAction}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                                    title="编辑上一条提问"
                                                                >
                                                                    <Pencil size={12} />
                                                                    {!isMobile && <span>编辑提问</span>}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleBranchFrom(idx)}
                                                                data-chat-shell-action={CHAT_SHELL_ACTIONS.branchFromMessage.uiAction}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                                title="从当前消息创建分支"
                                                            >
                                                                <GitBranch size={12} />
                                                                {!isMobile && <span>分支</span>}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopyMessage(msg)}
                                                                data-chat-shell-action={CHAT_SHELL_ACTIONS.copyMessage.uiAction}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                                title="复制消息文本"
                                                            >
                                                                {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                                                                {!isMobile && <span>{copiedMessageId === msg.id ? '已复制' : '复制'}</span>}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            });

                            return items;
                        })()}

                        {activeIsThinking && (
                            isAgentCollaboration ? (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] flex items-center justify-center shrink-0">
                                        <Cpu className="text-purple-500 w-4.5 h-4.5 animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] rounded-2xl rounded-tl-md text-xs text-[var(--text-secondary)] shadow-sm">
                                        <Loader2 className="animate-spin text-purple-500 w-3.5 h-3.5" />
                                        <span>{collaborationMode === 'assist' ? '正在读取页面与选区...' : '接管引擎正在规划...'}</span>
                                    </div>
                                </div>
                            ) : (
                                !(
                                    messages.length > 0 && 
                                    messages[messages.length - 1].role === 'assistant' && 
                                    !messages[messages.length - 1].content
                                ) && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] flex items-center justify-center shrink-0">
                                            <ModelLogo modelId={selectedModel.id} size={18} className="animate-pulse" />
                                        </div>
                                        <div className="flex items-center gap-1.5 px-4 py-3 bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)] rounded-2xl rounded-tl-md h-11">
                                            <div className="w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                                            <div className="w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                                            <div className="w-2 h-2 bg-[var(--accent-coral)] rounded-full animate-bounce" />
                                        </div>
                                    </div>
                                )
                            )
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Bottom Area */}
                    <div
                        className="px-4 pb-4 pt-2 shrink-0 flex flex-col"
                        style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' } : undefined}
                    >
                        <AIContextSuggestions
                            onSelectSuggestion={(suggestion) => {
                                setInput(suggestion.prompt);
                                registerActivity();
                                requestAnimationFrame(() => inputRef.current?.focus());
                            }}
                        />
                        {shouldShowTakeoverTimeline && (
                            <div className="ai-takeover-run-timeline mb-2 rounded-xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
                                <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                                    <span className="font-bold text-zinc-300">
                                        {collaborationMode === 'assist' ? '辅助执行预览' : '接管时间线'}
                                    </span>
                                    {currentRun && (
                                        <div className="flex items-center gap-2">
                                            <span className="max-w-[150px] truncate font-mono" title={currentRun.id}>
                                                {currentRun.status} - {currentRun.id.slice(-8)}
                                            </span>
                                            {currentRun?.status === 'running' && (
                                                <button
                                                    type="button"
                                                    onClick={cancelPendingPlan}
                                                    data-agent-action={AGENT_CONTROL_ACTIONS.cancelPlan.uiAction}
                                                    data-agent-runtime-action={AGENT_CONTROL_ACTIONS.cancelPlan.runtimeAction}
                                                    className="rounded-md border border-rose-500/35 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 hover:bg-rose-500/10"
                                                >
                                                    停止
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-5 gap-1">
                                    {visibleTakeoverTimeline.map((step) => (
                                        <div
                                            key={step.id}
                                            className={`ai-takeover-run-timeline__step min-w-0 rounded-lg border px-1.5 py-1.5 text-center transition-colors ${
                                                step.status === 'done'
                                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                    : step.status === 'active'
                                                        ? 'border-purple-500/40 bg-purple-500/15 text-purple-200'
                                                        : step.status === 'needs_confirmation'
                                                            ? 'border-amber-500/40 bg-amber-500/12 text-amber-200'
                                                            : step.status === 'failed' || step.status === 'cancelled'
                                                                ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                                                                : 'border-zinc-800 bg-zinc-900/40 text-zinc-500'
                                            }`}
                                            data-status={step.status}
                                            title={`${step.label}: ${step.description}${step.detail ? ` - ${step.detail}` : ''}`}
                                        >
                                            <div className="truncate text-[9px] font-black">{step.label}</div>
                                            <div className="mt-0.5 truncate text-[8px] opacity-80">{step.detail || step.status}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 简体中文：AI接管模式下的意图强确认卡片 */}
                        {shouldShowDurableQueuePanel && (
                            <div className="ai-takeover-durable-queue-panel mb-2 rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-3 py-2 shadow-[var(--frost-card-sub-shadow)]">
                                <div className="mb-2 flex items-center justify-between gap-2 text-[10px]">
                                    <span className="flex min-w-0 items-center gap-1.5 font-black text-[var(--text-secondary)]">
                                        <Cpu size={12} className="shrink-0 text-[var(--clay-brand-lavender)]" />
                                        <span className="truncate">DurableGenerationQueue ({activeDurableJobs.length})</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => durableGenerationQueue.archiveFinishedJobs()}
                                        data-agent-action={AGENT_CONTROL_ACTIONS.archiveFinishedGenerationJobs.uiAction}
                                        className="shrink-0 rounded-lg border border-[var(--frost-card-sub-border)] px-2 py-1 text-[9px] font-bold text-[var(--text-tertiary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-secondary)]"
                                        title="归档已完成或已取消的队列任务"
                                    >
                                        归档
                                    </button>
                                </div>
                                <div className="max-h-44 space-y-2 overflow-y-auto pr-0.5">
                                    {activeDurableJobs.map((job) => {
                                        const counts = getDurableQueueJobCounts(job);
                                        const outputNodeCount = getDurableQueueJobNodeIds(job).length;

                                        return (
                                            <div key={job.id} className="ai-takeover-durable-queue__job rounded-lg border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-main-bg)] p-2 text-[10px] text-[var(--text-secondary)]">
                                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                                    <span className="min-w-0 truncate font-mono text-[9px] text-[var(--text-tertiary)]" title={job.id}>
                                                        {job.outputGroup?.label || `Job ${job.id.slice(-8)}`}
                                                    </span>
                                                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black ${getDurableQueueStatusClass(job)}`}>
                                                        {getDurableQueueStatusLabel(job)}
                                                    </span>
                                                </div>
                                                <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--frost-card-sub-bg)]">
                                                    <div
                                                        className="h-full rounded-full transition-[width] duration-300"
                                                        style={{
                                                            width: `${counts.percent}%`,
                                                            background: 'linear-gradient(90deg, var(--clay-brand-lavender), var(--clay-brand-coral))',
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-2 text-[8px] text-[var(--text-tertiary)]">
                                                    <span className="min-w-0 truncate">
                                                        完成 {counts.completed}/{counts.total} · 运行 {counts.running} · 等待 {counts.queued} · 失败 {counts.failed}
                                                    </span>
                                                    <span className="shrink-0">产物 {outputNodeCount}</span>
                                                </div>
                                                {counts.firstFailure && (
                                                    <div className="mt-1 flex items-center justify-between gap-1.5 rounded-md border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-1.5 py-1 text-[8px] text-[var(--state-danger-text)]" title={counts.firstFailure}>
                                                        <span className="min-w-0 truncate">{counts.firstFailure}</span>
                                                        {counts.firstFailure.includes('API') || counts.firstFailure.includes('KEY') || counts.firstFailure.includes('密钥') || counts.firstFailure.includes('未配置') || counts.firstFailure.includes('offline') || counts.firstFailure.includes('运行器') ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (onOpenSettings) onOpenSettings('api-management');
                                                                }}
                                                                className="shrink-0 rounded bg-[var(--frost-card-sub-border)] px-1 py-0.5 font-bold hover:bg-[var(--toolbar-hover)]"
                                                            >
                                                                去配置
                                                            </button>
                                                        ) : counts.firstFailure.includes('credit') || counts.firstFailure.includes('积分') || counts.firstFailure.includes('余额') || counts.firstFailure.includes('quota') ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowRechargeModal(true)}
                                                                className="shrink-0 rounded bg-[var(--state-warning-border)] px-1 py-0.5 font-bold hover:bg-[var(--state-warning-bg)]"
                                                            >
                                                                去充值
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                )}
                                                <div className="mt-2 flex items-center justify-end gap-1.5">
                                                    {job.status === 'running' && (
                                                        <button
                                                            type="button"
                                                            data-action="pause-durable-job"
                                                            data-agent-action={AGENT_CONTROL_ACTIONS.pauseGenerationJob.uiAction}
                                                            data-agent-tool={AGENT_CONTROL_ACTIONS.pauseGenerationJob.toolName}
                                                            onClick={() => durableGenerationQueue.pauseJob(job.id)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
                                                            title="暂停队列任务"
                                                        >
                                                            <Pause size={11} />
                                                        </button>
                                                    )}
                                                    {(job.status === 'paused' || job.status === 'queued') && (
                                                        <button
                                                            type="button"
                                                            data-action="resume-durable-job"
                                                            data-agent-action={AGENT_CONTROL_ACTIONS.resumeGenerationJob.uiAction}
                                                            data-agent-tool={AGENT_CONTROL_ACTIONS.resumeGenerationJob.toolName}
                                                            onClick={() => durableGenerationQueue.resumeJob(job.id)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
                                                            title="继续队列任务"
                                                        >
                                                            <Play size={11} />
                                                        </button>
                                                    )}
                                                    {counts.retryableFailed > 0 && job.status !== 'cancelled' && (
                                                        <button
                                                            type="button"
                                                            data-action="retry-durable-job"
                                                            data-agent-action={AGENT_CONTROL_ACTIONS.retryGenerationJob.uiAction}
                                                            data-agent-tool={AGENT_CONTROL_ACTIONS.retryGenerationJob.toolName}
                                                            onClick={() => durableGenerationQueue.retryFailedPrompts(job.id)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--state-warning-border)] text-[var(--state-warning-text)] transition-colors hover:bg-[var(--state-warning-bg)]"
                                                            title="重试失败队列项"
                                                        >
                                                            <RotateCcw size={11} />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        data-action="locate-durable-job"
                                                        data-agent-action={AGENT_CONTROL_ACTIONS.locateGenerationJobOutputs.uiAction}
                                                        onClick={() => handleLocateDurableJob(job)}
                                                        disabled={outputNodeCount === 0}
                                                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                                                        title="定位队列产物"
                                                    >
                                                        <Eye size={11} />
                                                    </button>
                                                    {(job.status === 'running' || job.status === 'paused' || job.status === 'queued') && (
                                                        <button
                                                            type="button"
                                                            data-action="cancel-durable-job"
                                                            data-agent-action={AGENT_CONTROL_ACTIONS.cancelGenerationJob.uiAction}
                                                            data-agent-tool={AGENT_CONTROL_ACTIONS.cancelGenerationJob.toolName}
                                                            onClick={() => durableGenerationQueue.cancelJob(job.id)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--state-danger-border)] text-[var(--state-danger-text)] transition-colors hover:bg-[var(--state-danger-bg)]"
                                                            title="取消队列任务"
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {isAgentCollaboration && pendingPlan && pendingPlan.confirmation && (
                            <div className="mb-2 p-3 rounded-xl border border-purple-900/40 bg-[#120f21]/70 backdrop-blur-md shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="absolute top-0 right-0 p-2 opacity-5">
                                    <Cpu size={40} className="text-purple-500" />
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-black text-[var(--clay-brand-lavender)] mb-1">
                                    <AlertTriangle size={13} className="text-amber-500" />
                                    <span>{pendingPlan.confirmation.title}</span>
                                </div>
                                <div className="text-[10px] text-zinc-300 whitespace-pre-line mb-2.5 border-l-2 border-purple-500 pl-2 leading-relaxed">
                                    {pendingPlan.confirmation.summary}
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={cancelPendingPlan}
                                        data-agent-action={AGENT_CONTROL_ACTIONS.cancelPlan.uiAction}
                                        data-agent-runtime-action={AGENT_CONTROL_ACTIONS.cancelPlan.runtimeAction}
                                        className="px-2.5 py-1 rounded-lg border border-zinc-700 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
                                    >
                                        {pendingPlan.confirmation.cancelText}
                                    </button>
                                    <button
                                        onClick={executePendingPlan}
                                        data-agent-action={AGENT_CONTROL_ACTIONS.confirmPlan.uiAction}
                                        data-agent-runtime-action={AGENT_CONTROL_ACTIONS.confirmPlan.runtimeAction}
                                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold text-white hover:brightness-110 hover:shadow-[0_2px_8px_rgba(168,85,247,0.25)] transition-all cursor-pointer"
                                    >
                                        {pendingPlan.confirmation.confirmText}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 简体中文：AI接管模式下的资源管理器面板 */}
                        {isAgentCollaboration && showResourcePanel && (
                            <div className="mb-2 border border-zinc-800 bg-[#090a0f]/80 backdrop-blur-md rounded-xl p-3 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-800/40">
                                    <span className="text-[10px] font-bold text-zinc-400">已连结的本地项目资源池 ({takeoverImages.length + takeoverFiles.length})</span>
                                    <button
                                        onClick={() => setShowResourcePanel(false)}
                                        data-agent-action={AGENT_CONTROL_ACTIONS.closeTakeoverResources.uiAction}
                                        className="text-zinc-500 hover:text-white text-[9px] cursor-pointer"
                                    >
                                        关闭
                                    </button>
                                </div>

                                <div className="space-y-1.5">
                                    {/* 图像列表 */}
                                    {takeoverImages.map(img => (
                                        <div key={img.id} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/20 rounded-lg p-1 text-[9px] text-zinc-300">
                                            <div className="flex items-center gap-1.5 truncate">
                                                {img.thumbnailUrl ? (
                                                    <img src={img.thumbnailUrl} alt="preview" className="w-5 h-5 rounded object-cover border border-zinc-800" />
                                                ) : (
                                                    <Picture size={11} className="text-zinc-500" />
                                                )}
                                                <div className="truncate">
                                                    <p className="truncate text-zinc-200">{img.name}</p>
                                                    <p className="text-[8px] text-zinc-500">{formatBytes(img.size)} • {getUploadStateText(img.uploadState)}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeTakeoverAsset(img.id, 'image')}
                                                data-agent-action={AGENT_CONTROL_ACTIONS.removeTakeoverImage.uiAction}
                                                className="p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* 普通文件列表 */}
                                    {takeoverFiles.map(f => (
                                        <div key={f.id} className={`flex items-center justify-between rounded-lg p-1 text-[9px] border ${
                                            f.sensitive
                                                ? 'border-red-950/40 bg-red-950/20 text-red-300'
                                                : 'border-zinc-800/20 bg-zinc-900/50 text-zinc-300'
                                        }`}>
                                            <div className="flex items-center gap-1.5 truncate">
                                                {f.sensitive ? (
                                                    <Lock size={11} className="text-red-500 animate-pulse" />
                                                ) : (
                                                    <FileText size={11} className="text-zinc-500" />
                                                )}
                                                <div className="truncate">
                                                    <p className="truncate text-zinc-200">{f.name}</p>
                                                    <p className="text-[8px] text-zinc-500">
                                                        {formatBytes(f.size)} • {f.sensitive ? '敏感被隔离' : getUploadStateText(f.uploadState)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeTakeoverAsset(f.id, 'file')}
                                                data-agent-action={AGENT_CONTROL_ACTIONS.removeTakeoverFile.uiAction}
                                                className="p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}

                                    {takeoverImages.length === 0 && takeoverFiles.length === 0 && (
                                        <p className="text-[9px] text-zinc-600 text-center py-2">暂无已导入资源，点击上方按钮进行选择。</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 简体中文：AI接管且未配置 API 密钥时的专属提醒横幅 */}
                        {aiTakeoverMode && apiKeyStatus === 'missing' && (
                            <div className="mb-2 p-2.5 rounded-xl border border-purple-500/20 bg-purple-500/5 text-[11px] text-[var(--clay-brand-lavender)] flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center gap-1.5 leading-normal">
                                    <Cpu size={12} className="animate-pulse shrink-0 text-purple-500" />
                                    <span>AI接管：当前已开启本地规则驱动与隐私安全沙箱保护。</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleActionClick('action://open-settings-api')}
                                    data-agent-action={AGENT_CONTROL_ACTIONS.runInlineActionLink.uiAction}
                                    className="shrink-0 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-[9px] font-bold text-white hover:bg-purple-500/30 transition-all active:scale-95"
                                >
                                    配置密钥
                                </button>
                            </div>
                        )}

                        {/* 一体化卡片输入容器 */}
                        <div
                            className={`flex flex-col rounded-2xl border transition-all duration-300 ${
                                isDropActive
                                    ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/10 ring-2 ring-[var(--accent-coral)]/20'
                                    : 'border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] focus-within:border-[var(--accent-coral-glow)] focus-within:ring-1 focus-within:ring-[var(--accent-coral-ring)] focus-within:shadow-[0_0_12px_rgba(255,107,90,0.04)]'
                            } p-3 gap-2 shadow-sm relative backdrop-blur-md`}
                            onDragEnter={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDropActive(true);
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isDropActive) setIsDropActive(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.currentTarget === e.target) {
                                    setIsDropActive(false);
                                }
                            }}
                            onDrop={handleDropToAttach}
                        >
                            {/* 1. 文本域输入行 */}
                            <div className="w-full flex items-start">
                                <ReferenceMentionPanel
                                    open={mentionState.open}
                                    query={mentionState.query}
                                    tabs={referenceMentionTabs}
                                    anchor={mentionState.anchor}
                                    onSelect={replaceActiveMentionWithCandidate}
                                    onClose={closeReferenceMentionPanel}
                                />
                                <textarea
                                    id={collaborationMode === 'takeover'
                                        ? 'ai-takeover-composer-input'
                                        : collaborationMode === 'assist'
                                            ? 'ai-assist-composer-input'
                                            : 'chat-composer-input'}
                                    ref={inputRef}
                                    className="w-full border-none shadow-none text-[15px] p-0.5 bg-transparent resize-none scrollbar-thin focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] leading-relaxed"
                                    placeholder={collaborationMode === 'takeover'
                                        ? '描述目标，AI 将跨工具执行...'
                                        : collaborationMode === 'assist'
                                            ? '询问下一步，或选择上方建议...'
                                            : '开启你的灵感之旅...'}
                                    rows={1}
                                    value={input}
                                    onChange={e => {
                                        setInput(e.target.value);
                                        registerActivity();
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                                        updateReferenceMentionFromTextarea(e.target);
                                    }}
                                    onKeyDown={e => {
                                        if ((e.nativeEvent as KeyboardEvent).isComposing) {
                                            return;
                                        }
                                        if (mentionState.open) {
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                closeReferenceMentionPanel();
                                                return;
                                            }
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                return;
                                            }
                                        }
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    onPaste={handleInputPaste}
                                    onFocus={() => favoriteComposerRegistry.markFocused('assistant')}
                                    autoFocus
                                />
                            </div>

                            {/* 2. 拖拽文件时的温馨提示 */}
                            {isDropActive && (
                                <div className="text-[11px] text-[var(--clay-brand-lavender)] font-medium px-0.5 animate-pulse">
                                    松开鼠标即可添加图片/视频/文档作为参考
                                </div>
                            )}

                            {/* 3. 附件预览行 (卡片式) */}
                            {attachments.length > 0 && (
                                <div className="flex flex-nowrap gap-2 mt-1 px-0.5 overflow-x-auto scrollbar-none pb-1.5 pt-0.5">
                                    {attachments.map(att => (
                                        <div key={att.id} className="relative group shrink-0">
                                            {att.type === 'image' ? (
                                                <img
                                                    src={att.data}
                                                    alt={att.name}
                                                    className="w-14 h-14 object-cover rounded-xl border border-[var(--frost-card-sub-border)] shadow-sm hover:scale-[1.02] transition-transform duration-200"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-framework-bg)] flex flex-col items-center justify-center gap-1 shadow-sm hover:scale-[1.02] transition-transform duration-200">
                                                    {att.type === 'video' && <Film size={18} className="text-[var(--clay-brand-lavender)]" />}
                                                    {att.type === 'audio' && <Mic size={18} className="text-[var(--clay-brand-mint)]" />}
                                                    {att.type === 'document' && <FileText size={18} className="text-[var(--clay-brand-lavender)]" />}
                                                    <span className="text-[8px] text-[var(--text-tertiary)] truncate max-w-[48px] px-1 font-medium">{att.name}</span>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(att.id)}
                                                data-chat-shell-action={CHAT_SHELL_ACTIONS.removeAttachment.uiAction}
                                                className={`absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all ${isMobile ? 'opacity-95 scale-110' : 'opacity-0 group-hover:opacity-100 scale-100 hover:scale-110'}`}
                                            >
                                                <X size={9} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 4. 一体化工具栏底栏 */}
                            <div className="kk-chat-sidebar-composer-actions flex min-w-0 flex-wrap items-center justify-between gap-2 mt-1 pt-1.5 border-t border-[var(--frost-card-sub-border)]/40">
                                {/* 左侧：附件添加 & Agent 切换 */}
                                <div className="kk-chat-sidebar-agent-controls flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                    {/* 隐藏的 File Input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    {/* 隐藏的 接管输入资源 Input */}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        ref={takeoverImgInputRef}
                                        onChange={handleTakeoverImageChange}
                                        className="hidden"
                                    />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        webkitdirectory="true"
                                        ref={takeoverDirInputRef}
                                        onChange={handleTakeoverDirChange}
                                        className="hidden"
                                    />
                                    <input
                                        type="file"
                                        accept=".txt,.json,.csv,.pdf,.zip,.prompt"
                                        ref={takeoverFileInputRef}
                                        onChange={handleTakeoverFileChange}
                                        className="hidden"
                                    />

                                    {/* 附件添加按钮 */}
                                    <div className="relative shrink-0">
                                        <button
                                            id="btn-takeover-plus-button"
                                            type="button"
                                            onClick={() => {
                                                if (isAgentCollaboration) {
                                                    setShowTakeoverMenu(prev => !prev);
                                                } else {
                                                    fileInputRef.current?.click();
                                                }
                                            }}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.openAttachmentMenu.uiAction}
                                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)] transition-all active:scale-90 flex items-center justify-center"
                                            title={isAgentCollaboration ? "打开 AI 资源选项" : "添加附件 (图片/视频/文档)"}
                                        >
                                            <Plus size={18} />
                                        </button>

                                        {isAgentCollaboration && showTakeoverMenu && (
                                            <div
                                                id="btn-takeover-menu-container"
                                                className="kk-chat-sidebar-floating-menu absolute bottom-full left-0 mb-2 w-40 rounded-xl p-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
                                                style={{ zIndex: KK_LAYER.dropdown }}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setShowTakeoverMenu(false);
                                                        takeoverImgInputRef.current?.click();
                                                    }}
                                                    data-agent-action={AGENT_CONTROL_ACTIONS.importTakeoverImage.uiAction}
                                                    className="kk-chat-sidebar-menu-item w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Picture size={13} className="text-[var(--clay-brand-lavender)]" />
                                                    <span>上传图片</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowTakeoverMenu(false);
                                                        takeoverDirInputRef.current?.click();
                                                    }}
                                                    data-agent-action={AGENT_CONTROL_ACTIONS.importTakeoverFolder.uiAction}
                                                    className="kk-chat-sidebar-menu-item w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                                                >
                                                    <FolderOpen size={13} className="text-[var(--clay-brand-pink)]" />
                                                    <span>导入文件夹</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowTakeoverMenu(false);
                                                        takeoverFileInputRef.current?.click();
                                                    }}
                                                    data-agent-action={AGENT_CONTROL_ACTIONS.connectTakeoverFile.uiAction}
                                                    className="kk-chat-sidebar-menu-item w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                                                >
                                                    <FileText size={13} className="text-[var(--clay-brand-coral)]" />
                                                    <span>连接文件</span>
                                                </button>
                                                <div className="kk-chat-sidebar-menu-divider h-px my-1" />
                                                <button
                                                    onClick={() => {
                                                        setShowTakeoverMenu(false);
                                                        setShowResourcePanel(prev => !prev);
                                                    }}
                                                    data-agent-action={AGENT_CONTROL_ACTIONS.toggleTakeoverResources.uiAction}
                                                    className="kk-chat-sidebar-menu-item w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Eye size={13} className="text-[var(--text-tertiary)]" />
                                                    <span>资源 ({takeoverImages.length + takeoverFiles.length})</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <AITakeoverToggle onModeChange={() => registerActivity()} />
                                </div>

                                {/* 右侧：发送 / 停止按钮 */}
                                <div className="kk-chat-sidebar-send-control shrink-0">
                                    {activeIsThinking ? (
                                        collaborationMode === 'direct' ? (
                                        <button
                                            type="button"
                                            onClick={handleStopGeneration}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.stopGeneration.uiAction}
                                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white hover:brightness-110 active:scale-90 transition-all shadow-[0_2px_8px_rgba(239,68,68,0.25)]"
                                            title="停止生成"
                                        >
                                            <Square size={10} fill="white" />
                                        </button>
                                        ) : (
                                            <div
                                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] text-[var(--text-secondary)]"
                                                aria-label="AI 正在处理"
                                            >
                                                <Loader2 size={13} className="animate-spin" />
                                            </div>
                                        )
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (input.trim() || attachments.length > 0) {
                                                    handleSend();
                                                }
                                            }}
                                            disabled={!input.trim() && attachments.length === 0}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.sendComposerMessage.uiAction}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                input.trim() || attachments.length > 0
                                                    ? 'bg-gradient-to-br from-[var(--clay-brand-coral)] to-[var(--clay-brand-pink)] text-white hover:brightness-110 active:scale-90 shadow-[0_2px_8px_rgba(244,63,94,0.25)] cursor-pointer'
                                                    : 'bg-[var(--toolbar-hover)] text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                                            }`}
                                            title="发送消息"
                                        >
                                            <ArrowUp size={15} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
            )}
            {sessionContextMenu && ReactDOM.createPortal(
                <div
                    className="kk-chat-sidebar-floating-menu fixed w-40 rounded-lg py-1"
                    style={{
                        top: sessionContextMenu.y,
                        left: sessionContextMenu.x,
                        zIndex: KK_LAYER.dropdown,
                    }}
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRenameSession(sessionContextMenu.sessionId);
                            setSessionContextMenu(null);
                        }}
                        data-chat-shell-action={CHAT_SHELL_ACTIONS.renameSession.uiAction}
                        className="kk-chat-sidebar-menu-item w-full text-left px-3 py-2 text-sm"
                    >
                        重命名
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateSession(sessionContextMenu.sessionId);
                        }}
                        data-chat-shell-action={CHAT_SHELL_ACTIONS.duplicateSession.uiAction}
                        className="kk-chat-sidebar-menu-item w-full text-left px-3 py-2 text-sm"
                    >
                        复制分支
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArchiveSession(sessionContextMenu.sessionId);
                            setSessionContextMenu(null);
                        }}
                        data-chat-shell-action={CHAT_SHELL_ACTIONS.archiveSession.uiAction}
                        className="kk-chat-sidebar-menu-item w-full text-left px-3 py-2 text-sm"
                    >
                        归档/取消归档
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(sessionContextMenu.sessionId);
                            setSessionContextMenu(null);
                        }}
                        data-chat-shell-action={CHAT_SHELL_ACTIONS.deleteSession.uiAction}
                        className="kk-chat-sidebar-menu-item kk-chat-sidebar-menu-item--danger w-full text-left px-3 py-2 text-sm"
                    >
                        删除会话
                    </button>
                </div>,
                document.body
            )}
            {importPreview && ReactDOM.createPortal(
                <div className="kk-chat-sidebar-modal-backdrop fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: KK_LAYER.modalBackdrop }}>
                    <div
                        className="kk-chat-sidebar-modal-panel w-full max-w-md rounded-xl border p-4"
                    >
                        <div className="text-sm font-medium text-[var(--text-primary)] mb-2">导入预览</div>
                        <div className="text-xs text-[var(--text-secondary)] space-y-1 mb-4">
                            <div>导入会话: {importPreview.stats.imported}</div>
                            <div>新会话(ID): {importPreview.stats.newById}</div>
                            <div>ID 冲突: {importPreview.stats.conflictsById}</div>
                            <div>内容重复(指纹): {importPreview.stats.duplicatesByFingerprint}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-2">
                            <input
                                value={importPreviewSearch}
                                onChange={(e) => setImportPreviewSearch(e.target.value)}
                                placeholder="搜索导入明细..."
                                className="h-8 w-full sm:w-auto sm:flex-1 px-2 rounded-lg border border-[var(--frost-input-border)] bg-[var(--frost-input-bg)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setImportPreviewShowAll(prev => !prev)}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleImportPreviewAll.uiAction}
                                    className="flex-1 sm:flex-none h-8 px-2 rounded-lg border border-[var(--frost-card-sub-border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)] whitespace-nowrap"
                                >
                                    {importPreviewShowAll ? '收起' : '查看全部'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImportPreviewOnlyExcluded(prev => !prev)}
                                    data-chat-shell-action={CHAT_SHELL_ACTIONS.toggleImportPreviewExcluded.uiAction}
                                    className={`kk-chat-sidebar-filter-toggle flex-1 sm:flex-none h-8 px-2 rounded-lg border text-[11px] whitespace-nowrap ${importPreviewOnlyExcluded
                                        ? 'kk-chat-sidebar-filter-toggle--active'
                                        : ''
                                        }`}
                                >
                                    {importPreviewOnlyExcluded ? '显示全部' : '只看已勾选'}
                                </button>
                            </div>
                        </div>
                        {(() => {
                            const q = importPreviewSearch.trim().toLowerCase();
                            const conflictSet = new Set(importPreview.stats.conflictIds);
                            const duplicateSet = new Set(importPreview.stats.duplicateIds);
                            const newSet = new Set(importPreview.stats.newIds);
                            const filtered = importPreview.sessions.filter(session => {
                                if (!q) return true;
                                return getSessionLabel(session).toLowerCase().includes(q);
                            }).filter(session => importPreviewOnlyExcluded ? importExcludedIds.includes(session.id) : true);
                            const visible = importPreviewShowAll ? filtered : filtered.slice(0, 10);

                            return (
                                <div className="mb-3 border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] rounded-lg p-2 max-h-44 overflow-y-auto scrollbar-thin">
                                    <div className="text-[10px] text-[var(--text-tertiary)] mb-2">排除项（勾选后不导入）</div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setImportExcludedIds(visible.map(s => s.id))}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.excludeVisibleImportSessions.uiAction}
                                            className="text-[10px] px-2 py-1 rounded border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                        >全选可见</button>
                                        <button
                                            type="button"
                                            onClick={() => setImportExcludedIds([])}
                                            data-chat-shell-action={CHAT_SHELL_ACTIONS.clearImportExcludedSessions.uiAction}
                                            className="text-[10px] px-2 py-1 rounded border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                        >清空排除</button>
                                        <span className="text-[10px] text-[var(--text-tertiary)]">已排除 {importExcludedIds.length} 条</span>
                                    </div>
                                    <div className="space-y-1">
                                        {visible.map(session => {
                                            const checked = importExcludedIds.includes(session.id);
                                            return (
                                                <label key={`exclude-${session.id}`} className="flex items-center gap-2 text-[10px] cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            setImportExcludedIds(prev => e.target.checked
                                                                ? [...prev, session.id]
                                                                : prev.filter(id => id !== session.id));
                                                        }}
                                                    />
                                                    <span className="flex-1 truncate text-[var(--text-secondary)]">{getSessionLabel(session)}</span>
                                                    {newSet.has(session.id) && <span className="px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-200">添加</span>}
                                                    {conflictSet.has(session.id) && <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-200">冲突</span>}
                                                    {duplicateSet.has(session.id) && <span className="px-1 py-0.5 rounded bg-[var(--clay-brand-lavender)]/20 text-[var(--clay-brand-lavender)]">重复</span>}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto scrollbar-thin">
                            {importPreview.stats.newTitles.length > 0 && (() => {
                                const list = importPreview.stats.newTitles.filter(name => name.toLowerCase().includes(importPreviewSearch.toLowerCase()));
                                const visible = importPreviewShowAll ? list : list.slice(0, 8);
                                return visible.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-emerald-300 mb-1">将添加</div>
                                        <div className="text-[10px] text-[var(--text-secondary)] space-y-0.5">
                                            {visible.map((name, idx) => <div key={`new-${idx}`}>{name}</div>)}
                                        </div>
                                    </div>
                                );
                            })()}
                            {importPreview.stats.conflictTitles.length > 0 && (() => {
                                const list = importPreview.stats.conflictTitles.filter(name => name.toLowerCase().includes(importPreviewSearch.toLowerCase()));
                                const visible = importPreviewShowAll ? list : list.slice(0, 8);
                                return visible.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-amber-300 mb-1">ID冲突</div>
                                        <div className="text-[10px] text-[var(--text-secondary)] space-y-0.5">
                                            {visible.map((name, idx) => <div key={`conf-${idx}`}>{name}</div>)}
                                        </div>
                                        {importPreview.stats.conflictPairs.length > 0 && (
                                            <div className="mt-1 text-[9px] text-[var(--text-tertiary)] space-y-0.5">
                                                {importPreview.stats.conflictPairs
                                                    .filter(pair => `${pair.incoming} ${pair.existing}`.toLowerCase().includes(importPreviewSearch.toLowerCase()))
                                                    .slice(0, importPreviewShowAll ? 20 : 4)
                                                    .map((pair, idx) => (
                                                        <div key={`conf-pair-${idx}`} className="truncate">{pair.incoming} → {pair.existing}</div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {importPreview.stats.duplicateTitles.length > 0 && (() => {
                                const list = importPreview.stats.duplicateTitles.filter(name => name.toLowerCase().includes(importPreviewSearch.toLowerCase()));
                                const visible = importPreviewShowAll ? list : list.slice(0, 8);
                                return visible.length > 0 && (
                                    <div>
                                        <div className="text-[10px] text-[var(--clay-brand-lavender)] mb-1">内容疑似重复</div>
                                        <div className="text-[10px] text-[var(--text-secondary)] space-y-0.5">
                                            {visible.map((name, idx) => <div key={`dup-${idx}`}>{name}</div>)}
                                        </div>
                                        {importPreview.stats.duplicatePairs.length > 0 && (
                                            <div className="mt-1 text-[9px] text-[var(--text-tertiary)] space-y-0.5">
                                                {importPreview.stats.duplicatePairs
                                                    .filter(pair => `${pair.incoming} ${pair.existing}`.toLowerCase().includes(importPreviewSearch.toLowerCase()))
                                                    .slice(0, importPreviewShowAll ? 20 : 4)
                                                    .map((pair, idx) => (
                                                        <div key={`dup-pair-${idx}`} className="truncate">{pair.incoming} → {pair.existing}</div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="grid grid-cols-1 gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => applyImportMode('smart')}
                                data-chat-shell-action={CHAT_SHELL_ACTIONS.importSessionsSmartMerge.uiAction}
                                className="w-full py-2 rounded-lg bg-[var(--accent-coral)]/15 border border-[var(--accent-coral)]/40 text-[var(--accent-coral)] text-sm hover:bg-[var(--accent-coral)]/25"
                            >
                                智能合并（推荐）
                            </button>
                            <button
                                type="button"
                                onClick={() => applyImportMode('append')}
                                data-chat-shell-action={CHAT_SHELL_ACTIONS.importSessionsAppend.uiAction}
                                className="w-full py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-sm hover:bg-emerald-500/25"
                            >
                                追加保留当前
                            </button>
                            <button
                                type="button"
                                onClick={() => applyImportMode('replace')}
                                data-chat-shell-action={CHAT_SHELL_ACTIONS.importSessionsReplace.uiAction}
                                className="w-full py-2 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-sm hover:bg-amber-500/25"
                            >
                                覆盖当前
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setImportPreview(null);
                                setImportPreviewSearch('');
                                setImportPreviewShowAll(false);
                                setImportExcludedIds([]);
                                setImportPreviewOnlyExcluded(false);
                            }}
                            data-chat-shell-action={CHAT_SHELL_ACTIONS.cancelSessionImportPreview.uiAction}
                            className="w-full py-2 rounded-lg border border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] text-sm hover:bg-[var(--toolbar-hover)]"
                        >
                            取消
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

const ChatSidebarInner: React.FC<ChatSidebarProps & { selectedModel: ChatModel; setSelectedModel: (m: ChatModel) => void }> = (props) => {
    return <NormalChatSidebar {...props} />;
};

const resolveAssistantWorkspaceSurface = (workspaceSurface?: string): AssistantWorkspaceSurface => {
    if (workspaceSurface === 'library') return 'library';
    if (workspaceSurface === 'favorites') return 'favorites';
    if (workspaceSurface === 'settings') return 'settings';
    if (workspaceSurface === 'chat') return 'agent';
    if (!workspaceSurface || workspaceSurface === 'workspace') return 'canvas';
    return 'unknown';
};

const ChatSidebarLoaded: React.FC<ChatSidebarProps> = (props) => {
    const {
        state,
        activeCanvas,
        createCanvas,
        switchCanvas,
        deleteCanvas,
        renameCanvas,
        undo,
        redo,
        canUndo,
        canRedo,
        addPromptNode,
        updatePromptNode,
        deletePromptNode,
        updateNodes,
        createCard,
        convertDrawingsToNote,
        updateWorkflowNode,
        rasterizeNote,
        getNextCardPosition,
        selectedNodeIds,
        arrangeAllNodes,
        addGroup,
        updateGroup,
        setNodeTags,
        selectNodes,
    } = useCanvas();
    const { executeGeneration } = useImageGeneration({
        isMobile: props.isMobile,
        getCardDimensions: (ratio, hasToolbar) => getCardDimensions(ratio, hasToolbar),
        rememberPreferredKeyForMode: () => {}
    });
    const { balance } = useBilling();
    const { user } = useAuth();
    const apiKeyStatus = keyManager.hasValidKeys() ? 'configured_masked' : 'missing';

    const canvasStateRef = useRef(state);
    const canvasActionsRef = useRef({
        createCanvas,
        switchCanvas,
        deleteCanvas,
        renameCanvas,
        undo,
        redo,
    });
    const historyAvailabilityRef = useRef({ canUndo, canRedo });
    const navigationRef = useRef({
        focusWorkspace: props.focusWorkspace,
        openLibrarySurface: props.openLibrarySurface,
        openFavoritesSurface: props.openFavoritesSurface,
        openProfileSurface: props.openProfileSurface,
        onOpenSettings: props.onOpenSettings,
    });
    const configRef = useRef(props.config);
    const setConfigRef = useRef(props.setConfig);
    const accountRef = useRef({ user, apiKeyStatus, balance });

    canvasStateRef.current = state;
    canvasActionsRef.current = { createCanvas, switchCanvas, deleteCanvas, renameCanvas, undo, redo };
    historyAvailabilityRef.current = { canUndo, canRedo };
    navigationRef.current = {
        focusWorkspace: props.focusWorkspace,
        openLibrarySurface: props.openLibrarySurface,
        openFavoritesSurface: props.openFavoritesSurface,
        openProfileSurface: props.openProfileSurface,
        onOpenSettings: props.onOpenSettings,
    };
    configRef.current = props.config;
    setConfigRef.current = props.setConfig;
    accountRef.current = { user, apiKeyStatus, balance };

    const waitForHostState = useCallback(async (predicate: () => boolean) => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            if (predicate()) return;
            await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
        if (!predicate()) throw new Error('Workspace state did not converge after the requested operation.');
    }, []);

    const siteCapabilities = useMemo<AssistantSiteCapabilityPorts>(() => ({
        navigation: {
            openSurface: async (surface) => {
                const navigation = navigationRef.current;
                if (surface === 'workspace') {
                    if (!navigation.focusWorkspace) throw new Error('Workspace navigation is unavailable.');
                    navigation.focusWorkspace();
                    return;
                }
                if (surface === 'library') {
                    if (!navigation.openLibrarySurface) throw new Error('Library navigation is unavailable.');
                    navigation.openLibrarySurface();
                    return;
                }
                if (surface === 'favorites') {
                    if (!navigation.openFavoritesSurface) throw new Error('Favorites navigation is unavailable.');
                    navigation.openFavoritesSurface();
                    return;
                }
                if (surface === 'profile') {
                    if (!navigation.openProfileSurface) throw new Error('Profile navigation is unavailable.');
                    navigation.openProfileSurface('main');
                    return;
                }
                if (!navigation.onOpenSettings) throw new Error('Settings navigation is unavailable.');
                navigation.onOpenSettings('dashboard');
            },
            openSettings: async (view = 'dashboard') => {
                const handler = navigationRef.current.onOpenSettings;
                if (!handler) throw new Error('Settings navigation is unavailable.');
                handler(view as SettingsSurfaceView);
            },
        },
        project: {
            getSnapshot: () => {
                const current = canvasStateRef.current;
                return {
                    activeProjectId: current.activeCanvasId,
                    canCreateProject: current.canvases.length < 10,
                    projects: current.canvases.map((canvas) => ({
                        id: canvas.id,
                        name: canvas.name,
                        active: canvas.id === current.activeCanvasId,
                        lastModified: Number(canvas.lastModified || 0),
                        promptCount: canvas.promptNodes?.length || 0,
                        imageCount: canvas.imageNodes?.length || 0,
                        noteCount: canvas.noteNodes?.length || 0,
                        workflowNodeCount: canvas.workflow?.nodes?.length || 0,
                    })),
                };
            },
            openProject: async (projectId) => {
                canvasActionsRef.current.switchCanvas(projectId);
                await waitForHostState(() => canvasStateRef.current.activeCanvasId === projectId);
            },
            createProject: async (name) => {
                const projectId = canvasActionsRef.current.createCanvas();
                if (!projectId) return null;
                await waitForHostState(() => canvasStateRef.current.canvases.some((canvas) => canvas.id === projectId));
                if (name) {
                    await canvasActionsRef.current.renameCanvas(projectId, name);
                    await waitForHostState(() => canvasStateRef.current.canvases.some((canvas) => (
                        canvas.id === projectId && canvas.name === name
                    )));
                }
                return projectId;
            },
            renameProject: async (projectId, name) => {
                await canvasActionsRef.current.renameCanvas(projectId, name);
                await waitForHostState(() => canvasStateRef.current.canvases.some((canvas) => (
                    canvas.id === projectId && canvas.name === name
                )));
            },
            deleteProject: async (projectId) => {
                canvasActionsRef.current.deleteCanvas(projectId);
                await waitForHostState(() => !canvasStateRef.current.canvases.some((canvas) => canvas.id === projectId));
            },
        },
        history: {
            getSnapshot: () => {
                const current = canvasStateRef.current;
                const projectId = current.activeCanvasId;
                const projectHistory = current.history[projectId];
                return {
                    projectId,
                    canUndo: historyAvailabilityRef.current.canUndo,
                    canRedo: historyAvailabilityRef.current.canRedo,
                    undoDepth: projectHistory?.past?.length || 0,
                    redoDepth: projectHistory?.future?.length || 0,
                };
            },
            undo: async () => {
                const projectId = canvasStateRef.current.activeCanvasId;
                const before = canvasStateRef.current.history[projectId];
                const beforePast = before?.past?.length || 0;
                const beforeFuture = before?.future?.length || 0;
                canvasActionsRef.current.undo();
                await waitForHostState(() => {
                    const current = canvasStateRef.current.history[projectId];
                    return (current?.past?.length || 0) !== beforePast
                        || (current?.future?.length || 0) !== beforeFuture;
                });
            },
            redo: async () => {
                const projectId = canvasStateRef.current.activeCanvasId;
                const before = canvasStateRef.current.history[projectId];
                const beforePast = before?.past?.length || 0;
                const beforeFuture = before?.future?.length || 0;
                canvasActionsRef.current.redo();
                await waitForHostState(() => {
                    const current = canvasStateRef.current.history[projectId];
                    return (current?.past?.length || 0) !== beforePast
                        || (current?.future?.length || 0) !== beforeFuture;
                });
            },
        },
        preferences: {
            getGenerationDefaults: () => {
                const config = configRef.current || {};
                return {
                    mode: config.mode,
                    aspectRatio: config.aspectRatio,
                    imageSize: config.imageSize,
                    parallelCount: config.parallelCount,
                    enablePromptOptimization: config.enablePromptOptimization,
                    enableGrounding: config.enableGrounding,
                    enableImageSearch: config.enableImageSearch,
                    thinkingMode: config.thinkingMode,
                };
            },
            updateGenerationDefaults: async (patch) => {
                const setter = setConfigRef.current;
                if (typeof setter !== 'function') throw new Error('Generation preferences are unavailable.');
                setter((previous: Record<string, unknown>) => ({ ...previous, ...patch }));
                await waitForHostState(() => Object.entries(patch).every(([field, value]) => (
                    configRef.current?.[field] === value
                )));
            },
        },
        account: {
            getAccountSummary: () => ({
                ownerId: getRuntimeOwnerId(),
                authenticated: Boolean(accountRef.current.user),
                apiKeyStatus: accountRef.current.apiKeyStatus as 'missing' | 'configured_masked',
            }),
            getBillingSummary: () => ({
                available: Number.isFinite(Number(accountRef.current.balance)),
                balance: Number.isFinite(Number(accountRef.current.balance)) ? Number(accountRef.current.balance) : null,
                unit: 'credits',
            }),
        },
        assets: {
            getSnapshot: () => useAssetStore.getState().getAssetsSummary(),
        },
    }), [waitForHostState]);

    const [selectedModel, setSelectedModel] = useSelectedChatModelState(KKAI_FEATURE_FLAGS.billing);

    return (
        <AITakeoverProvider
            currentPage={resolveAssistantWorkspaceSurface(props.workspaceSurface)}
            activeCanvas={activeCanvas}
            selectedModel={selectedModel}
            selectedNodeIds={selectedNodeIds}
            addPromptNode={addPromptNode}
            updatePromptNode={updatePromptNode}
            deletePromptNode={deletePromptNode}
            updateNodes={updateNodes}
            createCard={createCard}
            convertDrawingsToNote={convertDrawingsToNote}
            updateWorkflowNode={updateWorkflowNode}
            rasterizeNote={rasterizeNote}
            executeGeneration={executeGeneration}
            getNextCardPosition={getNextCardPosition}
            arrangeAllNodes={arrangeAllNodes}
            addGroup={addGroup}
            updateGroup={updateGroup}
            setNodeTags={setNodeTags}
            selectNodes={selectNodes}
            setConfig={props.setConfig || (() => {})}
            onOpenSettings={props.onOpenSettings}
            openLibrarySurface={props.openLibrarySurface}
            openFavoritesSurface={props.openFavoritesSurface}
            openProfileSurface={props.openProfileSurface}
            focusWorkspace={props.focusWorkspace}
            apiKeyStatus={apiKeyStatus}
            balance={balance}
            notify={notify}
            config={props.config}
            ecommerceState={props.ecommerceState}
            onGenerate={props.onGenerate}
            canvasTransform={props.canvasTransform}
            canvasRef={props.canvasRef}
            openToolWindowInstance={props.openToolWindowInstance}
            updateToolWindowLayout={props.updateToolWindowLayout}
            setPptEditorMode={props.setPptEditorMode}
            togglePinTool={props.togglePinTool}
            siteCapabilities={siteCapabilities}
        >
            <ChatSidebarInner
                {...props}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
            />
        </AITakeoverProvider>

    );
};

const ChatSidebar: React.FC<ChatSidebarProps> = (props) => {
    return <ChatSidebarLoaded {...props} />;
};

export default ChatSidebar;
