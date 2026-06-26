import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wand2,
  Sliders,
  Bot,
  MessageSquare,
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  Trash2,
  Edit,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KK_LAYER } from '@kk/ui';
import type { CapabilityRole, CapabilityRouteAssignment } from '../../../types';
import {
  getCapabilityRouteAssignments,
  subscribeCapabilityRouteAssignments,
} from '../../../services/api/capabilityRouteAssignments';
import {
  getOcrServiceSettings,
  subscribeOcrServiceSettings,
  updateOcrServiceSettings,
} from '../../../services/document/ocrServiceSettings';
import keyManager, { type KeySlot, type ThirdPartyProvider } from '../../../services/auth/keyManager';
import { useLocale } from '../../../context/LocaleContext';
import { notify } from '../../../services/system/notificationService';
import { knowledgeStore, type AgentSkillRecord } from '../../../features/ai-assistant-runtime/knowledge/KnowledgeStore';
import {
  AI_MANAGEMENT_ACTIONS,
  AI_MANAGEMENT_SKILL_TOOL_OPTIONS,
} from '../../../features/ai-assistant-runtime';
import {
  SETTINGS_PANEL_STYLE,
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
  SETTINGS_MODAL_BACKDROP_CLASSNAME,
  SETTINGS_MODAL_PANEL_CLASSNAME,
  SettingsActionButton,
  SettingsBadge,
  SettingsHero,
  SettingsViewShell,
} from '../SettingsScaffold';
import { SettingInput, SettingSelect, SettingToggle } from '../ui/index';

const PRESETS_STORAGE_KEY = 'kk_capability_presets_v1';

