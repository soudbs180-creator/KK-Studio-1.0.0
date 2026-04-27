import React, { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

type Tone = 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'neutral';
type IconLike = React.ComponentType<{ size?: number; className?: string }>;

const toneStyles: Record<Tone, { iconStyle: CSSProperties; badgeStyle: CSSProperties }> = {
  indigo: {
    iconStyle: {
      border: '1px solid var(--settings-state-info-border)',
      background: 'var(--settings-state-info-bg)',
      color: 'var(--settings-state-info-text)',
    },
    badgeStyle: {
      borderColor: 'var(--settings-state-info-border)',
      background: 'var(--settings-state-info-bg)',
      color: 'var(--settings-state-info-text)',
    },
  },
  emerald: {
    iconStyle: {
      border: '1px solid var(--settings-state-success-border)',
      background: 'var(--settings-state-success-bg)',
      color: 'var(--settings-state-success-text)',
    },
    badgeStyle: {
      borderColor: 'var(--settings-state-success-border)',
      background: 'var(--settings-state-success-bg)',
      color: 'var(--settings-state-success-text)',
    },
  },
  sky: {
    iconStyle: {
      border: '1px solid var(--settings-state-info-border)',
      background: 'var(--settings-state-info-bg)',
      color: 'var(--settings-state-info-text)',
    },
    badgeStyle: {
      borderColor: 'var(--settings-state-info-border)',
      background: 'var(--settings-state-info-bg)',
      color: 'var(--settings-state-info-text)',
    },
  },
  amber: {
    iconStyle: {
      border: '1px solid var(--settings-state-warning-border)',
      background: 'var(--settings-state-warning-bg)',
      color: 'var(--settings-state-warning-text)',
    },
    badgeStyle: {
      borderColor: 'var(--settings-state-warning-border)',
      background: 'var(--settings-state-warning-bg)',
      color: 'var(--settings-state-warning-text)',
    },
  },
  rose: {
    iconStyle: {
      border: '1px solid var(--settings-state-danger-border)',
      background: 'var(--settings-state-danger-bg)',
      color: 'var(--settings-state-danger-text)',
    },
    badgeStyle: {
      borderColor: 'var(--settings-state-danger-border)',
      background: 'var(--settings-state-danger-bg)',
      color: 'var(--settings-state-danger-text)',
    },
  },
  slate: {
    iconStyle: {
      border: '1px solid var(--border-light)',
      background: 'var(--bg-overlay)',
      color: 'var(--text-secondary)',
    },
    badgeStyle: {
      borderColor: 'var(--border-light)',
      background: 'var(--bg-overlay)',
      color: 'var(--text-secondary)',
    },
  },
  neutral: {
    iconStyle: {
      border: '1px solid var(--border-light)',
      background: 'var(--bg-overlay)',
      color: 'var(--text-secondary)',
    },
    badgeStyle: {
      borderColor: 'var(--border-light)',
      background: 'var(--bg-overlay)',
      color: 'var(--text-secondary)',
    },
  },
};

const buttonToneStyles: Record<'secondary' | 'primary' | 'danger', CSSProperties> = {
  secondary: {
    borderColor: 'var(--settings-button-secondary-border)',
    background: 'var(--settings-button-secondary-bg)',
    color: 'var(--settings-button-secondary-text)',
  },
  primary: {
    borderColor: 'transparent',
    background: '#0071e3' /* Apple Blue */,
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(0, 113, 227, 0.24)',
  },
  danger: {
    borderColor: 'var(--settings-button-danger-border)',
    background: 'var(--settings-button-danger-bg)',
    color: 'var(--settings-button-danger-text)',
  },
};

export const SETTINGS_PANEL_STYLE = {
  borderColor: 'transparent',
  background: 'var(--settings-section-bg)',
  boxShadow: 'var(--shadow-sm)',
} as const;

export const SETTINGS_ELEVATED_STYLE = {
  borderColor: 'transparent',
  background: 'var(--settings-surface-elevated)',
  boxShadow: 'var(--shadow-md)',
} as const;

export const SETTINGS_OVERLAY_STYLE = {
  borderColor: 'transparent',
  background: 'var(--settings-surface-overlay)',
  boxShadow: 'var(--shadow-lg)',
} as const;

export const SETTINGS_SUCCESS_STYLE = {
  borderColor: 'var(--settings-state-success-border)',
  backgroundColor: 'var(--settings-state-success-bg)',
} as const;

export const SETTINGS_INFO_STYLE = {
  borderColor: 'var(--settings-state-info-border)',
  backgroundColor: 'var(--settings-state-info-bg)',
} as const;

export const SETTINGS_WARNING_STYLE = {
  borderColor: 'var(--settings-state-warning-border)',
  backgroundColor: 'var(--settings-state-warning-bg)',
} as const;

export const SETTINGS_DANGER_STYLE = {
  borderColor: 'var(--settings-state-danger-border)',
  backgroundColor: 'var(--settings-state-danger-bg)',
} as const;

export const SETTINGS_INPUT_CLASSNAME =
  'w-full rounded-[var(--radius-control-md)] border border-[var(--settings-input-border)] bg-[var(--settings-input-bg)] px-3 py-2.5 text-[length:var(--type-body-2)] text-[var(--text-primary)] outline-none transition focus:border-[var(--settings-focus-border)] focus:ring-2 focus:ring-[var(--settings-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';

export const SETTINGS_LABEL_CLASSNAME =
  'text-[length:var(--type-micro)] font-medium tracking-[0.03em] text-[var(--text-tertiary)]';

export const SettingsViewShell: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="settings-view-shell settings-reference-stack space-y-6 pb-4">{children}</div>
);

