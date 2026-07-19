import type {
  AssistantGenerationPreferencePatch,
  AssistantSiteCapabilityPorts,
  AssistantToolExecutionContext,
} from '../runtime/AssistantExecutionContext.ts';
import type { AgentToolDefinition, AgentToolControlOverrides } from './ToolRegistry.ts';

type JsonRecord = Record<string, unknown>;

const createCapabilityError = (message: string) => {
  const error = new Error(message) as Error & { code?: string };
  error.code = 'CAPABILITY_UNAVAILABLE';
  return error;
};

const requireSiteCapabilities = (ctx: AssistantToolExecutionContext): AssistantSiteCapabilityPorts => {
  const capabilities = ctx.siteCapabilities as AssistantSiteCapabilityPorts | undefined;
  if (!capabilities) {
    throw createCapabilityError('Site capability ports are unavailable on the current workspace surface.');
  }
  return capabilities;
};

const parseRecord = (input: unknown): JsonRecord => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Tool input must be a JSON object.');
  }
  return input as JsonRecord;
};

const parseRequiredString = (record: JsonRecord, field: string, maxLength = 200): string => {
  const value = typeof record[field] === 'string' ? record[field].trim() : '';
  if (!value) throw new TypeError(`${field} is required.`);
  if (value.length > maxLength) throw new TypeError(`${field} cannot exceed ${maxLength} characters.`);
  return value;
};

const readOnlyControl = (
  scope: 'none' | 'selection' | 'canvas' | 'workspace' | 'external' | 'account',
  summary: string,
): AgentToolControlOverrides => ({
  effect: 'read',
  impact: { scope, summary, cardinality: 'single' },
  cost: { kind: 'none', summary: 'No credits or Provider quota are consumed.' },
  recovery: { cancellable: false, reversible: false, retryable: true },
  idempotency: { required: false, keyField: 'idempotencyKey' },
  failure: { categories: ['validation', 'setup', 'unknown'], defaultRetryable: false },
});

const navigationControl = (summary: string): AgentToolControlOverrides => ({
  effect: 'navigation',
  impact: { scope: 'workspace', summary, cardinality: 'single' },
  cost: { kind: 'none', summary: 'No credits or Provider quota are consumed.' },
  recovery: { cancellable: false, reversible: true, retryable: true },
  idempotency: { required: false, keyField: 'idempotencyKey' },
  failure: { categories: ['validation', 'setup', 'unknown'], defaultRetryable: false },
});

const localMutationControl = (
  scope: 'selection' | 'canvas' | 'workspace',
  summary: string,
  reversible: boolean,
): AgentToolControlOverrides => ({
  effect: 'mutation',
  impact: { scope, summary, cardinality: 'single' },
  cost: { kind: 'none', summary: 'No credits or Provider quota are consumed.' },
  recovery: { cancellable: false, reversible, retryable: false },
  idempotency: { required: true, keyField: 'idempotencyKey' },
  failure: { categories: ['validation', 'permission', 'setup', 'verification', 'unknown'], defaultRetryable: false },
});

const ProjectIdInput = {
  parse(input: unknown) {
    const record = parseRecord(input);
    return {
      projectId: parseRequiredString(record, 'projectId'),
      idempotencyKey: typeof record.idempotencyKey === 'string' ? record.idempotencyKey : undefined,
    };
  },
};

const ProjectCreateInput = {
  parse(input: unknown) {
    const record = parseRecord(input);
    const name = record.name === undefined ? undefined : parseRequiredString(record, 'name', 120);
    return {
      name,
      idempotencyKey: typeof record.idempotencyKey === 'string' ? record.idempotencyKey : undefined,
    };
  },
};

const ProjectRenameInput = {
  parse(input: unknown) {
    const record = parseRecord(input);
    return {
      projectId: parseRequiredString(record, 'projectId'),
      name: parseRequiredString(record, 'name', 120),
      idempotencyKey: typeof record.idempotencyKey === 'string' ? record.idempotencyKey : undefined,
    };
  },
};

const HistoryInput = {
  parse(input: unknown) {
    const record = parseRecord(input);
    return {
      idempotencyKey: typeof record.idempotencyKey === 'string' ? record.idempotencyKey : undefined,
    };
  },
};

