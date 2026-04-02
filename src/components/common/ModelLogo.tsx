import React, { useEffect, useMemo, useState } from 'react';
import eigenAiIcon from '../../assets/model-logos/eigen-ai.svg';
import higgsfieldIcon from '../../assets/model-logos/higgsfield.png';
import imagineArtIcon from '../../assets/model-logos/imagineart.png';
import reveIcon from '../../assets/model-logos/reve.svg';
import riffusionProducerIcon from '../../assets/model-logos/riffusion-producer.png';
import { useTheme } from '../../context/ThemeContext';
import { getLobeIconCdnUrl } from '../../utils/lobeIconCdn';

interface ModelLogoProps {
    modelId: string;
    provider?: string;
    modelName?: string;
    size?: number;
    active?: boolean;
    className?: string;
}

type IconVariant = 'color' | 'mono';

const NANO_BANANA_KEYWORDS = [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'image_nanobanana',
    'image nanobanana',
    'image_nanobanana2',
    'image nanobanana2',
    'image_nanobanana_pro',
    'image nanobanana pro',
    'nano banana',
    'nanobanana',
];

const ICON_MATCHERS: Array<{ iconId: string; keywords: string[] }> = [
    { iconId: 'google', keywords: ['gemini', 'imagen', 'veo', 'learnlm', 'lyria', 'nano banana', 'nanobanana', 'google'] },
    { iconId: 'openai', keywords: ['gpt', 'chatgpt', 'dall-e', 'dalle', 'codex', 'openai', 'sora', 'o1', 'o3', 'o4'] },
    { iconId: 'anthropic', keywords: ['claude', 'anthropic'] },
    { iconId: 'deepseek', keywords: ['deepseek'] },
    { iconId: 'qwen', keywords: ['qwen', 'qwq', 'qvq', 'wanx', 'tongyi', 'wan 2', 'wan2', 'wan video', 'wan image'] },
    { iconId: 'midjourney', keywords: ['midjourney', 'mj', 'niji', 'nijijourney'] },
    { iconId: 'runway', keywords: ['runway', 'runwayml', 'gen-2', 'gen-3', 'gen-4', 'gen 2', 'gen 3', 'gen 4'] },
    { iconId: 'luma', keywords: ['luma', 'dream machine', 'lumadreammachine', 'ray2', 'ray3', 'ray 2', 'ray 3'] },
    { iconId: 'kling', keywords: ['kling'] },
    { iconId: 'pika', keywords: ['pika'] },
    { iconId: 'ideogram', keywords: ['ideogram'] },
    { iconId: 'recraft', keywords: ['recraft'] },
    { iconId: 'adobe', keywords: ['adobe', 'firefly'] },
    { iconId: 'suno', keywords: ['suno'] },
    { iconId: 'udio', keywords: ['udio'] },
    { iconId: 'elevenlabs', keywords: ['elevenlabs', 'eleven'] },
    { iconId: 'fishaudio', keywords: ['fish audio', 'fish-audio', 'fishaudio'] },
    { iconId: 'pixverse', keywords: ['pixverse'] },
    { iconId: 'viggle', keywords: ['viggle'] },
    { iconId: 'hailuo', keywords: ['hailuo'] },
    { iconId: 'vidu', keywords: ['vidu'] },
    { iconId: 'bytedance', keywords: ['jimeng', 'seedream', 'seedance', 'bytedance'] },
    { iconId: 'moonshot', keywords: ['moonshot', 'kimi'] },
    { iconId: 'baidu', keywords: ['baidu', 'ernie', 'wenxin'] },
    { iconId: 'zhipu', keywords: ['zhipu', 'glm', 'bigmodel', 'cogview', 'cogvideo'] },
    { iconId: 'zeroone', keywords: ['yi-', 'yi ', '01.ai', '01 ai', 'lingyi'] },
    { iconId: 'xiaomimimo', keywords: ['xiaomi mimo', 'xiaomimimo', 'mimo'] },
    { iconId: 'aws', keywords: ['amazon nova', 'nova'] },
    { iconId: 'xai', keywords: ['grok', 'xai'] },
    { iconId: 'meta', keywords: ['llama', 'meta'] },
    { iconId: 'mistral', keywords: ['mistral'] },
    { iconId: 'perplexity', keywords: ['perplexity', 'sonar'] },
    { iconId: 'cohere', keywords: ['cohere', 'command-r'] },
    { iconId: 'groq', keywords: ['groq'] },
    { iconId: 'minimax', keywords: ['minimax', 'abab', 'hailuo'] },
    { iconId: 'volcengine', keywords: ['volcengine', 'doubao'] },
    { iconId: 'tencentcloud', keywords: ['tencent cloud', 'tencent', 'hunyuan'] },
    { iconId: 'bailian', keywords: ['aliyun', 'alibaba cloud', 'bailian'] },
    { iconId: 'siliconcloud', keywords: ['siliconflow', 'siliconcloud'] },
    { iconId: 'openrouter', keywords: ['openrouter'] },
    { iconId: 'vertexai', keywords: ['vertex ai', 'vertexai'] },
    { iconId: 'azure', keywords: ['azure openai', 'azure'] },
    { iconId: 'bedrock', keywords: ['bedrock'] },
    { iconId: 'together', keywords: ['together'] },
    { iconId: 'fal', keywords: ['fal'] },
    { iconId: 'bfl', keywords: ['flux', 'black forest labs', 'black-forest-labs'] },
    { iconId: 'stability', keywords: ['stability', 'stable-diffusion', 'stable video', 'sv3d', 'svd'] },
];

