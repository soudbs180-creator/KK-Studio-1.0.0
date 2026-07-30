export interface SpeechRecognitionResultLike {
  readonly isFinal?: boolean;
  readonly 0?: { readonly transcript?: string };
}

export interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindowLike = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

/** Resolves the browser speech-recognition constructor without assuming vendor support. */
export function resolveSpeechRecognitionConstructor(
  candidate: unknown,
): SpeechRecognitionConstructor | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const speechRecognitionWindow = candidate as SpeechRecognitionWindowLike;
  const constructorCandidate =
    speechRecognitionWindow.SpeechRecognition ?? speechRecognitionWindow.webkitSpeechRecognition;
  return typeof constructorCandidate === 'function'
    ? (constructorCandidate as SpeechRecognitionConstructor)
    : null;
}

/** Appends finalized dictation without producing double spaces or blank prompt changes. */
export function appendVoiceTranscript(currentPrompt: string, transcript: string): string {
  const normalizedCurrent = currentPrompt.trim();
  const normalizedTranscript = transcript.trim();
  if (!normalizedTranscript) return normalizedCurrent;
  return normalizedCurrent
    ? `${normalizedCurrent} ${normalizedTranscript}`
    : normalizedTranscript;
}