export const SettingsBadge: React.FC<{ children: ReactNode; tone?: Tone; className?: string }> = ({
  children,
  tone = 'neutral',
  className = '',
}) => (
  <span
    className={`inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-full px-3 py-1.5 text-left font-medium uppercase tracking-[0.12em] leading-[1.3] whitespace-nowrap ${className}`.trim()}
    style={{
      ...toneStyles[tone].badgeStyle,
      fontSize: 'var(--type-micro)',
    }}
  >
    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
  </span>
);

type SettingsHeroProps = {
  title: string;
  description: ReactNode;
  eyebrow?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  metrics?: ReactNode;
  icon?: IconLike;
  tone?: Tone;
  className?: string;
};

export const SettingsHero: React.FC<SettingsHeroProps> = ({
  title,
  description,
  eyebrow,
  badge,
  actions,
  metrics,
  icon: Icon,
  tone = 'indigo',
  className = '',
}) => {
  const toneStyle = toneStyles[tone];

  return (
    <section
      className={`settings-reference-card settings-reference-card--elevated settings-hero-card space-y-5 p-6 ${className}`.trim()}
      style={SETTINGS_ELEVATED_STYLE}
    >
      <div className="settings-hero-card__header flex flex-wrap items-start justify-between gap-5">
        <div className="settings-hero-card__lead flex min-w-0 flex-1 items-start gap-4">
          {Icon ? (
            <div
              className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center border"
              style={{
                ...toneStyle.iconStyle,
                borderRadius: 'var(--radius-surface-md)',
              }}
            >
              <Icon size={17} />
            </div>
          ) : null}
          <div className="settings-hero-card__title-wrap min-w-0 flex-1">
            {eyebrow ? (
              <div className="settings-reference-page-header__eyebrow">
                {eyebrow}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2
                className="min-w-0 break-words"
                style={{
                  overflowWrap: 'anywhere',
                  fontSize: 'var(--type-title-1)',
                  lineHeight: 'var(--ui-line-height-tight)',
                }}
              >
                {title}
              </h2>
              {badge}
            </div>
            {description ? (
              <p
                className="mt-3 max-w-3xl break-words"
                style={{
                  color: 'var(--text-secondary)',
                  overflowWrap: 'anywhere',
                  fontSize: 'var(--type-body-2)',
                  lineHeight: 'var(--ui-line-height-relaxed)',
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="settings-hero-card__actions settings-reference-actions">{actions}</div> : null}
      </div>
      {metrics ? <div className="settings-reference-grid-4">{metrics}</div> : null}
    </section>
  );
};

type SettingsMetricCardProps = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: IconLike;
  tone?: Tone;
};

export const SettingsMetricCard: React.FC<SettingsMetricCardProps> = ({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'neutral',
}) => {
  const toneStyle = toneStyles[tone];

  return (
    <div className="settings-reference-mini-metric h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="settings-reference-mini-metric__label break-words" style={{ overflowWrap: 'anywhere' }}>
            {label}
          </div>
        </div>
        {Icon ? (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center border"
            style={{
              ...toneStyle.iconStyle,
              borderRadius: 'var(--radius-control-md)',
            }}
          >
            <Icon size={14} />
          </div>
        ) : null}
      </div>
      <div
        className="settings-reference-mini-metric__value min-w-0 break-words [font-variant-numeric:tabular-nums]"
        style={{ overflowWrap: 'anywhere' }}
      >
        {value}
      </div>
      {helper ? (
        <div
          className="settings-reference-mini-metric__helper break-words"
          style={{ overflowWrap: 'anywhere' }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
};

type SettingsSectionProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
  testId?: string;
  surface?: 'card' | 'plain';
  children: ReactNode;
};

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  eyebrow,
  action,
  testId,
  surface = 'card',
  children,
}) => (
  <section className="space-y-3" data-testid={testId}>
    {surface === 'card' ? (
      <div className="settings-section-card settings-reference-card settings-reference-card--elevated p-5" style={SETTINGS_PANEL_STYLE}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div
                className="mb-2 text-left font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--text-tertiary)', fontSize: 'var(--type-caption)' }}
              >
                {eyebrow}
              </div>
            ) : null}
            <h3
              className="break-words text-left"
              style={{
                color: 'var(--text-primary)',
                overflowWrap: 'anywhere',
                fontSize: 'var(--type-title-3)',
                fontWeight: 600,
                lineHeight: 'var(--ui-line-height-tight)',
              }}
            >
              {title}
            </h3>
            {description ? (
              <p
                className="mt-2 break-words"
                style={{
                  color: 'var(--text-secondary)',
                  overflowWrap: 'anywhere',
                  fontSize: 'var(--type-body-2)',
                  lineHeight: 'var(--ui-line-height-relaxed)',
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex flex-shrink-0 items-center gap-2">{action}</div> : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    ) : (
      <>
        <div className="flex flex-wrap items-start justify-between gap-4 px-1">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div
                className="mb-2 text-left font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--text-tertiary)', fontSize: 'var(--type-caption)' }}
              >
                {eyebrow}
              </div>
            ) : null}
            <h3
              className="break-words text-left"
              style={{
                color: 'var(--text-primary)',
                overflowWrap: 'anywhere',
                fontSize: 'var(--type-title-3)',
                fontWeight: 600,
                lineHeight: 'var(--ui-line-height-tight)',
              }}
            >
              {title}
            </h3>
            {description ? (
              <p
                className="mt-2 break-words"
                style={{
                  color: 'var(--text-secondary)',
                  overflowWrap: 'anywhere',
                  fontSize: 'var(--type-body-2)',
                  lineHeight: 'var(--ui-line-height-relaxed)',
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex flex-shrink-0 items-center gap-2">{action}</div> : null}
        </div>
        {children}
      </>
    )}
  </section>
);

type SettingsActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconLike;
  tone?: 'secondary' | 'primary' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
};

export const SettingsActionButton: React.FC<SettingsActionButtonProps> = ({
  children,
  icon: Icon,
  tone = 'secondary',
  size = 'md',
  loading = false,
  type = 'button',
  style,
  className = '',
  ...buttonProps
}) => (
  <button
    type={type}
    className={`inline-flex max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden border text-left font-medium leading-tight transition-opacity duration-150 hover:opacity-70 active:opacity-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap ${size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2'} ${className}`.trim()}
    style={{
      borderRadius: tone === 'primary' ? '980px' : (size === 'sm' ? 'var(--radius-control-sm)' : 'var(--radius-control-md)'),
      fontSize: size === 'sm' ? 'var(--type-caption)' : 'var(--type-body-2)',
      minHeight: size === 'sm' ? 'var(--ui-control-height-compact)' : 'var(--ui-control-height-default)',
      ...buttonToneStyles[tone],
      ...style,
    }}
    {...buttonProps}
  >
    {Icon ? (
      <span
        aria-hidden="true"
        className={`settings-button-icon-slot ${size === 'sm' ? 'settings-button-icon-slot--sm' : ''}`.trim()}
      >
        <Icon size={size === 'sm' ? 14 : 16} className={loading ? 'animate-spin' : undefined} />
      </span>
    ) : null}
    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
  </button>
);

type SettingsDangerZoneProps = {
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

export const SettingsDangerZone: React.FC<SettingsDangerZoneProps> = ({
  title,
  description,
  action,
}) => (
  <div
    className="settings-danger-zone border p-4"
    style={{
      borderColor: 'var(--state-danger-border)',
      backgroundColor: 'var(--state-danger-bg)',
      borderRadius: 'var(--radius-control-md)',
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div
          className="break-words font-medium"
          style={{
            color: 'var(--state-danger-text)',
            overflowWrap: 'anywhere',
            fontSize: 'var(--type-body-1)',
          }}
        >
          {title}
        </div>
        <div
          className="mt-0.5 break-words"
          style={{
            color: 'var(--text-tertiary)',
            overflowWrap: 'anywhere',
            fontSize: 'var(--type-body-2)',
            lineHeight: 'var(--ui-line-height-body)',
          }}
        >
          {description}
        </div>
      </div>
      {action ? <div className="flex flex-shrink-0 gap-2">{action}</div> : null}
    </div>
  </div>
);
