import React from 'react';

import { ProgressBar, StatusBadge } from './ui/index';

type EndpointStatusVariant = 'online' | 'offline' | 'warning' | 'error' | 'paused';

export type ConsoleEndpointCardMetric = {
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  helperClassName?: string;
};

type ConsoleEndpointCardProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  avatar: React.ReactNode;
  badges?: React.ReactNode;
  status: { status: EndpointStatusVariant; label: string };
  metrics: ConsoleEndpointCardMetric[];
  progress?: { summary: string; percentage: number };
  error?: string | null;
  actions: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  cardRef?: React.Ref<HTMLElement>;
};

function flattenCardActions(node: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(node).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flattenCardActions((child.props as { children?: React.ReactNode }).children);
    }

    return [child];
  });
}

function decorateCardActionNode(
  node: React.ReactNode,
  options: {
    className: string;
    tone?: 'primary' | 'secondary' | 'danger';
  },
): React.ReactNode {
  if (!React.isValidElement(node)) {
    return node;
  }

  const existingProps = node.props as {
    className?: string;
    tone?: 'primary' | 'secondary' | 'danger';
  };

  const nextClassName = [existingProps.className, options.className].filter(Boolean).join(' ');

  return React.cloneElement(
    node as React.ReactElement<{
      className?: string;
      tone?: 'primary' | 'secondary' | 'danger';
    }>,
    {
      className: nextClassName,
      tone: existingProps.tone ?? options.tone,
    },
  );
}

export const ConsoleEndpointCard: React.FC<ConsoleEndpointCardProps> = ({
  title,
  subtitle,
  meta,
  avatar,
  badges,
  status,
  metrics,
  progress,
  error,
  actions,
  footer,
  className = '',
  cardRef,
}) => {
  const cardClass = ['settings-provider-card', className].filter(Boolean).join(' ');
  const progressPercentage = progress?.percentage ?? 0;
  const progressTone = progressPercentage >= 90 ? 'rose' : progressPercentage >= 70 ? 'amber' : 'indigo';
  const actionItems = flattenCardActions(actions);
  const [primaryAction, ...secondaryActions] = actionItems;
  const primaryActionNode = decorateCardActionNode(primaryAction, {
    className: 'settings-provider-card__primary-action settings-provider-card__action-button--wrap',
    tone: 'primary',
  });
  const secondaryActionNodes = secondaryActions.map((action, index) => (
    <React.Fragment key={`secondary-action-${index}`}>
      {decorateCardActionNode(action, {
        className: 'settings-provider-card__action-button--wrap',
      })}
    </React.Fragment>
  ));

  return (
    <article ref={cardRef} className={cardClass}>
      <div className="settings-provider-card__header">
        <div className="settings-provider-card__header-main">
          <div className="settings-provider-card__avatar">{avatar}</div>
          <div className="settings-provider-card__header-copy">
            <div className="settings-provider-card__header-title-row">
              <div className="text-[18px] font-semibold text-[var(--text-primary)]">{title}</div>
              {badges}
            </div>
            {subtitle ? <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{subtitle}</div> : null}
            {meta ? <div className="mt-2 text-[12px] text-[var(--text-tertiary)]">{meta}</div> : null}
          </div>
        </div>
        <div className="settings-provider-card__header-side">
          <StatusBadge status={status.status} label={status.label} />
          {primaryActionNode ? (
            <div className="settings-provider-card__header-primary-action">
              {primaryActionNode}
            </div>
          ) : null}
        </div>
      </div>

      <div className="settings-provider-card__metrics">
        {metrics.map((metric, index) => (
          <div
            key={`${metric.label}-${index}`}
            className={['settings-provider-card__metric', metric.className].filter(Boolean).join(' ')}
          >
            <div className="settings-provider-card__metric-label">{metric.label}</div>
            <div className={['settings-provider-card__metric-value', metric.valueClassName].filter(Boolean).join(' ')}>
              {metric.value}
            </div>
            {metric.helper ? (
              <div className={['settings-provider-card__metric-helper', metric.helperClassName].filter(Boolean).join(' ')}>
                {metric.helper}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {footer ? <div className="mt-2">{footer}</div> : null}

      {progress ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--text-secondary)]">
            <span>{progress.summary}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <ProgressBar progress={progressPercentage} tone={progressTone} showLabel={false} />
        </div>
      ) : null}

      {error ? (
        <div
          className="mt-4 rounded-[18px] border px-4 py-3 text-[13px] leading-6"
          style={{
            borderColor: 'var(--state-danger-border)',
            backgroundColor: 'var(--state-danger-bg)',
            color: 'var(--state-danger-text)',
          }}
        >
          {error}
        </div>
      ) : null}

      {secondaryActionNodes.length > 0 ? (
        <div className="settings-provider-card__actions">
          <div className="settings-provider-card__actions-layout">
            <div className="settings-provider-card__actions-secondary">{secondaryActionNodes}</div>
          </div>
        </div>
      ) : null}
    </article>
  );
};
