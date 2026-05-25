// netlify/lib/billing-plans.ts
// 职责：定义服务端可信的计费方案列表（与数据库中初始化的 plans 保持一致），
// 作为创建 Stripe 会话和额度结算时的防篡改基准。

export interface Plan {
  id: string;
  name: string;
  amountCents: number; // 套餐实付金额 (以分为单位)
  credits: number; // 购买该套餐可获得的积分额度
}

// 静态定义的服务端可信计费计划，前端只传 id，由后端获取具体细节进行计费和支付
export const SERVER_PLANS: Record<string, Plan> = {
  "price_basic_100": {
    id: "price_basic_100",
    name: "基础套餐",
    amountCents: 990,
    credits: 100,
  },
  "price_premium_500": {
    id: "price_premium_500",
    name: "高级套餐",
    amountCents: 3990,
    credits: 500,
  },
  "price_enterprise_1500": {
    id: "price_enterprise_1500",
    name: "企业套餐",
    amountCents: 9990,
    credits: 1500,
  },
};
