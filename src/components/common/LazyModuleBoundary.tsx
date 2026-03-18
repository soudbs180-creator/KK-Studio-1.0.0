import React, { Component, type ReactNode } from 'react';

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
      ? 'absolute inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm'
      : 'flex min-h-[280px] items-center justify-center';
    const panelClassName = isOverlay
      ? 'w-full max-w-xl rounded-3xl border border-white/10 bg-[#111217] p-6 shadow-2xl'
      : 'w-full rounded-3xl border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] p-5';

    return (
      <div className={wrapperClassName}>
        <div className={panelClassName}>
          <div className="text-sm font-medium text-[var(--text-secondary)]">模块加载失败</div>
          <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {this.props.moduleName} 暂时打不开
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            这通常发生在本地开发服务器重启、端口断开，或热更新过程中模块文件暂时不可用时。主界面数据不会丢失。
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-6 text-zinc-300">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-xl border border-indigo-400/30 bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              重新尝试
            </button>
            {this.props.onClose && (
              <button
                type="button"
                onClick={this.props.onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                关闭这个面板
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
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
