/**
 * Settings UI Components - iOS Style Design System
 * 设置页面UI组件库 - iOS风格设计系统
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { KK_LAYER } from '@kk/ui';
import {
  SETTINGS_CONTROL_MENU_CLASSNAME,
  SETTINGS_CONTROL_MENU_OPTION_CLASSNAME,
  SETTINGS_CONTROL_MENU_TRIGGER_CLASSNAME,
  SETTINGS_CONTROL_MOTION_CLASSNAME,
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
} from '../SettingsScaffold';

// SettingCard 组件
export const SettingCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}> = ({ title, children, className = '', action }) => {
  return (
    <section className={`settings-reference-card settings-reference-card--elevated mb-3 p-5 ${className}`.trim()}>
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="settings-reference-card__title mt-0 min-w-0 flex-1 break-words">
          {title}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
};

// SegmentedControl 双选项组件
export const SegmentedControl: React.FC<{
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}> = ({ options, value, onChange }) => {
  return (
    <div
      className="grid grid-cols-2 gap-2 border p-2"
      style={{
        background: 'var(--settings-segment-shell-bg)',
        borderColor: 'var(--settings-segment-shell-border)',
        boxShadow: 'var(--settings-segment-shell-shadow)',
        borderRadius: 'var(--radius-control-md)',
      }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-w-0 overflow-hidden border px-3 py-2.5 text-ellipsis whitespace-nowrap font-medium ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
            style={{
              background: isActive
                ? 'var(--settings-segment-active-bg)'
                : 'var(--settings-segment-bg)',
              borderColor: isActive
                ? 'var(--settings-segment-active-border)'
                : 'var(--settings-segment-border)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: isActive ? 'var(--settings-segment-active-shadow)' : 'none',
              borderRadius: 'var(--radius-control-md)',
              fontSize: 'var(--type-body-2)',
              minHeight: 'var(--ui-control-height-default)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

// SegmentedControlMulti 多选项滑动组件
export const SegmentedControlMulti: React.FC<{
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  controlAction?: string;
}> = ({ options, value, onChange, disabled = false, controlAction }) => {
  const activeIndex = options.indexOf(value);
  const slideWidth = `${100 / options.length}%`;
  const slideLeft = `${activeIndex * (100 / options.length)}%`;

  return (
    <div 
      className="relative flex overflow-hidden p-1"
      style={{
        background: 'var(--settings-segment-shell-bg)',
        border: '1px solid var(--settings-segment-shell-border)',
        boxShadow: 'var(--settings-segment-shell-shadow)',
        borderRadius: 'var(--radius-control-md)',
      }}
    >
      {/* 滑动背景 */}
      <div
        className="absolute bottom-1 top-1 transition-[transform,width,box-shadow] duration-[var(--motion-duration-standard)] ease-[var(--motion-ease-standard)]"
        style={{
          background: 'var(--settings-segment-active-bg)',
          left: slideLeft,
          width: slideWidth,
          boxShadow: 'var(--settings-segment-active-shadow)',
          borderRadius: 'var(--radius-control-md)',
        }}
      />
      
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => {
            if (!disabled) {
              onChange(option);
            }
          }}
          disabled={disabled}
          data-settings-control-action={controlAction}
          className={`relative z-10 min-w-0 flex-1 overflow-hidden px-2 py-2.5 text-ellipsis whitespace-nowrap font-medium disabled:cursor-not-allowed disabled:opacity-60 ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
          style={{
            color: value === option ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderRadius: 'var(--radius-control-md)',
            fontSize: 'var(--type-body-2)',
            minHeight: 'var(--ui-control-height-default)',
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
};

// IconGrid 图标网格组件
export const IconGrid: React.FC<{
  options: Array<{ value: string; label: string; icon: React.ReactNode }>;
  value: string;
  onChange: (value: string) => void;
  columns?: number;
}> = ({ options, value, onChange, columns = 5 }) => {
  return (
    <div 
      className="flex gap-1.5 overflow-hidden p-2"
      style={{
        background: 'var(--settings-segment-shell-bg)',
        border: '1px solid var(--settings-segment-shell-border)',
        boxShadow: 'var(--settings-segment-shell-shadow)',
        borderRadius: 'var(--radius-control-md)',
      }}
    >
      <div 
        className="grid min-w-0 flex-1 gap-1"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
              style={{
                height: '52px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive
                  ? 'var(--settings-segment-active-bg)'
                  : 'transparent',
                boxShadow: isActive ? 'var(--settings-segment-active-shadow)' : 'none',
                borderRadius: 'var(--radius-control-md)',
              }}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {option.icon}
              </div>
              <span
                className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap leading-none"
                style={{ fontSize: 'var(--type-micro)' }}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const maskSecretDisplay = (value: string) => {
  const str = String(value || '').trim();
  if (!str) return '';
  if (str === '尚未填写') return '尚未填写';
  if (str === 'sk-readonly-0000') return '••••••••••••';
  if (str.startsWith('__kk_redacted__:') || str.startsWith('__kk_r')) {
    return '••••••••••••';
  }
  if (str.length <= 10) return '已填写';
  return `${str.slice(0, 6)}••••${str.slice(-4)}`;
};

// SettingInput 输入框组件
export const SettingInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
  helper?: string;
  disabled?: boolean;
  autoComplete?: string;
  onReveal?: () => void | Promise<void>;
  revealLoading?: boolean;
  controlAction?: string;
}> = ({ label, value, onChange, onBlur, placeholder, type = 'text', helper, disabled = false, autoComplete, onReveal, revealLoading = false, controlAction }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const isPassword = type === 'password';

  const resolvedAutoComplete = autoComplete || (
    isPassword || /key|secret|password|token|name|id|名字|密钥|密匙|用户名|邮箱/i.test(label || '')
      ? 'new-password'
      : undefined
  );

  const isRedactedPasswordValue = (rawValue: string) => {
    const strVal = String(rawValue || '').trim();
    return (
      strVal === 'sk-readonly-0000' ||
      strVal === '尚未填写' ||
      strVal === '已填写' ||
      strVal.includes('...') ||
      strVal.includes('••') ||
      strVal.startsWith('__kk_redacted__:')
    );
  };

  const getDisplayValue = () => {
    if (!isPassword) return value;
    if (!showPassword) return value;

    if (isRedactedPasswordValue(value)) {
      return maskSecretDisplay(value);
    }
    return value;
  };

  const handlePasswordToggle = async () => {
    if (showPassword) {
      setShowPassword(false);
      return;
    }

    if (isRedactedPasswordValue(value) && onReveal) {
      setIsRevealing(true);
      try {
        await onReveal();
        setShowPassword(true);
      } catch {
        // Caller owns user-facing error messages.
      } finally {
        setIsRevealing(false);
      }
      return;
    }

    setShowPassword(true);
  };

  return (
    <label className="block">
      {label && (
        <div
          className={`mb-2 break-words ${SETTINGS_LABEL_CLASSNAME}`.trim()}
        >
          {label}
        </div>
      )}
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          value={getDisplayValue()}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (onBlur) onBlur();
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={resolvedAutoComplete}
          data-settings-control-action={controlAction}
          className={`${SETTINGS_INPUT_CLASSNAME} ${isPassword ? 'pl-4 pr-10' : 'px-4'}`.trim()}
          style={{ boxShadow: 'var(--settings-input-shadow)' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => void handlePasswordToggle()}
            disabled={disabled || revealLoading || isRevealing}
            data-settings-control-action={controlAction ? `${controlAction}.reveal` : undefined}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none outline-none disabled:cursor-not-allowed disabled:opacity-50"
            title={showPassword ? '隐藏密钥' : (isRevealing || revealLoading ? '正在查看密钥' : '查看密钥')}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {helper && (
        <div className="mt-2 break-words text-xs leading-5 text-[var(--text-secondary)]">
          {helper}
        </div>
      )}
    </label>
  );
};

export const SettingSwitchControl: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  controlAction?: string;
}> = ({ checked, onChange, label, disabled = false, controlAction }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => {
      if (!disabled) {
        onChange(!checked);
      }
    }}
    disabled={disabled}
    data-settings-control-action={controlAction}
    className={`settings-system-switch settings-control-toggle settings-toggle-button disabled:cursor-not-allowed disabled:opacity-60 ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
    data-state={checked ? 'on' : 'off'}
  />
);

