import React from 'react';
import ImageGenerationGroupRenderer from './ImageGenerationGroupRenderer';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const VideoGenerationGroupRenderer: React.FC<CanvasCardRenderContext> = (props) => {
  return <ImageGenerationGroupRenderer {...props} />;
};
export default VideoGenerationGroupRenderer;
