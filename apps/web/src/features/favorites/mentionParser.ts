import type { ReferenceImage } from '../../types';

export interface ParsedReferenceMention {
  token: string;
  name: string;
  dimension?: string;
  index: number;
  endIndex: number;
  occurrence: number;
}

export interface ResolvedReferenceMention extends ParsedReferenceMention {
  referenceImage?: ReferenceImage;
  referenceIndex?: number;
}

const MENTION_RE = /@([^\s@,，。；;:：、()[\]{}<>]+)(?:\[([^\]\n]+)\])?/g;

export function parseReferenceMentions(prompt: string): ParsedReferenceMention[] {
  const text = String(prompt || '');
  const result: ParsedReferenceMention[] = [];
  let match: RegExpExecArray | null;
  let occurrence = 0;

  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(text)) !== null) {
    const token = match[0];
    const name = String(match[1] || '').trim();
    if (!name) continue;

    result.push({
      token,
      name,
      dimension: String(match[2] || '').trim() || undefined,
      index: match.index,
      endIndex: match.index + token.length,
      occurrence,
    });
    occurrence += 1;
  }

  return result;
}

export function dedupeReferenceMentionsByName(
  mentions: ParsedReferenceMention[],
): ParsedReferenceMention[] {
  const seen = new Set<string>();
  const deduped: ParsedReferenceMention[] = [];

  mentions.forEach((mention) => {
    const key = mention.name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(mention);
  });

  return deduped;
}

export function reorderReferenceImagesByMentions(params: {
  prompt: string;
  referenceImages: ReferenceImage[];
  resolveNameForReference?: (reference: ReferenceImage, index: number) => string | undefined;
}): {
  orderedReferenceImages: ReferenceImage[];
  mentions: ResolvedReferenceMention[];
  mappingSummary: string;
} {
  const mentions = parseReferenceMentions(params.prompt);
  const referenceImages = params.referenceImages || [];
  const byName = new Map<string, ReferenceImage>();

  referenceImages.forEach((reference, index) => {
    const names = [
      params.resolveNameForReference?.(reference, index),
      reference.id,
      reference.storageId,
    ].filter((name): name is string => Boolean(name && name.trim()));

    names.forEach((name) => byName.set(name.trim().toLowerCase(), reference));
  });

  const ordered: ReferenceImage[] = [];
  const used = new Set<string>();
  const resolvedMentions: ResolvedReferenceMention[] = mentions.map((mention) => {
    const reference = byName.get(mention.name.trim().toLowerCase());
    if (!reference) return mention;

    const key = reference.storageId || reference.id;
    if (!used.has(key)) {
      used.add(key);
      ordered.push(reference);
    }

    return {
      ...mention,
      referenceImage: reference,
      referenceIndex: ordered.findIndex((item) => (item.storageId || item.id) === key) + 1,
    };
  });

  referenceImages.forEach((reference) => {
    const key = reference.storageId || reference.id;
    if (used.has(key)) return;
    used.add(key);
    ordered.push(reference);
  });

  return {
    orderedReferenceImages: ordered,
    mentions: resolvedMentions,
    mappingSummary: buildReferenceMappingSummary(resolvedMentions),
  };
}

export function buildReferenceMappingSummary(mentions: ResolvedReferenceMention[]): string {
  const seen = new Set<string>();
  const mapped = mentions
    .filter((mention): mention is ResolvedReferenceMention & { referenceIndex: number } => mention.referenceIndex !== undefined)
    .filter((mention) => {
      const key = mention.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((mention) => {
      const dimension = mention.dimension ? `[${mention.dimension}]` : '';
      return `@${mention.name}${dimension} = reference image ${mention.referenceIndex}`;
    });

  return mapped.length > 0
    ? `Reference mapping: ${mapped.join('; ')}.`
    : '';
}

export function appendReferenceMappingToPrompt(prompt: string, mappingSummary: string): string {
  const cleanPrompt = String(prompt || '').trim();
  const cleanSummary = String(mappingSummary || '').trim();
  if (!cleanSummary) return prompt;
  if (!cleanPrompt) return cleanSummary;
  if (cleanPrompt.includes(cleanSummary)) return cleanPrompt;
  return `${cleanPrompt}\n\n${cleanSummary}`;
}
