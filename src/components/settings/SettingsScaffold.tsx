import React, { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

type Tone = 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'neutral';
type IconLike = React.ComponentType<{ size?: number; className?: string }>;

const toneStyles: Record<Tone, { iconStyle: CSSProperties; badgeStyle: CSSProperties }> = {
  indigo: {
    iconStyle: {
      border: '1px solid var(--state-info-border)',
      background: 'var(--state-info-bg)',
      color: 'var(--state-info-text)',
    },
    badgeStyle: {
      borderColor: 'var(--state-info-border)',
      background: 'var(--state-info-bg)',
      color: 'var(--state-info-text)',
    },
  },
  emerald: {
    iconStyle: {
      border: '1px solid var(--state-success-border)',
      background: 'var(--state-success-bg)',
      color: 'var(--state-success-text)',
    },
    badgeStyle: {
      borderColor: 'var(--state-success-border)',
      background: 'var(--state-success-bg)',
      color: 'var(--state-success-text)',
    },
  },
  sky: {
    iconStyle: {
      border: '1px solid var(--state-info-border)',
      background: 'var(--state-info-bg)',
      color: 'var(--state-info-text)',
    },
    badgeStyle: {
      borderColor: 'var(--state-info-border)',
      background: 'var(--state-info-bg)',
      color: 'var(--state-info-text)',
    },
  },
  amber: {
    iconStyle: {
      border: '1px solid var(--state-warning-border)',
      background: 'var(--state-warning-bg)',
      color: 'var(--state-warning-text)',
    },
    badgeStyle: {
      borderColor: 'var(--state-warning-border)',
      background: 'var(--state-warning-bg)',
      color: 'var(--state-warning-text)',
    },
  },
  rose: {
    iconStyle: {
      border: '1px solid var(--state-danger-border)',
      background: 'var(--state-danger-bg)',
      color: 'var(--state-danger-text)',
    },
    badgeStyle: {
      borderColor: 'var(--state-danger-border)',
      background: 'var(--state-danger-bg)',
      color: 'var(--state-danger-text)',
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
    background: 'var(--settings-button-primary-bg)',
    color: 'var(--settings-button-primary-text)',
    boxShadow: 'var(--settings-button-primary-shadow)',
  },
  danger: {
    borderColor: 'var(--settings-button-danger-border)',
    background: 'var(--settings-button-danger-bg)',
    color: 'var(--settings-button-danger-text)',
  },
};

export const SETTINGS_PANEL_STYLE = {
  borderColor: 'var(--settings-border-subtle)',
  background: 'var(--settings-section-bg)',
} as const;

export const SETTINGS_ELEVATED_STYLE = {
  borderColor: 'var(--settings-border-subtle)',
  background: 'var(--settings-surface-elevated)',
} as const;

export const SETTINGS_OVERLAY_STYLE = {
  borderColor: 'var(--settings-border-subtle)',
  background: 'var(--settings-surface-overlay)',
} as const;

export const SETTINGS_SUCCESS_STYLE = {
  borderColor: 'var(--state-success-border)',
  backgroundColor: 'var(--state-success-bg)',
} as const;

export const SETTINGS_WARNING_STYLE = {
  borderColor: 'var(--state-warning-border)',
  backgroundColor: 'var(--state-warning-bg)',
} as const;

export const SETTINGS_DANGER_STYLE = {
  borderColor: 'var(--state-danger-border)',
  backgroundColor: 'var(--state-danger-bg)',
} as const;

export const SETTINGS_INPUT_CLASSNAME =
  'w-full rounded-[8px] border border-[var(--settings-input-border)] bg-[var(--settings-input-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--settings-focus-border)] focus:ring-2 focus:ring-[var(--settings-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60';

export const SETTINGS_LABEL_CLASSNAME =
  'text-[11px] font-medium tracking-[0.03em] text-[var(--text-tertiary)]';

export const SettingsViewShell: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="settings-view-shell settings-reference-stack space-y-6 pb-4">{children}</div>
);

export const SettingsBadge: React.FC<{ children: ReactNode; tone?: Tone; className?: string }> = ({
  children,
  tone = 'neutral',
  className = '',
}) => (
  <span
    className={`inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-full px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-[0.12em] leading-[1.3] whitespace-nowrap ${className}`.trim()}
    style={toneStyles[tone].badgeStyle}
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
    <section className={`space-y-5 ${className}`.trim()}>
      <div className="settings-reference-page-header">
        <div className="settings-reference-page-header__lead">
          {eyebrow ? (
            <div className="settings-reference-page-header__eyebrow">
              {eyebrow}
            </div>
          ) : null}
          <div className="flex min-w-0 items-start gap-4">
            {Icon ? (
              <div
                className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border"
                style={toneStyle.iconStyle}
              >
                <Icon size={17} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 break-words" style={{ overflowWrap: 'anywhere' }}>
                  {title}
                </h2>
                {badge}
              </div>
              {description ? (
                <p
                  className="mt-2 max-w-3xl break-words text-[14px] leading-6"
                  style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="settings-reference-actions">{actions}</div> : null}
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
            style={toneStyle.iconStyle}
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
  children: ReactNode;
};

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  eyebrow,
  action,
  children,
}) => (
  <section className="space-y-3">
    <div className="flex items-start justify-between gap-3 px-1">
      <h3
        className="text-left text-[12px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {eyebrow || title}
      </h3>
      {action ? <div className="flex flex-shrink-0 items-center gap-2">{action}</div> : null}
    </div>
    <div className="settings-reference-card settings-reference-card--elevated p-5" style={SETTINGS_PANEL_STYLE}>
      {children}
    </div>
    {description ? (
      <p
        className="settings-ios-footer break-words px-1 text-[13px] leading-6"
        style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}
      >
        {description}
      </p>
    ) : null}
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
    className={`inline-flex max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-[8px] border text-left font-medium leading-tight transition-opacity duration-150 hover:opacity-70 active:opacity-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap ${size === 'sm' ? 'min-h-9 px-3 py-1.5 text-xs' : 'min-h-10 px-4 py-2 text-[13px]'} ${className}`.trim()}
    style={{
      borderRadius: size === 'sm' ? 14 : 16,
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
    className="settings-danger-zone rounded-[10px] border p-4"
    style={{
      borderColor: 'var(--state-danger-border)',
      backgroundColor: 'var(--state-danger-bg)',
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="break-words text-[15px] font-medium" style={{ color: 'var(--state-danger-text)', overflowWrap: 'anywhere' }}>
          {title}
        </div>
        <div className="mt-0.5 break-words text-[13px] leading-5" style={{ color: 'var(--text-tertiary)', overflowWrap: 'anywhere' }}>
          {description}
        </div>
      </div>
      {action ? <div className="flex flex-shrink-0 gap-2">{action}</div> : null}
    </div>
  </div>
);
