import type {
  CanvasLayoutRecordDto,
  CleanupCloudImagesResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";

export interface WorkspaceLayoutRepository {
  getLayout(userId: string): Promise<CanvasLayoutRecordDto[]>;
  saveLayout(userId: string, canvases: CanvasLayoutRecordDto[]): Promise<CanvasLayoutRecordDto[]>;
  cleanupCloudImages(userId: string): Promise<CleanupCloudImagesResponseDto>;
}

export class InMemoryWorkspaceLayoutRepository implements WorkspaceLayoutRepository {
  private readonly layouts = new Map<string, CanvasLayoutRecordDto[]>();

  async getLayout(userId: string): Promise<CanvasLayoutRecordDto[]> {
    return (this.layouts.get(userId) || []).map((canvas) => ({ ...canvas }));
  }

  async saveLayout(userId: string, canvases: CanvasLayoutRecordDto[]): Promise<CanvasLayoutRecordDto[]> {
    const nextCanvases = canvases.map((canvas) => ({ ...canvas }));
    this.layouts.set(userId, nextCanvases);
    return nextCanvases.map((canvas) => ({ ...canvas }));
  }

  async cleanupCloudImages(userId: string): Promise<CleanupCloudImagesResponseDto> {
    void userId;
    return {
      deletedCount: 0,
      preservedLayout: true,
    };
  }
}
