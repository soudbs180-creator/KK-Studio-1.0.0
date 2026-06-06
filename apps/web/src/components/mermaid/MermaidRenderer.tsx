import React, { useEffect, useState } from 'react';
import {
  buildNativeMermaidPreviewSvg,
  getMermaidDiagramDirection,
  layoutMermaidTopology,
  parseMermaidTopology,
} from './mermaidTopology.ts';

export {
  buildNativeMermaidPreviewSvg,
  layoutMermaidTopology,
  parseMermaidTopology,
} from './mermaidTopology.ts';

export interface MermaidRendererProps {
  initialCode?: string;
  onInsertCards?: (data: {
    nodes: Array<{ id: string; label: string; x: number; y: number }>;
    edges: Array<{ from: string; to: string; label?: string }>;
    groupName?: string;
  }) => void;
  onClose?: () => void;
}

const DEFAULT_MERMAID = `flowchart TD
  A[开始项目] --> B{需求分析}
  B -->|完成| C[设计系统]
  B -->|搁置| D[归档]
  C --> E[组件开发]
  E --> F[系统验证]`;

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  initialCode = DEFAULT_MERMAID,
  onInsertCards,
  onClose,
}) => {
  const [code, setCode] = useState(initialCode);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let active = true;
    setRendering(true);

    const renderChart = () => {
      if (!code.trim()) {
        if (active) {
          setSvgHtml('');
          setError(null);
          setRendering(false);
        }
        return;
      }

      try {
        const svg = buildNativeMermaidPreviewSvg(code);
        if (!active) return;
        setError(null);
        setSvgHtml(svg);
        setRendering(false);
      } catch (err: unknown) {
        if (!active) return;
        console.warn('Mermaid topology preview failed:', err);
        setSvgHtml('');
        setError(err instanceof Error ? err.message : 'Mermaid 拓扑解析错误，请检查结构。');
        setRendering(false);
      }
    };

    const timer = window.setTimeout(renderChart, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [code]);

  const handleInsert = () => {
    const { nodes, edges } = parseMermaidTopology(code);
    if (nodes.length === 0) {
      alert('未检测到有效的流程节点，请确保输入包含正确的 flowchart 节点定义。');
      return;
    }

    const CARD_WIDTH = 300;
    const CARD_HEIGHT = 180;
    const GAP_X = 100;
    const GAP_Y = 80;
    const layout = layoutMermaidTopology({ nodes, edges }, {
      direction: getMermaidDiagramDirection(code),
      nodeWidth: CARD_WIDTH,
      nodeHeight: CARD_HEIGHT,
      gapX: GAP_X,
      gapY: GAP_Y,
      padding: 100,
    });
    const finalNodes = layout.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      x: node.x,
      y: node.y,
    }));

    onInsertCards?.({
      nodes: finalNodes,
      edges,
      groupName: 'Mermaid 转换组',
    });
  };

  return (
    <div className="flex h-full flex-col gap-4 text-white p-2 select-none">
      {/* 头部面板 */}
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="m-0 text-[16px] font-medium tracking-wide">Mermaid 流程图一键导入</h3>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="bg-transparent border-none text-white/40 cursor-pointer hover:text-white/90 text-sm transition-colors"
          >
            关闭
          </button>
        )}
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* 代码编辑区 */}
        <div className="flex flex-col flex-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">Mermaid 源码：</span>
            {rendering && <span className="text-[10px] text-emerald-400/80 animate-pulse">编译中...</span>}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 bg-slate-950 text-emerald-400 font-mono text-xs p-3.5 border border-white/5 rounded-xl resize-none outline-none focus:border-emerald-500/40 transition-colors"
            placeholder="flowchart TD&#10;  A[开始] --> B[结束]"
          />
        </div>

        {/* 渲染预览区 */}
        <div className="flex flex-col flex-1 gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">实时预览图：</span>
            {error && <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">语法异常</span>}
          </div>
          <div
            className="flex-1 bg-slate-950/40 border border-white/5 rounded-xl overflow-auto p-4 flex items-center justify-center relative"
          >
            {rendering && !svgHtml && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs">
                <span className="text-xs text-white/30 animate-pulse">正在生成 SVG 预览...</span>
              </div>
            )}
            <div 
              className="w-full h-full flex items-center justify-center mermaid-svg-container"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/40 px-3.5 py-2.5 rounded-xl text-xs text-rose-300 font-mono max-h-24 overflow-y-auto">
          {error}
        </div>
      )}

      {/* 底部按钮区 */}
      <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
        <button
          onClick={handleInsert}
          disabled={!!error || !svgHtml}
          className={`px-5 py-2 rounded-full font-medium text-xs transition-all ${
            error || !svgHtml
              ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer hover:shadow-lg hover:shadow-emerald-500/15'
          }`}
        >
          插入到画布卡片组
        </button>
      </div>
    </div>
  );
};

export default MermaidRenderer;
