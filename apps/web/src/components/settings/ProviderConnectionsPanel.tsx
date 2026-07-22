import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CapabilityGraphSnapshotDtoSchema,
  ProviderConnectionDtoSchema,
  ProviderConnectionListDtoSchema,
  type ApiResponse,
  type CapabilityGraphSnapshotDto,
  type ProviderConnectionDto,
} from '@kk/shared';
import { Link2, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { kkWebApiClient } from '../../services/api/kkApiClient';
import { keyManager } from '../../services/auth/keyManager';
import {
  buildProviderConnectionMigrationCandidates,
  type LegacyProviderRouteMetadata,
  type ProviderConnectionMigrationCandidate,
} from '../../services/provider-connections/providerConnectionMigration';
import {
  SETTINGS_INPUT_CLASSNAME,
  SettingsBadge,
  SettingsSection,
  SettingsSystemCard,
} from './SettingsScaffold';
import { DangerButton, PrimaryButton, SecondaryButton } from './ui';
import {
  buildConnectionCapabilityRows,
  type ProviderConnectionCapabilityRow,
} from './providerConnectionViewModel';

const CAPABILITY_GRAPH_QUERY_KEY = ['capability-graph', 'snapshot'] as const;

// Phase 1 仅支持单个开箱即用的 Provider 连接模板；后续通过 canonical catalog 驱动表单配置。
const PHASE_ONE_PROVIDER_TEMPLATE = {
  providerId: 'google',
  protocolProfile: 'google-official',
  title: 'Google official',
  badge: 'Image / BYOK',
} as const;

type GraphAvailability = {
  enabled: boolean;
  connections: ProviderConnectionDto[];
  snapshot?: CapabilityGraphSnapshotDto;
};

function unwrapConnection(response: ApiResponse<ProviderConnectionDto>): ProviderConnectionDto {
  if (!response.success) throw new Error(response.error.message);
  return ProviderConnectionDtoSchema.parse(response.data);
}

async function loadCapabilityGraph(): Promise<GraphAvailability> {
  const response = await kkWebApiClient.getCapabilityGraphSnapshot();
  if (!response.success && response.error.code === 'FEATURE_DISABLED') return { enabled: false, connections: [] };
  if (!response.success) throw new Error(response.error.message);
  const connectionResponse = await kkWebApiClient.listProviderConnections();
  if (!connectionResponse.success) throw new Error(connectionResponse.error.message);
  const connectionList = ProviderConnectionListDtoSchema.parse(connectionResponse.data);
  return {
    enabled: true,
    connections: connectionList.connections,
    snapshot: CapabilityGraphSnapshotDtoSchema.parse(response.data),
  };
}

function readLegacyRouteMetadata(): LegacyProviderRouteMetadata[] {
  const slots = keyManager.getSlots().map((slot) => ({
    id: slot.id,
    name: slot.name,
    provider: slot.provider,
    baseUrl: slot.baseUrl,
    disabled: slot.disabled,
  }));
  const providers = keyManager.getProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    provider: provider.name,
    baseUrl: provider.baseUrl,
    isActive: provider.isActive,
  }));
  return [...slots, ...providers];
}

function useLegacyRouteMetadata(): LegacyProviderRouteMetadata[] {
  const [revision, setRevision] = useState(0);
  useEffect(() => keyManager.subscribe(() => setRevision((current) => current + 1)), []);
  return useMemo(readLegacyRouteMetadata, [revision]);
}

function statusTone(status: ProviderConnectionCapabilityRow['status']) {
  if (status === 'connected' || status === 'available') return 'emerald' as const;
  if (status === 'restricted') return 'amber' as const;
  return 'rose' as const;
}

function ConnectionRow({
  row,
  busy,
  onDelete,
  onVerify,
}: {
  row: ProviderConnectionCapabilityRow;
  busy: boolean;
  onDelete: (connectionId: string) => void;
  onVerify: (connectionId: string) => void;
}) {
  const { pick } = useLocale();
  return (
    <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[var(--text-primary)]">{row.connectionName}</div>
          <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
            {row.providerName} → {row.modelName} → {row.capabilityName}
          </div>
        </div>
        <SettingsBadge tone={statusTone(row.status)}>{row.status}</SettingsBadge>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <SettingsBadge tone="indigo">{row.channel || pick('未分配通道', 'No channel')}</SettingsBadge>
          {row.requestProfile ? <SettingsBadge tone="neutral">{row.requestProfile}</SettingsBadge> : null}
        </div>
        <div className="flex gap-2">
          <SecondaryButton disabled={busy} onClick={() => onVerify(row.connectionId)}>
            {pick('重新验证', 'Verify')}
          </SecondaryButton>
          <DangerButton disabled={busy} onClick={() => onDelete(row.connectionId)}>
            {pick('删除', 'Delete')}
          </DangerButton>
        </div>
      </div>
    </div>
  );
}

