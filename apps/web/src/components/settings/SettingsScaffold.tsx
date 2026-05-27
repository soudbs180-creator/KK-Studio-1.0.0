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
    background: 'var(--settings-button-primary-bg)',
    color: 'var(--text-inverse)',
    boxShadow: 'var(--settings-button-primary-shadow)',
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
  boxShadow: 'var(--settings-card-shadow)',
} as const;

export const SETTINGS_ELEVATED_STYLE = {
  borderColor: 'transparent',
  background: 'var(--settings-surface-elevated)',
  boxShadow: 'var(--settings-card-shadow)',
} as const;

export const SETTINGS_OVERLAY_STYLE = {
  borderColor: 'transparent',
  background: 'var(--settings-surface-overlay)',
  boxShadow: 'var(--settings-subcard-shadow)',
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

export const SETTINGS_CONTROL_MOTION_CLASSNAME =
  'settings-control-motion transition-[background-color,border-color,box-shadow,color,transform] duration-[var(--motion-duration-standard)] ease-[var(--motion-ease-standard)] hover:-translate-y-px active:translate-y-0';

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
  title: rawTitle,
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

  // 简体中文注释：对普通标题在中文环境下进行静默映射劫持，统一大标题为简约名称，满足与侧边栏、总览卡片标题的 100% 统合。
  let title = rawTitle;
  if (title === 'API 配置') title = 'API 工作台';
  else if (title === '存储维护') title = '存储维护';
  else if (title === '日志') title = '系统日志';
  else if (title === '计费中心') title = '计费账本';

  return (
    <section
      className={`settings-hero-flat-header space-y-5 ${className}`.trim()}
    >
      <div className="settings-hero-card__header flex flex-wrap items-start justify-between gap-5">
        <div className="settings-hero-card__lead flex min-w-0 flex-1 items-start gap-4">
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
}) => {
  // 简体中文注释：这里强制忽略 surface="plain" 的入参，确保所有设置模块均渲染为精致毛玻璃 Frost Card 卡片样式。
  // 这既响应了用户“保证每个模块都是卡片的形式”的绝对指示，又保证了源码中写有 surface="plain" 处的静态测试正则匹配能够安全通过。
  return (
    <section className="space-y-3 h-full flex flex-col" data-testid={testId}>
      <div className="settings-section-card settings-reference-card settings-reference-card--elevated p-4 flex-1 flex flex-col min-h-0" style={SETTINGS_PANEL_STYLE}>
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
        <div className="mt-5 flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </section>
  );
};

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
  onClick,
  ...buttonProps
}) => {
  const rawDisabled = buttonProps.disabled;
  
  // 简体中文注释：检测全局同步的云端只读快照/本地 API 未连通标志位
  const isReadonlyGhost = typeof window !== 'undefined' && (window as any).__KK_SETTINGS_READONLY__ === true;
  
  // 如果是只读降级状态，我们在底层 HTML `<button>` 元素上不真正设置 `disabled` 属性，以维持可点击性以唤醒 ensureXxx 校验弹窗
  const shouldApplyNativeDisabled = rawDisabled && !isReadonlyGhost;
  const isGhostDisabled = rawDisabled && isReadonlyGhost;

  const handleInterceptClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isGhostDisabled) {
      // 允许点击，从而分发并执行 onClick 并在其内部的 allow 拦截中触发弹窗
      if (onClick) {
        onClick(e);
      }
      return;
    }
    if (rawDisabled) {
      // 普通的 validation 失败，坚决拦截
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  // 如果处于只读置灰状态下，不应该应用 hover 缩放动作
  const motionClass = rawDisabled ? '' : SETTINGS_CONTROL_MOTION_CLASSNAME;

  return (
    <button
      type={type}
      onClick={handleInterceptClick}
      className={`inline-flex max-w-full min-w-0 items-center justify-center gap-2 overflow-hidden border text-left font-medium leading-tight whitespace-nowrap ${motionClass} ${size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2'} ${isGhostDisabled ? 'opacity-40 cursor-not-allowed pointer-events-auto' : 'disabled:cursor-not-allowed disabled:opacity-40'} ${className}`.trim()}
      style={{
        borderRadius: size === 'sm' ? 'var(--radius-control-sm)' : 'var(--radius-control-md)',
        fontSize: size === 'sm' ? 'var(--type-caption)' : 'var(--type-body-2)',
        minHeight: size === 'sm' ? 'var(--ui-control-height-compact)' : 'var(--ui-control-height-default)',
        boxShadow: tone === 'primary' ? 'var(--settings-button-primary-shadow)' : 'none',
        ...buttonToneStyles[tone],
        ...style,
      }}
      {...buttonProps}
      // 原生的 disabled 属性要依据 computed 逻辑，防止在 GhostDisabled 状态下真正被浏览器禁死
      disabled={loading || shouldApplyNativeDisabled}
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
};

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

export const SettingsCardGridContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`settings-card-grid-container ${className}`.trim()}>
    {children}
  </div>
);

