import React, { Component, type ReactNode } from 'react';
import { KK_LAYER } from '@kk/ui';

const lazyBoundaryPanelStyle: React.CSSProperties = {
  background: 'var(--kk-lazy-boundary-panel-bg, var(--frost-card-framework-bg))',
  borderColor: 'var(--frost-card-main-border)',
  boxShadow: 'var(--frost-card-main-shadow)',
  backdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
  WebkitBackdropFilter: 'blur(var(--frost-card-framework-blur)) saturate(1.16)',
};

type LazyModuleBoundaryProps = {
  children: ReactNode;
  moduleName: string;
  onClose?: () => void;
  onRetry?: () => void;
  resetKey?: string | number;
  variant?: 'inline' | 'overlay';
};

type LazyModuleBoundaryState = {
  error: Error | null;
};

class LazyModuleBoundary extends Component<LazyModuleBoundaryProps, LazyModuleBoundaryState> {
  state: LazyModuleBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): LazyModuleBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[LazyModuleBoundary] Failed to load ${this.props.moduleName}:`, error, errorInfo);
  }

  componentDidUpdate(prevProps: LazyModuleBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null }, () => {
      this.props.onRetry?.();
    });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const isOverlay = this.props.variant !== 'inline';
    const wrapperClassName = isOverlay
      ? 'kk-lazy-boundary-overlay absolute inset-0 flex items-center justify-center p-4'
      : 'flex min-h-[280px] items-center justify-center';
    const panelClassName = isOverlay
      ? 'kk-lazy-boundary-panel w-full max-w-xl rounded-3xl border p-6'
      : 'kk-lazy-boundary-panel w-full rounded-3xl border p-5';

    return (
      <div className={wrapperClassName} style={isOverlay ? { zIndex: KK_LAYER.toolbar } : undefined}>
        <div
          className={panelClassName}
          data-variant={isOverlay ? 'overlay' : 'inline'}
          style={lazyBoundaryPanelStyle}
        >
          <div className="text-sm font-medium text-[var(--text-secondary)]">模块加载失败</div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {this.props.moduleName} 暂时打不开
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            这通常发生在本地开发服务器重启、端口断开，或热更新过程中模块文件暂时不可用时。主界面数据不会丢失。
          </p>
          <pre className="kk-lazy-boundary-pre mt-4 max-h-40 overflow-auto rounded-2xl border p-3 text-xs leading-6 text-[var(--text-secondary)]">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              重新尝试
            </button>
            {this.props.onClose && (
              <button
                type="button"
                onClick={this.props.onClose}
                className="rounded-xl border border-[var(--frost-card-sub-border)] bg-[var(--frost-card-sub-bg)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--toolbar-hover)]"
              >
                关闭这个面板
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-[var(--frost-card-sub-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--toolbar-hover)]"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default LazyModuleBoundary;
