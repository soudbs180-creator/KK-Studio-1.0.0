import React, { type ReactNode } from 'react';
import { ArrowLeft, CircleAlert, Layers3 } from 'lucide-react';

import { getModelCapabilityLabels } from './apiWorkbenchSections';
import {
  SETTINGS_INPUT_CLASSNAME,
  SETTINGS_LABEL_CLASSNAME,
  SettingsActionButton,
  SettingsBadge,
} from './SettingsScaffold';

type LocalePick = (zhText: string, enText: string) => string;

interface ApiConnectionEditorShellProps {
  eyebrow: string;
  title: string;
  description: string;
  kindLabel: string;
  statusLabel?: string;
  backLabel: string;
  backTestId: string;
  backAction: string;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared page frame for local API, provider, and preset-backed connection editors. */
export const ApiConnectionEditorShell: React.FC<ApiConnectionEditorShellProps> = ({
  eyebrow,
  title,
  description,
  kindLabel,
  statusLabel,
  backLabel,
  backTestId,
  backAction,
  onBack,
  children,
  footer,
}) => (
  <section className="settings-api-editor" aria-labelledby="settings-api-editor-title">
    <header className="settings-api-editor__hero">
      <SettingsActionButton
        data-testid={backTestId}
        data-content-back-button="true"
        data-api-management-action={backAction}
        icon={ArrowLeft}
        size="sm"
        onClick={onBack}
      >
        {backLabel}
      </SettingsActionButton>
      <div className="settings-api-editor__hero-copy">
        <span>{eyebrow}</span>
        <h2 id="settings-api-editor-title">{title}</h2>
        <p>{description}</p>
      </div>
      <div className="settings-api-editor__hero-status">
        <SettingsBadge tone="indigo">{kindLabel}</SettingsBadge>
        {statusLabel ? <SettingsBadge tone="neutral">{statusLabel}</SettingsBadge> : null}
      </div>
    </header>
    <div className="settings-api-editor__layout">{children}</div>
    <footer className="settings-api-editor__footer">{footer}</footer>
  </section>
);

interface ApiConnectionEditorSectionProps {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Numbered form group shared by every API connection editor route. */
export const ApiConnectionEditorSection: React.FC<ApiConnectionEditorSectionProps> = ({
  step,
  title,
  description,
  children,
  action,
  className = '',
}) => (
  <section className={`settings-api-editor__section ${className}`.trim()}>
    <header>
      <span className="settings-api-editor__step" aria-hidden="true">{step}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="settings-api-editor__section-action">{action}</div> : null}
    </header>
    <div className="settings-api-editor__section-body">{children}</div>
  </section>
);

/** Compact inline warning that avoids turning runtime state into a full form card. */
export const ApiConnectionEditorNotice: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="settings-api-editor__notice" role="status">
    <CircleAlert size={15} aria-hidden="true" />
    <span>{children}</span>
  </div>
);

const parseModelIds = (modelsText: string): string[] => {
  const normalizedIds = String(modelsText || '')
    .split(/[\n,\s]+/)
    .map((modelId) => modelId.trim())
    .filter(Boolean);
  return [...new Set(normalizedIds)].slice(0, 12);
};

const ModelCapabilityRow: React.FC<{ modelId: string; pick: LocalePick }> = ({ modelId, pick }) => (
  <li>
    <code>{modelId}</code>
    <span className="settings-api-editor-model__capabilities">
      {getModelCapabilityLabels(modelId, pick).map((label) => <em key={label}>{label}</em>)}
    </span>
  </li>
);

interface ApiModelCapabilityEditorProps {
  modelsText: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  pick: LocalePick;
}

/** Edits model IDs and previews capabilities from the existing model capability SSOT. */
export const ApiModelCapabilityEditor: React.FC<ApiModelCapabilityEditorProps> = ({
  modelsText,
  onChange,
  disabled = false,
  pick,
}) => {
  const modelIds = parseModelIds(modelsText);
  return (
    <div className="settings-api-editor-model">
      <label>
        <span className={SETTINGS_LABEL_CLASSNAME}>{pick('模型 ID', 'Model IDs')}</span>
        <textarea
          className={`${SETTINGS_INPUT_CLASSNAME} settings-api-editor-model__textarea`}
          value={modelsText}
          onChange={(event) => onChange(event.target.value)}
          placeholder={pick('每行填写一个模型 ID；留空则保存后自动同步', 'One model ID per line; leave empty to sync after saving')}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <p>{pick('能力来自共享模型注册表，不会把未验证能力写入供应商配置。', 'Capabilities are read from the shared model registry and unverified capabilities are never written to the provider.')}</p>
      {modelIds.length > 0 ? (
        <ul>{modelIds.map((modelId) => <ModelCapabilityRow key={modelId} modelId={modelId} pick={pick} />)}</ul>
      ) : (
        <div className="settings-api-editor-model__empty">
          <Layers3 size={16} aria-hidden="true" />
          {pick('保存连接后自动发现模型与能力', 'Models and capabilities will be discovered after saving')}
        </div>
      )}
    </div>
  );
};
