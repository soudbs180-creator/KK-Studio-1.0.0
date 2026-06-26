import React from 'react';
import ImageGenerationGroupRenderer from './ImageGenerationGroupRenderer';
import type { CanvasCardRenderContext } from './CanvasCardRendererRegistry';

export const EcommerceTaskCardRenderer: React.FC<CanvasCardRenderContext> = (props) => {
  return <ImageGenerationGroupRenderer {...props} />;
};
export default EcommerceTaskCardRenderer;
