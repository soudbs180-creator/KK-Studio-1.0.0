// 简体中文：AI接管开关切换胶囊按钮 (AITakeoverToggle)

import React from 'react';
import { Cpu } from 'lucide-react';
import { useAITakeover } from '../context/AITakeoverContext';

export const AITakeoverToggle: React.FC = () => {
  const { aiTakeoverMode, setAiTakeoverMode } = useAITakeover();

  return (
    <button
      id="btn-ai-takeover-toggle-new"
      onClick={() => {
        setAiTakeoverMode(!aiTakeoverMode);
      }}
      className={`px-2.5 py-1 rounded-full border text-[10px] flex items-center gap-1.5 transition-all duration-300 active:scale-95 select-none cursor-pointer ${
        aiTakeoverMode
          ? 'ai-takeover-active-btn font-extrabold'
          : 'bg-[var(--toolbar-hover)] text-[var(--text-secondary)] border-[var(--frost-card-sub-border)] hover:text-[var(--text-primary)] font-bold'
      }`}
      title={aiTakeoverMode ? 'AI 接管已开启：自动为您批量生图、定位卡片或聚焦 API 输入框' : '开启 AI 接管'}
    >
      <Cpu size={11} className={aiTakeoverMode ? 'animate-pulse text-white' : ''} />
      <span>AI接管</span>
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          aiTakeoverMode ? 'bg-white animate-ping' : 'bg-current opacity-60'
        }`}
      />
    </button>
  );
};
