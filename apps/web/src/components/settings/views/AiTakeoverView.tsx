import React, { useState } from 'react';
import { Bot, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useLocale } from '../../../context/LocaleContext';
import {
  SettingsViewShell,
  SettingsSection,
  SettingsSystemField,
  SettingsHero,
  SettingsBadge,
} from '../SettingsScaffold';
import { SettingSelect } from '../ui/index';
import AgentExtensionsSection from '../AgentExtensionsSection';

export const AiTakeoverView: React.FC = () => {
  const { pick } = useLocale();

  const [takeoverMode, setTakeoverMode] = useState<'advisory' | 'low_risk' | 'confirm_medium' | 'confirm_batch' | 'strict'>(() => {
    const val = localStorage.getItem('kk_studio_ai_takeover_mode');
    return (val === 'advisory' || val === 'low_risk' || val === 'confirm_medium' || val === 'confirm_batch' || val === 'strict') ? val : 'confirm_medium';
  });

  const handleModeChange = (mode: typeof takeoverMode) => {
    setTakeoverMode(mode);
    localStorage.setItem('kk_studio_ai_takeover_mode', mode);
  };

  return (
    <SettingsViewShell>
      <SettingsHero
        title={pick('AI 接管模式', 'AI Takeover')}
        eyebrow="AI Governance"
        description={pick(
          '配置 AI 助手在运行复杂工作流、批量生成或浏览器网页助手时的安全接管策略。',
          'Configure safety scopes and authorization levels for AI automated workflow executions.'
        )}
        icon={Bot}
        tone="indigo"
      />

      <SettingsSection title={pick('接管策略', 'Takeover Policy')}>
        <div className="space-y-4">
          <SettingsSystemField
            label={pick('安全授权等级', 'Safety Authorization Level')}
            description={pick(
              '管理自动化运行时是否需要向您弹出确认窗口。推荐使用 [生成与低风险接管] 以免产生过度中断。',
              'Define the manual verification prompt threshold during automated task runs.'
            )}
          >
            <SettingSelect
              value={takeoverMode}
              onChange={(value) => handleModeChange(value as typeof takeoverMode)}
              options={[
                { label: pick('只建议，不执行 (只读模式)', 'Advisory Only'), value: 'advisory' },
                { label: pick('执行低风险任务 (自动整理/提取)', 'Low Risk Auto'), value: 'low_risk' },
                { label: pick('推荐：中低风险自动，高风险确认', 'Auto Low/Med, Confirm High'), value: 'confirm_medium' },
                { label: pick('中风险批量及以上必须确认', 'Confirm on Batch/Medium'), value: 'confirm_batch' },
                { label: pick('极致严格：任何操作必须逐次确认', 'Strict Mode (Confirm All)'), value: 'strict' },
              ]}
            />
          </SettingsSystemField>
        </div>
      </SettingsSection>

      <SettingsSection title={pick('安全与风险边界矩阵 (Permission Policy)', 'Permission Matrix')}>
        <div className="settings-risk-matrix">
          {/* 低风险 */}
          <div className="settings-risk-card" data-tone="success">
            <span className="settings-risk-card__icon">
              <CheckCircle2 size={16} />
            </span>
            <div className="settings-risk-card__content">
              <div className="settings-risk-card__heading">
                <strong>{pick('低风险类别 (自动放行)', 'Low Risk Tiers')}</strong>
                <SettingsBadge tone="emerald">{pick('无痛放行', 'Auto')}</SettingsBadge>
              </div>
              <p>
                {pick('读取网页内容、提取网页图像资产、卡片布局排版整理、工作流生成建议。', 'Reading pages, asset extractions, canvas grid alignments, and next-step advices.')}
              </p>
            </div>
          </div>

          {/* 中风险 */}
          <div className="settings-risk-card" data-tone="warning">
            <span className="settings-risk-card__icon">
              <AlertTriangle size={16} />
            </span>
            <div className="settings-risk-card__content">
              <div className="settings-risk-card__heading">
                <strong>{pick('中风险类别 (需授权/批量提示)', 'Medium Risk Tiers')}</strong>
                <SettingsBadge tone="amber">{pick('按需确认', 'Confirm')}</SettingsBadge>
              </div>
              <p>
                {pick('单张图片/视频生成任务、上传本地媒体资产、调用会员网页直连进行第三方应用自动化。', 'Single media generations, file uploads, and browser web sessions automation.')}
              </p>
            </div>
          </div>

          {/* 高风险 */}
          <div className="settings-risk-card" data-tone="danger">
            <span className="settings-risk-card__icon">
              <Shield size={16} />
            </span>
            <div className="settings-risk-card__content">
              <div className="settings-risk-card__heading">
                <strong>{pick('高风险类别 (必须逐次确认)', 'High Risk Tiers')}</strong>
                <SettingsBadge tone="rose">{pick('必须逐次确认', 'Strict Guards')}</SettingsBadge>
              </div>
              <p>
                {pick('发布推文/帖子、购买第三方会员、删除画布核心资源、改动账号账本设置、向外发送通信消息。', 'Publishing, purchasing, deleting core assets, editing credentials, and communication logs.')}
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      <AgentExtensionsSection />
    </SettingsViewShell>
  );
};

export default AiTakeoverView;
