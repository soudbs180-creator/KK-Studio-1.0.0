import { useCallback, useRef } from 'react';

import { GenerationMode, type GenerationConfig } from '../types';

const GENERATE_TRIGGER_COOLDOWN_MS = 500;
const GENERATE_SIGNATURE_DEDUP_MS = 4000;

type GenerationSubmitGuardConfig = Pick<
  GenerationConfig,
  'prompt' | 'model' | 'mode' | 'aspectRatio' | 'imageSize' | 'parallelCount' | 'referenceImages'
>;

type TryStartGenerationSubmissionArgs = {
  config: GenerationSubmitGuardConfig;
  promptOverride?: string;
  activeSourceImage: string | null;
};

type GenerationSubmitGuardAllowedResult = {
  allowed: true;
  isEcommerce: boolean;
  trimmedPrompt: string;
};

type GenerationSubmitGuardBlockedResult = {
  allowed: false;
  reason: 'cooldown' | 'duplicate-signature' | 'empty-prompt';
};

export interface UseGenerationSubmitGuardDeps {
  now?: () => number;
}

export interface UseGenerationSubmitGuardResult {
  tryStartGenerationSubmission: (
    args: TryStartGenerationSubmissionArgs,
  ) => GenerationSubmitGuardAllowedResult | GenerationSubmitGuardBlockedResult;
}

export function useGenerationSubmitGuard({
  now: getNow = Date.now,
}: UseGenerationSubmitGuardDeps = {}): UseGenerationSubmitGuardResult {
  const lastGenerateAtRef = useRef(0);
  const lastGenerateSignatureRef = useRef<{ value: string; at: number } | null>(null);

  const tryStartGenerationSubmission = useCallback(({
    config,
    promptOverride,
    activeSourceImage,
  }: TryStartGenerationSubmissionArgs): GenerationSubmitGuardAllowedResult | GenerationSubmitGuardBlockedResult => {
    const now = getNow();
    const cooldownRemaining = GENERATE_TRIGGER_COOLDOWN_MS - (now - lastGenerateAtRef.current);
    if (cooldownRemaining > 0) {
      console.warn('[handleGenerate] blocked duplicate trigger');
      return { allowed: false, reason: 'cooldown' };
    }

    const promptText = promptOverride ?? config.prompt;
    const trimmedPrompt = promptText.trim();
    if (config.mode === GenerationMode.ECOMMERCE) {
      return { allowed: true, isEcommerce: true, trimmedPrompt };
    }

    if (!trimmedPrompt) {
      return { allowed: false, reason: 'empty-prompt' };
    }

    const submitSignature = JSON.stringify({
      prompt: trimmedPrompt,
      model: config.model,
      mode: config.mode,
      aspectRatio: config.aspectRatio,
      imageSize: config.imageSize,
      parallelCount: config.parallelCount || 1,
      sourceImageId: activeSourceImage || '',
      referenceImages: (config.referenceImages || [])
        .map(img => img.id || img.storageId || img.url || '')
        .sort(),
    });
    const lastSignature = lastGenerateSignatureRef.current;
    if (lastSignature && lastSignature.value === submitSignature && (now - lastSignature.at) < GENERATE_SIGNATURE_DEDUP_MS) {
      console.warn('[handleGenerate] blocked repeated identical submission');
      import('../services/system/notificationService').then(({ notify }) => {
        notify.warning('已拦截重复发送', '检测到相同内容短时间内重复提交，已阻止再次请求以避免重复扣费。');
      });
      return { allowed: false, reason: 'duplicate-signature' };
    }

    lastGenerateAtRef.current = now;
    lastGenerateSignatureRef.current = { value: submitSignature, at: now };

    return { allowed: true, isEcommerce: false, trimmedPrompt };
  }, [getNow]);

  return { tryStartGenerationSubmission };
}
