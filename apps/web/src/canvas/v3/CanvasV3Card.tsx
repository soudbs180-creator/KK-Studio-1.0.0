import React from 'react';
import { AlertCircle, Check, Circle, Loader2, MoreHorizontal } from 'lucide-react';

import type {
  CanvasCardAction,
  CanvasCardViewModel,
  CanvasV3CardRenderState,
} from './types.ts';

export interface CanvasV3CardProps {
  viewModel: CanvasCardViewModel;
  renderState: CanvasV3CardRenderState;
  children?: React.ReactNode;
  onAction?: (action: CanvasCardAction, viewModel: CanvasCardViewModel) => void;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  className?: string;
}

const STATUS_ICON = {
  idle: Circle,
  running: Loader2,
  succeeded: Check,
  paused: Circle,
  cancelled: Circle,
  error: AlertCircle,
} as const;

/**
 * Shared semantic card chrome prevents each business renderer from inventing
 * its own header, selection ring, footer density, or interaction states.
 */
export const CanvasV3Card = React.forwardRef<HTMLElement, CanvasV3CardProps>(({
  viewModel,
  renderState,
  children,
  onAction,
  onPointerDown,
  className = '',
}, ref) => {
  const StatusIcon = STATUS_ICON[viewModel.status];
  const visibleActions = viewModel.actions.filter((action) => action.priority !== 'overflow').slice(0, 3);
  const hasOverflow = viewModel.actions.some((action) => action.priority === 'overflow');
  const isThumbnail = renderState.detailLevel === 'thumbnail-shell';

  return (
    <article
      ref={ref}
      className={`kk-canvas-v3-card ${className}`}
      data-card-v3-kind={viewModel.kind}
      data-card-v3-status={viewModel.status}
      data-detail-level={renderState.detailLevel}
      data-selected={renderState.selected || undefined}
      data-dragging={renderState.dragging || undefined}
      style={{ width: viewModel.width }}
      onPointerDown={onPointerDown}
    >
      <header className="kk-canvas-v3-card__header">
        <div className="kk-canvas-v3-card__identity">
          <StatusIcon className={viewModel.status === 'running' ? 'kk-canvas-v3-spin' : ''} size={14} aria-hidden="true" />
          <span className="kk-canvas-v3-card__title">{viewModel.title}</span>
        </div>
        <span className="kk-canvas-v3-card__status">{viewModel.statusLabel}</span>
      </header>

      <div className="kk-canvas-v3-card__body">
        {children}
        {!children && viewModel.summary && !isThumbnail && (
          <p className="kk-canvas-v3-card__summary">{viewModel.summary}</p>
        )}
        {viewModel.errorMessage && (
          <p className="kk-canvas-v3-card__error">{viewModel.errorMessage}</p>
        )}
      </div>

      {!isThumbnail && (
        <footer className="kk-canvas-v3-card__footer">
          <div className="kk-canvas-v3-card__metadata">
            {viewModel.metadata.slice(0, 3).map((item) => (
              <span key={item.label} title={`${item.label}: ${item.value}`}>{item.value}</span>
            ))}
          </div>
          <div className="kk-canvas-v3-card__actions">
            {visibleActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction?.(action, viewModel);
                }}
              >
                {action.label}
              </button>
            ))}
            {hasOverflow && (
              <button
                type="button"
                aria-label="更多"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  const action = viewModel.actions.find((item) => item.priority === 'overflow');
                  if (action) onAction?.(action, viewModel);
                }}
              >
                <MoreHorizontal size={14} />
              </button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
});

CanvasV3Card.displayName = 'CanvasV3Card';

export default CanvasV3Card;
