-- Payment sidecar persistence tables.
-- This migration is intentionally additive and idempotent so it can coexist
-- with the legacy billing tables until the canonical ledger migration is ready.

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_code text not null check (provider_code in ('alipay', 'wechat', 'paypal')),
  merchant_order_no text not null unique,
  status text not null default 'created' check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  amount numeric(18,6) not null check (amount > 0),
  currency text not null,
  credit_amount integer not null check (credit_amount > 0),
  idempotency_key text not null,
  payment_url text not null,
  return_url text not null,
  notify_url text not null,
  last_callback_id text null,
  settlement_applied_at timestamptz null,
  settlement_ledger_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz null
);

create unique index if not exists payment_orders_user_id_idempotency_key_key
  on public.payment_orders(user_id, idempotency_key);

create index if not exists payment_orders_user_created_at_idx
  on public.payment_orders(user_id, created_at desc);

create index if not exists payment_orders_status_updated_at_idx
  on public.payment_orders(status, updated_at desc);

create table if not exists public.payment_callbacks (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  provider_code text not null check (provider_code in ('alipay', 'wechat', 'paypal')),
  callback_id text not null unique,
  verified boolean not null default false,
  trade_status text not null,
  payload jsonb not null default '{}'::jsonb,
  settlement_status text not null default 'pending' check (settlement_status in ('pending', 'applied', 'failed', 'ignored')),
  settlement_error text null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null
);

create index if not exists payment_callbacks_payment_order_id_received_at_idx
  on public.payment_callbacks(payment_order_id, received_at desc);

alter table public.payment_orders enable row level security;
alter table public.payment_callbacks enable row level security;

grant select on public.payment_orders to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_orders'
      and policyname = 'payment_orders_select_own'
  ) then
    create policy payment_orders_select_own
      on public.payment_orders
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

comment on table public.payment_orders is
  'Payment sidecar order store. This is the durable source for payment status and sidecar idempotency.';

comment on table public.payment_callbacks is
  'Payment callback audit trail. Stores provider callback payloads and settlement outcomes.';

comment on column public.payment_orders.settlement_ledger_id is
  'Ledger identifier returned by the main API settlement contract. FK is deferred until the canonical ledger table is standardized.';
