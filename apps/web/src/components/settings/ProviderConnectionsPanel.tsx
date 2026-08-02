import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CapabilityGraphSnapshotDtoSchema,
  ProviderConnectionDtoSchema,
  ProviderConnectionListDtoSchema,
  type ApiResponse,
  type CapabilityGraphSnapshotDto,
  type ProviderConnectionDto,
} from '@kk/shared';
import { ChevronDown, ChevronUp, GripVertical, Link2, ShieldCheck } from 'lucide-react';
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
  orderRevision: number;
  snapshot?: CapabilityGraphSnapshotDto;
};

function unwrapConnection(response: ApiResponse<ProviderConnectionDto>): ProviderConnectionDto {
  if (!response.success) throw new Error(response.error.message);
  return ProviderConnectionDtoSchema.parse(response.data);
}

async function loadCapabilityGraph(): Promise<GraphAvailability> {
  const response = await kkWebApiClient.getCapabilityGraphSnapshot();
  if (!response.success && response.error.code === 'FEATURE_DISABLED') {
    return { enabled: false, connections: [], orderRevision: 0 };
  }
  if (!response.success) throw new Error(response.error.message);
  const connectionResponse = await kkWebApiClient.listProviderConnections();
  if (!connectionResponse.success) throw new Error(connectionResponse.error.message);
  const connectionList = ProviderConnectionListDtoSchema.parse(connectionResponse.data);
  return {
    enabled: true,
    connections: connectionList.connections,
    orderRevision: connectionList.version === 'v2' ? connectionList.orderRevision : 0,
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
    <div
      className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] p-3.5"
      data-testid={`provider-connection-${row.connectionId}`}
    >
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

export function ConnectionList({
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

function connectionStatusTone(status: ProviderConnectionDto['status']) {
  if (status === 'available') return 'emerald' as const;
  if (status === 'restricted' || status === 'verifying' || status === 'unverified') return 'amber' as const;
  return 'rose' as const;
}

interface OrderedConnectionRowProps {
  busy: boolean;
  capabilityRows: ProviderConnectionCapabilityRow[];
  connection: ProviderConnectionDto;
  index: number;
  isDragging: boolean;
  total: number;
  onDelete: (connectionId: string) => void;
  onDragEnd: () => void;
  onDragStart: (connectionId: string) => void;
  onDrop: (connectionId: string) => void;
  onMove: (connectionId: string, delta: -1 | 1) => void;
  onVerify: (connectionId: string) => void;
}

function OrderedConnectionRow({
  busy,
  capabilityRows,
  connection,
  index,
  isDragging,
  total,
  onDelete,
  onDragEnd,
  onDragStart,
  onDrop,
  onMove,
  onVerify,
}: OrderedConnectionRowProps) {
  const { pick } = useLocale();
  const primaryCapability = capabilityRows[0];
  const providerName = primaryCapability?.providerName || connection.providerId;
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(connection.connectionId, -1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(connection.connectionId, 1);
    }
  };

  return (
    <article
      className="provider-connection-order-card"
      data-dragging={isDragging ? 'true' : 'false'}
      data-testid={`provider-connection-${connection.connectionId}`}
      draggable={!busy}
      onDragStart={() => onDragStart(connection.connectionId)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(connection.connectionId)}
      onDragEnd={onDragEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="provider-connection-order-card__handle" aria-hidden="true">
        <GripVertical size={16} />
        <span>{index + 1}</span>
      </div>
      <div className="provider-connection-order-card__identity">
        <div className="min-w-0">
          <div className="text-xs font-bold text-[var(--text-primary)]">{connection.displayName}</div>
          <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">
            {providerName} · {connection.protocolProfile}
          </div>
        </div>
        <SettingsBadge tone={connectionStatusTone(connection.status)}>{connection.status}</SettingsBadge>
      </div>
      <div className="provider-connection-order-card__capabilities">
        <div className="flex flex-wrap gap-1.5">
          {capabilityRows.length > 0 ? capabilityRows.map((row) => (
            <SettingsBadge key={`${row.modelName}:${row.capabilityName}`} tone="indigo">
              {row.modelName} → {row.capabilityName}
            </SettingsBadge>
          )) : (
            <SettingsBadge tone="neutral">{pick('尚未绑定能力', 'No capability bindings')}</SettingsBadge>
          )}
          {primaryCapability?.channel ? <SettingsBadge tone="neutral">{primaryCapability.channel}</SettingsBadge> : null}
          {primaryCapability?.requestProfile ? <SettingsBadge tone="neutral">{primaryCapability.requestProfile}</SettingsBadge> : null}
        </div>
      </div>
      <div className="provider-connection-order-card__actions">
        <div className="provider-connection-order-card__move-actions">
          <button
            type="button"
            className="provider-connection-order-card__move"
            aria-label={pick('上移供应商', 'Move provider up')}
            disabled={busy || index === 0}
            onClick={() => onMove(connection.connectionId, -1)}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            className="provider-connection-order-card__move"
            aria-label={pick('下移供应商', 'Move provider down')}
            disabled={busy || index === total - 1}
            onClick={() => onMove(connection.connectionId, 1)}
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="flex gap-2">
          <SecondaryButton disabled={busy} onClick={() => onVerify(connection.connectionId)}>
            {pick('重新验证', 'Verify')}
          </SecondaryButton>
          <DangerButton disabled={busy} onClick={() => onDelete(connection.connectionId)}>
            {pick('删除', 'Delete')}
          </DangerButton>
        </div>
      </div>
    </article>
  );
}

interface OrderedConnectionListProps {
  busy: boolean;
  connections: ProviderConnectionDto[];
  rows: ProviderConnectionCapabilityRow[];
  onDelete: (connectionId: string) => void;
  onReorder: (connectionIds: string[]) => void;
  onVerify: (connectionId: string) => void;
}

function OrderedConnectionList({
  busy,
  connections,
  rows,
  onDelete,
  onReorder,
  onVerify,
}: OrderedConnectionListProps) {
  const { pick } = useLocale();
  const [draggedConnectionId, setDraggedConnectionId] = useState<string | null>(null);
  const connectionIds = useMemo(
    () => connections.map((connection) => connection.connectionId),
    [connections],
  );
  const rowsByConnection = useMemo(() => {
    const groupedRows = new Map<string, ProviderConnectionCapabilityRow[]>();
    rows.forEach((row) => {
      groupedRows.set(row.connectionId, [...(groupedRows.get(row.connectionId) || []), row]);
    });
    return groupedRows;
  }, [rows]);
  const moveConnection = (connectionId: string, delta: -1 | 1) => {
    const sourceIndex = connectionIds.indexOf(connectionId);
    const destinationIndex = sourceIndex + delta;
    if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex >= connectionIds.length) return;
    const nextIds = [...connectionIds];
    nextIds.splice(destinationIndex, 0, nextIds.splice(sourceIndex, 1)[0]);
    onReorder(nextIds);
  };
  const dropConnection = (destinationId: string) => {
    if (!draggedConnectionId || draggedConnectionId === destinationId) return;
    const sourceIndex = connectionIds.indexOf(draggedConnectionId);
    const destinationIndex = connectionIds.indexOf(destinationId);
    if (sourceIndex < 0 || destinationIndex < 0) return;
    const nextIds = [...connectionIds];
    nextIds.splice(destinationIndex, 0, nextIds.splice(sourceIndex, 1)[0]);
    setDraggedConnectionId(null);
    onReorder(nextIds);
  };

  if (connections.length === 0) {
    return <p className="text-xs text-[var(--text-tertiary)]">{pick('尚未创建安全连接。', 'No secure connections yet.')}</p>;
  }

  return (
    <div className="provider-connection-order-list" role="list">
      {connections.map((connection, index) => (
        <OrderedConnectionRow
          key={connection.connectionId}
          busy={busy}
          capabilityRows={rowsByConnection.get(connection.connectionId) || []}
          connection={connection}
          index={index}
          isDragging={draggedConnectionId === connection.connectionId}
          total={connections.length}
          onDelete={onDelete}
          onDragEnd={() => setDraggedConnectionId(null)}
          onDragStart={setDraggedConnectionId}
          onDrop={dropConnection}
          onMove={moveConnection}
          onVerify={onVerify}
        />
      ))}
    </div>
  );
}

interface MigrationCandidateListProps {
  busy: boolean;
  candidates: ProviderConnectionMigrationCandidate[];
  onSelect: (candidate: ProviderConnectionMigrationCandidate) => void;
}

function MigrationCandidateList({ busy, candidates, onSelect }: MigrationCandidateListProps) {
  const { pick } = useLocale();
  if (candidates.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-overlay)] p-3.5">
      <p className="text-xs font-bold text-[var(--text-primary)]">{pick('可安全迁移的旧连接', 'Legacy connections ready to migrate')}</p>
      <p className="text-[10px] text-[var(--text-tertiary)]">{pick('仅复用名称与 endpoint；旧密钥不会复制，迁移时必须重新输入。', 'Only the name and endpoint are reused. Legacy secrets are never copied and must be re-entered.')}</p>
      {candidates.map((candidate) => (
        <div
          key={candidate.legacyRouteId}
          className="flex flex-wrap items-center justify-between gap-2"
          data-testid={`provider-migration-candidate-${candidate.legacyRouteId}`}
        >
          <div className="min-w-0 text-xs text-[var(--text-secondary)]">
            <div>{candidate.displayName} · {candidate.providerId}</div>
            <div className="mt-0.5 break-all text-[10px] text-[var(--text-tertiary)]">{candidate.endpoint}</div>
            {candidate.requiresSecretReentry ? <SettingsBadge tone="amber">{pick('需重新输入密钥', 'Secret re-entry')}</SettingsBadge> : null}
          </div>
          <SecondaryButton
            controlAction={`provider-migration-select-${candidate.legacyRouteId}`}
            disabled={busy}
            onClick={() => onSelect(candidate)}
          >
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
          <input data-testid="provider-migration-display-name" className={SETTINGS_INPUT_CLASSNAME} value={props.displayName} maxLength={120} readOnly={Boolean(props.selectedMigration)} onChange={(event) => props.onDisplayNameChange(event.target.value)} />
        </label>
        <label className="text-xs text-[var(--text-secondary)]">
          <span className="mb-1.5 block">{props.selectedMigration?.providerId || 'Google'} API key</span>
          <input data-testid="provider-migration-secret" className={SETTINGS_INPUT_CLASSNAME} type="password" autoComplete="off" value={props.secret} onChange={(event) => props.onSecretChange(event.target.value)} />
        </label>
        <PrimaryButton controlAction="provider-migration-submit" loading={props.loading} disabled={props.busy || !props.displayName.trim() || !props.secret} onClick={props.onSubmit}>
          <Link2 size={14} /> {pick('创建并验证', 'Create & verify')}
        </PrimaryButton>
      </div>
      {props.selectedMigration ? <div className="mt-2"><SecondaryButton controlAction="provider-migration-cancel" disabled={props.busy} onClick={props.onCancel}>{pick('取消迁移', 'Cancel migration')}</SecondaryButton></div> : null}
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function useCapabilityGraphState() {
  const [data, setData] = useState<GraphAvailability | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(true);
  const requestRevision = useRef(0);
  const refresh = useCallback(async () => {
    const revision = ++requestRevision.current;
    try {
      const next = await loadCapabilityGraph();
      if (revision === requestRevision.current) {
        setData(next);
        setError(null);
      }
    } catch (nextError) {
      if (revision === requestRevision.current) setError(toError(nextError));
    } finally {
      if (revision === requestRevision.current) setIsPending(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => { requestRevision.current += 1; };
  }, [refresh]);
  return { data, error, isPending, refresh };
}

async function createAndVerifyConnection(
  displayName: string,
  secret: string,
  selectedMigration: ProviderConnectionMigrationCandidate | null,
): Promise<void> {
  const created = unwrapConnection(await kkWebApiClient.createProviderConnection({
    providerId: selectedMigration?.providerId || PHASE_ONE_PROVIDER_TEMPLATE.providerId,
    displayName: displayName.trim(),
    protocolProfile: selectedMigration?.protocolProfile || PHASE_ONE_PROVIDER_TEMPLATE.protocolProfile,
    endpoint: selectedMigration?.endpoint,
    secret,
  }));
  unwrapConnection(await kkWebApiClient.verifyProviderConnection(created.connectionId));
}

async function deleteConnection(connectionId: string): Promise<void> {
  const response = await kkWebApiClient.deleteProviderConnection(connectionId);
  if (!response.success) throw new Error(response.error.message);
}

interface ConnectionOperationsProps {
  displayName: string;
  refreshGraph: () => Promise<void>;
  secret: string;
  selectedMigration: ProviderConnectionMigrationCandidate | null;
  setDisplayName: (value: string) => void;
  setSecret: (value: string) => void;
  setSelectedMigration: (value: ProviderConnectionMigrationCandidate | null) => void;
}

function useConnectionOperations({
  displayName,
  refreshGraph,
  secret,
  selectedMigration,
  setDisplayName,
  setSecret,
  setSelectedMigration,
}: ConnectionOperationsProps) {
  const [error, setError] = useState<Error | null>(null);
  const [pendingOperation, setPendingOperation] = useState<'create' | 'delete' | 'reorder' | 'verify' | null>(null);
  const runOperation = async (
    operation: Exclude<typeof pendingOperation, null>,
    action: () => Promise<void>,
    resetForm = false,
  ) => {
    setPendingOperation(operation);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(toError(nextError));
    } finally {
      if (resetForm) {
        setSecret('');
        setSelectedMigration(null);
        setDisplayName(PHASE_ONE_PROVIDER_TEMPLATE.title);
      }
      await refreshGraph();
      setPendingOperation(null);
    }
  };
  const createConnection = () => runOperation(
    'create',
    () => createAndVerifyConnection(displayName, secret, selectedMigration),
    true,
  );
  const verifyConnection = (connectionId: string) => runOperation('verify', async () => {
    unwrapConnection(await kkWebApiClient.verifyProviderConnection(connectionId));
  });
  const removeConnection = (connectionId: string) => runOperation(
    'delete',
    () => deleteConnection(connectionId),
  );
  const reorderConnections = (connectionIds: string[], expectedOrderRevision: number) => runOperation(
    'reorder',
    async () => {
      const response = await kkWebApiClient.reorderProviderConnections({
        connectionIds,
        expectedOrderRevision,
      });
      if (!response.success) throw new Error(response.error.message);
      ProviderConnectionListDtoSchema.parse(response.data);
    },
  );
  return {
    createConnection,
    deleteConnection: removeConnection,
    error,
    pendingOperation,
    reorderConnections,
    verifyConnection,
  };
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
  const graphState = useCapabilityGraphState();
  const operations = useConnectionOperations({
    displayName, refreshGraph: graphState.refresh, secret, selectedMigration,
    setDisplayName, setSecret, setSelectedMigration,
  });

  if (graphState.isPending || graphState.data?.enabled === false) return null;
  const rows = graphState.data?.snapshot ? buildConnectionCapabilityRows(graphState.data.snapshot) : [];
  const migrationCandidates = buildProviderConnectionMigrationCandidates(
    legacyRoutes,
    graphState.data?.connections || [],
    { providerIds: [PHASE_ONE_PROVIDER_TEMPLATE.providerId] },
  );
  const busy = operations.pendingOperation !== null;
  const operationError = operations.error || graphState.error;
  const handleDelete = (connectionId: string) => {
    if (window.confirm(pick('删除此 Provider Connection？已有资产与账务记录不会被删除。', 'Delete this Provider Connection? Existing assets and billing records remain.'))) {
      void operations.deleteConnection(connectionId);
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
      <ConnectionFormCard busy={busy} displayName={displayName} error={operationError} loading={operations.pendingOperation === 'create'} secret={secret} selectedMigration={selectedMigration} onCancel={handleMigrationCancel} onDisplayNameChange={setDisplayName} onSecretChange={setSecret} onSubmit={() => void operations.createConnection()} />
      <MigrationCandidateList candidates={migrationCandidates} busy={busy} onSelect={handleMigrationSelect} />
      <OrderedConnectionList
        connections={graphState.data?.connections || []}
        rows={rows}
        busy={busy}
        onDelete={handleDelete}
        onReorder={(connectionIds) => void operations.reorderConnections(
          connectionIds,
          graphState.data?.orderRevision || 0,
        )}
        onVerify={(connectionId) => void operations.verifyConnection(connectionId)}
      />
    </SettingsSection>
  );
};

export default ProviderConnectionsPanel;
