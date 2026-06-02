// 简体中文：AI接管右侧固定助手面板组件 (AIAssistantDock)

import React, { useState, useEffect, useRef } from 'react';
import { useAITakeover } from '../context/AITakeoverContext';
import { useAssetStore } from '../../assets/assetStore';
import { ensureFileUploaded } from '../../assets/lazyUpload';
import {
  Send,
  Loader2,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  Eye,
  Trash2,
  X,
  Lock,
  Download,
  AlertTriangle,
  Cpu
} from 'lucide-react';

export const AIAssistantDock: React.FC = () => {
  const {
    aiTakeoverMode,
    setAiTakeoverMode,
    messages,
    isThinking,
    sendMessage,
    pendingPlan,
    executePendingPlan,
    cancelPendingPlan
  } = useAITakeover();

  const { images, files, outputs, addImage, addFile, removeAsset } = useAssetStore();

  const [inputVal, setInputVal] = useState('');
  const [showResourcePanel, setShowResourcePanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 滚动至最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // 处理文本发送
  const handleSend = () => {
    if (!inputVal.trim() || isThinking) return;
    sendMessage(inputVal);
    setInputVal('');
  };

  // 处理图片选择
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach(file => addImage(file));
    }
  };

  // 处理文件夹导入
  const handleDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach(file => {
        // webkitRelativePath 包含文件夹相对路径
        addImage(file, file.webkitRelativePath);
      });
    }
  };

  // 处理普通文件连接导入
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      Array.from(fileList).forEach(file => addFile(file));
    }
  };

  // 处理 Action 链接点击
  const handleActionLink = (url: string) => {
    // 匹配自定义 action：
    if (url === 'action://takeover-prompt-only') {
      sendMessage('帮我只优化提示词并填充，不进行图片生成。');
    } else if (url === 'action://takeover-prompt-doc') {
      sendMessage('请帮我把优化的生图模板方案整理一份文案形式输出。');
    } else {
      // 其它 action 分发给全局 window 以匹配 App.tsx
      const parsedUrl = url.replace('action://', 'http://dummy');
      let x = 0, y = 0, nodeId = '';
      try {
        const u = new URL(parsedUrl);
        const keyword = u.searchParams.get('keyword') || '';
        const prompts = u.searchParams.get('prompts') || '';

        if (url.startsWith('action://takeover-locate') && keyword) {
          sendMessage(`定位卡片：${keyword}`);
        } else if (url.startsWith('action://takeover-bulk-generate') && prompts) {
          sendMessage(`使用提示词开始生成：${prompts}`);
        } else {
          // 普通 action 直接触发
          const mockAnchor = document.createElement('a');
          mockAnchor.href = url;
          mockAnchor.click();
        }
      } catch (err) {
        console.error('Action parse error:', err);
      }
    }
  };

  // 格式化文件大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 渲染消息内容（解析 action:// 交互按钮）
  const renderMessageText = (content: string) => {
    const regex = /\[([^\]]+)\]\((action:\/\/[^\)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={lastIndex}>{content.substring(lastIndex, match.index)}</span>);
      }

      const label = match[1];
      const actionUrl = match[2];

      parts.push(
        <button
          key={match.index}
          onClick={() => handleActionLink(actionUrl)}
          className="inline-flex items-center gap-1 mx-1 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:brightness-110 active:scale-95 transition-all shadow-[0_2px_8px_rgba(219,39,119,0.35)] select-none cursor-pointer"
        >
          ✨ {label}
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(<span key={lastIndex}>{content.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0b0c10] border-l border-zinc-800 font-inter select-none"
      style={{ width: '380px', minWidth: '380px', maxWidth: '380px', flexShrink: 0 }}
    >
      
      {/* 1. Header 头部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#0f111a] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.35)]">
              <Cpu className="text-white w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-zinc-950 rounded-full" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">KK本地接管助理</h3>
            <p className="text-[9px] text-zinc-400">Offline Local Sandbox Engine</p>
          </div>
        </div>

        <button
          onClick={() => setAiTakeoverMode(false)}
          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          title="关闭 AI 接管"
        >
          <X size={16} />
        </button>
      </div>

      {/* 2. Message Area 消息对话区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#0a0a0d]">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-white rounded-br-none border border-zinc-700'
                  : 'bg-zinc-900 text-zinc-200 rounded-bl-none border border-zinc-800/80 whitespace-pre-wrap'
              }`}
            >
              {msg.role === 'assistant' ? renderMessageText(msg.content) : msg.content}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl rounded-bl-none px-4 py-3 text-xs flex items-center gap-2">
              <Loader2 className="animate-spin text-purple-500 w-3.5 h-3.5" />
              <span>接管引擎正在规划...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Confirmation Area 意图强确认卡片 */}
      {pendingPlan && pendingPlan.confirmation && (
        <div className="mx-4 my-2 p-3.5 rounded-xl border border-purple-900/60 bg-[#120f21]/80 backdrop-blur-lg shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Cpu size={48} className="text-purple-500" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-black text-purple-400 mb-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            <span>{pendingPlan.confirmation.title}</span>
          </div>

          <div className="text-[10px] text-zinc-300 whitespace-pre-line mb-3 border-l-2 border-purple-500 pl-2 leading-relaxed">
            {pendingPlan.confirmation.summary}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={cancelPendingPlan}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              {pendingPlan.confirmation.cancelText}
            </button>
            <button
              onClick={executePendingPlan}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold text-white hover:brightness-110 hover:shadow-[0_2px_10px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
            >
              {pendingPlan.confirmation.confirmText}
            </button>
          </div>
        </div>
      )}

      {/* 4. Three-in-One Upload Bar 三合一资源上传条 */}
      <div className="px-4 py-2 border-t border-zinc-800/60 bg-[#0c0d12] flex gap-2">
        <input
          type="file"
          accept="image/*"
          multiple
          ref={imgInputRef}
          onChange={handleImageChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          multiple
          webkitdirectory="true"
          ref={dirInputRef}
          onChange={handleDirChange}
          className="hidden"
        />
        <input
          type="file"
          accept=".txt,.json,.csv,.pdf,.zip,.prompt"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 上传图片药丸按钮 */}
        <button
          onClick={() => imgInputRef.current?.click()}
          className="flex-1 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-[10px] font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="选择单图或多图导入资源池"
        >
          <ImageIcon size={12} />
          <span>上传图片</span>
        </button>

        {/* 导入文件夹药丸按钮 */}
        <button
          onClick={() => dirInputRef.current?.click()}
          className="flex-1 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-[10px] font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="选择本地文件夹图片导入"
        >
          <FolderOpen size={12} />
          <span>导入文件夹</span>
        </button>

        {/* 连接文件药丸按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-[10px] font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          title="连接配置文件（懒加载）"
        >
          <FileText size={12} />
          <span>连接文件</span>
        </button>

        {/* 展开/折叠资源管理器按钮 */}
        <button
          onClick={() => setShowResourcePanel(!showResourcePanel)}
          className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
            showResourcePanel
              ? 'bg-purple-600/20 border-purple-500/60 text-purple-400'
              : 'border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:text-white'
          }`}
          title="展开/隐藏当前项目资源池"
        >
          <Eye size={12} />
          <span>资源({images.length + files.length})</span>
        </button>
      </div>

      {/* 5. Resource Panel 资源池折叠管理器 */}
      {showResourcePanel && (
        <div className="border-t border-zinc-800 bg-[#090a0f] p-3 max-h-48 overflow-y-auto animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-zinc-400">已连结的本地项目资源池 ({images.length + files.length})</span>
            <button
              onClick={() => setShowResourcePanel(false)}
              className="text-zinc-500 hover:text-white text-[9px] cursor-pointer"
            >
              关闭
            </button>
          </div>

          <div className="space-y-1.5">
            {/* 图像列表 */}
            {images.map(img => (
              <div key={img.id} className="flex items-center justify-between bg-zinc-900/60 border border-zinc-900 rounded-lg p-1.5 text-[9px] text-zinc-300">
                <div className="flex items-center gap-2 truncate">
                  {img.thumbnailUrl ? (
                    <img src={img.thumbnailUrl} alt="preview" className="w-6 h-6 rounded object-cover border border-zinc-800" />
                  ) : (
                    <ImageIcon size={12} className="text-zinc-500" />
                  )}
                  <div className="truncate">
                    <p className="truncate text-zinc-200">{img.name}</p>
                    <p className="text-[8px] text-zinc-500">{formatBytes(img.size)} • {img.uploadState}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeAsset(img.id, 'image')}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            {/* 普通文件列表 */}
            {files.map(f => (
              <div key={f.id} className={`flex items-center justify-between rounded-lg p-1.5 text-[9px] border ${
                f.sensitive
                  ? 'border-red-950/40 bg-red-950/20 text-red-300'
                  : 'border-zinc-900 bg-zinc-900/60 text-zinc-300'
              }`}>
                <div className="flex items-center gap-2 truncate">
                  {f.sensitive ? (
                    <Lock size={12} className="text-red-500 animate-pulse" />
                  ) : (
                    <FileText size={12} className="text-zinc-500" />
                  )}
                  <div className="truncate">
                    <p className="truncate text-zinc-200">{f.name}</p>
                    <p className="text-[8px] text-zinc-500">
                      {formatBytes(f.size)} • {f.sensitive ? '敏感文件被隔离' : f.uploadState}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeAsset(f.id, 'file')}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            {images.length === 0 && files.length === 0 && (
              <p className="text-[9px] text-zinc-600 text-center py-2">暂无已导入资源，点击上方按钮进行选择。</p>
            )}
          </div>
        </div>
      )}

      {/* 6. Input Area 输入输入区域 */}
      <div className="p-4 border-t border-zinc-800 bg-[#0d0e14]">
        <div className="relative flex items-center border border-zinc-800 bg-zinc-900/40 rounded-xl px-3 py-1.5 focus-within:border-purple-600/80 focus-within:ring-1 focus-within:ring-purple-600/20 transition-all">
          <textarea
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入对话或指令（回车发送）..."
            rows={1}
            disabled={isThinking}
            className="w-full text-xs text-white bg-transparent outline-none border-none resize-none placeholder-zinc-500 disabled:opacity-50 pr-8 py-1 leading-normal"
          />

          <button
            onClick={handleSend}
            disabled={!inputVal.trim() || isThinking}
            className="absolute right-2 p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-md"
          >
            <Send size={12} fill="white" />
          </button>
        </div>
      </div>
      
    </div>
  );
};
