/**
 * @file ApiConnectivityWidget.ts
 * @description 生产级高性能、防重排、零依赖的原生 API 连通性测试微组件。
 *              采用 CSS3 硬件加速与磨砂玻璃（Glassmorphism）极简质感，提供无阻塞的异步视觉反馈。
 * @author KK-Studio Team
 * @version 1.5.8
 */

// 动态注入微组件所需的极致轻量级现代 CSS 样式
if (typeof document !== 'undefined') {
  const STYLE_ID = 'kk-api-connectivity-widget-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .kk-conn-container {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.85);
        transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        will-change: transform, opacity;
      }
      .kk-conn-indicator {
        position: relative;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transition: background 0.3s ease;
      }
      /* 硬件加速的呼吸光圈，避免改变 layout 导致重排 */
      .kk-conn-indicator::after {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border-radius: 50%;
        border: 2px solid currentColor;
        opacity: 0;
        transform: scale(0.8);
        will-change: transform, opacity;
      }
      
      /* 状态机 CSS 定义 */
      .kk-conn-container.state-testing {
        background: rgba(59, 130, 246, 0.08);
        border-color: rgba(59, 130, 246, 0.25);
        color: #60A5FA;
      }
      .kk-conn-container.state-testing .kk-conn-indicator {
        background: #3B82F6;
        color: #3B82F6;
      }
      .kk-conn-container.state-testing .kk-conn-indicator::after {
        animation: kk-pulse-ripple 1.6s cubic-bezier(0.24, 0, 0.38, 1) infinite;
      }

      .kk-conn-container.state-success {
        background: rgba(16, 185, 129, 0.08);
        border-color: rgba(16, 185, 129, 0.25);
        color: #34D399;
      }
      .kk-conn-container.state-success .kk-conn-indicator {
        background: #10B981;
      }

      .kk-conn-container.state-error {
        background: rgba(239, 68, 68, 0.08);
        border-color: rgba(239, 68, 68, 0.25);
        color: #F87171;
      }
      .kk-conn-container.state-error .kk-conn-indicator {
        background: #EF4444;
      }

      .kk-conn-label {
        font-weight: 500;
        letter-spacing: 0.2px;
      }
      
      /* GPU 加速的动画波纹定义 */
      @keyframes kk-pulse-ripple {
        0% {
          transform: scale(0.6);
          opacity: 0.8;
        }
        80% {
          transform: scale(1.6);
          opacity: 0;
        }
        100% {
          transform: scale(1.6);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export type ConnectivityState = 'idle' | 'testing' | 'success' | 'error';

export class ApiConnectivityWidget {
  private container: HTMLDivElement;
  private indicator: HTMLSpanElement;
  private label: HTMLSpanElement;
  private currentState: ConnectivityState = 'idle';

  constructor(mountElement: HTMLElement, initialLabel = '检测连通性') {
    // 创建轻量化 DOM 结构
    this.container = document.createElement('div');
    this.container.className = 'kk-conn-container';

    this.indicator = document.createElement('span');
    this.indicator.className = 'kk-conn-indicator';

    this.label = document.createElement('span');
    this.label.className = 'kk-conn-label';
    this.label.textContent = initialLabel;

    this.container.appendChild(this.indicator);
    this.container.appendChild(this.label);
    mountElement.appendChild(this.container);
  }

  /**
   * 原生切换状态机，仅修改特定 class 与 textContent，完全避免全局重新渲染与重排（Reflow）
   */
  public updateState(state: ConnectivityState, message?: string) {
    if (this.currentState === state && !message) return;

    // 清除已有的状态类，最小化重绘开销
    this.container.classList.remove('state-testing', 'state-success', 'state-error');

    switch (state) {
      case 'testing':
        this.container.classList.add('state-testing');
        this.label.textContent = message || '正在测试连通性...';
        break;
      case 'success':
        this.container.classList.add('state-success');
        this.label.textContent = message || '连接成功';
        break;
      case 'error':
        this.container.classList.add('state-error');
        this.label.textContent = message || '测试失败';
        break;
      default:
        this.label.textContent = message || '检测连通性';
        break;
    }

    this.currentState = state;
  }

  /**
   * 触发连通性测试并展示极其丝滑的原生动画交互
   * @param testFn 调用 API 的测试异步 Promise 函数
   */
  public async performTest(testFn: () => Promise<any>): Promise<boolean> {
    this.updateState('testing');
    
    // 利用 requestAnimationFrame 确保动画平稳启动
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        this.container.style.transform = 'scale(0.98)';
        setTimeout(() => {
          this.container.style.transform = 'none';
        }, 150);
      });
    }

    try {
      const result = await testFn();
      if (result && result.success !== false) {
        this.updateState('success');
        return true;
      } else {
        const errorMsg = result && result.error && result.error.message ? result.error.message : '连接错误';
        this.updateState('error', errorMsg);
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || '网络连接异常';
      this.updateState('error', errorMsg);
      return false;
    }
  }

  /**
   * 从 DOM 树中安全移除微型组件
   */
  public destroy() {
    this.container.remove();
  }
}
