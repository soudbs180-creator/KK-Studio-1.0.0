export type MermaidTopologyNode = {
  id: string;
  label: string;
};

export type MermaidTopologyEdge = {
  from: string;
  to: string;
  label?: string;
};

export type MermaidTopology = {
  nodes: MermaidTopologyNode[];
  edges: MermaidTopologyEdge[];
};

export type MermaidDiagramDirection = 'TD' | 'LR';

type LayoutOptions = {
  direction: MermaidDiagramDirection;
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  padding: number;
};

export type LaidOutMermaidNode = MermaidTopologyNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  index: number;
};

export type MermaidTopologyLayout = {
  nodes: LaidOutMermaidNode[];
  width: number;
  height: number;
};

const SVG_TEXT_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeSvgText(value: string): string {
  return value.replace(/[&<>"']/g, (char) => SVG_TEXT_ESCAPE[char] || char);
}

function parseSingleNode(value: string): MermaidTopologyNode | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const nodeMatch = trimmed.match(
    /^([a-zA-Z0-9_-]+)\s*(?:\[\[(.*?)\]\]|\[(.*?)\]|\(\((.*?)\)\)|\((.*?)\)|\{\{(.*?)\}\}|\{(.*?)\})$/
  );

  if (nodeMatch) {
    const id = nodeMatch[1];
    const label = nodeMatch[2]
      || nodeMatch[3]
      || nodeMatch[4]
      || nodeMatch[5]
      || nodeMatch[6]
      || nodeMatch[7]
      || id;
    return { id, label: label.trim() };
  }

  if (/^(flowchart|graph|subgraph|end)$/i.test(trimmed)) {
    return null;
  }

  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { id: trimmed, label: trimmed };
  }

  return null;
}

export function getMermaidDiagramDirection(code: string): MermaidDiagramDirection {
  return /\b(?:flowchart|graph)\s+LR\b/i.test(code) ? 'LR' : 'TD';
}

export function parseMermaidTopology(code: string): MermaidTopology {
  const nodesMap = new Map<string, MermaidTopologyNode>();
  const edges: MermaidTopologyEdge[] = [];
  const lines = code.split(/\r?\n/);

  for (let line of lines) {
    let normalizedLine = line.trim();
    if (!normalizedLine || normalizedLine.startsWith('%%')) continue;
    if (/^(flowchart|graph)\s+/i.test(normalizedLine)) continue;

    if (normalizedLine.includes('-->')) {
      let edgeLabel: string | undefined;
      const pipeMatch = normalizedLine.match(/--+>\s*\|(.*?)\|\s*/);
      if (pipeMatch) {
        edgeLabel = pipeMatch[1].trim();
        normalizedLine = normalizedLine.replace(/--+>\s*\|(.*?)\|\s*/, '-->');
      }

      const parts = normalizedLine.split('-->').map((part) => part.trim());
      for (let index = 0; index < parts.length - 1; index++) {
        const leftNode = parseSingleNode(parts[index]);
        const rightNode = parseSingleNode(parts[index + 1]);

        if (leftNode && rightNode) {
          nodesMap.set(leftNode.id, leftNode);
          nodesMap.set(rightNode.id, rightNode);
          edges.push({ from: leftNode.id, to: rightNode.id, label: edgeLabel });
          continue;
        }

        const leftId = parts[index].match(/^([a-zA-Z0-9_-]+)/)?.[1];
        const rightId = parts[index + 1].match(/^([a-zA-Z0-9_-]+)/)?.[1];
        if (leftId && rightId) {
          if (!nodesMap.has(leftId)) nodesMap.set(leftId, { id: leftId, label: leftId });
          if (!nodesMap.has(rightId)) nodesMap.set(rightId, { id: rightId, label: rightId });
          edges.push({ from: leftId, to: rightId, label: edgeLabel });
        }
      }

      continue;
    }

    const node = parseSingleNode(normalizedLine);
    if (node) {
      nodesMap.set(node.id, node);
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}

function computeNodeLevels(nodes: MermaidTopologyNode[], edges: MermaidTopologyEdge[]): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  const indegrees = new Map<string, number>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    indegrees.set(node.id, 0);
  });

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return;
    adjacency.get(edge.from)?.push(edge.to);
    indegrees.set(edge.to, (indegrees.get(edge.to) || 0) + 1);
  });

  const levels = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  const queue = nodes
    .filter((node) => (indegrees.get(node.id) || 0) === 0)
    .map((node) => node.id);
  const visited = new Set<string>();

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const nodeId = queue[cursor];
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const currentLevel = levels.get(nodeId) || 0;
    (adjacency.get(nodeId) || []).forEach((targetId) => {
      levels.set(targetId, Math.max(levels.get(targetId) || 0, currentLevel + 1));
      const nextIndegree = (indegrees.get(targetId) || 0) - 1;
      indegrees.set(targetId, nextIndegree);
      if (nextIndegree <= 0) {
        queue.push(targetId);
      }
    });
  }

  return levels;
}

