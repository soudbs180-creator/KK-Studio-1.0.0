export interface LocalPerformanceTraceRecord {
  name: string;
  durationMs: number;
  timestamp: number;
  detail?: Record<string, unknown>;
}

export interface LocalPerformanceTraceSummaryOptions {
  limit?: number;
  namePrefix?: string;
}

export interface LocalPerformanceTraceSummaryEntry {
  name: string;
  count: number;
  latestDurationMs: number;
  latestTimestamp: number;
  maxDurationMs: number;
  avgDurationMs: number;
  latestDetail?: Record<string, unknown>;
}

interface LocalPerformanceTraceStore {
  records: LocalPerformanceTraceRecord[];
  clear?: () => void;
  summary?: (
    options?: LocalPerformanceTraceSummaryOptions | string
  ) => LocalPerformanceTraceSummaryEntry[];
}

const GLOBAL_PERF_TRACE_KEY = '__KK_PERF__';
const MAX_LOCAL_PERFORMANCE_MEASURES = 120;
const DEFAULT_LOCAL_PERFORMANCE_SUMMARY_LIMIT = 12;
const PERF_MARK_PREFIX = 'kk-studio-local-perf';

const canUsePerformanceMarks = (): boolean => (
  typeof performance !== 'undefined'
  && typeof performance.mark === 'function'
  && typeof performance.measure === 'function'
  && typeof performance.getEntriesByName === 'function'
);

const isPromiseLike = <T>(value: PromiseLike<T> | T): value is PromiseLike<T> => (
  value !== null
  && value !== undefined
  && typeof (value as PromiseLike<T>).then === 'function'
);

const attachLocalPerformanceTraceStoreHelpers = (store: LocalPerformanceTraceStore): LocalPerformanceTraceStore => {
  store.clear = clearLocalPerformanceTraceRecords;
  store.summary = (options?: LocalPerformanceTraceSummaryOptions | string) => (
    typeof options === 'string'
      ? summarizeLocalPerformanceTraces({ namePrefix: options })
      : summarizeLocalPerformanceTraces(options)
  );

  return store;
};

const getLocalPerformanceTraceStore = (): LocalPerformanceTraceStore => {
  const host = globalThis as typeof globalThis & Record<string, unknown>;
  const existingStore = host[GLOBAL_PERF_TRACE_KEY];

  if (
    existingStore
    && typeof existingStore === 'object'
    && Array.isArray((existingStore as LocalPerformanceTraceStore).records)
  ) {
    return attachLocalPerformanceTraceStoreHelpers(existingStore as LocalPerformanceTraceStore);
  }

  const nextStore: LocalPerformanceTraceStore = { records: [] };
  host[GLOBAL_PERF_TRACE_KEY] = attachLocalPerformanceTraceStoreHelpers(nextStore);
  return host[GLOBAL_PERF_TRACE_KEY] as LocalPerformanceTraceStore;
};

const pushLocalPerformanceTraceRecord = (record: LocalPerformanceTraceRecord): void => {
  const store = getLocalPerformanceTraceStore();
  const records = [...store.records, record];
  store.records = records.slice(-MAX_LOCAL_PERFORMANCE_MEASURES);
};

export function readLocalPerformanceTraceRecords(): LocalPerformanceTraceRecord[] {
  return [...getLocalPerformanceTraceStore().records];
}

export function clearLocalPerformanceTraceRecords(): void {
  getLocalPerformanceTraceStore().records = [];
}

export function summarizeLocalPerformanceTraces(
  options: LocalPerformanceTraceSummaryOptions = {}
): LocalPerformanceTraceSummaryEntry[] {
  const {
    limit = DEFAULT_LOCAL_PERFORMANCE_SUMMARY_LIMIT,
    namePrefix,
  } = options;
  const matchingRecords = readLocalPerformanceTraceRecords().filter((record) => (
    !namePrefix || record.name.startsWith(namePrefix)
  ));
  const summaryByName = new Map<string, LocalPerformanceTraceSummaryEntry>();

  matchingRecords.forEach((record) => {
    const existing = summaryByName.get(record.name);
    if (!existing) {
      summaryByName.set(record.name, {
        name: record.name,
        count: 1,
        latestDurationMs: record.durationMs,
        latestTimestamp: record.timestamp,
        maxDurationMs: record.durationMs,
        avgDurationMs: record.durationMs,
        latestDetail: record.detail,
      });
      return;
    }

    const nextCount = existing.count + 1;
    const isLatest = record.timestamp >= existing.latestTimestamp;
    summaryByName.set(record.name, {
      name: record.name,
      count: nextCount,
      latestDurationMs: isLatest ? record.durationMs : existing.latestDurationMs,
      latestTimestamp: isLatest ? record.timestamp : existing.latestTimestamp,
      maxDurationMs: Math.max(existing.maxDurationMs, record.durationMs),
      avgDurationMs: ((existing.avgDurationMs * existing.count) + record.durationMs) / nextCount,
      latestDetail: isLatest ? record.detail : existing.latestDetail,
    });
  });

  return Array.from(summaryByName.values())
    .sort((left, right) => {
      if (right.maxDurationMs !== left.maxDurationMs) {
        return right.maxDurationMs - left.maxDurationMs;
      }

      return right.latestTimestamp - left.latestTimestamp;
    })
    .slice(0, Math.max(0, limit));
}

const finalizeLocalPerformanceTrace = (
  name: string,
  startMark: string,
  endMark: string,
  startedAt: number,
  detail?: Record<string, unknown>
): void => {
  const usesPerformanceMarks = canUsePerformanceMarks();
  const finishedAt = usesPerformanceMarks ? performance.now() : Date.now();
  let durationMs = Math.max(0, finishedAt - startedAt);

  if (usesPerformanceMarks) {
    const measureName = `${startMark}:measure`;
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    const measures = performance.getEntriesByName(measureName);
    const latestMeasure = measures[measures.length - 1];
    if (latestMeasure && Number.isFinite(latestMeasure.duration)) {
      durationMs = Math.max(0, latestMeasure.duration);
    }
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }

  pushLocalPerformanceTraceRecord({
    name,
    durationMs,
    timestamp: Date.now(),
    detail,
  });
};

export function traceLocalPerformance<T>(
  name: string,
  work: () => Promise<T>,
  detail?: Record<string, unknown>
): Promise<T>;
export function traceLocalPerformance<T>(
  name: string,
  work: () => T,
  detail?: Record<string, unknown>
): T;
export function traceLocalPerformance<T>(
  name: string,
  work: () => T | Promise<T>,
  detail?: Record<string, unknown>
): T | Promise<T> {
  const usesPerformanceMarks = canUsePerformanceMarks();
  const traceId = `${PERF_MARK_PREFIX}:${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const startMark = `${traceId}:start`;
  const endMark = `${traceId}:end`;
  const startedAt = usesPerformanceMarks ? performance.now() : Date.now();

  if (usesPerformanceMarks) {
    performance.mark(startMark);
  }

  try {
    const result = work();

    if (isPromiseLike(result)) {
      return Promise.resolve(result).finally(() => {
        finalizeLocalPerformanceTrace(name, startMark, endMark, startedAt, detail);
      });
    }

    finalizeLocalPerformanceTrace(name, startMark, endMark, startedAt, detail);
    return result;
  } catch (error) {
    finalizeLocalPerformanceTrace(name, startMark, endMark, startedAt, detail);
    throw error;
  }
}
