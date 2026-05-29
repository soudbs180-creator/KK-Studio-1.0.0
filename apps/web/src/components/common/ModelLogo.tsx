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
    { iconId: 'gemini', keywords: ['gemini'] }, // 独立 Gemini 星星图标
    { iconId: 'google', keywords: ['imagen', 'veo', 'learnlm', 'lyria', 'google', '谷歌'] },
    { iconId: 'openai', keywords: ['gpt', 'chatgpt', 'dall-e', 'dalle', 'codex', 'openai', 'sora', 'o1', 'o3', 'o4', 'gpt-best'] },
    { iconId: 'claude', keywords: ['claude'] }, // 独立 Claude 小手套图标
    { iconId: 'anthropic', keywords: ['anthropic'] },
    { iconId: 'deepseek', keywords: ['deepseek', '深度求索'] },
    { iconId: 'qwen', keywords: ['qwen', 'qwq', 'qvq', 'wanx', 'tongyi', 'wan 2', 'wan2', 'wan video', 'wan image', '通义千问', '千问'] },
    { iconId: 'midjourney', keywords: ['midjourney', 'mj', 'niji', 'nijijourney'] },
    { iconId: 'runway', keywords: ['runway', 'runwayml', 'gen-2', 'gen-3', 'gen-4', 'gen 2', 'gen 3', 'gen 4'] },
    { iconId: 'luma', keywords: ['luma', 'dream machine', 'lumadreammachine', 'ray2', 'ray3', 'ray 2', 'ray 3'] },
    { iconId: 'kling', keywords: ['kling', '快手可灵', '可灵'] },
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
    { iconId: 'vidu', keywords: ['vidu'] },
    { iconId: 'bytedance', keywords: ['jimeng', 'seedream', 'seedance', 'bytedance', '字节跳动', '字节'] },
    { iconId: 'moonshot', keywords: ['moonshot', 'kimi', '月之暗面'] },
    { iconId: 'wenxin', keywords: ['ernie', 'wenxin', '百度文心', '文心一言', '文心'] }, // 独立文心一言彩环图标
    { iconId: 'baidu', keywords: ['baidu', '百度'] },
    { iconId: 'zhipu', keywords: ['zhipu', 'glm', 'bigmodel', 'cogview', 'cogvideo', '智谱'] },
    { iconId: 'zeroone', keywords: ['yi-', 'yi ', '01.ai', '01 ai', 'lingyi', '零一万物', '零一'] },
    { iconId: 'xiaomimimo', keywords: ['xiaomi', 'xiaomi mimo', 'xiaomimimo', 'mimo', '小米'] }, // 修正为 LobeHub 中的 xiaomimimo 品牌以解决 CDN 404
    { iconId: 'aws', keywords: ['amazon nova', 'nova', 'aws'] },
    { iconId: 'xai', keywords: ['grok', 'xai'] },
    { iconId: 'meta', keywords: ['llama', 'meta'] },
    { iconId: 'mistral', keywords: ['mistral'] },
    { iconId: 'perplexity', keywords: ['perplexity', 'sonar'] },
    { iconId: 'cohere', keywords: ['cohere', 'command-r'] },
    { iconId: 'groq', keywords: ['groq'] },
    { iconId: 'minimax', keywords: ['minimax', 'abab', 'hailuo'] }, // 统一将 minimax 品牌旗下海螺映射到 minimax 图标防 404
    { iconId: 'doubao', keywords: ['doubao', '豆包'] }, // 独立豆包品牌图标
    { iconId: 'volcengine', keywords: ['volcengine', '火山引擎', '火山'] },
    { iconId: 'hunyuan', keywords: ['hunyuan', '混元'] }, // 新增混元独立品牌匹配
    { iconId: 'tencentcloud', keywords: ['tencent cloud', 'tencent', '腾讯云', '腾讯'] },
    { iconId: 'bailian', keywords: ['aliyun', 'alibaba cloud', 'bailian', '阿里云', '阿里', '百炼'] },
    { iconId: 'siliconcloud', keywords: ['siliconflow', 'siliconcloud', '硅基流动'] },
    { iconId: 'openrouter', keywords: ['openrouter'] },
    { iconId: 'stepfun', keywords: ['stepfun', 'step', '阶跃星辰', '阶跃'] },
    { iconId: 'nvidia', keywords: ['nvidia', 'nemotron', '英伟达'] },
    { iconId: 'worldrouter', keywords: ['worldrouter', 'world router'] },
    { iconId: 'vertexai', keywords: ['vertex ai', 'vertexai'] },
    { iconId: 'azure', keywords: ['azure openai', 'azure', '微软'] },
    { iconId: 'bedrock', keywords: ['bedrock'] },
    { iconId: 'togetherai', keywords: ['together', 'togetherai'] }, // 修正为 LobeHub 中的 togetherai 品牌以解决 CDN 404
    { iconId: 'fal', keywords: ['fal'] },
    { iconId: 'bfl', keywords: ['flux', 'black forest labs', 'black-forest-labs'] },
    { iconId: 'stability', keywords: ['stability', 'stable-diffusion', 'stable video', 'sv3d', 'svd'] },
    { iconId: 'sambanova', keywords: ['sambanova'] }, // 新增 SambaNova 品牌支持
    { iconId: 'streamlake', keywords: ['wanqing', 'streamlake', '快手', '万青'] }, // 新增 StreamLake 快手品牌支持
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
    const source = (provider || modelId || 'AI').trim();
    if (!source) return 'AI';

    // 如果字符串中包含中文，直接提取第一个中文字符作为图标，实现最完美契合中文字符的“首字当图标”效果
    const chineseMatch = source.match(/[\u4e00-\u9fa5]/);
    if (chineseMatch) {
        return chineseMatch[0];
    }

    // 否则是纯英文或数字，进行英文缩写提取
    const cleaned = source
        .replace(/[@/_-]+/g, ' ')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim();

    if (!cleaned) return 'AI';

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }

    // 处理像 "OpenClaw" 这样的驼峰大写缩写
    const caps = cleaned.replace(/[^A-Z0-9]/g, '');
    if (caps.length >= 2) {
        return caps.slice(0, 2);
    }

    return cleaned.slice(0, 2).toUpperCase();
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
            cdn: 'jsdelivr',
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
                    style={{
                        // 1. 在暗色模式下，对单色 (mono) 以及本来是纯黑色的品牌图标自动反色变白，完美契合用户“暗色下优先白色”的需求
                        // 2. 根据亮暗主题自适应应用精细的微光投影，彻底解决因颜色接近导致看不清的问题，同时营造奢华浮雕质感
                        filter: (isDarkMode && (variant === 'mono' || ['github', 'xai', 'aws'].includes(iconId || '')))
                            ? 'invert(1) brightness(1.6) drop-shadow(0 0 1px rgba(255,255,255,0.35))'
                            : isDarkMode
                                ? 'drop-shadow(0 0 1.5px rgba(255,255,255,0.25))'
                                : 'drop-shadow(0 0 1px rgba(0,0,0,0.12))'
                    }}
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
