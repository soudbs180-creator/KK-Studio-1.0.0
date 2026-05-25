import type { ReactNode } from 'react';

export type WorkflowRenderItemBase<TKind extends string = string> = {
  id: string;
  kind: TKind;
};

export type WorkflowNodeRendererRegistry<TItem extends WorkflowRenderItemBase> = {
  [K in TItem['kind']]: (item: Extract<TItem, { kind: K }>) => ReactNode;
};

export const createWorkflowNodeRendererRegistry = <
  TItem extends WorkflowRenderItemBase,
>(
  registry: WorkflowNodeRendererRegistry<TItem>,
): WorkflowNodeRendererRegistry<TItem> => registry;

export const renderWorkflowNode = <TItem extends WorkflowRenderItemBase>(
  registry: WorkflowNodeRendererRegistry<TItem>,
  item: TItem,
): ReactNode => {
  const renderer = registry[item.kind as TItem['kind']] as (item: TItem) => ReactNode;
  return renderer(item);
};
