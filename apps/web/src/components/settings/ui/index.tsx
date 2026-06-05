/**
 * Settings UI Components - iOS Style Design System
 * 设置页面UI组件库 - iOS风格设计系统
 */
import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
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
}> = ({ options, value, onChange, disabled = false }) => {
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
  if (str === 'sk-readonly-0000' || str === '尚未填写') return '尚未填写';
  if (str.startsWith('__kk_redacted__:') || str.startsWith('__kk_r')) {
    // 简体中文注释：对脱敏后的占位密钥，在睁眼时显示易读的 wuyin_•••• 后缀格式
    return `wuyin_••••${str.slice(-4)}`;
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
  maskedPreview?: string;
}> = ({ label, value, onChange, onBlur, placeholder, type = 'text', helper, disabled = false, autoComplete, maskedPreview }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  const resolvedAutoComplete = autoComplete || (
    isPassword || /key|secret|password|token|name|id|名字|密钥|密匙|用户名|邮箱/i.test(label || '')
      ? 'new-password'
      : undefined
  );

  const getDisplayValue = () => {
    if (!isPassword) return value;
    if (!showPassword) return value;
    
    const strVal = String(value || '').trim();
    const isRedacted =
      strVal === 'sk-readonly-0000' ||
      strVal === '尚未填写' ||
      strVal === '已填写' ||
      strVal.includes('...') ||
      strVal.includes('••') ||
      strVal.startsWith('__kk_redacted__:') ||
      strVal.includes('wuyin_••••');

    if (isRedacted && maskedPreview) {
      return maskedPreview;
    }
    if (isRedacted) {
      return maskSecretDisplay(value);
    }
    return value;
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
          className={`${SETTINGS_INPUT_CLASSNAME} ${isPassword ? 'pl-4 pr-10' : 'px-4'}`.trim()}
          style={{ boxShadow: 'var(--settings-input-shadow)' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none outline-none disabled:cursor-not-allowed disabled:opacity-50"
            title={showPassword ? '隐藏密钥' : '查看密钥'}
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

// SettingToggle 开关组件
export const SettingToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
  disabled?: boolean;
}> = ({ label, checked, onChange, helper, disabled = false }) => {
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
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            onChange(!checked);
          }
        }}
        disabled={disabled}
        className={`settings-control-toggle settings-toggle-button relative h-7 w-12 shrink-0 overflow-hidden rounded-[var(--radius-control-md)] border disabled:cursor-not-allowed disabled:opacity-60 transition-[background-color] duration-200 cursor-pointer ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
        style={{
          background: checked ? 'rgb(var(--settings-accent-rgb))' : 'rgba(120, 120, 128, 0.32)',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
        }}
      >
        <span
          className="settings-toggle-button__thumb absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(0px)',
            backgroundColor: '#ffffff',
          }}
        />
      </button>
    </div>
  );
};

// SettingSelect 选择框组件 (简体中文注释：重构为自定义 iOS 风格 Dropdown，支持毛玻璃、淡入微动效和点击外部自动收起，以消除原生 Select 的白色突兀外观)
export const SettingSelect: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  helper?: string;
  disabled?: boolean;
}> = ({ label, value, options, onChange, helper, disabled = false }) => {
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
        onClick={() => setIsOpen(!isOpen)}
        className={`${SETTINGS_INPUT_CLASSNAME} flex items-center justify-between px-4 cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-60 min-w-0`.trim()}
        style={{ boxShadow: 'var(--settings-input-shadow)' }}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <svg
          className={`w-4 h-4 ml-2 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute z-[100] mt-1 w-full rounded-[var(--radius-control-md)] border overflow-hidden shadow-lg backdrop-blur-md animate-fadeIn"
          style={{
            borderColor: 'var(--settings-border-subtle)',
            background: 'var(--settings-surface-elevated)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--bg-hover)] transition-colors duration-150 border-none bg-transparent"
              style={{
                color: option.value === value ? 'var(--accent-blue)' : 'var(--text-primary)',
                fontWeight: option.value === value ? 600 : 400,
              }}
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
}> = ({ children, onClick, loading, disabled = false, className = '' }) => {
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
}> = ({ children, onClick, disabled = false, className = '' }) => {
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
}> = ({ children, onClick, disabled = false, className = '' }) => {
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
}> = ({ icon, onClick, title, variant = 'default' }) => {
  const variantStyles = {
    default: {},
    active: {
      backgroundColor: 'color-mix(in srgb, var(--bg-hover) 92%, transparent)',
      color: 'var(--text-primary)',
    },
    danger: {
      backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)',
      color: 'var(--error)',
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-10 w-10 items-center justify-center border text-[var(--text-secondary)] hover:text-[var(--text-primary)] ${SETTINGS_CONTROL_MOTION_CLASSNAME}`}
      style={{
        background: 'var(--settings-surface-overlay)',
        borderColor: 'var(--settings-border-subtle)',
        borderRadius: 'var(--radius-control-md)',
        minHeight: 'var(--ui-control-height-compact)',
        ...variantStyles[variant],
      }}
    >
      {icon}
    </button>
  );
};

// ProgressBar 进度条组件
export const ProgressBar: React.FC<{
  progress: number;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose';
  showLabel?: boolean;
}> = ({ progress, tone = 'indigo', showLabel = true }) => {
  const toneColors = {
    indigo: 'var(--settings-state-info-text)',
    emerald: 'var(--settings-state-success-text)',
    amber: 'var(--settings-state-warning-text)',
    rose: 'var(--settings-state-danger-text)',
  };

  return (
    <div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'rgb(255 255 255 / 0.08)' }}
      >
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(0, Math.min(100, progress))}%`,
            background: toneColors[tone],
            boxShadow: 'none',
          }}
        />
      </div>
      {showLabel && (
        <div
          className="mt-1 text-right text-[var(--text-tertiary)]"
          style={{ fontSize: 'var(--type-caption)' }}
        >
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

// StatusBadge 状态徽章
export const StatusBadge: React.FC<{
  status: 'online' | 'offline' | 'warning' | 'error' | 'paused' | 'unverified';
  label?: string;
}> = ({ status, label }) => {
  const statusConfig = {
    online: { color: '#10b981', label: '在线' },
    offline: { color: '#64748b', label: '离线' },
    warning: { color: '#f59e0b', label: '警告' },
    error: { color: '#ef4444', label: '异常' },
    paused: { color: '#64748b', label: '已暂停' },
    unverified: { color: '#3b82f6', label: '已保存' },
  };

  const config = statusConfig[status];

  return (
    <div
      className="inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 uppercase tracking-[0.12em]"
      style={{
        borderColor: `${config.color}33`,
        backgroundColor: `${config.color}14`,
        color: config.color,
        fontSize: 'var(--type-micro)',
      }}
    >
      <span 
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      <span className="min-w-0 truncate">
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
