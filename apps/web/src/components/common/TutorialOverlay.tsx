import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import { isPhoneResponsiveWidth } from '../../utils/responsiveSurface';

interface TutorialStep {
    targetId?: string; // ID of the element to highlight
    title: string;
    description: string;
    position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
}

interface TutorialOverlayProps {
    onComplete: () => void;
}

type TutorialSurface = 'mobile' | 'desktop';

const TUTORIAL_MOBILE_CARD_MAX_WIDTH = 460;
const TUTORIAL_DESKTOP_CARD_MAX_WIDTH = 560;
const TUTORIAL_CARD_INITIAL_HEIGHT = 320;
const TUTORIAL_BULLET_PREFIXES = [
    String.fromCodePoint(0x2022),
    String.fromCharCode(0x00e2, 0x20ac, 0x00a2),
];

const getInitialTutorialCardWidth = () =>
    typeof window !== 'undefined' && isPhoneResponsiveWidth(window.innerWidth)
        ? TUTORIAL_MOBILE_CARD_MAX_WIDTH
        : TUTORIAL_DESKTOP_CARD_MAX_WIDTH;

const splitTutorialDescription = (description: string) => {
    const paragraphs: string[] = [];
    const bullets: string[] = [];

    for (const line of description.split(/\n+/).map((entry) => entry.trim()).filter(Boolean)) {
        const bulletPrefix = TUTORIAL_BULLET_PREFIXES.find((prefix) => line.startsWith(prefix));
        if (bulletPrefix) {
            bullets.push(line.slice(bulletPrefix.length).trim());
        } else {
            paragraphs.push(line);
        }
    }

    return { paragraphs, bullets };
};

const DESKTOP_TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: "欢迎使用无限画布",
        description: "这是您的自由创作空间，没有任何边界限制。\n\n• 🖱️ 双击空白处：快速创建新的图像卡片\n• 🔍 滚轮缩放：自由缩放查看细节\n• ✋ 按住空格拖拽：平移画布视角\n• 💡 这不仅仅是一个画板，更是一个思维导图式的创作流工具。",
        position: "center"
    },
    {
        targetId: "prompt-bar-container",
        title: "指令创作中心",
        description: "这是桌面端的控制台。支持图片与视频双模式创作。\n\n• 🎨 输入描述：在中间输入框描述画面\n• 📐 比例与尺寸：左侧灵活调整画幅与分辨率\n• 🖼️ 参考图：右侧上传参考图，支持多图混搭\n• ⚡ 快捷键：Enter 发送，Shift+Enter 换行",
        position: "top"
    },
    {
        targetId: "project-manager-container",
        title: "桌面项目与工具栏",
        description: "桌面端把项目管理、搜索和视图工具集中在侧栏。\n\n• 📁 项目管理：新建、切换与归档不同项目\n• 🔍 全局搜索：Ctrl+K 快速查找历史提示词\n• 📏 视图工具：网格对齐、一键归位、主题切换\n• 📂 导入导出：支持 .kk 格式项目文档",
        position: "right"
    },
    {
        targetId: "chat-trigger-button",
        title: "AI 创意助手",
        description: "您的全天候创作伙伴。\n\n• 🤖 灵感对话：不知道画什么？问问它\n• ✨ 提示词优化：帮您优化简陋的描述词\n• 📝 自动补全：基于上下文智能建议后续内容",
        position: "top"
    },
    {
        targetId: "header-user-menu",
        title: "账户与设置",
        description: "桌面端从右上角进入个人偏好与资源管理。\n\n• 🔑 API 管理：配置与切换不同的 AI 模型 Key\n• 📊 成本监控：实时查看今日消耗与剩余预算\n• ☁️ 云端同步：开启多设备自动同步功能",
        position: "bottom"
    }
];

const MOBILE_TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: "欢迎使用移动端画布",
        description: "移动端引导专门围绕触控和底部操作区设计。\n\n• 👆 轻点卡片：查看或继续编辑\n• 🤏 双指缩放：放大查看细节\n• 🧭 底部导航：在项目、结果和工具之间切换\n• 💡 移动端会优先保持关键操作在拇指可达区域。",
        position: "center"
    },
    {
        targetId: "prompt-bar-container",
        title: "移动端底部指令区",
        description: "这是移动端底部 prompt sheet，用来输入提示词、切换模式和上传参考图。\n\n• 🎨 输入描述：在底部输入框描述画面\n• 🖼️ 添加参考图：从移动端入口上传或选择素材\n• ⚡ 发送前确认比例、模型和生成模式",
        position: "top"
    },
    {
        targetId: "mobile-tab-bar",
        title: "移动端底部导航",
        description: "手机端不使用桌面侧栏，核心入口都在底部导航。\n\n• 📁 项目：切换当前项目\n• 🖼️ 结果：查看最近生成内容\n• ⚙️ 工具：进入搜索、设置和账户入口",
        position: "top"
    },
    {
        targetId: "header-user-menu",
        title: "移动端账户入口",
        description: "移动端账户与设置入口保留在顶部，避免和底部创作流程混在一起。\n\n• 🔑 管理 API Key\n• 📊 查看成本与余额\n• ☁️ 检查同步状态",
        position: "bottom"
    }
];

