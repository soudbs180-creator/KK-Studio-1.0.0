// 简体中文：接管动作执行器 (Action Executor)

import type { AssistantAction, BatchGenerationPlan } from '../types';
import { zipOutputs } from '../../assets/zipOutputs';

// 执行时所需的外部上下文环境依赖注入
export interface ExecutorContext {
  activeCanvas: any;
  selectedModel: any;
  addPromptNode: (node: any) => Promise<void> | void;
  updatePromptNode: (node: any) => Promise<void> | void;
  executeGeneration: (node: any) => Promise<void> | void;
  addToQueue: (node: any) => void;
  getNextCardPosition: () => { x: number; y: number };
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  onOpenSettings?: (view?: string) => void;
  setShowRechargeModal?: (show: boolean) => void;
  notify: {
    success: (title: string, desc?: string) => void;
    warning: (title: string, desc?: string) => void;
    error: (title: string, desc?: string) => void;
    info: (title: string, desc?: string) => void;
  };
  config?: any;
  ecommerceState?: any;
  onGenerate?: () => Promise<void> | void;
}

export async function executeAction(
  action: AssistantAction,
  ctx: ExecutorContext
): Promise<void> {
  const {
    activeCanvas,
    selectedModel,
    addPromptNode,
    updatePromptNode,
    executeGeneration,
    addToQueue,
    getNextCardPosition,
    onOpenSettings,
    notify,
    config,
    setConfig,
    ecommerceState,
    onGenerate
  } = ctx;

  switch (action.type) {
    case 'fillPrompt': {
      const { prompt } = action.payload;
      
      // 1. 优先寻找当前选中的 Prompt 卡片进行更新
      const selectedNodeIds = activeCanvas?.selectedNodeIds || [];
      const selectedPromptNode = activeCanvas?.promptNodes?.find((n: any) => selectedNodeIds.includes(n.id));

      if (selectedPromptNode) {
        await updatePromptNode({
          ...selectedPromptNode,
          prompt: prompt,
          optimizedPromptEn: prompt,
          optimizedPromptZh: '本地优化成功'
        });
        notify.success('卡片已优化', '已将优化提示词直接写入当前选中的卡片中。');
      } else {
        // 2. 无选中时直接在画布中心创建新卡片
        const lastPos = getNextCardPosition();
        const newNode = {
          id: 'takeover_opt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
          prompt: prompt,
          optimizedPromptEn: prompt,
          optimizedPromptZh: '本地优化成功',
          position: lastPos,
          aspectRatio: '1:1',
          imageSize: '1K',
          model: selectedModel?.id || 'gemini-2.5-flash',
          modelLabel: selectedModel?.name || 'Gemini 2.5 Flash',
          provider: selectedModel?.provider || 'Google',
          childImageIds: [],
          timestamp: Date.now(),
          parallelCount: 1
        };

        await addPromptNode(newNode);
        notify.success('已新建优化卡片', '未检测到选中卡片，已为您自动在画布中创建了一张提示词卡片。');
      }
      break;
    }

    case 'locateCard': {
      const { keyword } = action.payload;
      if (!keyword) {
        notify.warning('未指定定位关键词');
        return;
      }

      const nodes = activeCanvas?.promptNodes || [];
      const matched = nodes.find((n: any) =>
        (n.prompt || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.optimizedPromptEn || '').toLowerCase().includes(keyword.toLowerCase()) ||
        (n.optimizedPromptZh || '').toLowerCase().includes(keyword.toLowerCase())
      );

      if (matched) {
        // 触发 App.tsx 中侦听的自定义平移与高亮聚焦事件
        const locateEvent = new CustomEvent('canvas-center-on-node', {
          detail: {
            x: matched.position.x,
            y: matched.position.y,
            nodeId: matched.id
          }
        });
        window.dispatchEvent(locateEvent);
        notify.success('卡片定位成功', `已为您平滑定位至包含“${keyword}”的卡片。`);
      } else {
        notify.warning('定位失败', `在当前画布上未找到包含“${keyword}”的卡片。`);
      }
      break;
    }

    case 'highlightElement': {
      const { selector } = action.payload;
      setTimeout(() => {
        const el = document.querySelector(selector) as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-glow-ring');
          setTimeout(() => {
            el.classList.remove('highlight-glow-ring');
          }, 3000);
        }
      }, 200);
      break;
    }

    case 'openSettings': {
      const { tab } = action.payload;
      if (onOpenSettings) {
        onOpenSettings(tab);
      } else {
        notify.warning('无法打开设置面版');
      }
      break;
    }

    case 'zipOutputs': {
      const { scope } = action.payload;
      try {
        notify.info('正在打包', '正在提取生成图像并进行压缩归档...');
        
        // 传递给 zipOutputs 打包并获取结果
        const result = await zipOutputs(scope, {
          projectName: activeCanvas?.name || 'KKStudio',
          batchId: 'takeover_zip_' + Date.now(),
          imageNodes: activeCanvas?.imageNodes || []
        });

        if (result && result.failedCount > 0) {
          notify.warning('打包完成（部分失败）', `已打包 ${result.count} 张图片，但有 ${result.failedCount} 张图片下载失败。详情已记录在 ZIP 内的 manifest.json。`);
        } else {
          notify.success('打包下载完成', 'ZIP 压缩包及 manifest.json 已成功保存！');
        }
      } catch (err: any) {
        notify.error('打包下载失败', err.message || '未知错误');
      }
      break;
    }

    case 'startGeneration': {
      const { prompt, count } = action.payload;
      notify.success('生图计划已提交', `任务已加入排队队列，数量：${count}`);

      try {
        const lastPos = getNextCardPosition();
        for (let i = 0; i < count; i++) {
          const pos = {
            x: lastPos.x + i * 420,
            y: lastPos.y
          };

          const newNode = {
            id: 'takeover_gen_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 9),
            prompt: prompt,
            position: pos,
            aspectRatio: '1:1',
            imageSize: '1K',
            model: selectedModel?.id || 'gemini-2.5-flash',
            modelLabel: selectedModel?.name || 'Gemini 2.5 Flash',
            provider: selectedModel?.provider || 'Google',
            childImageIds: [],
            timestamp: Date.now(),
            parallelCount: 1,
            isGenerating: false, // 设为 false，不启动倒计时
            status: 'queued'     // 排队中状态
          };

          await addPromptNode(newNode);
          addToQueue(newNode); // 加入排队管理器
        }
      } catch (e: any) {
        notify.error('生图排队触发失败', e.message || '未知异常');
      }
      break;
    }

    case 'startBatchGeneration': {
      const { plan } = action.payload;
      const count = plan.imageIds.length;
      notify.success('批量生成计划已提交', `任务已加入排队队列，共 ${count} 张图`);

      try {
        const lastPos = getNextCardPosition();
        for (let i = 0; i < count; i++) {
          const imageId = plan.imageIds[i];
          const pos = {
            x: lastPos.x + i * 420,
            y: lastPos.y
          };

          const sourceImg = activeCanvas?.imageNodes?.find((img: any) => img.id === imageId);
          const referenceImages = sourceImg ? [{
            id: sourceImg.id,
            url: sourceImg.url,
            label: sourceImg.name || '参考图'
          }] : [];

          const newNode = {
            id: 'takeover_batch_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 9),
            prompt: plan.promptStrategy.basePrompt,
            position: pos,
            aspectRatio: '1:1',
            imageSize: '1K',
            model: selectedModel?.id || 'gemini-2.5-flash',
            modelLabel: selectedModel?.name || 'Gemini 2.5 Flash',
            provider: selectedModel?.provider || 'Google',
            childImageIds: [],
            timestamp: Date.now(),
            parallelCount: 1,
            isGenerating: false, // 默认不生成，不计时
            status: 'queued',    // 设为排队状态
            referenceImages: referenceImages
          };

          await addPromptNode(newNode);
          addToQueue(newNode); // 推入并发排队管理器
        }
      } catch (e: any) {
        notify.error('批量生成排队失败', e.message || '未知异常');
      }
      break;
    }

    case 'fillInputPrompt': {
      const { prompt } = action.payload;
      if (setConfig) {
        setConfig((prev: any) => ({
          ...prev,
          prompt: prompt
        }));
        notify.success('输入框已填入优化提示词', '');
      } else {
        notify.warning('未绑定输入配置', '');
      }
      break;
    }

    case 'changeMode': {
      const { mode } = action.payload;
      if (setConfig) {
        setConfig((prev: any) => ({
          ...prev,
          mode: mode
        }));
        notify.success(`已切换至【${mode === 'image' ? '图片' : mode === 'video' ? '视频' : mode === 'audio' ? '音频' : mode === 'ppt' ? 'PPT' : '电商'}】模式`, '');
      } else {
        notify.warning('未绑定输入配置', '');
      }
      break;
    }

    case 'submitPromptComposer': {
      if (onGenerate) {
        onGenerate();
        notify.success('AI 接管：已帮您发起生成任务', '');
      } else {
        notify.warning('未绑定发送功能', '');
      }
      break;
    }

    default:
      console.warn('未识别的动作类型:', (action as any).type);
  }
}
