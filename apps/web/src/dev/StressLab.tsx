// apps/web/src/dev/StressLab.tsx
// 中文注释：开发环境专用的 UI 布局压力测试实验板组件

import React, { useState } from 'react';
import { type GeneratedImage, GenerationMode, ImageSize, type MobileResultEntry, type ResultViewMode } from '../types';
import { KK_LAYER } from '@kk/ui';
import { GlobalLightbox } from '../components/image/GlobalLightbox';
import MobileResultFeed from '../components/mobile/MobileResultFeed';

// 模拟卡片生成数据
const createMockImage = (overrides: Partial<GeneratedImage>): GeneratedImage => ({
  id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&auto=format&fit=crop',
  originalUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&auto=format&fit=crop',
  prompt: 'A premium abstract digital art piece showcasing modern glassmorphism design tokens.',
  aspectRatio: '1:1',
  imageSize: ImageSize.SIZE_1K,
  isGenerating: false,
  timestamp: Date.now(),
  zIndex: 10,
  mode: GenerationMode.IMAGE,
  model: 'gemini-2.5-flash-image',
  modelLabel: 'Gemini 2.5 Flash Image',
  provider: 'google',
  providerLabel: 'Google Official Channel',
  tokens: 120,
  cost: 0.0015,
  costSource: 'estimated',
  canvasId: 'mock-canvas',
  parentPromptId: 'mock-parent-prompt',
  position: { x: 200, y: 300 },
  ...overrides
});

const toMobileResultEntry = (image: GeneratedImage, index: number): MobileResultEntry => ({
  id: `mobile-${image.id}`,
  imageId: image.id,
  displaySrc: image.url || image.originalUrl || null,
  displayLabel: image.aspectRatio,
  hasOriginal: Boolean(image.originalUrl || image.url),
  timestamp: image.timestamp,
  parentPromptId: image.parentPromptId || null,
  prompt: image.prompt,
  promptSummary: image.prompt,
  fullPrompt: image.prompt,
  referenceImages: [],
  modelId: image.model,
  modelLabel: image.modelLabel || image.model,
  aspectRatio: image.aspectRatio,
  imageSize: image.imageSize || ImageSize.SIZE_1K,
  actions: {
    preview: true,
    useAsSource: true,
    partialRedraw: true,
    download: true,
    delete: true,
  },
  mobileLayout: {
    aspectRatio: index % 3 === 0 ? 0.78 : index % 3 === 1 ? 1 : 1.42,
    aspectCategory: index % 3 === 0 ? 'portrait' : index % 3 === 1 ? 'square' : 'landscape',
    emphasis: index % 3 === 2 ? 'wide' : 'standard',
  },
  creditCost: 8 + index,
  generationTime: 1800 + index * 900,
  isGenerating: image.isGenerating,
  error: image.error,
  tags: ['stress', 'result-surface'],
  groupCount: index === 1 ? 4 : undefined,
});

