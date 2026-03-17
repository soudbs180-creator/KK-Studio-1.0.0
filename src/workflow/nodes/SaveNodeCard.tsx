import React from 'react';
import { Download } from 'lucide-react';
import type { SaveWorkflowNode } from '../../types';
import WorkflowUtilityCard from './WorkflowUtilityCard';

interface SaveNodeCardProps {
  node: SaveWorkflowNode;
  isSelected?: boolean;
  highlighted?: boolean;
  zoomScale?: number;
  onSelect?: () => void;
  onBringToFront?: () => void;
  onDelete?: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onAction?: (node: SaveWorkflowNode) => void;
}

const SaveNodeCard: React.FC<SaveNodeCardProps> = (props) => {
  const formatLabel = (props.node.data.format || 'zip').toUpperCase();
  const sourceCount = props.node.data.sourceNodeIds?.length || 0;

  return (
    <WorkflowUtilityCard
      {...props}
      title={props.node.data.title || '保存卡'}
      subtitle="复用你现有的导出与存储能力，作为附加卡挂在工作区里。"
      accentClassName="workflow-save-card"
      icon={<Download size={18} />}
      actionLabel={props.node.data.actionLabel || '导出结果'}
      infoRows={[
        `输出格式: ${formatLabel}`,
        sourceCount > 0 ? `已绑定 ${sourceCount} 个上游节点` : '未指定上游时会导出当前项目结果',
      ]}
    />
  );
};

export default SaveNodeCard;
