// tests/contract/provider-normalization.test.ts
// 中文注释：大模型图像生成错误归一化契约测试

import assert from "node:assert/strict";
import { test } from "node:test";
import {
    normalizeGenerationError
} from "@kk/shared";

test("Error Normalization - HTTP 状态码归一化映射", () => {
    // 场景 1：认证错误 (401/403)
    const err401 = normalizeGenerationError({
        providerId: 'google',
        statusCode: 401,
        message: 'Invalid API Key provided'
    });
    assert.equal(err401.code, 'AUTH_ERROR');
    assert.equal(err401.retryable, false);

    const err403 = normalizeGenerationError({
        providerId: 'gpt-best',
        statusCode: 403,
        message: 'Access denied due to permissions'
    });
    assert.equal(err403.code, 'AUTH_ERROR');

    // 场景 2：速率限制 (429)
    const err429 = normalizeGenerationError({
        providerId: '12ai',
        statusCode: 429,
        message: 'Rate limit exceeded'
    });
    assert.equal(err429.code, 'RATE_LIMIT');
    assert.equal(err429.retryable, true);

    // 场景 3：参数校验/无效输入 (400)
    const err400 = normalizeGenerationError({
        providerId: 'suxi',
        statusCode: 400,
        message: 'prompt too long or negative_prompt is invalid'
    });
    assert.equal(err400.code, 'INVALID_INPUT');
    assert.equal(err400.retryable, false);

    // 场景 4：模型下架/不可用 (404)
    const err404 = normalizeGenerationError({
        providerId: 'google',
        statusCode: 404,
        message: 'Model gemini-image-xxx not found'
    });
    assert.equal(err404.code, 'MODEL_UNAVAILABLE');

    // 场景 5：上游超时 (504)
    const err504 = normalizeGenerationError({
        providerId: 'custom',
        statusCode: 504,
        message: 'Gateway Timeout from upstream server'
    });
    assert.equal(err504.code, 'TIMEOUT');
    assert.equal(err504.retryable, true);
});

test("Error Normalization - 厂商特定错误语义识别", () => {
    // 场景 1：Google Gemini 安全过滤拦截错误
    const geminiSafetyErr = normalizeGenerationError({
        providerId: 'google',
        statusCode: 200, // 部分代理解析器返回 200，但提示文本包含 safety/block
        message: 'The content was blocked by the safety filters.'
    });
    assert.equal(geminiSafetyErr.code, 'INVALID_INPUT');

    // 场景 2：Wuyin 契约错配
    const wuyinContractErr = normalizeGenerationError({
        providerId: 'wuyinkeji',
        statusCode: 400,
        message: 'Wuyin image model image_nanoBanana2 must use documented async contract'
    });
    assert.equal(wuyinContractErr.code, 'PROVIDER_ROUTE_MISMATCH');
});