export const StressLab: React.FC = () => {
  const [testCards, setTestCards] = useState<GeneratedImage[]>(() => [
    // 场景 1：超长提示词
    createMockImage({
      id: 'stress-long-prompt',
      prompt: 'A ultra-detailed masterpiece, futuristic cyberpunk cityscape with towering neon-lit skyscrapers, holographic advertisements of banana brands, flying vehicles navigating through glowing sky-lanes, wet streets reflecting vibrant pink and cyan lights, hyper realistic reflections, cinematic lighting, 8k resolution, trending on artstation, masterpiece digital artwork',
    }),
    // 场景 2：超长模型名称与服务商
    createMockImage({
      id: 'stress-long-model-name',
      model: 'super-hyper-extended-ultra-advanced-generation-image-nano-banana-pro-max-v2',
      modelLabel: 'Super Hyper Extended Ultra Advanced Generation Image Nano Banana Pro Max v2',
      providerLabel: 'Enterprise Cloud Premium Model Gateway Secondary Proxy Endpoint 12AI Global Router',
      cost: 0.0450
    }),
    // 场景 3：大面积报错卡片
    createMockImage({
      id: 'stress-error-card',
      error: 'Image generation failed: UPSTREAM_GATEWAY_TIMEOUT (504). The upstream provider failed to respond within the expected deadline. All credits have been successfully refunded to your account ledger.',
    }),
    // 场景 4：异步 pending 轮询卡片
    createMockImage({
      id: 'stress-pending-card',
      isGenerating: true,
      modelLabel: 'Wuyin Async Image Model'
    })
  ]);
  const [resultViewMode, setResultViewMode] = useState<ResultViewMode>('standard');
  const [activeResultId, setActiveResultId] = useState<string | null>('mobile-stress-long-prompt');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const mobileResultEntries = testCards.map(toMobileResultEntry);

  return (
    <div className="p-8 bg-[var(--bg-base)] text-[var(--text-primary)] min-h-screen overflow-y-auto">
      <header className="mb-8 border-b border-[var(--border-light)] pb-4">
        <h1 className="text-2xl font-bold mb-2">KK Studio UI 压力测试实验室 (StressLab)</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          用于验证组件在极端边界文本、硬编码溢出和 Z-Index 层级堆叠时的展现表现。
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">层级与 Portal 验证区</h2>
        <div className="flex gap-4 items-center">
          <div className="relative">
            <button className="px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-default)] rounded-md">
              Dropdown 按钮 (层级: {KK_LAYER.dropdown})
            </button>
            {/* 在此可测试 Portal 组件 */}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            下拉与弹出层已统一挂载至 LayerPortal，不再受父级 flex/overflow 容器剪裁。
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">结果面系统预览</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              验证移动结果瀑布流、底部悬浮操作、44px 触控热区与全局灯箱 token。
            </p>
          </div>
          <button
            type="button"
            className="kk-result-control kk-result-primary-action rounded-lg px-4 text-sm font-semibold"
            onClick={() => setIsLightboxOpen(true)}
          >
            打开结果灯箱
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="relative h-[720px] max-w-[430px] overflow-hidden rounded-[28px] border border-[var(--kk-result-panel-border)] bg-[var(--bg-canvas)] shadow-[var(--kk-result-panel-shadow)]">
            <MobileResultFeed
              resultEntries={mobileResultEntries}
              activeEntryId={activeResultId}
              activeSourceImage={testCards[0]?.id || null}
              surface="phone"
              viewMode={resultViewMode}
              onViewModeChange={setResultViewMode}
              onEntryOpen={(entryId) => setActiveResultId(entryId)}
              onUseAsSource={(imageId) => setActiveResultId(`mobile-${imageId}`)}
              onDeleteImage={(imageId) => setTestCards((items) => items.filter((item) => item.id !== imageId))}
              onDownloadEntry={() => undefined}
            />
          </div>

          <div className="grid content-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 text-sm text-[var(--text-secondary)]">
            <div className="font-semibold text-[var(--text-primary)]">检查点</div>
            <div>移动结果卡片应为系统圆角，选中态使用 `--kk-result-selected-shadow`。</div>
            <div>底部悬浮栏应使用 `--kk-result-bottom-scrim-bg`，且操作按钮触控热区不小于 44px。</div>
            <div>灯箱底部操作区应复用 `kk-result-control` 与 `kk-result-primary-action`，不再扩散一次性色系。</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">极端尺寸与超长文本卡片测试 (防溢出)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testCards.map((card) => (
            <div
              key={card.id}
              className="flex flex-col border border-[var(--border-default)] bg-[var(--bg-surface)] rounded-2xl p-4 shadow-sm kk-min-w-0"
              style={{ minHeight: '380px' }}
            >
              <div className="font-semibold text-xs text-[var(--accent-coral)] mb-2 uppercase tracking-wide">
                Scenario: {card.id}
              </div>

              {/* 模拟图片框 */}
              <div className="w-full aspect-square bg-[var(--bg-hover)] rounded-lg overflow-hidden flex items-center justify-center border border-[var(--border-light)] mb-4">
                {card.isGenerating ? (
                  <div className="animate-pulse text-xs text-[var(--text-tertiary)]">生成中 (Pending)...</div>
                ) : card.error ? (
                  <div className="p-4 text-xs text-[var(--accent-red)] text-center kk-break-anywhere">{card.error}</div>
                ) : (
                  <img src={card.url} alt="Stress" className="object-cover w-full h-full" />
                )}
              </div>

              {/* 模拟卡片 Footer 动作行与文本折行 */}
              <div className="flex flex-col gap-2 w-full kk-min-w-0 mt-auto">
                <div className="text-xs text-[var(--text-secondary)] line-clamp-2 kk-break-anywhere" title={card.prompt}>
                  {card.prompt}
                </div>
                <div className="flex items-center gap-1.5 w-full kk-min-w-0 border-t border-[var(--border-light)] pt-2 mt-1">
                  <span className="text-[10px] bg-[var(--bg-hover)] border border-[var(--border-light)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] truncate kk-min-w-0">
                    {card.modelLabel}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 ml-auto">
                    ${card.cost?.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {isLightboxOpen ? (
        <GlobalLightbox
          images={testCards}
          initialIndex={0}
          onClose={() => setIsLightboxOpen(false)}
          onUseAsSource={() => setIsLightboxOpen(false)}
          onDeleteImage={(imageId) => setTestCards((items) => items.filter((item) => item.id !== imageId))}
        />
      ) : null}
    </div>
  );
};
