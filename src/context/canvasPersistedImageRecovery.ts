import { type Canvas, type GeneratedImage, type PromptNode } from '../types';
import { getImage, getStrictOriginalImage } from '../services/storage/imageStorage';
import { type PersistedTask } from '../services/persistence/taskPersistence';
import { resolveModelDisplayName } from '../utils/modelDisplayName';
import {
    buildImageResultIdentity,
    buildTaskResultIdentity,
    getCompletedTaskResultUrls,
    getImageRecoveryCandidates,
    getPromptCompletedTasks,
    normalizePersistentResultUrl,
} from '../utils/imageResultPersistence';

export type PromptRecoveryEntry = {
    taskId: string;
    resultIndex: number;
    url?: string;
    storageId?: string;
    completedAt?: number;
    keySlotId?: string;
    provider?: string;
    providerLabel?: string;
    model?: string;
    modelLabel?: string;
    cost?: number;
    costSource?: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none';
    tokens?: number;
};

const getTaskResultUrlAtIndex = (urls: string[], index?: number): string | undefined => {
    if (!urls.length) return undefined;
    if (typeof index === 'number' && Number.isFinite(index) && index >= 0 && index < urls.length) {
        return urls[index];
    }
    return urls[0];
};

const normalizeTaskResultStorageIds = (value?: Record<string, string> | null): Record<string, string> => {
    if (!value || typeof value !== 'object') return {};

    return Object.fromEntries(
        Object.entries(value)
            .filter(([key, storageId]) => (
                String(key).trim().length > 0
                && typeof storageId === 'string'
                && storageId.trim().length > 0
            ))
            .map(([key, storageId]) => [String(key).trim(), storageId.trim()])
    );
};

const getTaskResultStorageIdAtIndex = (
    storageIds?: Record<string, string> | null,
    index?: number
): string | undefined => {
    const normalizedStorageIds = normalizeTaskResultStorageIds(storageIds);
    if (typeof index === 'number' && Number.isFinite(index)) {
        const directMatch = normalizedStorageIds[String(index)];
        if (directMatch) return directMatch;
    }

    const firstKey = Object.keys(normalizedStorageIds)[0];
    return firstKey ? normalizedStorageIds[firstKey] : undefined;
};

const resolveStoredResultSource = async (storageId?: string | null): Promise<string | undefined> => {
    const normalizedStorageId = typeof storageId === 'string' ? storageId.trim() : '';
    if (!normalizedStorageId) return undefined;

    try {
        const original = await getStrictOriginalImage(normalizedStorageId);
        if (original) return original;
    } catch {
        // noop
    }

    try {
        const cached = await getImage(normalizedStorageId);
        if (cached) return cached;
    } catch {
        // noop
    }

    return undefined;
};

export const resolvePromptRecoveryEntrySource = async (
    entry?: PromptRecoveryEntry | null
): Promise<string | undefined> => {
    if (!entry) return undefined;

    const storedSource = await resolveStoredResultSource(entry.storageId);
    if (storedSource) return storedSource;

    const normalizedUrl = normalizePersistentResultUrl(entry.url) || entry.url;
    if (normalizedUrl && !normalizedUrl.startsWith('blob:')) {
        return normalizedUrl;
    }

    return undefined;
};

export const buildPromptRecoveryEntries = (
    node: PromptNode,
    persistedTasks: PersistedTask[] = []
): PromptRecoveryEntry[] => {
    const entries: PromptRecoveryEntry[] = [];
    const seenKeys = new Set<string>();

    getPromptCompletedTasks(node).forEach((task) => {
        const urls = getCompletedTaskResultUrls(task);
        const storageIds = normalizeTaskResultStorageIds(task.resultStorageIds);
        const resultIndexes = Array.from(new Set([
            ...urls.map((_, index) => index),
            ...Object.keys(storageIds)
                .map((key) => Number.parseInt(key, 10))
                .filter((value) => Number.isFinite(value) && value >= 0),
        ])).sort((left, right) => left - right);

        resultIndexes.forEach((index) => {
            const url = getTaskResultUrlAtIndex(urls, index);
            const storageId = storageIds[String(index)];
            const identity = buildTaskResultIdentity({
                taskId: task.taskId,
                resultIndex: index,
                url,
            });
            if (!identity || seenKeys.has(identity)) return;
            seenKeys.add(identity);
            entries.push({
                taskId: task.taskId,
                resultIndex: index,
                url,
                storageId,
                completedAt: task.completedAt,
                keySlotId: task.keySlotId,
                provider: task.provider,
                providerLabel: task.providerLabel,
                model: task.model,
                modelLabel: resolveModelDisplayName(task.model, task.modelLabel),
                cost: task.cost,
                costSource: task.costSource,
                tokens: task.tokens,
            });
        });
    });

    persistedTasks.forEach((task) => {
        const urls = (task.resultUrls || [])
            .map((url) => normalizePersistentResultUrl(url))
            .filter((url): url is string => !!url);
        const storageIds = normalizeTaskResultStorageIds(task.resultStorageIds);
        const resultIndexes = Array.from(new Set([
            ...urls.map((_, index) => index),
            ...Object.keys(storageIds)
                .map((key) => Number.parseInt(key, 10))
                .filter((value) => Number.isFinite(value) && value >= 0),
        ])).sort((left, right) => left - right);

        resultIndexes.forEach((index) => {
            const url = getTaskResultUrlAtIndex(urls, index);
            const storageId = storageIds[String(index)];
            const identity = buildTaskResultIdentity({
                taskId: task.taskId,
                resultIndex: index,
                url,
            });
            if (!identity || seenKeys.has(identity)) return;
            seenKeys.add(identity);
            entries.push({
                taskId: task.taskId,
                resultIndex: index,
                url,
                storageId,
                completedAt: task.completedAt ? Date.parse(task.completedAt) : undefined,
                keySlotId: task.keySlotId,
                provider: task.provider,
                providerLabel: task.providerLabel,
                model: task.model,
                cost: task.cost,
                costSource: task.costSource,
                tokens: task.tokens,
            });
        });
    });

    return entries;
};

