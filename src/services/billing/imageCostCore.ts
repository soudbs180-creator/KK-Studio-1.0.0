export interface ResolveImageCostOptions {
  model: string
  imageSize?: string
  count?: number
  prompt?: string
  promptLength?: number
  referenceImageCount?: number
  keySlotId?: string
  explicitCost?: unknown
  storedCost?: unknown
  storedCostSource?: unknown
}

export interface ResolvedImageCost {
  cost: number
  source: 'snapshot' | 'explicit' | 'stored' | 'estimated' | 'none'
  usedPricingSnapshot: boolean
}

export interface CalculatedImageCost {
  cost: number
  details: string
  tokens: number
}

type SnapshotMap = Record<string, any>

interface PricingSnapshotLike {
  modelPrices?: SnapshotMap
  modelRatios?: SnapshotMap
  groupRatio?: unknown
  groupRatioMap?: SnapshotMap
  groupModelRatios?: SnapshotMap
  groupModelRatioMaps?: Record<string, SnapshotMap | undefined>
  sizeRatios?: Record<string, Record<string, number> | undefined>
  groupSizeRatios?: Record<string, Record<string, Record<string, number> | undefined> | undefined>
  completionRatios?: SnapshotMap
  groupModelPrices?: Record<string, SnapshotMap | undefined>
}

interface KeySlotLike {
  group?: string
}

interface ProviderLike {
  group?: string
  pricingSnapshot?: PricingSnapshotLike
}

export interface ImageCostResolver {
  getEffectiveKey?: (keySlotId?: string) => KeySlotLike | undefined
  getKey?: (keySlotId?: string) => KeySlotLike | undefined
  getProviderForKeySlot?: (keySlotId?: string) => ProviderLike | undefined
  isOfficialBuiltinSlot?: (keySlotId?: string) => boolean
  estimateFallbackCost?: (input: {
    fullModelId: string
    size: string
    count: number
    promptLen: number
    refCount: number
    keySlotId?: string
  }) => number | undefined
}

