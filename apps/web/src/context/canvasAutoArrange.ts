import type { Canvas, GeneratedImage, PromptNode } from '../types/index.ts';
import { type AspectRatio } from '../types/index.ts';
import { ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH } from '../utils/promptNodeCardWidth.ts';
import { getCardDimensions } from '../utils/styleUtils.ts';

export type CanvasAutoArrangePositions = Record<string, { x: number; y: number }>;

type LayoutGroupType = 'normal' | 'orphan-prompt' | 'orphan-image' | 'error';

type LayoutGroup = {
    type: LayoutGroupType;
    prompt?: PromptNode;
    images: GeneratedImage[];
    width: number;
    height: number;
    sourcePromptId?: string;
    layoutHeight?: number;
};

// 🎯 [New] 扩展 LayoutGroup，包含唯一 ID、分类轨道和时间戳
type EnhancedLayoutGroup = LayoutGroup & {
    id: string;
    category: 'standard' | 'error' | 'ecommerce' | 'ppt' | 'automation';
    timestamp: number;
};

const PROMPT_WIDTH = 320;
const SUB_COLUMNS = 20;
const GROUP_GAP_X = 56;
const GROUP_GAP_Y = 120;
const SUB_IMAGE_GAP = 32;
const PROMPT_TO_SUB_GAP = 56;
const START_X = -2000;
const START_Y = 200;

const getImageDims = (aspectRatio?: string) => {
    const { width, totalHeight } = getCardDimensions(aspectRatio as AspectRatio, true);
    return { w: width, h: totalHeight };
};

const getPromptWidth = (prompt?: PromptNode): number => (
    prompt?.mode === 'ecommerce' && prompt.ecommerce?.kind === 'framework'
        ? ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH
        : PROMPT_WIDTH
);

const getGroupTimestamp = (group: LayoutGroup): number => {
    return group.prompt?.timestamp || group.images[0]?.timestamp || 0;
};

type SubtreePlacement = {
    dx: number;
    dy: number;
    group: EnhancedLayoutGroup;
};

type SubtreeLayoutResult = {
    width: number;
    height: number;
    placements: SubtreePlacement[];
};

// 🎯 [New] 电商项目子网格相对布局算法
// Framework 作为主卡居左，其他的子卡组在右侧以 2 列网格紧凑平铺，组成高内聚方形模块
const layoutEcommerceProject = (
    fwGroup: EnhancedLayoutGroup,
    subGroups: EnhancedLayoutGroup[]
): SubtreeLayoutResult => {
    const placements: SubtreePlacement[] = [];
    placements.push({ dx: 0, dy: 0, group: fwGroup });

    if (subGroups.length === 0) {
        return { width: fwGroup.width, height: fwGroup.height, placements };
    }

    const cols = 2;
    const xStart = fwGroup.width + GROUP_GAP_X;
    
    // 计算子卡片的最大物理尺寸
    const maxSubWidth = Math.max(...subGroups.map(g => g.width));
    const maxSubHeight = Math.max(...subGroups.map(g => g.height));

    subGroups.forEach((sub, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const dx = xStart + col * (maxSubWidth + GROUP_GAP_X);
        const dy = row * (maxSubHeight + GROUP_GAP_Y);
        placements.push({ dx, dy, group: sub });
    });

    const subRows = Math.ceil(subGroups.length / cols);
    const subGridWidth = cols * maxSubWidth + (cols - 1) * GROUP_GAP_X;
    const subGridHeight = subRows * maxSubHeight + (subRows - 1) * GROUP_GAP_Y;

    const width = xStart + subGridWidth;
    const height = Math.max(fwGroup.height, subGridHeight);

    return { width, height, placements };
};

