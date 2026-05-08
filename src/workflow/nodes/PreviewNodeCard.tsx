import React from 'react';
import { Eye } from 'lucide-react';
import type { PreviewWorkflowNode } from '../../types';
import WorkflowUtilityCard from './WorkflowUtilityCard';

interface PreviewNodeCardProps {
  node: PreviewWorkflowNode;
  isSelected?: boolean;
  highlighted?: boolean;
  zoomScale?: number;
  snapToGrid?: boolean;
  onSelect?: () => void;
  onBringToFront?: () => void;
  onDelete?: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onAction?: (node: PreviewWorkflowNode) => void;
}

const PreviewNodeCard: React.FC<PreviewNodeCardProps> = (props) => {
  const sourceCount = props.node.data.sourceNodeIds?.length || 0;

  return (
    <WorkflowUtilityCard
      {...props}
      title={props.node.data.title || '预览卡'}
      subtitle="把上游结果聚合成一个轻量预览入口，不改动原来的图片卡链路。"
      accentClassName="workflow-preview-card"
      icon={<Eye size={18} />}
      actionLabel={props.node.data.actionLabel || '预览结果'}
      infoRows={[
        sourceCount > 0 ? `已连接 ${sourceCount} 个上游节点` : '还没有指定上游节点',
        props.node.data.summary || '适合放在画布旁边做快速查看和串联确认。',
      ]}
    />
  );
};

export default PreviewNodeCard;
