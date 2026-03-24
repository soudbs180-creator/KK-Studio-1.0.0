import type { RequestMeta } from "../../../packages/contracts/src/http/envelope.ts";
import { consoleLogger } from "../../../packages/shared/src/logging/logger.ts";

export type ModuleLayer = "presentation" | "application" | "domain" | "infrastructure";

export type ApiModuleName =
  | "auth"
  | "workspace-canvas"
  | "generation"
  | "workflow"
  | "asset-library"
  | "billing"
  | "model-catalog"
  | "admin-console"
  | "storage-sync";

export interface ApiModuleDefinition {
  name: ApiModuleName;
  description: string;
  layers: Record<ModuleLayer, string>;
  currentSources: string[];
}

export const apiModules: ApiModuleDefinition[] = [
  {
    name: "auth",
    description: "Authentication, session bootstrap, profile access, and admin session entrypoints.",
    layers: {
      presentation: "HTTP auth routes and auth DTO validation",
      application: "register/login/session use-cases",
      domain: "user identity, membership policies, session rules",
      infrastructure: "Supabase auth bridge and persistence adapters",
    },
    currentSources: ["server/auth_routes.ts", "src/context/AuthContext.tsx", "src/services/auth"],
  },
  {
    name: "workspace-canvas",
    description: "Canvas metadata, viewport state, selection, and workspace shell read models.",
    layers: {
      presentation: "workspace and canvas query handlers",
      application: "workspace read/write orchestration",
      domain: "workspace and canvas aggregates",
      infrastructure: "workspace repositories and projections",
    },
    currentSources: ["src/components/canvas", "src/components/workspace", "src/context/CanvasContext.tsx"],
  },
  {
    name: "generation",
    description: "Generation task creation, status tracking, result materialization, and idempotency.",
    layers: {
      presentation: "generation task routes",
      application: "task orchestration and refund handling",
      domain: "generation task state machine",
      infrastructure: "provider adapters and task persistence",
    },
    currentSources: ["src/services/llm", "src/services/image", "src/services/video", "supabase/functions/secure-model-proxy"],
  },
  {
    name: "workflow",
    description: "Workflow documents, node graphs, save/publish lifecycle.",
    layers: {
      presentation: "workflow document controllers",
      application: "save/publish use-cases",
      domain: "workflow aggregate and node invariants",
      infrastructure: "workflow repositories",
    },
    currentSources: ["src/workflow", "src/components/canvas", "src/services/persistence"],
  },
  {
    name: "asset-library",
    description: "Asset listing, tagging, retrieval, and download-ready projections.",
    layers: {
      presentation: "asset routes",
      application: "asset search/list use-cases",
      domain: "asset metadata rules",
      infrastructure: "storage and metadata adapters",
    },
    currentSources: ["src/services/storage", "src/services/image/imageBackup.ts", "src/components/workspace/AssetLibraryPanel.tsx"],
  },
  {
    name: "billing",
    description: "Credit balance, ledger, debit, refund, and pricing resolution.",
    layers: {
      presentation: "billing routes",
      application: "credit/account orchestration",
      domain: "credit account and ledger invariants",
      infrastructure: "billing engines and repositories",
    },
    currentSources: ["server/billing_routes.ts", "billing", "src/services/billing", "src/context/BillingContext.tsx"],
  },
  {
    name: "model-catalog",
    description: "Model definitions, supplier channels, visibility, pricing snapshots, and capability filters.",
    layers: {
      presentation: "model catalog routes",
      application: "catalog querying and admin mutation",
      domain: "model availability and pricing policies",
      infrastructure: "supplier and admin model adapters",
    },
    currentSources: ["src/services/model", "src/services/api", "docs/API_DOCS.md"],
  },
  {
    name: "admin-console",
    description: "Admin auth, admin sessions, model management, audit queries, and operator actions.",
    layers: {
      presentation: "admin controllers",
      application: "admin use-cases",
      domain: "admin policy boundaries",
      infrastructure: "admin session and audit persistence",
    },
    currentSources: ["src/components/settings", "src/services/model/adminModelService.ts", "supabase/migrations"],
  },
  {
    name: "storage-sync",
    description: "Client-storage reconciliation, cloud persistence, and sync operations.",
    layers: {
      presentation: "sync endpoints",
      application: "sync orchestration",
      domain: "storage reconciliation policies",
      infrastructure: "OPFS/file system/Supabase storage adapters",
    },
    currentSources: ["src/services/storage", "src/services/system/syncService.ts", "docs/TASK_PERSISTENCE.md"],
  },
];

export const apiLogger = consoleLogger.child({ service: "apps/api" });

export function buildApiManifest(requestId: string, clientVersion?: string) {
  const meta: RequestMeta = {
    requestId,
    clientVersion,
    timestamp: new Date().toISOString(),
  };

  return {
    success: true as const,
    data: {
      service: "kk-studio-api",
      architecture: "modular-monolith",
      modules: apiModules,
    },
    meta,
  };
}
