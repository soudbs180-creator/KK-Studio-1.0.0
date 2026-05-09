import React from 'react';
import { Sparkles } from 'lucide-react';
import type { AgentWorkflowNode } from '../../types';
import WorkflowUtilityCard from './WorkflowUtilityCard';

interface AgentNodeCardProps {
  node: AgentWorkflowNode;
  isSelected?: boolean;
  highlighted?: boolean;
  zoomScale?: number;
  snapToGrid?: boolean;
  onSelect?: () => void;
  onBringToFront?: () => void;
  onDelete?: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onAction?: (node: AgentWorkflowNode) => void;
}

const AgentNodeCard: React.FC<AgentNodeCardProps> = (props) => {
  const sourceCount = props.node.data.sourceNodeIds?.length || 0;

  return (
    <WorkflowUtilityCard
      {...props}
      title={props.node.data.title || '提示增强卡'}
      subtitle="把提示增强、素材整理和结果归档做成迷你功能卡，不替代原来的生成逻辑。"
      accentClassName="workflow-agent-card"
      icon={<Sparkles size={18} />}
      actionLabel={props.node.data.actionLabel || '填入提示栏'}
      infoRows={[
        props.node.data.instruction || '在这里放一段可复用的增强提示或整理规则。',
        sourceCount > 0 ? `当前参考 ${sourceCount} 个节点` : '可单独作为灵感卡使用',
      ]}
    />
  );
};

export default AgentNodeCard;