// SettingToggle 开关组件
export const SettingToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
  disabled?: boolean;
  controlAction?: string;
}> = ({ label, checked, onChange, helper, disabled = false, controlAction }) => {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div
          className="break-words font-medium text-[var(--text-primary)]"
          style={{ fontSize: 'var(--type-body-2)' }}
        >
          {label}
        </div>
        {helper && (
          <div
            className="mt-1 break-words text-[var(--text-secondary)]"
            style={{ fontSize: 'var(--type-caption)', lineHeight: 'var(--ui-line-height-body)' }}
          >
            {helper}
          </div>
        )}
      </div>
      <SettingSwitchControl
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
        controlAction={controlAction}
      />
    </div>
  );
};

// SettingSelect 选择框组件 (简体中文注释：重构为自定义 iOS 风格 Dropdown，支持毛玻璃、淡入微动效和点击外部自动收起，以消除原生 Select 的白色突兀外观)
export const SettingSelect: React.FC<{
  label?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  helper?: string;
  disabled?: boolean;
  controlAction?: string;
}> = ({ label, value, options, onChange, helper, disabled = false, controlAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative block text-left" ref={containerRef}>
      {label && (
        <div className={`mb-2 break-words ${SETTINGS_LABEL_CLASSNAME}`.trim()}>
          {label}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(!isOpen)}
        data-settings-control-action={controlAction}
        className={`${SETTINGS_INPUT_CLASSNAME} ${SETTINGS_CONTROL_MENU_TRIGGER_CLASSNAME} flex items-center justify-between px-4 cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-60 min-w-0`.trim()}
        style={{ boxShadow: 'var(--settings-input-shadow)' }}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-2 h-4 w-4 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          style={{
            transition: 'transform var(--kk-morphic-motion-control) var(--kk-morphic-ease-standard)',
          }}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute mt-2 w-full overflow-hidden animate-fadeIn ${SETTINGS_CONTROL_MENU_CLASSNAME}`}
          style={{ zIndex: KK_LAYER.dropdown }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              data-state={option.value === value ? 'selected' : 'idle'}
              data-settings-control-action={controlAction}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm border-none bg-transparent ${SETTINGS_CONTROL_MENU_OPTION_CLASSNAME}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {helper && (
        <div className="mt-2 break-words text-xs leading-5 text-[var(--text-secondary)]">
          {helper}
        </div>
      )}
    </div>
  );
};

// PrimaryButton 主要按钮
// PrimaryButton 主要按钮
export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  controlAction?: string;
}> = ({ children, onClick, loading, disabled = false, className = '', controlAction }) => {
  // 简体中文注释：检测全局同步的云端只读快照/本地 API 未连通标志位
  const isReadonlyGhost = typeof window !== 'undefined' && (window as any).__KK_SETTINGS_READONLY__ === true;
  
  // 如果是只读降级状态，底层不设置 disabled 原生属性，以维持 click 事件的分发和拦截
  const shouldApplyNativeDisabled = disabled && !isReadonlyGhost;
  const isGhostDisabled = disabled && isReadonlyGhost;

  const handleInterceptClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isGhostDisabled) {
      if (onClick) onClick();
      return;
    }
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) onClick();
  };

  const motionClass = disabled ? '' : SETTINGS_CONTROL_MOTION_CLASSNAME;

  return (
    <button
      type="button"
      onClick={handleInterceptClick}
      disabled={loading || shouldApplyNativeDisabled}
      data-settings-control-action={controlAction}
      data-settings-button-tone="primary"
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap border px-4 py-2.5 font-semibold text-[var(--text-inverse)] ${isGhostDisabled ? 'opacity-50 cursor-not-allowed pointer-events-auto' : 'disabled:cursor-not-allowed disabled:opacity-50'} ${motionClass} ${className}`}
      style={{
        borderColor: 'transparent',
        background: 'var(--settings-button-primary-bg)',
        boxShadow: 'var(--settings-button-primary-shadow)',
        borderRadius: 'var(--radius-control-md)',
        fontSize: 'var(--type-body-2)',
        minHeight: 'var(--ui-control-height-default)',
      }}
    >
      <span className="inline-flex min-w-0 max-w-full shrink items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
        {loading ? '加载中...' : children}
      </span>
    </button>
  );
};

