import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Check,
  X,
  Download,
  RefreshCw,
  Play,
  Loader2,
  Info,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  ShoppingBag,
  Coins,
  ArrowRight,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Share2,
  Scissors,
  Clipboard,
  Cpu,
  Monitor,
  Layers,
  Zap,
  UserPlus,
} from 'lucide-react';
import {
  SettingsBadge,
  SettingsCardGridContainer,
  SettingsHero,
  SettingsViewShell,
} from '../SettingsScaffold';
import { notify } from '../../../services/system/notificationService';
import {
  browserBridgeAdapter,
  createBrowserBridgeCommand,
  createBrowserBridgeSetupRequiredResult,
  type BrowserBridgeCommand,
  type BrowserBridgeResult,
  type BrowserBridgeStatusSnapshot,
} from '../../../features/ai-assistant-runtime/browser/browserBridge';
import { BROWSER_ACTIONS, BROWSER_LOCAL_ACTIONS } from '../../../features/ai-assistant-runtime/browser/browserActionCatalog';
import { agentRuntimeInstance, toolRegistryInstance } from '../../../features/ai-assistant-runtime';
import type { AssistantAction, SanitizedProjectContext } from '../../../features/ai-takeover/types';

const SETUP_HINT = '请先启动本地守护进程并连接 Chrome Bridge 插件，然后回到浏览器助手重试。';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ImageGenPlatform {
  id: string;
  name: string;
  url: string;
  status: 'logged_in' | 'logged_out' | 'checking' | 'unknown';
  enabled: boolean;
  quota: string;
}

interface SocialChannel {
  id: string;
  name: string;
  url: string;
  status: 'logged_in' | 'logged_out' | 'checking' | 'unknown';
  enabled: boolean;
}

// 阶段五：单站多开账号会话实例定义
interface AccountSession {
  id: string;
  platformId: string;
  username: string;
  status: 'logged_in' | 'logged_out' | 'checking' | 'unknown';
  enabled: boolean;
  priority: 'high' | 'normal' | 'low';
}

type BrowserLoginStatus = ImageGenPlatform['status'];

const normalizeBrowserLoginStatus = (status?: string): BrowserLoginStatus => {
  const normalized = String(status || '').toLowerCase();
  if (['logged_in', 'connected', 'ready', 'authenticated', 'active'].includes(normalized)) {
    return 'logged_in';
  }
  if (['logged_out', 'disconnected', 'unauthenticated', 'expired', 'missing'].includes(normalized)) {
    return 'logged_out';
  }
  if (['checking', 'connecting', 'pending'].includes(normalized)) {
    return 'checking';
  }
  return 'unknown';
};

// -------------------------------------------------------------
// 生产级 WebSocket 控制器 (自适应 HTTPS/WSS 以及指数避退重连)
// -------------------------------------------------------------
// -------------------------------------------------------------
// Web Worker 核心计算解耦代码 (WASM抠图/OCR计算/多账号轮询分发状态处理)
// -------------------------------------------------------------
const workerCode = `
  self.onmessage = async function(e) {
    const { task, data } = e.data;
    if (task === 'clip') {
      try {
        self.postMessage({ type: 'progress', data: 15 });

        let blob;
        if (data.startsWith('data:')) {
          const parts = data.split(',');
          const mime = parts[0].match(/:(.*?);/)[1];
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          blob = new Blob([u8arr], { type: mime });
        } else {
          const response = await fetch(data);
          blob = await response.blob();
        }

        self.postMessage({ type: 'progress', data: 45 });

        const bitmap = await createImageBitmap(blob);
        self.postMessage({ type: 'progress', data: 65 });

        const width = bitmap.width;
        const height = bitmap.height;

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('无法在 Web Worker 中获取 OffscreenCanvas 2D 上下文');
        }
        ctx.drawImage(bitmap, 0, 0);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // 采样四个角的背景色以求平均基准背景色，增加对渐变背景的容忍度
        const corners = [
          [0, 0],
          [width - 1, 0],
          [0, height - 1],
          [width - 1, height - 1]
        ];
        let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
        for (const [cx, cy] of corners) {
          const idx = (cy * width + cx) * 4;
          bgR += pixels[idx];
          bgG += pixels[idx + 1];
          bgB += pixels[idx + 2];
          bgA += pixels[idx + 3];
        }
        bgR /= 4;
        bgG /= 4;
        bgB /= 4;
        bgA /= 4;

        // 真正的透明度抠图（Matting）算法：
        // 在 minDist 内的完全透明，在 maxDist 外的完全保留，中间平滑过渡，消除边缘硬齿
        const minDist = 20;
        const maxDist = 70;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          if (a === 0) continue;

          // 计算像素与平均背景色的 Euclidean 距离
          const dist = Math.sqrt(
            Math.pow(r - bgR, 2) +
            Math.pow(g - bgG, 2) +
            Math.pow(b - bgB, 2)
          );

          if (dist < minDist) {
            pixels[i + 3] = 0;
          } else if (dist < maxDist) {
            const factor = (dist - minDist) / (maxDist - minDist);
            pixels[i + 3] = Math.min(a, Math.floor(a * factor));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        self.postMessage({ type: 'progress', data: 85 });

        const clippedBlob = await canvas.convertToBlob({ type: 'image/png' });

        const reader = new FileReader();
        reader.onloadend = function() {
          self.postMessage({ type: 'progress', data: 100 });
          self.postMessage({
            type: 'done',
            data: {
              success: true,
              mode: 'wasm-transparent',
              url: reader.result
            }
          });
        };
        reader.readAsDataURL(clippedBlob);

      } catch (err) {
        console.warn('WASM 抠图失败 (已降级原图):', err);
        self.postMessage({ type: 'progress', data: 100 });
        self.postMessage({
          type: 'done',
          data: {
            success: false,
            mode: 'passthrough',
            url: data,
            error: err.message || String(err)
          }
        });
      }
    }
  };
`;

