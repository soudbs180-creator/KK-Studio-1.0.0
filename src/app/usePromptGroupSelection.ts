import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

interface UsePromptGroupSelectionDeps {
  handleCanvasNodeSelect: (nodeId: string) => void;
  setFocusedGroupId: Dispatch<SetStateAction<string | null>>;
}

interface UsePromptGroupSelectionResult {
  handlePromptGroupNodeSelect: (groupId: string, nodeId: string) => void;
}

export function usePromptGroupSelection({
  handleCanvasNodeSelect,
  setFocusedGroupId,
}: UsePromptGroupSelectionDeps): UsePromptGroupSelectionResult {
  const handlePromptGroupNodeSelect = useCallback((groupId: string, nodeId: string) => {
    setFocusedGroupId(groupId);
    handleCanvasNodeSelect(nodeId);
  }, [handleCanvasNodeSelect, setFocusedGroupId]);

  return {
    handlePromptGroupNodeSelect,
  };
}
