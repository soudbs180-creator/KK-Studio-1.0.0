import type {
  RechargePaymentChannelConfigDto,
  RechargePaymentChannelDto,
} from "../../../../../../packages/contracts/src/index.ts";

export interface RechargePaymentChannelConfigRepository {
  list(): Promise<RechargePaymentChannelConfigDto[]>;
}

export const DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS: Record<
  RechargePaymentChannelDto,
  RechargePaymentChannelConfigDto
> = {
  alipay: {
    channel: "alipay",
    label: "支付宝",
    instructionText: "使用支付宝静态码完成转账后，再提交账单编号和流水尾号。",
    isActive: true,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
  wechat: {
    channel: "wechat",
    label: "微信",
    instructionText: "使用微信静态码完成转账后，再提交账单编号和流水尾号。",
    isActive: true,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
  paypal: {
    channel: "paypal",
    label: "PayPal",
    instructionText: "国际付款完成后，再提交账单编号和流水尾号。",
    isActive: false,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
  bank: {
    channel: "bank",
    label: "银行卡",
    instructionText: "线下或网银转账后，再提交账单编号和流水尾号。",
    isActive: false,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
  manual: {
    channel: "manual",
    label: "人工处理",
    instructionText: "联系管理员确认付款后，再按账单编号核销。",
    isActive: true,
    qrImageDataUrl: null,
    qrImagePath: null,
  },
};

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

export class InMemoryRechargePaymentChannelConfigRepository implements RechargePaymentChannelConfigRepository {
  private readonly items = new Map<RechargePaymentChannelDto, RechargePaymentChannelConfigDto>();

  constructor(
    seed?: Partial<Record<RechargePaymentChannelDto, Partial<RechargePaymentChannelConfigDto>>>,
  ) {
    for (const channel of Object.keys(DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS) as RechargePaymentChannelDto[]) {
      this.items.set(channel, cloneConfig({
        ...DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS[channel],
        ...(seed?.[channel] || {}),
      }));
    }
  }

  async list(): Promise<RechargePaymentChannelConfigDto[]> {
    return (Object.keys(DEFAULT_RECHARGE_PAYMENT_CHANNEL_CONFIGS) as RechargePaymentChannelDto[])
      .map((channel) => this.items.get(channel))
      .filter((item): item is RechargePaymentChannelConfigDto => Boolean(item))
      .map((item) => cloneConfig(item));
  }
}
