import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import {
  isCapabilityRouteAssignmentModelDisabled,
  resolveEnabledCapabilityRouteAssignment,
  subscribeCapabilityRouteAssignments,
} from '../../../../services/api/capabilityRouteAssignments';
import { keyManager } from '../../../../services/auth/keyManager';

export interface ChatModel {
  id: string;
  name: string;
  provider: string;
  isCustom: boolean;
  isSystemInternal?: boolean;
  type?: 'chat' | 'image' | 'video' | 'image+chat' | 'audio';
  isVision?: boolean;
  icon?: string;
  displayName?: string;
  description?: string;
  creditCost?: number;
}

interface ChatModelCatalogOptions {
  canBrowseSystemCreditModels: boolean;
  onSelectedModelChange: (model: ChatModel) => void;
  selectedModel: ChatModel;
  setSelectedModel: (model: ChatModel) => void;
}

interface ChatModelCatalogState {
  availableModels: ChatModel[];
  setAvailableModels: Dispatch<SetStateAction<ChatModel[]>>;
}

const DEFAULT_CHAT_MODEL: ChatModel = {
  id: 'gemini-2.5-flash',
  name: 'Gemini 2.5 Flash',
  provider: 'Google',
  isCustom: false,
};

function supportsVision(model: ChatModel): boolean {
  const modelId = model.id.toLowerCase();
  return model.type === 'image+chat'
    || modelId.includes('vision')
    || modelId.includes('gpt-4o')
    || modelId.includes('gemini-2.0')
    || modelId.includes('claude-3-5')
    || modelId.includes('gemini-1.5')
    || modelId.includes('gemini-2.5')
    || modelId.includes('grok-2-vision');
}

function isChatModel(model: ChatModel, includeSystemCreditModels: boolean): boolean {
  if (model.isSystemInternal && !includeSystemCreditModels) return false;
  if (model.type === 'image') return true;
  if (model.type === 'video') return false;
  const modelId = model.id.toLowerCase();
  if (['flux', 'midjourney', 'dall-e', 'stable-diffusion', 'sdxl'].some((token) => modelId.includes(token))) return false;
  if (modelId.includes('nano') && modelId.includes('banana') && model.type !== 'image+chat') return false;
  return model.type === 'chat' || model.type === 'image+chat';
}

/** Builds the deduplicated model catalog consumed by the chat shell. */
export function buildAvailableChatModels(includeSystemCreditModels = true): ChatModel[] {
  const uniqueModels = new Map<string, ChatModel>();
  keyManager.getGlobalModelList().forEach((model) => {
    if (!isChatModel(model, includeSystemCreditModels) || uniqueModels.has(model.id)) return;
    uniqueModels.set(model.id, { ...model, isVision: supportsVision(model) });
  });
  return Array.from(uniqueModels.values());
}

/** Resolves the enabled assistant assignment without removing manual model selection. */
export function resolveAssistantPreferredModel(models: ChatModel[]): ChatModel {
  const selectableModels = models.filter((model) => !isCapabilityRouteAssignmentModelDisabled('assistant', model.id));
  const preferredModelId = String(resolveEnabledCapabilityRouteAssignment('assistant')?.primaryModelId || '').trim();
  if (!preferredModelId) return selectableModels[0] || DEFAULT_CHAT_MODEL;
  const exactModel = selectableModels.find((model) => model.id === preferredModelId);
  if (exactModel) return exactModel;
  const modelSuffix = preferredModelId.split('@')[1];
  return selectableModels.find((model) => modelSuffix && model.id.endsWith(`@${modelSuffix}`))
    || selectableModels[0]
    || DEFAULT_CHAT_MODEL;
}

/** Returns the assigned route only when it still resolves to a configured key. */
export function resolveAssistantPreferredKeyId(): string | undefined {
  const preferredRouteId = String(resolveEnabledCapabilityRouteAssignment('assistant')?.primaryRouteId || '').trim();
  return preferredRouteId && keyManager.getKey(preferredRouteId) ? preferredRouteId : undefined;
}

function hasSameModelMetadata(left: ChatModel, right: ChatModel): boolean {
  return left.id === right.id && left.name === right.name && left.description === right.description;
}

function synchronizeCatalog(
  options: ChatModelCatalogOptions,
  setAvailableModels: Dispatch<SetStateAction<ChatModel[]>>,
  lastPreferredModelId: { current: string },
): void {
  const models = buildAvailableChatModels(options.canBrowseSystemCreditModels);
  setAvailableModels((current) => JSON.stringify(current) === JSON.stringify(models) ? current : models);
  if (models.length === 0) return;
  const preferredModel = resolveAssistantPreferredModel(models);
  const preferredModelId = String(resolveEnabledCapabilityRouteAssignment('assistant')?.primaryModelId || '').trim();
  if (preferredModelId && preferredModelId !== lastPreferredModelId.current) {
    lastPreferredModelId.current = preferredModelId;
    const exactModel = models.find((model) => model.id === preferredModelId);
    if (exactModel) {
      if (!hasSameModelMetadata(options.selectedModel, exactModel)) options.setSelectedModel(exactModel);
      return;
    }
  }
  const currentModel = models.find((model) => model.id === options.selectedModel.id);
  const disabled = isCapabilityRouteAssignmentModelDisabled('assistant', options.selectedModel.id);
  const nextModel = !currentModel || disabled ? preferredModel : currentModel;
  if (!hasSameModelMetadata(options.selectedModel, nextModel)) options.setSelectedModel(nextModel);
}

/** Owns catalog refresh subscriptions and mirrors the selected model into the takeover runtime. */
export function useChatModelCatalog(options: ChatModelCatalogOptions): ChatModelCatalogState {
  const [availableModels, setAvailableModels] = useState<ChatModel[]>(() => (
    buildAvailableChatModels(options.canBrowseSystemCreditModels)
  ));
  const lastPreferredModelId = useRef('');
  useEffect(() => {
    const updateModels = () => synchronizeCatalog(options, setAvailableModels, lastPreferredModelId);
    updateModels();
    const unsubscribeKeys = keyManager.subscribe(updateModels);
    const unsubscribeAssignments = subscribeCapabilityRouteAssignments(updateModels);
    return () => {
      unsubscribeKeys();
      unsubscribeAssignments();
    };
  }, [
    options.canBrowseSystemCreditModels,
    options.selectedModel.description,
    options.selectedModel.id,
    options.selectedModel.name,
    options.setSelectedModel,
  ]);
  useEffect(() => options.onSelectedModelChange(options.selectedModel), [
    options.onSelectedModelChange,
    options.selectedModel,
  ]);
  return { availableModels, setAvailableModels };
}

/** Creates the single selected-model owner used by the provider and chat shell. */
export function useSelectedChatModelState(
  includeSystemCreditModels: boolean,
): [ChatModel, Dispatch<SetStateAction<ChatModel>>] {
  return useState<ChatModel>(() => resolveAssistantPreferredModel(
    buildAvailableChatModels(includeSystemCreditModels),
  ));
}
