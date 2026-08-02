import type { ContextReferenceDto, ReferenceRole, VideoReferenceMode } from '@kk/shared';
import { GenerationMode, type ReferenceImage } from '../../../types.ts';

function roleForIndex(index: number, mode: VideoReferenceMode): ReferenceRole {
  if (mode === 'first-frame' && index === 0) return 'first-frame';
  if (mode === 'first-last-frame' && index === 0) return 'first-frame';
  if (mode === 'first-last-frame' && index === 1) return 'last-frame';
  return 'reference';
}

/** Keeps the visible order and the submitted frame semantics in one state transition. */
export function applyComposerReferenceRoles(
  references: ReferenceImage[],
  generationMode: GenerationMode,
  videoMode: VideoReferenceMode,
): ReferenceImage[] {
  let changed = false;
  const next = references.map((reference, index) => {
    const role = generationMode === GenerationMode.VIDEO
      ? roleForIndex(index, videoMode)
      : 'reference';
    if (reference.role === role) return reference;
    changed = true;
    return { ...reference, role };
  });
  return changed ? next : references;
}

/** Moves a stable reference ID, then reapplies frame roles from left-to-right order. */
export function reorderComposerReferenceImages(
  references: ReferenceImage[],
  referenceId: string,
  targetIndex: number,
  generationMode: GenerationMode,
  videoMode: VideoReferenceMode,
): ReferenceImage[] {
  const sourceIndex = references.findIndex((reference) => reference.id === referenceId);
  if (sourceIndex < 0) return references;
  const next = references.slice();
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, moved);
  return applyComposerReferenceRoles(next, generationMode, videoMode);
}

export function getComposerReferenceLabel(role: ReferenceRole | undefined, index: number): string {
  if (role === 'first-frame') return '首帧';
  if (role === 'last-frame') return '尾帧';
  return `参考 ${index + 1}`;
}

export function sortContextReferences(references: ContextReferenceDto[]): ContextReferenceDto[] {
  return references.slice().sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}
