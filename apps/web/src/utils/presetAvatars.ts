import presetArrowo from '../assets/avatars/preset-arrowo.svg';
import presetBlobcap from '../assets/avatars/preset-blobcap.svg';
import presetCloudy from '../assets/avatars/preset-cloudy.svg';
import presetKitty from '../assets/avatars/preset-kitty.svg';
import presetPeepy from '../assets/avatars/preset-peepy.svg';
import presetSpark from '../assets/avatars/preset-spark.svg';

export type PresetAvatarId =
  | 'preset:peepy'
  | 'preset:spark'
  | 'preset:kitty'
  | 'preset:blobcap'
  | 'preset:arrowo'
  | 'preset:cloudy';

type LegacyPresetAvatarId =
  | 'preset:male-1'
  | 'preset:male-2'
  | 'preset:male-3'
  | 'preset:female-1'
  | 'preset:female-2'
  | 'preset:female-3';

export interface PresetAvatarOption {
  id: PresetAvatarId;
  label: string;
  url: string;
}

export const PRESET_AVATAR_OPTIONS: PresetAvatarOption[] = [
  { id: 'preset:peepy', label: '\u6843\u6843\u56e2', url: presetPeepy },
  { id: 'preset:spark', label: '\u8f6f\u7cd6\u661f', url: presetSpark },
  { id: 'preset:kitty', label: '\u5154\u5154\u4e91', url: presetKitty },
  { id: 'preset:blobcap', label: '\u8584\u8377\u6ef4', url: presetBlobcap },
  { id: 'preset:arrowo', label: '\u82b1\u82b1\u56e2', url: presetArrowo },
  { id: 'preset:cloudy', label: '\u56e2\u5b50\u718a', url: presetCloudy },
];

const PRESET_AVATAR_MAP = new Map<PresetAvatarId, PresetAvatarOption>(
  PRESET_AVATAR_OPTIONS.map((option) => [option.id, option])
);

const LEGACY_PRESET_ALIAS_MAP: Record<LegacyPresetAvatarId, PresetAvatarId> = {
  'preset:male-1': 'preset:peepy',
  'preset:male-2': 'preset:blobcap',
  'preset:male-3': 'preset:arrowo',
  'preset:female-1': 'preset:spark',
  'preset:female-2': 'preset:kitty',
  'preset:female-3': 'preset:cloudy',
};

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function normalizePresetAvatarId(value?: string | null): PresetAvatarId | undefined {
  if (!value) return undefined;
  if (PRESET_AVATAR_MAP.has(value as PresetAvatarId)) {
    return value as PresetAvatarId;
  }
  return LEGACY_PRESET_ALIAS_MAP[value as LegacyPresetAvatarId];
}

export function getPresetAvatarById(value?: string | null): PresetAvatarOption | undefined {
  const normalizedId = normalizePresetAvatarId(value);
  if (!normalizedId) return undefined;
  return PRESET_AVATAR_MAP.get(normalizedId);
}

export function resolveAvatarUrl(value?: string | null): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return undefined;
  return getPresetAvatarById(trimmed)?.url || trimmed;
}

export function getDefaultPresetAvatarId(seed?: string | null): PresetAvatarId {
  const normalizedSeed = typeof seed === 'string' ? seed.trim() : '';
  if (!normalizedSeed) {
    return PRESET_AVATAR_OPTIONS[0].id;
  }

  const index = hashSeed(normalizedSeed) % PRESET_AVATAR_OPTIONS.length;
  return PRESET_AVATAR_OPTIONS[index].id;
}
