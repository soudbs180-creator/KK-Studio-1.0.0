import { randomUUID } from "node:crypto";

import type {
  AssetDto,
  AssetKind,
  AssetListDto,
} from "../../../../../../packages/contracts/src/index.ts";

const seedAssets: AssetDto[] = [
  {
    id: randomUUID(),
    kind: "image",
    storagePath: "assets/images/demo-cover.png",
    mimeType: "image/png",
    sizeBytes: 182304,
    metadata: { width: 1024, height: 1024 },
    createdAt: "2026-03-20T10:00:00.000Z",
  },
  {
    id: randomUUID(),
    kind: "video",
    storagePath: "assets/video/launch-reel.mp4",
    mimeType: "video/mp4",
    sizeBytes: 5242880,
    metadata: { durationMs: 12000 },
    createdAt: "2026-03-21T08:30:00.000Z",
  },
  {
    id: randomUUID(),
    kind: "audio",
    storagePath: "assets/audio/theme-preview.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 942080,
    metadata: { durationMs: 65000 },
    createdAt: "2026-03-21T12:00:00.000Z",
  },
  {
    id: randomUUID(),
    kind: "document",
    storagePath: "assets/docs/storyboard-v1.pdf",
    mimeType: "application/pdf",
    sizeBytes: 412000,
    createdAt: "2026-03-22T09:15:00.000Z",
  },
];

export function createSeedAssets(): AssetDto[] {
  return seedAssets.map((item) => ({ ...item }));
}

export function paginateAssets(
  items: AssetDto[],
  input: { kind?: AssetKind; cursor?: string; limit: number },
): { data: AssetListDto; nextCursor?: string; hasMore: boolean } {
  const filtered = input.kind
    ? items.filter((item) => item.kind === input.kind)
    : items;

  const offset = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
  const page = filtered.slice(offset, offset + input.limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < filtered.length;

  return {
    data: {
      items: page.map((item) => ({ ...item })),
    },
    nextCursor: hasMore ? String(nextOffset) : undefined,
    hasMore,
  };
}
