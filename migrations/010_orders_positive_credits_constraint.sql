-- 10. 支付订单积分入账安全约束
-- 中文注释：Webhook 结算只应把已付款订单转换为正向充值，数据库层兜底可以阻断异常订单把充值链路变成扣分链路。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_orders_credits_positive'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT chk_orders_credits_positive
      CHECK (credits > 0);
  END IF;
END $$;
