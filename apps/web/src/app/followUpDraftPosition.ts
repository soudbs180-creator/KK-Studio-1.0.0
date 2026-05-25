import type { GeneratedImage, PromptNode } from '../types';

type FollowUpDraftPositionOptions = {
  sourceImage: GeneratedImage;
  parentPrompt: PromptNode | null;
  imageNodes: GeneratedImage[];
};

export const resolveFollowUpDraftPosition = ({
  sourceImage,
  parentPrompt,
  imageNodes,
}: FollowUpDraftPositionOptions): { x: number; y: number } => {
  if (!parentPrompt) {
    return {
      x: sourceImage.position.x,
      y: sourceImage.position.y + 100,
    };
  }

  let maxBottomY = parentPrompt.position.y;
  imageNodes.forEach((imageNode) => {
    if (imageNode.parentPromptId === parentPrompt.id) {
      maxBottomY = Math.max(maxBottomY, imageNode.position.y);
    }
  });

  return {
    x: sourceImage.position.x,
    y: maxBottomY + 80,
  };
};
