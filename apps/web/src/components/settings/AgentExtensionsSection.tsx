import React, { useEffect, useMemo, useState } from 'react';
import { Blocks, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import type {
  AgentExtensionDto,
  AgentExtensionType,
  UpsertAgentExtensionRequest,
} from '@kk/shared';
import { useLocale } from '../../context/LocaleContext';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import { SettingsActionButton, SettingsBadge, SettingsSection } from './SettingsScaffold';
import { SettingInput, SettingSwitchControl } from './ui/index';

interface ExtensionDraft {
  id: string;
  key: string;
  displayName: string;
  description: string;
  permissionText: string;
  secretRef: string;
}

const EXTENSION_TYPES: AgentExtensionType[] = ['skill', 'mcp', 'plugin'];

function createDraft(): ExtensionDraft {
  return {
    id: crypto.randomUUID(),
    key: '',
    displayName: '',
    description: '',
    permissionText: '',
    secretRef: '',
  };
}

function toRequest(type: AgentExtensionType, draft: ExtensionDraft): UpsertAgentExtensionRequest {
  const permissions = draft.permissionText.split(',').map((item) => item.trim()).filter(Boolean);
  return {
    id: draft.id,
    type,
    enabled: true,
    manifest: {
      schemaVersion: 1,
      key: draft.key.trim(),
      displayName: draft.displayName.trim(),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      permissions,
      ...(draft.secretRef.trim() ? { secretRef: draft.secretRef.trim() } : {}),
    },
  };
}

interface ExtensionTypeTabsProps {
  activeType: AgentExtensionType;
  onChange: (type: AgentExtensionType) => void;
}

const ExtensionTypeTabs: React.FC<ExtensionTypeTabsProps> = ({ activeType, onChange }) => (
  <div className="settings-agent-extension-tabs" role="tablist" aria-label="Agent extensions">
    {EXTENSION_TYPES.map((type) => (
      <button
        key={type}
        type="button"
        role="tab"
        aria-selected={activeType === type}
        data-active={activeType === type}
        onClick={() => onChange(type)}
      >
        {type === 'skill' ? 'Skills' : type === 'mcp' ? 'MCP' : 'Plugins'}
      </button>
    ))}
  </div>
);

interface ExtensionCardProps {
  extension: AgentExtensionDto;
  busy: boolean;
  onToggle: (extension: AgentExtensionDto) => void;
  onDelete: (extension: AgentExtensionDto) => void;
}

const ExtensionCard: React.FC<ExtensionCardProps> = ({ extension, busy, onToggle, onDelete }) => {
  const readOnly = extension.importSource === 'local-import'
    && Boolean(extension.legacyReadonlyUntil && Date.parse(extension.legacyReadonlyUntil) > Date.now());
  return (
    <article className="settings-agent-extension-card">
      <div className="settings-agent-extension-card__main">
        <span className="settings-agent-extension-card__icon"><Blocks size={16} /></span>
        <div>
          <strong>{extension.manifest.displayName}</strong>
          <span>{extension.manifest.description || extension.manifest.key}</span>
          <div className="settings-agent-extension-card__permissions">
            {extension.manifest.permissions.map((permission) => <em key={permission}>{permission}</em>)}
          </div>
        </div>
      </div>
      <div className="settings-agent-extension-card__actions">
        {readOnly ? <SettingsBadge tone="neutral">兼容只读</SettingsBadge> : null}
        <SettingSwitchControl checked={extension.enabled} disabled={busy || readOnly} label={`Toggle ${extension.manifest.displayName}`} onChange={() => onToggle(extension)} />
        <button type="button" aria-label={`Delete ${extension.manifest.displayName}`} disabled={busy || readOnly} onClick={() => onDelete(extension)}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
};

interface ExtensionEditorProps {
  type: AgentExtensionType;
  draft: ExtensionDraft;
  busy: boolean;
  onChange: (draft: ExtensionDraft) => void;
  onSave: () => void;
}

const ExtensionEditor: React.FC<ExtensionEditorProps> = ({ type, draft, busy, onChange, onSave }) => (
  <div className="settings-agent-extension-editor">
    <div className="settings-agent-extension-editor__heading">
      <div>
        <strong>新增 {type === 'skill' ? 'Skill' : type === 'mcp' ? 'MCP' : 'Plugin'}</strong>
        <span>只保存 Manifest、权限和加密 Secret 引用，不保存明文凭据。</span>
      </div>
      <SettingsActionButton icon={Save} disabled={busy || !draft.key.trim() || !draft.displayName.trim()} onClick={onSave}>保存扩展</SettingsActionButton>
    </div>
    <div className="settings-agent-extension-editor__grid">
      <SettingInput label="Manifest Key" value={draft.key} onChange={(key) => onChange({ ...draft, key })} placeholder="my-extension" />
      <SettingInput label="显示名称" value={draft.displayName} onChange={(displayName) => onChange({ ...draft, displayName })} placeholder="扩展名称" />
      <SettingInput label="权限范围" value={draft.permissionText} onChange={(permissionText) => onChange({ ...draft, permissionText })} placeholder="documents:read, canvas:write" helper="使用逗号分隔；执行时仍需经过 ToolRegistry 与 PermissionPolicy。" />
      <SettingInput label="Secret 引用（可选）" value={draft.secretRef} onChange={(secretRef) => onChange({ ...draft, secretRef })} placeholder="vault://agent-extensions/my-extension" helper="仅接受 vault://、keychain:// 或 kms:// 引用。" />
      <div className="settings-agent-extension-editor__wide">
        <SettingInput label="说明" value={draft.description} onChange={(description) => onChange({ ...draft, description })} placeholder="说明此扩展何时可用" />
      </div>
    </div>
  </div>
);

/** Owner-scoped Skill/MCP/Plugin manager shared by desktop and mobile settings shells. */
export const AgentExtensionsSection: React.FC = () => {
  const { pick } = useLocale();
  const [activeType, setActiveType] = useState<AgentExtensionType>('skill');
  const [extensions, setExtensions] = useState<AgentExtensionDto[]>([]);
  const [draft, setDraft] = useState<ExtensionDraft>(createDraft);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const visibleExtensions = useMemo(() => extensions.filter((extension) => extension.type === activeType), [activeType, extensions]);

  const loadExtensions = async () => {
    setBusyId('load');
    const response = await kkWebApiClient.listAgentExtensions();
    setBusyId('');
    if (!response.success) {
      setMessage(pick('无法读取扩展，请检查登录或 API 连接。', 'Could not load extensions. Check authentication or API connectivity.'));
      return;
    }
    setExtensions(response.data);
    setMessage('');
  };

  useEffect(() => {
    void loadExtensions();
  }, []);

  const saveExtension = async () => {
    setBusyId(draft.id);
    const response = await kkWebApiClient.upsertAgentExtension(toRequest(activeType, draft));
    setBusyId('');
    if (!response.success) {
      setMessage(response.error.message);
      return;
    }
    setExtensions((current) => [response.data, ...current.filter((item) => item.id !== response.data.id)]);
    setDraft(createDraft());
    setMessage('');
  };

  const toggleExtension = async (extension: AgentExtensionDto) => {
    setBusyId(extension.id);
    const response = await kkWebApiClient.upsertAgentExtension({ id: extension.id, type: extension.type, manifest: extension.manifest, enabled: !extension.enabled });
    setBusyId('');
    if (response.success) setExtensions((current) => current.map((item) => item.id === extension.id ? response.data : item));
    else setMessage(response.error.message);
  };

  const deleteExtension = async (extension: AgentExtensionDto) => {
    setBusyId(extension.id);
    const response = await kkWebApiClient.deleteAgentExtension(extension.id);
    setBusyId('');
    if (response.success) setExtensions((current) => current.filter((item) => item.id !== extension.id));
    else setMessage(response.error.message);
  };

  return (
    <SettingsSection
      title={pick('Agent 扩展', 'Agent extensions')}
      description={pick('统一管理 owner-scoped Skill、MCP 和 Plugin Manifest。', 'Manage owner-scoped Skill, MCP, and Plugin manifests.')}
      action={<SettingsActionButton icon={RefreshCw} size="sm" loading={busyId === 'load'} onClick={() => void loadExtensions()}>{pick('刷新', 'Refresh')}</SettingsActionButton>}
    >
      <div className="settings-agent-extension-shell">
        <ExtensionTypeTabs activeType={activeType} onChange={setActiveType} />
        <ExtensionEditor type={activeType} draft={draft} busy={Boolean(busyId)} onChange={setDraft} onSave={() => void saveExtension()} />
        {message ? <p className="settings-agent-extension-message">{message}</p> : null}
        <div className="settings-agent-extension-list">
          {visibleExtensions.map((extension) => <ExtensionCard key={extension.id} extension={extension} busy={busyId === extension.id} onToggle={(item) => void toggleExtension(item)} onDelete={(item) => void deleteExtension(item)} />)}
          {visibleExtensions.length === 0 && busyId !== 'load' ? <div className="settings-agent-extension-empty"><Plus size={16} />当前类型还没有扩展，可在上方创建。</div> : null}
        </div>
      </div>
    </SettingsSection>
  );
};

export default AgentExtensionsSection;
