// tests/contract/provider-routing-matrix.test.ts
// 中文注释：大模型图像生成路由行为矩阵契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import {
    resolveProviderImageRoute,
    classifyProviderEndpointHints,
    isGeminiImageLikeModel
} from "../../apps/web/src/services/api/providerRequestRegistry.ts";
import {
    resolveOpenAICompatibleImageDispatch
} from "../../apps/web/src/services/llm/openAICompatibleImageDispatch.ts";

// 构造模拟的 ResolvedProviderRuntime
function mockRuntime(strategyId: string, geminiNative: boolean = false, imageRoutingPolicy?: string): any {
    return {
        strategyId,
        geminiNative,
        imageRoutingPolicy,
        requestProfileId: strategyId === 'apimart' ? 'apimart' : 'default',
        protocolFamily: strategyId === 'google' ? 'gemini-native' : 'openai-compatible'
    };
}

test("Provider Routing Matrix - 12AI 路由测试（含 preferAsync 分支）", () => {
    // 场景 A：12AI 未开启 preferAsync，预期走原生 Gemini surface 与 native 调度
    const runtime12 = mockRuntime('12ai', true);
    const hints = ['generateContent', 'images'];
    const routeDecisionA = resolveProviderImageRoute({
        runtime: runtime12,
        modelId: 'gemini-2.5-flash-image',
        endpointTypes: hints,
        preferAsync: false
    });
    
    assert.equal(routeDecisionA.surface, 'gemini-native-image');
    assert.equal(routeDecisionA.routeFamily, 'provider-native');

    const dispatchPlanA = resolveOpenAICompatibleImageDispatch({
        runtime: runtime12,
        imageSurface: routeDecisionA.surface,
        isGeminiImage: true,
        endpointTypes: hints
    });
    assert.equal(dispatchPlanA.kind, '12ai-openai-strict');

    // 场景 B：12AI 开启 preferAsync，预期走 async-image 异步生成
    const routeDecisionB = resolveProviderImageRoute({
        runtime: runtime12,
        modelId: 'gemini-2.5-flash-image',
        endpointTypes: ['image-generation-async', 'images'],
        preferAsync: true,
        isAsyncImageModel: () => true
    });
    assert.equal(routeDecisionB.surface, 'async-image');

    const dispatchPlanB = resolveOpenAICompatibleImageDispatch({
        runtime: runtime12,
        imageSurface: routeDecisionB.surface,
        isGeminiImage: true,
        endpointTypes: ['image-generation-async']
    });
    assert.equal(dispatchPlanB.kind, 'async-image');
});

test("Provider Routing Matrix - suxi 与 gpt-best 特殊策略测试", () => {
    // 场景 A：suxi 必须走独立图片路由（禁止被 chat-image 兼容性吞没）
    const runtimeSuxi = mockRuntime('suxi', false, 'surface-first');
    const hints = ['images', 'completions'];
    const routeDecisionSuxi = resolveProviderImageRoute({
        runtime: runtimeSuxi,
        modelId: 'suxi-image-model',
        endpointTypes: hints,
        compatibilityMode: 'chat'
    });
    assert.equal(routeDecisionSuxi.surface, 'provider-images');

    const dispatchPlanSuxi = resolveOpenAICompatibleImageDispatch({
        runtime: runtimeSuxi,
        imageSurface: routeDecisionSuxi.surface,
        isGeminiImage: false
    });
    assert.equal(dispatchPlanSuxi.kind, 'suxi-openai-strict');

    // 场景 B：gpt-best 拥有 images 终点提示时，走 native 调度
    const runtimeGptBest = mockRuntime('gpt-best');
    const hintsGpt = ['image-generation', 'chat'];
    const routeDecisionGpt = resolveProviderImageRoute({
        runtime: runtimeGptBest,
        modelId: 'nano-banana',
        endpointTypes: hintsGpt
    });
    assert.equal(routeDecisionGpt.surface, 'provider-images');

    const dispatchPlanGpt = resolveOpenAICompatibleImageDispatch({
        runtime: runtimeGptBest,
        imageSurface: routeDecisionGpt.surface,
        isGeminiImage: true,
        endpointTypes: hintsGpt
    });
    assert.equal(dispatchPlanGpt.kind, 'gpt-best-native');
});

test("Provider Routing Matrix - wuyinkeji 必须强制走 wuyin_async_task 异步路由", () => {
    const runtimeWuyin = mockRuntime('wuyinkeji');
    const routeDecision = resolveProviderImageRoute({
        runtime: runtimeWuyin,
        modelId: 'image_nanoBanana2',
        endpointTypes: ['image-generation-async']
    });
    assert.equal(routeDecision.surface, 'async-image');

    const dispatchPlan = resolveOpenAICompatibleImageDispatch({
        runtime: runtimeWuyin,
        imageSurface: routeDecision.surface,
        isGeminiImage: false
    });
    assert.equal(dispatchPlan.kind, 'wuyin_async_task');
});
