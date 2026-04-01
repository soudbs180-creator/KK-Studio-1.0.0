/**
 * Settings UI Components - iOS Style Design System
 * 设置页面UI组件库 - iOS风格设计系统
 */
import React from 'react';

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
      className="grid grid-cols-2 gap-2 rounded-[22px] border p-2"
      style={{
        background: 'var(--settings-segment-shell-bg)',
        borderColor: 'var(--settings-segment-shell-border)',
        boxShadow: 'var(--settings-segment-shell-shadow)',
      }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="min-w-0 overflow-hidden rounded-2xl border px-3 py-3 text-ellipsis whitespace-nowrap text-sm font-medium transition-all duration-200 active:scale-95"
            style={{
              background: isActive
                ? 'var(--settings-segment-active-bg)'
                : 'var(--settings-segment-bg)',
              borderColor: isActive
                ? 'var(--settings-segment-active-border)'
                : 'var(--settings-segment-border)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: isActive ? 'var(--settings-segment-active-shadow)' : 'none',
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
      className="relative flex overflow-hidden rounded-[20px] p-1"
      style={{
        background: 'var(--settings-segment-shell-bg)',
        border: '1px solid var(--settings-segment-shell-border)',
        boxShadow: 'var(--settings-segment-shell-shadow)',
      }}
    >
      {/* 滑动背景 */}
      <div
        className="absolute bottom-1 top-1 rounded-[16px] transition-all duration-200 ease-out"
        style={{
          background: 'var(--settings-segment-active-bg)',
          left: slideLeft,
          width: slideWidth,
          boxShadow: 'var(--settings-segment-active-shadow)',
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
          className="relative z-10 min-w-0 flex-1 overflow-hidden rounded-[16px] px-2 py-2.5 text-ellipsis whitespace-nowrap text-sm font-medium transition-colors duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            color: value === option ? 'var(--text-primary)' : 'var(--text-secondary)',
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
      className="flex gap-1.5 overflow-hidden rounded-[22px] p-2"
      style={{
        background: 'var(--settings-segment-shell-bg)',
        border: '1px solid var(--settings-segment-shell-border)',
        boxShadow: 'var(--settings-segment-shell-shadow)',
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
              className="flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[18px] transition-all duration-200 active:scale-95"
              style={{
                height: '52px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive
                  ? 'var(--settings-segment-active-bg)'
                  : 'transparent',
                boxShadow: isActive ? 'var(--settings-segment-active-shadow)' : 'none',
              }}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {option.icon}
              </div>
              <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-none">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// SettingInput 输入框组件
export const SettingInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
  helper?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', helper, disabled = false }) => {
  return (
    <label className="block">
      <div className="mb-2 break-words text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-[20px] border px-4 py-3 text-sm text-[var(--text-primary)] transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: 'var(--settings-input-border)',
          background: 'var(--settings-input-bg)',
          boxShadow: 'var(--settings-input-shadow)',
        }}
      />
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
        <div className="break-words text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </div>
        {helper && (
          <div className="mt-1 break-words text-xs leading-5 text-[var(--text-secondary)]">
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
        className="relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: checked
            ? 'linear-gradient(90deg, rgb(var(--settings-accent-rgb)) 0%, rgb(var(--settings-accent-soft-rgb)) 100%)'
            : 'var(--settings-surface-overlay)',
          borderColor: checked ? 'rgb(var(--settings-accent-rgb) / 0.35)' : 'var(--settings-border-subtle)',
        }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-[var(--text-inverse)] shadow-sm transition-transform duration-200"
          style={{
            transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
};

// SettingSelect 选择框组件
export const SettingSelect: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  helper?: string;
  disabled?: boolean;
}> = ({ label, value, options, onChange, helper, disabled = false }) => {
  return (
    <label className="block">
      <div className="mb-2 break-words text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-[20px] border px-4 py-3 text-sm text-[var(--text-primary)] transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: 'var(--settings-input-border)',
          background: 'var(--settings-input-bg)',
          boxShadow: 'var(--settings-input-shadow)',
        }}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            style={{
              backgroundColor: 'var(--settings-option-bg)',
              color: 'var(--settings-option-text)',
            }}
          >
            {option.label}
          </option>
        ))}
      </select>
      {helper && (
        <div className="mt-2 break-words text-xs leading-5 text-[var(--text-secondary)]">
          {helper}
        </div>
      )}
    </label>
  );
};

// PrimaryButton 主要按钮
export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ children, onClick, loading, disabled = false, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap rounded-[18px] border px-4 py-3 text-sm font-semibold text-[var(--text-inverse)] transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        borderColor: 'transparent',
        background: 'var(--settings-button-primary-bg)',
        boxShadow: 'var(--settings-button-primary-shadow)',
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap rounded-[18px] border px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        borderColor: 'var(--settings-button-secondary-border)',
        background: 'var(--settings-button-secondary-bg)',
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex max-w-full min-w-0 flex-nowrap items-center justify-center overflow-hidden whitespace-nowrap rounded-[18px] border px-4 py-3 text-sm font-medium text-[var(--error)] transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        borderColor: 'var(--settings-button-danger-border)',
        background: 'var(--settings-button-danger-bg)',
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
    indigo: { text: '#60a5fa' },
    emerald: { text: '#34d399' },
    amber: { text: '#fbbf24' },
    rose: { text: '#f87171' },
    neutral: { text: '#94a3b8' },
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
      className="flex h-10 w-10 items-center justify-center rounded-2xl border text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--text-primary)] active:scale-95"
      style={{
        background: 'var(--settings-surface-overlay)',
        borderColor: 'var(--settings-border-subtle)',
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
    indigo: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)',
    emerald: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
    amber: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)',
    rose: 'linear-gradient(90deg, #fb7185 0%, #ef4444 100%)',
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
            boxShadow: '0 0 20px rgb(96 165 250 / 0.18)',
          }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right text-xs text-[var(--text-tertiary)]">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

// StatusBadge 状态徽章
export const StatusBadge: React.FC<{
  status: 'online' | 'offline' | 'warning' | 'error' | 'paused';
  label?: string;
}> = ({ status, label }) => {
  const statusConfig = {
    online: { color: '#10b981', label: '在线' },
    offline: { color: '#64748b', label: '离线' },
    warning: { color: '#f59e0b', label: '警告' },
    error: { color: '#ef4444', label: '异常' },
    paused: { color: '#64748b', label: '已暂停' },
  };

  const config = statusConfig[status];

  return (
    <div
      className="inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.12em]"
      style={{
        borderColor: `${config.color}33`,
        backgroundColor: `${config.color}14`,
        color: config.color,
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
      <div className="break-words text-sm font-medium text-[var(--text-primary)]">
        {title}
      </div>
      {description && (
        <div className="mt-1 break-words text-xs text-[var(--text-secondary)]">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
