/**
 * Markdown 转卡片组转换器
 * 
 * 资深架构师设计：将 Markdown 文本解析为严格的层级树，
 * 并通过 DFS (深度优先搜索) 子树包围盒算法计算无重叠的完美居中对齐布局。
 */

export interface ParsedCardData {
  id: string;
  title: string;
  prompt: string;
  level: number;
  bullets: string[];
  parentId: string | null;
  position: { x: number; y: number };
}

interface LayoutTreeNode {
  card: ParsedCardData;
  children: LayoutTreeNode[];
  boundingHeight: number;
}

/**
 * 将 Markdown 字符串解析为卡片层级结构并计算规整布局
 * @param markdown Markdown 原始文本
 * @param startX 插入的起始 X 坐标
 * @param startY 插入的起始 Y 坐标
 */
export function parseMarkdownToCards(
  markdown: string,
  startX = 100,
  startY = 100
): ParsedCardData[] {
  if (!markdown || !markdown.trim()) {
    return [];
  }

  const lines = markdown.split(/\r?\n/);
  const cards: ParsedCardData[] = [];
  let currentCard: ParsedCardData | null = null;
  
  const parentStack: { id: string; level: number }[] = [];
  
  // 碰撞抑制 UUID 生成器
  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `card-${crypto.randomUUID()}`;
    }
    return `card-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  };

  // 1. 语法树分词与卡片提取 (状态机)
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 匹配标题 (e.g., # 标题)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (currentCard) {
        cards.push(currentCard);
      }

      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const cardId = generateId();

      // 根据标题层级维护父子上下文栈
      while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
        parentStack.pop();
      }

      const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;
      parentStack.push({ id: cardId, level });

      currentCard = {
        id: cardId,
        title,
        prompt: title,
        level,
        bullets: [],
        parentId,
        position: { x: 0, y: 0 },
      };
      continue;
    }

    // 匹配列表要点
    const listMatch = trimmed.match(/^(?:[-*•+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const text = listMatch[1].trim();
      if (!currentCard) {
        // 容错：如果第一行就是列表，自动创建导言卡片
        const cardId = generateId();
        currentCard = {
          id: cardId,
          title: '导言',
          prompt: '导言',
          level: 1,
          bullets: [],
          parentId: null,
          position: { x: 0, y: 0 },
        };
      }
      currentCard.bullets.push(text);
      continue;
    }

    // 容错：普通文本行，追加到当前活跃卡片的 bullets 中
    if (currentCard) {
      currentCard.bullets.push(trimmed);
    } else {
      // 容错：首行非标题文本
      const cardId = generateId();
      currentCard = {
        id: cardId,
        title: '导言',
        prompt: '导言',
        level: 1,
        bullets: [trimmed],
        parentId: null,
        position: { x: 0, y: 0 },
      };
    }
  }

  if (currentCard) {
    cards.push(currentCard);
  }

  if (cards.length === 0) {
    return [];
  }

  // 2. 物理尺寸常量定义
  const CARD_WIDTH = 320;
  const CARD_HEIGHT = 220;
  const GAP_X = 80;
  const GAP_Y = 60;

  // 3. 构建多叉树森林结构
  const nodeMap = new Map<string, LayoutTreeNode>();
  const roots: LayoutTreeNode[] = [];

  cards.forEach((card) => {
    nodeMap.set(card.id, {
      card,
      children: [],
      boundingHeight: CARD_HEIGHT,
    });
  });

  cards.forEach((card) => {
    const node = nodeMap.get(card.id)!;
    if (card.parentId && nodeMap.has(card.parentId)) {
      nodeMap.get(card.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 4. 自底向上 DFS 计算每棵子树的垂直包围盒高度
  function calculateBoundingHeight(node: LayoutTreeNode): number {
    if (node.children.length === 0) {
      node.boundingHeight = CARD_HEIGHT;
      return CARD_HEIGHT;
    }

    let childrenHeightSum = 0;
    node.children.forEach((child) => {
      childrenHeightSum += calculateBoundingHeight(child);
    });
    // 子节点之间的总间距
    const totalGapsHeight = (node.children.length - 1) * GAP_Y;
    
    // 子树高度为所有子树累加高度加间距，并与节点自身高度取最大值（防止子树偏小时收缩重合）
    node.boundingHeight = Math.max(CARD_HEIGHT, childrenHeightSum + totalGapsHeight);
    return node.boundingHeight;
  }

  roots.forEach((root) => calculateBoundingHeight(root));

  // 5. 自顶向下分配 Y 轴坐标，并进行父节点几何垂直居中对齐
  function layoutNode(
    node: LayoutTreeNode,
    currentX: number,
    allocatedYStart: number,
    allocatedYHeight: number
  ) {
    // 父节点在分配的 Y 轴高度区间内垂直居中
    const centerY = allocatedYStart + allocatedYHeight / 2 - CARD_HEIGHT / 2;
    node.card.position = { x: currentX, y: centerY };

    if (node.children.length === 0) {
      return;
    }

    const nextX = currentX + CARD_WIDTH + GAP_X;
    let nextYStart = allocatedYStart;

    node.children.forEach((child) => {
      layoutNode(child, nextX, nextYStart, child.boundingHeight);
      nextYStart += child.boundingHeight + GAP_Y;
    });
  }

  // 6. 依次排开多棵根树，避免森林在 Y 轴重合
  let forestYStart = startY;
  roots.forEach((root) => {
    layoutNode(root, startX, forestYStart, root.boundingHeight);
    forestYStart += root.boundingHeight + GAP_Y;
  });

  return cards;
}

