import { Camera, LayoutDashboard, Mic, PackageOpen, Video } from 'lucide-react';

import { type GenerationConfig, GenerationMode } from '../../../types';

export interface PromptBarModeOption {
  mode: GenerationMode;
  label: string;
  icon: typeof Camera;
}

export const PROMPT_BAR_MODE_REGISTRY: PromptBarModeOption[] = [
  {
    mode: GenerationMode.IMAGE,
    label: '图片',
    icon: Camera,
  },
  {
    mode: GenerationMode.VIDEO,
    label: '视频',
    icon: Video,
  },
  {
    mode: GenerationMode.ECOMMERCE,
    label: '电商',
    icon: PackageOpen,
  },
  {
    mode: GenerationMode.AUDIO,
    label: '音乐',
    icon: Mic,
  },
  {
    mode: GenerationMode.PPT,
    label: 'PPT',
    icon: LayoutDashboard,
  },
];

export function getPromptBarModeOption(mode: GenerationMode): PromptBarModeOption {
  return PROMPT_BAR_MODE_REGISTRY.find((item) => item.mode === mode) ?? PROMPT_BAR_MODE_REGISTRY[0];
}

export function getPromptBarModePatch(
  previousConfig: GenerationConfig,
  mode: GenerationMode,
): Partial<GenerationConfig> {
  if (mode === GenerationMode.PPT) {
    return {
      mode,
      parallelCount: Math.min(20, Math.max(1, previousConfig.parallelCount || 6)),
      pptStyleLocked: previousConfig.pptStyleLocked !== false,
    };
  }

  return {
    mode,
    parallelCount: Math.min(4, Math.max(1, previousConfig.parallelCount || 1)),
  };
}
