import type { EcommerceSparseIntentPatch } from '../../types.ts';

function cleanIntentText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[，、]/g, '，')
    .replace(/[。；;]/g, '。')
    .trim();
}

function extractSegment(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return String(match?.[1] || '').trim();
}

function extractHighlight(text: string): string {
  const explicit = extractSegment(text, /文案(?:写|改成|做成|用)?\s*([A-Za-z0-9.+%-]+)\b/i);
  if (explicit) return explicit;

  const genericMatch = text.match(/\b\d+(?:\.\d+)?(?:\s?[A-Za-z%]+)\b/);
  return String(genericMatch?.[0] || '').trim();
}

function extractTone(text: string): string {
  const tone = extractSegment(text, /色调([^，。]+)/);
  if (tone) return tone;

  const atmosphereTone = extractSegment(text, /(更(?:清凉|清爽|高级|温暖|明亮)[^，。]*)/);
  return atmosphereTone;
}

function extractHeadline(text: string): string {
  return extractSegment(text, /标题(?:写|改成|用)?([^，。]+)/);
}

function extractSubheadline(text: string): string {
  return extractSegment(text, /副标题(?:写|改成|用)?([^，。]+)/);
}

export function parseSparseEcommerceIntent(input: string): EcommerceSparseIntentPatch {
  const text = cleanIntentText(input);
  if (!text) return {};

  const patch: EcommerceSparseIntentPatch = {};

  const highlight = extractHighlight(text);
  const headline = extractHeadline(text);
  const subheadline = extractSubheadline(text);
  if (highlight || headline || subheadline) {
    patch.copy = {};
    if (highlight) patch.copy.highlight = highlight;
    if (headline) patch.copy.headline = headline;
    if (subheadline) patch.copy.subheadline = subheadline;
  }

  const tone = extractTone(text);
  const effectDisabled = /不要(?:风效|风感|风格特效|特效|效果|动效)/.test(text);
  if (tone || effectDisabled) {
    patch.style = {};
    if (tone) patch.style.tone = tone;
    if (effectDisabled) patch.style.effectEnabled = false;
  }

  if (/产品(?:放大|大一点|更大|主体放大)/.test(text)) {
    patch.layout = {
      ...(patch.layout || {}),
      productSize: 'large',
    };
  } else if (/产品(?:缩小|小一点|更小)/.test(text)) {
    patch.layout = {
      ...(patch.layout || {}),
      productSize: 'small',
    };
  }

  if (/还是上一套风格|延续上一套风格|保持上一套风格|沿用上一套风格|同上一套风格/.test(text)) {
    patch.inherit = {
      keepSeriesStyle: true,
      keepFontStyle: true,
      keepLayoutStyle: true,
      keepCopyStyle: true,
      keepPalette: true,
    };
  }

  if (/字(?:体)?大一点|字(?:体)?更大|标题字大一点/.test(text)) {
    patch.font = {
      headlineScaleDelta: 0.15,
    };
  } else if (/字(?:体)?小一点|字(?:体)?更小/.test(text)) {
    patch.font = {
      headlineScaleDelta: -0.1,
    };
  }

  if (/做成主图|主图版|主图$|主图，|主图。/.test(text) || /(?:^|，)主图(?:，|。|$)/.test(text)) {
    patch.outputTypeLabel = '主图';
  } else if (/A\+|做成A\+/.test(text)) {
    patch.outputTypeLabel = 'A+';
  }

  return patch;
}
