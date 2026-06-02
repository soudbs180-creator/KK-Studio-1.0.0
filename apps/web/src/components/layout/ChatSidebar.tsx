
import React, { useDeferredValue, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowUp, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, FileText, Film, GitBranch, Layout, Loader2, MessageSquare, Mic, Pencil, Plus, RotateCcw, Square, User, X, Search, Download, Upload, Archive, Edit2, Trash2, Minus, Cpu } from 'lucide-react';
import { generateImage } from '../../services/llm/geminiService';
import { llmService } from '../../services/llm/LLMService';
import { notify } from '../../services/system/notificationService';
import { keyManager } from '../../services/auth/keyManager';
import {
    isCapabilityRouteAssignmentModelDisabled,
    resolveEnabledCapabilityRouteAssignment,
    subscribeCapabilityRouteAssignments,
} from '../../services/api/capabilityRouteAssignments';
import { KKAI_FEATURE_FLAGS } from '../../app/kkaiFeatureFlags';
import { agentService, type AgentConfig} from '../../services/chat/agentService';
import { getModelDisplayInfo, getModelThemeColor } from '../../services/model/modelCapabilities';
import { getModelCredits } from '../../services/model/modelPricing';
import { refreshModelLibraryData } from '../../services/model/modelLibraryRefresh';
import { formatRemainingCredits } from '../../services/billing/remainingBalance';
import { toggleModelPin, getPinnedModels, filterAndSortModels } from '../../utils/modelSorting';
import { writeTextToClipboard } from '../../utils/clipboard';
import ReactDOM from 'react-dom';
import { AspectRatio, ImageSize, PromptNode } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useCanvas } from '../../context/CanvasContext';
import { useImageGeneration } from '../../hooks/useImageGeneration';
import { getCardDimensions } from '../../utils/styleUtils';
import ModelLogo from '../common/ModelLogo';
import { AITakeoverProvider, useAITakeover, AIAssistantDock, AITakeoverToggle } from '../../features/ai-takeover';

interface ChatSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    onClose?: () => void;
    isMobile: boolean;
    onOpenSettings?: (view?: 'api-management') => void;
    onHoverChange?: (isHovered: boolean) => void; // 通知父组件hover状态变化
    onWidthChange?: (width: number) => void;
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

// 附件类型
interface Attachment {
    id: string;
    type: 'image' | 'document' | 'video' | 'audio' | 'url';
    name: string;
    data: string; // base64 或 URL
    mimeType?: string;
    size?: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string; // 可能是Markdown文本，也可能包含图片Markdown
    timestamp: number;
    attachments?: Attachment[]; // 附件列表
    isImageGeneration?: boolean; // 标记是否为图片生成结果
    modelId?: string; // 生成该消息的供应商模型ID
}

interface ChatModel {
    id: string;
    name: string;
    provider: string;
    isCustom: boolean;
    isSystemInternal?: boolean;
    type?: 'chat' | 'image' | 'video' | 'image+chat' | 'audio';  // ✨ 支持多模态
    icon?: string;
    displayName?: string;
    description?: string;
    creditCost?: number;
}

interface ChatSessionItem {
    id: string;
    title: string;
    messages: Message[];
    updatedAt: number;
    customTitle?: boolean;
    parentSessionId?: string;
    branchFromMessageId?: string;
    archived?: boolean;
}

interface SessionContextMenu {
    x: number;
    y: number;
    sessionId: string;
}

type SessionImportMode = 'replace' | 'append' | 'smart';

interface SessionImportPreview {
    sessions: ChatSessionItem[];
    activeSessionId?: string;
    stats: {
        imported: number;
        conflictsById: number;
        duplicatesByFingerprint: number;
        newById: number;
        conflictTitles: string[];
        duplicateTitles: string[];
        newTitles: string[];
        conflictIds: string[];
        duplicateIds: string[];
        newIds: string[];
        conflictPairs: Array<{ incoming: string; existing: string }>;
        duplicatePairs: Array<{ incoming: string; existing: string }>;
    };
}

const CHAT_SESSION_STORAGE_KEY = 'kk_chat_sidebar_sessions_v1';
const CHAT_SESSION_TREE_EXPAND_KEY = 'kk_chat_sidebar_tree_expand_v1';
const MODEL_MENU_SKELETON_COUNT = 3;

type ModelMenuLoadingState = 'idle' | 'refreshing_with_cache' | 'bootstrapping_without_cache';

const createWelcomeMessage = (): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是 KK Studio 数字助手。\n有什么我可以帮您？\n\n试试输入 "/image 一只猫" 来生成图片！',
    timestamp: Date.now()
});

const getSessionTitle = (messages: Message[]): string => {
    const firstUser = messages.find(m => m.role === 'user' && m.content && m.content !== '(附件)');
    if (!firstUser) return '新对话';
    return firstUser.content.slice(0, 18);
};

