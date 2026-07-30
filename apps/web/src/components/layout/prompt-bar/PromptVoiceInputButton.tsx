import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

import {
  appendVoiceTranscript,
  resolveSpeechRecognitionConstructor,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from './promptVoiceInput';

function readComposerPrompt(button: HTMLButtonElement | null): {
  container: HTMLElement | null;
  textarea: HTMLTextAreaElement | null;
} {
  const container = button?.closest<HTMLElement>('#prompt-bar-container') ?? null;
  return {
    container,
    textarea: container?.querySelector<HTMLTextAreaElement>('.input-bar-textarea') ?? null,
  };
}

function collectFinalTranscript(event: SpeechRecognitionEventLike): string {
  return Array.from(event.results)
    .filter((result) => result.isFinal !== false)
    .map((result) => result[0]?.transcript?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

interface PromptVoiceInputButtonProps {
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/**
 * Shared dictation control. It can update a controlled prompt directly or
 * fall back to the workspace composer event bridge.
 */
const PromptVoiceInputButton: React.FC<PromptVoiceInputButtonProps> = ({
  value,
  onValueChange,
  className = '',
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    valueRef.current = value;
    onValueChangeRef.current = onValueChange;
  }, [onValueChange, value]);

  useEffect(() => {
    setIsSupported(Boolean(resolveSpeechRecognitionConstructor(window)));
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current = null;
      }
    };
  }, []);

  const resetListening = useCallback(() => {
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } finally {
      resetListening();
    }
  }, [resetListening]);

  const handleResult = useCallback((event: SpeechRecognitionEventLike) => {
    const transcript = collectFinalTranscript(event);
    if (!transcript) return;
    const { textarea } = readComposerPrompt(buttonRef.current);
    const prompt = appendVoiceTranscript(valueRef.current ?? textarea?.value ?? '', transcript);
    if (onValueChangeRef.current) {
      onValueChangeRef.current(prompt);
      valueRef.current = prompt;
      window.requestAnimationFrame(() => buttonRef.current?.focus());
      return;
    }
    window.dispatchEvent(new CustomEvent('takeover-fill-prompt', { detail: { prompt } }));
    window.requestAnimationFrame(() => textarea?.focus());
  }, []);

  const startListening = useCallback(() => {
    const Recognition = resolveSpeechRecognitionConstructor(window);
    if (!Recognition) {
      setIsSupported(false);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = handleResult;
    recognition.onerror = resetListening;
    recognition.onend = resetListening;
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      resetListening();
    }
  }, [handleResult, resetListening]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`kk-composer-voice-input ${className}`.trim()}
      data-state={isListening ? 'listening' : 'idle'}
      disabled={!isSupported}
      onClick={isListening ? stopListening : startListening}
      aria-label={isListening ? '停止语音输入' : '语音输入'}
      aria-pressed={isListening}
      title={isSupported ? (isListening ? '停止语音输入' : '语音输入') : '当前浏览器不支持语音输入'}
    >
      {isListening ? <Square size={14} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
    </button>
  );
};

export default PromptVoiceInputButton;
