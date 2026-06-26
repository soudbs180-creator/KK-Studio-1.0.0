import React, { useState } from 'react';

interface ChatProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export const BrowserAssistantChat: React.FC<ChatProps> = ({ onSend, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSend(inputValue.trim());
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative mt-2">
      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="下达浏览器任务，例如：'在谷歌上搜索 KK Studio 评价并提取到画布'..."
        className="w-full min-h-[72px] pr-20 pl-4 py-3 text-xs leading-relaxed text-slate-100 placeholder-slate-500 rounded-xl border border-white/10 bg-slate-950/80 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none resize-none transition-all duration-300"
      />
      <button
        type="submit"
        disabled={isLoading || !inputValue.trim()}
        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 transition-all"
      >
        {isLoading ? '解析中...' : '下达指令'}
      </button>
    </form>
  );
};
