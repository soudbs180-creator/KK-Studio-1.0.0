export const config = { runtime: 'edge' };

const PROVIDER_CONFIGS: Record<string, { envKey: string; baseUrl: string; path: string }> = {
  claude: {
    envKey: 'CLAUDE_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    path: '/v1/messages',
  },
  aliyun: {
    envKey: 'ALIYUN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com',
    path: '/api/v1/services/aigc/text-generation/generation',
  },
  tencent: {
    envKey: 'TENCENT_API_KEY',
    baseUrl: 'https://hunyuan.tencentcloudapi.com',
    path: '/',
  }
};

const PROVIDER_WHITELIST = Object.keys(PROVIDER_CONFIGS);

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. 匿名用户校验
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: 缺少有效的身份认证令牌，匿名访问已拒绝' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. 解析标准化参数
    const payload = await request.json();
    const { provider, model, messages, temperature, maxTokens, stream } = payload;

    // 3. 供应商白名单校验
    const lowerProvider = String(provider || '').trim().toLowerCase();
    if (!PROVIDER_WHITELIST.includes(lowerProvider)) {
      return new Response(
        JSON.stringify({ error: `Forbidden: 非法的供应商 ${provider} 请求` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = PROVIDER_CONFIGS[lowerProvider];
    const apiKey = process.env[config.envKey];

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `Internal Server Error: 服务端未配置供应商 ${provider} 的授权密钥` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. 构建真实的第三方 API 请求
    const targetUrl = `${config.baseUrl}${config.path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let targetBody: any = {};

    if (lowerProvider === 'claude') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      targetBody = {
        model,
        messages: messages.filter((m: any) => m.role !== 'system'),
        system: messages.find((m: any) => m.role === 'system')?.content,
        max_tokens: maxTokens || 2048,
        temperature: temperature ?? 0.7,
        stream: !!stream,
      };
    } else if (lowerProvider === 'aliyun') {
      headers['Authorization'] = `Bearer ${apiKey}`;
      targetBody = {
        model,
        input: { messages },
        parameters: {
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens,
          incremental_output: !!stream,
        }
      };
    } else if (lowerProvider === 'tencent') {
      headers['Authorization'] = `Bearer ${apiKey}`;
      targetBody = {
        model,
        messages,
        temperature: temperature ?? 0.7,
        stream: !!stream,
      };
    }

    // 5. 转发请求
    const upstreamResponse = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(targetBody),
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return new Response(
        JSON.stringify({ error: `Upstream failed with status ${upstreamResponse.status}: ${errorText}` }),
        { status: upstreamResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. 响应透传（支持 SSE）
    const responseHeaders = new Headers();
    if (stream) {
      responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8');
      responseHeaders.set('Cache-Control', 'no-cache, no-transform');
      responseHeaders.set('Connection', 'keep-alive');
    } else {
      responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    }

    return new Response(upstreamResponse.body, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Proxy internal error: ${err.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
