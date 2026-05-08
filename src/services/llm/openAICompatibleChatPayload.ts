import type { ChatOptions } from './LLMAdapter';

type ChatContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

export interface OpenAICompatibleChatMessage {
    role: ChatOptions['messages'][number]['role'];
    content: string | ChatContentPart[];
}

export interface OpenAICompatibleChatCompletionsBody extends Record<string, unknown> {
    model: string;
    messages: OpenAICompatibleChatMessage[];
    temperature: ChatOptions['temperature'];
    max_tokens: number;
    stream: boolean;
}

export function buildOpenAICompatibleMessages(options: ChatOptions): OpenAICompatibleChatMessage[] {
    const messages: OpenAICompatibleChatMessage[] = options.messages.map((message) => ({
        role: message.role,
        content: message.content,
    }));

    if (options.inlineData && options.inlineData.length > 0) {
        const lastUserIdx = messages.map((message) => message.role).lastIndexOf('user');
        if (lastUserIdx >= 0) {
            const textContent = messages[lastUserIdx].content;
            const contentParts: ChatContentPart[] = [{ type: 'text', text: String(textContent) }];

            options.inlineData.forEach((media) => {
                contentParts.push({
                    type: 'image_url',
                    image_url: { url: `data:${media.mimeType};base64,${media.data}` },
                });
            });
            messages[lastUserIdx].content = contentParts;
        }
    }

    if (options.systemPrompt) {
        messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    return messages;
}

export function buildChatCompletionsBody(
    options: ChatOptions,
    messages: OpenAICompatibleChatMessage[],
): OpenAICompatibleChatCompletionsBody {
    const body: OpenAICompatibleChatCompletionsBody = {
        model: options.modelId,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens || 20480,
        stream: false,
    };

    if (options.extraBody) {
        Object.assign(body, options.extraBody);
    }

    return body;
}
