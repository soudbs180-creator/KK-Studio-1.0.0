export interface AudioCapability {
    supportedDurations: number[];
    maxDuration: number;
    formats: ('mp3' | 'wav' | 'ogg' | 'm4a')[];
    supportsCustomLyrics: boolean;
    supportsInstrumental: boolean;
    supportsContinuation: boolean;
    supportsStyleTags: boolean;
    supportsVoiceSelection: boolean;
    supportsSpeedControl: boolean;
}

export function getAudioCapability(modelId: string): AudioCapability | undefined {
    const lowerModelId = String(modelId || '').toLowerCase();

    if (lowerModelId.includes('suno-v4')) {
        return {
            supportedDurations: [30, 60, 120, 180, 240],
            maxDuration: 240,
            formats: ['mp3', 'wav'],
            supportsCustomLyrics: true,
            supportsInstrumental: true,
            supportsContinuation: true,
            supportsStyleTags: true,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    if (lowerModelId.includes('suno-v3.5')) {
        return {
            supportedDurations: [30, 60, 120, 180],
            maxDuration: 180,
            formats: ['mp3', 'wav'],
            supportsCustomLyrics: true,
            supportsInstrumental: true,
            supportsContinuation: true,
            supportsStyleTags: true,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    if (lowerModelId.includes('suno')) {
        return {
            supportedDurations: [30, 60, 120],
            maxDuration: 120,
            formats: ['mp3'],
            supportsCustomLyrics: true,
            supportsInstrumental: true,
            supportsContinuation: true,
            supportsStyleTags: true,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    if (lowerModelId.includes('udio')) {
        return {
            supportedDurations: [30, 60, 120],
            maxDuration: 120,
            formats: ['mp3', 'wav'],
            supportsCustomLyrics: true,
            supportsInstrumental: true,
            supportsContinuation: true,
            supportsStyleTags: true,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    if (lowerModelId.includes('riffusion')) {
        return {
            supportedDurations: [10, 20, 30],
            maxDuration: 30,
            formats: ['mp3'],
            supportsCustomLyrics: false,
            supportsInstrumental: true,
            supportsContinuation: false,
            supportsStyleTags: true,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    if (lowerModelId.includes('minimax-tts')) {
        return {
            supportedDurations: [30, 60, 120, 300, 600],
            maxDuration: 600,
            formats: ['mp3', 'wav'],
            supportsCustomLyrics: false,
            supportsInstrumental: false,
            supportsContinuation: false,
            supportsStyleTags: false,
            supportsVoiceSelection: true,
            supportsSpeedControl: true,
        };
    }

    if (lowerModelId.includes('minimax') && lowerModelId.includes('music')) {
        return {
            supportedDurations: [30, 60, 120],
            maxDuration: 120,
            formats: ['mp3'],
            supportsCustomLyrics: true,
            supportsInstrumental: true,
            supportsContinuation: false,
            supportsStyleTags: true,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    if (lowerModelId.includes('tts')) {
        return {
            supportedDurations: [30, 60, 120, 300, 600],
            maxDuration: 600,
            formats: ['wav', 'mp3'],
            supportsCustomLyrics: false,
            supportsInstrumental: false,
            supportsContinuation: false,
            supportsStyleTags: false,
            supportsVoiceSelection: true,
            supportsSpeedControl: true,
        };
    }

    if (lowerModelId.includes('lyria')) {
        return {
            supportedDurations: [30, 60, 120],
            maxDuration: 120,
            formats: ['wav'],
            supportsCustomLyrics: false,
            supportsInstrumental: true,
            supportsContinuation: false,
            supportsStyleTags: false,
            supportsVoiceSelection: false,
            supportsSpeedControl: false,
        };
    }

    return undefined;
}

export function isAudioModel(modelId: string): boolean {
    const lowerModelId = String(modelId || '').toLowerCase();
    return !!getAudioCapability(modelId)
        || lowerModelId.includes('suno')
        || lowerModelId.includes('udio')
        || lowerModelId.includes('riffusion')
        || lowerModelId.includes('minimax-tts')
        || lowerModelId.includes('minimax-music')
        || lowerModelId.includes('lyria')
        || lowerModelId.includes('tts')
        || (lowerModelId.includes('audio') && !lowerModelId.includes('video'));
}

export function getMaxAudioDuration(modelId: string): number {
    return getAudioCapability(modelId)?.maxDuration || 120;
}

export function supportsCustomLyrics(modelId: string): boolean {
    return getAudioCapability(modelId)?.supportsCustomLyrics ?? false;
}

export function supportsInstrumental(modelId: string): boolean {
    return getAudioCapability(modelId)?.supportsInstrumental ?? false;
}

export function supportsAudioContinuation(modelId: string): boolean {
    return getAudioCapability(modelId)?.supportsContinuation ?? false;
}