const PreferencePatchInput = {
  parse(input: unknown): { patch: AssistantGenerationPreferencePatch; idempotencyKey?: string } {
    const record = parseRecord(input);
    const patchRecord = parseRecord(record.patch);
    const allowedFields = new Set([
      'mode',
      'aspectRatio',
      'imageSize',
      'parallelCount',
      'enablePromptOptimization',
      'enableGrounding',
      'enableImageSearch',
      'thinkingMode',
    ]);
    const unknownField = Object.keys(patchRecord).find((field) => !allowedFields.has(field));
    if (unknownField) throw new TypeError(`Unsupported generation preference: ${unknownField}.`);
    if (Object.keys(patchRecord).length === 0) throw new TypeError('patch must contain at least one preference.');

    const patch: AssistantGenerationPreferencePatch = {};
    if (patchRecord.mode !== undefined) {
      const mode = parseRequiredString(patchRecord, 'mode', 32);
      if (!['image', 'video', 'audio', 'ppt', 'ecommerce'].includes(mode)) {
        throw new TypeError('mode is not supported.');
      }
      patch.mode = mode;
    }
    if (patchRecord.aspectRatio !== undefined) patch.aspectRatio = parseRequiredString(patchRecord, 'aspectRatio', 20);
    if (patchRecord.imageSize !== undefined) patch.imageSize = parseRequiredString(patchRecord, 'imageSize', 20);
    if (patchRecord.parallelCount !== undefined) {
      const count = Number(patchRecord.parallelCount);
      if (!Number.isInteger(count) || count < 1 || count > 8) {
        throw new TypeError('parallelCount must be an integer between 1 and 8.');
      }
      patch.parallelCount = count;
    }
    for (const field of ['enablePromptOptimization', 'enableGrounding', 'enableImageSearch'] as const) {
      if (patchRecord[field] !== undefined) {
        if (typeof patchRecord[field] !== 'boolean') throw new TypeError(`${field} must be boolean.`);
        patch[field] = patchRecord[field];
      }
    }
    if (patchRecord.thinkingMode !== undefined) {
      if (!['minimal', 'high'].includes(String(patchRecord.thinkingMode))) {
        throw new TypeError('thinkingMode must be minimal or high.');
      }
      patch.thinkingMode = patchRecord.thinkingMode as 'minimal' | 'high';
    }

    return {
      patch,
      idempotencyKey: typeof record.idempotencyKey === 'string' ? record.idempotencyKey : undefined,
    };
  },
};

const summarizeQueue = (ctx: AssistantToolExecutionContext) => {
  const jobs = ctx.generationQueue?.getJobs?.() || [];
  return {
    total: jobs.length,
    queued: jobs.filter((job: any) => job.status === 'queued').length,
    running: jobs.filter((job: any) => job.status === 'running').length,
    paused: jobs.filter((job: any) => job.status === 'paused').length,
    failed: jobs.filter((job: any) => ['failed', 'completed_with_errors'].includes(job.status)).length,
    completed: jobs.filter((job: any) => job.status === 'completed').length,
  };
};

const verificationResult = (success: boolean, message: string) => ({ success, message: success ? undefined : message });

