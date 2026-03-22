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
      className={`mb-3 rounded-[26px] border p-5 backdrop-blur-xl ${className}`}
      style={{
        borderColor: 'rgba(148, 163, 184, 0.12)',
        background:
          'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(9, 16, 28, 0.96) 100%)',
        boxShadow: '0 18px 40px rgba(2, 6, 23, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 break-words text-[15px] font-semibold tracking-[0.01em] text-[var(--text-primary)]">
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
    <div className="grid grid-cols-2 gap-2">
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
                ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.26) 0%, rgba(59, 130, 246, 0.12) 100%)'
                : 'rgba(15, 23, 42, 0.42)',
              borderColor: isActive ? 'rgba(96, 165, 250, 0.34)' : 'rgba(148, 163, 184, 0.08)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: isActive ? '0 10px 24px rgba(37, 99, 235, 0.18)' : 'none',
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
      className="relative flex overflow-hidden rounded-[20px] p-1"
      style={{
        background:
          'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(9, 16, 28, 0.88) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
      }}
    >
      {/* 滑动背景 */}
      <div
        className="absolute bottom-1 top-1 rounded-[16px] transition-all duration-200 ease-out"
        style={{
          background:
            'linear-gradient(135deg, rgba(96, 165, 250, 0.28) 0%, rgba(16, 185, 129, 0.14) 100%)',
          left: slideLeft,
          width: slideWidth,
          boxShadow: '0 12px 26px rgba(37, 99, 235, 0.18)',
        }}
      />
      
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className="relative z-10 min-w-0 flex-1 overflow-hidden rounded-[16px] px-2 py-2.5 text-ellipsis whitespace-nowrap text-sm font-medium transition-colors duration-200 active:scale-95"
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
        background:
          'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(9, 16, 28, 0.88) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.08)',
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
                  ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.24) 0%, rgba(59, 130, 246, 0.08) 100%)'
                  : 'transparent',
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
}> = ({ label, value, onChange, placeholder, type = 'text', helper }) => {
  return (
    <label className="block">
      <div className="mb-1.5 break-words text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border px-4 py-3 text-sm text-[var(--text-primary)] transition-all focus:outline-none"
        style={{
          borderColor: 'rgba(148, 163, 184, 0.12)',
          backgroundColor: 'rgba(8, 15, 27, 0.82)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
        }}
      />
      {helper && (
        <div className="mt-1 break-words text-xs text-[var(--text-secondary)]">
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
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="break-words text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </div>
        {helper && (
          <div className="mt-0.5 break-words text-xs text-[var(--text-secondary)]">
            {helper}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200"
        style={{
          backgroundColor: checked 
            ? '#5da0ff'
            : 'rgba(30, 41, 59, 0.92)',
          borderColor: checked ? 'rgba(96, 165, 250, 0.42)' : 'rgba(148, 163, 184, 0.12)',
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
      <div className="mb-1.5 break-words text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border px-4 py-3 text-sm text-[var(--text-primary)] transition-all focus:outline-none"
        style={{
          backgroundColor: 'rgba(8, 15, 27, 0.92)',
          borderColor: 'rgba(148, 163, 184, 0.12)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} style={{ backgroundColor: '#0f172a' }}>
            {option.label}
          </option>
        ))}
      </select>
      {helper && (
        <div className="mt-1 break-words text-xs text-[var(--text-secondary)]">
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
      className={`inline-flex max-w-full items-center justify-center overflow-hidden rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--text-inverse)] transition-all duration-200 active:scale-95 disabled:opacity-50 ${className}`}
      style={{
        background: 'linear-gradient(135deg, #67a8ff 0%, #4f8dff 55%, #3b82f6 100%)',
        boxShadow: '0 16px 28px rgba(59, 130, 246, 0.22)',
      }}
    >
      <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
        {loading ? '加载中...' : children}
      </span>
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
      className={`inline-flex max-w-full items-center justify-center overflow-hidden rounded-2xl border px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 active:scale-95 ${className}`}
      style={{
        borderColor: 'rgba(148, 163, 184, 0.12)',
        backgroundColor: 'rgba(12, 20, 34, 0.82)',
      }}
    >
      <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
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
      className={`inline-flex max-w-full items-center justify-center overflow-hidden rounded-2xl border px-4 py-3 text-sm font-medium text-[var(--error)] transition-all duration-200 active:scale-95 ${className}`}
      style={{
        borderColor: 'rgba(248, 113, 113, 0.18)',
        backgroundColor: 'rgba(127, 29, 29, 0.18)',
      }}
    >
      <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
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
      className="rounded-[24px] border p-5 backdrop-blur-xl"
      style={{
        borderColor: 'rgba(148, 163, 184, 0.12)',
        background:
          'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(9, 16, 28, 0.96) 100%)',
        boxShadow: '0 16px 32px rgba(2, 6, 23, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      <div 
        className="text-[30px] font-semibold tracking-[-0.03em]"
        style={{ color: color.text }}
      >
        {value}
      </div>
      <div className="mt-1 break-words text-[15px] font-medium text-[var(--text-primary)]">
        {label}
      </div>
      {helper && (
        <div className="mt-0.5 break-words text-[13px] text-[var(--text-secondary)]">
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
      className="flex h-9 w-9 items-center justify-center rounded-xl border text-[var(--text-secondary)] transition-all duration-200 hover:text-[var(--text-primary)] active:scale-95"
      style={{
        backgroundColor: 'rgba(12, 20, 34, 0.82)',
        borderColor: 'rgba(148, 163, 184, 0.12)',
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
    <div className="flex min-w-0 items-center gap-1.5">
      <span 
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      <span className="min-w-0 truncate text-xs text-[var(--text-secondary)]">
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
      className="rounded-[24px] border border-dashed p-8 text-center"
      style={{
        borderColor: 'rgba(148, 163, 184, 0.18)',
        backgroundColor: 'rgba(10, 18, 30, 0.72)',
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
