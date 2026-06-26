import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { parseMarkdownToCards, type ParsedCardData } from '../../utils/markdownToCards';
import { generationService } from '../../features/generation/generateService';
import { keyManager } from '../../services/auth/keyManager';
import { notify } from '../../services/system/notificationService';

export interface MarkdownToCardsModalProps {
  onInsertCards: (cards: ParsedCardData[]) => void;
  onClose: () => void;
}

const DEFAULT_MARKDOWN = `# AI 与工作流未来
Milkdown 与 Drawnix 实现了文档驱动画布的飞跃。

## 核心设计
- AI 大纲生成
- 矢量元素测量
- 原图自动恢复

## 价值与闭环
- PPTX 演示文档导出
- PSD 分层二次流转
- 全屏画笔批注演示`;

export const MarkdownToCardsModal: React.FC<MarkdownToCardsModalProps> = ({
  onInsertCards,
  onClose,
}) => {
  const [text, setText] = useState(DEFAULT_MARKDOWN);
  const [previewCards, setPreviewCards] = useState<ParsedCardData[]>([]);
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // 简体中文：在本地安全解析出当前已配置的聊天/对话模型列表
  const chatModels = useMemo(() => {
    try {
      return keyManager.getGlobalModelList().filter((m: any) => {
        const idLower = String(m.id || '').toLowerCase();
        // 排除纯生图模型和视频模型，避免意图通道错乱
        if (idLower.includes('flux') || idLower.includes('midjourney') || idLower.includes('dall-e') || idLower.includes('veo')) {
          return false;
        }
        return m.type === 'chat' || m.type === 'image+chat';
      });
    } catch (e) {
      console.error('[MarkdownToCards] Failed to resolve global models:', e);
      return [];
    }
  }, []);

  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    return chatModels[0]?.id || 'gemini-2.5-flash';
  });

  useEffect(() => {
    try {
      const parsed = parseMarkdownToCards(text);
      setPreviewCards(parsed);
    } catch {
      setPreviewCards([]);
    }
  }, [text]);

  // 简体中文：调用底层 LLMService 封装好的通用 chat 请求，具备完美的网络环境韧性和自动重试机制
  const handleGenerateAiMindmap = useCallback(async () => {
    if (!aiTopic.trim()) {
      notify.warning('提示', '请输入您想脑暴的主题！');
      return;
    }

    const hasKeys = keyManager.hasValidKeys();
    const activeModel = chatModels.find(m => m.id === selectedModelId);

    // 防御性拦截机制：如果未配置 API 密钥且当前选择的模型不支持免密系统代理，高亮引导去设置页
    if (!hasKeys && activeModel && !activeModel.isSystemInternal) {
      notify.error('配置失效', '未配置有效的 API 密钥。请点击左侧栏设置图标前往「API 工作台」手动配置密钥。');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const systemPrompt = `你是一个专业的思维脑暴与脑图大纲生成助手。请根据用户的主题，输出一份层级分明、结构清晰的 Markdown 文本大纲。
必须严格遵循以下 Markdown 规范：
1. 使用 # 一级标题表示脑图的根节点/主题。
2. 使用 ## 二级标题表示一级分支节点。
3. 使用 - 列表项表示分支的具体要点或叶子节点。
不要输出任何 Markdown 代码块包裹标记（如 \`\`\`markdown 或 \`\`\`），只返回纯 Markdown 大纲文本，也不要有任何客套解释或无关引导。`;

      const userPrompt = `主题是：“${aiTopic.trim()}”
请围绕该主题展开脑暴，要求结构严密，至少包含 3 到 4 个二级分支，每个二级分支下包含 3 到 5 个具体列表要点。`;

      const content = await generationService.chat({
        modelId: selectedModelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      });

      if (content && content.trim()) {
        setText(content.trim());
        notify.success('AI 脑图生成成功', '脑图大纲已自动填入编辑框并转换为卡片组。');
      } else {
        notify.error('生成失败', 'AI 未返回有效的脑图大纲数据，请重试。');
      }
    } catch (error: any) {
      console.error('[AiMindmap] Generation failed:', error);
      notify.error('生成异常', error.message || '大模型请求失败，请检查网络代理或配置。');
    } finally {
      setIsGeneratingAi(false);
    }
  }, [aiTopic, selectedModelId, chatModels]);

  const handleInsert = () => {
    if (previewCards.length === 0) {
      alert('未检测到有效的 Markdown 结构，请使用 # 标记标题，- 标记列表。');
      return;
    }
    onInsertCards(previewCards);
  };

  return (
    <div className="flex h-full flex-col gap-4 text-white p-2 select-none">
      {/* 头部面板 */}
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="m-0 text-[16px] font-medium tracking-wide">AI 智能思维导图与卡片生成器</h3>
        </div>
        <button 
          onClick={onClose} 
          className="bg-transparent border-none text-white/40 cursor-pointer hover:text-white/90 text-sm transition-colors"
        >
          关闭
        </button>
      </div>

      {/* AI 脑暴生成栏：磨砂卡片质感 */}
      <div 
        className="flex flex-col gap-3 p-4 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm"
        style={{
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)', // UI_TOKEN_EXCEPTION
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1">
            <Sparkles size={14} className="animate-pulse" />
            AI 脑图生成面板
          </span>
          {chatModels.length > 0 && (
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="bg-slate-950/80 text-[11px] text-indigo-300 border border-white/10 rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-indigo-500/40 transition-colors"
            >
              {chatModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isGeneratingAi) {
                void handleGenerateAiMindmap();
              }
            }}
            placeholder="输入您想一键脑暴的主题（例如：电商夏日防晒服营销创意大纲）..."
            className="flex-1 bg-slate-950 text-xs text-white px-3 py-2 border border-white/5 rounded-xl outline-none focus:border-indigo-500/40 transition-colors"
            disabled={isGeneratingAi}
          />
          <button
            onClick={() => {
              void handleGenerateAiMindmap();
            }}
            disabled={isGeneratingAi}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-white/30 text-white font-medium text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95 shrink-0"
          >
            {isGeneratingAi ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                正在大白脑暴...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                智能生成
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* 编辑区 */}
        <div className="flex flex-col flex-1 gap-2">
          <span className="text-xs text-white/50">Markdown 大纲源码编辑：</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-slate-950 text-indigo-300 font-mono text-xs p-3.5 border border-white/5 rounded-xl resize-none outline-none focus:border-indigo-500/40 transition-colors"
            placeholder="# 一级标题作为主节点&#10;## 二级标题作为子节点&#10;- 要点1&#10;- 要点2"
          />
        </div>

        {/* 预览区 */}
        <div className="flex flex-col flex-1 gap-2">
          <span className="text-xs text-white/50">拓扑生成卡片预览 ({previewCards.length} 组)：</span>
          <div className="flex-1 bg-slate-950/40 border border-white/5 rounded-xl overflow-y-auto p-4 space-y-3">
            {previewCards.map((card) => (
              <div key={card.id} className="border border-white/5 bg-white/[0.01] rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-indigo-400 truncate max-w-[200px]">{card.title}</span>
                  <span className="text-[9px] bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full">
                    层级 {card.level}
                  </span>
                </div>
                <div className="text-[11px] text-white/60 space-y-1">
                  {card.bullets.map((b, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className="text-indigo-500/70">•</span>
                      <span className="leading-relaxed">{b}</span>
                    </div>
                  ))}
                  {card.bullets.length === 0 && (
                    <span className="italic text-white/30 text-[10px]">无列表要点</span>
                  )}
                </div>
              </div>
            ))}
            {previewCards.length === 0 && (
              <div className="h-full flex items-center justify-center text-white/30 text-xs italic">
                解析结果为空，请输入有效的 Markdown
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮区 */}
      <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
        <button
          onClick={handleInsert}
          disabled={previewCards.length === 0}
          className={`px-5 py-2 rounded-full font-medium text-xs transition-all ${
            previewCards.length === 0
              ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:shadow-lg hover:shadow-indigo-500/15'
          }`}
        >
          导入到当前画布
        </button>
      </div>
    </div>
  );
};

export default MarkdownToCardsModal;