export function parseModelSource(fullModelId: string): { modelId: string; source: string } {
  if (!fullModelId) return { modelId: 'Unknown', source: 'Unknown' }

  if (fullModelId.includes('@')) {
    const [model, source] = fullModelId.split('@')
    return {
      modelId: model.split('|')[0].replace(/^models\//, ''),
      source: source || 'Custom'
    }
  }

  return {
    modelId: fullModelId.split('|')[0].replace(/^models\//, ''),
    source: 'Official'
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function getSnapshotNumber(source: SnapshotMap | undefined, key: string): number | undefined {
  if (!source) return undefined

  const direct = source[key]
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  if (typeof direct === 'string' && direct.trim() !== '') {
    const parsed = Number(direct)
    if (Number.isFinite(parsed)) return parsed
  }

  const caseInsensitiveKey = Object.keys(source).find((entry) => entry.toLowerCase() === key.toLowerCase())
  if (!caseInsensitiveKey) return undefined

  const fallback = source[caseInsensitiveKey]
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  if (typeof fallback === 'string' && fallback.trim() !== '') {
    const parsed = Number(fallback)
    if (Number.isFinite(parsed)) return parsed
  }

  return undefined
}

function findDefaultGroupKey(map: Record<string, unknown> | undefined): string | undefined {
  if (!map) return undefined
  return Object.keys(map).find((key) => key.trim().toLowerCase() === 'default')
}

function resolveSnapshotGroupRatio(groupRatio: unknown, options?: { allowArbitraryFallback?: boolean }): number {
  if (typeof groupRatio === 'number' && Number.isFinite(groupRatio)) return groupRatio

  if (groupRatio && typeof groupRatio === 'object' && !Array.isArray(groupRatio)) {
    const map = groupRatio as Record<string, unknown>
    const defaultKey = findDefaultGroupKey(map)
    const direct =
      (defaultKey ? map[defaultKey] : undefined) ??
      (options?.allowArbitraryFallback === false
        ? undefined
        : Object.values(map).find((value) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')))

    if (typeof direct === 'number' && Number.isFinite(direct)) return direct
    if (typeof direct === 'string' && direct.trim() !== '') {
      const parsed = Number(direct)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return 1
}

function resolveSizeRatio(sizeRatioMap: Record<string, number> | undefined, size: string): number {
  if (!sizeRatioMap) return 1

  const rawSize = typeof size === 'object' && size !== null && 'width' in size && 'height' in size
    ? `${(size as any).width}x${(size as any).height}`
    : String(size || '')

  const normalized = rawSize.toLowerCase()
  const candidates = new Set<string>([
    rawSize,
    normalized,
    rawSize.replace(/x/gi, '*'),
    normalized.replace(/x/gi, '*')
  ])

  if (normalized === '1k' || normalized === '1024x1024') {
    candidates.add('1K')
    candidates.add('1024x1024')
    candidates.add('1024*1024')
  } else if (normalized === '2k' || normalized === '2048x2048') {
    candidates.add('2K')
    candidates.add('2048x2048')
    candidates.add('2048*2048')
  } else if (normalized === '4k' || normalized === '4096x4096') {
    candidates.add('4K')
    candidates.add('4096x4096')
    candidates.add('4096*4096')
  }

  for (const candidate of candidates) {
    const ratio = getSnapshotNumber(sizeRatioMap as SnapshotMap, candidate)
    if (ratio !== undefined) return ratio
  }

  return 1
}

function getPreferredGroupKey(preferredGroup: string | undefined, map: SnapshotMap | undefined): string | undefined {
  if (!map) return undefined

  if (preferredGroup) {
    const exact = Object.keys(map).find((key) => key === preferredGroup)
    if (exact) return exact

    const normalized = preferredGroup.trim().toLowerCase()
    const insensitive = Object.keys(map).find((key) => key.trim().toLowerCase() === normalized)
    if (insensitive) return insensitive

    return findDefaultGroupKey(map)
  }

  return findDefaultGroupKey(map) || Object.keys(map)[0]
}

function getScopedGroupEntry<T>(map: Record<string, T> | undefined, preferredGroup: string | undefined): T | undefined {
  if (!map) return undefined

  const groupKey = getPreferredGroupKey(preferredGroup, map)
  if (groupKey) return map[groupKey]

  if (preferredGroup && preferredGroup.trim() !== '') {
    return undefined
  }

  return Object.values(map)[0]
}

function getSnapshotContext(keySlotId: string | undefined, resolver: ImageCostResolver) {
  if (!keySlotId) return undefined

  const provider = resolver.getProviderForKeySlot?.(keySlotId)
  if (!provider?.pricingSnapshot) return undefined

  const slot = resolver.getEffectiveKey?.(keySlotId) || resolver.getKey?.(keySlotId)

  return {
    slot,
    provider,
    snapshot: provider.pricingSnapshot
  }
}

export function hasPricingSnapshotForKeySlotWithResolver(keySlotId: string | undefined, resolver: ImageCostResolver): boolean {
  return Boolean(getSnapshotContext(keySlotId, resolver))
}

export function calculateSnapshotCost(
  fullModelId: string,
  size: string,
  count: number,
  promptLen = 0,
  refCount = 0,
  keySlotId: string | undefined,
  resolver: ImageCostResolver
): CalculatedImageCost | undefined {
  const context = getSnapshotContext(keySlotId, resolver)
  if (!context) return undefined

  const { modelId } = parseModelSource(fullModelId)
  const normalizedId = modelId.toLowerCase()
  const { slot, provider, snapshot } = context
  const preferredGroup = slot?.group || provider.group
  const hasExplicitPreferredGroup = Boolean(preferredGroup && preferredGroup.trim() !== '')

  const modelPrice = getSnapshotNumber(snapshot.modelPrices, modelId) ?? getSnapshotNumber(snapshot.modelPrices, normalizedId)
  let modelRatio = getSnapshotNumber(snapshot.modelRatios, modelId) ?? getSnapshotNumber(snapshot.modelRatios, normalizedId)

  const groupRatioKey = getPreferredGroupKey(preferredGroup, snapshot.groupRatioMap)
  const groupRatio =
    (groupRatioKey ? getSnapshotNumber(snapshot.groupRatioMap, groupRatioKey) : undefined) ??
    (hasExplicitPreferredGroup && snapshot.groupRatioMap
      ? 1
      : resolveSnapshotGroupRatio(snapshot.groupRatioMap ?? snapshot.groupRatio, {
          allowArbitraryFallback: !hasExplicitPreferredGroup
        }))

  const groupModelRatioMap = snapshot.groupModelRatioMaps?.[modelId] || snapshot.groupModelRatioMaps?.[normalizedId]
  const groupModelRatioKey = getPreferredGroupKey(preferredGroup, groupModelRatioMap)
  const groupModelRatio =
    (groupModelRatioKey ? getSnapshotNumber(groupModelRatioMap, groupModelRatioKey) : undefined) ??
    (groupModelRatioMap && hasExplicitPreferredGroup
      ? undefined
      : getSnapshotNumber(snapshot.groupModelRatios, modelId) ??
        getSnapshotNumber(snapshot.groupModelRatios, normalizedId)) ??
    1

  const sizeRatioObject = snapshot.sizeRatios?.[modelId] || snapshot.sizeRatios?.[normalizedId]
  const groupSizeMap = snapshot.groupSizeRatios?.[modelId] || snapshot.groupSizeRatios?.[normalizedId]
  const groupSizeRatioObject = getScopedGroupEntry(groupSizeMap, preferredGroup)
  const sizeRatio = Math.max(resolveSizeRatio(sizeRatioObject, size), resolveSizeRatio(groupSizeRatioObject, size))

  if (modelPrice !== undefined) {
    const cost = modelPrice * groupRatio * groupModelRatio * sizeRatio * count
    return {
      cost,
      details: `Snapshot fixed: $${modelPrice}/img | group=${preferredGroup || groupRatioKey || 'default'} | size x${sizeRatio}`,
      tokens: 0
    }
  }

  if (modelRatio === undefined) return undefined

  const textTokens = Math.ceil(promptLen / 4)
  const refTokens = refCount * 560
  const inputTokens = textTokens + refTokens

  let completionRatio =
    getSnapshotNumber(snapshot.completionRatios, modelId) ??
    getSnapshotNumber(snapshot.completionRatios, normalizedId) ??
    1

  const groupPriceMap = snapshot.groupModelPrices?.[modelId] || snapshot.groupModelPrices?.[normalizedId]
  const groupPriceKey = getPreferredGroupKey(preferredGroup, groupPriceMap)
  const groupPriceOverride = getScopedGroupEntry(groupPriceMap, preferredGroup)

  const overrideModelPrice = getSnapshotNumber(groupPriceOverride as SnapshotMap | undefined, 'modelPrice')
  const overrideModelRatio = getSnapshotNumber(groupPriceOverride as SnapshotMap | undefined, 'modelRatio')
  const overrideCompletionRatio = getSnapshotNumber(groupPriceOverride as SnapshotMap | undefined, 'completionRatio')

  if (overrideModelPrice !== undefined) {
    const cost = overrideModelPrice * groupRatio * sizeRatio * count
    return {
      cost,
      details: `Snapshot fixed override: $${overrideModelPrice}/img | group=${preferredGroup || groupPriceKey || 'default'} | size x${sizeRatio}`,
      tokens: 0
    }
  }

  if (overrideModelRatio !== undefined) {
    modelRatio = overrideModelRatio
  }

  if (overrideCompletionRatio !== undefined) {
    completionRatio = overrideCompletionRatio
  }

  const outputTokensPerImage = normalizedId.includes('nano-banana')
    ? (String(size).toLowerCase() === '4k' || String(size).toLowerCase() === '4096x4096' ? 2068 : 1034)
    : 1034
  const outputTokens = count * outputTokensPerImage

  const baseRate = 2.0 / 1_000_000
  const inputCost = inputTokens * baseRate * modelRatio * groupRatio * groupModelRatio
  const outputCost = outputTokens * baseRate * modelRatio * completionRatio * sizeRatio * groupRatio * groupModelRatio
  const cost = Math.max(0.000001, inputCost + outputCost)

  return {
    cost,
    details: `Snapshot token pricing | group=${preferredGroup || groupRatioKey || 'default'} | size x${sizeRatio}`,
    tokens: inputTokens + outputTokens
  }
}

export function resolveImageCostWithResolver(
  options: ResolveImageCostOptions,
  resolver: ImageCostResolver
): ResolvedImageCost {
  const imageSize = options.imageSize || '1K'
  const count = Math.max(1, Number(options.count || 1))
  const promptLength = typeof options.promptLength === 'number'
    ? Math.max(0, options.promptLength)
    : String(options.prompt || '').length
  const referenceImageCount = Math.max(0, Number(options.referenceImageCount || 0))
  const explicitCost = toFiniteNumber(options.explicitCost)
  const storedCost = toFiniteNumber(options.storedCost)
  const usedPricingSnapshot = hasPricingSnapshotForKeySlotWithResolver(options.keySlotId, resolver)
  const normalizedStoredCostSource = typeof options.storedCostSource === 'string'
    ? options.storedCostSource.trim().toLowerCase()
    : ''
  const trustedStoredCostSource = normalizedStoredCostSource === 'explicit' || normalizedStoredCostSource === 'snapshot'
    ? normalizedStoredCostSource
    : undefined
  const isKeyedModelWithoutPricingSnapshot = Boolean(options.keySlotId) && !usedPricingSnapshot
  const canUseFallbackEstimateForKeyedModel = !isKeyedModelWithoutPricingSnapshot
    || resolver.isOfficialBuiltinSlot?.(options.keySlotId) === true

  const estimateCost = (): number | undefined => {
    const snapshotEstimate = calculateSnapshotCost(
      options.model,
      imageSize,
      count,
      promptLength,
      referenceImageCount,
      options.keySlotId,
      resolver
    )

    if (snapshotEstimate) return snapshotEstimate.cost

    return resolver.estimateFallbackCost?.({
      fullModelId: options.model,
      size: imageSize,
      count,
      promptLen: promptLength,
      refCount: referenceImageCount,
      keySlotId: options.keySlotId
    })
  }

  if (usedPricingSnapshot) {
    const snapshotCost = estimateCost()
    if (snapshotCost !== undefined && snapshotCost > 0) {
      return { cost: snapshotCost, source: 'snapshot', usedPricingSnapshot }
    }
  }

  if (isKeyedModelWithoutPricingSnapshot && !canUseFallbackEstimateForKeyedModel) {
    if (explicitCost !== undefined) {
      return { cost: explicitCost, source: 'explicit', usedPricingSnapshot }
    }

    if (trustedStoredCostSource && storedCost !== undefined) {
      return {
        cost: storedCost,
        source: trustedStoredCostSource,
        usedPricingSnapshot
      }
    }

    return { cost: 0, source: 'none', usedPricingSnapshot }
  }

  if (explicitCost !== undefined && (explicitCost > 0 || !options.keySlotId)) {
    return { cost: explicitCost, source: 'explicit', usedPricingSnapshot }
  }

  if (storedCost !== undefined && (storedCost > 0 || !options.keySlotId)) {
    return { cost: storedCost, source: 'stored', usedPricingSnapshot }
  }

  const estimatedCost = estimateCost()
  if (estimatedCost !== undefined && (estimatedCost > 0 || (explicitCost === undefined && storedCost === undefined))) {
    return { cost: estimatedCost, source: 'estimated', usedPricingSnapshot }
  }

  if (explicitCost !== undefined) {
    return { cost: explicitCost, source: 'explicit', usedPricingSnapshot }
  }

  if (storedCost !== undefined) {
    return { cost: storedCost, source: 'stored', usedPricingSnapshot }
  }

  return { cost: 0, source: 'none', usedPricingSnapshot }
}
