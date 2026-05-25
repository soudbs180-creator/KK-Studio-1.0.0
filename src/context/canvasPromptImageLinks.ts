import { GenerationMode, type Canvas } from '../types.ts';

export function deleteCanvasImageNode(canvas: Canvas, id: string): Canvas {
    return {
        ...canvas,
        imageNodes: canvas.imageNodes.filter(node => node.id !== id),
        promptNodes: canvas.promptNodes.map(prompt => ({
            ...prompt,
            childImageIds: prompt.childImageIds.filter(childId => childId !== id),
            sourceImageId: prompt.sourceImageId === id ? undefined : prompt.sourceImageId,
        })),
    };
}

export function deleteCanvasPromptNode(canvas: Canvas, id: string): Canvas {
    const targetNode = canvas.promptNodes.find(node => node.id === id);
    if (!targetNode) {
        return canvas;
    }

    const toDeletePromptIds = new Set<string>([id]);
    
    // 如果是电商框架卡片，级联删除所有的子分组和子任务卡片
    if (targetNode.mode === GenerationMode.ECOMMERCE && targetNode.ecommerce?.kind === 'framework') {
        canvas.promptNodes.forEach(node => {
            if (node.ecommerce?.frameworkId === id) {
                toDeletePromptIds.add(node.id);
            }
        });
    }
    // 如果是电商分组卡片，级联删除该分组下所有的子任务卡片
    else if (targetNode.mode === GenerationMode.ECOMMERCE && targetNode.ecommerce?.kind === 'a-plus-group') {
        canvas.promptNodes.forEach(node => {
            if (node.ecommerce?.groupId === id) {
                toDeletePromptIds.add(node.id);
            }
        });
    }

    // 从 promptNodes 中过滤掉所有需要删除的卡片
    let nextPromptNodes = canvas.promptNodes.filter(node => !toDeletePromptIds.has(node.id));

    // 如果删除了某个具体的电商任务卡片，我们需要更新它所属的 framework 节点中的 taskNodeIds 列表
    if (targetNode.mode === GenerationMode.ECOMMERCE && (targetNode.ecommerce?.kind === 'main-image' || targetNode.ecommerce?.kind === 'a-plus-module')) {
        const frameworkId = targetNode.ecommerce.frameworkId;
        if (frameworkId) {
            nextPromptNodes = nextPromptNodes.map(node => {
                if (node.id === frameworkId && node.ecommerce?.frameworkMeta) {
                    const taskNodeIds = node.ecommerce.frameworkMeta.taskNodeIds || [];
                    return {
                        ...node,
                        ecommerce: {
                            ...node.ecommerce,
                            frameworkMeta: {
                                ...node.ecommerce.frameworkMeta,
                                taskNodeIds: taskNodeIds.filter(taskId => taskId !== id),
                            }
                        }
                    };
                }
                return node;
            });
        }
    }

    // 找出所有属于电商模式的即将被删除的卡片 ID
    const ecommercePromptIds = new Set<string>();
    canvas.promptNodes.forEach(node => {
        if (node.mode === GenerationMode.ECOMMERCE && toDeletePromptIds.has(node.id)) {
            ecommercePromptIds.add(node.id);
        }
    });

    // 更新 imageNodes：
    // 电商任务卡片生成的图片：直接彻底删除
    // 普通节点生成的图片：保留，但清空 parentPromptId 关联
    const nextImageNodes = canvas.imageNodes.filter(image => {
        if (image.parentPromptId && ecommercePromptIds.has(image.parentPromptId)) {
            return false; // 电商图片直接过滤掉，一并删除
        }
        return true;
    }).map(image => {
        if (image.parentPromptId && toDeletePromptIds.has(image.parentPromptId)) {
            return { ...image, parentPromptId: '' };
        }
        return image;
    });

    return {
        ...canvas,
        promptNodes: nextPromptNodes,
        imageNodes: nextImageNodes,
    };
}

export function linkCanvasPromptToImage(canvas: Canvas, promptId: string, imageId: string): Canvas {
    const promptNode = canvas.promptNodes.find(prompt => prompt.id === promptId);
    if (!promptNode || promptNode.childImageIds.includes(imageId)) {
        return canvas;
    }

    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(prompt =>
            prompt.id === promptId
                ? { ...prompt, childImageIds: [...prompt.childImageIds, imageId] }
                : prompt
        ),
        imageNodes: canvas.imageNodes.map(image =>
            image.id === imageId
                ? { ...image, parentPromptId: promptId }
                : image
        ),
    };
}

export function unlinkCanvasPromptFromImage(canvas: Canvas, promptId: string, imageId: string): Canvas {
    return {
        ...canvas,
        promptNodes: canvas.promptNodes.map(prompt =>
            prompt.id === promptId
                ? { ...prompt, childImageIds: prompt.childImageIds.filter(id => id !== imageId) }
                : prompt
        ),
        imageNodes: canvas.imageNodes.map(image =>
            image.id === imageId
                ? { ...image, parentPromptId: '' }
                : image
        ),
    };
}
