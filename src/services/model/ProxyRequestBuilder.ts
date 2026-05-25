export interface StandardizedProxyRequest {
  provider: string; // 供应商标识，如 'claude' | 'aliyun' | 'tencent'
  model: string;    // 模型 ID
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export class ProxyRequestBuilder {
  private provider: string = '';
  private model: string = '';
  private messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  private temperature?: number;
  private maxTokens?: number;
  private stream: boolean = false;

  setProvider(provider: string): this {
    this.provider = provider.toLowerCase();
    return this;
  }

  setModel(model: string): this {
    this.model = model;
    return this;
  }

  setMessages(messages: any[]): this {
    this.messages = messages.map(msg => ({
      role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    }));
    return this;
  }

  setTemperature(temp?: number): this {
    if (temp !== undefined) this.temperature = temp;
    return this;
  }

  setMaxTokens(max?: number): this {
    if (max !== undefined) this.maxTokens = max;
    return this;
  }

  setStream(stream?: boolean): this {
    this.stream = !!stream;
    return this;
  }

  build(): StandardizedProxyRequest {
    if (!this.provider) throw new Error('Provider is required');
    if (!this.model) throw new Error('Model is required');
    if (this.messages.length === 0) throw new Error('Messages cannot be empty');

    return {
      provider: this.provider,
      model: this.model,
      messages: this.messages,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      stream: this.stream
    };
  }
}