function ConnectionList({
  rows,
  busy,
  onDelete,
  onVerify,
}: {
  rows: ProviderConnectionCapabilityRow[];
  busy: boolean;
  onDelete: (connectionId: string) => void;
  onVerify: (connectionId: string) => void;
}) {
  const { pick } = useLocale();
  if (rows.length === 0) {
    return <p className="text-xs text-[var(--text-tertiary)]">{pick('尚未创建安全连接。', 'No secure connections yet.')}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      {rows.map((row, index) => (
        <ConnectionRow key={`${row.connectionId}:${row.modelName}:${index}`} {...{ row, busy, onDelete, onVerify }} />
      ))}
    </div>
  );
}

function MigrationCandidateList({
  busy,
  candidates,
  onSelect,
}: {
  busy: boolean;
  candidates: ProviderConnectionMigrationCandidate[];
  onSelect: (candidate: ProviderConnectionMigrationCandidate) => void;
}) {
  const { pick } = useLocale();
  if (candidates.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] p-3.5">
      <p className="text-xs font-bold text-[var(--text-primary)]">{pick('可安全迁移的旧连接', 'Legacy connections ready to migrate')}</p>
      <p className="text-[10px] text-[var(--text-tertiary)]">{pick('仅复用名称与 endpoint；旧密钥不会复制，迁移时必须重新输入。', 'Only the name and endpoint are reused. Legacy secrets are never copied and must be re-entered.')}</p>
      {candidates.map((candidate) => (
        <div key={candidate.legacyRouteId} className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-xs text-[var(--text-secondary)]">
            <div>{candidate.displayName} · {candidate.providerId}</div>
            <div className="mt-0.5 break-all text-[10px] text-[var(--text-tertiary)]">{candidate.endpoint}</div>
            {candidate.requiresSecretReentry ? <SettingsBadge tone="amber">{pick('需重新输入密钥', 'Secret re-entry')}</SettingsBadge> : null}
          </div>
          <SecondaryButton disabled={busy} onClick={() => onSelect(candidate)}>
            {pick('迁移此连接', 'Migrate connection')}
          </SecondaryButton>
        </div>
      ))}
    </div>
  );
}

interface ConnectionFormProps {
  busy: boolean;
  displayName: string;
  error: Error | null;
  loading: boolean;
  secret: string;
  selectedMigration: ProviderConnectionMigrationCandidate | null;
  onCancel: () => void;
  onDisplayNameChange: (value: string) => void;
  onSecretChange: (value: string) => void;
  onSubmit: () => void;
}

function ConnectionFormFields(props: ConnectionFormProps) {
  const { pick } = useLocale();
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="text-xs text-[var(--text-secondary)]">
          <span className="mb-1.5 block">{pick('连接名称', 'Connection name')}</span>
          <input className={SETTINGS_INPUT_CLASSNAME} value={props.displayName} maxLength={120} readOnly={Boolean(props.selectedMigration)} onChange={(event) => props.onDisplayNameChange(event.target.value)} />
        </label>
        <label className="text-xs text-[var(--text-secondary)]">
          <span className="mb-1.5 block">{props.selectedMigration?.providerId || 'Google'} API key</span>
          <input className={SETTINGS_INPUT_CLASSNAME} type="password" autoComplete="off" value={props.secret} onChange={(event) => props.onSecretChange(event.target.value)} />
        </label>
        <PrimaryButton loading={props.loading} disabled={props.busy || !props.displayName.trim() || !props.secret} onClick={props.onSubmit}>
          <Link2 size={14} /> {pick('创建并验证', 'Create & verify')}
        </PrimaryButton>
      </div>
      {props.selectedMigration ? <div className="mt-2"><SecondaryButton disabled={props.busy} onClick={props.onCancel}>{pick('取消迁移', 'Cancel migration')}</SecondaryButton></div> : null}
      {props.error ? <p role="alert" className="text-xs text-[var(--error)]">{props.error.message}</p> : null}
    </>
  );
}

function ConnectionFormCard(props: ConnectionFormProps) {
  const { pick } = useLocale();
  return (
    <SettingsSystemCard
      title={props.selectedMigration?.displayName || PHASE_ONE_PROVIDER_TEMPLATE.title}
      description={pick('密钥仅用于创建请求，服务端保存加密引用并执行受限验证。', 'The credential is request-only; the server stores an encrypted reference and performs a restricted verification.')}
      icon={ShieldCheck}
      tone="emerald"
      action={<SettingsBadge tone="indigo">{props.selectedMigration?.providerId || PHASE_ONE_PROVIDER_TEMPLATE.badge}</SettingsBadge>}
    >
      <ConnectionFormFields {...props} />
    </SettingsSystemCard>
  );
}

