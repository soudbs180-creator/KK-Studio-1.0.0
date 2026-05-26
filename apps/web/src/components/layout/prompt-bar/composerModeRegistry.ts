import { Camera, LayoutDashboard, Mic, PackageOpen, Video } from 'lucide-react';

import { type GenerationConfig, GenerationMode } from '../../../types';

export interface PromptBarModeOption {
  mode: GenerationMode;
  label: string;
  icon: typeof Camera;
  color: string;
  activeBg: string;
  activeBorder: string;
}

export const PROMPT_BAR_MODE_REGISTRY: PromptBarModeOption[] = [
  {
    mode: GenerationMode.IMAGE,
    label: '图片',
    icon: Camera,
    color: '#7dd3fc',
    activeBg: 'rgba(14, 165, 233, 0.16)',
    activeBorder: 'rgba(56, 189, 248, 0.4)',
  },
  {
    mode: GenerationMode.VIDEO,
    label: '视频',
    icon: Video,
    color: '#a78bfa',
    activeBg: 'rgba(139, 92, 246, 0.16)',
    activeBorder: 'rgba(167, 139, 250, 0.4)',
  },
  {
    mode: GenerationMode.ECOMMERCE,
    label: '电商',
    icon: PackageOpen,
    color: '#34d399',
    activeBg: 'rgba(16, 185, 129, 0.16)',
    activeBorder: 'rgba(52, 211, 153, 0.4)',
  },
  {
    mode: GenerationMode.AUDIO,
    label: '音乐',
    icon: Mic,
    color: '#f9a8d4',
    activeBg: 'rgba(236, 72, 153, 0.16)',
    activeBorder: 'rgba(244, 114, 182, 0.4)',
  },
  {
    mode: GenerationMode.PPT,
    label: 'PPT',
    icon: LayoutDashboard,
    color: '#fbbf24',
    activeBg: 'rgba(245, 158, 11, 0.16)',
    activeBorder: 'rgba(251, 191, 36, 0.4)',
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