const formatSessionMeta = (session: ChatSessionItem): string => {
    const count = Math.max(0, (session.messages || []).filter(m => m.id !== 'welcome').length);
    const date = new Date(session.updatedAt || Date.now());
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${count}条 · ${hh}:${mm}`;
};

const makeSessionFingerprint = (session: ChatSessionItem): string => {
    const lastMsg = (session.messages || [])[session.messages.length - 1];
    const lastContent = (lastMsg?.content || '').slice(0, 64);
    const messageCount = (session.messages || []).length;
    return `${session.title || ''}::${messageCount}::${lastContent}`;
};

const getSessionLabel = (session: ChatSessionItem): string => {
    const title = session.title || '未命名会话';
    const count = Math.max(0, (session.messages || []).filter(m => m.id !== 'welcome').length);
    return `${title} (${count})`;
};

const ensureUniqueIds = (existing: ChatSessionItem[], imported: ChatSessionItem[]): ChatSessionItem[] => {
    const used = new Set(existing.map(s => s.id));
    const idMap = new Map<string, string>();

    const withIds = imported.map((s, idx) => {
        let nextId = s.id || `session_import_${Date.now()}_${idx}`;
        if (used.has(nextId)) {
            nextId = `${nextId}_import_${Date.now()}_${idx}`;
        }
        used.add(nextId);
        idMap.set(s.id, nextId);
        return { ...s, id: nextId };
    });

    return withIds.map(session => ({
        ...session,
        parentSessionId: session.parentSessionId ? (idMap.get(session.parentSessionId) || session.parentSessionId) : undefined
    }));
};

const buildImportPreview = (existing: ChatSessionItem[], imported: ChatSessionItem[]): SessionImportPreview['stats'] => {
    const existingById = new Map(existing.map(s => [s.id, s]));
    const existingByFp = new Map(existing.map(s => [makeSessionFingerprint(s), s]));

    let conflictsById = 0;
    let duplicatesByFingerprint = 0;
    let newById = 0;
    const conflictTitles: string[] = [];
    const duplicateTitles: string[] = [];
    const newTitles: string[] = [];
    const conflictIds: string[] = [];
    const duplicateIds: string[] = [];
    const newIds: string[] = [];
    const conflictPairs: Array<{ incoming: string; existing: string }> = [];
    const duplicatePairs: Array<{ incoming: string; existing: string }> = [];

    imported.forEach(session => {
        const existingBySameId = existingById.get(session.id);
        if (existingBySameId) {
            conflictsById += 1;
            conflictTitles.push(getSessionLabel(session));
            conflictIds.push(session.id);
            if (conflictPairs.length < 20) {
                conflictPairs.push({ incoming: getSessionLabel(session), existing: getSessionLabel(existingBySameId) });
            }
        } else {
            newById += 1;
            newTitles.push(getSessionLabel(session));
            newIds.push(session.id);
        }

        const fp = makeSessionFingerprint(session);
        const existingBySameFp = existingByFp.get(fp);
        if (existingBySameFp) {
            duplicatesByFingerprint += 1;
            duplicateTitles.push(getSessionLabel(session));
            duplicateIds.push(session.id);
            if (duplicatePairs.length < 20) {
                duplicatePairs.push({ incoming: getSessionLabel(session), existing: getSessionLabel(existingBySameFp) });
            }
        }
    });

    return {
        imported: imported.length,
        conflictsById,
        duplicatesByFingerprint,
        newById,
        conflictTitles,
        duplicateTitles,
        newTitles,
        conflictIds,
        duplicateIds,
        newIds,
        conflictPairs,
        duplicatePairs
    };
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

type AgentIntent = 'qa' | 'image-generate' | 'image-edit';

const buildAgentSystemPrompt = (customPrompt?: string): string => {
    const base = customPrompt?.trim() || '你是一个专业、友好的AI助手。请用简洁明了的方式回答用户的问题。';
    return `${base}\n\n你当前处于“全能Agent模式”，请遵循以下执行框架：\n1) 先识别意图：问答 / 生成图片 / 修改图片 / 文档任务。\n2) 若为问答：给出结论+关键依据+可执行步骤。\n3) 若为创作请求：先补全关键缺失信息（构图、主体、光线、风格），再给出最终可执行指令。\n4) 若为图片编辑：优先保留主体身份与风格一致性，明确“保留项/修改项/禁止项”。\n5) 输出风格：结构化、可执行、不过度啰嗦。\n6) 不确定时主动给出最合理假设，不要空泛追问。`;
};

interface AgentActionPlan {
    intent: AgentIntent;
    prompt: string;
    confidence: number;
    reason?: string;
}

const pickPlannerModelId = (models: ChatModel[], selected: ChatModel): string | null => {
    if (selected.type === 'chat' || selected.type === 'image+chat') return selected.id;
    const fallback = models.find(m => m.type === 'chat' || m.type === 'image+chat');
    return fallback?.id || null;
};

const buildAvailableChatModels = (includeSystemCreditModels = true): ChatModel[] => {
    const rawModels = keyManager.getGlobalModelList().filter(model => {
        if (model.isSystemInternal && !includeSystemCreditModels) return false;

        const idLower = model.id.toLowerCase();

        // 🚀 Allow Image Models (for /image command usage)
        if (model.type === 'image') return true;
        if (model.type === 'video') return false;

        if (idLower.includes('flux') || idLower.includes('midjourney') || idLower.includes('dall-e') || idLower.includes('stable-diffusion') || idLower.includes('sdxl')) return false;
        if (idLower.includes('nano') && idLower.includes('banana') && model.type !== 'image+chat') return false;

        return model.type === 'chat' || model.type === 'image+chat';
    });

    const uniqueMap = new Map<string, ChatModel>();
    rawModels.forEach(model => {
        if (!uniqueMap.has(model.id)) {
            uniqueMap.set(model.id, model);
        }
    });

    return Array.from(uniqueMap.values());
};

const extractJson = (raw: string): any => {
    const txt = (raw || '').trim();
    try {
        return JSON.parse(txt);
    } catch {
        const s = txt.indexOf('{');
        const e = txt.lastIndexOf('}');
        if (s >= 0 && e > s) {
            return JSON.parse(txt.slice(s, e + 1));
        }
    }
    throw new Error('Planner returned invalid JSON');
};

const planAgentAction = async (
    plannerModelId: string,
    userText: string,
    atts: Attachment[]
): Promise<AgentActionPlan> => {
    const attachmentSummary = atts.map(a => `${a.type}:${a.name}`).join(', ') || 'none';
    const plannerSystem = `You are an intent planner for an AI assistant.