// SecondaryButton 次要按钮
export const SecondaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  controlAction?: string;
}> = ({ children, onClick, disabled = false, className = '', controlAction }) => {
  // 简体中文注释：检测全局同步的云端只读快照/本地 API 未连通标志位
  const isReadonlyGhost = typeof window !== 'undefined' && (window as any).__KK_SETTINGS_READONLY__ === true;
  const shouldApplyNativeDisabled = disabled && !isReadonlyGhost;
  const isGhostDisabled = disabled && isReadonlyGhost;

  const handleInterceptClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isGhostDisabled) {
      if (onClick) onClick();
      return;
    }
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) onClick();
  };

  const motionClass = disabled ? '' : SETTINGS_CONTROL_MOTION_CLASSNAME;

  return (
    <button
      type="button"
      onClick={handleInterceptClick}
      disabled={shouldApplyNativeDisabled}
      data-settings-control-action={controlAction}
      data-settings-button-tone="secondary"
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap border px-4 py-2.5 font-medium text-[var(--text-primary)] ${isGhostDisabled ? 'opacity-50 cursor-not-allowed pointer-events-auto' : 'disabled:cursor-not-allowed disabled:opacity-50'} ${motionClass} ${className}`}
      style={{
        borderColor: 'var(--settings-button-secondary-border)',
        background: 'var(--settings-button-secondary-bg)',
        borderRadius: 'var(--radius-control-md)',
        fontSize: 'var(--type-body-2)',
        minHeight: 'var(--ui-control-height-default)',
      }}
    >
      <span className="inline-flex min-w-0 max-w-full shrink items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
};

// DangerButton 危险按钮
export const DangerButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  controlAction?: string;
}> = ({ children, onClick, disabled = false, className = '', controlAction }) => {
  // 简体中文注释：检测全局同步的云端只读快照/本地 API 未连通标志位
  const isReadonlyGhost = typeof window !== 'undefined' && (window as any).__KK_SETTINGS_READONLY__ === true;
  const shouldApplyNativeDisabled = disabled && !isReadonlyGhost;
  const isGhostDisabled = disabled && isReadonlyGhost;

  const handleInterceptClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isGhostDisabled) {
      if (onClick) onClick();
      return;
    }
    if (disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) onClick();
  };

  const motionClass = disabled ? '' : SETTINGS_CONTROL_MOTION_CLASSNAME;

  return (
    <button
      type="button"
      onClick={handleInterceptClick}
      disabled={shouldApplyNativeDisabled}
      data-settings-control-action={controlAction}
      data-settings-button-tone="danger"
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap border px-4 py-2.5 font-medium text-[var(--error)] ${isGhostDisabled ? 'opacity-50 cursor-not-allowed pointer-events-auto' : 'disabled:cursor-not-allowed disabled:opacity-50'} ${motionClass} ${className}`}
      style={{
        borderColor: 'var(--settings-button-danger-border)',
        background: 'var(--settings-button-danger-bg)',
        borderRadius: 'var(--radius-control-md)',
        fontSize: 'var(--type-body-2)',
        minHeight: 'var(--ui-control-height-default)',
      }}
    >
      <span className="inline-flex min-w-0 max-w-full shrink items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
};