export const siteCapabilityTools: AgentToolDefinition[] = [
  {
    name: 'navigation.openSurface',
    description: 'Open a canonical KK Studio workspace surface without simulating a UI click.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        surface: { type: 'string', enum: ['workspace', 'canvas', 'library', 'favorites', 'profile', 'settings'] },
      },
      required: ['surface'],
    },
    control: navigationControl('Changes the visible workspace surface while preserving durable work.'),
    handler: async (input: { surface: 'workspace' | 'canvas' | 'library' | 'favorites' | 'profile' | 'settings' }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const surface = input.surface === 'canvas' ? 'workspace' : input.surface;
      await site.navigation.openSurface(surface);
      return { success: true, surface };
    },
  },
  {
    name: 'navigation.openSettings',
    description: 'Open a KK Studio settings view through the workspace navigation port.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: { view: { type: 'string' } },
    },
    control: navigationControl('Opens a settings view without changing account or payment state.'),
    handler: async (input: { view?: string }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      await site.navigation.openSettings(input.view);
      return { success: true, view: input.view || 'dashboard' };
    },
  },
  {
    name: 'workspace.getState',
    description: 'Read the current workspace, project, selection, durable queue and Agent Run summary.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('workspace', 'Reads a redacted snapshot of the active workspace.'),
    handler: async (_input, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const project = site.project.getSnapshot();
      const runtime = ctx.getCanvasRuntimeState?.() || ctx.canvasRuntimeState;
      const currentRun = ctx.runId ? ctx.runStore?.getRun?.(ctx.runId) : undefined;
      return {
        surface: ctx.currentPage || 'unknown',
        collaborationMode: ctx.collaborationMode || 'direct',
        project,
        selection: runtime?.selection || { selectedNodeIds: [] },
        canvasRevision: ctx.getActiveCanvas?.()?.lastModified || ctx.canvasRevision || 0,
        queue: summarizeQueue(ctx),
        run: currentRun ? { id: currentRun.id, status: currentRun.status, updatedAt: currentRun.updatedAt } : null,
      };
    },
  },
  {
    name: 'workspace.focus',
    description: 'Return to the primary canvas workspace while keeping durable tasks running.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: navigationControl('Returns to the canvas workspace.'),
    handler: async (_input, ctx) => {
      const site = requireSiteCapabilities(ctx);
      await site.navigation.openSurface('workspace');
      return { success: true, surface: 'workspace' };
    },
  },
  {
    name: 'project.list',
    description: 'List user-visible projects with node counts and active state.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('workspace', 'Reads project names, IDs and content counts.'),
    handler: async (_input, ctx) => requireSiteCapabilities(ctx).project.getSnapshot(),
  },
  {
    name: 'project.getActive',
    description: 'Read the active project summary.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('workspace', 'Reads the active project summary.'),
    handler: async (_input, ctx) => {
      const snapshot = requireSiteCapabilities(ctx).project.getSnapshot();
      return snapshot.projects.find((project) => project.id === snapshot.activeProjectId) || null;
    },
  },
  {
    name: 'project.open',
    description: 'Open a concrete project by ID through CanvasContext.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' } },
      required: ['projectId'],
    },
    inputValidator: ProjectIdInput,
    control: navigationControl('Changes the active project and clears stale selection context.'),
    handler: async (input: { projectId: string }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const before = site.project.getSnapshot();
      const project = before.projects.find((item) => item.id === input.projectId);
      if (!project) throw new TypeError(`Project not found: ${input.projectId}`);
      await site.project.openProject(input.projectId);
      return { success: true, projectId: input.projectId, name: project.name };
    },
    verify: (output: { projectId: string }, _input, ctx) => {
      const snapshot = requireSiteCapabilities(ctx).project.getSnapshot();
      return verificationResult(
        snapshot.activeProjectId === output.projectId,
        `Active project did not converge to ${output.projectId}.`,
      );
    },
  },
  {
    name: 'project.create',
    description: 'Create a new project and make it active.',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, idempotencyKey: { type: 'string' } },
    },
    inputValidator: ProjectCreateInput,
    control: localMutationControl('workspace', 'Creates one empty project in the current workspace.', true),
    handler: async (input: { name?: string }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const before = site.project.getSnapshot();
      if (!before.canCreateProject) throw new Error('The project limit has been reached.');
      const projectId = await site.project.createProject(input.name);
      if (!projectId) throw new Error('Project creation did not return a project ID.');
      return { success: true, projectId, name: input.name || null, createdCount: 1 };
    },
    verify: (output: { projectId: string; name: string | null }, _input, ctx) => {
      const snapshot = requireSiteCapabilities(ctx).project.getSnapshot();
      const created = snapshot.projects.find((project) => project.id === output.projectId);
      return verificationResult(
        Boolean(created && (!output.name || created.name === output.name)),
        `Created project ${output.projectId} is missing or its name did not converge.`,
      );
    },
  },
  {
    name: 'project.rename',
    description: 'Rename one project without changing its stable project ID or physical folder binding.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
        idempotencyKey: { type: 'string' },
      },
      required: ['projectId', 'name'],
    },
    inputValidator: ProjectRenameInput,
    control: localMutationControl('workspace', 'Renames one project display label.', true),
    handler: async (input: { projectId: string; name: string }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const project = site.project.getSnapshot().projects.find((item) => item.id === input.projectId);
      if (!project) throw new TypeError(`Project not found: ${input.projectId}`);
      await site.project.renameProject(input.projectId, input.name);
      return { success: true, projectId: input.projectId, previousName: project.name, name: input.name, updatedCount: 1 };
    },
    verify: (output: { projectId: string; name: string }, _input, ctx) => {
      const renamed = requireSiteCapabilities(ctx).project.getSnapshot().projects
        .find((project) => project.id === output.projectId);
      return verificationResult(
        renamed?.name === output.name,
        `Project ${output.projectId} did not converge to the requested name.`,
      );
    },
  },
  {
    name: 'project.delete',
    description: 'Delete one project. This is destructive and cannot delete the last remaining project.',
    permission: 'dangerous',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string' }, idempotencyKey: { type: 'string' } },
      required: ['projectId'],
    },
    inputValidator: ProjectIdInput,
    control: localMutationControl('workspace', 'Permanently removes one project and its local canvas state.', false),
    handler: async (input: { projectId: string }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const snapshot = site.project.getSnapshot();
      if (snapshot.projects.length <= 1) throw new Error('The last remaining project cannot be deleted.');
      const project = snapshot.projects.find((item) => item.id === input.projectId);
      if (!project) throw new TypeError(`Project not found: ${input.projectId}`);
      await site.project.deleteProject(input.projectId);
      return { success: true, projectId: input.projectId, name: project.name, affectedCount: 1 };
    },
    verify: (output: { projectId: string }, _input, ctx) => {
      const snapshot = requireSiteCapabilities(ctx).project.getSnapshot();
      return verificationResult(
        snapshot.projects.length > 0 && !snapshot.projects.some((project) => project.id === output.projectId),
        `Deleted project ${output.projectId} is still present or no fallback project remains.`,
      );
    },
  },
  {
    name: 'assets.list',
    description: 'Read imported assets and active-canvas output metadata without returning file contents or signed URLs.',
    permission: 'safe',
    inputSchema: {
      type: 'object',
      properties: { scope: { type: 'string', enum: ['all', 'imported', 'canvas', 'selection'] } },
    },
    control: readOnlyControl('workspace', 'Reads redacted asset metadata and selection membership.'),
    handler: async (input: { scope?: 'all' | 'imported' | 'canvas' | 'selection' }, ctx) => {
      const site = requireSiteCapabilities(ctx);
      const imported = site.assets.getSnapshot();
      const activeCanvas = ctx.getActiveCanvas?.() || ctx.activeCanvas;
      const selectedIds = new Set(ctx.getSelectedNodeIds?.() || ctx.selectedNodeIds || []);
      const canvasAssets = (activeCanvas?.imageNodes || []).map((node: any) => ({
        id: String(node.id),
        name: String(node.name || node.prompt || 'Canvas output'),
        kind: 'canvas_output',
        status: String(node.status || 'ready'),
        selected: selectedIds.has(String(node.id)),
        hasOriginal: Boolean(node.originalUrl || node.apiResultUrl || node.url || node.storageId),
      }));
      const scope = input.scope || 'all';
      return {
        scope,
        imported: scope === 'canvas' || scope === 'selection' ? undefined : imported,
        canvas: scope === 'imported'
          ? undefined
          : scope === 'selection'
            ? canvasAssets.filter((asset: { selected: boolean }) => asset.selected)
            : canvasAssets,
        counts: {
          importedImages: imported.images.length,
          importedFiles: imported.files.length,
          importedOutputs: imported.outputs.length,
          canvasOutputs: canvasAssets.length,
          selectedCanvasOutputs: canvasAssets.filter((asset: { selected: boolean }) => asset.selected).length,
        },
      };
    },
  },
  {
    name: 'export.getCapabilities',
    description: 'Read supported export capabilities without starting a download.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('workspace', 'Reads export formats and required confirmation policy.'),
    handler: async () => ({
      formats: [
        { id: 'originals_zip', toolName: 'assets.zipOriginals', manifest: true, permission: 'confirm' },
      ],
      accountOrPaymentWrites: false,
    }),
  },
  {
    name: 'history.getState',
    description: 'Read undo and redo availability for the active project.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('canvas', 'Reads the active project history depth.'),
    handler: async (_input, ctx) => requireSiteCapabilities(ctx).history.getSnapshot(),
  },
  {
    name: 'history.undo',
    description: 'Undo one local canvas history entry.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: { idempotencyKey: { type: 'string' } } },
    inputValidator: HistoryInput,
    control: localMutationControl('canvas', 'Reverts one active-project canvas history entry.', true),
    handler: async (_input, ctx) => {
      const history = requireSiteCapabilities(ctx).history;
      const before = history.getSnapshot();
      if (!before.canUndo) throw new Error('There is no canvas change to undo.');
      await history.undo();
      const after = history.getSnapshot();
      return { success: true, projectId: before.projectId, direction: 'undo', before, after, affectedCount: 1 };
    },
    verify: (output: { projectId: string; before: { undoDepth: number; redoDepth: number }; after: { undoDepth: number; redoDepth: number } }, _input, ctx) => {
      const current = requireSiteCapabilities(ctx).history.getSnapshot();
      const changed = output.after.undoDepth !== output.before.undoDepth
        || output.after.redoDepth !== output.before.redoDepth;
      return verificationResult(
        changed
          && current.projectId === output.projectId
          && current.undoDepth === output.after.undoDepth
          && current.redoDepth === output.after.redoDepth,
        'Canvas history did not converge after undo.',
      );
    },
  },
  {
    name: 'history.redo',
    description: 'Redo one local canvas history entry.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: { idempotencyKey: { type: 'string' } } },
    inputValidator: HistoryInput,
    control: localMutationControl('canvas', 'Reapplies one active-project canvas history entry.', true),
    handler: async (_input, ctx) => {
      const history = requireSiteCapabilities(ctx).history;
      const before = history.getSnapshot();
      if (!before.canRedo) throw new Error('There is no canvas change to redo.');
      await history.redo();
      const after = history.getSnapshot();
      return { success: true, projectId: before.projectId, direction: 'redo', before, after, affectedCount: 1 };
    },
    verify: (output: { projectId: string; before: { undoDepth: number; redoDepth: number }; after: { undoDepth: number; redoDepth: number } }, _input, ctx) => {
      const current = requireSiteCapabilities(ctx).history.getSnapshot();
      const changed = output.after.undoDepth !== output.before.undoDepth
        || output.after.redoDepth !== output.before.redoDepth;
      return verificationResult(
        changed
          && current.projectId === output.projectId
          && current.undoDepth === output.after.undoDepth
          && current.redoDepth === output.after.redoDepth,
        'Canvas history did not converge after redo.',
      );
    },
  },
  {
    name: 'preferences.get',
    description: 'Read the allowlisted generation defaults used by the current workspace.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('workspace', 'Reads non-secret generation defaults.'),
    handler: async (_input, ctx) => requireSiteCapabilities(ctx).preferences.getGenerationDefaults(),
  },
  {
    name: 'preferences.updateGenerationDefaults',
    description: 'Update allowlisted generation defaults. Keys, billing and account settings are not accepted.',
    permission: 'confirm',
    inputSchema: {
      type: 'object',
      properties: {
        patch: { type: 'object' },
        idempotencyKey: { type: 'string' },
      },
      required: ['patch'],
    },
    inputValidator: PreferencePatchInput,
    control: localMutationControl('workspace', 'Updates allowlisted generation defaults for future jobs.', true),
    handler: async (input: { patch: AssistantGenerationPreferencePatch }, ctx) => {
      const preferences = requireSiteCapabilities(ctx).preferences;
      const before = preferences.getGenerationDefaults();
      await preferences.updateGenerationDefaults(input.patch);
      const current = preferences.getGenerationDefaults();
      return {
        success: true,
        previous: before,
        current,
        updatedCount: Object.keys(input.patch).length,
      };
    },
    verify: (_output, input: { patch: AssistantGenerationPreferencePatch }, ctx) => {
      const current = requireSiteCapabilities(ctx).preferences.getGenerationDefaults();
      const success = Object.entries(input.patch).every(([field, value]) => (
        current[field as keyof AssistantGenerationPreferencePatch] === value
      ));
      return verificationResult(success, 'Generation preferences did not converge to the confirmed patch.');
    },
  },
  {
    name: 'account.getSummary',
    description: 'Read a redacted account summary. No key, token, payment or privilege value is returned.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('account', 'Reads authentication presence and masked API-key status.'),
    handler: async (_input, ctx) => requireSiteCapabilities(ctx).account.getAccountSummary(),
  },
  {
    name: 'billing.getSummary',
    description: 'Read the displayable credit balance. This tool cannot recharge, approve, confirm or mutate billing state.',
    permission: 'safe',
    inputSchema: { type: 'object', properties: {} },
    control: readOnlyControl('account', 'Reads a display-only credit balance.'),
    handler: async (_input, ctx) => requireSiteCapabilities(ctx).account.getBillingSummary(),
  },
];