Decide action intent from user request and attachments.
Allowed intents: qa, image-generate, image-edit.
Rules:
1) image-edit requires image attachment and an edit request.
2) image-generate is for creating new image from text.
3) otherwise qa.
Return STRICT JSON only:
{"intent":"qa|image-generate|image-edit","prompt":"string","confidence":0-1,"reason":"short"}`;

    const plannerUser = `User text:\n${userText}\n\nAttachments:\n${attachmentSummary}`;
    const plannedRaw = await llmService.chat({
        modelId: plannerModelId,
        messages: [
            { role: 'system', content: plannerSystem },
            { role: 'user', content: plannerUser }
        ],
        stream: false,
        temperature: 0.1,
        maxTokens: 300
    });

    const planned = extractJson(plannedRaw);
    const intent = (planned?.intent || 'qa') as AgentIntent;
    const prompt = String(planned?.prompt || userText).trim() || userText;
    const confidence = Number(planned?.confidence || 0.5);

    if (intent !== 'qa' && intent !== 'image-generate' && intent !== 'image-edit') {
        return { intent: 'qa', prompt: userText, confidence: 0.3, reason: 'fallback-invalid-intent' };
    }

    return {
        intent,
        prompt,
        confidence: Number.isFinite(confidence) ? confidence : 0.5,
        reason: planned?.reason
    };
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

const resolveAssistantCapabilityRoute = () => resolveEnabledCapabilityRouteAssignment('assistant');

const ChatSidebarInner: React.FC<ChatSidebarProps> = ({ isOpen, onToggle, onClose, isMobile, onOpenSettings, onHoverChange, onWidthChange }) => {
    const { aiTakeoverMode } = useAITakeover();

    useEffect(() => {
        if (aiTakeoverMode) {
            onWidthChange?.(380);
        } else {
            onWidthChange?.(420);
        }
    }, [aiTakeoverMode, onWidthChange]);

    if (aiTakeoverMode) {
        return (
            <div
                className="fixed inset-y-0 right-0 z-50 flex flex-col transition-all duration-300 ease-out animate-in fade-in slide-in-from-right duration-300"
                style={{ width: '380px', minWidth: '380px', maxWidth: '380px', pointerEvents: 'auto' }}
            >
                <AIAssistantDock />
            </div>
        );
    }

    const { user, isTempUser, loading: authLoading } = useAuth();
    const { balance, loading: billingLoading, setShowRechargeModal } = useBilling();
    const { activeCanvas, addPromptNode, getNextCardPosition } = useCanvas();
    const { executeGeneration } = useImageGeneration({
        isMobile,
        getCardDimensions: (ratio, hasToolbar) => getCardDimensions(ratio, hasToolbar),
        rememberPreferredKeyForMode: () => {}
    });
    const remainingBalanceDisplay = billingLoading ? '...' : formatRemainingCredits(balance, 'zh-CN');

    // 简体中文：跳转与高亮定位交互处理器
    const handleActionClick = useCallback((url: string) => {
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
                    notify.success('已为您高亮定位对应操作区域');
                } else {
                    notify.warning('未找到对应界面元素，请先展开相应功能区');
                }
            }, 100);
        } else if (url === 'action://open-recharge') {
            setShowRechargeModal(true);
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
                    notify.success('已为您打开设置并定位至 API 密钥输入框');
                } else {
                    notify.warning('已打开 API 管理，请手动在下方输入框填写密钥');
                }
            }, 300);
        } else if (url === 'action://open-settings') {
            if (onOpenSettings) onOpenSettings();
        } else if (url.startsWith('action://takeover-bulk-generate')) {
            // 解析 prompts 参数
            let prompts: string[] = [];
            try {
                // URL 构造函数需要合法 scheme，所以我们将 action:// 替换为 http://dummy
                const parsedUrl = new URL(url.replace('action://', 'http://dummy'));
                const promptsParam = parsedUrl.searchParams.get('prompts') || '';
                prompts = promptsParam.split(',').map(p => p.trim()).filter(Boolean);
            } catch (err) {
                console.error('Parse takeover-bulk-generate url failed:', err);
            }

            if (prompts.length === 0) {
                notify.warning('AI接管失败', '未解析到有效的提示词');
                return;
            }

            notify.success(`AI接管：正在自动为您批量生成 ${prompts.length} 张图片`);

            // 异步执行批量生成
            (async () => {
                try {
                    const lastPos = getNextCardPosition();
                    for (let i = 0; i < prompts.length; i++) {
                        const promptText = prompts[i];
                        // 偏移 x 坐标，使得卡片水平排列，避免重叠
                        const pos = {
                            x: lastPos.x + i * 420, // 400px 卡片宽度 + 20px 间距
                            y: lastPos.y
                        };

                        const newNode: PromptNode = {
                            id: 'takeover_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 9),
                            prompt: promptText,
                            position: pos,
                            aspectRatio: AspectRatio.SQUARE,
                            imageSize: ImageSize.SIZE_1K,
                            model: selectedModel.id as any,
                            modelLabel: getModelDisplayInfo(selectedModel).displayName,
                            provider: selectedModel.provider,
                            childImageIds: [],
                            timestamp: Date.now(),
                            parallelCount: 1,
                            isGenerating: true
                        };

                        await addPromptNode(newNode);
                        await new Promise(resolve => setTimeout(resolve, 300));
                        void executeGeneration(newNode);
                    }
                } catch (e: any) {
                    console.error('Takeover bulk generation error:', e);
                    notify.error('批量生成失败', e.message);
                }
            })();
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
                notify.success(`AI接管：已为您平滑定位到包含“${keyword}”的卡片`);
            } else {
                notify.warning('AI接管定位', `未在当前画布上找到包含“${keyword}”的卡片`);
            }
        }
    }, [onOpenSettings, setShowRechargeModal, addPromptNode, getNextCardPosition, selectedModel, executeGeneration, activeCanvas]);

    // 简体中文：解析 action 链接，生成交互按钮
    const renderMessageContent = useCallback((content: string) => {
        const regex = /\[([^\]]+)\]\((action:\/\/[^\)]+)\)/g;
        const parts = [];
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
                    key={match.index}
                    onClick={() => handleActionClick(actionUrl)}
                    className="inline-flex items-center gap-1 mx-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 active:scale-95 transition-all shadow-[0_2px_8px_rgba(99,102,241,0.3)] select-none cursor-pointer"
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
    const resolveAssistantPreferredModel = useCallback((models: ChatModel[]) => {
        const selectableModels = models.filter((model) => !isCapabilityRouteAssignmentModelDisabled('assistant', model.id));
        const assignment = resolveAssistantCapabilityRoute();
        const preferredModelId = String(assignment?.primaryModelId || '').trim();
        if (!preferredModelId) {
            return selectableModels[0] || { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', isCustom: false };
        }

        const exact = selectableModels.find((model) => model.id === preferredModelId);
        if (exact) {
            return exact;
        }

        const suffix = preferredModelId.split('@')[1];
        if (suffix) {
            const matched = selectableModels.find((model) => model.id.endsWith(`@${suffix}`));
            if (matched) {
                return matched;
            }
        }

        return selectableModels[0] || { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', isCustom: false };
    }, []);
    const resolveAssistantPreferredKeyId = useCallback(() => {
        const assignment = resolveAssistantCapabilityRoute();
        const preferredRouteId = String(assignment?.primaryRouteId || '').trim();
        if (!preferredRouteId) {
            return undefined;
        }
        return keyManager.getKey(preferredRouteId) ? preferredRouteId : undefined;
    }, []);

    // 1. Model State Management
    // ✨ 支持多模态模型 (image+chat) + 🚀 去重
    const [availableModels, setAvailableModels] = useState<ChatModel[]>(() => buildAvailableChatModels(canBrowseSystemCreditModels));
    const [selectedModel, setSelectedModel] = useState<ChatModel>(() => resolveAssistantPreferredModel(availableModels));
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

    // Agent State Management
    const [agentMode, setAgentMode] = useState(false);
    const { aiTakeoverMode, setAiTakeoverMode, setSelectedModel: ctxSetSelectedModel } = useAITakeover();
    const [currentAgent, setCurrentAgent] = useState<AgentConfig | null>(() => agentService.getActive());

    // 简体中文：实时同步选择的生图模型给 AI 接管 Context
    useEffect(() => {
        if (selectedModel) {
            ctxSetSelectedModel(selectedModel);
        }
    }, [selectedModel, ctxSetSelectedModel]);

    // 简体中文：记录已自动执行过的消息 Action，防止重复执行
    const executedMessageIdsRef = useRef<Set<string>>(new Set());

    // 简体中文：AI接管模式下的动作自动拦截并静默执行
    useEffect(() => {
        if (!aiTakeoverMode || !messages || messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage.role === 'assistant' && !executedMessageIdsRef.current.has(lastMessage.id)) {
            executedMessageIdsRef.current.add(lastMessage.id);
            
            const actionRegex = /action:\/\/[^\s\)\"\]]+/g;
            const matches = lastMessage.content.match(actionRegex);
            if (matches && matches.length > 0) {
                matches.forEach(actionUrl => {
                    setTimeout(() => {
                        handleActionClick(actionUrl);
                    }, 200);
                });
            }
        }
    }, [messages, aiTakeoverMode, handleActionClick]);

    // Subscribe to keyManager updates
    const lastPreferredModelIdRef = useRef<string>('');
    useEffect(() => {
        const updateModels = () => {
            const models = buildAvailableChatModels(canBrowseSystemCreditModels);
            setAvailableModels(models);

            if (models.length > 0) {
                const assistantPreferredModel = resolveAssistantPreferredModel(models);
                const assignment = resolveAssistantCapabilityRoute();
                const preferredModelId = String(assignment?.primaryModelId || '').trim();

                // 简体中文：如果最新获取到的首选模型ID与上次记录的不同，说明能力分配被修改，我们强行同步切换默认模型
                if (preferredModelId && preferredModelId !== lastPreferredModelIdRef.current) {
                    lastPreferredModelIdRef.current = preferredModelId;
                    const match = models.find(m => m.id === preferredModelId);
                    if (match) {
                        setSelectedModel(match);
                        return;
                    }
                }

                const exists = models.find(m => m.id === selectedModel.id);
                const staleDisabledCapabilityModel = isCapabilityRouteAssignmentModelDisabled('assistant', selectedModel.id);
                if (!exists || staleDisabledCapabilityModel) {
                    setSelectedModel(assistantPreferredModel);
                } else {
                    if (exists.name !== selectedModel.name || exists.description !== selectedModel.description) {
                        setSelectedModel(exists);
                    }
                }
            }
        };

        updateModels();
        const unsubscribeKeys = keyManager.subscribe(updateModels);
        const unsubscribeAssignments = subscribeCapabilityRouteAssignments(updateModels);
        return () => {
            unsubscribeKeys();
            unsubscribeAssignments();
        };
    }, [canBrowseSystemCreditModels, resolveAssistantPreferredModel, selectedModel.id]);

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

    // 2. Chat State
    const [sessions, setSessions] = useState<ChatSessionItem[]>(() => {
        try {
            const raw = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch {
            // ignore
        }

        return [{
            id: `session_${Date.now()}`,
            title: '新对话',
            messages: [createWelcomeMessage()],
            updatedAt: Date.now()
        }];
    });
    const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || `session_${Date.now()}`);
    const [messages, setMessages] = useState<Message[]>(() => sessions[0]?.messages || [createWelcomeMessage()]);
    const [sessionSearch, setSessionSearch] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [importPreview, setImportPreview] = useState<SessionImportPreview | null>(null);
    const [importPreviewSearch, setImportPreviewSearch] = useState('');
    const [importPreviewShowAll, setImportPreviewShowAll] = useState(false);
    const [importExcludedIds, setImportExcludedIds] = useState<string[]>([]);
    const [importPreviewOnlyExcluded, setImportPreviewOnlyExcluded] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
        try {
            const raw = localStorage.getItem(CHAT_SESSION_TREE_EXPAND_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sessionImportRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [isDropActive, setIsDropActive] = useState(false);

    // 3. Layout State
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        // [NEW] Added width sync
        setTimeout(() => onWidthChange && onWidthChange(
            Math.max(320, parseInt(localStorage.getItem('kk_chat_width') || '420', 10))
        ), 0);

        const saved = localStorage.getItem('kk_chat_width');
        return saved ? Math.max(320, parseInt(saved, 10)) : 420;
    });

    // 🚀 Sync width to parent in real-time during live resize drag
    useEffect(() => {
        if (onWidthChange) {
            onWidthChange(sidebarWidth);
        }
    }, [sidebarWidth, onWidthChange]);


    // 4. Drag State (must be declared before scheduleAutoClose uses it)
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const startPosRef = useRef({ x: 0, y: 0 });

    // 简体中文：侧边栏宽度拉伸调整相关状态与 Refs
    const [isResizing, setIsResizing] = useState(false);
    const dragStartWidthRef = useRef(420);
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

    const sessionMap = useMemo(() => {
        const map = new Map<string, ChatSessionItem>();
        sessions.forEach(session => map.set(session.id, session));
        return map;
    }, [sessions]);

    const activeSession = useMemo(() => {
        return sessions.find(s => s.id === activeSessionId) || null;
    }, [sessions, activeSessionId]);

    const activeBranchTrail = useMemo(() => {
        if (!activeSession) return [] as ChatSessionItem[];
        const trail: ChatSessionItem[] = [];
        let cursor: ChatSessionItem | undefined | null = activeSession;
        const guard = new Set<string>();

        while (cursor && !guard.has(cursor.id)) {
            trail.unshift(cursor);
            guard.add(cursor.id);
            cursor = cursor.parentSessionId ? (sessionMap.get(cursor.parentSessionId) || null) : null;
        }
        return trail;
    }, [activeSession, sessionMap]);

    const sessionTreeRows = useMemo(() => {
        // 简体中文：支持通过 sessionSearch 对会话树进行过滤
        // 如果关键字不为空，我们需要确保只要会话标题或消息包含关键字，那么此节点以及它的所有祖辈节点都会保持可见
        const query = sessionSearch.toLowerCase().trim();
        const matchesQuery = (session: ChatSessionItem) => {
            if (!query) return true;
            const matchTitle = (session.title || '').toLowerCase().includes(query);
            const matchMessages = session.messages?.some(m => (m.content || '').toLowerCase().includes(query));
            return matchTitle || matchMessages;
        };

        const visibleSet = new Set<string>();
        if (query) {
            sessions.forEach(session => {
                if (matchesQuery(session)) {
                    let curr: ChatSessionItem | null = session;
                    while (curr) {
                        visibleSet.add(curr.id);
                        curr = curr.parentSessionId ? (sessionMap.get(curr.parentSessionId) || null) : null;
                    }
                }
            });
        }

        const visibleSessions = sessions.filter(session => {
            const matchArchive = showArchived || !session.archived;
            if (!matchArchive) return false;
            if (query) {
                return visibleSet.has(session.id);
            }
            return true;
        });

        const childMap = new Map<string, ChatSessionItem[]>();
        visibleSessions.forEach(session => {
            if (!session.parentSessionId) return;
            if (!childMap.has(session.parentSessionId)) childMap.set(session.parentSessionId, []);
            childMap.get(session.parentSessionId)!.push(session);
        });

        childMap.forEach(list => list.sort((a, b) => b.updatedAt - a.updatedAt));

        const roots = visibleSessions
            .filter(session => !session.parentSessionId || !sessionMap.has(session.parentSessionId))
            .sort((a, b) => b.updatedAt - a.updatedAt);

        const rows: Array<{ session: ChatSessionItem; depth: number; hasChildren: boolean }> = [];
        const activePath = new Set(activeBranchTrail.map(item => item.id));

        const dfs = (session: ChatSessionItem, depth: number) => {
            const children = childMap.get(session.id) || [];
            const hasChildren = children.length > 0;
            rows.push({ session, depth, hasChildren });

            // 简体中文：在搜索模式下，匹配的会话及其祖先被展示出来，如果未手动展开，我们默认在搜索状态下展开其祖辈路径，以便展现匹配项
            const expanded = query ? true : (expandedNodes[session.id] ?? (depth === 0 || activePath.has(session.id)));
            if (!expanded) return;

            children.forEach(child => dfs(child, depth + 1));
        };

        roots.forEach(root => dfs(root, 0));
        return rows;
    }, [activeBranchTrail, expandedNodes, sessionMap, sessions, showArchived, sessionSearch]);

    useEffect(() => {
        const active = sessions.find(s => s.id === activeSessionId);
        if (active) {
            setMessages(active.messages?.length ? active.messages : [createWelcomeMessage()]);
            return;
        }

        if (sessions.length > 0) {
            setActiveSessionId(sessions[0].id);
        }
    }, [activeSessionId, sessions]);

    useEffect(() => {
        setSessions(prev => prev.map(session => {
            if (session.id !== activeSessionId) return session;
            return {
                ...session,
                messages,
                title: session.customTitle ? session.title : getSessionTitle(messages),
                updatedAt: Date.now()
            };
        }));
    }, [messages, activeSessionId]);

    useEffect(() => {
        try {
            localStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
        } catch {
            // ignore
        }
    }, [sessions]);

    useEffect(() => {
        try {
            localStorage.setItem(CHAT_SESSION_TREE_EXPAND_KEY, JSON.stringify(expandedNodes));
        } catch {
            // ignore
        }
    }, [expandedNodes]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

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
                const newWidth = Math.max(320, Math.min(800, dragStartWidthRef.current + deltaX));
                setSidebarWidth(newWidth);
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            const deltaX = dragStartXRef.current - e.clientX;
            const newWidth = Math.max(320, Math.min(800, dragStartWidthRef.current + deltaX));
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
            const result = await generateImage(
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
        if ((!input.trim() && attachments.length === 0) || isThinking) return;

        const userText = input.trim();
        const hasKeys = keyManager.hasValidKeys();

        // 简体中文：AI接管拦截逻辑 - 如果开启了AI接管模式，并且离线(无 key) 或提问了画布基础操作，我们直接在本地匹配回答，不消耗 API，也不执行 ensureModelAccess 报错阻断
        if (aiTakeoverMode) {
            const localAnswer = matchLocalKnowledge(userText);
            
            // 如果未配置本地 API 密钥，且开启了接管模式，我们将匹配结果或通用指南输出，不发出远程网络请求
            if (!hasKeys) {
                const finalAnswer = localAnswer || `### 🔍 未能精确匹配到您的操作提问。