function useConnectionMutations({
  displayName,
  secret,
  selectedMigration,
  setDisplayName,
  setSecret,
  setSelectedMigration,
}: {
  displayName: string;
  secret: string;
  selectedMigration: ProviderConnectionMigrationCandidate | null;
  setDisplayName: (value: string) => void;
  setSecret: (value: string) => void;
  setSelectedMigration: (value: ProviderConnectionMigrationCandidate | null) => void;
}) {
  const queryClient = useQueryClient();
  const refreshGraph = () => queryClient.invalidateQueries({ queryKey: CAPABILITY_GRAPH_QUERY_KEY });
  const createMutation = useMutation({
    mutationFn: async () => {
      const created = unwrapConnection(await kkWebApiClient.createProviderConnection({
        providerId: selectedMigration?.providerId || PHASE_ONE_PROVIDER_TEMPLATE.providerId,
        displayName: displayName.trim(),
        protocolProfile: selectedMigration?.protocolProfile || PHASE_ONE_PROVIDER_TEMPLATE.protocolProfile,
        endpoint: selectedMigration?.endpoint,
        secret,
      }));
      return unwrapConnection(await kkWebApiClient.verifyProviderConnection(created.connectionId));
    },
    onSettled: async () => { setSecret(''); setSelectedMigration(null); setDisplayName(PHASE_ONE_PROVIDER_TEMPLATE.title); await refreshGraph(); },
  });
  const verifyMutation = useMutation({ mutationFn: async (connectionId: string) => unwrapConnection(await kkWebApiClient.verifyProviderConnection(connectionId)), onSettled: refreshGraph });
  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await kkWebApiClient.deleteProviderConnection(connectionId);
      if (!response.success) throw new Error(response.error.message);
    },
    onSettled: refreshGraph,
  });
  return { createMutation, deleteMutation, verifyMutation };
}

/**
 * Keeps the new Connection UI behind the server rollout flag while legacy settings remain available.
 */
export const ProviderConnectionsPanel: React.FC = () => {
  const { pick } = useLocale();
  const [displayName, setDisplayName] = useState<string>(PHASE_ONE_PROVIDER_TEMPLATE.title);
  const [secret, setSecret] = useState('');
  const [selectedMigration, setSelectedMigration] = useState<ProviderConnectionMigrationCandidate | null>(null);
  const legacyRoutes = useLegacyRouteMetadata();
  const graphQuery = useQuery({ queryKey: CAPABILITY_GRAPH_QUERY_KEY, queryFn: loadCapabilityGraph, retry: false });
  const { createMutation, deleteMutation, verifyMutation } = useConnectionMutations({
    displayName, secret, selectedMigration, setDisplayName, setSecret, setSelectedMigration,
  });

  if (graphQuery.isPending || graphQuery.data?.enabled === false) return null;
  const rows = graphQuery.data?.snapshot ? buildConnectionCapabilityRows(graphQuery.data.snapshot) : [];
  const migrationCandidates = buildProviderConnectionMigrationCandidates(
    legacyRoutes,
    graphQuery.data?.connections || [],
    { providerIds: [PHASE_ONE_PROVIDER_TEMPLATE.providerId] },
  );
  const busy = createMutation.isPending || verifyMutation.isPending || deleteMutation.isPending;
  const operationError = createMutation.error || verifyMutation.error || deleteMutation.error || graphQuery.error;
  const handleDelete = (connectionId: string) => {
    if (window.confirm(pick('删除此 Provider Connection？已有资产与账务记录不会被删除。', 'Delete this Provider Connection? Existing assets and billing records remain.'))) {
      deleteMutation.mutate(connectionId);
    }
  };
  const handleMigrationSelect = (candidate: ProviderConnectionMigrationCandidate) => {
    setSelectedMigration(candidate);
    setDisplayName(candidate.displayName);
    setSecret('');
  };
  const handleMigrationCancel = () => {
    setSelectedMigration(null);
    setDisplayName(PHASE_ONE_PROVIDER_TEMPLATE.title);
    setSecret('');
  };

  return (
    <SettingsSection title={pick('Provider 连接与能力', 'Provider Connections & Capabilities')}>
      <ConnectionFormCard busy={busy} displayName={displayName} error={operationError} loading={createMutation.isPending} secret={secret} selectedMigration={selectedMigration} onCancel={handleMigrationCancel} onDisplayNameChange={setDisplayName} onSecretChange={setSecret} onSubmit={() => createMutation.mutate()} />
      <MigrationCandidateList candidates={migrationCandidates} busy={busy} onSelect={handleMigrationSelect} />
      <ConnectionList rows={rows} busy={busy} onDelete={handleDelete} onVerify={(connectionId) => verifyMutation.mutate(connectionId)} />
    </SettingsSection>
  );
};

export default ProviderConnectionsPanel;
