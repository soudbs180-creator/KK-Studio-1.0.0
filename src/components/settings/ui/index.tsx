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
    <section 
      className={`mb-3 rounded-2xl border border-[var(--border-light)] p-3 backdrop-blur-lg ${className}`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)' }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="text-[13px] font-medium tracking-[0.01em] text-[var(--text-primary)]">
          {title}
        </div>
        {action && <div>{action}</div>}
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
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 active:scale-95"
            style={{
              backgroundColor: isActive ? 'color-mix(in srgb, var(--bg-hover) 92%, transparent)' : 'transparent',
              borderColor: isActive ? 'var(--border-default)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
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
}> = ({ options, value, onChange }) => {
  const activeIndex = options.indexOf(value);
  const slideWidth = `${100 / options.length}%`;
  const slideLeft = `${activeIndex * (100 / options.length)}%`;

  return (
    <div 
      className="relative flex rounded-xl p-0.5"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)' }}
    >
      {/* 滑动背景 */}
      <div
        className="absolute bottom-0.5 top-0.5 rounded-[10px] transition-all duration-200 ease-out"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-hover) 92%, transparent)',
          left: slideLeft,
          width: slideWidth,
        }}
      />
      
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className="relative z-10 flex-1 rounded-[10px] px-2 py-2 text-sm transition-colors duration-200 active:scale-95"
          style={{
            color: value === option ? 'var(--text-primary)' : 'var(--text-tertiary)',
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
      className="flex gap-1.5 overflow-hidden rounded-xl p-1.5"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 50%, transparent)' }}
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
              className="flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 active:scale-95"
              style={{
                height: '52px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                backgroundColor: isActive ? 'color-mix(in srgb, var(--bg-hover) 92%, transparent)' : 'transparent',
              }}
            >
              <div className="flex h-5 w-5 items-center justify-center">
                {option.icon}
              </div>
              <span className="whitespace-nowrap text-[10px] leading-none">{option.label}</span>
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
}> = ({ label, value, onChange, placeholder, type = 'text', helper }) => {
  return (
    <label className="block">
      <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--border-default)]"
      />
      {helper && (
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
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
}> = ({ label, checked, onChange, helper }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </div>
        {helper && (
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {helper}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 rounded-full transition-colors duration-200"
        style={{
          backgroundColor: checked 
            ? 'var(--accent-primary)' 
            : 'color-mix(in srgb, var(--bg-tertiary) 80%, transparent)',
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
}> = ({ label, value, options, onChange, helper }) => {
  return (
    <label className="block">
      <div className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors focus:border-[var(--border-default)]"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {option.label}
          </option>
        ))}
      </select>
      {helper && (
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
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
  className?: string;
}> = ({ children, onClick, loading, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-medium text-[var(--text-inverse)] transition-all duration-200 active:scale-95 disabled:opacity-50 ${className}`}
    >
      {loading ? '加载中...' : children}
    </button>
  );
};

// SecondaryButton 次要按钮
export const SecondaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 active:scale-95 ${className}`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 18%, transparent)' }}
    >
      {children}
    </button>
  );
};

// DangerButton 危险按钮
export const DangerButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--error)] transition-all duration-200 active:scale-95 ${className}`}
      style={{ backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)' }}
    >
      {children}
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
    <div 
      className="rounded-2xl border border-[var(--border-light)] p-4 backdrop-blur-lg"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)' }}
    >
      <div 
        className="text-[28px] font-light tracking-tight"
        style={{ color: color.text }}
      >
        {value}
      </div>
      <div className="mt-1 text-[15px] font-medium text-[var(--text-primary)]">
        {label}
      </div>
      {helper && (
        <div className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
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
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-light)] text-[var(--text-secondary)] transition-all duration-200 hover:border-[var(--border-default)] hover:text-[var(--text-primary)] active:scale-95"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 14%, transparent)',
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
    indigo: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        <div 
          className={`h-full rounded-full ${toneColors[tone]} transition-all duration-500`}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
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
    <div className="flex items-center gap-1.5">
      <span 
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      <span className="text-xs text-[var(--text-secondary)]">
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
      className="rounded-2xl border border-dashed border-[var(--border-light)] p-8 text-center"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 30%, transparent)' }}
    >
      <div className="text-sm font-medium text-[var(--text-primary)]">
        {title}
      </div>
      {description && (
        <div className="mt-1 text-xs text-[var(--text-secondary)]">
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
