import type { GeneratedImage, PromptNode } from '../types';

type CanvasSnapshot = {
  imageNodes: GeneratedImage[];
  promptNodes: PromptNode[];
} | undefined;

interface PersistGeneratingPromptNodeArgs {
  addPromptNode: (node: PromptNode) => void | Promise<void>;
  deletePromptNode: (id: string) => void | Promise<void>;
  generatingNode: PromptNode;
  getCanvas: () => CanvasSnapshot;
  updateImageNodePosition: (
    id: string,
    position: { x: number; y: number },
    options?: { ignoreSelection?: boolean }
  ) => void | Promise<void>;
  updatePromptNode: (node: PromptNode) => void | Promise<void>;
}

const STACK_SHIFT_Y = 10;
const STACK_MATCH_X = 36;
const STACK_MATCH_Y = 120;

export async function persistGeneratingPromptNode({
  addPromptNode,
  deletePromptNode,
  generatingNode,
  getCanvas,
  updateImageNodePosition,
  updatePromptNode,
}: PersistGeneratingPromptNodeArgs): Promise<PromptNode> {
  const canvasForWrite = getCanvas();

  const overlappingPromptGroups = (canvasForWrite?.promptNodes || [])
    .filter((node) => (
      node.id !== generatingNode.id
      && Math.abs(node.position.x - generatingNode.position.x) <= STACK_MATCH_X
      && Math.abs(node.position.y - generatingNode.position.y) <= STACK_MATCH_Y
    ))
    .sort((left, right) => right.position.y - left.position.y);

  for (const node of overlappingPromptGroups) {
    const freshNode = getCanvas()?.promptNodes.find((candidate) => candidate.id === node.id);
    if (freshNode) {
      await updatePromptNode({
        ...freshNode,
        position: {
          ...freshNode.position,
          y: freshNode.position.y - STACK_SHIFT_Y,
        },
      });
    }

    const childImages = (canvasForWrite?.imageNodes || []).filter((imageNode) => imageNode.parentPromptId === node.id);
    for (const imageNode of childImages) {
      const nextPosition = {
        ...imageNode.position,
        y: imageNode.position.y - STACK_SHIFT_Y,
      };
      await updateImageNodePosition(imageNode.id, nextPosition, { ignoreSelection: true });
    }
  }

  const existingNode = canvasForWrite?.promptNodes.find((node) => node.id === generatingNode.id);
  let persistedNode = generatingNode;

  if (existingNode) {
    console.log('[handleGenerate] Updating existing node:', generatingNode.id);
    await updatePromptNode(generatingNode);
  } else {
    const strayDraft = canvasForWrite?.promptNodes.find((node) => node.isDraft);
    if (strayDraft) {
      console.log('[handleGenerate] Found stray draft during generation, converting it:', strayDraft.id);
      persistedNode = { ...generatingNode, id: strayDraft.id, position: generatingNode.position };
      await updatePromptNode(persistedNode);
    } else {
      console.log('[handleGenerate] Creating NEW node:', generatingNode.id);
      await addPromptNode(generatingNode);
      console.log('[handleGenerate] addPromptNode completed for:', generatingNode.id, 'isDraft:', generatingNode.isDraft);
    }
  }

  const leftovers = getCanvas()?.promptNodes.filter((node) => node.isDraft && node.id !== persistedNode.id) || [];
  if (leftovers.length > 0) {
    console.log('[handleGenerate] Cleaning up orphan drafts:', leftovers.map((node) => node.id));
    for (const node of leftovers) {
      await deletePromptNode(node.id);
    }
  }

  return persistedNode;
}