const getTutorialSteps = (surface: TutorialSurface) =>
    surface === 'mobile' ? MOBILE_TUTORIAL_STEPS : DESKTOP_TUTORIAL_STEPS;

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? isPhoneResponsiveWidth(window.innerWidth) : false
    );
    const [tooltipSize, setTooltipSize] = useState(() => ({
        width: getInitialTutorialCardWidth(),
        height: TUTORIAL_CARD_INITIAL_HEIGHT
    }));
    const overlayColor = 'var(--tutorial-overlay-bg)';
    const tutorialSurface: TutorialSurface = isMobile ? 'mobile' : 'desktop';
    const tutorialCardMaxWidth = isMobile ? TUTORIAL_MOBILE_CARD_MAX_WIDTH : TUTORIAL_DESKTOP_CARD_MAX_WIDTH;
    const STEPS = React.useMemo(() => getTutorialSteps(tutorialSurface), [tutorialSurface]);

    useEffect(() => {
        setCurrentStepIndex((current) => Math.min(current, STEPS.length - 1));
    }, [STEPS.length]);

    const displayStepIndex = Math.min(currentStepIndex, STEPS.length - 1);
    const step = STEPS[displayStepIndex];
    const descriptionParts = React.useMemo(
        () => splitTutorialDescription(step.description),
        [step.description]
    );

    useEffect(() => {
        const handleResize = () => setIsMobile(isPhoneResponsiveWidth(window.innerWidth));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!step.targetId) {
            setRect(null);
            return;
        }

        const updateRect = () => {
            const el = document.getElementById(step.targetId!);
            if (el) {
                const r = el.getBoundingClientRect();
                // Check if element is effectively visible
                if (r.width === 0 && r.height === 0) {
                    setRect(null);
                } else {
                    setRect(r);
                }
            } else {
                setRect(null);
            }
        };

        // Optimize: Use requestAnimationFrame for smoother tracking
        let rafId: number | null = null;
        let targetResizeObserver: ResizeObserver | null = null;
        const onFrame = () => {
            updateRect();
            rafId = null;
        };
        const throttledUpdate = () => {
            if (rafId === null) {
                rafId = requestAnimationFrame(onFrame);
            }
        };

        // Delay slightly to ensure UI is rendered and stable
        const timer = setTimeout(() => {
            updateRect();
            const el = document.getElementById(step.targetId!);
            if (el && typeof ResizeObserver !== 'undefined') {
                targetResizeObserver = new ResizeObserver(() => {
                    throttledUpdate();
                });
                targetResizeObserver.observe(el);
            }
        }, 200);
        window.addEventListener('resize', throttledUpdate);
        window.addEventListener('scroll', throttledUpdate, true); // Listen to capture scroll

        return () => {
            clearTimeout(timer);
            if (rafId) cancelAnimationFrame(rafId);
            targetResizeObserver?.disconnect();
            window.removeEventListener('resize', throttledUpdate);
            window.removeEventListener('scroll', throttledUpdate, true);
        };
    }, [displayStepIndex, step.targetId]);


    const handleNext = () => {
        if (displayStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(prev => Math.min(prev + 1, STEPS.length - 1));
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    // Use refs for smooth position updates without re-render
    const tooltipRef = useRef<HTMLDivElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateTooltipSize = () => {
            const element = tooltipRef.current;
            if (!element) return;

            const nextWidth = element.offsetWidth || tutorialCardMaxWidth;
            const nextHeight = element.offsetHeight || TUTORIAL_CARD_INITIAL_HEIGHT;

            setTooltipSize((prev) => {
                if (prev.width === nextWidth && prev.height === nextHeight) {
                    return prev;
                }
                return { width: nextWidth, height: nextHeight };
            });
        };

        updateTooltipSize();
        window.addEventListener('resize', updateTooltipSize);

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && tooltipRef.current) {
            resizeObserver = new ResizeObserver(updateTooltipSize);
            resizeObserver.observe(tooltipRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateTooltipSize);
            resizeObserver?.disconnect();
        };
    }, [displayStepIndex, step.title, step.description, isMobile, tutorialCardMaxWidth]);

    // Calculate position for the tooltip - use transform for GPU acceleration
    const getTooltipTransform = (): React.CSSProperties => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const viewportMargin = isMobile ? 12 : 24;
        const targetGap = 20;
        const tooltipWidth = Math.min(tooltipSize.width, viewportWidth - viewportMargin * 2);
        const tooltipHeight = Math.min(tooltipSize.height, viewportHeight - viewportMargin * 2);
        const tooltipWidthRule = `min(${tutorialCardMaxWidth}px, calc(100vw - ${viewportMargin * 2}px))`;

        const clampX = (value: number) =>
            Math.max(viewportMargin, Math.min(value, viewportWidth - tooltipWidth - viewportMargin));
        const clampY = (value: number) =>
            Math.max(viewportMargin, Math.min(value, viewportHeight - tooltipHeight - viewportMargin));

        if (!rect || step.position === 'center') {
            return {
                position: 'fixed',
                left: clampX((viewportWidth - tooltipWidth) / 2),
                top: clampY((viewportHeight - tooltipHeight) / 2),
                width: tooltipWidthRule,
                maxHeight: `calc(100vh - ${viewportMargin * 2}px)`
            };
        }

        const getPosition = (position: TutorialStep['position']) => {
            switch (position) {
                case 'top':
                    return {
                        left: rect.left + rect.width / 2 - tooltipWidth / 2,
                        top: rect.top - tooltipHeight - targetGap
                    };
                case 'bottom':
                    return {
                        left: rect.left + rect.width / 2 - tooltipWidth / 2,
                        top: rect.bottom + targetGap
                    };
                case 'left':
                    return {
                        left: rect.left - tooltipWidth - targetGap,
                        top: rect.top + rect.height / 2 - tooltipHeight / 2
                    };
                case 'right':
                    return {
                        left: rect.right + targetGap,
                        top: rect.top + rect.height / 2 - tooltipHeight / 2
                    };
                default:
                    return {
                        left: rect.left + rect.width / 2 - tooltipWidth / 2,
                        top: rect.bottom + targetGap
                    };
            }
        };

        const fitsViewport = (left: number, top: number) =>
            left >= viewportMargin &&
            top >= viewportMargin &&
            left + tooltipWidth <= viewportWidth - viewportMargin &&
            top + tooltipHeight <= viewportHeight - viewportMargin;

        const preferredPosition = step.position || 'bottom';
        const fallbackOrder: TutorialStep['position'][] = preferredPosition === 'top'
            ? ['top', 'bottom', 'right', 'left']
            : preferredPosition === 'bottom'
                ? ['bottom', 'top', 'right', 'left']
                : preferredPosition === 'left'
                    ? ['left', 'right', 'bottom', 'top']
                    : ['right', 'left', 'bottom', 'top'];

        let resolved = getPosition(preferredPosition);
        for (const position of fallbackOrder) {
            const candidate = getPosition(position);
            if (fitsViewport(candidate.left, candidate.top)) {
                resolved = candidate;
                break;
            }
        }

        return {
            position: 'fixed',
            left: clampX(resolved.left),
            top: clampY(resolved.top),
            width: tooltipWidthRule,
            maxHeight: `calc(100vh - ${viewportMargin * 2}px)`
        };
    };

    const spotlightBounds = React.useMemo(() => {
        if (!rect) return null;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = isMobile ? 10 : 12;
        const safeMargin = 8;

        const left = Math.max(safeMargin, rect.left - padding);
        const top = Math.max(safeMargin, rect.top - padding);
        const right = Math.min(viewportWidth - safeMargin, rect.right + padding);
        const bottom = Math.min(viewportHeight - safeMargin, rect.bottom + padding);

        return {
            left,
            top,
            right,
            bottom,
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top)
        };
    }, [rect, isMobile]);

    return createPortal(
        <div className="kk-tutorial-overlay-root fixed inset-0 overflow-hidden" style={{ zIndex: KK_LAYER.fullscreen }}>
            {spotlightBounds ? (
                <>
                    <div
                        className="absolute left-0 top-0 w-full"
                        style={{
                            height: spotlightBounds.top,
                            backgroundColor: overlayColor,
                            transition: 'height 0.35s ease'
                        }}
                    />
                    <div
                        className="absolute left-0"
                        style={{
                            top: spotlightBounds.top,
                            width: spotlightBounds.left,
                            height: spotlightBounds.height,
                            backgroundColor: overlayColor,
                            transition: 'top 0.35s ease, width 0.35s ease, height 0.35s ease'
                        }}
                    />
                    <div
                        className="absolute"
                        style={{
                            left: spotlightBounds.right,
                            top: spotlightBounds.top,
                            width: Math.max(0, window.innerWidth - spotlightBounds.right),
                            height: spotlightBounds.height,
                            backgroundColor: overlayColor,
                            transition: 'left 0.35s ease, top 0.35s ease, width 0.35s ease, height 0.35s ease'
                        }}
                    />
                    <div
                        className="absolute left-0 w-full"
                        style={{
                            top: spotlightBounds.bottom,
                            height: Math.max(0, window.innerHeight - spotlightBounds.bottom),
                            backgroundColor: overlayColor,
                            transition: 'top 0.35s ease, height 0.35s ease'
                        }}
                    />
                    <div
                        ref={highlightRef}
                        className="absolute rounded-[24px] pointer-events-none"
                        style={{
                            left: spotlightBounds.left,
                            top: spotlightBounds.top,
                            width: spotlightBounds.width,
                            height: spotlightBounds.height,
                            border: '1px solid var(--tutorial-spotlight-border)',
                            background: 'var(--tutorial-spotlight-bg)',
                            boxShadow: 'var(--tutorial-spotlight-ring)',
                            transition: 'left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease'
                        }}
                    />
                </>
            ) : (
                <div className="absolute inset-0 will-change-auto" style={{ backgroundColor: overlayColor }} />
            )}

            {/* Content Box - GPU accelerated */}
            <div
                ref={tooltipRef}
                className="w-full will-change-transform"
                data-tutorial-surface={tutorialSurface}
                style={{
                    ...getTooltipTransform(),
                    transition: 'left 0.3s ease, top 0.3s ease'
                }}
            >
                <div
                    className="overflow-y-auto border rounded-[24px] animate-in fade-in zoom-in-95 duration-300"
                    data-testid="tutorial-overlay-card"
                    style={{
                        background: 'var(--tutorial-card-bg)',
                        borderColor: 'var(--tutorial-card-border)',
                        boxShadow: 'var(--tutorial-card-shadow)',
                        maxHeight: isMobile
                            ? 'calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px)))'
                            : 'min(720px, calc(100vh - 48px))',
                        padding: isMobile ? '20px' : '28px',
                        paddingBottom: isMobile
                            ? 'max(24px, calc(20px + env(safe-area-inset-bottom, 0px)))'
                            : '28px',
                    }}
                >
                    <div className="flex justify-between items-start mb-5 gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--tutorial-dot-bg)' }} />
                            <span className="text-[10px] font-bold tracking-widest text-[var(--text-tertiary)] uppercase">
                                Step {displayStepIndex + 1} of {STEPS.length}
                            </span>
                        </div>
                        <button
                            onClick={onComplete}
                            className="rounded-full p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--text-primary)]"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <h3 className={`${isMobile ? 'mb-3 text-[20px]' : 'mb-4 text-[24px]'} font-bold tracking-tight text-[var(--text-primary)]`}>
                        {step.title}
                    </h3>
                    <div
                        className={`${isMobile ? 'mb-7 text-[14px] leading-6' : 'mb-8 text-[15px] leading-7'} space-y-4 text-[var(--text-secondary)]`}
                        data-testid="tutorial-overlay-description"
                    >
                        {descriptionParts.paragraphs.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                        {descriptionParts.bullets.length > 0 && (
                            <ul className={isMobile ? 'space-y-2.5' : 'space-y-3'}>
                                {descriptionParts.bullets.map((bullet) => (
                                    <li key={bullet} className="flex gap-3">
                                        <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--tutorial-dot-bg)' }} />
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex justify-between items-center gap-3">
                        <button
                            onClick={handlePrev}
                            disabled={displayStepIndex === 0}
                            className={`flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border-light)] leading-none transition-transform ${displayStepIndex === 0
                                ? 'opacity-20 cursor-not-allowed'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--toolbar-hover)] active:scale-90'
                                }`}
                        >
                            <ArrowLeft size={18} className="shrink-0" />
                        </button>

                        <button
                            onClick={handleNext}
                            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-[14px] font-bold leading-none transition-transform active:scale-[0.98]"
                            style={{
                                background: 'var(--tutorial-action-bg)',
                                color: 'var(--tutorial-action-text)',
                            }}
                        >
                            {displayStepIndex === STEPS.length - 1 ? (
                                <>
                                    <span className="leading-none">开始探索</span>
                                    <Check size={18} className="shrink-0" />
                                </>
                            ) : (
                                <>
                                    <span className="leading-none">下一步</span>
                                    <ArrowRight size={18} className="shrink-0" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TutorialOverlay;
