export type CanvasCardAccent = 'blue' | 'gold' | 'red' | 'pink' | 'teal' | 'coral' | 'ochre';

interface CanvasCardShadowOptions {
    accent?: CanvasCardAccent;
    boost?: boolean;
    zoomScale?: number;
}

export const getCanvasCardShadow = (_options: CanvasCardShadowOptions = {}) => {
    // Clay canvas card shadow: flat cards use color, hairlines, and warm surfaces for hierarchy.
    return 'none';
};
