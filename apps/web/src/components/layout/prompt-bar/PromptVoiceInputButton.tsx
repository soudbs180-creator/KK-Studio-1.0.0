import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

import {
  appendVoiceTranscript,
  resolveSpeechRecognitionConstructor,
  type SpeechRecognitionErrorEventLike,
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
  const feedbackTimerRef = useRef<number | null>(null);
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
    onValueChangeRef.current = onValueChange;
  }, [onValueChange, value]);

  useEffect(() => {
    setIsSupported(Boolean(resolveSpeechRecognitionConstructor(window)));
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        recognitionRef.current = null;
      }
    };
  }, []);

  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
      feedbackTimerRef.current = null;
    }, 2600);
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
      showFeedback('语音输入已停止');
    }
  }, [resetListening, showFeedback]);

  const handleRecognitionError = useCallback((event: SpeechRecognitionErrorEventLike) => {
    const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      ? '未获得麦克风权限'
      : event.error === 'audio-capture'
        ? '未检测到可用麦克风'
        : event.error === 'network'
          ? '语音服务连接失败'
          : '没有识别到语音，请重试';
    resetListening();
    showFeedback(message);
  }, [resetListening, showFeedback]);

  const handleResult = useCallback((event: SpeechRecognitionEventLike) => {
    const transcript = collectFinalTranscript(event);
    if (!transcript) return;
    const { textarea } = readComposerPrompt(buttonRef.current);
    const prompt = appendVoiceTranscript(valueRef.current ?? textarea?.value ?? '', transcript);
    if (onValueChangeRef.current) {
      onValueChangeRef.current(prompt);
      valueRef.current = prompt;
      showFeedback('已写入语音内容');
      window.requestAnimationFrame(() => buttonRef.current?.focus());
      return;
    }
    window.dispatchEvent(new CustomEvent('takeover-fill-prompt', { detail: { prompt } }));
    showFeedback('已写入语音内容');
    window.requestAnimationFrame(() => textarea?.focus());
  }, [showFeedback]);

  const startListening = useCallback(() => {
    const Recognition = resolveSpeechRecognitionConstructor(window);
    if (!Recognition) {
      setIsSupported(false);
      showFeedback('当前浏览器不支持语音识别');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = handleResult;
    recognition.onerror = handleRecognitionError;
    recognition.onend = resetListening;
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      showFeedback('正在听，请开始说话');
    } catch {
      resetListening();
      showFeedback('语音输入启动失败，请重试');
    }
  }, [handleRecognitionError, handleResult, resetListening, showFeedback]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`kk-composer-voice-input ${className}`.trim()}
      data-state={isListening ? 'listening' : 'idle'}
      data-supported={isSupported}
      data-feedback={feedbackMessage ? 'visible' : 'hidden'}
      onClick={isListening ? stopListening : startListening}
      aria-label={isListening ? '停止语音输入' : '语音输入'}
      aria-pressed={isListening}
      title={isSupported ? (isListening ? '停止语音输入' : '语音输入') : '当前浏览器不支持语音输入'}
    >
      {isListening ? <Square size={14} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
      {feedbackMessage ? (
        <span className="kk-composer-voice-status" role="status" aria-live="polite">
          {feedbackMessage}
        </span>
      ) : null}
      <span className="sr-only">
        {isListening ? '录音中，点击停止' : isSupported ? '语音输入已关闭' : '当前浏览器不支持语音输入'}
      </span>
    </button>
  );
};

export default PromptVoiceInputButton;