export function layoutMermaidTopology(
  topology: MermaidTopology,
  options: LayoutOptions
): MermaidTopologyLayout {
  const levels = computeNodeLevels(topology.nodes, topology.edges);
  const levelCounts = new Map<number, number>();
  let maxX = options.padding + options.nodeWidth;
  let maxY = options.padding + options.nodeHeight;

  const nodes = topology.nodes.map((node) => {
    const level = levels.get(node.id) || 0;
    const index = levelCounts.get(level) || 0;
    levelCounts.set(level, index + 1);

    const x = options.direction === 'LR'
      ? options.padding + level * (options.nodeWidth + options.gapX)
      : options.padding + index * (options.nodeWidth + options.gapX);
    const y = options.direction === 'LR'
      ? options.padding + index * (options.nodeHeight + options.gapY)
      : options.padding + level * (options.nodeHeight + options.gapY);

    maxX = Math.max(maxX, x + options.nodeWidth + options.padding);
    maxY = Math.max(maxY, y + options.nodeHeight + options.padding);

    return {
      ...node,
      x,
      y,
      width: options.nodeWidth,
      height: options.nodeHeight,
      level,
      index,
    };
  });

  return {
    nodes,
    width: maxX,
    height: maxY,
  };
}

function wrapLabel(label: string, maxChars = 13, maxLines = 3): string[] {
  const compactLabel = label.replace(/\s+/g, ' ').trim();
  if (!compactLabel) return [''];

  const lines: string[] = [];
  let rest = compactLabel;

  while (rest && lines.length < maxLines) {
    if (rest.length <= maxChars) {
      lines.push(rest);
      rest = '';
      break;
    }

    const slice = rest.slice(0, maxChars);
    const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('/'));
    const cut = breakAt >= 5 ? breakAt + 1 : maxChars;
    lines.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/.{1,2}$/, '')}...`;
  }

  return lines;
}

function renderEdgePath(
  edge: MermaidTopologyEdge,
  nodeById: Map<string, LaidOutMermaidNode>,
  direction: MermaidDiagramDirection
): string {
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  if (!from || !to) return '';

  const fromX = direction === 'LR' ? from.x + from.width : from.x + from.width / 2;
  const fromY = direction === 'LR' ? from.y + from.height / 2 : from.y + from.height;
  const toX = direction === 'LR' ? to.x : to.x + to.width / 2;
  const toY = direction === 'LR' ? to.y + to.height / 2 : to.y;
  const path = direction === 'LR'
    ? `M ${fromX} ${fromY} C ${(fromX + toX) / 2} ${fromY}, ${(fromX + toX) / 2} ${toY}, ${toX} ${toY}`
    : `M ${fromX} ${fromY} C ${fromX} ${(fromY + toY) / 2}, ${toX} ${(fromY + toY) / 2}, ${toX} ${toY}`;
  const label = edge.label
    ? `<text x="${(fromX + toX) / 2}" y="${(fromY + toY) / 2 - 8}" text-anchor="middle" fill="#a7f3d0" font-size="11" font-family="Inter, system-ui, sans-serif">${escapeSvgText(edge.label)}</text>`
    : '';

  return `
    <path d="${path}" fill="none" stroke="rgba(110, 231, 183, 0.58)" stroke-width="2" marker-end="url(#arrow)" />
    ${label}
  `;
}

function renderNode(node: LaidOutMermaidNode): string {
  const lines = wrapLabel(node.label);
  const textStartY = node.y + node.height / 2 - ((lines.length - 1) * 16) / 2 + 5;
  const text = lines
    .map((line, index) => (
      `<tspan x="${node.x + node.width / 2}" y="${textStartY + index * 16}">${escapeSvgText(line)}</tspan>`
    ))
    .join('');

  return `
    <g>
      <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="14" fill="rgba(15, 23, 42, 0.96)" stroke="rgba(110, 231, 183, 0.5)" stroke-width="1.5" />
      <text text-anchor="middle" fill="#ecfeff" font-size="13" font-weight="700" font-family="Inter, system-ui, sans-serif">${text}</text>
    </g>
  `;
}

export function buildNativeMermaidPreviewSvg(code: string): string {
  const topology = parseMermaidTopology(code);

  if (!topology.nodes.length) {
    throw new Error('未检测到有效的流程节点，请使用 flowchart 或 graph 拓扑语法。');
  }

  const direction = getMermaidDiagramDirection(code);
  const layout = layoutMermaidTopology(topology, {
    direction,
    nodeWidth: 176,
    nodeHeight: 74,
    gapX: 72,
    gapY: 48,
    padding: 36,
  });
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Mermaid topology preview" style="width: 100%; max-width: ${Math.max(layout.width, 360)}px; height: auto;">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(110, 231, 183, 0.78)" />
        </marker>
      </defs>
      <rect x="0" y="0" width="${layout.width}" height="${layout.height}" rx="18" fill="rgba(2, 6, 23, 0.28)" />
      ${topology.edges.map((edge) => renderEdgePath(edge, nodeById, direction)).join('')}
      ${layout.nodes.map(renderNode).join('')}
    </svg>
  `;
}