export const resolveImageRecoveryUrlFromMetadata = async (
    image: GeneratedImage,
    prompt: PromptNode | undefined,
    promptTasks: PersistedTask[] = []
): Promise<string | undefined> => {
    const directStorageCandidates = Array.from(new Set([
        image.storageId,
        image.id,
    ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)));

    for (const storageId of directStorageCandidates) {
        const storedSource = await resolveStoredResultSource(storageId);
        if (storedSource) return storedSource;
    }

    const directCandidates = getImageRecoveryCandidates(image)
        .map((candidate) => normalizePersistentResultUrl(candidate) || candidate)
        .filter((candidate): candidate is string => !!candidate && !candidate.startsWith('blob:'));
    if (directCandidates.length > 0) {
        return directCandidates[0];
    }

    if (!prompt) return undefined;

    const completedTask = getPromptCompletedTasks(prompt).find((task) => task.taskId === image.sourceTaskId);
    const completedStoredSource = await resolveStoredResultSource(
        getTaskResultStorageIdAtIndex(completedTask?.resultStorageIds, image.sourceResultIndex)
    );
    if (completedStoredSource) return completedStoredSource;

    const completedUrl = completedTask
        ? getTaskResultUrlAtIndex(getCompletedTaskResultUrls(completedTask), image.sourceResultIndex)
        : undefined;
    if (completedUrl) return completedUrl;

    const persistedTask = promptTasks.find((task) => task.taskId === image.sourceTaskId);
    const persistedStoredSource = await resolveStoredResultSource(
        getTaskResultStorageIdAtIndex(persistedTask?.resultStorageIds, image.sourceResultIndex)
    );
    if (persistedStoredSource) return persistedStoredSource;

    const persistedUrl = persistedTask
        ? getTaskResultUrlAtIndex(
            (persistedTask.resultUrls || [])
                .map((url) => normalizePersistentResultUrl(url))
                .filter((url): url is string => !!url),
            image.sourceResultIndex
        )
        : undefined;
    if (persistedUrl) return persistedUrl;

    const promptCompletedEntries = buildPromptRecoveryEntries(prompt, promptTasks);
    if (promptCompletedEntries.length === 1) {
        return resolvePromptRecoveryEntrySource(promptCompletedEntries[0]);
    }

    return undefined;
};

export const buildPersistedImageRecoverySignature = (canvases: Canvas[] = []): string => {
    const tokens: string[] = [];

    canvases.forEach((canvas) => {
        const imageNodes = canvas.imageNodes || [];
        const promptNodes = canvas.promptNodes || [];

        imageNodes.forEach((imageNode) => {
            if (!imageNode.url || !imageNode.originalUrl) {
                tokens.push(`img:${canvas.id}:${imageNode.id}`);
            }
        });

        promptNodes.forEach((promptNode) => {
            const recoveryEntries = buildPromptRecoveryEntries(promptNode);
            if (!recoveryEntries.length) return;

            const existingChildren = imageNodes.filter((imageNode) => imageNode.parentPromptId === promptNode.id);
            const seenResultKeys = new Set<string>();

            existingChildren.forEach((imageNode) => {
                const identity = buildImageResultIdentity(imageNode);
                if (identity) {
                    seenResultKeys.add(identity);
                }
                const fallbackIdentity = buildTaskResultIdentity({
                    taskId: imageNode.sourceTaskId,
                    resultIndex: imageNode.sourceResultIndex,
                    url: normalizePersistentResultUrl(imageNode.apiResultUrl || imageNode.originalUrl || imageNode.url),
                });
                if (fallbackIdentity) {
                    seenResultKeys.add(fallbackIdentity);
                }
            });

            const hasMissingRecoveryEntry = recoveryEntries.some((entry) => {
                const identity = buildTaskResultIdentity({
                    taskId: entry.taskId,
                    resultIndex: entry.resultIndex,
                    url: entry.url,
                });
                if (!identity) return false;
                return !seenResultKeys.has(identity);
            });

            if (hasMissingRecoveryEntry) {
                tokens.push(`prompt:${canvas.id}:${promptNode.id}`);
            }
        });
    });

    return tokens.join('|');
};