export function resolveCanvasAutoArrangePositions(canvas: Canvas): CanvasAutoArrangePositions {
    const errorPrompts = canvas.promptNodes.filter(prompt => prompt.error);
    const errorPromptIds = new Set(errorPrompts.map(prompt => prompt.id));

    // 过滤掉所有属于 PPT 的 Prompt 节点
    const pptPromptIds = new Set(canvas.promptNodes.filter(prompt => prompt.mode === 'ppt').map(prompt => prompt.id));

    const normalPrompts = canvas.promptNodes.filter(prompt =>
        !errorPromptIds.has(prompt.id) &&
        canvas.imageNodes.some(image => image.parentPromptId === prompt.id)
    );

    const orphanPrompts = canvas.promptNodes.filter(prompt =>
        !errorPromptIds.has(prompt.id) &&
        !canvas.imageNodes.some(image => image.parentPromptId === prompt.id)
    );

    const orphanImages = canvas.imageNodes.filter(image =>
        !image.parentPromptId ||
        !canvas.promptNodes.some(prompt => prompt.id === image.parentPromptId)
    );

    const layoutGroups: EnhancedLayoutGroup[] = [];
    const promptById = new Map(canvas.promptNodes.map(prompt => [prompt.id, prompt]));

    // 1. 提取所有正常卡组
    normalPrompts.forEach(prompt => {
        const isPpt = prompt.mode === 'ppt';
        // 🚀 [UI Optimization] PPT 卡片不要链式平铺其子图片，子图片在整理中排除
        const childImages = isPpt
            ? []
            : canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
            
        const promptHeight = prompt.height || 200;

        let maxSubWidth = 0;
        let maxSubHeight = 0;
        childImages.forEach(image => {
            const dims = getImageDims(image.aspectRatio);
            maxSubWidth = Math.max(maxSubWidth, dims.w);
            maxSubHeight = Math.max(maxSubHeight, dims.h);
        });

        const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
        const rows = Math.ceil(childImages.length / SUB_COLUMNS);
        const subBlockWidth = actualColumns > 0
            ? actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP
            : 0;
        const subBlockHeight = rows > 0
            ? rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP
            : 0;

        const groupWidth = Math.max(getPromptWidth(prompt), subBlockWidth);
        const groupHeight = promptHeight + (childImages.length > 0 ? PROMPT_TO_SUB_GAP + subBlockHeight : 0);

        let category: EnhancedLayoutGroup['category'] = 'standard';
        if (prompt.mode === 'ecommerce') {
            category = 'ecommerce';
        } else if (prompt.mode === 'ppt') {
            category = 'ppt';
        } else if ((prompt.mode as string) === 'automation' || prompt.tags?.includes('automation')) {
            category = 'automation';
        }

        layoutGroups.push({
            id: prompt.id,
            category,
            type: 'normal',
            prompt,
            images: childImages,
            width: groupWidth,
            height: groupHeight,
            timestamp: getGroupTimestamp({ type: 'normal', prompt, images: childImages, width: groupWidth, height: groupHeight })
        });
    });

    // 2. 提取所有孤立 Prompt
    orphanPrompts.forEach(prompt => {
        let category: EnhancedLayoutGroup['category'] = 'standard';
        if (prompt.mode === 'ecommerce') {
            category = 'ecommerce';
        } else if (prompt.mode === 'ppt') {
            category = 'ppt';
        } else if ((prompt.mode as string) === 'automation' || prompt.tags?.includes('automation')) {
            category = 'automation';
        }

        layoutGroups.push({
            id: prompt.id,
            category,
            type: 'orphan-prompt',
            prompt,
            images: [],
            width: getPromptWidth(prompt),
            height: prompt.height || 200,
            timestamp: getGroupTimestamp({ type: 'orphan-prompt', prompt, images: [], width: getPromptWidth(prompt), height: prompt.height || 200 })
        });
    });

    // 3. 提取所有孤立图片
    orphanImages.forEach(image => {
        // 如果该孤立图片属于已过滤 PPT 子图，直接忽略以去除链式呈现
        if (image.parentPromptId && pptPromptIds.has(image.parentPromptId)) {
            return;
        }
        const dims = getImageDims(image.aspectRatio);
        layoutGroups.push({
            id: image.id,
            category: 'standard',
            type: 'orphan-image',
            images: [image],
            width: dims.w,
            height: dims.h,
            timestamp: getGroupTimestamp({ type: 'orphan-image', images: [image], width: dims.w, height: dims.h })
        });
    });

    // 4. 提取所有错误卡组
    errorPrompts.forEach(prompt => {
        const isPpt = prompt.mode === 'ppt';
        // 错误 PPT 卡片同样不平铺子图片
        const childImages = isPpt
            ? []
            : canvas.imageNodes.filter(image => image.parentPromptId === prompt.id);
        const promptHeight = prompt.height || 200;
        let groupWidth = PROMPT_WIDTH;
        let groupHeight = promptHeight;

        if (childImages.length > 0) {
            let maxSubWidth = 0;
            let maxSubHeight = 0;
            childImages.forEach(image => {
                const dims = getImageDims(image.aspectRatio);
                maxSubWidth = Math.max(maxSubWidth, dims.w);
                maxSubHeight = Math.max(maxSubHeight, dims.h);
            });
            const actualColumns = Math.min(SUB_COLUMNS, childImages.length);
            const rows = Math.ceil(childImages.length / SUB_COLUMNS);
            const subBlockWidth = actualColumns * maxSubWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
            const subBlockHeight = rows > 0
                ? rows * maxSubHeight + (rows - 1) * SUB_IMAGE_GAP
                : 0;
            groupWidth = Math.max(PROMPT_WIDTH, subBlockWidth);
            groupHeight = promptHeight + PROMPT_TO_SUB_GAP + subBlockHeight;
        }

        layoutGroups.push({
            id: prompt.id,
            category: 'error',
            type: 'normal',
            prompt,
            images: childImages,
            width: groupWidth,
            height: groupHeight,
            timestamp: getGroupTimestamp({ type: 'normal', prompt, images: childImages, width: groupWidth, height: groupHeight })
        });
    });

    const positions: CanvasAutoArrangePositions = {};

    // 核心卡组内部坐标分配器 (底部定位原点)
    const placeGroupInternal = (group: EnhancedLayoutGroup, left: number, top: number) => {
        const groupCenterX = left + group.width / 2;
        const promptHeight = group.prompt?.height || 200;
        const subCardsStartY = top + promptHeight + PROMPT_TO_SUB_GAP;

        if (group.type === 'normal' && group.prompt) {
            positions[group.prompt.id] = {
                x: groupCenterX,
                y: top + promptHeight,
            };

            if (group.images.length > 0) {
                const imageDims = group.images.map(image => getImageDims(image.aspectRatio));
                const maxWidth = Math.max(...imageDims.map(dim => dim.w));
                const maxHeight = Math.max(...imageDims.map(dim => dim.h));
                const actualColumns = Math.min(SUB_COLUMNS, group.images.length);
                const blockWidth = actualColumns * maxWidth + (actualColumns - 1) * SUB_IMAGE_GAP;
                const blockStartX = groupCenterX - blockWidth / 2;

                group.images.forEach((image, index) => {
                    const col = index % SUB_COLUMNS;
                    const row = Math.floor(index / SUB_COLUMNS);
                    const cardCenterX = blockStartX + col * (maxWidth + SUB_IMAGE_GAP) + maxWidth / 2;
                    const cardTopY = subCardsStartY + row * (maxHeight + SUB_IMAGE_GAP);
                    const dims = imageDims[index];
                    positions[image.id] = {
                        x: cardCenterX,
                        y: cardTopY + dims.h,
                    };
                });
            }
        } else if (group.type === 'orphan-prompt' && group.prompt) {
            positions[group.prompt.id] = {
                x: groupCenterX,
                y: top + promptHeight,
            };
        } else if (group.type === 'orphan-image' && group.images[0]) {
            const image = group.images[0];
            const dims = getImageDims(image.aspectRatio);
            positions[image.id] = {
                x: groupCenterX,
                y: subCardsStartY + dims.h,
            };
        }
    };

    const placeSubtree = (layout: SubtreeLayoutResult, left: number, top: number) => {
        layout.placements.forEach(p => {
            placeGroupInternal(p.group, left + p.dx, top + p.dy);
        });
    };

    // 通用独立卡片宫格平铺函数 (升序排序保证旧的在左上，新的在右下)
    const placeIndependentGroupsGrid = (
        groups: EnhancedLayoutGroup[],
        columnsPerRow: number,
        startX: number,
        startY: number
    ): number => {
        groups.sort((a, b) => a.timestamp - b.timestamp);

        let currentY = startY;
        let index = 0;
        while (index < groups.length) {
            const rowGroups = groups.slice(index, index + columnsPerRow);
            let rowX = startX;
            let rowMaxHeight = 0;

            rowGroups.forEach(group => {
                placeGroupInternal(group, rowX, currentY);
                rowX += group.width + GROUP_GAP_X;
                rowMaxHeight = Math.max(rowMaxHeight, group.height);
            });

            currentY += rowMaxHeight + GROUP_GAP_Y;
            index += columnsPerRow;
        }
        return currentY;
    };

    // 电商项目平铺排版函数 (3 列方形大项目平铺)
    const placeEcommerceGroupsGrid = (
        fwGroups: EnhancedLayoutGroup[],
        subGroups: EnhancedLayoutGroup[],
        columnsPerRow: number,
        startX: number,
        startY: number
    ): number => {
        fwGroups.sort((a, b) => a.timestamp - b.timestamp);

        const projectLayouts: SubtreeLayoutResult[] = fwGroups.map(fw => {
            const fwId = fw.prompt?.id || '';
            const projectSubs = subGroups.filter(sub => sub.prompt?.ecommerce?.frameworkId === fwId);
            projectSubs.sort((a, b) => a.timestamp - b.timestamp);
            return layoutEcommerceProject(fw, projectSubs);
        });

        // 兼容没有 Framework 的孤立电商卡片
        const placedSubIds = new Set<string>();
        fwGroups.forEach(fw => {
            const fwId = fw.prompt?.id || '';
            subGroups.filter(sub => sub.prompt?.ecommerce?.frameworkId === fwId).forEach(s => placedSubIds.add(s.id));
        });
        const orphanEcommerceGroups = subGroups.filter(s => !placedSubIds.has(s.id));
        orphanEcommerceGroups.sort((a, b) => a.timestamp - b.timestamp);
        orphanEcommerceGroups.forEach(orphan => {
            projectLayouts.push(layoutEcommerceProject(orphan, []));
        });

        let currentY = startY;
        let index = 0;
        while (index < projectLayouts.length) {
            const rowLayouts = projectLayouts.slice(index, index + columnsPerRow);
            let rowX = startX;
            let rowMaxHeight = 0;

            rowLayouts.forEach(layout => {
                placeSubtree(layout, rowX, currentY);
                rowX += layout.width + GROUP_GAP_X;
                rowMaxHeight = Math.max(rowMaxHeight, layout.height);
            });

            currentY += rowMaxHeight + GROUP_GAP_Y;
            index += columnsPerRow;
        }
        return currentY;
    };

    let currentY = START_Y;

    // ================== 轨道 1: 标准生成区 (18 列大网格) ==================
    const standardGroups = layoutGroups.filter(g => g.category === 'standard');
    if (standardGroups.length > 0) {
        currentY = placeIndependentGroupsGrid(standardGroups, 18, START_X, currentY);
        currentY += 120; // 轨道间隔
    }

    // ================== 轨道 2: 错误与垃圾箱区 (18 列大网格) ==================
    const errorGroups = layoutGroups.filter(g => g.category === 'error');
    if (errorGroups.length > 0) {
        currentY = placeIndependentGroupsGrid(errorGroups, 18, START_X, currentY);
        currentY += 120;
    }

    // ================== 轨道 3: 电商项目区 (3 列项目大宫格) ==================
    const ecommerceGroups = layoutGroups.filter(g => g.category === 'ecommerce');
    const ecommerceFwGroups = ecommerceGroups.filter(g => g.prompt?.ecommerce?.kind === 'framework');
    const ecommerceSubGroups = ecommerceGroups.filter(g => g.prompt?.ecommerce?.kind !== 'framework');
    if (ecommerceGroups.length > 0) {
        currentY = placeEcommerceGroupsGrid(ecommerceFwGroups, ecommerceSubGroups, 3, START_X, currentY);
        currentY += 120;
    }

    // ================== 轨道 4: PPT 卡片区 (6 列网格，隐藏子图) ==================
    const pptGroups = layoutGroups.filter(g => g.category === 'ppt');
    if (pptGroups.length > 0) {
        currentY = placeIndependentGroupsGrid(pptGroups, 6, START_X, currentY);
        currentY += 120;
    }

    // ================== 轨道 5: 变体与自动化流区 (6 列网格) ==================
    const automationGroups = layoutGroups.filter(g => g.category === 'automation');
    if (automationGroups.length > 0) {
        currentY = placeIndependentGroupsGrid(automationGroups, 6, START_X, currentY);
    }

    return positions;
}
