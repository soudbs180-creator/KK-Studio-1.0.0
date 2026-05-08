import { extractImageUrlsFromPayload } from './openAICompatibleImagePayload.ts';

export type OpenAICompatibleTaskStatus = 'pending' | 'processing' | 'success' | 'failed';

type PayloadRecord = Record<string, unknown>;

export interface OpenAICompatibleTaskProviderRef {
    id: string;
    name: string;
    provider: string;
}

export interface OpenAICompatiblePolledTaskResult {
    urls: string[];
    taskId: string;
    status: OpenAICompatibleTaskStatus;
    provider: string;
    providerName: string;
    keySlotId: string;
    metadata: {
        requestPath: string;
        responseMessage: string;
    };
}

function isRecord(value: unknown): value is PayloadRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getProperty(value: unknown, key: string): unknown {
    return isRecord(value) ? value[key] : undefined;
}

function getPath(value: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, key) => getProperty(current, key), value);
}

function truthyTaskIdCandidate(value: unknown): unknown {
    if (value === undefined || value === null || value === false || value === 0 || value === '') {
        return undefined;
    }
    return value;
}

function firstTruthyTaskId(...values: unknown[]): unknown {
    for (const value of values) {
        const candidate = truthyTaskIdCandidate(value);
        if (candidate !== undefined) return candidate;
    }
    return '';
}

export function extractGenericTaskId(payload: unknown): string {
    return String(firstTruthyTaskId(
        getProperty(payload, 'taskId'),
        getProperty(payload, 'task_id'),
        getProperty(payload, 'id'),
        typeof getProperty(payload, 'data') === 'string' ? getProperty(payload, 'data') : '',
        getPath(payload, ['data', 'taskId']),
        getPath(payload, ['data', 'task_id']),
        getPath(payload, ['data', 'id']),
        getPath(payload, ['result', 'taskId']),
        getPath(payload, ['result', 'task_id']),
        getPath(payload, ['result', 'id']),
    )).trim();
}

export function mapGenericTaskStatus(payload: unknown): OpenAICompatibleTaskStatus {
    const urls = extractImageUrlsFromPayload(payload);
    if (urls.length > 0) {
        return 'success';
    }

    const statusCandidates = [
        getProperty(payload, 'status'),
        getProperty(payload, 'state'),
        getProperty(payload, 'task_status'),
        getProperty(payload, 'taskStatus'),
        getPath(payload, ['data', 'status']),
        getPath(payload, ['data', 'state']),
        getPath(payload, ['data', 'task_status']),
        getPath(payload, ['data', 'taskStatus']),
        getPath(payload, ['result', 'status']),
        getPath(payload, ['result', 'state']),
        getPath(payload, ['output', 'status']),
        getPath(payload, ['output', 'state']),
    ];

    for (const candidate of statusCandidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            if (candidate === 2 || candidate === 1) return candidate === 2 ? 'success' : 'processing';
            if (candidate === 3 || candidate === 7 || candidate === 8) return 'failed';
            if (candidate === 5 || candidate === 10) return candidate === 10 ? 'processing' : 'pending';
        }

        if (typeof candidate !== 'string') continue;
        const normalized = candidate.trim().toLowerCase();
        if (!normalized) continue;
        if (
            normalized.includes('success')
            || normalized === 'complete'
            || normalized.includes('completed')
            || normalized.includes('partial_complete')
            || normalized.includes('partial-complete')
            || (normalized.includes('partial') && normalized.includes('complete'))
            || normalized.includes('finish')
            || normalized === 'done'
        ) {
            return 'success';
        }
        if (
            normalized.includes('fail')
            || normalized.includes('error')
            || normalized.includes('cancel')
            || normalized.includes('reject')
        ) {
            return 'failed';
        }
        if (
            normalized.includes('process')
            || normalized.includes('running')
            || normalized.includes('progress')
            || normalized.includes('execut')
        ) {
            return 'processing';
        }
        if (
            normalized.includes('pending')
            || normalized.includes('queue')
            || normalized.includes('wait')
            || normalized.includes('submit')
            || normalized.includes('created')
        ) {
            return 'pending';
        }
    }

    if (getProperty(payload, 'finished') === true || getProperty(payload, 'success') === true) {
        return urls.length > 0 ? 'success' : 'processing';
    }

    return 'processing';
}

export function extractTaskItemsFromPayload(payload: unknown): PayloadRecord[] {
    const items: PayloadRecord[] = [];
    const pushItems = (value: unknown): void => {
        if (!Array.isArray(value)) return;
        value.forEach((item) => {
            if (isRecord(item)) {
                items.push(item);
            }
        });
    };

    pushItems(getProperty(payload, 'data'));
    pushItems(getProperty(payload, 'result'));
    pushItems(getProperty(payload, 'output'));
    pushItems(getProperty(payload, 'records'));
    pushItems(getProperty(payload, 'list'));
    pushItems(getProperty(payload, 'items'));
    pushItems(getPath(payload, ['data', 'records']));
    pushItems(getPath(payload, ['data', 'list']));
    pushItems(getPath(payload, ['data', 'items']));
    pushItems(getPath(payload, ['result', 'records']));
    pushItems(getPath(payload, ['result', 'list']));
    pushItems(getPath(payload, ['result', 'items']));

    return items;
}

export function extractProviderMessage(payload: unknown): string {
    const candidates = [
        getProperty(payload, 'msg'),
        getProperty(payload, 'message'),
        getProperty(payload, 'error'),
        getPath(payload, ['error', 'message']),
        getPath(payload, ['data', 'message']),
        getPath(payload, ['data', 'msg']),
        getPath(payload, ['data', 'error']),
        getPath(payload, ['data', 'error', 'message']),
        getPath(payload, ['result', 'message']),
        getPath(payload, ['result', 'error']),
        getPath(payload, ['result', 'error', 'message']),
        getPath(payload, ['debug', 'message']),
        getProperty(payload, 'debug'),
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    return '';
}

export function buildOpenAICompatiblePolledTaskResult(params: {
    payload: unknown;
    taskId: string;
    requestPath: string;
    keySlot: OpenAICompatibleTaskProviderRef;
}): OpenAICompatiblePolledTaskResult {
    const status = mapGenericTaskStatus(params.payload);
    const urls = status === 'success' ? extractImageUrlsFromPayload(params.payload) : [];
    const effectiveStatus = status === 'success' && urls.length === 0 ? 'processing' : status;
    return {
        urls,
        taskId: params.taskId,
        status: effectiveStatus,
        provider: params.keySlot.provider,
        providerName: params.keySlot.name,
        keySlotId: params.keySlot.id,
        metadata: {
            requestPath: params.requestPath,
            responseMessage: extractProviderMessage(params.payload),
        },
    };
}