由于您当前未配置本地 API 密钥，且开启了**AI接管**，我为您准备了以下常见画布与报错指南：

- 🆕 [新建画布/项目](action://highlight-#btn-create-canvas)
- 💰 [充值积分](action://open-recharge)
- ⚙️ [配置 API 密钥](action://open-settings-api)
- 🔍 [定位包含“猫”的卡片](action://takeover-locate?keyword=猫)
- 🚀 [自动生成提示词“一只可爱的猫”](action://takeover-bulk-generate?prompts=一只可爱的猫)

您可以直接提问上述相关功能，或点击/让AI自动执行对应动作！`;

                const currentAttachments = [...attachments];
                const userMsg: Message = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: userText || '(附件)',
                    timestamp: Date.now(),
                    attachments: currentAttachments.length > 0 ? currentAttachments : undefined
                };
                setMessages(prev => [...prev, userMsg]);
                setInput('');
                setAttachments([]);

                setIsThinking(true);
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: `assistant_${Date.now()}`,
                        role: 'assistant',
                        content: finalAnswer,
                        timestamp: Date.now()
                    }]);
                    setIsThinking(false);
                }, 500);
                return;
            } else if (localAnswer) {
                // 有 API Key，但如果能匹配到精确的本地画布基础操作，我们也秒回，提升响应速度并节省 API
                const currentAttachments = [...attachments];
                const userMsg: Message = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: userText || '(附件)',
                    timestamp: Date.now(),
                    attachments: currentAttachments.length > 0 ? currentAttachments : undefined
                };
                setMessages(prev => [...prev, userMsg]);
                setInput('');
                setAttachments([]);

                setIsThinking(true);
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: `assistant_${Date.now()}`,
                        role: 'assistant',
                        content: localAnswer,
                        timestamp: Date.now()
                    }]);
                    setIsThinking(false);
                }, 400);
                return;
            }
        }

        if (!ensureModelAccess(selectedModel, '进行对话')) return;

        // ✨ 检查是否为生成图片指令
        // Regex: /image prompt OR 画 prompt OR 生成 prompt OR 画猫
        const imageRegex = /^(\/image|画|生成|draw|gen)[\s]*(.+)/i;
        const match = userText.match(imageRegex);

        const currentAttachments = [...attachments]; // 保存当前附件
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
        if (!agentMode && match && currentAttachments.length === 0) {
            const prompt = match[2];
            handleImageGeneration(prompt);
            return;
        }

        // Agent模式: 先做“思考式规划”，再执行路由
        if (agentMode) {
            try {
                const plannerModelId = pickPlannerModelId(availableModels, selectedModel);
                if (plannerModelId) {
                    const plan = await planAgentAction(plannerModelId, userText, currentAttachments);

                    if (plan.intent === 'image-generate') {
                        await handleImageGeneration(plan.prompt, currentAttachments);
                        return;
                    }

                    if (plan.intent === 'image-edit') {
                        await handleImageGeneration(plan.prompt, currentAttachments, 'edit');
                        return;
                    }
                }
            } catch (e) {
                console.warn('[Agent] Planning failed, fallback to normal chat:', e);
            }
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
            // 构建历史记录
            const history = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({ role: m.role, content: m.content }));

            // Agent模式:添加系统提示词
            if (agentMode && currentAgent) {
                history.unshift({ role: 'system' as any, content: buildAgentSystemPrompt(currentAgent.systemPrompt) });
            }

            // 简体中文：AI接管模式 - 注入项目理解系统上下文与可用操作动作链接
            if (aiTakeoverMode) {
                const systemTakeoverPrompt = `你当前处于“AI接管”模式。
[系统当前运行状态]
- 操作系统: Windows
- 用户登录状态: ${user ? '已登录' : '未登录'}
- 当前可用积分: ${balance}
- 本地专属 API 密钥状态: ${keyManager.hasValidKeys() ? '已配置' : '未配置'}
- 当前激活的模型 ID: ${selectedModel.id}

[AI接管指令与动作链接规范]
在接管模式下，你完全具备自动化操作、接管网页控制的特权。你可以通过在你的 Markdown 回答中嵌入交互式动作链接，浏览器会自动识别这些链接并在后台“自动帮用户点击运行”。
请尽一切可能利用这些动作链接实现用户的控制意图。每个回答可以嵌入一个或多个以下链接：

1. 批量在画布上建卡并执行生图：[批量生成提示词](action://takeover-bulk-generate?prompts=提示词1,提示词2,提示词3) 
   - 必须使用英文逗号分隔提示词列表。
   - 页面会在当前视口中心依次向右排开创建对应数量的 Prompt 卡片，并自动向后端拉起生成请求。
2. 搜索并快速平滑定位到画布上的卡片：[定位卡片](action://takeover-locate?keyword=提示词关键字)
   - 例如，如果用户说“帮我找到之前的那个画猫的卡片”或“我要查找那个狗的卡片”，你必须回答类似：‘好的，AI接管已启动，正在帮您在画布中搜寻并平滑定位包含“猫”的卡片... [正在自动定位](action://takeover-locate?keyword=猫)’。
3. 打开并高亮 API 密钥配置面板：[配置 API 密钥](action://open-settings-api)
   - 重要安全边界：绝对不允许要求用户把 API Key 发送在聊天框里，必须提示用户‘安全沙箱拦截：密钥需由您自行填写’，并自动触发该动作以高亮输入框引导用户填写。
4. 新建画布：[新建画布项目](action://highlight-#btn-create-canvas)
5. 充值积分：[去充值积分](action://open-recharge) 或高亮充值按钮：[高亮充值按钮](action://highlight-#btn-desktop-recharge)
6. 设置：[打开设置](action://open-settings) 或高亮设置按钮：[高亮设置按钮](action://highlight-#btn-desktop-settings)
7. 缩放控制：[高亮缩放控制](action://highlight-.desktop-zoom-rail)
8. 提示词输入框：[高亮提示词输入](action://highlight-#prompt-input-composer)

请结合当前的系统状态和用户的提问进行排障与自动控制，回答须精炼、极简、富有亲和力。`;
                history.unshift({ role: 'system' as any, content: systemTakeoverPrompt });
            }

            const { messageContent, inlineData } = buildMessageWithAttachments(userText, currentAttachments);

            history.push({ role: 'user', content: messageContent });

            // 调用API (传递附件数据)
            const responseText = await llmService.chat({
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

        const branchId = `session_${Date.now()}`;
        const branchTitle = `分支 · ${getSessionTitle(forkBase)}`;
        const branchSession: ChatSessionItem = {
            id: branchId,
            title: branchTitle,
            customTitle: true,
            messages: forkBase,
            updatedAt: Date.now(),
            parentSessionId: activeSessionId,
            branchFromMessageId: messages[index]?.id
        };

        setSessions(prev => [branchSession, ...prev]);
        setActiveSessionId(branchId);
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

        const history = messages
            .slice(0, userIndex)
            .filter(m => m.id !== 'welcome')
            .map(m => ({ role: m.role, content: m.content }));

        if (agentMode && currentAgent) {
            history.unshift({ role: 'system' as any, content: buildAgentSystemPrompt(currentAgent.systemPrompt) });
        }
        history.push({ role: 'user', content: messageContent });

        setIsThinking(true);
        registerActivity();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: '', modelId: selectedModel.id } : m)));

        try {
            const responseText = await llmService.chat({
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
    }, [agentMode, currentAgent, ensureModelAccess, isThinking, messages, registerActivity, resolveAssistantPreferredKeyId, selectedModel]);

    const handleNewSession = useCallback(() => {
        const id = `session_${Date.now()}`;
        const item: ChatSessionItem = {
            id,
            title: '新对话',
            messages: [createWelcomeMessage()],
            updatedAt: Date.now()
        };
        setSessions(prev => [item, ...prev]);
        setActiveSessionId(id);
        setInput('');
        setAttachments([]);
    }, []);

    const handleSwitchSession = useCallback((id: string) => {
        if (id === activeSessionId) return;
        setActiveSessionId(id);
        setInput('');
        setAttachments([]);
    }, [activeSessionId]);

    const handleDeleteSession = useCallback((id: string) => {
        if (sessions.length <= 1) {
            notify.warning('无法删除', '至少保留一个会话');
            return;
        }

        const next = sessions.filter(s => s.id !== id);
        setSessions(next);
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

        const cloned: ChatSessionItem = {
            ...target,
            id: `session_${Date.now()}`,
            title: `${target.title || '新对话'} 副本`,
            customTitle: true,
            updatedAt: Date.now(),
            archived: false
        };
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

        const byId = new Map<string, ChatSessionItem>();
        sessions.forEach(s => byId.set(s.id, s));
        importedSessions.forEach(s => {
            const prev = byId.get(s.id);
            if (!prev || (s.updatedAt || 0) >= (prev.updatedAt || 0)) {
                byId.set(s.id, s);
            }
        });

        const byFingerprint = new Map<string, ChatSessionItem>();
        Array.from(byId.values()).forEach(session => {
            const fp = makeSessionFingerprint(session);
            const prev = byFingerprint.get(fp);
            if (!prev || (session.updatedAt || 0) > (prev.updatedAt || 0)) {
                byFingerprint.set(fp, session);
            }
        });

        const smartMerged = Array.from(byFingerprint.values())
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 50);
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
                const parsed = JSON.parse(String(reader.result || '{}'));
                if (!parsed || !Array.isArray(parsed.sessions)) {
                    throw new Error('格式不正确');
                }
                const importedSessions: ChatSessionItem[] = parsed.sessions.map((s: any, idx: number) => ({
                    id: s.id || `session_import_${Date.now()}_${idx}`,
                    title: s.title || '导入会话',
                    messages: Array.isArray(s.messages) && s.messages.length > 0 ? s.messages : [createWelcomeMessage()],
                    updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
                    customTitle: !!s.customTitle,
                    parentSessionId: s.parentSessionId,
                    branchFromMessageId: s.branchFromMessageId,
                    archived: !!s.archived
                }));

                if (importedSessions.length === 0) throw new Error('没有可导入会话');
                setImportPreview({
                    sessions: importedSessions,
                    activeSessionId: parsed.activeSessionId,
                    stats: buildImportPreview(sessions, importedSessions)
                });
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
                    className="fixed right-0 top-1/2 -translate-y-1/2 z-[2000] flex items-center justify-center w-6 h-12 rounded-l-lg border-l border-t border-b border-[var(--frost-card-framework-border)] hover:bg-[var(--toolbar-hover)] transition-all group shadow-md"
                    style={{
                        background: 'var(--frost-card-framework-bg)',
                        borderColor: 'var(--frost-card-framework-border)',
                        borderWidth: '1px 0 1px 1px',
                        borderStyle: 'solid',
                        backdropFilter: 'blur(var(--frost-card-framework-blur, 20px)) saturate(160%)',
                        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur, 20px)) saturate(160%)',
                    }}
                    title="展开 AI 助手"
                >
                    <ChevronLeft size={16} className="text-[var(--text-secondary)] transition-transform group-hover:-translate-x-0.5" />
                </button>
            )}

            {/* 2. Chat Card Popover (Morph Transformation) */}
            {isOpen && (
                <div
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
                    className={`fixed z-[9999] flex flex-col ${isMobile
                        ? 'left-0 right-0 top-0 bottom-0 border-none pb-0'
                        : 'top-0 right-0 bottom-0 border-l border-[var(--border-light)]'
                        }`}
                    style={isMobile ? {
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
                        // Full height sidebar on the right
                        width: `${sidebarWidth}px`,
                        background: 'var(--frost-card-framework-bg)',
                        borderColor: 'var(--frost-card-framework-border)',
                        boxShadow: 'var(--frost-card-framework-shadow)',
                        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                        transform: 'translateX(0)',
                        transition: 'transform 0.3s ease-out'
                    }}
                >
                    {/* 侧边栏展开时吸附在最左侧外边缘的收缩按钮 */}
                    {!isMobile && (
                        <button
                            onClick={onToggle}
                            className="absolute -left-6 top-1/2 -translate-y-1/2 z-[2000] flex items-center justify-center w-6 h-12 rounded-l-lg border-l border-t border-b border-[var(--frost-card-framework-border)] hover:bg-[var(--toolbar-hover)] transition-all group shadow-md"
                            style={{
                                background: 'var(--frost-card-framework-bg)',
                                borderColor: 'var(--frost-card-framework-border)',
                                borderWidth: '1px 0 1px 1px',
                                borderStyle: 'solid',
                                backdropFilter: 'blur(var(--frost-card-framework-blur, 20px)) saturate(160%)',
                                WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur, 20px)) saturate(160%)',
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
                                    onClick={onClose || onToggle}
                                    className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:bg-[var(--toolbar-hover)] rounded-full transition-colors flex items-center justify-center shrink-0"
                                    title="返回"
                                >
                                    <ChevronLeft size={22} />
                                </button>
                            ) : null}

                            {/* 中间：会话标题重命名 */}
                            <div className={`flex-1 min-w-0 flex items-center ${isMobile ? 'justify-center px-2' : 'gap-2'}`}>
                                <button
                                    onClick={() => handleRenameSession(activeSessionId)}
                                    className={`flex items-center max-w-full group hover:bg-[var(--toolbar-hover)] px-2.5 py-1 rounded-lg transition-colors cursor-text ${isMobile ? 'justify-center gap-1.5' : 'gap-2'}`}
                                    title="点击重命名"
                                >
                                    {!isMobile && <MessageSquare size={16} className="text-[var(--primary)] shrink-0" />}
                                    <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                        {activeSession?.title || '新对话'}
                                    </span>
                                </button>
                            </div>

                            {/* 右侧：控制动作组 */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={handleNewSession}
                                    className="p-1.5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-md transition-colors"
                                    title="新建对话"
                                >
                                    <Plus size={18} />
                                </button>
                                <button
                                    onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                                    className={`p-1.5 flex items-center justify-center rounded-md transition-colors ${showHistoryPanel ? 'text-[var(--primary)] bg-[var(--primary-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)]'}`}
                                    title="历史记录与分支"
                                >
                                    <Layout size={18} />
                                </button>
                            </div>
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
                                            onClick={handleExportSessions}
                                            className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                            title="导出全部会话"
                                        >
                                            <Download size={14} />
                                        </button>
                                        <button
                                            onClick={() => sessionImportRef.current?.click()}
                                            className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                            title="导入会话"
                                        >
                                            <Upload size={14} />
                                        </button>
                                        <button
                                            onClick={() => setShowArchived(prev => !prev)}
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
                                                        onClick={() => toggleSessionExpand(row.session.id)}
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
                                                onClick={() => handleSwitchSession(row.session.id)}
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
                                                    onClick={() => handleRenameSession(row.session.id)}
                                                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
                                                    title="重命名"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleArchiveSession(row.session.id)}
                                                    className="p-1 rounded text-[var(--text-tertiary)] hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                                    title={row.session.archived ? '取消归档' : '归档'}
                                                >
                                                    <Archive size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSession(row.session.id)}
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
                        {messages.map((msg, idx) => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${msg.role === 'user'
                                    ? 'bg-[var(--frost-card-sub-bg)] border border-[var(--frost-card-sub-border)]'
                                    : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white'
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
                                                    onClick={() => handleEditResend(msg)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                    title="编辑后重发"
                                                >
                                                    <Pencil size={12} />
                                                    {!isMobile && <span>编辑</span>}
                                                </button>
                                            )}
                                            {msg.role === 'assistant' && idx === lastAssistantIndex && (
                                                <button
                                                    onClick={() => handleRegenerateAssistant(msg.id)}
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
                                                    onClick={() => handleEditFromAssistant(msg.id)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                    title="编辑上一条提问"
                                                >
                                                    <Pencil size={12} />
                                                    {!isMobile && <span>编辑提问</span>}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleBranchFrom(idx)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                title="从当前消息创建分支"
                                            >
                                                <GitBranch size={12} />
                                                {!isMobile && <span>分支</span>}
                                            </button>
                                            <button
                                                onClick={() => handleCopyMessage(msg)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                                title="复制消息文本"
                                            >
                                                {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                                                {!isMobile && <span>{copiedMessageId === msg.id ? '已复制' : '复制'}</span>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isThinking && !(
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
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Bottom Area */}
                    <div
                        className="px-4 pb-4 pt-2 shrink-0 flex flex-col"
                        style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' } : undefined}
                    >
                        {/* 一体化卡片输入容器 */}
                        <div
                            className={`flex flex-col rounded-2xl border transition-all duration-300 ${
                                isDropActive
                                    ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/10 ring-2 ring-[var(--accent-coral)]/20'
                                    : 'border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] focus-within:border-[var(--accent-coral)] focus-within:ring-2 focus-within:ring-[var(--accent-coral)]/15 focus-within:shadow-[0_0_12px_rgba(244,63,94,0.08)]'
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
                                <textarea
                                    ref={inputRef}
                                    className="w-full border-none shadow-none text-[15px] p-0.5 bg-transparent resize-none scrollbar-thin focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] leading-relaxed"
                                    placeholder="开启你的灵感之旅..."
                                    rows={1}
                                    value={input}
                                    onChange={e => {
                                        setInput(e.target.value);
                                        registerActivity();
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                                    }}
                                    onKeyDown={e => {
                                        if ((e.nativeEvent as KeyboardEvent).isComposing) {
                                            return;
                                        }
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    onPaste={handleInputPaste}
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
                                                onClick={() => removeAttachment(att.id)}
                                                className={`absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all ${isMobile ? 'opacity-95 scale-110' : 'opacity-0 group-hover:opacity-100 scale-100 hover:scale-110'}`}
                                            >
                                                <X size={9} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 4. 一体化工具栏底栏 */}
                            <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-[var(--frost-card-sub-border)]/40">
                                {/* 左侧：附件添加 & Agent 切换 */}
                                <div className="flex items-center gap-2">
                                    {/* 隐藏的 File Input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    {/* 附件添加按钮 */}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)] transition-all active:scale-90 flex items-center justify-center"
                                        title="添加附件 (图片/视频/文档)"
                                    >
                                        <Plus size={18} />
                                    </button>

                                    {/* Agent 药丸切换按钮 */}
                                    <button
                                        onClick={() => {
                                            setAgentMode(!agentMode);
                                            registerActivity();
                                            if (!agentMode && !currentAgent) {
                                                setCurrentAgent(agentService.getActive());
                                            }
                                        }}
                                        className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1.5 transition-all duration-300 active:scale-95 select-none ${
                                            agentMode
                                                ? 'bg-gradient-to-r from-[var(--clay-brand-coral)] to-[var(--clay-brand-pink)] text-white border-transparent shadow-[0_2px_8px_rgba(244,63,94,0.25)]'
                                                : 'bg-[var(--toolbar-hover)] text-[var(--text-secondary)] border-[var(--frost-card-sub-border)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title={agentMode ? 'Agent 已开启：可自动路由问答/生成图/改图/文档任务' : '开启 Agent 增强模式'}
                                    >
                                        <Bot size={11} className={agentMode ? 'animate-pulse' : ''} />
                                        <span>Agent</span>
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${agentMode ? 'bg-white animate-ping' : 'bg-current opacity-60'}`} />
                                    </button>

                                    {/* 简体中文：AI接管药丸切换按钮 */}
                                    <button
                                        id="btn-ai-takeover-toggle"
                                        onClick={() => {
                                            setAiTakeoverMode(!aiTakeoverMode);
                                            registerActivity();
                                        }}
                                        className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1.5 transition-all duration-300 active:scale-95 select-none ${
                                            aiTakeoverMode
                                                ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white border-transparent shadow-[0_2px_8px_rgba(219,39,119,0.25)]'
                                                : 'bg-[var(--toolbar-hover)] text-[var(--text-secondary)] border-[var(--frost-card-sub-border)] hover:text-[var(--text-primary)]'
                                        }`}
                                        title={aiTakeoverMode ? 'AI 接管已开启：自动为您批量生图、定位卡片或聚焦 API 输入框' : '开启 AI 接管'}
                                    >
                                        <Cpu size={11} className={aiTakeoverMode ? 'animate-pulse' : ''} />
                                        <span>AI接管</span>
                                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${aiTakeoverMode ? 'bg-white animate-ping' : 'bg-current opacity-60'}`} />
                                    </button>
                                </div>

                                {/* 右侧：发送 / 停止按钮 */}
                                <div>
                                    {isThinking ? (
                                        <button
                                            onClick={handleStopGeneration}
                                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-600 text-white hover:brightness-110 active:scale-90 transition-all shadow-[0_2px_8px_rgba(239,68,68,0.25)]"
                                            title="停止生成"
                                        >
                                            <Square size={10} fill="white" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (input.trim() || attachments.length > 0) {
                                                    handleSend();
                                                }
                                            }}
                                            disabled={!input.trim() && attachments.length === 0}
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
                    className="fixed z-[10020] w-40 rounded-lg border py-1"
                    style={{
                        top: sessionContextMenu.y,
                        left: sessionContextMenu.x,
                        background: 'var(--frost-card-framework-bg)',
                        borderColor: 'var(--frost-card-framework-border)',
                        boxShadow: 'var(--frost-card-framework-shadow)',
                        backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                        WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                    }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRenameSession(sessionContextMenu.sessionId);
                            setSessionContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)]"
                    >
                        重命名
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateSession(sessionContextMenu.sessionId);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)]"
                    >
                        复制分支
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggleArchiveSession(sessionContextMenu.sessionId);
                            setSessionContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)]"
                    >
                        归档/取消归档
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(sessionContextMenu.sessionId);
                            setSessionContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                    >
                        删除会话
                    </button>
                </div>,
                document.body
            )}
            {importPreview && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[10030] bg-black/50 flex items-center justify-center p-4">
                    <div
                        className="w-full max-w-md rounded-xl border p-4"
                        style={{
                            background: 'var(--frost-card-framework-bg)',
                            borderColor: 'var(--frost-card-framework-border)',
                            boxShadow: 'var(--frost-card-framework-shadow)',
                            backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                            WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(160%)',
                        }}
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
                                    onClick={() => setImportPreviewShowAll(prev => !prev)}
                                    className="flex-1 sm:flex-none h-8 px-2 rounded-lg border border-[var(--frost-card-sub-border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)] whitespace-nowrap"
                                >
                                    {importPreviewShowAll ? '收起' : '查看全部'}
                                </button>
                                <button
                                    onClick={() => setImportPreviewOnlyExcluded(prev => !prev)}
                                    className={`flex-1 sm:flex-none h-8 px-2 rounded-lg border text-[11px] whitespace-nowrap transition-colors ${importPreviewOnlyExcluded
                                        ? 'border-red-400/40 bg-red-500/15 text-red-200'
                                        : 'border-[var(--frost-card-sub-border)] text-[var(--text-secondary)] hover:bg-[var(--toolbar-hover)]'
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
                                            onClick={() => setImportExcludedIds(visible.map(s => s.id))}
                                            className="text-[10px] px-2 py-1 rounded border border-[var(--frost-card-sub-border)] hover:bg-[var(--toolbar-hover)]"
                                        >全选可见</button>
                                        <button
                                            onClick={() => setImportExcludedIds([])}
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
                                onClick={() => applyImportMode('smart')}
                                className="w-full py-2 rounded-lg bg-[var(--accent-coral)]/15 border border-[var(--accent-coral)]/40 text-[var(--accent-coral)] text-sm hover:bg-[var(--accent-coral)]/25"
                            >
                                智能合并（推荐）
                            </button>
                            <button
                                onClick={() => applyImportMode('append')}
                                className="w-full py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-sm hover:bg-emerald-500/25"
                            >
                                追加保留当前
                            </button>
                            <button
                                onClick={() => applyImportMode('replace')}
                                className="w-full py-2 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-200 text-sm hover:bg-amber-500/25"
                            >
                                覆盖当前
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                setImportPreview(null);
                                setImportPreviewSearch('');
                                setImportPreviewShowAll(false);
                                setImportExcludedIds([]);
                                setImportPreviewOnlyExcluded(false);
                            }}
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

const ChatSidebar: React.FC<ChatSidebarProps> = (props) => {
    const { activeCanvas, addPromptNode, updatePromptNode, getNextCardPosition } = useCanvas();
    const { executeGeneration } = useImageGeneration({
        isMobile: props.isMobile,
        getCardDimensions: (ratio, hasToolbar) => getCardDimensions(ratio, hasToolbar),
        rememberPreferredKeyForMode: () => {}
    });
    const { balance } = useBilling();
    const apiKeyStatus = keyManager.hasValidKeys() ? 'configured_masked' : 'missing';

    return (
        <AITakeoverProvider
            activeCanvas={activeCanvas}
            selectedModel={{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' }}
            addPromptNode={addPromptNode}
            updatePromptNode={updatePromptNode}
            executeGeneration={executeGeneration}
            getNextCardPosition={getNextCardPosition}
            setConfig={() => {}}
            onOpenSettings={props.onOpenSettings}
            apiKeyStatus={apiKeyStatus}
            balance={balance}
            notify={notify}
        >
            <ChatSidebarInner {...props} />
        </AITakeoverProvider>
    );
};

export default ChatSidebar;


