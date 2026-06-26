import type { BrowserTaskResult } from './browserAssistantTypes';

// 简体中文：解析转换提取结果，导入无限画布 (Browser Result Mapper)
export class BrowserResultMapper {
  public mapToCanvas(result: BrowserTaskResult): void {
    if (result.status !== 'success') return;

    const prompts: string[] = [];
    let imageUrl: string | undefined = undefined;

    // 1. 处理提取文字大纲
    if (result.extractedText) {
      prompts.push(`[网页内容提取自: ${result.siteId}]\n${result.extractedText}`);
    }

    // 2. 处理截图
    if (result.screenshotUrl) {
      imageUrl = result.screenshotUrl;
    }

    // 3. 处理已生成的资产/图片
    if (result.extractedImages && result.extractedImages.length > 0) {
      result.extractedImages.forEach((img, idx) => {
        if (!imageUrl) {
          imageUrl = img; // 首图作为背景或大卡片
        } else {
          prompts.push(`[提取图片 ${idx + 1}]: ${img}`);
        }
      });
    }

    if (result.generatedAssets && result.generatedAssets.length > 0) {
      imageUrl = result.generatedAssets[0];
      prompts.push(`[外部网页生成结果]\n状态：已导入 KK Studio\n来源平台：${result.siteId}`);
    }

    // 如果没有任何文本和图片，生成默认状态卡片
    if (prompts.length === 0 && !imageUrl) {
      prompts.push(`[助手日志] 任务 ${result.actionType} 已在 ${result.siteId} 执行完毕。`);
    }

    // 4. 派发全局 takeover 卡片创建事件，让 WorkspacePage 接收并打入画布中
    window.dispatchEvent(
      new CustomEvent('takeover-create-prompt-cards', {
        detail: {
          prompts,
          imageUrl
        }
      })
    );
  }
}

export const browserResultMapper = new BrowserResultMapper();
