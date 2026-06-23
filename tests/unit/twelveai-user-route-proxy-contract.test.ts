import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readSource } from "../support/workspacePaths.js";

describe("12AI user route proxy contract", () => {
  test("identifies 12AI routes by request profile, base URL, and name", () => {
    const userRouteSource = readSource("server/routes/user/profile.js");

    assert.match(userRouteSource, /is12AI = String\(route\.requestProfileId \|\| ''\)\.toLowerCase\(\)\.startsWith\('12ai'\)/);
    assert.match(userRouteSource, /\/12ai\/i\.test\(route\.baseUrl\)/);
    assert.match(userRouteSource, /\/12ai\/i\.test\(route\.name\)/);
  });

  test("maps video aspect ratios to the documented Sora size values", () => {
    const userRouteSource = readSource("server/routes/user/profile.js");

    assert.match(userRouteSource, /let size = '1280x720'/);
    assert.match(userRouteSource, /if \(aspectRatio === '9:16'\)/);
    assert.match(userRouteSource, /size = '720x1280'/);
    assert.match(userRouteSource, /size = '1024x1024'/);
  });

  test("routes 12AI image and video status checks to the documented endpoints", () => {
    const userRouteSource = readSource("server/routes/user/profile.js");

    assert.match(userRouteSource, /const isVideo = \/video\|sora\|veo\|omni\|vidu\|seedance\/i\.test\(modelId\)/);
    assert.match(userRouteSource, /\/v1\/videos\/\$\{providerTaskId\}/);
    assert.match(userRouteSource, /\/v1\/task\/\$\{providerTaskId\}/);
    assert.match(userRouteSource, /extractTwelveAIUrls\(resJson\)/);
    assert.match(userRouteSource, /upstreamStatus === 'completed'/);
    assert.match(userRouteSource, /upstreamStatus === 'partial_completed'/);
    assert.match(userRouteSource, /upstreamStatus === 'success'/);
  });

  test("persists Gemini inline image output returned by 12AI", () => {
    const userRouteSource = readSource("server/routes/user/profile.js");

    assert.match(userRouteSource, /path\.join\(__dirname, '\.\.\/uploads'\)/);
    assert.match(userRouteSource, /fs\.promises\.writeFile\(filePath, Buffer\.from\(imagePart\.inlineData\.data, 'base64'\)\)/);
    assert.match(userRouteSource, /const staticImageUrl = `\/uploads\/\$\{filename\}`/);
  });

  test("matches the documented 12AI async image and video response shapes", () => {
    const userRouteSource = readSource("server/routes/user/profile.js");
    const strictContractSource = readSource("server/lib/dispatcher/strictProviderContracts.js");

    assert.match(userRouteSource, /const providerTaskId = resJson\.id \|\| resJson\.task_id/);
    assert.match(userRouteSource, /^function extractTwelveAIUrls/m);
    assert.match(userRouteSource, /payload\.outputs/);
    assert.match(strictContractSource, /responseShape: '\{ id, status, outputs/);
    assert.match(strictContractSource, /endpoint: '\/v1\/videos'/);
  });
});