const CUSTOM_ICON_MATCHERS: Array<{ iconUrl: string; keywords: string[] }> = [
    { iconUrl: eigenAiIcon, keywords: ['eigen', 'eigen image'] },
    { iconUrl: higgsfieldIcon, keywords: ['higgsfield'] },
    { iconUrl: imagineArtIcon, keywords: ['imagineart', 'imagine art'] },
    { iconUrl: reveIcon, keywords: ['reve', 'reve v1'] },
    { iconUrl: riffusionProducerIcon, keywords: ['riffusion'] },
];

function normalizeValue(value?: string): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[@/_.-]+/g, ' ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function matchesKeyword(candidate: string, keyword: string): boolean {
    const normalizedKeyword = normalizeValue(keyword);
    if (!candidate || !normalizedKeyword) return false;

    if (candidate === normalizedKeyword) return true;

    if (normalizedKeyword.length <= 2) {
        return candidate
            .split(' ')
            .filter(Boolean)
            .some((token) => token === normalizedKeyword || token.startsWith(normalizedKeyword));
    }

    return candidate.includes(normalizedKeyword);
}

function resolveIconId(modelId: string, provider?: string, modelName?: string): string | undefined {
    const candidates = [normalizeValue(modelId), normalizeValue(provider), normalizeValue(modelName)].filter(Boolean);

    for (const candidate of candidates) {
        const matched = ICON_MATCHERS.find(({ keywords }) =>
            keywords.some((keyword) => matchesKeyword(candidate, keyword))
        );

        if (matched) {
            return matched.iconId;
        }
    }

    return undefined;
}

function resolveCustomIconUrl(modelId: string, provider?: string, modelName?: string): string | undefined {
    const candidates = [normalizeValue(modelId), normalizeValue(provider), normalizeValue(modelName)].filter(Boolean);

    for (const candidate of candidates) {
        const matched = CUSTOM_ICON_MATCHERS.find(({ keywords }) =>
            keywords.some((keyword) => matchesKeyword(candidate, keyword))
        );

        if (matched) {
            return matched.iconUrl;
        }
    }

    return undefined;
}

function isNanoBananaSeries(modelId: string, provider?: string, modelName?: string): boolean {
    const candidates = [normalizeValue(modelId), normalizeValue(provider), normalizeValue(modelName)].filter(Boolean);

    return candidates.some((candidate) =>
        NANO_BANANA_KEYWORDS.some((keyword) => candidate.includes(keyword))
    );
}

function getFallbackInitials(modelId: string, provider?: string): string {
    const source = (provider || modelId || 'AI')
        .replace(/[@/_-]+/g, ' ')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .trim();

    if (!source) return 'AI';

    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
}

const ModelLogo: React.FC<ModelLogoProps> = ({
    modelId,
    provider,
    modelName,
    size = 18,
    active = true,
    className = '',
}) => {
    const { isDarkMode } = useTheme();
    const [variant, setVariant] = useState<IconVariant>('color');
    const [hasError, setHasError] = useState(false);
    const isNanoBanana = useMemo(() => isNanoBananaSeries(modelId, provider, modelName), [modelId, modelName, provider]);
    const iconId = useMemo(() => resolveIconId(modelId, provider, modelName), [modelId, modelName, provider]);
    const customIconUrl = useMemo(() => resolveCustomIconUrl(modelId, provider, modelName), [modelId, modelName, provider]);
    const fallbackInitials = useMemo(() => getFallbackInitials(modelName || modelId, provider), [modelId, modelName, provider]);

    useEffect(() => {
        setVariant('color');
        setHasError(false);
    }, [customIconUrl, iconId]);

    const iconUrl = iconId
        ? getLobeIconCdnUrl(iconId, {
            cdn: 'aliyun',
            format: variant === 'mono' ? 'png' : 'svg',
            isDarkMode,
            type: variant,
        })
        : null;
    const displayIconUrl = iconUrl || customIconUrl || null;

    return (
        <span
            title={provider || modelId}
            className={`inline-flex items-center justify-center overflow-hidden ${active ? '' : 'opacity-60'} ${className}`}
            style={{ width: size, height: size }}
        >
            {isNanoBanana ? (
                <span
                    role="img"
                    aria-label="Nano Banana"
                    style={{
                        width: size,
                        height: size,
                        fontSize: Math.max(12, Math.round(size * 0.92)),
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {'\u{1F34C}'}
                </span>
            ) : displayIconUrl && !hasError ? (
                <img
                    src={displayIconUrl}
                    alt={provider || modelId}
                    width={size}
                    height={size}
                    className="object-contain"
                    onError={() => {
                        if (iconUrl && variant === 'color') {
                            setVariant('mono');
                            return;
                        }

                        setHasError(true);
                    }}
                />
            ) : (
                <span
                    className="inline-flex items-center justify-center rounded-[30%] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                    style={{
                        width: size,
                        height: size,
                        fontSize: Math.max(8, Math.round(size * 0.42)),
                        fontWeight: 700,
                        lineHeight: 1,
                    }}
                >
                    {fallbackInitials}
                </span>
            )}
        </span>
    );
};

export default ModelLogo;
