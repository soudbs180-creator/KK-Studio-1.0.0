import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  CanvasLayoutRecordDto,
  CleanupCloudImagesResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { WorkspaceLayoutRepository } from "./in-memory-workspace-layout-repository.ts";

export interface SupabaseWorkspaceLayoutRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
}

const BUCKET_NAME = "generated-images";
const LAYOUT_DIRECTORY = "__system__";
const LAYOUT_FILE_NAME = "layout.json";

function buildLayoutPath(userId: string): string {
  return `${userId}/${LAYOUT_DIRECTORY}/${LAYOUT_FILE_NAME}`;
}

function buildLegacyLayoutPath(userId: string): string {
  return `${userId}/${LAYOUT_FILE_NAME}`;
}

function isMissingStorageObject(error: { message?: string; name?: string } | null | undefined): boolean {
  const message = String(error?.message || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  return message.includes("not found") || name.includes("storagenotfound") || name.includes("storageunknownerror");
}

function normalizeCanvasLayoutRecords(raw: unknown): CanvasLayoutRecordDto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is CanvasLayoutRecordDto => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ ...item }));
}

export class SupabaseWorkspaceLayoutRepository implements WorkspaceLayoutRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseWorkspaceLayoutRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async getLayout(userId: string): Promise<CanvasLayoutRecordDto[]> {
    const newPath = buildLayoutPath(userId);
    const legacyPath = buildLegacyLayoutPath(userId);

    const currentLayout = await this.downloadLayout(newPath);
    if (currentLayout) {
      return currentLayout;
    }

    const legacyLayout = await this.downloadLayout(legacyPath);
    return legacyLayout || [];
  }

  async saveLayout(userId: string, canvases: CanvasLayoutRecordDto[]): Promise<CanvasLayoutRecordDto[]> {
    const path = buildLayoutPath(userId);
    const serialized = JSON.stringify(canvases);

    const { error } = await this.client.storage
      .from(BUCKET_NAME)
      .upload(path, Buffer.from(serialized, "utf8"), {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      throw error;
    }

    return canvases.map((canvas) => ({ ...canvas }));
  }

  async cleanupCloudImages(userId: string): Promise<CleanupCloudImagesResponseDto> {
    let deletedCount = 0;
    const layoutPath = buildLayoutPath(userId);
    const legacyLayoutPath = buildLegacyLayoutPath(userId);
    const protectedRootEntries = new Set([LAYOUT_DIRECTORY, LAYOUT_FILE_NAME]);

    const { data: rootEntries, error } = await this.client.storage
      .from(BUCKET_NAME)
      .list(userId, { limit: 100 });

    if (error) {
      throw error;
    }

    const removablePaths = (rootEntries || [])
      .map((entry) => String(entry.name || "").trim())
      .filter((name) => Boolean(name) && !protectedRootEntries.has(name))
      .map((name) => `${userId}/${name}`);

    if (removablePaths.length > 0) {
      const { error: removeError } = await this.client.storage
        .from(BUCKET_NAME)
        .remove(removablePaths);

      if (removeError) {
        throw removeError;
      }

      deletedCount += removablePaths.length;
    }

    const { data: layoutDirectoryEntries, error: layoutDirectoryError } = await this.client.storage
      .from(BUCKET_NAME)
      .list(`${userId}/${LAYOUT_DIRECTORY}`, { limit: 100 });

    if (layoutDirectoryError && !isMissingStorageObject(layoutDirectoryError)) {
      throw layoutDirectoryError;
    }

    const hasCurrentLayout = Array.isArray(layoutDirectoryEntries)
      && layoutDirectoryEntries.some((entry) => String(entry.name || "").trim() === LAYOUT_FILE_NAME);

    const { data: legacyLayoutData } = await this.client.storage
      .from(BUCKET_NAME)
      .download(legacyLayoutPath)
      .catch(() => ({ data: null }));

    return {
      deletedCount,
      preservedLayout: hasCurrentLayout || Boolean(legacyLayoutData),
    };
  }

  private async downloadLayout(path: string): Promise<CanvasLayoutRecordDto[] | null> {
    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error) {
      if (isMissingStorageObject(error)) {
        return null;
      }

      throw error;
    }

    const text = await data.text();
    if (!text.trim()) {
      return [];
    }

    return normalizeCanvasLayoutRecords(JSON.parse(text));
  }
}