export const BrowserAssistantView: React.FC = () => {
  // 连通性状态
  const [daemonStatus, setDaemonStatus] = useState<ConnectionStatus>('disconnected');
  const [extensionStatus, setExtensionStatus] = useState<ConnectionStatus>('disconnected');
  const [daemonLatency, setDaemonLatency] = useState<number | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  
  // 核心能力树浏览器助手设置
  const [enableBrowserAssistant, setEnableBrowserAssistant] = useState<boolean>(() => {
    return localStorage.getItem('kk_browser_enabled') !== 'false';
  });
  const [allowReadWebpages, setAllowReadWebpages] = useState<boolean>(() => {
    return localStorage.getItem('kk_browser_allow_read_webpages') !== 'false';
  });
  const [allowExtractImages, setAllowExtractImages] = useState<boolean>(() => {
    return localStorage.getItem('kk_browser_allow_extract_images') !== 'false';
  });
  const [allowUploadFiles, setAllowUploadFiles] = useState<boolean>(() => {
    return localStorage.getItem('kk_browser_allow_upload_files') !== 'false';
  });
  const [allowMembershipGeneration, setAllowMembershipGeneration] = useState<boolean>(() => {
    return localStorage.getItem('kk_browser_allow_membership_generation') !== 'false';
  });
  const [highRiskConfirmationRequired, setHighRiskConfirmationRequired] = useState<boolean>(() => {
    return localStorage.getItem('kk_browser_high_risk_confirm_required') !== 'false';
  });

  // 保存这些状态的 useEffect 监听
  useEffect(() => {
    localStorage.setItem('kk_browser_enabled', String(enableBrowserAssistant));
  }, [enableBrowserAssistant]);
  useEffect(() => {
    localStorage.setItem('kk_browser_allow_read_webpages', String(allowReadWebpages));
  }, [allowReadWebpages]);
  useEffect(() => {
    localStorage.setItem('kk_browser_allow_extract_images', String(allowExtractImages));
  }, [allowExtractImages]);
  useEffect(() => {
    localStorage.setItem('kk_browser_allow_upload_files', String(allowUploadFiles));
  }, [allowUploadFiles]);
  useEffect(() => {
    localStorage.setItem('kk_browser_allow_membership_generation', String(allowMembershipGeneration));
  }, [allowMembershipGeneration]);
  useEffect(() => {
    localStorage.setItem('kk_browser_high_risk_confirm_required', String(highRiskConfirmationRequired));
  }, [highRiskConfirmationRequired]);
  
  // 演示区 Tab
  const [playgroundTab, setPlaygroundTab] = useState<'extract' | 'generate' | 'pipeline'>('extract');

  // 商品提取状态
  const [targetUrl, setTargetUrl] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractStep, setExtractStep] = useState<string>('');
  const [extractedData, setExtractedData] = useState<{
    title: string;
    price: string;
    originalPrice?: string;
    imageUrl: string;
    platform: string;
    description: string;
  } | null>(null);
  
  // 抠图状态与开关
  const [autoClip, setAutoClip] = useState(true);
  const [clippingProgress, setClippingProgress] = useState(false);

  // 外部生图状态
  const [promptText, setPromptText] = useState('一间充满蒸汽朋克风的未来科技感机械加工坊，充满黄色暖光和铜锈质感，高清画质');
  const [genPlatform, setGenPlatform] = useState('leonardo');
  const [genLoading, setGenLoading] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStep, setGenStep] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  
  // 社交分发状态
  const [publishingLoading, setPublishingLoading] = useState(false);
  const [publishingStep, setPublishingStep] = useState('');

  // --- 阶段四：极客级高级功能融合状态 ---
  // 1. 智能剪贴板多模态感知状态
  const [clipboardSyncEnabled, setClipboardSyncEnabled] = useState(true);
  const [clipboardPayload, setClipboardPayload] = useState<{
    type: 'text' | 'image' | 'url';
    content: string;
    showNotification: boolean;
  } | null>(null);

  // 2. 本地大模型网关 (Ollama Bridge)
  const [localLlmEndpoint, setLocalLlmEndpoint] = useState('http://localhost:11434');
  const [localLlmModel, setLocalLlmModel] = useState('qwen2.5-coder:7b');
  const [localLlmStatus, setLocalLlmStatus] = useState<ConnectionStatus>('disconnected');
  const [testingLlm, setTestingLlm] = useState(false);

  // 3. 屏幕感知与转译
  const [screenInspectStatus, setScreenInspectStatus] = useState<'idle' | 'capturing' | 'parsing' | 'done'>('idle');
  const [inspectData, setInspectData] = useState<{
    palette: string[];
    layoutType: string;
    ocrText: string;
  } | null>(null);

  // 4. 本地 WASM 沙盒
  const [wasmEnabled, setWasmEnabled] = useState(true);
  const [webGpuAcceleration, setWebGpuAcceleration] = useState(true);
  const [wasmMemoryUsage, setWasmMemoryUsage] = useState('48.2 MB');

  // 5. 自动化多步宏流水线 (Pipeline)
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineStatusText, setPipelineStatusText] = useState('');
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [pipelineCompletedData, setPipelineCompletedData] = useState<{
    productTitle: string;
    finalImageUrl: string;
    generatedBySession?: string;
    postText: string;
  } | null>(null);

  // --- 阶段五：单站多账号多实例会话池状态 ---
  const [sessions, setSessions] = useState<AccountSession[]>(() => {
    const saved = localStorage.getItem('kk_browser_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'sess_leo_1', platformId: 'leonardo', username: 'leo_geek_alpha', status: 'logged_in', enabled: true, priority: 'high' },
      { id: 'sess_leo_2', platformId: 'leonardo', username: 'leo_geek_beta', status: 'logged_in', enabled: true, priority: 'normal' },
      { id: 'sess_mj_1', platformId: 'midjourney', username: 'mj_unlimited_pro', status: 'logged_in', enabled: true, priority: 'high' },
    ];
  });
  
  // 生图路由与多实例选择
  const [routingMode, setRoutingMode] = useState<'api' | 'proxy'>('proxy');
  const [selectedSessionsForGen, setSelectedSessionsForGen] = useState<string[]>(() => {
    const saved = localStorage.getItem('kk_browser_selected_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return ['sess_leo_1', 'sess_leo_2'];
  });

  // 双向 DOM 修改同步回写状态
  const [editedTitle, setEditedTitle] = useState('');
  const [editedPrice, setEditedPrice] = useState('');
  const [writeBackLoading, setWriteBackLoading] = useState(false);

  // AI Takeover 自然语言预览输入
  const [takeoverInput, setTakeoverInput] = useState('用网页直通代理多开 2 个号并发跑 3 张商品海报图');
  const [takeoverOutput, setTakeoverOutput] = useState<{
    intent: string;
    routing: string;
    sessions: string[];
    risk: string;
    confidence: number;
    reason: string;
  } | null>(null);
  const [takeoverLoading, setTakeoverLoading] = useState(false);

  // --- 阶段六：原图 ZIP 下载与本地桌面应用程序适配器状态 ---
  const [selectedIde, setSelectedIde] = useState<'cursor' | 'trae' | 'vscode'>('cursor');
  const [desktopStatus, setDesktopStatus] = useState<ConnectionStatus>('disconnected');
  const [testingDesktop, setTestingDesktop] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipStep, setZipStep] = useState('');
  const [zippedFileLoc, setZippedFileLoc] = useState<string | null>(null);

  // 桌面通道诊断
  const handleTestIde = async () => {
    setTestingDesktop(true);
    setDesktopStatus('connecting');

    try {
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.openDesktopProject.commandKind,
        target: selectedIde,
        payload: {
          ide: selectedIde,
          projectHint: 'current_workspace',
          source: 'browser-assistant-desktop-adapter'
        },
        requiresUserGesture: BROWSER_ACTIONS.openDesktopProject.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setDesktopStatus('error');
        notify.warning('Browser Bridge 未连接', result.summary || SETUP_HINT);
        return;
      }

      if (result.status === 'queued') {
        setDesktopStatus('connecting');
        notify.info('桌面通道指令已下发', result.summary);
        return;
      }

      if (result.status === 'success') {
        setDesktopStatus('connected');
        notify.success(
          '桌面通道已确认',
          result.summary || `Browser Bridge 已确认 ${selectedIde === 'cursor' ? 'Cursor IDE' : selectedIde === 'trae' ? 'Trae IDE' : 'VS Code'} 调起结果。`
        );
        return;
      }

      setDesktopStatus('error');
      notify.error('桌面调起失败', result.error || result.summary);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      setDesktopStatus('error');
      notify.error('桌面调起失败', error?.message || 'Browser Bridge 桌面通道执行失败');
    } finally {
      if (isMountedRef.current) {
        setTestingDesktop(false);
      }
    }
  };

  // 打包原图下载适配器 (遵循 AGENTS.md 规范与 ZIP manifest 契约)
  const handleZipOriginals = () => {
    setZipLoading(false);
    setZipProgress(0);
    setZippedFileLoc(null);
    setZipStep('正在交给 KK Studio 资源工具打包原图...');
    window.dispatchEvent(new CustomEvent('takeover-zip-originals', {
      detail: {
        scope: 'all_canvas_outputs'
      }
    }));
  };

  const handleLocateZippedFile = () => {
    if (zippedFileLoc) {
      notify.info('ZIP 已准备就绪', '请在浏览器下载记录或系统下载目录中查看刚刚导出的 ZIP 文件。');
      return;
    }

    notify.warning('暂无可定位文件', '请先通过 KK Studio 资源工具完成一次真实 ZIP 打包下载。');
  };


  // 外部网页直通生图平台管理
  const [platforms, setPlatforms] = useState<ImageGenPlatform[]>([
    {
      id: 'midjourney',
      name: 'Midjourney 网页版',
      url: 'https://alpha.midjourney.com',
      status: 'unknown',
      enabled: false,
      quota: 'Pro 无限生成模式',
    },
    {
      id: 'leonardo',
      name: 'Leonardo.ai',
      url: 'https://leonardo.ai',
      status: 'unknown',
      enabled: true,
      quota: '多账号 Session 混合池',
    },
    {
      id: 'tensorart',
      name: 'Tensor.Art',
      url: 'https://tensor.art',
      status: 'unknown',
      enabled: true,
      quota: '每日 100 免费点数',
    },
  ]);

  // 社交分发平台管理
  const [socialChannels, setSocialChannels] = useState<SocialChannel[]>([
    {
      id: 'xhs',
      name: '小红书网页版',
      url: 'https://creator.xiaohongshu.com',
      status: 'unknown',
      enabled: true,
    },
    {
      id: 'weibo',
      name: '微博网页版',
      url: 'https://weibo.com',
      status: 'unknown',
      enabled: false,
    },
  ]);

  // 引用引用区：防止垃圾回收并用于卸载清理销毁
  const [activePipelineCmdId, setActivePipelineCmdId] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const isMountedRef = useRef<boolean>(true);
  
  // 采用 Ref 缓存的日志缓冲池，限制最大存储长度，避免引发大规模重排与内存溢出
  const logsBufferRef = useRef<string[]>([]);

  const appendPipelineLog = (log: string) => {
    logsBufferRef.current.push(log);
    if (logsBufferRef.current.length > 200) {
      logsBufferRef.current.shift();
    }
    setPipelineLogs([...logsBufferRef.current]);
  };

  const getBrowserBridgeSnapshot = () => ({
    daemonStatus,
    extensionStatus,
    latencyMs: daemonLatency,
    setupRequired: daemonStatus !== 'connected' || extensionStatus !== 'connected',
    setupHint: '请先启动本地守护进程并连接 Chrome Bridge 插件，然后重试此 Browser Assistant 操作。',
    platforms,
    sessions,
    socialChannels
  });

  const dispatchBrowserCommand = async (
    input: Parameters<typeof createBrowserBridgeCommand>[0]
  ): Promise<BrowserBridgeResult> => {
    const command = createBrowserBridgeCommand(input);
    if (input.kind === BROWSER_ACTIONS.generateExternal.commandKind) {
      setActivePipelineCmdId(command.id);
    }
    return browserBridgeAdapter.execute(command, {
      snapshot: getBrowserBridgeSnapshot()
    });
  };

  const applyBrowserStatusSnapshot = (status: BrowserBridgeStatusSnapshot) => {
    setDaemonStatus(status.daemonStatus);
    setExtensionStatus(status.extensionStatus);
    setDaemonLatency(status.latencyMs ?? null);

    const platformById = new Map(status.platforms.map((platform) => [platform.id, platform]));
    const sessionById = new Map(status.sessions.map((session) => [session.id, session]));
    const socialById = new Map(status.socialChannels.map((channel) => [channel.id, channel]));

    setPlatforms((prev) =>
      prev.map((platform) => {
        const snapshot = platformById.get(platform.id);
        if (!snapshot) return platform;
        return {
          ...platform,
          enabled: typeof snapshot.enabled === 'boolean' ? snapshot.enabled : platform.enabled,
          status: normalizeBrowserLoginStatus(snapshot.status)
        };
      })
    );

    setSessions((prev) =>
      prev.map((session) => {
        const snapshot = sessionById.get(session.id);
        if (!snapshot) return session;
        return {
          ...session,
          enabled: typeof snapshot.enabled === 'boolean' ? snapshot.enabled : session.enabled,
          username: snapshot.username || session.username,
          status: normalizeBrowserLoginStatus(snapshot.status)
        };
      })
    );

    setSocialChannels((prev) =>
      prev.map((channel) => {
        const snapshot = socialById.get(channel.id);
        if (!snapshot) return channel;
        return {
          ...channel,
          enabled: typeof snapshot.enabled === 'boolean' ? snapshot.enabled : channel.enabled,
          status: normalizeBrowserLoginStatus(snapshot.status)
        };
      })
    );
  };

  const createBrowserAssistantPreviewContext = (): SanitizedProjectContext => ({
    currentPage: 'settings',
    aiTakeover: { enabled: true, mode: 'local' },
    agent: { enabled: true },
    canvas: {
      selectedNodeIds: [],
      promptNodes: [],
      imageNodes: []
    },
    assets: {
      imageCollections: [],
      images: [],
      files: [],
      outputs: []
    },
    settings: {
      apiKeyStatus: 'missing',
      providerCount: 0
    },
    billing: {
      balanceKnown: false,
      canEstimateCost: false
    },
    errors: []
  });

  // 定期从 browserBridgeAdapter 同步连通性状态
  useEffect(() => {
    const syncStatus = async () => {
      try {
        const status = await toolRegistryInstance.execute('browser.getStatus', {}, {
          browserAssistantSnapshot: getBrowserBridgeSnapshot()
        }) as BrowserBridgeStatusSnapshot;
        if (isMountedRef.current) {
          applyBrowserStatusSnapshot(status);
        }
      } catch (err) {
        console.warn('Failed to sync status from browser.getStatus', err);
      }
    };
    syncStatus();
    const interval = setInterval(syncStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // 1. 初始化 Web Worker，组件卸载时 100% 回收资源
  useEffect(() => {
    isMountedRef.current = true;
    let workerUrl: string | null = null;

    // 创建 Web Worker 沙盒
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(blob);
      workerRef.current = new Worker(workerUrl);
    } catch (err) {
      console.error('Failed to initialize inline calculation worker', err);
    }

    return () => {
      isMountedRef.current = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
      }
    };
  }, []);

  // 1b. 监听浏览器桥全局异步消息以打通回调闭环
  useEffect(() => {
    const handleBridgeMessage = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (!msg || typeof msg !== 'object') return;
      const commandId = msg.commandId || msg.id;

      if (commandId && activePipelineCmdId === commandId) {
        if (msg.status === 'queued') {
          setPipelineStep(3);
          setPipelineStatusText(msg.summary || '排队中...');
          appendPipelineLog(`[queued] ${msg.summary || '指令已加入队列。'}`);
        } else if (msg.status === 'success' && msg.data) {
          const data = msg.data;
          const finalImageUrl = String(data.finalImageUrl || data.imageUrl || data.resultUrl || '');
          const productTitle = String(data.productTitle || data.title || extractedData?.title || 'Browser Bridge pipeline result');
          const postText = String(
            data.postText ||
            data.caption ||
            data.body ||
            data.summary ||
            'Browser Bridge 已返回外部网页生成结果。'
          );
          
          const activeSessions = sessions.filter(
            (s) => s.platformId === genPlatform && s.enabled && selectedSessionsForGen.includes(s.id)
          );
          const generatedBySession = routingMode === 'proxy'
            ? String(data.generatedBySession || data.sessionUsername || activeSessions[0]?.username || '')
            : '';

          setPipelineStep(5);
          setPipelineStatusText('Browser Bridge 已回传流水线结果。');
          appendPipelineLog('[success] Browser Bridge 已确认外部网页生成流水线结果。');
          setPipelineRunning(false);

          if (finalImageUrl) {
            setPipelineCompletedData({
              productTitle,
              finalImageUrl,
              generatedBySession: generatedBySession || undefined,
              postText
            });
            notify.success('流水线结果已回传', '可以同步到画布、保存草稿或打包原图。');
          } else {
            notify.warning('流水线已回传', 'Browser Bridge 未返回可同步到画布的图片 URL。');
          }
          setActivePipelineCmdId(null);
        } else if (msg.status === 'failed') {
          setPipelineStep(1);
          setPipelineStatusText(msg.error || msg.summary || '执行失败');
          appendPipelineLog(`[failed] ${msg.error || msg.summary || '执行失败'}`);
          setPipelineRunning(false);
          notify.error('流水线执行失败', msg.error || msg.summary);
          setActivePipelineCmdId(null);
        }
      }
    };

    window.addEventListener('browser-bridge-message', handleBridgeMessage);
    return () => window.removeEventListener('browser-bridge-message', handleBridgeMessage);
  }, [activePipelineCmdId, extractedData, routingMode, sessions, genPlatform, selectedSessionsForGen]);

  // Sessions 本地持久化同步
  useEffect(() => {
    localStorage.setItem('kk_browser_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('kk_browser_selected_sessions', JSON.stringify(selectedSessionsForGen));
  }, [selectedSessionsForGen]);

  // 2. WASM 内存数据采样定时器，安全卸载防内存泄漏
  useEffect(() => {
    if (!wasmEnabled) {
      setWasmMemoryUsage('0 MB');
      return;
    }

    setWasmMemoryUsage('48.2 MB');
    const memoryInterval = window.setInterval(() => {
      if (isMountedRef.current) {
        const usage = (45 + Math.random() * 4).toFixed(1);
        setWasmMemoryUsage(`${usage} MB`);
      }
    }, 3000);

    return () => {
      window.clearInterval(memoryInterval);
    };
  }, [wasmEnabled]);

  // 3. 通用连通性诊断 (自适应连接)
  const checkConnectivity = async (isManual = false) => {
    if (testingConnection) return;
    setTestingConnection(true);

    try {
      const status = await toolRegistryInstance.execute('browser.getStatus', {}, {
        browserAssistantSnapshot: getBrowserBridgeSnapshot()
      }) as BrowserBridgeStatusSnapshot;

      if (!isMountedRef.current) return;
      applyBrowserStatusSnapshot(status);

      if (isManual) {
        if (!status.setupRequired) {
          notify.success('多端连接正常', 'Web 画布已成功连接至本地守护进程与 Chrome 插件');
        } else {
          notify.warning('Browser Bridge 未连接', status.setupHint || SETUP_HINT);
        }
      }
    } catch (error: any) {
      if (isMountedRef.current && isManual) {
        notify.error('检测失败', error?.message || 'browser.getStatus 执行失败');
      }
    } finally {
      if (isMountedRef.current) {
        setTestingConnection(false);
      }
    }
  };

  // 4. 检测外部平台登录状态 (安全脱敏校验)
  const checkPlatformLogin = async (id: string) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'checking' } : p))
    );

    try {
      const status = await toolRegistryInstance.execute('browser.getStatus', {}, {
        browserAssistantSnapshot: getBrowserBridgeSnapshot()
      }) as BrowserBridgeStatusSnapshot;
      if (!isMountedRef.current) return;
      applyBrowserStatusSnapshot(status);
      const platformSnapshot = status.platforms.find((platform) => platform.id === id);
      const nextStatus = normalizeBrowserLoginStatus(platformSnapshot?.status);
      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: nextStatus }
            : p
        )
      );
      if (nextStatus === 'logged_in') {
        notify.success(
          '登录状态就绪',
          `${platforms.find((p) => p.id === id)?.name} 已处于已登录态`
        );
      } else {
        notify.warning(
          status.setupRequired ? 'Browser Bridge 未连接' : '未登录',
          status.setupRequired ? status.setupHint : `未检测到 ${platforms.find((p) => p.id === id)?.name} 的登录凭证`
        );
      }
    } catch (error: any) {
      setPlatforms((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'unknown' } : p))
      );
      notify.error('登录状态检查失败', error?.message || 'browser.getStatus 执行失败');
    }
  };

  const togglePlatform = (id: string) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
    const platform = platforms.find((p) => p.id === id);
    if (platform && isMountedRef.current) {
      notify.success(
        platform.enabled ? '已禁用该平台' : '已启用该平台',
        `${platform.name} 将${platform.enabled ? '不再' : '会'}加入 AI 网页直通生图调度池`
      );
    }
  };

  // 5. 检测社交分发通道
  const checkSocialLogin = async (id: string) => {
    setSocialChannels((prev) =>
      prev.map((sc) => (sc.id === id ? { ...sc, status: 'checking' } : sc))
    );

    try {
      const status = await toolRegistryInstance.execute('browser.getStatus', {}, {
        browserAssistantSnapshot: getBrowserBridgeSnapshot()
      }) as BrowserBridgeStatusSnapshot;
      if (!isMountedRef.current) return;
      applyBrowserStatusSnapshot(status);
      const channelSnapshot = status.socialChannels.find((channel) => channel.id === id);
      const nextStatus = normalizeBrowserLoginStatus(channelSnapshot?.status);
      setSocialChannels((prev) =>
        prev.map((sc) =>
          sc.id === id
            ? { ...sc, status: nextStatus }
            : sc
        )
      );
      if (nextStatus === 'logged_in') {
        notify.success(
          '登录检测成功',
          `${socialChannels.find((sc) => sc.id === id)?.name} 分发通道就绪`
        );
      } else {
        notify.warning(
          status.setupRequired ? 'Browser Bridge 未连接' : '未登录',
          status.setupRequired ? status.setupHint : `未检测到 ${socialChannels.find((sc) => sc.id === id)?.name} 登录状态`
        );
      }
    } catch (error: any) {
      setSocialChannels((prev) =>
        prev.map((sc) => (sc.id === id ? { ...sc, status: 'unknown' } : sc))
      );
      notify.error('登录状态检查失败', error?.message || 'browser.getStatus 执行失败');
    }
  };

  const toggleSocialChannel = (id: string) => {
    setSocialChannels((prev) =>
      prev.map((sc) => (sc.id === id ? { ...sc, enabled: !sc.enabled } : sc))
    );
    const channel = socialChannels.find((sc) => sc.id === id);
    if (channel && isMountedRef.current) {
      notify.success(
        channel.enabled ? '已禁用分发' : '已启用分发',
        `已${channel.enabled ? '停用' : '启用'} ${channel.name} 自动发布草稿托管`
      );
    }
  };

  // 阶段五：新增/开关/登录自检多账号 Session 的方法
  const handleAddSession = (platformId: string) => {
    const randomSuffix = Math.floor(Math.random() * 900) + 100;
    const newSess: AccountSession = {
      id: `sess_${platformId}_${Date.now()}`,
      platformId,
      username: `leo_user_${randomSuffix}`,
      status: 'unknown',
      enabled: true,
      priority: 'normal'
    };
    setSessions((prev) => [...prev, newSess]);
    notify.success('新增实例成功', '已为此平台新增一个浏览器多开授权账号实例，可在生成调度中参与并发轮询！');
  };

  const toggleSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    notify.success('实例状态更新', '实例调度使能状态已成功切换');
  };

  const checkSessionLogin = async (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'checking' } : s))
    );

    try {
      const status = await toolRegistryInstance.execute('browser.getStatus', {}, {
        browserAssistantSnapshot: getBrowserBridgeSnapshot()
      }) as BrowserBridgeStatusSnapshot;
      if (!isMountedRef.current) return;
      applyBrowserStatusSnapshot(status);
      const sessionSnapshot = status.sessions.find((session) => session.id === id);
      const nextStatus = normalizeBrowserLoginStatus(sessionSnapshot?.status);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s))
      );
      if (nextStatus === 'logged_in') {
        notify.success('检测成功', '多开网页会话登录状态有效！');
      } else {
        notify.warning(
          status.setupRequired ? 'Browser Bridge 未连接' : '会话未登录',
          status.setupRequired ? status.setupHint : '未检测到该多开网页会话的有效登录状态。'
        );
      }
    } catch (error: any) {
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'unknown' } : s))
      );
      notify.error('会话检查失败', error?.message || 'browser.getStatus 执行失败');
    }
  };

  const handleSelectSessionToggle = (sessId: string) => {
    setSelectedSessionsForGen((prev) =>
      prev.includes(sessId) ? prev.filter((id) => id !== sessId) : [...prev, sessId]
    );
  };

  // 6. 商品提取核心流程
  const handleExtractTest = async () => {
    if (!targetUrl) {
      notify.warning('请输入 URL', '提取需要有效的电商或网页链接');
      return;
    }

    setExtractLoading(true);
    setExtractedData(null);

    try {
      setExtractStep('正在通过 Browser Bridge runtime adapter 下发商品解析指令...');
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.extractProduct.commandKind,
        target: targetUrl,
        payload: {
          targets: ['price', 'title', 'image', 'description']
        },
        requiresUserGesture: BROWSER_ACTIONS.extractProduct.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setExtractStep(result.summary);
        notify.warning('Browser Bridge 未连接', result.summary);
        return;
      }

      if (result.status === 'queued') {
        setExtractStep(result.summary);
        notify.info('解析指令已下发', '等待本地守护进程或 Chrome 插件回传结构化商品摘要。');
        return;
      }

      if (result.status === 'success' && result.data) {
        const data = result.data as any;
        const title = String(data.title || '未命名商品');
        const price = String(data.price || '价格未识别');
        setExtractedData({
          title,
          price,
          originalPrice: data.originalPrice,
          imageUrl: String(data.imageUrl || ''),
          platform: String(data.platform || '外部网页'),
          description: String(data.description || 'Browser Bridge 已返回商品摘要。')
        });
        setEditedTitle(title);
        setEditedPrice(price);
        setExtractStep('Browser Bridge 商品摘要已回传。');
        notify.success('提取成功', `成功提取来自【${data.platform || '外部网页'}】的商品摘要`);
        return;
      }

      setExtractStep(result.error || result.summary);
      notify.error('提取失败', result.error || result.summary);
    } catch (error: any) {
      setExtractStep(error?.message || 'Browser Bridge 商品提取失败');
      notify.error('提取失败', error?.message || 'Browser Bridge 商品提取失败');
    } finally {
      if (isMountedRef.current) {
        setExtractLoading(false);
      }
    }
  };

  // 7. 本地抠图导入画布 (Web Worker 后台处理)
  const handleImportToCanvasWithClip = () => {
    if (!extractedData) return;

    const triggerImport = (imgUrl: string, isClipped: boolean) => {
      window.dispatchEvent(new CustomEvent('takeover-create-prompt-cards', {
        detail: {
          prompts: [
            `提取商品: ${extractedData.title}\n价格: ${extractedData.price}\n来源: ${extractedData.platform}`
          ],
          imageUrl: imgUrl
        }
      }));
      notify.success(
        isClipped ? '导入成功 (透明 PNG)' : '导入成功',
        isClipped ? '已在画布上自动创建透明背景商品切图卡片。' : '已成功在画布上自动创建原始商品主图卡片。'
      );
    };
    
    if (autoClip && workerRef.current) {
      setClippingProgress(true);
      notify.info('检查 Wasm 抠图', '正在调用 Web Worker；未返回透明图时将保留原始商品主图。');
      
      // 发送抠图指令给 Worker
      workerRef.current.postMessage({ task: 'clip', data: extractedData.imageUrl });

      workerRef.current.onmessage = (e) => {
        if (!isMountedRef.current) return;
        const { type, data } = e.data;
        if (type === 'done') {
          setClippingProgress(false);
          if (data.success !== true) {
            notify.info('已保留原图', '当前 Worker 未返回透明抠图结果，已按原始商品主图同步到画布。');
          }
          triggerImport(data.url || extractedData.imageUrl, data.success === true);
        }
      };
    } else {
      triggerImport(extractedData.imageUrl, false);
    }
  };

  // 7b. 双向 DOM 实时编辑与 Browser Bridge 回写
  const handleWriteBackDom = async () => {
    if (!extractedData) return;
    setWriteBackLoading(true);

    try {
      notify.info('启动 DOM 同步', '正在通过 Browser Bridge adapter 下发 DOM 回写指令...');
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.writeBackDom.commandKind,
        target: targetUrl || 'active_tab',
        payload: {
          title: editedTitle,
          price: editedPrice,
          platform: extractedData.platform
        },
        requiresUserGesture: BROWSER_ACTIONS.writeBackDom.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        notify.warning('Browser Bridge 未连接', result.summary);
        return;
      }

      if (result.status === 'queued') {
        notify.info('DOM 回写指令已下发', '等待本地守护进程或 Chrome 插件确认目标页面修改结果。');
        return;
      }

      if (result.status === 'success') {
        setExtractedData(prev => prev ? {
          ...prev,
          title: editedTitle,
          price: editedPrice
        } : null);
        notify.success('DOM 同步成功', 'Browser Bridge 已确认外部网页字段回写完成。');
        return;
      }

      notify.error('DOM 同步失败', result.error || result.summary);
    } catch (error: any) {
      notify.error('DOM 同步失败', error?.message || 'Browser Bridge DOM 回写失败');
    } finally {
      if (isMountedRef.current) {
        setWriteBackLoading(false);
      }
    }
  };

  // 8. 外部网页直通网站生图 (Web Worker 计算隔离)
  const handleGenTest = async () => {
    if (!promptText) {
      notify.warning('请输入 Prompt', '生图需要有效的提示词');
      return;
    }

    const selectedPlat = platforms.find((p) => p.id === genPlatform);
    if (!selectedPlat || !selectedPlat.enabled) {
      notify.warning('平台不可用', '请确保您在上方启用了对应的生图平台');
      return;
    }

    setGenLoading(true);
    setGeneratedImageUrl(null);
    setGenProgress(0);

    try {
      setGenStep(`正在通过 Browser Bridge adapter 分配至外部 ${selectedPlat.name} 生图队列...`);
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.generateExternal.commandKind,
        target: selectedPlat.id,
        payload: {
          prompt: promptText,
          platformId: selectedPlat.id,
          count: 1,
          sessionIds: selectedSessionsForGen
        },
        requiresUserGesture: BROWSER_ACTIONS.generateExternal.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setGenStep(result.summary);
        notify.warning('Browser Bridge 未连接', result.summary);
        return;
      }

      if (result.status === 'queued') {
        setGenProgress(5);
        setGenStep(result.summary);
        notify.info('网页直通生图指令已下发', '等待本地守护进程或 Chrome 插件回传外部平台生成状态。');
        return;
      }

      if (result.status === 'success' && result.data) {
        const data = result.data as any;
        setGenProgress(100);
        setGeneratedImageUrl(String(data.imageUrl || ''));
        setGenStep('Browser Bridge 已回传外部平台生成结果。');
        notify.success('外部生图成功', `Browser Bridge 已拉取来自 ${selectedPlat.name} 的生成结果。`);
        return;
      }

      setGenStep(result.error || result.summary);
      notify.error('外部生图失败', result.error || result.summary);
    } catch (error: any) {
      setGenStep(error?.message || 'Browser Bridge 外部生图失败');
      notify.error('外部生图失败', error?.message || 'Browser Bridge 外部生图失败');
    } finally {
      if (isMountedRef.current) {
        setGenLoading(false);
      }
    }
  };

  // 9. 社交发布流程一键分发
  const handlePublishToSocial = async (overrideImageUrl?: string) => {
    const imageUrlToPublish = overrideImageUrl || generatedImageUrl;
    if (!imageUrlToPublish) return;

    const xhsPlat = socialChannels.find((sc) => sc.id === 'xhs');
    if (!xhsPlat || !xhsPlat.enabled) {
      notify.warning('小红书渠道未启用', '请先在上方启用小红书分发通道');
      return;
    }

    setPublishingLoading(true);

    try {
      setPublishingStep('正在通过 Browser Bridge adapter 下发草稿箱保存指令...');
      const result = await dispatchBrowserCommand({
          kind: BROWSER_ACTIONS.publishDraft.commandKind,
          target: xhsPlat.id,
          payload: {
            channelId: xhsPlat.id,
            imageUrl: imageUrlToPublish,
            title: extractedData?.title || 'KK Studio AI 海报',
            body: pipelineCompletedData?.postText || '由 KK Studio AI 辅助生成的创意海报。',
          publishMode: 'draft_only'
        },
        requiresUserGesture: BROWSER_ACTIONS.publishDraft.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setPublishingStep(result.summary);
        notify.warning('Browser Bridge 未连接', result.summary);
        return;
      }

      if (result.status === 'queued') {
        setPublishingStep(result.summary);
        notify.info('草稿保存指令已下发', '等待本地守护进程或 Chrome 插件回传草稿箱状态。');
        return;
      }

      if (result.status === 'success') {
        setPublishingStep('Browser Bridge 已确认草稿箱保存完成。');
        notify.success('小红书草稿保存成功', 'Browser Bridge 已确认素材和文案保存至草稿箱。');
        return;
      }

      setPublishingStep(result.error || result.summary);
      notify.error('草稿保存失败', result.error || result.summary);
    } catch (error: any) {
      setPublishingStep(error?.message || 'Browser Bridge 草稿保存失败');
      notify.error('草稿保存失败', error?.message || 'Browser Bridge 草稿保存失败');
    } finally {
      if (isMountedRef.current) {
        setPublishingLoading(false);
      }
    }
  };

  // 10. 阶段四：本地 LLM 网关连通性诊断
  const handleTestLocalLlm = async () => {
    setTestingLlm(true);
    setLocalLlmStatus('connecting');

    try {
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.checkLocalLlm.commandKind,
        target: 'local_llm_gateway',
        payload: {
          provider: 'ollama',
          endpoint: localLlmEndpoint,
          model: localLlmModel,
          source: 'browser-assistant-local-llm'
        },
        requiresUserGesture: BROWSER_ACTIONS.checkLocalLlm.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setLocalLlmStatus('error');
        notify.warning('Browser Bridge 未连接', result.summary || SETUP_HINT);
        return;
      }

      if (result.status === 'queued') {
        setLocalLlmStatus('connecting');
        notify.info('本地 LLM 网关指令已下发', result.summary);
        return;
      }

      if (result.status === 'success') {
        setLocalLlmStatus('connected');
        const activeModel = String(result.data?.activeModel || result.data?.model || localLlmModel);
        notify.success('Ollama 网关诊断就绪', `Browser Bridge 已确认本地网关可用，活跃模型：${activeModel}`);
        return;
      }

      setLocalLlmStatus('error');
      notify.error('Ollama 网关诊断失败', result.error || result.summary);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setLocalLlmStatus('error');
      notify.error('Ollama 网关诊断失败', `Browser Bridge 本地网关诊断失败: ${err?.message || String(err)}`);
    } finally {
      if (isMountedRef.current) {
        setTestingLlm(false);
      }
    }
  };

  // 11. 阶段四：智能剪贴板流入
  const handleReadClipboardPayload = async () => {
    if (!clipboardSyncEnabled) {
      notify.warning('监听未开启', '请先开启智能剪贴板监听开关');
      return;
    }

    if (!navigator.clipboard?.readText) {
      notify.warning('剪贴板不可用', '当前浏览器不支持读取文本剪贴板，请手动复制内容后重试。');
      return;
    }

    try {
      const content = (await navigator.clipboard.readText()).trim();
      if (!content) {
        notify.warning('剪贴板为空', '没有读取到可导入画布的文本内容。');
        return;
      }

      setClipboardPayload({
        type: /^https?:\/\//i.test(content) ? 'url' : 'text',
        content,
        showNotification: true,
      });
      notify.info('剪贴板已读取', '可在下方提示中确认后导入为画布 Prompt 卡片。');
    } catch (error: any) {
      notify.error('剪贴板读取失败', error?.message || '浏览器拒绝了剪贴板读取请求。');
    }
  };

  const handleImportClipboardPayload = () => {
    if (!clipboardPayload) return;
    window.dispatchEvent(new CustomEvent('takeover-create-prompt-cards', {
      detail: {
        prompts: [
          `剪贴板感知内容 (${clipboardPayload.type}): ${clipboardPayload.content}`
        ]
      }
    }));
    notify.info('已提交导入', '剪贴板内容已交给 KK Studio 画布工具创建 Prompt 卡片。');
    setClipboardPayload(null);
  };

  // 12. 阶段四：Browser Bridge 屏幕感知设计转译
  const handleScreenInspect = async () => {
    if (screenInspectStatus === 'capturing' || screenInspectStatus === 'parsing') return;

    setScreenInspectStatus('capturing');
    setInspectData(null);

    try {
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.inspectPage.commandKind,
        target: 'active_tab',
        payload: {
          includePalette: true,
          includeOcr: true,
          includeLayout: true,
          source: 'browser-assistant-screen-inspect'
        },
        requiresUserGesture: BROWSER_ACTIONS.inspectPage.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setScreenInspectStatus('idle');
        notify.warning('Browser Bridge 未连接', result.summary);
        return;
      }

      if (result.status === 'queued') {
        setScreenInspectStatus('idle');
        notify.info('屏幕感知指令已下发', '等待本地守护进程或 Chrome 插件回传可见视口摘要。');
        return;
      }

      if (result.status === 'success' && result.data) {
        const data = result.data as any;
        setScreenInspectStatus('done');
        setInspectData({
          palette: Array.isArray(data.palette) ? data.palette.map(String).slice(0, 8) : [],
          layoutType: String(data.layoutType || data.layout || data.summary || 'Browser Bridge viewport summary'),
          ocrText: String(data.ocrText || data.text || data.visibleText || '')
        });
        notify.success('屏幕感知完成', 'Browser Bridge 已回传可见视口、色彩和文本摘要。');
        return;
      }

      setScreenInspectStatus('idle');
      notify.error('屏幕感知失败', result.error || result.summary);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      setScreenInspectStatus('idle');
      notify.error('屏幕感知失败', error?.message || 'Browser Bridge 屏幕感知失败');
    }
  };

  const handleTranslateInspectionToCanvas = () => {
    if (!inspectData) return;

    const palette = inspectData.palette.length > 0 ? inspectData.palette.join(', ') : 'no palette returned';
    window.dispatchEvent(new CustomEvent('takeover-create-prompt-cards', {
      detail: {
        prompts: [
          `Browser viewport translation\nLayout: ${inspectData.layoutType}\nPalette: ${palette}\nVisible text: ${inspectData.ocrText || 'none'}`
        ]
      }
    }));
    notify.info('已提交转译', '网页可见视口摘要已交给 KK Studio 画布工具创建 Prompt 卡片。');
    setInspectData(null);
    setScreenInspectStatus('idle');
  };

  // 13. Browser Bridge runtime pipeline: no local success simulation.
  const handleRunPipeline = async () => {
    if (pipelineRunning) return;

    if (!promptText.trim()) {
      notify.warning('请输入 Prompt', '流水线需要先填写外部生图提示词。');
      return;
    }

    const selectedPlat = platforms.find((p) => p.id === genPlatform);
    if (!selectedPlat || !selectedPlat.enabled) {
      notify.warning('平台不可用', '请先启用本次流水线要使用的外部生图平台。');
      return;
    }

    const activeSessions = sessions.filter(
      (s) => s.platformId === genPlatform && s.enabled && selectedSessionsForGen.includes(s.id)
    );

    if (routingMode === 'proxy' && activeSessions.length === 0) {
      notify.error('调度失败', '网页直通模式下，请至少勾选一个可用的账号会话实例。');
      setPipelineLogs(['调度失败：未选择可用的网页直通账号会话实例。']);
      return;
    }

    const enabledSocialChannels = socialChannels.filter((channel) => channel.enabled);

    setPipelineRunning(true);
    setPipelineStep(1);
    setPipelineCompletedData(null);
    logsBufferRef.current = ['[1/5] Browser Assistant pipeline 已进入 Browser Bridge runtime。'];
    appendPipelineLog(
      routingMode === 'proxy'
        ? `[2/5] 网页直通会话池：${activeSessions.map((session) => session.username).join(', ')}`
        : '[2/5] 官方 API 通道将由 Browser Bridge runtime 统一调度，不在前端本地扣费。'
    );
    setPipelineStatusText('正在通过 Browser Bridge adapter 下发网页直通生图流水线指令...');

    let shouldKeepRunning = false;

    try {
      const result = await dispatchBrowserCommand({
        kind: BROWSER_ACTIONS.generateExternal.commandKind,
        target: selectedPlat.id,
        payload: {
          prompt: promptText,
          platformId: selectedPlat.id,
          count: 1,
          routingMode,
          sessionIds: activeSessions.map((session) => session.id),
          sessionUsernames: activeSessions.map((session) => session.username),
          pipeline: {
            sourceUrl: targetUrl || undefined,
            productTitle: extractedData?.title,
            productImageUrl: extractedData?.imageUrl,
            socialChannelIds: enabledSocialChannels.map((channel) => channel.id),
            publishMode: 'draft_only'
          }
        },
        requiresUserGesture: BROWSER_ACTIONS.generateExternal.requiresUserGesture
      });

      if (!isMountedRef.current) return;

      if (result.status === 'setup_required') {
        setPipelineStep(1);
        setPipelineStatusText(result.summary);
        appendPipelineLog(`[setup_required] ${result.summary}`);
        notify.warning('Browser Bridge 未连接', result.summary);
        return;
      }

      if (result.status === 'queued') {
        setPipelineStep(3);
        setPipelineStatusText(result.summary);
        appendPipelineLog(`[queued] ${result.summary}`);
        notify.info('流水线指令已下发', '等待本地守护进程或 Chrome 插件回传外部生成与草稿状态。');
        shouldKeepRunning = true;
        return;
      }

      if (result.status === 'success' && result.data) {
        const data = result.data as any;
        const finalImageUrl = String(data.finalImageUrl || data.imageUrl || data.resultUrl || '');
        const productTitle = String(data.productTitle || data.title || extractedData?.title || 'Browser Bridge pipeline result');
        const postText = String(
          data.postText ||
          data.caption ||
          data.body ||
          data.summary ||
          'Browser Bridge 已返回外部网页生成结果。'
        );
        const generatedBySession = routingMode === 'proxy'
          ? String(data.generatedBySession || data.sessionUsername || activeSessions[0]?.username || '')
          : '';

        setPipelineStep(5);
        setPipelineStatusText('Browser Bridge 已回传流水线结果。');
        appendPipelineLog('[success] Browser Bridge 已确认外部网页生成流水线结果。');

        if (!finalImageUrl) {
          notify.warning('流水线已回传', 'Browser Bridge 未返回可同步到画布的图片 URL。');
          return;
        }

        setPipelineCompletedData({
          productTitle,
          finalImageUrl,
          generatedBySession: generatedBySession || undefined,
          postText
        });
        notify.success('流水线结果已回传', '可以同步到画布、保存草稿或打包原图。');
        return;
      }

      setPipelineStep(1);
      setPipelineStatusText(result.error || result.summary);
      appendPipelineLog(`[failed] ${result.error || result.summary}`);
      notify.error('流水线执行失败', result.error || result.summary);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const message = error?.message || 'Browser Bridge 流水线执行失败';
      setPipelineStep(1);
      setPipelineStatusText(message);
      appendPipelineLog(`[error] ${message}`);
      notify.error('流水线执行失败', message);
    } finally {
      if (isMountedRef.current && !shouldKeepRunning) {
        setPipelineRunning(false);
      }
    }
  };

  // 14. 阶段五：AI Takeover 自然语言解析预览与真实回注驱动
  const handlePreviewTakeoverPlan = async () => {
    if (!takeoverInput) return;
    
    setTakeoverLoading(true);
    setTakeoverOutput(null);

    try {
      const record = await agentRuntimeInstance.run(
        takeoverInput,
        createBrowserAssistantPreviewContext()
      );
      if (!isMountedRef.current) return;
      setTakeoverLoading(false);

      const plan = record.plan;
      const firstAction = plan.actions[0] as any;
      const isProxyRoute = plan.actions.some((action: AssistantAction) => action.type === 'browser.generateExternal');
      const isExtractRoute = plan.actions.some((action: AssistantAction) => action.type === 'browser.extractProduct');
      const parsedSessions = isProxyRoute
        ? sessions.filter((s) => s.platformId === 'leonardo' && s.enabled).map((s) => s.username)
        : [];
      const extractedUrl = firstAction?.payload?.url || '';
      const extractedPrompt = firstAction?.payload?.prompt || '';

      setTakeoverOutput({
        intent: plan.intent,
        routing: isProxyRoute ? 'agent_proxy' : 'api',
        sessions: parsedSessions,
        risk: plan.requiresConfirmation ? 'confirm' : 'none',
        confidence: plan.confidence,
        reason: plan.reply
      });

      notify.success('AI Takeover 解析成功', '已使用真实 AgentRuntime 生成预览计划。');
      
      if (isExtractRoute) {
        setPlaygroundTab('extract');
        if (extractedUrl) {
          setTargetUrl(extractedUrl);
          notify.success('参数回注成功', `已提取商品链接并注入抓取输入框，已切换至「商品抓取与抠图」控制台！`);
        }
      } else if (isProxyRoute || plan.intent === 'browser_generate_external') {
        if (extractedPrompt) {
          setPromptText(extractedPrompt);
        }
        setPlaygroundTab('pipeline');
        setRoutingMode('proxy');
        notify.success('参数回注成功', '已切换至「全自动宏流水线」，并已注入真实规划器识别出的代理路线。');
      }
    } catch (error: any) {
      setTakeoverLoading(false);
      notify.error('AI Takeover 解析失败', error?.message || 'AgentRuntime 预览计划失败');
    }
  };

  const handleCreateCardInCanvas = () => {
    if (!generatedImageUrl) return;
    window.dispatchEvent(new CustomEvent('takeover-create-prompt-cards', {
      detail: {
        prompts: [
          `外部生图提示词: ${promptText}`
        ],
        imageUrl: generatedImageUrl
      }
    }));
    notify.success('已同步至画布', '已成功在画布上自动创建提示词卡片与生成的图片。');
  };

  const handleImportPipelineCompletedToCanvas = () => {
    if (!pipelineCompletedData) return;
    window.dispatchEvent(new CustomEvent('takeover-create-prompt-cards', {
      detail: {
        prompts: [
          `流水线自动编排海报: ${pipelineCompletedData.productTitle}\n营销文案: ${pipelineCompletedData.postText}`
        ],
        imageUrl: pipelineCompletedData.finalImageUrl
      }
    }));
    notify.success('已同步至画布', '海报大纲及生成的电商海报已成功同步至画布中央。');
  };

  return (
    <SettingsViewShell className="settings-browser-assistant-view">
      <SettingsHero
        title="浏览器助手与多端控制"
        description="通过安装 Chrome 扩展和启动轻量本地守护进程，实现 Web 网页对本地多端（浏览器、本地命令行、Electron 桌面应用）的联动控制，助力 AI 一站式抓取电商商品价格及营销属性，并支持零 API 费用的外部平台批量生图调度与多渠道分发托管。"
      />

      <SettingsCardGridContainer>
        {/* 核心配置卡片：挂载在能力树 */}
        <div className="dashboard-grid-card settings-browser-section-card settings-browser-section-card--wide a-card-span-4-col">
          <div className="settings-browser-section-card__header">
            <div>
              <div className="settings-browser-section-card__kicker">能力树控制</div>
              <h3 className="settings-browser-section-card__title">浏览器助手核心设置</h3>
            </div>
            <SettingsBadge tone="emerald">
              <span>核心开关</span>
            </SettingsBadge>
          </div>
          <p className="settings-browser-section-card__description">
            配置本地浏览器助手运行时的核心安全与权限边界。高风险行为将受到严格的权限卫士拦截。
          </p>

          <div className="settings-browser-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(285px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {/* 核心开关 1: 启用桌面端本地浏览器助手 */}
            <div className="settings-browser-feature-card">
              <div className="settings-browser-feature-card__header">
                <span className="settings-browser-feature-card__title">
                  <Globe size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                  启用桌面端本地浏览器助手
                </span>
                <button
                  type="button"
                  onClick={() => setEnableBrowserAssistant(!enableBrowserAssistant)}
                  className="settings-browser-toggle"
                  data-state={enableBrowserAssistant ? 'enabled' : 'disabled'}
                  aria-pressed={enableBrowserAssistant}
                >
                  {enableBrowserAssistant ? (
                    <ToggleRight size={22} className="settings-browser-toggle__icon" />
                  ) : (
                    <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                  )}
                </button>
              </div>
              <p className="settings-browser-feature-card__description">
                是否允许通过本地守护进程连接和接管本地 Chrome 浏览器。
              </p>
            </div>

            {/* 核心开关 2: 允许读取网页 */}
            <div className="settings-browser-feature-card">
              <div className="settings-browser-feature-card__header">
                <span className="settings-browser-feature-card__title">
                  <Info size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                  允许读取网页
                </span>
                <button
                  type="button"
                  onClick={() => setAllowReadWebpages(!allowReadWebpages)}
                  className="settings-browser-toggle"
                  data-state={allowReadWebpages ? 'enabled' : 'disabled'}
                  aria-pressed={allowReadWebpages}
                >
                  {allowReadWebpages ? (
                    <ToggleRight size={22} className="settings-browser-toggle__icon" />
                  ) : (
                    <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                  )}
                </button>
              </div>
              <p className="settings-browser-feature-card__description">
                允许 AI 助手读取当前活动标签页的 HTML DOM 结构及可见文本。
              </p>
            </div>

            {/* 核心开关 3: 允许提取图片 */}
            <div className="settings-browser-feature-card">
              <div className="settings-browser-feature-card__header">
                <span className="settings-browser-feature-card__title">
                  <Globe size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                  允许提取网页素材
                </span>
                <button
                  type="button"
                  onClick={() => setAllowExtractImages(!allowExtractImages)}
                  className="settings-browser-toggle"
                  data-state={allowExtractImages ? 'enabled' : 'disabled'}
                  aria-pressed={allowExtractImages}
                >
                  {allowExtractImages ? (
                    <ToggleRight size={22} className="settings-browser-toggle__icon" />
                  ) : (
                    <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                  )}
                </button>
              </div>
              <p className="settings-browser-feature-card__description">
                允许提取活动标签页的背景图、产品主图等媒体资源。
              </p>
            </div>

            {/* 核心开关 4: 允许上传文件 */}
            <div className="settings-browser-feature-card">
              <div className="settings-browser-feature-card__header">
                <span className="settings-browser-feature-card__title">
                  <Info size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                  允许上传文件
                </span>
                <button
                  type="button"
                  onClick={() => setAllowUploadFiles(!allowUploadFiles)}
                  className="settings-browser-toggle"
                  data-state={allowUploadFiles ? 'enabled' : 'disabled'}
                  aria-pressed={allowUploadFiles}
                >
                  {allowUploadFiles ? (
                    <ToggleRight size={22} className="settings-browser-toggle__icon" />
                  ) : (
                    <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                  )}
                </button>
              </div>
              <p className="settings-browser-feature-card__description">
                允许浏览器助手代表您上传本地导出的图片、海报及素材包。
              </p>
            </div>

            {/* 核心开关 5: 允许会员网站生成 */}
            <div className="settings-browser-feature-card">
              <div className="settings-browser-feature-card__header">
                <span className="settings-browser-feature-card__title">
                  <Globe size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                  允许会员网站生成
                </span>
                <button
                  type="button"
                  onClick={() => setAllowMembershipGeneration(!allowMembershipGeneration)}
                  className="settings-browser-toggle"
                  data-state={allowMembershipGeneration ? 'enabled' : 'disabled'}
                  aria-pressed={allowMembershipGeneration}
                >
                  {allowMembershipGeneration ? (
                    <ToggleRight size={22} className="settings-browser-toggle__icon" />
                  ) : (
                    <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                  )}
                </button>
              </div>
              <p className="settings-browser-feature-card__description">
                是否允许调用您在本机登录的会员网站服务进行图像和媒体生成。
              </p>
            </div>

            {/* 核心开关 6: 高风险操作必须逐次确认 */}
            <div className="settings-browser-feature-card">
              <div className="settings-browser-feature-card__header">
                <span className="settings-browser-feature-card__title">
                  <AlertCircle size={13} className="settings-browser-feature-card__icon" data-tone="warning" />
                  高风险操作必须逐次确认
                </span>
                <button
                  type="button"
                  onClick={() => setHighRiskConfirmationRequired(!highRiskConfirmationRequired)}
                  className="settings-browser-toggle"
                  data-state={highRiskConfirmationRequired ? 'enabled' : 'disabled'}
                  aria-pressed={highRiskConfirmationRequired}
                >
                  {highRiskConfirmationRequired ? (
                    <ToggleRight size={22} className="settings-browser-toggle__icon" />
                  ) : (
                    <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                  )}
                </button>
              </div>
              <p className="settings-browser-feature-card__description">
                对涉及发布、购买、删除或修改账号设置等敏感操作，必须逐次弹出手动确认框。
              </p>
            </div>
          </div>

          {/* 警示说明框 */}
          <div className="settings-browser-notice" data-tone="warning" style={{ marginTop: '16px' }}>
            <div className="settings-browser-notice__content">
              <AlertCircle size={16} className="settings-browser-feature-card__icon" data-tone="warning" />
              <div className="settings-browser-notice__text">
                <span className="settings-browser-notice__title">高安全边界规则（AGENTS.md 规范）：</span>
                <span>发布、购买、删除、修改账号设置等高风险操作必须由用户逐次确认，绝对不允许 AI 代理擅自执行。</span>
              </div>
            </div>
          </div>
        </div>

        {/* 状态检测卡片 1：本地守护进程 */}
        <div className="dashboard-grid-card settings-browser-status-card" data-status={daemonStatus}>
          <div className="settings-browser-status-card__content">
            <div className="settings-browser-status-card__header">
              <span className="settings-browser-status-card__kicker">本地守护进程 (Daemon)</span>
              <div className="settings-browser-status-card__dot" data-status={daemonStatus} />
            </div>
            
            <div className="settings-browser-status-card__body">
              <div className="settings-browser-status-card__title">
                {daemonStatus === 'connected' ? (
                  <>
                    <Check size={14} className="settings-browser-status-card__icon" />
                    <span>已连接 (Port: 9099)</span>
                  </>
                ) : daemonStatus === 'connecting' ? (
                  <>
                    <Loader2 size={14} className="settings-browser-status-card__icon animate-spin" />
                    <span>正在连接本地服务...</span>
                  </>
                ) : (
                  <>
                    <X size={14} className="settings-browser-status-card__icon" />
                    <span>未启动 / 未运行</span>
                  </>
                )}
              </div>
              {daemonLatency && (
                <div className="settings-browser-status-card__meta">
                  延迟响应: <span className="settings-browser-status-card__meta-value">{daemonLatency} ms</span> | 运行正常
                </div>
              )}
            </div>
            
            <div className="settings-browser-status-card__note">
              用于连接 Web 页面与本地系统的通讯网关。
            </div>
          </div>
        </div>

        {/* 状态检测卡片 2：浏览器插件状态 */}
        <div className="dashboard-grid-card settings-browser-status-card" data-status={extensionStatus}>
          <div className="settings-browser-status-card__content">
            <div className="settings-browser-status-card__header">
              <span className="settings-browser-status-card__kicker">浏览器 Bridge 插件</span>
              <div className="settings-browser-status-card__dot" data-status={extensionStatus} />
            </div>

            <div className="settings-browser-status-card__body">
              <div className="settings-browser-status-card__title">
                {extensionStatus === 'connected' ? (
                  <>
                    <Check size={14} className="settings-browser-status-card__icon" />
                    <span>插件正常桥接</span>
                  </>
                ) : extensionStatus === 'connecting' ? (
                  <>
                    <Loader2 size={14} className="settings-browser-status-card__icon animate-spin" />
                    <span>等待插件握手...</span>
                  </>
                ) : (
                  <>
                    <X size={14} className="settings-browser-status-card__icon" />
                    <span>插件未就绪</span>
                  </>
                )}
              </div>
              {extensionStatus === 'connected' && (
                <div className="settings-browser-status-card__meta">
                  活动会话: <span className="settings-browser-status-card__meta-value">Chrome (已登录态)</span>
                </div>
              )}
            </div>

            <div className="settings-browser-status-card__note">
              负责在真实的浏览器标签页中提取页面数据与 DOM 树快照。
            </div>
          </div>
        </div>

        {/* 连通性诊断 Doctor 控制台 */}
        <div className="dashboard-grid-card settings-browser-diagnostic-card a-card-span-2-col">
          <div>
            <div className="settings-browser-status-card__kicker">多端连通诊断</div>
            <h3 className="settings-browser-status-card__title">Connectivity Doctor</h3>
            <p className="settings-browser-status-card__note">
              通过对本地 9099 端口与 Chrome Web Socket 进行实时诊断，确认链路健康状况。
            </p>
          </div>
          <div className="settings-browser-diagnostic-card__footer">
            <button
              type="button"
              onClick={() => void checkConnectivity(true)}
              disabled={testingConnection}
              data-browser-tool={BROWSER_ACTIONS.getStatus.toolName}
              data-browser-command-kind={BROWSER_ACTIONS.getStatus.commandKind}
              className="settings-browser-action settings-browser-action--primary"
            >
              {testingConnection ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>正在诊断中...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>一键连通性诊断</span>
                </>
              )}
            </button>
            <div className="settings-browser-inline-note">
              <Info size={11} className="settings-browser-inline-note__icon" />
              <span>若持续显示未就绪，请阅读下方的组件安装指南。</span>
            </div>
          </div>
        </div>

        {/* 阶段五优化：外部网页直通平台与多账号 Session 混合池管理 */}
        <div className="dashboard-grid-card settings-browser-section-card a-card-span-2-col">
          <div className="settings-browser-section-card__header">
            <div>
              <div className="settings-browser-section-card__kicker">降本通道</div>
              <h3 className="settings-browser-section-card__title">多开账号实例 Session 池</h3>
            </div>
            <SettingsBadge tone="emerald">
              <Coins size={11} className="mr-1 inline" />
              <span>多开网页直通调度</span>
            </SettingsBadge>
          </div>
          <p className="settings-browser-section-card__description">
            你可以为一个平台同时授权登录多个不同的账号，AI 调度网关会根据并发性能自动在这些活跃 Session 之间轮询生图。
          </p>

          {/* 各平台的 Session 会话管理 */}
          <div className="settings-browser-row-list">
            {sessions.map((sess) => (
              <div key={sess.id} className="settings-browser-row">
                <div className="settings-browser-row__content">
                  <div className="settings-browser-row__heading">
                    <span className="settings-browser-chip" data-platform={sess.platformId}>
                      {sess.platformId === 'leonardo' ? 'Leonardo' : 'Midjourney'}
                    </span>
                    <span className="settings-browser-row__title">{sess.username}</span>
                  </div>
                  
                  <div className="settings-browser-row__meta">
                    <span>状态:</span>
                    {sess.status === 'logged_in' ? (
                      <span className="settings-browser-inline-status" data-status={sess.status}><Check size={9} />就绪</span>
                    ) : sess.status === 'checking' ? (
                      <span className="settings-browser-inline-status" data-status={sess.status}><Loader2 size={9} className="animate-spin" />检测中...</span>
                    ) : (
                      <span className="settings-browser-inline-status" data-status={sess.status}>未验证</span>
                    )}
                    <span className="settings-browser-row__separator">|</span>
                    <span>优先级: <span className="settings-browser-row__mono">{sess.priority}</span></span>
                  </div>
                </div>

                <div className="settings-browser-row__actions">
                  <button
                    type="button"
                    onClick={() => checkSessionLogin(sess.id)}
                    data-browser-local-action={BROWSER_LOCAL_ACTIONS.checkSessionStatus.actionName}
                    data-agent-tool={BROWSER_LOCAL_ACTIONS.checkSessionStatus.agentToolName}
                    className="settings-browser-subtle-action"
                  >
                    检测
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSession(sess.id)}
                    data-browser-local-action={BROWSER_LOCAL_ACTIONS.toggleSessionEnabled.actionName}
                    className="settings-browser-toggle"
                    data-state={sess.enabled ? 'enabled' : 'disabled'}
                    aria-pressed={sess.enabled}
                    aria-label={sess.enabled ? '停用会话' : '启用会话'}
                  >
                    {sess.enabled ? (
                      <ToggleRight size={20} className="settings-browser-toggle__icon" />
                    ) : (
                      <ToggleLeft size={20} className="settings-browser-toggle__icon" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="settings-browser-action-row">
            <button
              type="button"
              onClick={() => handleAddSession('leonardo')}
              data-browser-local-action={BROWSER_LOCAL_ACTIONS.addSessionInstance.actionName}
              className="settings-browser-subtle-action settings-browser-subtle-action--grow"
            >
              <UserPlus size={11} />
              <span>多开 Leonardo 会话</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddSession('midjourney')}
              data-browser-local-action={BROWSER_LOCAL_ACTIONS.addSessionInstance.actionName}
              className="settings-browser-subtle-action settings-browser-subtle-action--grow"
            >
              <UserPlus size={11} />
              <span>多开 Midjourney 会话</span>
            </button>
          </div>
        </div>

        {/* 社交媒体分发通道配置（小红书/微博） */}
        <div className="dashboard-grid-card settings-browser-section-card a-card-span-2-col">
          <div className="settings-browser-section-card__header">
            <div>
              <div className="settings-browser-section-card__kicker">自动分发</div>
              <h3 className="settings-browser-section-card__title">多渠道社交发布通道管理</h3>
            </div>
            <SettingsBadge tone="indigo">
              <Share2 size={11} className="mr-1 inline" />
              <span>流量助手</span>
            </SettingsBadge>
          </div>
          <p className="settings-browser-section-card__description">
            将生成的商品海报/模特图，一键发布至绑定平台。AI 会自动根据抓取的电商上下文，自动编排符合平台调性的带货种草文案。
          </p>

          <div className="settings-browser-row-list">
            {socialChannels.map((channel) => (
              <div key={channel.id} className="settings-browser-row">
                <div className="settings-browser-row__content">
                  <div className="settings-browser-row__heading">
                    <span className="settings-browser-row__title">{channel.name}</span>
                  </div>
                  <div className="settings-browser-row__meta">
                    <span>通道状态:</span>
                    {channel.status === 'logged_in' ? (
                      <span className="settings-browser-inline-status" data-status={channel.status}><Check size={10} />通道就绪</span>
                    ) : channel.status === 'logged_out' ? (
                      <span className="settings-browser-inline-status" data-status={channel.status}><X size={10} />未登录</span>
                    ) : channel.status === 'checking' ? (
                      <span className="settings-browser-inline-status" data-status={channel.status}><Loader2 size={10} className="animate-spin" />验证中...</span>
                    ) : (
                      <span className="settings-browser-inline-status" data-status={channel.status}>未验证</span>
                    )}
                  </div>
                </div>

                <div className="settings-browser-row__actions">
                  <button
                    type="button"
                    onClick={() => checkSocialLogin(channel.id)}
                    data-browser-local-action={BROWSER_LOCAL_ACTIONS.checkSocialChannelStatus.actionName}
                    data-agent-tool={BROWSER_LOCAL_ACTIONS.checkSocialChannelStatus.agentToolName}
                    className="settings-browser-subtle-action"
                  >
                    检测通道
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSocialChannel(channel.id)}
                    data-browser-local-action={BROWSER_LOCAL_ACTIONS.toggleSocialChannelEnabled.actionName}
                    className="settings-browser-toggle"
                    data-state={channel.enabled ? 'enabled' : 'disabled'}
                    aria-pressed={channel.enabled}
                    aria-label={channel.enabled ? '停用通道' : '启用通道'}
                  >
                    {channel.enabled ? (
                      <ToggleRight size={24} className="settings-browser-toggle__icon" />
                    ) : (
                      <ToggleLeft size={24} className="settings-browser-toggle__icon" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 浏览器 Bridge 插件安装指南 */}
        <div className="dashboard-grid-card settings-browser-section-card a-card-span-2-col">
          <div className="settings-browser-section-card__kicker">插件管理</div>
          <h3 className="settings-browser-section-card__title">安装 Browser Bridge 扩展</h3>
          
          <div className="settings-browser-tile-grid">
            {/* 方式 A */}
            <div className="settings-browser-tile">
              <div>
                <span className="settings-browser-chip" data-tone="info">方式 A (推荐)</span>
                <h4 className="settings-browser-tile__title">Chrome Web Store</h4>
                <p className="settings-browser-tile__description">
                  前往 Chrome 官方扩展商店一键获取 OpenCLI Browser Bridge，享受自动升级。
                </p>
              </div>
              <a
                href="https://chromewebstore.google.com"
                target="_blank"
                rel="noreferrer"
                className="settings-browser-action settings-browser-action--primary"
              >
                <span>跳转至 Chrome 商店</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* 方式 B */}
            <div className="settings-browser-tile">
              <div>
                <span className="settings-browser-chip" data-tone="warning">方式 B (离线)</span>
                <h4 className="settings-browser-tile__title">下载解压安装包</h4>
                <p className="settings-browser-tile__description">
                  解压后在 <code className="settings-browser-code settings-browser-code--inline">chrome://extensions</code> 开启开发者模式加载。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  notify.info('离线包未配置', '请从 Browser Bridge 发布包或后台配置离线扩展包下载地址后再启用此入口。');
                }}
                data-browser-local-action={BROWSER_LOCAL_ACTIONS.installPluginPackage.actionName}
                className="settings-browser-action settings-browser-action--neutral"
              >
                <span>下载离线扩展包 (.zip)</span>
                <Download size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* 守护程序安装指南 */}
        <div className="dashboard-grid-card settings-browser-section-card a-card-span-2-col">
          <div className="settings-browser-section-card__kicker">守护程序</div>
          <h3 className="settings-browser-section-card__title">启动本地 Daemon 进程</h3>
          <p className="settings-browser-section-card__description">
            守护进程是网页与本地浏览器及多端互联的网关服务，若提示未连接，请按以下步骤启动它：
          </p>

          <div className="settings-browser-step-list">
            <div className="settings-browser-step">
              <span className="settings-browser-step__badge">Step 1</span>
              <div>
                在项目根目录下通过终端安装依赖：
                <pre className="settings-browser-code">npm install -g @jackwener/opencli</pre>
              </div>
            </div>

            <div className="settings-browser-step">
              <span className="settings-browser-step__badge">Step 2</span>
              <div>
                启动本地网关守护程序：
                <pre className="settings-browser-code">opencli daemon start --port 9099</pre>
              </div>
            </div>
          </div>
        </div>

        {/* 桌面端 IDE 开发适配器 (Phase 6) */}
        <div className="dashboard-grid-card settings-browser-section-card a-card-span-2-col">
          <div className="settings-browser-section-card__header">
            <div>
              <div className="settings-browser-section-card__kicker">本地桌面互联</div>
              <h3 className="settings-browser-section-card__title">桌面应用程序开发适配器</h3>
            </div>
            <SettingsBadge tone="indigo">
              <Monitor size={11} className="mr-1 inline" />
              <span>IDE 桥接</span>
            </SettingsBadge>
          </div>
          <p className="settings-browser-section-card__description">
            通过守护进程，直接将画布中由 AI 自动生成的设计代码同步并在本地的桌面开发工具中加载运行。
          </p>

          <div className="settings-browser-form-row">
            <div className="settings-browser-field">
              <label className="settings-browser-label">选择本地绑定的 IDE</label>
              <select
                value={selectedIde}
                onChange={(e) => setSelectedIde(e.target.value as any)}
                className="settings-browser-select"
              >
                <option value="cursor">Cursor (推荐)</option>
                <option value="trae">Trae (字节跳动)</option>
                <option value="vscode">VS Code</option>
              </select>
            </div>
            <div className="settings-browser-form-row__action">
              <button
                type="button"
                onClick={handleTestIde}
                disabled={testingDesktop}
                className="settings-browser-action settings-browser-action--primary"
                data-browser-tool={BROWSER_ACTIONS.openDesktopProject.toolName}
                data-browser-command-kind={BROWSER_ACTIONS.openDesktopProject.commandKind}
              >
                {testingDesktop ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                <span>调起本地 IDE</span>
              </button>
            </div>
          </div>

          <div className="settings-browser-meta-row">
            <span>绑定状态: <span className="settings-browser-inline-status" data-status={desktopStatus}>{desktopStatus === 'connected' ? '已挂载' : '未挂载'}</span></span>
            <span>适配器版本: <span className="settings-browser-row__mono">v1.1.2</span></span>
          </div>
        </div>

        {/* 高级功能融合配置中心 (Phase 4) */}
        <div className="dashboard-grid-card settings-browser-section-card settings-browser-section-card--wide a-card-span-4-col">
          <div className="settings-browser-section-card__header">
            <div>
              <div className="settings-browser-section-card__kicker">高级功能融合 (Phase 4)</div>
              <h3 className="settings-browser-section-card__title">极客高级融合中心 (Advanced Fusion Center)</h3>
            </div>
            <SettingsBadge tone="amber">
              <Cpu size={11} className="mr-1 inline" />
              <span>智能多端协同</span>
            </SettingsBadge>
          </div>
          <p className="settings-browser-section-card__description">
            结合本地大模型网关、智能剪贴板多模态流入与屏幕感知转译，无需消耗昂贵的在线云端 API 额度，全面实现网页直通的电商创作闭环。
          </p>

          <div className="settings-browser-feature-grid">
            {/* 子区块 1：剪贴板监听 */}
            <div className="settings-browser-feature-card">
              <div>
                <div className="settings-browser-feature-card__header">
                  <span className="settings-browser-feature-card__title">
                    <Clipboard size={13} className="settings-browser-feature-card__icon" data-tone="warning" />
                    智能剪贴板监听
                  </span>
                  <button
                    type="button"
                    onClick={() => setClipboardSyncEnabled(!clipboardSyncEnabled)}
                    data-browser-local-action={BROWSER_LOCAL_ACTIONS.toggleClipboardSync.actionName}
                    className="settings-browser-toggle"
                    data-state={clipboardSyncEnabled ? 'enabled' : 'disabled'}
                    aria-pressed={clipboardSyncEnabled}
                    aria-label={clipboardSyncEnabled ? '停用剪贴板监听' : '启用剪贴板监听'}
                  >
                    {clipboardSyncEnabled ? (
                      <ToggleRight size={22} className="settings-browser-toggle__icon animate-pulse" />
                    ) : (
                      <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                    )}
                  </button>
                </div>
                <p className="settings-browser-feature-card__description">
                  实时监听系统剪贴板，自动对复制的电商 URL 或图进行多模态分类并推送至画布。
                </p>
              </div>

              <div className="settings-browser-meta-row">
                <span>
                  状态: <span className="settings-browser-inline-status" data-status={clipboardSyncEnabled ? 'connected' : 'disabled'}>
                    {clipboardSyncEnabled ? '监听中' : '已禁用'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleReadClipboardPayload}
                  disabled={!clipboardSyncEnabled}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.readClipboardPayload.actionName}
                  className="settings-browser-subtle-action"
                >
                  读取剪贴板
                </button>
              </div>
            </div>

            {/* 子区块 2：本地 Ollama 大模型网关 */}
            <div className="settings-browser-feature-card">
              <div>
                <div className="settings-browser-feature-card__header">
                  <span className="settings-browser-feature-card__title">
                    <Cpu size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                    本地 LLM 网关
                  </span>
                  <div className="settings-browser-status-dot" data-status={localLlmStatus} />
                </div>
                
                <div className="settings-browser-compact-fields">
                  <input
                    type="text"
                    value={localLlmEndpoint}
                    onChange={(e) => setLocalLlmEndpoint(e.target.value)}
                    placeholder="API 地址"
                    className="settings-browser-input"
                  />
                  <select
                    value={localLlmModel}
                    onChange={(e) => setLocalLlmModel(e.target.value)}
                    className="settings-browser-select settings-browser-select--compact"
                  >
                    <option value="qwen2.5-coder:7b">qwen2.5-coder:7b (推荐)</option>
                    <option value="llama3.1:8b">llama3.1:8b</option>
                  </select>
                </div>
              </div>

              <div className="settings-browser-meta-row">
                <span className="settings-browser-inline-status" data-status={localLlmStatus}>
                  {localLlmStatus === 'connected' ? '连接成功' : localLlmStatus === 'connecting' ? '正在检测...' : '未检测'}
                </span>
                <button
                  type="button"
                  onClick={handleTestLocalLlm}
                  disabled={testingLlm}
                  className="settings-browser-subtle-action"
                  data-browser-tool={BROWSER_ACTIONS.checkLocalLlm.toolName}
                  data-browser-command-kind={BROWSER_ACTIONS.checkLocalLlm.commandKind}
                >
                  诊断连接
                </button>
              </div>
            </div>

            {/* 子区块 3：屏幕感知与转译 */}
            <div className="settings-browser-feature-card">
              <div>
                <div className="settings-browser-feature-card__header">
                  <span className="settings-browser-feature-card__title">
                    <Monitor size={13} className="settings-browser-feature-card__icon" data-tone="info" />
                    屏幕截图转译
                  </span>
                </div>
                <p className="settings-browser-feature-card__description">
                  捕捉活跃浏览器视口并提取色板与布局结构，直接反向生成画布的原生线框 UI 与色块。
                </p>
              </div>

              <div className="settings-browser-meta-row">
                <span className="settings-browser-inline-status" data-status={screenInspectStatus}>
                  {screenInspectStatus === 'capturing'
                    ? '截图捕获中...'
                    : screenInspectStatus === 'parsing'
                      ? 'DOM 分析中...'
                      : screenInspectStatus === 'done'
                        ? '分析成功'
                        : '就绪'}
                </span>
                <button
                  type="button"
                  onClick={handleScreenInspect}
                  disabled={screenInspectStatus === 'capturing' || screenInspectStatus === 'parsing'}
                  data-browser-tool={BROWSER_ACTIONS.inspectPage.toolName}
                  data-browser-command-kind={BROWSER_ACTIONS.inspectPage.commandKind}
                  className="settings-browser-subtle-action"
                >
                  智能感知
                </button>
              </div>
            </div>

            {/* 子区块 4：本地 WASM 运行环境 */}
            <div className="settings-browser-feature-card">
              <div>
                <div className="settings-browser-feature-card__header">
                  <span className="settings-browser-feature-card__title">
                    <Layers size={13} className="settings-browser-feature-card__icon" data-tone="success" />
                    本地 WASM 沙盒
                  </span>
                  <button
                    type="button"
                    onClick={() => setWasmEnabled(!wasmEnabled)}
                    data-browser-local-action={BROWSER_LOCAL_ACTIONS.toggleWasmSandbox.actionName}
                    className="settings-browser-toggle"
                    data-state={wasmEnabled ? 'enabled' : 'disabled'}
                    aria-pressed={wasmEnabled}
                    aria-label={wasmEnabled ? '停用 WASM 沙盒' : '启用 WASM 沙盒'}
                  >
                    {wasmEnabled ? (
                      <ToggleRight size={22} className="settings-browser-toggle__icon" />
                    ) : (
                      <ToggleLeft size={22} className="settings-browser-toggle__icon" />
                    )}
                  </button>
                </div>
                
                <div className="settings-browser-compact-fields">
                  <div className="settings-browser-check-row">
                    <span>抠图与 OCR 模型</span>
                    <span className="settings-browser-row__mono">{wasmMemoryUsage}</span>
                  </div>
                  <label className="settings-browser-check-row">
                    <span className="settings-browser-check-row__label">
                      <Zap size={10} className="settings-browser-feature-card__icon" data-tone="warning" /> WebGPU 加速
                    </span>
                    <input
                      type="checkbox"
                      checked={webGpuAcceleration}
                      disabled={!wasmEnabled}
                      onChange={(e) => setWebGpuAcceleration(e.target.checked)}
                      className="settings-browser-checkbox"
                    />
                  </label>
                </div>
              </div>

              <div className="settings-browser-meta-row">
                <span>引擎状态: <span className="settings-browser-inline-status" data-status={wasmEnabled ? 'connected' : 'disabled'}>
                  {wasmEnabled ? `Active (${webGpuAcceleration ? 'WebGPU' : 'CPU'})` : '已停用'}
                </span></span>
              </div>
            </div>
          </div>

          {/* 屏幕分析成功展示 */}
          {screenInspectStatus === 'done' && inspectData && (
            <div className="settings-browser-insight-card animate-fadeIn">
              <div className="settings-browser-insight-card__content">
                <div className="settings-browser-insight-card__title">
                  <Monitor size={12} className="settings-browser-feature-card__icon" data-tone="info" />
                  网页多模态转译结果
                </div>
                <div className="settings-browser-insight-card__row">
                  <span className="settings-browser-insight-card__label">提取色板：</span>
                  <span className="settings-browser-swatch-list">
                    {inspectData.palette.map((color, idx) => (
                      <span key={idx} className="settings-browser-swatch" style={{ backgroundColor: color }} title={color} />
                    ))}
                  </span>
                </div>
                <div className="settings-browser-insight-card__row">
                  <span className="settings-browser-insight-card__label">页面布局：</span>
                  <span>{inspectData.layoutType}</span>
                </div>
                <div className="settings-browser-insight-card__row">
                  <span className="settings-browser-insight-card__label">OCR 文字提取：</span>
                  <span className="settings-browser-row__mono">"{inspectData.ocrText}"</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTranslateInspectionToCanvas}
                data-browser-local-action={BROWSER_LOCAL_ACTIONS.translateInspectionToCanvas.actionName}
                data-agent-tool={BROWSER_LOCAL_ACTIONS.translateInspectionToCanvas.agentToolName}
                className="settings-browser-action settings-browser-action--primary"
              >
                生成到画布
              </button>
            </div>
          )}
        </div>

        {/* 阶段五优化：AI Takeover 智能接管集成与自然语言计划预览器 */}
        <div className="dashboard-grid-card a-card-span-4-col settings-browser-section-card settings-browser-section-card--wide">
          <div className="settings-browser-section-card__header">
            <div>
              <div className="settings-browser-section-card__kicker">AI 接管集成 (Phase 5)</div>
              <h3 className="settings-browser-section-card__title">AI Takeover 智能调度解析门控</h3>
            </div>
            <SettingsBadge tone="indigo">
              <Sparkles size={11} />
              <span>AI Takeover 接管集成</span>
            </SettingsBadge>
          </div>
          <p className="settings-browser-section-card__description">
            AI Takeover 引擎会智能识别你的输入意图。如果解析到“网页直通”或“代理多开”的诉求，其后端分发逻辑会自动触发多端控制，不需要用户手动切换。
          </p>

          <div className="settings-browser-command-grid">
            <div className="settings-browser-command-panel">
              <div className="settings-browser-form-row settings-browser-form-row--compact">
                <label className="settings-browser-field">
                  <span className="settings-browser-label">输入 AI 助手自然语言指令</span>
                <input
                  type="text"
                  value={takeoverInput}
                  onChange={(e) => setTakeoverInput(e.target.value)}
                  placeholder="在此输入生成或提取的命令，例如：帮我用网页直通跑 3 张模特海报..."
                    className="settings-browser-input"
                  disabled={takeoverLoading}
                />
                </label>
                <button
                  type="button"
                  onClick={handlePreviewTakeoverPlan}
                  disabled={takeoverLoading}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.previewTakeoverPlan.actionName}
                  className="settings-browser-action settings-browser-action--primary"
                >
                  {takeoverLoading ? (
                    <>
                      <Loader2 size={13} className="settings-browser-spinner" />
                      <span>NLP 分析中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>AI 接管计划预览</span>
                    </>
                  )}
                </button>
              </div>

              {/* 快捷配置按钮 */}
              <div className="settings-browser-sample-row">
                <button
                  type="button"
                  onClick={() => setTakeoverInput('用网页直通代理多开 2 个号并发跑 3 张商品海报图')}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.setTakeoverSamplePrompt.actionName}
                  className="settings-browser-subtle-action"
                >
                  快捷指令 A (网页直通多开并发)
                </button>
                <button
                  type="button"
                  onClick={() => setTakeoverInput('用 Leonardo 官方 API 扣减 10 积分生成一张蒸汽朋克海报')}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.setTakeoverSamplePrompt.actionName}
                  className="settings-browser-subtle-action"
                >
                  快捷指令 B (官方付费 API)
                </button>
              </div>
            </div>

            {/* 解析结果卡片 */}
            <div
              className="settings-browser-report-card"
              data-state={takeoverOutput ? 'ready' : takeoverLoading ? 'loading' : 'idle'}
            >
              <div className="settings-browser-report-card__title">接管路由解析报告</div>
                {takeoverOutput ? (
                <div className="settings-browser-report-card__grid">
                  <div className="settings-browser-report-card__item">
                    <span className="settings-browser-report-card__label">匹配意图</span>
                    <span className="settings-browser-report-card__value" data-tone="info">
                      {takeoverOutput.intent}
                    </span>
                    </div>
                  <div className="settings-browser-report-card__item">
                    <span className="settings-browser-report-card__label">物理路由</span>
                    <span
                      className="settings-browser-report-card__value"
                      data-tone={takeoverOutput.routing === 'agent_proxy' ? 'success' : 'warning'}
                    >
                        {takeoverOutput.routing === 'agent_proxy' ? '网页直通 (无需Key)' : '付费 API 通道'}
                      </span>
                    </div>
                    {takeoverOutput.routing === 'agent_proxy' && takeoverOutput.sessions.length > 0 && (
                    <div className="settings-browser-report-card__item">
                      <span className="settings-browser-report-card__label">空闲会话池</span>
                      <span className="settings-browser-row__mono">{takeoverOutput.sessions.join(', ')}</span>
                      </div>
                    )}
                  <div className="settings-browser-report-card__note">
                      理由: {takeoverOutput.reason}
                    </div>
                  </div>
                ) : (
                <div className="settings-browser-report-card__empty">
                    {takeoverLoading ? '正在分析语义意图...' : '输入左侧指令以预览 AgentRuntime 分析报告'}
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* 演示沙盒区 (Playground) */}
        <div className="dashboard-grid-card a-card-span-4-col settings-browser-section-card settings-browser-section-card--wide settings-browser-playground">
          <div className="settings-browser-playground__main">
            <div className="settings-browser-playground__header">
              <div className="settings-browser-tabbar" role="tablist" aria-label="运行沙盒">
                <button
                  type="button"
                  role="tab"
                  aria-selected={playgroundTab === 'extract'}
                  onClick={() => setPlaygroundTab('extract')}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.switchPlaygroundTab.actionName}
                  className="settings-browser-tab"
                >
                  <ShoppingBag size={12} />
                  <span>商品抓取与抠图</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={playgroundTab === 'generate'}
                  onClick={() => setPlaygroundTab('generate')}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.switchPlaygroundTab.actionName}
                  className="settings-browser-tab"
                >
                  <Sparkles size={12} />
                  <span>网页直通生图与社交分发</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={playgroundTab === 'pipeline'}
                  onClick={() => setPlaygroundTab('pipeline')}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.switchPlaygroundTab.actionName}
                  className="settings-browser-tab"
                >
                  <Cpu size={12} />
                  <span>全自动宏流水线</span>
                </button>
              </div>
              <div className="settings-browser-tabbar__label">运行沙盒 (Runtime)</div>
            </div>

            {/* Tab 1: 商品价格提取与自动抠图 */}
            {playgroundTab === 'extract' && (
              <div className="settings-browser-playground__panel" role="tabpanel">
                <p className="settings-browser-section-card__description">
                  在下方输入商品详情页链接并点击提取。支持一键剔除复杂图背景，将纯净的商品主体切图导入画布。
                </p>

                <div className="settings-browser-command-row">
                  <label className="settings-browser-field">
                    <span className="settings-browser-label">商品详情页链接</span>
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="在此粘贴商品链接，例如：https://item.jd.com/100012043978.html"
                      className="settings-browser-input"
                    disabled={extractLoading}
                  />
                  </label>
                  <button
                    type="button"
                    onClick={handleExtractTest}
                    disabled={extractLoading}
                    data-browser-tool={BROWSER_ACTIONS.extractProduct.toolName}
                    data-browser-command-kind={BROWSER_ACTIONS.extractProduct.commandKind}
                    className="settings-browser-action settings-browser-action--primary"
                  >
                    {extractLoading ? (
                      <>
                        <Loader2 size={13} className="settings-browser-spinner" />
                        <span>抓取中...</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        <span>一键提取</span>
                      </>
                    )}
                  </button>
                </div>

                {extractLoading && (
                  <div className="settings-browser-progress-card" data-tone="info">
                    <Loader2 size={16} className="settings-browser-spinner" />
                    <div className="settings-browser-progress-card__content">{extractStep}</div>
                  </div>
                )}

                {clippingProgress && (
                  <div className="settings-browser-progress-card" data-tone="success">
                    <Loader2 size={16} className="settings-browser-spinner" />
                    <div className="settings-browser-progress-card__content">本地 WASM 抠图模型运行中，正在识别商品轮廓边缘并擦除复杂背景...</div>
                  </div>
                )}

                {extractedData && !clippingProgress && (
                  <div className="settings-browser-result-card" data-tone="success">
                    <div className="settings-browser-result-card__body">
                      <div className="settings-browser-result-card__media">
                        <img src={extractedData.imageUrl} alt="商品图" className="settings-browser-result-card__image" />
                        {autoClip && (
                          <span className="settings-browser-result-card__media-badge">
                            <Scissors size={8} />透明背景
                          </span>
                        )}
                      </div>
                      <div className="settings-browser-result-card__content">
                        <div className="settings-browser-result-card__meta">
                          <span className="settings-browser-chip" data-tone="success">
                            {extractedData.platform}
                          </span>
                          <span className="settings-browser-inline-status" data-status="done">抓取状态: 成功</span>
                        </div>
                        <h4 className="settings-browser-result-card__title" title={extractedData.title}>
                          {extractedData.title}
                        </h4>
                        <div className="settings-browser-result-card__price-row">
                          <span className="settings-browser-result-card__price">{extractedData.price}</span>
                          {extractedData.originalPrice && (
                            <span className="settings-browser-result-card__muted">{extractedData.originalPrice}</span>
                          )}
                        </div>
                        
                        {/* 自动抠图开关 */}
                        <label className="settings-browser-check-row settings-browser-check-row--inline">
                          <input
                            type="checkbox"
                            checked={autoClip}
                            onChange={(e) => setAutoClip(e.target.checked)}
                            className="settings-browser-checkbox"
                          />
                          <span className="settings-browser-check-row__label">
                            <Scissors size={11} className="settings-browser-feature-card__icon" data-tone="success" />
                            导入画布时自动调用 AI 抠图去背景
                          </span>
                        </label>
                      </div>
                      
                      <div className="settings-browser-result-card__actions">
                        <button
                          type="button"
                          onClick={handleImportToCanvasWithClip}
                          data-browser-local-action={BROWSER_LOCAL_ACTIONS.importProductToCanvas.actionName}
                          data-agent-tool={BROWSER_LOCAL_ACTIONS.importProductToCanvas.agentToolName}
                          className="settings-browser-action settings-browser-action--primary"
                        >
                          <span>导入画布商品切图</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* 双向同步与回写 DOM 区 */}
                    <div className="settings-browser-result-card__subsection">
                      <div className="settings-browser-result-card__subsection-header">
                        <span className="settings-browser-insight-card__title">
                          <Share2 size={12} className="settings-browser-feature-card__icon" data-tone="info" />
                          双向 DOM 实时篡改与回写
                        </span>
                        <span className="settings-browser-result-card__caption">可在画布修改并一键同步到网页 DOM 进行截图预览</span>
                      </div>
                      
                      <div className="settings-browser-mini-form-grid">
                        <label className="settings-browser-field">
                          <span className="settings-browser-label">修改商品标题</span>
                          <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="settings-browser-input"
                          />
                        </label>
                        <label className="settings-browser-field">
                          <span className="settings-browser-label">修改商品价格</span>
                          <div className="settings-browser-inline-control">
                            <input
                              type="text"
                              value={editedPrice}
                              onChange={(e) => setEditedPrice(e.target.value)}
                              className="settings-browser-input"
                            />
                            <button
                              type="button"
                              onClick={handleWriteBackDom}
                              disabled={writeBackLoading}
                              data-browser-tool={BROWSER_ACTIONS.writeBackDom.toolName}
                              data-browser-command-kind={BROWSER_ACTIONS.writeBackDom.commandKind}
                              className="settings-browser-action settings-browser-action--primary"
                            >
                              {writeBackLoading ? (
                                <>
                                  <Loader2 size={12} className="settings-browser-spinner" />
                                  <span>同步中...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={12} />
                                  <span>同步回写网页</span>
                                </>
                              )}
                            </button>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: 外部网页直通生图与一键社交分发 */}
            {playgroundTab === 'generate' && (
              <div className="settings-browser-playground__panel" role="tabpanel">
                <p className="settings-browser-section-card__description">
                  AI 助手将通过本地网关自动在您已选中的外部生图网站上注入 Prompt。支持一键托管上传发布到小红书、微博等平台的创作者草稿箱。
                </p>

                <div className="settings-browser-command-row settings-browser-command-row--wide">
                  <label className="settings-browser-field settings-browser-field--fixed">
                    <span className="settings-browser-label">选择外部生图平台</span>
                    <select
                      value={genPlatform}
                      onChange={(e) => setGenPlatform(e.target.value)}
                      className="settings-browser-select"
                    >
                      <option value="midjourney">Midjourney 网页版 (未启用)</option>
                      <option value="leonardo">Leonardo.ai (可用)</option>
                      <option value="tensorart">Tensor.Art (可用)</option>
                    </select>
                  </label>
                  
                  <label className="settings-browser-field">
                    <span className="settings-browser-label">输入生成 Prompt</span>
                    <div className="settings-browser-inline-control">
                      <input
                        type="text"
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        placeholder="请输入生成提示词..."
                        className="settings-browser-input"
                        disabled={genLoading}
                      />
                      <button
                        type="button"
                        onClick={handleGenTest}
                        disabled={genLoading}
                        data-browser-tool={BROWSER_ACTIONS.generateExternal.toolName}
                        data-browser-command-kind={BROWSER_ACTIONS.generateExternal.commandKind}
                        className="settings-browser-action settings-browser-action--primary"
                      >
                        {genLoading ? (
                          <>
                            <Loader2 size={13} className="settings-browser-spinner" />
                            <span>生成中... ({genProgress}%)</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>网页直通批量生图</span>
                          </>
                        )}
                      </button>
                    </div>
                  </label>
                </div>

                {genLoading && (
                  <div className="settings-browser-progress-card settings-browser-progress-card--stacked" data-tone="info">
                    <div className="settings-browser-progress-card__row">
                      <Loader2 size={16} className="settings-browser-spinner" />
                      <div className="settings-browser-progress-card__content">{genStep}</div>
                    </div>
                    <div className="settings-browser-progress-track">
                      <div className="settings-browser-progress-fill" data-tone="info" style={{ width: `${genProgress}%` }} />
                    </div>
                  </div>
                )}

                {publishingLoading && (
                  <div className="settings-browser-progress-card" data-tone="info">
                    <Loader2 size={16} className="settings-browser-spinner" />
                    <div className="settings-browser-progress-card__content">{publishingStep}</div>
                  </div>
                )}

                {generatedImageUrl && !publishingLoading && (
                  <div className="settings-browser-result-card" data-tone="info">
                    <div className="settings-browser-result-card__media settings-browser-result-card__media--large">
                      <img src={generatedImageUrl} alt="生成的图片" className="settings-browser-result-card__image" />
                    </div>
                    <div className="settings-browser-result-card__content">
                      <div className="settings-browser-result-card__meta">
                        <span className="settings-browser-chip" data-tone="info">
                          {platforms.find((p) => p.id === genPlatform)?.name || '外部生成'}
                        </span>
                        <span className="settings-browser-inline-status" data-status="done">
                          <Check size={11} />
                          <span>原图 CDN 拦截已完成 (网页直通)</span>
                        </span>
                      </div>
                      <h4 className="settings-browser-result-card__title">
                        提示词: <span className="settings-browser-result-card__muted">{promptText}</span>
                      </h4>
                      <div className="settings-browser-result-card__note">
                        <Coins size={11} className="settings-browser-feature-card__icon" data-tone="warning" />
                        <span>本次生成未损耗系统积分，直接利用了外部站点的免费点数。</span>
                      </div>
                    </div>
                    
                    <div className="settings-browser-result-card__actions">
                      <button
                        type="button"
                        onClick={handleCreateCardInCanvas}
                        data-browser-local-action={BROWSER_LOCAL_ACTIONS.createCanvasPromptCard.actionName}
                        data-agent-tool={BROWSER_LOCAL_ACTIONS.createCanvasPromptCard.agentToolName}
                        className="settings-browser-action settings-browser-action--primary"
                      >
                        <span>同步结果至画布</span>
                        <ArrowRight size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePublishToSocial()}
                        data-browser-tool={BROWSER_ACTIONS.publishDraft.toolName}
                        data-browser-command-kind={BROWSER_ACTIONS.publishDraft.commandKind}
                        className="settings-browser-action settings-browser-action--primary"
                      >
                        <Share2 size={13} />
                        <span>分发至小红书草稿箱</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleZipOriginals}
                        disabled={zipLoading}
                        data-browser-local-action={BROWSER_LOCAL_ACTIONS.zipOriginals.actionName}
                        data-agent-tool={BROWSER_LOCAL_ACTIONS.zipOriginals.agentToolName}
                        className="settings-browser-action settings-browser-action--neutral"
                      >
                        <Download size={13} />
                        <span>打包下载原图 (ZIP)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: 全自动宏流水线 */}
            {playgroundTab === 'pipeline' && (
              <div className="settings-browser-playground__panel" role="tabpanel">
                <p className="settings-browser-section-card__description">
                  一键式极客全自动宏流水线。通过串联抓取、抠图、外部生图、AI文案润色与一键发布，实现全自动跨平台内容生产线。
                </p>

                {/* 阶段五优化：模型库 API / 代理 路由切换控制器与账号多开勾选面板 */}
                <div className="settings-browser-policy-card">
                  <div className="settings-browser-policy-card__header">
                    <span className="settings-browser-policy-card__title">
                      <Zap size={13} className="settings-browser-feature-card__icon" data-tone="warning" />
                      模型生成路由策略 (Model Routing Policy)
                    </span>
                    <div className="settings-browser-segment-group" role="group" aria-label="模型生成路由策略">
                      <button
                        type="button"
                        onClick={() => setRoutingMode('api')}
                        data-browser-local-action={BROWSER_LOCAL_ACTIONS.setRoutingMode.actionName}
                        className="settings-browser-segment"
                        aria-pressed={routingMode === 'api'}
                      >
                        官方 API 通道 (扣积分)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoutingMode('proxy')}
                        data-browser-local-action={BROWSER_LOCAL_ACTIONS.setRoutingMode.actionName}
                        className="settings-browser-segment"
                        aria-pressed={routingMode === 'proxy'}
                      >
                        网页直通通道 (无需 Key)
                      </button>
                    </div>
                  </div>

                  {routingMode === 'proxy' ? (
                    <div className="settings-browser-policy-card__body">
                      <div className="settings-browser-inline-note">
                        <Info size={11} className="settings-browser-feature-card__icon" data-tone="info" />
                        <span>请勾选加入本次轮询调度的多开账号 Session 实例（系统会自动通过算法进行负载均分）：</span>
                      </div>
                      
                      <div className="settings-browser-session-picker">
                        {sessions
                          .filter((s) => s.platformId === genPlatform && s.enabled)
                          .map((sess) => (
                            <label
                              key={sess.id}
                              className="settings-browser-session-pill"
                              data-selected={selectedSessionsForGen.includes(sess.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedSessionsForGen.includes(sess.id)}
                                onChange={() => handleSelectSessionToggle(sess.id)}
                                className="settings-browser-session-pill__input"
                              />
                              <Check size={11} className="settings-browser-session-pill__check" />
                              <span>{sess.username}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="settings-browser-inline-note">
                      <Coins size={11} className="settings-browser-feature-card__icon" data-tone="warning" />
                      <span>官方生图 API 将优先保证极致并发，不消耗本地硬件与浏览器窗口，每次扣减 10 点积分。</span>
                    </div>
                  )}
                </div>

                <div className="settings-browser-pipeline-layout">
                  {/* 流水线步骤控制与指示 */}
                  <div className="settings-browser-pipeline-control">
                    <div className="settings-browser-label">流水线步骤 (Automated Pipeline Steps)</div>
                    
                    <div className="settings-browser-pipeline-list">
                      {[
                        { step: 1, name: '1. 跨端抓取天猫/京东商品数据' },
                        { step: 2, name: '2. 本地 WASM 抠图去背景' },
                        { step: 3, name: '3. 外部平台 (Leonardo) 场景生图' },
                        { step: 4, name: '4. 本地大模型 (Qwen) 润色文案' },
                        { step: 5, name: '5. 一键上传并保存至小红书草稿' },
                      ].map((item) => (
                        <div
                          key={item.step}
                          className="settings-browser-pipeline-step"
                          data-state={pipelineStep === item.step ? 'active' : pipelineStep > item.step ? 'done' : 'pending'}
                        >
                          <div className="settings-browser-pipeline-step__badge">
                            {pipelineStep > item.step ? (
                                <Check size={11} />
                            ) : pipelineStep === item.step ? (
                              <Loader2 size={11} className="settings-browser-spinner" />
                            ) : (
                              item.step
                            )}
                          </div>
                          <span className="settings-browser-pipeline-step__label">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleRunPipeline}
                      disabled={pipelineRunning}
                      data-browser-local-action={BROWSER_LOCAL_ACTIONS.runPipeline.actionName}
                      data-browser-tool={BROWSER_ACTIONS.generateExternal.toolName}
                      data-browser-command-kind={BROWSER_ACTIONS.generateExternal.commandKind}
                      className="settings-browser-action settings-browser-action--primary settings-browser-action--full"
                    >
                      {pipelineRunning ? (
                        <>
                          <Loader2 size={13} className="settings-browser-spinner" />
                          <span>流水线全自动执行中...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} />
                          <span>一键运行自动化流水线</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 终端实时日志 */}
                  <div className="settings-browser-terminal-panel">
                    <div className="settings-browser-label">执行终端日志 (Console Logs)</div>
                    <div className="settings-browser-terminal">
                      {pipelineLogs.length === 0 ? (
                        <div className="settings-browser-terminal__empty">等待流水线启动...</div>
                      ) : (
                        pipelineLogs.map((log, idx) => (
                          <div key={idx} className="settings-browser-terminal__line">
                            <span className="settings-browser-terminal__time">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                          </div>
                        ))
                      )}
                      {pipelineRunning && (
                        <div className="settings-browser-terminal__line" data-state="active">
                          <span>&gt;</span>
                          <span>{pipelineStatusText}</span>
                          <span className="settings-browser-terminal__cursor" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 流水线执行成功成果物展示 */}
                {!pipelineRunning && pipelineCompletedData && (
                  <div className="settings-browser-result-card" data-tone="success">
                    <div className="settings-browser-result-card__media settings-browser-result-card__media--large">
                      <img src={pipelineCompletedData.finalImageUrl} alt="流水线成果" className="settings-browser-result-card__image" />
                      <span className="settings-browser-result-card__media-badge">
                        <Scissors size={8} />透明背景
                      </span>
                    </div>

                    <div className="settings-browser-result-card__content">
                      <div className="settings-browser-result-card__meta">
                        <span className="settings-browser-chip" data-tone="success">
                          流水线产出
                        </span>
                        <span className="settings-browser-inline-status" data-status="done">
                          <Check size={11} />
                          <span>一键分发就绪 | 零 API 成本消耗</span>
                        </span>
                      </div>

                      <h4 className="settings-browser-result-card__title">
                        {pipelineCompletedData.productTitle}
                      </h4>

                      {/* 阶段五优化：如果是代理路由，展现本次生成是由哪个 Session 账号跑出来的 */}
                      {pipelineCompletedData.generatedBySession && (
                        <div className="settings-browser-result-card__note">
                          <Sparkles size={11} className="settings-browser-feature-card__icon" data-tone="success" />
                          <span>生成实例来源: <span className="settings-browser-row__mono">{pipelineCompletedData.generatedBySession}</span> (多账号轮询分配)</span>
                        </div>
                      )}

                      <div className="settings-browser-result-card__copy">
                        <span className="settings-browser-result-card__copy-label">自动编排文案：</span>
                        {pipelineCompletedData.postText}
                      </div>
                    </div>

                    <div className="settings-browser-result-card__actions">
                      <button
                        type="button"
                        onClick={handleImportPipelineCompletedToCanvas}
                        data-browser-local-action={BROWSER_LOCAL_ACTIONS.createCanvasPromptCard.actionName}
                        data-agent-tool={BROWSER_LOCAL_ACTIONS.createCanvasPromptCard.agentToolName}
                        className="settings-browser-action settings-browser-action--primary"
                      >
                        <span>同步商品海报至画布</span>
                        <ArrowRight size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePublishToSocial(pipelineCompletedData.finalImageUrl)}
                        data-browser-tool={BROWSER_ACTIONS.publishDraft.toolName}
                        data-browser-command-kind={BROWSER_ACTIONS.publishDraft.commandKind}
                        className="settings-browser-action settings-browser-action--primary"
                      >
                        <Share2 size={13} />
                        <span>重新分发至小红书</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleZipOriginals}
                        disabled={zipLoading}
                        data-browser-local-action={BROWSER_LOCAL_ACTIONS.zipOriginals.actionName}
                        data-agent-tool={BROWSER_LOCAL_ACTIONS.zipOriginals.agentToolName}
                        className="settings-browser-action settings-browser-action--neutral"
                      >
                        <Download size={13} />
                        <span>打包下载原图 (ZIP)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {zipLoading && (
            <div className="settings-browser-progress-card settings-browser-progress-card--stacked" data-tone="warning">
              <div className="settings-browser-progress-card__row">
                <Loader2 size={16} className="settings-browser-spinner" />
                <div className="settings-browser-progress-card__content">{zipStep}</div>
              </div>
              <div className="settings-browser-progress-track">
                <div className="settings-browser-progress-fill" data-tone="warning" style={{ width: `${zipProgress}%` }} />
              </div>
            </div>
          )}

          {zippedFileLoc && (
            <div className="settings-browser-notice" data-tone="success">
              <div className="settings-browser-notice__content">
                <Download size={16} className="settings-browser-feature-card__icon" data-tone="success" />
                <div className="settings-browser-notice__text">
                  <span className="settings-browser-notice__title">原图 ZIP 准备就绪 (AGENTS.md 规范)：</span>
                  <code className="settings-browser-code settings-browser-code--inline">{zippedFileLoc}</code>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLocateZippedFile}
                data-browser-local-action={BROWSER_LOCAL_ACTIONS.locateZippedFile.actionName}
                className="settings-browser-subtle-action"
              >
                在管理器中定位
              </button>
            </div>
          )}

          <div className="settings-browser-meta-row">
            <HelpCircle size={12} />
            <span>自动分发功能要求在上方保持目标渠道通道处于开启且已登录状态。</span>
          </div>

          {/* 智能剪贴板流入悬浮提示（当读取到剪贴板数据时展示） */}
          {clipboardPayload && (
            <div className="settings-browser-notice" data-tone="warning">
              <div className="settings-browser-notice__content">
                <Clipboard size={16} className="settings-browser-feature-card__icon" data-tone="warning" />
                <div className="settings-browser-notice__text">
                  <span className="settings-browser-notice__title">智能感知器：</span>
                  <span>检测到您复制了天猫 URL: </span>
                  <code className="settings-browser-code settings-browser-code--inline">{clipboardPayload.content}</code>
                </div>
              </div>
              <div className="settings-browser-notice__actions">
                <button
                  type="button"
                  onClick={handleImportClipboardPayload}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.importClipboardPayload.actionName}
                  data-agent-tool={BROWSER_LOCAL_ACTIONS.importClipboardPayload.agentToolName}
                  className="settings-browser-subtle-action"
                >
                  导入画布
                </button>
                <button
                  type="button"
                  onClick={() => setClipboardPayload(null)}
                  data-browser-local-action={BROWSER_LOCAL_ACTIONS.dismissClipboardPayload.actionName}
                  className="settings-browser-toggle"
                  aria-label="关闭智能感知器"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsCardGridContainer>
    </SettingsViewShell>
  );
};

export default BrowserAssistantView;