// MetricCard 指标卡片
export const MetricCard: React.FC<{
  value: string;
  label: string;
  helper?: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'neutral';
}> = ({ value, label, helper, tone = 'indigo' }) => {
  const toneColors = {
    indigo: { text: 'var(--settings-state-info-text)' },
    emerald: { text: 'var(--settings-state-success-text)' },
    amber: { text: 'var(--settings-state-warning-text)' },
    rose: { text: 'var(--settings-state-danger-text)' },
    neutral: { text: 'var(--text-secondary)' },
  };

  const color = toneColors[tone];

  return (
    <div className="settings-reference-mini-metric">
      <div className="settings-reference-mini-metric__label">{label}</div>
      <div className="settings-reference-mini-metric__value" style={{ color: color.text }}>
        {value}
      </div>
      {helper && (
        <div className="settings-reference-mini-metric__helper">
          {helper}
        </div>
      )}
    </div>
  );
};

// IconButton 图标按钮
export const IconButton: React.FC<{
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
  variant?: 'default' | 'active' | 'danger';
}> = ({ icon, onClick, title, variant = 'default' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    data-variant={variant}
    className={`settings-icon-button ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
  >
    {icon}
  </button>
);

// ProgressBar 进度条组件
export const ProgressBar: React.FC<{
  progress: number;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose';
  showLabel?: boolean;
}> = ({ progress, tone = 'indigo', showLabel = true }) => (
  <div className="settings-progress" data-tone={tone}>
    <div className="settings-progress__track">
      <div
        className="settings-progress__bar"
        data-tone={tone}
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
    {showLabel && (
      <div className="settings-progress__label">
        {Math.round(progress)}%
      </div>
    )}
  </div>
);

// StatusBadge 状态徽章
export const StatusBadge: React.FC<{
  status: 'online' | 'offline' | 'warning' | 'error' | 'paused' | 'unverified';
  label?: string;
}> = ({ status, label }) => {
  const statusConfig = {
    online: { label: '在线' },
    offline: { label: '离线' },
    warning: { label: '警告' },
    error: { label: '异常' },
    paused: { label: '已暂停' },
    unverified: { label: '已保存' },
  };

  const config = statusConfig[status];

  return (
    <div
      className="settings-status-badge"
      data-status={status}
    >
      <span className="settings-status-badge__dot" />
      <span className="settings-status-badge__label">
        {label || config.label}
      </span>
    </div>
  );
};

// EmptyState 空状态
export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => {
  return (
    <div 
      className="settings-reference-card settings-reference-card--soft p-8 text-center"
      style={{
        borderStyle: 'dashed',
      }}
    >
      <div
        className="break-words font-medium text-[var(--text-primary)]"
        style={{ fontSize: 'var(--type-body-2)' }}
      >
        {title}
      </div>
      {description && (
        <div
          className="mt-1 break-words text-[var(--text-secondary)]"
          style={{ fontSize: 'var(--type-caption)' }}
        >
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
