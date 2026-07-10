import React, { useState, useEffect } from 'react';
import { Zap, HelpCircle } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsSystemField,
  SettingsHero,
  SettingsActionButton,
  SETTINGS_GLASS_SURFACE_CLASSNAME,
} from '../SettingsScaffold';
import { SettingSelect } from '../ui/index';

export const GenerationModeView: React.FC = () => {
  const { pick } = useLocale();
  
  // 核心模式选择
  const [preferredMode, setPreferredMode] = useState<'auto' | 'local' | 'cloud' | 'platform'>(() => {
    const val = localStorage.getItem('kk_studio_preferred_generation_mode');
    return (val === 'auto' || val === 'cloud' || val === 'platform') ? val : 'local';
  });

  // 高级用户设置项
  const [fallbackToCloud, setFallbackToCloud] = useState(() => {
    return localStorage.getItem('kk_studio_fallback_to_cloud') !== 'false';
  });

  const [enableCodex, setEnableCodex] = useState(() => {
    return localStorage.getItem('kk_studio_enable_openai_oauth') === 'true';
  });

  const handleModeChange = (mode: 'auto' | 'local' | 'cloud' | 'platform') => {
    setPreferredMode(mode);
    localStorage.setItem('kk_studio_preferred_generation_mode', mode);
  };

  const handleFallbackChange = (val: boolean) => {
    setFallbackToCloud(val);
    localStorage.setItem('kk_studio_fallback_to_cloud', String(val));
  };

  const handleCodexChange = (val: boolean) => {
    setEnableCodex(val);
    localStorage.setItem('kk_studio_enable_openai_oauth', String(val));
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('生成模式', 'Generation Mode')}
        eyebrow="Routing Strategy"
        description={pick(
          '配置引擎生成媒体资源时的底层路由倾向。引擎将根据您选择的模式、网络连通性以及当前可用的 Key 智能决定分发路径。',
          'Configure core routing strategy when dispatching generation tasks.'
        )}
        icon={Zap}
        tone="indigo"
      />

      <SettingsSection title={pick('基础策略', 'Basic Strategy')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            aria-pressed={preferredMode === 'auto'}
            onClick={() => handleModeChange('auto')}
            className={`w-full p-4 rounded-xl border cursor-pointer text-left transition-all ${
              preferredMode === 'auto'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <Zap size={16} />
              {pick('自动推荐', 'Auto Mode')}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              {pick(
                '根据网络质量、API Key 配置、可用模型和云端状态自动匹配最佳路径。',
                'Automatically select the optimal generation route based on device and connectivity.'
              )}
            </p>
          </button>

          <button
            type="button"
            aria-pressed={preferredMode === 'local'}
            onClick={() => handleModeChange('local')}
            className={`w-full p-4 rounded-xl border cursor-pointer text-left transition-all ${
              preferredMode === 'local'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <Zap size={16} />
              {pick('本地优先', 'Local First')}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              {pick(
                '优先使用本机的本地模型、本地 API Key 或本地浏览器，减少网络延迟。',
                'Prioritize local API keys, device models, and local browsers.'
              )}
            </p>
          </button>

          <button
            type="button"
            aria-pressed={preferredMode === 'cloud'}
            onClick={() => handleModeChange('cloud')}
            className={`w-full p-4 rounded-xl border cursor-pointer text-left transition-all ${
              preferredMode === 'cloud'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <Zap size={16} />
              {pick('云端优先', 'Cloud First')}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              {pick(
                '优先使用 VPS 安全代理、云端加密密钥。适合弱网或手机端运行。',
                'Prioritize cloud relay proxy, remote keys, and cloud processing.'
              )}
            </p>
          </button>

          <button
            type="button"
            aria-pressed={preferredMode === 'platform'}
            onClick={() => handleModeChange('platform')}
            className={`w-full p-4 rounded-xl border cursor-pointer text-left transition-all ${
              preferredMode === 'platform'
                ? 'border-[var(--accent-coral)] bg-[var(--accent-coral)]/5 text-[var(--text-primary)]'
                : 'border-[var(--border-light)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
            }`}
          >
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <Zap size={16} />
              {pick('平台积分', 'Platform Credits')}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              {pick(
                '直接消耗平台积分，不使用任何自定义 API Key，零配置即用。',
                'Dispatch directly through official channels using platform credits.'
              )}
            </p>
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={pick('高级设置 (高级用户)', 'Advanced Settings (Power Users)')}>
        <div className="space-y-4">
          <SettingsSystemField
            label={pick('默认环境策略', 'Default Device Defaults')}
            description={pick(
              '针对桌面端与手机端的默认基准倾向设置（当前桌面端默认本地优先，手机端默认云端优先）。',
              'Desktop uses Local-first by default; Mobile uses Cloud-first by default.'
            )}
          >
            <div className="text-xs text-[var(--text-secondary)] font-medium px-2 py-1 rounded bg-[var(--bg-tertiary)]">
              {pick('根据宿主平台自动对齐', 'Aligned automatically per host OS')}
            </div>
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('本地失败回退云端', 'Allow Local Failure Fallback')}
            description={pick(
              '当本地运行环境、本地 API Key 故障或请求超时后，是否允许自动将任务路由到云端。',
              'Whether to allow automatic fallback to cloud servers on local router failure.'
            )}
          >
            <SettingSelect
              value={fallbackToCloud ? 'yes' : 'no'}
              onChange={(v) => handleFallbackChange(v === 'yes')}
              options={[
                { label: pick('允许回退', 'Allow Fallback'), value: 'yes' },
                { label: pick('禁止回退', 'Strict Block'), value: 'no' },
              ]}
            />
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('用户网页会员执行策略', 'Web Membership Policy')}
            description={pick(
              '使用用户网页登录态（如 ChatGPT Plus 网页直连）仅在桌面端本地浏览器助手上执行。',
              'Browser direct membership automation runs exclusively on Desktop bridge.'
            )}
          >
            <div className="text-xs text-[var(--text-secondary)] font-medium px-2 py-1 rounded bg-[var(--bg-tertiary)]">
              {pick('强制仅桌面端执行', 'Strict Desktop Only')}
            </div>
          </SettingsSystemField>

          <SettingsSystemField
            label={pick('OpenAI OAuth / Codex', 'OpenAI OAuth / Codex Integration')}
            description={pick(
              '开启实验性的官方 OAuth 免 Key 连接支持（默认关闭，请谨慎使用）。',
              'Enable experimental OAuth connect integration.'
            )}
          >
            <SettingSelect
              value={enableCodex ? 'enabled' : 'disabled'}
              onChange={(v) => handleCodexChange(v === 'enabled')}
              options={[
                { label: pick('已启用 (实验性)', 'Enabled (Beta)'), value: 'enabled' },
                { label: pick('已禁用', 'Disabled'), value: 'disabled' },
              ]}
            />
          </SettingsSystemField>
        </div>
      </SettingsSection>
    </SettingsViewShell>
  );
};

export default GenerationModeView;
