import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CapabilityGraphSnapshotDtoSchema,
  ProviderConnectionDtoSchema,
  type ApiResponse,
  type CapabilityGraphSnapshotDto,
  type ProviderConnectionDto,
} from '@kk/shared';
import { Link2, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { kkWebApiClient } from '../../services/api/kkApiClient';
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
  snapshot?: CapabilityGraphSnapshotDto;
};

function unwrapConnection(response: ApiResponse<ProviderConnectionDto>): ProviderConnectionDto {
  if (!response.success) throw new Error(response.error.message);
  return ProviderConnectionDtoSchema.parse(response.data);
}

async function loadCapabilityGraph(): Promise<GraphAvailability> {
  const response = await kkWebApiClient.getCapabilityGraphSnapshot();
  if (!response.success && response.error.code === 'FEATURE_DISABLED') return { enabled: false };
  if (!response.success) throw new Error(response.error.message);
  return { enabled: true, snapshot: CapabilityGraphSnapshotDtoSchema.parse(response.data) };
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

/**
 * Keeps the new Connection UI behind the server rollout flag while legacy settings remain available.
 */
export const ProviderConnectionsPanel: React.FC = () => {
  const { pick } = useLocale();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState<string>(PHASE_ONE_PROVIDER_TEMPLATE.title);
  const [secret, setSecret] = useState('');
  const graphQuery = useQuery({ queryKey: CAPABILITY_GRAPH_QUERY_KEY, queryFn: loadCapabilityGraph, retry: false });
  const refreshGraph = () => queryClient.invalidateQueries({ queryKey: CAPABILITY_GRAPH_QUERY_KEY });
  const createMutation = useMutation({
    mutationFn: async () => {
      const created = unwrapConnection(await kkWebApiClient.createProviderConnection({
        providerId: PHASE_ONE_PROVIDER_TEMPLATE.providerId,
        displayName: displayName.trim(),
        protocolProfile: PHASE_ONE_PROVIDER_TEMPLATE.protocolProfile,
        secret,
      }));
      return unwrapConnection(await kkWebApiClient.verifyProviderConnection(created.connectionId));
    },
    onSettled: async () => { setSecret(''); await refreshGraph(); },
  });
  const verifyMutation = useMutation({
    mutationFn: async (connectionId: string) => unwrapConnection(
      await kkWebApiClient.verifyProviderConnection(connectionId),
    ),
    onSettled: refreshGraph,
  });
  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await kkWebApiClient.deleteProviderConnection(connectionId);
      if (!response.success) throw new Error(response.error.message);
    },
    onSettled: refreshGraph,
  });

  if (graphQuery.isPending || graphQuery.data?.enabled === false) return null;
  const rows = graphQuery.data?.snapshot ? buildConnectionCapabilityRows(graphQuery.data.snapshot) : [];
  const busy = createMutation.isPending || verifyMutation.isPending || deleteMutation.isPending;
  const operationError = createMutation.error || verifyMutation.error || deleteMutation.error || graphQuery.error;
  const handleDelete = (connectionId: string) => {
    if (window.confirm(pick('删除此 Provider Connection？已有资产与账务记录不会被删除。', 'Delete this Provider Connection? Existing assets and billing records remain.'))) {
      deleteMutation.mutate(connectionId);
    }
  };

  return (
    <SettingsSection title={pick('Provider 连接与能力', 'Provider Connections & Capabilities')}>
      <SettingsSystemCard
        title={PHASE_ONE_PROVIDER_TEMPLATE.title}
        description={pick('密钥仅用于创建请求，服务端保存加密引用并执行受限验证。', 'The credential is request-only; the server stores an encrypted reference and performs a restricted verification.')}
        icon={ShieldCheck}
        tone="emerald"
        action={<SettingsBadge tone="indigo">{PHASE_ONE_PROVIDER_TEMPLATE.badge}</SettingsBadge>}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="text-xs text-[var(--text-secondary)]">
            <span className="mb-1.5 block">{pick('连接名称', 'Connection name')}</span>
            <input className={SETTINGS_INPUT_CLASSNAME} value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            <span className="mb-1.5 block">Google API key</span>
            <input className={SETTINGS_INPUT_CLASSNAME} type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} />
          </label>
          <PrimaryButton loading={createMutation.isPending} disabled={busy || !displayName.trim() || !secret} onClick={() => createMutation.mutate()}>
            <Link2 size={14} /> {pick('创建并验证', 'Create & verify')}
          </PrimaryButton>
        </div>
        {operationError ? <p role="alert" className="text-xs text-[var(--error)]">{operationError.message}</p> : null}
      </SettingsSystemCard>
      <ConnectionList rows={rows} busy={busy} onDelete={handleDelete} onVerify={(connectionId) => verifyMutation.mutate(connectionId)} />
    </SettingsSection>
  );
};

export default ProviderConnectionsPanel;