interface CapabilityPresetDetail {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

type LocalPresetsState = Record<string, CapabilityPresetDetail>;

const defaultPresets: LocalPresetsState = {
  assistant: {
    systemPrompt: '你是一个得力且智能的 KK Studio 画布创意助手。请基于画布上下文及当前所选的卡片，协助用户进行脑暴、创意提炼或卡片排版。你可以自主调遣所拥有的工具链（如整理卡片、生图任务等）来改变画布。',
    temperature: 0.7,
    maxTokens: 2048,
  },
  image_generation: {
    systemPrompt: '你是一个顶级创意总监与图像提示词工程专家。请为文生图或图生图模型扩写和润色极具表现力、光影细节与构图张力的英文生图提示词。',
    temperature: 1.0,
    maxTokens: 4096,
  },
  video_generation: {
    systemPrompt: '你是一个电影导演与分镜视频规划专家。请将用户的画面描述转换为富有动态感、运镜细腻、折射高级的短视频提示词与镜头控制指令。',
    temperature: 1.0,
    maxTokens: 4096,
  },
  ocr_document: {
    systemPrompt: '你是一个专业的 OCR 文字识别与排版结构化专家。请精准提取图片中的所有文本内容，并按自然的阅读顺序整理输出。',
    temperature: 0.1,
    maxTokens: 4096,
  },
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

interface CapabilityCardProps {
  role: CapabilityRole;
  assignment: CapabilityRouteAssignment;
  preset: CapabilityPresetDetail;
  isExpanded: boolean;
  getRouteLabel: (channelId: string) => string;
  onToggleExpand: () => void;
  onOpenCapabilityRoutes: () => void;
  onSavePreset: (role: string, updated: CapabilityPresetDetail) => void;
  pick: <T>(zh: T, en: T) => T;
}

const CapabilityCard: React.FC<CapabilityCardProps> = React.memo(({
  role,
  assignment,
  preset,
  isExpanded,
  getRouteLabel,
  onToggleExpand,
  onOpenCapabilityRoutes,
  onSavePreset,
  pick,
}) => {
  const [localPrompt, setLocalPrompt] = useState(preset.systemPrompt);
  const [localTemp, setLocalTemp] = useState(preset.temperature);
  const [localMaxTokens, setLocalMaxTokens] = useState(preset.maxTokens);

  const isOcr = role === 'ocr_document';
  const [ocrSettings, setOcrSettings] = useState(() => isOcr ? getOcrServiceSettings() : null);

  useEffect(() => {
    if (!isOcr) return;
    setOcrSettings(getOcrServiceSettings());
    return subscribeOcrServiceSettings(() => {
      setOcrSettings(getOcrServiceSettings());
    });
  }, [isOcr]);

  useEffect(() => {
    setLocalPrompt(preset.systemPrompt);
    setLocalTemp(preset.temperature);
    setLocalMaxTokens(preset.maxTokens);
  }, [preset]);

  const debouncedPrompt = useDebounce(localPrompt, 800);
  useEffect(() => {
    if (debouncedPrompt !== preset.systemPrompt) {
      onSavePreset(role, { systemPrompt: debouncedPrompt, temperature: localTemp, maxTokens: localMaxTokens });
    }
  }, [debouncedPrompt, localMaxTokens, localTemp, onSavePreset, preset.systemPrompt, role]);

  const handleTempChange = (val: number) => {
    setLocalTemp(val);
    onSavePreset(role, { systemPrompt: localPrompt, temperature: val, maxTokens: localMaxTokens });
  };

  const handleMaxTokensChange = (val: number) => {
    setLocalMaxTokens(val);
    onSavePreset(role, { systemPrompt: localPrompt, temperature: localTemp, maxTokens: val });
  };

  const getRoleDisplayName = (r: string) => {
    if (r === 'assistant') return pick('文本对话', 'Text Chat');
    if (r === 'image_generation') return pick('图片生成', 'Image Generation');
    if (r === 'video_generation') return pick('视频生成', 'Video Generation');
    if (r === 'ocr_document') return pick('OCR 文本识别', 'OCR Document');
    return r;
  };

  const getRoleDescription = (r: string) => {
    if (r === 'assistant') return pick('处理画布的对话助理、脑暴大纲及交互控制的核心大脑通道。', 'Core channel for text conversation, brainstorming, and canvas controls.');
    if (r === 'image_generation') return pick('文生图与图生图的扩写、美化和模型指派接口。', 'Preferred route for expansion, optimization and model routing of image generation.');
    if (r === 'video_generation') return pick('电影视频分镜生成、动态控制及镜头控制能力的路由信道。', 'Routing endpoint for dynamic video generation models.');
    if (r === 'ocr_document') return pick('对画布中的图片提取文本、分析排版结构以及进行文字识别的底层通道。', 'Preferred route for extracting text, layout analysis and text recognition in canvas images.');
    return '';
  };

  const getRoleIcon = (r: string) => {
    if (r === 'assistant') return MessageSquare;
    if (r === 'image_generation') return ImageIcon;
    if (r === 'video_generation') return VideoIcon;
    return Bot;
  };

  const Icon = getRoleIcon(role);
  const primaryRouteLabel = getRouteLabel(assignment.primaryRouteId || '');
  const fallbackRouteLabel = getRouteLabel(assignment.fallbackRouteId || '');
  const primaryModelLabel = assignment.primaryModelId || pick('自动选择', 'Auto detect');
  const fallbackModelLabel = assignment.fallbackModelId || pick('自动选择', 'Auto detect');

  return (
    <div
      className="rounded-[24px] border p-6 transition-all space-y-4 shadow-sm"
      style={{
        ...SETTINGS_PANEL_STYLE,
        border: isExpanded ? '1px solid var(--settings-focus-border)' : '1px solid var(--border-light)',
        background: isExpanded ? 'var(--settings-surface-elevated)' : 'var(--settings-section-bg)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4 items-center">
          <div
            className="p-3.5 rounded-2xl flex items-center justify-center border"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--settings-state-info-text)' }}
          >
            <Icon size={22} />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-[var(--text-primary)] flex items-center gap-2">
              {getRoleDisplayName(role)}
              {assignment.enabled ? (
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" /> // UI_TOKEN_EXCEPTION
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              )}
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 max-w-xl">
              {getRoleDescription(role)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
              assignment.enabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : 'border-slate-500/20 bg-slate-500/10 text-slate-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${assignment.enabled ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            {assignment.enabled ? pick('路由已启用', 'Route enabled') : pick('路由已停用', 'Route disabled')}
          </span>
          <SettingsActionButton
            size="sm"
            onClick={onToggleExpand}
            icon={isExpanded ? ChevronUp : ChevronDown}
            data-ai-management-action={AI_MANAGEMENT_ACTIONS.toggleCapabilitySettings.uiAction}
          >
            {isExpanded ? pick('折叠设置', 'Collapse') : pick('能力设置', 'Capability settings')}
          </SettingsActionButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] p-4 rounded-2xl border transition-all duration-300" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{pick('主路由', 'Primary route')}</div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{primaryRouteLabel}</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{primaryModelLabel}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{pick('后备路由', 'Fallback route')}</div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{fallbackRouteLabel}</div>
            <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{fallbackModelLabel}</div>
          </div>
        </div>
        <SettingsActionButton
          size="sm"
          icon={ArrowRight}
          onClick={onOpenCapabilityRoutes}
          data-ai-management-action={AI_MANAGEMENT_ACTIONS.openCapabilityRoutes.uiAction}
        >
          {pick('去 API 管理配置', 'Configure in API Management')}
        </SettingsActionButton>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-5 animate-in slide-in-from-top-2 duration-200" style={{ borderColor: 'var(--border-light)' }}>
          <h4 className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            {pick('能力参数预设', 'Capability parameter presets')}
          </h4>

          <div className="space-y-1.5">
            <label className={SETTINGS_LABEL_CLASSNAME}>{pick('System Prompt（系统人设引导指令）', 'System Prompt')}</label>
            <textarea
              rows={3}
              className={SETTINGS_INPUT_CLASSNAME}
              placeholder={pick('引导 AI 模型在此能力下的执行人设和语气...', 'Instruct the AI how to act in this role...')}
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              onBlur={() => onSavePreset(role, { systemPrompt: localPrompt, temperature: localTemp, maxTokens: localMaxTokens })}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className={SETTINGS_LABEL_CLASSNAME}>{pick('Temperature（采样温度）', 'Temperature')}</label>
                <span className="text-[12px] font-mono text-[var(--text-secondary)] font-bold">{localTemp.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localTemp}
                  onChange={(e) => handleTempChange(parseFloat(e.target.value))}
                  className="flex-1 accent-[var(--clay-ink)] h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleTempChange(0.2)}
                    data-ai-management-action={AI_MANAGEMENT_ACTIONS.setTemperaturePrecise.uiAction}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] border cursor-pointer hover:bg-slate-200"
                  >
                    {pick('精准', 'Precise')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTempChange(0.7)}
                    data-ai-management-action={AI_MANAGEMENT_ACTIONS.setTemperatureBalanced.uiAction}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] border cursor-pointer hover:bg-slate-200"
                  >
                    {pick('平衡', 'Balanced')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTempChange(1.3)}
                    data-ai-management-action={AI_MANAGEMENT_ACTIONS.setTemperatureCreative.uiAction}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] border cursor-pointer hover:bg-slate-200"
                  >
                    {pick('创造', 'Creative')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SettingInput
                label={pick('单次最大词元数', 'Max Tokens')}
                value={localMaxTokens.toString()}
                type="number"
                onChange={(val) => handleMaxTokensChange(parseInt(val, 10) || 2048)}
                placeholder="2048"
              />
              <div className="rounded-2xl border p-4 text-[12px] text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}>
                <div className="font-semibold text-[var(--text-primary)]">{pick('路由由 API 管理统一维护', 'Routes are owned by API Management')}</div>
                <p className="mt-1 leading-relaxed">
                  {pick('这里仅维护 AI 行为预设。供应商、模型、主备路由和开关状态都在 API 管理的能力分配模块中配置。', 'This page only manages AI behavior presets. Providers, models, primary/fallback routes, and route enablement live in API Management capability roles.')}
                </p>
              </div>
            </div>
          </div>

          {isOcr && ocrSettings && (
            <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: 'var(--border-light)' }}>
              <h4 className="text-[13px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-500" />
                {pick('OCR 服务接口与密钥配置', 'OCR Service Credentials & Provider')}
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <SettingSelect
                    label={pick('OCR 服务商', 'OCR Provider')}
                    value={ocrSettings.provider}
                    options={[
                      { value: 'nutrient', label: pick('Nutrient (默认集成)', 'Nutrient (Built-in)') },
                      { value: 'baidu', label: pick('Baidu 百度智能云 OCR', 'Baidu Cloud OCR') },
                    ]}
                    onChange={(val) => {
                      const updated = updateOcrServiceSettings({ provider: val as 'baidu' | 'nutrient' });
                      setOcrSettings(updated);
                    }}
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    {ocrSettings.provider === 'nutrient'
                      ? pick('使用系统内置免费的 Nutrient 服务，密钥由服务端环境托管。', 'Uses system default Nutrient OCR hosted by the backend.')
                      : pick('使用您自己的百度智能云 OCR 服务，需在下方配置专属的 API Key。', 'Uses your own Baidu OCR cloud services. Credentials required below.')}
                  </p>
                </div>

                <div className="space-y-2">
                  <SettingInput
                    label={pick('默认识别语言', 'Default OCR Language')}
                    value={ocrSettings.defaultLanguage || 'chi_sim'}
                    onChange={(val) => {
                      const updated = updateOcrServiceSettings({ defaultLanguage: val });
                      setOcrSettings(updated);
                    }}
                    placeholder="chi_sim"
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    {pick('常见选项：chi_sim (简体中文), ENG (英文)。', 'Options: chi_sim (Simplified Chinese), ENG (English).')}
                  </p>
                </div>
              </div>

              {ocrSettings.provider === 'baidu' && (
                <div className="grid gap-4 md:grid-cols-2 bg-[var(--bg-secondary)] p-4 rounded-2xl border" style={{ borderColor: 'var(--border-light)' }}>
                  <SettingInput
                    label="Baidu API Key"
                    value={ocrSettings.baiduApiKey || ''}
                    autoComplete="new-password"
                    onChange={(val) => {
                      const updated = updateOcrServiceSettings({ baiduApiKey: val });
                      setOcrSettings(updated);
                    }}
                    placeholder={pick('输入百度的 API Key', 'Enter Baidu API Key')}
                  />
                  <SettingInput
                    label="Baidu Secret Key"
                    value={ocrSettings.baiduSecretKey || ''}
                    type="password"
                    autoComplete="new-password"
                    onChange={(val) => {
                      const updated = updateOcrServiceSettings({ baiduSecretKey: val });
                      setOcrSettings(updated);
                    }}
                    placeholder={pick('输入百度的 Secret Key', 'Enter Baidu Secret Key')}
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 rounded-xl border text-xs" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${ocrSettings.enabled && (ocrSettings.provider === 'nutrient' || (ocrSettings.baiduApiKey && ocrSettings.baiduSecretKey)) ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`} />
                  <span className="font-semibold text-[var(--text-primary)]">
                    {ocrSettings.provider === 'nutrient'
                      ? pick('Nutrient 服务：已就绪 (由服务端托管)', 'Nutrient: Ready (Hosted by server)')
                      : ocrSettings.baiduApiKey && ocrSettings.baiduSecretKey
                        ? pick('百度智能云 OCR：已就绪 (已配置专属密钥)', 'Baidu OCR: Active (BYOK Configured)')
                        : pick('百度智能云 OCR：未就绪 (缺少 API 密钥)', 'Baidu OCR: Inactive (Keys Missing)')}
                  </span>
                </div>
                {ocrSettings.provider === 'baidu' && (
                  <a
                    href="https://console.bce.baidu.com/ai/#/ai/ocr/overview/index"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    {pick('获取百度 API 密钥 ↗', 'Get Baidu Key ↗')}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

CapabilityCard.displayName = 'CapabilityCard';

interface SkillCardProps {
  skill: AgentSkillRecord;
  onEdit: () => void;
  onDelete: () => void;
  pick: <T>(zh: T, en: T) => T;
}

const SkillCard: React.FC<SkillCardProps> = React.memo(({ skill, onEdit, onDelete, pick }) => (
  <div className="rounded-[24px] border p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden" style={SETTINGS_PANEL_STYLE}>
    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full filter blur-xl pointer-events-none" />
    <div className="space-y-3 relative z-10">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-[15px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Wand2 size={13} className="text-blue-500" />
            {skill.name}
          </h4>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-mono font-bold mt-1.5 border border-blue-500/20">
            {pick('命令行触发语：', 'Trigger: ')}/{skill.trigger}
          </div>
        </div>
        <SettingsBadge tone="slate">Skill</SettingsBadge>
      </div>

      <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 min-h-[36px]">
        {skill.steps?.[0] || pick('暂无技能描述。', 'No description.')}
      </p>

      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {pick('已授权调用的工具列表:', 'Authorized tools:')}
        </div>
        <div className="flex flex-wrap gap-1">
          {skill.tools.map((tool) => (
            <span key={tool} className="text-[9.5px] px-2 py-0.5 rounded-md font-mono bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] border border-slate-200/50">
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="flex gap-2 justify-end pt-4 mt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
      <SettingsActionButton
        size="sm"
        icon={Edit}
        onClick={onEdit}
        data-ai-management-action={AI_MANAGEMENT_ACTIONS.editSkill.uiAction}
      >
        {pick('编辑', 'Edit')}
      </SettingsActionButton>
      <SettingsActionButton
        size="sm"
        tone="danger"
        icon={Trash2}
        onClick={onDelete}
        data-ai-management-action={AI_MANAGEMENT_ACTIONS.deleteSkill.uiAction}
      >
        {pick('删除', 'Delete')}
      </SettingsActionButton>
    </div>
  </div>
));

SkillCard.displayName = 'SkillCard';

interface SkillModalProps {
  editingSkill: AgentSkillRecord | null;
  onClose: () => void;
  onSave: (data: { name: string; trigger: string; desc: string; tools: string[]; prompt: string }) => void;
  pick: <T>(zh: T, en: T) => T;
}

const SkillModal: React.FC<SkillModalProps> = React.memo(({ editingSkill, onClose, onSave, pick }) => {
  const [name, setName] = useState(editingSkill ? editingSkill.name : '');
  const [trigger, setTrigger] = useState(editingSkill ? editingSkill.trigger : '');
  const [desc, setDesc] = useState(editingSkill ? editingSkill.steps?.[0] || '' : '');
  const [tools, setTools] = useState<string[]>(editingSkill ? editingSkill.tools || [] : []);
  const [prompt, setPrompt] = useState(editingSkill ? editingSkill.safety?.[0] || '' : '');

  const handleSave = () => {
    if (!name.trim() || !trigger.trim() || tools.length === 0) {
      notify.warning(pick('输入不完整', 'Incomplete'), pick('技能名、触发词和工具至少勾选一项。', 'Requires name, trigger and at least one tool.'));
      return;
    }
    onSave({ name, trigger, desc, tools, prompt });
  };

  const handleToolToggle = (toolValue: string) => {
    setTools((current) => current.includes(toolValue) ? current.filter((tool) => tool !== toolValue) : [...current, toolValue]);
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200 ${SETTINGS_MODAL_BACKDROP_CLASSNAME}`}
      style={{ zIndex: KK_LAYER.modalBackdrop }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-ai-skill-modal-title"
        className={`w-full max-w-lg rounded-[24px] border p-6 space-y-5 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${SETTINGS_MODAL_PANEL_CLASSNAME}`}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-light)' }}>
          <div>
            <h3 id="settings-ai-skill-modal-title" className="text-[18px] font-bold text-[var(--text-primary)]">
              {editingSkill ? pick('编辑 Skill 配置', 'Edit Skill') : pick('新建 Skill 配置', 'Create Skill')}
            </h3>
            <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
              {pick('配置触发语、描述、授权工具和执行提示词。', 'Define trigger, description, allowed tools, and instructions.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-ai-management-action={AI_MANAGEMENT_ACTIONS.closeSkillModal.uiAction}
            className="p-1.5 hover:bg-[var(--toolbar-hover)] rounded-full transition-colors cursor-pointer border-none bg-transparent"
          >
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid gap-3 grid-cols-2">
            <SettingInput label={pick('技能名称', 'Skill Name')} value={name} onChange={setName} placeholder={pick('例如：批量头像生成', 'e.g., AvatarGenerator')} />
            <SettingInput label={pick('触发语', 'Trigger word')} value={trigger} onChange={(val) => setTrigger(val.replace(/^\/+/, ''))} placeholder={pick('例如：avatar', 'e.g., avatar')} />
          </div>

          <SettingInput label={pick('技能描述', 'Description')} value={desc} onChange={setDesc} placeholder={pick('说明该技能的任务说明与流程...', 'Describe what this skill does...')} />

          <div className="space-y-2">
            <label className={SETTINGS_LABEL_CLASSNAME}>{pick('授权工具', 'Authorized tools')}</label>
            <div className="rounded-2xl border p-3.5 space-y-2.5 max-h-[160px] overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)' }}>
              {AI_MANAGEMENT_SKILL_TOOL_OPTIONS.map((tool) => (
                <label key={tool.value} className="flex items-start gap-2.5 text-xs text-[var(--text-primary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tools.includes(tool.value)}
                    onChange={() => handleToolToggle(tool.value)}
                    data-ai-management-action={AI_MANAGEMENT_ACTIONS.toggleSkillTool.uiAction}
                    className="mt-0.5 accent-[var(--clay-ink)] cursor-pointer"
                  />
                  <span>{tool.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {pick('AI 助手执行此 Skill 时，只允许调用这里授权的工具。', 'The assistant may only call the tools authorized here when this Skill runs.')}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className={SETTINGS_LABEL_CLASSNAME}>{pick('执行提示词', 'Instructions Prompt')}</label>
            <textarea rows={4} className={SETTINGS_INPUT_CLASSNAME} placeholder={pick('指导 AI 触发此技能时应遵循的流程、约束或输出格式...', 'Instruct the AI how to behave when this skill is active...')} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-light)' }}>
          <SettingsActionButton
            onClick={onClose}
            data-ai-management-action={AI_MANAGEMENT_ACTIONS.cancelSkillModal.uiAction}
          >
            {pick('取消', 'Cancel')}
          </SettingsActionButton>
          <SettingsActionButton
            tone="primary"
            onClick={handleSave}
            data-ai-management-action={AI_MANAGEMENT_ACTIONS.saveSkillModal.uiAction}
          >
            {pick('保存 Skill', 'Save Skill')}
          </SettingsActionButton>
        </div>
      </div>
    </div>
  );
});

SkillModal.displayName = 'SkillModal';

const AiManagementView: React.FC = () => {
  const { pick } = useLocale();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'capability' | 'skills'>('capability');
  const [capabilityAssignments, setCapabilityAssignments] = useState(() => getCapabilityRouteAssignments());
  const [slots, setSlots] = useState<KeySlot[]>(() => keyManager.getSlots());
  const [providers, setProviders] = useState<ThirdPartyProvider[]>(() => keyManager.getProviders());
  const [localPresets, setLocalPresets] = useState<LocalPresetsState>(() => {
    if (typeof window === 'undefined') return defaultPresets;
    try {
      const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
      if (raw) return { ...defaultPresets, ...JSON.parse(raw) };
    } catch {
      // ignore local preset parse errors
    }
    return defaultPresets;
  });
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [skills, setSkills] = useState<AgentSkillRecord[]>(() => knowledgeStore.listSkills());
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AgentSkillRecord | null>(null);

  useEffect(() => {
    setCapabilityAssignments(getCapabilityRouteAssignments());
    return subscribeCapabilityRouteAssignments(() => setCapabilityAssignments(getCapabilityRouteAssignments()));
  }, []);

  const refreshKeys = useCallback(() => {
    setSlots(keyManager.getSlots());
    setProviders(keyManager.getProviders());
  }, []);

  useEffect(() => {
    refreshKeys();
    return keyManager.subscribe(refreshKeys);
  }, [refreshKeys]);

  const handleSavePreset = useCallback((role: string, updated: CapabilityPresetDetail) => {
    setLocalPresets((prev) => {
      const next = { ...prev, [role]: updated };
      try {
        window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failure
      }
      return next;
    });
  }, []);

  const allChannelConfigs = useMemo(
    () => keyManager.getChannelConfigs({ includeDisabled: true, includeProviders: true }),
    [slots, providers]
  );

  const routeLabelById = useMemo(
    () => new Map(allChannelConfigs.map((channel) => [
      channel.id,
      channel.id.startsWith('official:') ? `${channel.name} 官方` : `${channel.name} (${channel.baseUrl})`,
    ])),
    [allChannelConfigs]
  );

  const getRouteLabel = useCallback((channelId: string) => {
    if (!channelId) return pick('自动选择', 'Automatic');
    return routeLabelById.get(channelId) || pick('路由已删除或不可用', 'Route deleted or unavailable');
  }, [pick, routeLabelById]);

  const handleOpenCapabilityRoutes = useCallback(() => {
    navigate('/settings/api-management');
  }, [navigate]);

  const handleOpenAddSkill = () => {
    setEditingSkill(null);
    setShowSkillModal(true);
  };

  const handleOpenEditSkill = (skill: AgentSkillRecord) => {
    setEditingSkill(skill);
    setShowSkillModal(true);
  };

  const handleSaveSkill = (formData: { name: string; trigger: string; desc: string; tools: string[]; prompt: string }) => {
    try {
      knowledgeStore.upsertSkill({
        name: formData.name,
        trigger: formData.trigger,
        tools: formData.tools,
        steps: [formData.desc],
        safety: [formData.prompt],
      });
      setSkills(knowledgeStore.listSkills());
      setShowSkillModal(false);
      notify.success(pick('保存成功', 'Saved'), pick('Skill 配置已保存。', 'Skill saved successfully.'));
    } catch (err: any) {
      notify.error(pick('保存失败', 'Error'), err.message || String(err));
    }
  };

  const handleDeleteSkill = (id: string) => {
    if (!window.confirm(pick('确定要删除该 Skill 吗？', 'Are you sure you want to delete this Skill?'))) return;
    try {
      knowledgeStore.deleteSkill(id);
      setSkills(knowledgeStore.listSkills());
      notify.success(pick('删除成功', 'Deleted'), pick('Skill 已移除。', 'Skill deleted successfully.'));
    } catch (err: any) {
      notify.error(pick('删除失败', 'Error'), err.message || String(err));
    }
  };

  const targetRoles: CapabilityRole[] = ['assistant', 'image_generation', 'ocr_document', 'video_generation'];

  return (
    <SettingsViewShell>
      <SettingsHero
        eyebrow={pick('AI Settings', 'AI Settings')}
        title={pick('AI 管理', 'AI Management')}
        description={pick('这里只管理 AI 能力设置和 Skill 配置。供应商、Key、预设 API 与价格费用在供应商配置页面维护。', 'Manage only AI capabilities and Skills here. Providers, keys, API presets, and pricing are handled in provider settings.')}
        icon={Wand2}
        tone="indigo"
      />

      <div className="flex border-b mb-6 pb-2" style={{ borderColor: 'var(--border-light)' }}>
        <div className="flex gap-1.5 p-1 rounded-2xl bg-[var(--bg-secondary)] border" style={{ borderColor: 'var(--border-light)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('capability')}
            data-ai-management-action={AI_MANAGEMENT_ACTIONS.switchCapabilitiesTab.uiAction}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-none text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'capability' ? 'bg-[var(--clay-ink)] text-white shadow-md' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders size={14} />
            {pick('能力设置', 'Capabilities')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            data-ai-management-action={AI_MANAGEMENT_ACTIONS.switchSkillsTab.uiAction}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-none text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'skills' ? 'bg-[var(--clay-ink)] text-white shadow-md' : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bot size={14} />
            {pick('Skill 配置', 'Skills')}
          </button>
        </div>
      </div>

      {activeTab === 'capability' ? (
        <div className="space-y-4">
          {targetRoles.map((role) => {
            const assignment = capabilityAssignments.find((item) => item.role === role) || {
              role,
              enabled: true,
              primaryRouteId: '',
              primaryModelId: '',
              fallbackRouteId: '',
              fallbackModelId: '',
              updatedAt: Date.now(),
            };
            const isExpanded = expandedRole === role;
            const preset = localPresets[role] || defaultPresets[role];

            return (
              <CapabilityCard
                key={role}
                role={role}
                assignment={assignment}
                preset={preset}
                isExpanded={isExpanded}
                getRouteLabel={getRouteLabel}
                onToggleExpand={() => setExpandedRole(isExpanded ? null : role)}
                onOpenCapabilityRoutes={handleOpenCapabilityRoutes}
                onSavePreset={handleSavePreset}
                pick={pick}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{pick('Skill 配置', 'Skill Configuration')}</h3>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                {pick('配置 AI 助手的触发语、执行提示词和授权工具边界。', 'Configure triggers, instructions, and tool permission boundaries for the AI assistant.')}
              </p>
            </div>
            <SettingsActionButton
              tone="primary"
              icon={Plus}
              onClick={handleOpenAddSkill}
              data-ai-management-action={AI_MANAGEMENT_ACTIONS.createSkill.uiAction}
            >
              {pick('新建 Skill', 'Create Skill')}
            </SettingsActionButton>
          </div>

          {skills.length === 0 ? (
            <div className="rounded-[24px] border border-dashed p-12 text-center text-[var(--text-tertiary)]" style={SETTINGS_PANEL_STYLE}>
              <Bot size={44} className="mx-auto mb-3 opacity-40 text-slate-400" />
              <div className="text-sm font-semibold">{pick('暂无 Skill 配置', 'No Skills')}</div>
              <p className="text-xs mt-1 text-[var(--text-tertiary)]">
                {pick('点击右上角创建一个 Skill。', 'Click the button to create a Skill.')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {skills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} onEdit={() => handleOpenEditSkill(skill)} onDelete={() => handleDeleteSkill(skill.id)} pick={pick} />
              ))}
            </div>
          )}
        </div>
      )}

      {showSkillModal && (
        <SkillModal editingSkill={editingSkill} onClose={() => setShowSkillModal(false)} onSave={handleSaveSkill} pick={pick} />
      )}
    </SettingsViewShell>
  );
};

export default AiManagementView;
