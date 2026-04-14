import path from "node:path";

import type {
  RechargePaymentChannelConfigDto,
  RechargePaymentChannelDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { FileBackedJsonStore } from "./file-backed-json-store.ts";
import {
  DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS,
  type RechargePaymentChannelConfigRepository,
} from "./in-memory-recharge-payment-channel-config-repository.ts";

interface PersistedRechargePaymentChannelConfigState {
  version: 1;
  items: Partial<Record<RechargePaymentChannelDto, RechargePaymentChannelConfigDto>>;
}

export interface FileBackedRechargePaymentChannelConfigRepositoryOptions {
  filePath?: string;
  seed?: Partial<Record<RechargePaymentChannelDto, Partial<RechargePaymentChannelConfigDto>>>;
}

function buildDefaultFilePath(): string {
  const configuredPath = String(process.env.KK_LOCAL_RECHARGE_PAYMENT_CHANNELS_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), ".kk-local", "billing", "payment-channels.json");
}

function isPersistedState(value: unknown): value is PersistedRechargePaymentChannelConfigState {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && typeof (value as { items?: unknown }).items === "object",
  );
}

function cloneConfig(config: RechargePaymentChannelConfigDto): RechargePaymentChannelConfigDto {
  return {
    channel: config.channel,
    label: config.label,
    qrImageDataUrl: config.qrImageDataUrl ?? null,
    qrImagePath: config.qrImagePath ?? null,
    instructionText: config.instructionText ?? null,
    isActive: config.isActive !== false,
  };
}

function buildSeedItems(
  seed?: Partial<Record<RechargePaymentChannelDto, Partial<RechargePaymentChannelConfigDto>>>,
): Partial<Record<RechargePaymentChannelDto, RechargePaymentChannelConfigDto>> {
  const items: Partial<Record<RechargePaymentChannelDto, RechargePaymentChannelConfigDto>> = {};

  for (const channel of Object.keys(DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS) as RechargePaymentChannelDto[]) {
    items[channel] = cloneConfig({
      ...DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS[channel],
      ...(seed?.[channel] || {}),
    });
  }

  return items;
}

export class FileBackedRechargePaymentChannelConfigRepository implements RechargePaymentChannelConfigRepository {
  private readonly store: FileBackedJsonStore<PersistedRechargePaymentChannelConfigState>;

  constructor(options: FileBackedRechargePaymentChannelConfigRepositoryOptions = {}) {
    const seedItems = buildSeedItems(options.seed);
    this.store = new FileBackedJsonStore<PersistedRechargePaymentChannelConfigState>({
      filePath: options.filePath?.trim() ? options.filePath.trim() : buildDefaultFilePath(),
      createEmptyState: () => ({
        version: 1,
        items: seedItems,
      }),
      isState: isPersistedState,
    });
  }

  async list(): Promise<RechargePaymentChannelConfigDto[]> {
    const state = await this.store.readState();
    return (Object.keys(DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS) as RechargePaymentChannelDto[])
      .map((channel) => state.items[channel] || DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS[channel])
      .filter((item): item is RechargePaymentChannelConfigDto => Boolean(item))
      .map((item) => cloneConfig(item));
  }
}
