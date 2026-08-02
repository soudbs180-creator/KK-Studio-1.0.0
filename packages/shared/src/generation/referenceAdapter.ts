import type { MediaReferenceDto, ReferenceRole } from "../contracts/dto/generation.ts";

export interface LegacyReferenceImageLike {
  id: string;
  storageId?: string;
  mimeType?: string;
}

export type VideoReferenceMode = "multiple" | "first-frame" | "first-last-frame";

/** Preserves legacy IDs and visual order while moving references to the canonical contract. */
export function adaptLegacyReferenceImages(references: LegacyReferenceImageLike[]): MediaReferenceDto[] {
  return references.map((reference, order) => ({
    id: reference.id,
    assetId: reference.storageId || reference.id,
    mediaType: reference.mimeType?.startsWith("video/") ? "video" : "image",
    mimeType: reference.mimeType,
    role: "reference",
    order,
  }));
}

/** Reorders one stable reference and compacts order values without mutating the input. */
export function reorderComposerReferences(
  references: MediaReferenceDto[],
  referenceId: string,
  targetIndex: number,
): MediaReferenceDto[] {
  const sourceIndex = references.findIndex((reference) => reference.id === referenceId);
  if (sourceIndex < 0) return references;
  const next = references.slice();
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, moved);
  return next.map((reference, order) => ({ ...reference, order }));
}

/** Frame roles derive from visual order, so drag-and-drop also swaps their semantics. */
export function assignVideoReferenceRoles(
  references: MediaReferenceDto[],
  mode: VideoReferenceMode,
): MediaReferenceDto[] {
  return references.map((reference, index) => {
    let role: ReferenceRole = "reference";
    if (mode === "first-frame" && index === 0) role = "first-frame";
    if (mode === "first-last-frame") {
      if (index === 0) role = "first-frame";
      if (index === 1) role = "last-frame";
    }
    return { ...reference, role, order: index };
  });
}
