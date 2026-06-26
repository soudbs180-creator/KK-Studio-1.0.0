import React, { useRef, useEffect, useCallback } from 'react';
import type { CachedCardMeta } from '../../services/storage/offlineDb';

interface CanvasLayerRendererProps {
  cardMetas: CachedCardMeta[];
  visibleCardIds: Set<string>;
  canvasTransform: { x: number; y: number; scale: number };
  selectedNodeIds: string[];
  activeSourceImage: string | null;
  onCardClick?: (cardId: string, isDoubleClick: boolean) => void;
  width: number;
  height: number;
}

// 缓存 Canvas 加载的图片实例
const imageCache = new Map<string, HTMLImageElement>();

export const CanvasLayerRenderer: React.FC<CanvasLayerRendererProps> = ({
  cardMetas,
  visibleCardIds,
  canvasTransform,
  selectedNodeIds,
  activeSourceImage,
  onCardClick,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 绘制圆角矩形辅助函数
  const drawRoundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // 渲染函数
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    // 应用当前画布变换
    ctx.translate(canvasTransform.x, canvasTransform.y);
    ctx.scale(canvasTransform.scale, canvasTransform.scale);

    const scale = canvasTransform.scale;

    // 遍历绘制可见节点
    cardMetas.forEach((meta) => {
      // 过滤掉不可见节点以节省绘制开销
      if (!visibleCardIds.has(meta.id)) return;
      
      // 过滤掉 React DOM 正在接管渲染的选中/激活态卡片，避免重叠绘制
      const isSelected = selectedNodeIds.includes(meta.id);
      const isActive = meta.id === activeSourceImage;
      if (isSelected || isActive) return;

      const { x, y, width: w, height: h, type, thumbnailUrl } = meta;
      
      // 锚点是 Bottom Center，计算左上角
      const cardX = x - w / 2;
      const cardY = y - h;

      // 1. 远景模式 (scale < 0.25)：渲染简易灰色框以维持极致性能
      if (scale < 0.25) {
        ctx.fillStyle = 'rgba(39, 39, 42, 0.4)'; // UI_TOKEN_EXCEPTION
        drawRoundRect(ctx, cardX, cardY, w, h, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; // UI_TOKEN_EXCEPTION
        ctx.lineWidth = 1;
        ctx.stroke();
        return;
      }

      // 2. 中近景模式 (scale >= 0.25)：渲染精美的磨砂感卡片与缩略图
      // 卡片阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'; // UI_TOKEN_EXCEPTION
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;

      // 卡片底色
      ctx.fillStyle = type === 'prompt' ? 'rgba(24, 24, 27, 0.75)' : 'rgba(18, 18, 18, 0.6)'; // UI_TOKEN_EXCEPTION
      drawRoundRect(ctx, cardX, cardY, w, h, 24);
      ctx.fill();

      // 清除阴影，防止影响后续绘制
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 卡片边框
      ctx.strokeStyle = type === 'prompt' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)'; // UI_TOKEN_EXCEPTION
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. 绘制图片（图片节点）
      if (type === 'image' && thumbnailUrl) {
        let img = imageCache.get(thumbnailUrl);
        if (!img) {
          img = new Image();
          img.src = thumbnailUrl;
          img.onload = () => {
            // 图片加载成功后重新触发绘制以显示缩略图
            draw();
          };
          imageCache.set(thumbnailUrl, img);
        }

        if (img.complete && img.naturalWidth > 0) {
          // 渲染缩略图区 (圆角裁剪)
          ctx.save();
          // 图片内边距留白
          const imgPadding = 8;
          const imgW = w - imgPadding * 2;
          const imgH = h - imgPadding * 2 - 36; // 留出底部边框高度
          const imgX = cardX + imgPadding;
          const imgY = cardY + imgPadding;

          drawRoundRect(ctx, imgX, imgY, imgW, imgH, 16);
          ctx.clip();

          // 保持宽高比填充 (object-fit: cover)
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const rectRatio = imgW / imgH;
          let sx = 0, sy = 0, sWidth = img.naturalWidth, sHeight = img.naturalHeight;

          if (imgRatio > rectRatio) {
            sWidth = img.naturalHeight * rectRatio;
            sx = (img.naturalWidth - sWidth) / 2;
          } else {
            sHeight = img.naturalWidth / rectRatio;
            sy = (img.naturalHeight - sHeight) / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, imgX, imgY, imgW, imgH);
          ctx.restore();
        } else {
          // 正在加载中的图片，绘制磨砂骨架线稿占位符
          ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'; // UI_TOKEN_EXCEPTION
          drawRoundRect(ctx, cardX + 12, cardY + 12, w - 24, h - 60, 16);
          ctx.fill();
        }
      }

      // 4. 绘制文字 (如果是提示词卡片且放大比例足够看到文字)
      if (type === 'prompt' && scale > 0.45) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // UI_TOKEN_EXCEPTION
        ctx.font = 'semibold 12px Inter, system-ui, sans-serif';
        ctx.fillText('PROMPT CARD', cardX + 16, cardY + 32);

        // 简短的提示文本绘制
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // UI_TOKEN_EXCEPTION
        ctx.font = '14px Inter, system-ui, sans-serif';
        
        // 简易换行绘制 (按字符切分)
        const text = meta.id; // 可以使用元数据携带的部分 prompt 摘要，为了演示直接展示节点类型
        ctx.fillText(`ID: ${text.slice(0, 14)}...`, cardX + 16, cardY + 64);
      }
    });

    ctx.restore();
  }, [cardMetas, visibleCardIds, canvasTransform, selectedNodeIds, activeSourceImage, width, height]);

  // 当尺寸或数据变化时，执行渲染
  useEffect(() => {
    draw();
  }, [draw]);

  // 点击命中测试 (Hit Test)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 转换成画布坐标
    const canvasX = (mouseX - canvasTransform.x) / canvasTransform.scale;
    const canvasY = (mouseY - canvasTransform.y) / canvasTransform.scale;

    // 反向查找命中的卡片（层级高的优先，即后面插入的优先）
    let hitCardId: string | null = null;

    for (let i = cardMetas.length - 1; i >= 0; i--) {
      const meta = cardMetas[i];
      if (!visibleCardIds.has(meta.id)) continue;

      const { x, y, width: w, height: h } = meta;
      const left = x - w / 2;
      const right = x + w / 2;
      const top = y - h;
      const bottom = y;

      if (canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom) {
        hitCardId = meta.id;
        break;
      }
    }

    if (hitCardId && onCardClick) {
      const isDoubleClick = e.detail === 2;
      onCardClick(hitCardId, isDoubleClick);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasClick}
      className="absolute inset-0 pointer-events-auto"
      style={{ zIndex: 5 }} // 在背景层之上，React DOM卡片层之下
    />
  );
};
