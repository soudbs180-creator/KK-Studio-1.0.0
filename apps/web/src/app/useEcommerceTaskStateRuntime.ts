import { useCallback } from 'react';

import type { EcommerceAnalysisResult } from '../services/ecommerce/types.ts';
import type { EcommerceEditableTaskState } from '../types.ts';

export interface EcommerceTaskStateRuntimeState {
  taskStates: Record<string, EcommerceEditableTaskState>;
  activeTaskState: EcommerceEditableTaskState | null;
}

export type ApplyEffectiveSizingToEcommerceTaskState = (
  taskState: EcommerceEditableTaskState
) => EcommerceEditableTaskState;

export type EcommerceTaskStateUpdater =
  | EcommerceEditableTaskState
  | ((previous: EcommerceEditableTaskState) => EcommerceEditableTaskState);

export type SetEcommerceTaskStateRuntimeState = (
  updater: (previousState: EcommerceTaskStateRuntimeState) => Partial<EcommerceTaskStateRuntimeState> | null
) => void;

export interface UseEcommerceTaskStateRuntimeDeps {
  applyEffectiveSizingToTaskState: ApplyEffectiveSizingToEcommerceTaskState;
  setEcommerceTaskStateRuntimeState: SetEcommerceTaskStateRuntimeState;
}

export interface UseEcommerceTaskStateRuntimeResult {
  buildInitialEcommerceTaskStates: (analysis: EcommerceAnalysisResult) => Record<string, EcommerceEditableTaskState>;
  handleChangeEcommerceTaskState: (taskId: string, updater: EcommerceTaskStateUpdater) => void;
}

export function buildInitialEcommerceTaskStatesFromAnalysis(input: {
  analysis?: EcommerceAnalysisResult | null;
  applyEffectiveSizingToTaskState: ApplyEffectiveSizingToEcommerceTaskState;
}): Record<string, EcommerceEditableTaskState> {
  const nextStateMap: Record<string, EcommerceEditableTaskState> = {};
  const { analysis, applyEffectiveSizingToTaskState } = input;

  (analysis?.mainImageItems || []).forEach((item) => {
    if (item.editableTask) {
      nextStateMap[item.itemId] = applyEffectiveSizingToTaskState(item.editableTask);
    }
  });
  (analysis?.aPlusGroup?.modules || []).forEach((item) => {
    if (item.editableTask) {
      nextStateMap[item.moduleId] = applyEffectiveSizingToTaskState(item.editableTask);
    }
  });

  return nextStateMap;
}

export function resolveNextEcommerceTaskStatePatch(input: {
  previousState: EcommerceTaskStateRuntimeState;
  taskId: string;
  updater: EcommerceTaskStateUpdater;
  applyEffectiveSizingToTaskState: ApplyEffectiveSizingToEcommerceTaskState;
}): Partial<EcommerceTaskStateRuntimeState> | null {
  const {
    previousState,
    taskId,
    updater,
    applyEffectiveSizingToTaskState,
  } = input;
  const nextTaskStates = { ...(previousState.taskStates || {}) };
  let didUpdate = false;

  Object.entries(nextTaskStates).forEach(([rowKey, taskState]) => {
    if (!taskState) return;
    if (taskState.taskId !== taskId && rowKey !== taskId) return;

    const updatedTaskState = typeof updater === 'function' ? updater(taskState) : updater;
    nextTaskStates[rowKey] = applyEffectiveSizingToTaskState(updatedTaskState);
    didUpdate = true;
  });

  let nextActiveTaskState = previousState.activeTaskState || null;
  if (previousState.activeTaskState && previousState.activeTaskState.taskId === taskId) {
    const updatedActiveTaskState = typeof updater === 'function'
      ? updater(previousState.activeTaskState)
      : updater;
    nextActiveTaskState = applyEffectiveSizingToTaskState(updatedActiveTaskState);
    didUpdate = true;
  }

  if (!didUpdate) {
    return null;
  }

  return {
    taskStates: nextTaskStates,
    activeTaskState: nextActiveTaskState,
  };
}

export function useEcommerceTaskStateRuntime({
  applyEffectiveSizingToTaskState,
  setEcommerceTaskStateRuntimeState,
}: UseEcommerceTaskStateRuntimeDeps): UseEcommerceTaskStateRuntimeResult {
  const buildInitialEcommerceTaskStates = useCallback((analysis: EcommerceAnalysisResult) => (
    buildInitialEcommerceTaskStatesFromAnalysis({
      analysis,
      applyEffectiveSizingToTaskState,
    })
  ), [applyEffectiveSizingToTaskState]);

  const handleChangeEcommerceTaskState = useCallback((
    taskId: string,
    updater: EcommerceTaskStateUpdater,
  ) => {
    setEcommerceTaskStateRuntimeState((previousState) => resolveNextEcommerceTaskStatePatch({
      previousState,
      taskId,
      updater,
      applyEffectiveSizingToTaskState,
    }));
  }, [applyEffectiveSizingToTaskState, setEcommerceTaskStateRuntimeState]);

  return {
    buildInitialEcommerceTaskStates,
    handleChangeEcommerceTaskState,
  };
}
