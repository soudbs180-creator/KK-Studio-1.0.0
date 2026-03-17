create table if not exists public.credit_exchange_rates (
    currency_code text primary key,
    credits_per_unit numeric not null check (credits_per_unit > 0),
    min_amount numeric null check (min_amount is null or min_amount >= 0),
    max_amount numeric null check (max_amount is null or max_amount > 0),
    is_active boolean not null default true,
    updated_by uuid null references auth.users(id) on delete set null,
    updated_at timestamp with time zone not null default now()
);

alter table public.credit_exchange_rates enable row level security;

insert into public.credit_exchange_rates (
    currency_code,
    credits_per_unit,
    min_amount,
    max_amount,
    is_active
)
values
    ('CNY', 5, 5, 500, true),
    ('USD', 30, 1, 100, true)
on conflict (currency_code) do update
set
    credits_per_unit = excluded.credits_per_unit,
    min_amount = excluded.min_amount,
    max_amount = excluded.max_amount,
    is_active = excluded.is_active,
    updated_at = now();

drop policy if exists "Authenticated users can read active exchange rates" on public.credit_exchange_rates;
create policy "Authenticated users can read active exchange rates"
on public.credit_exchange_rates
for select
to authenticated
using (is_active = true);

drop policy if exists "Admins can insert exchange rates" on public.credit_exchange_rates;
create policy "Admins can insert exchange rates"
on public.credit_exchange_rates
for insert
to authenticated
with check (public.is_admin() = true);

drop policy if exists "Admins can update exchange rates" on public.credit_exchange_rates;
create policy "Admins can update exchange rates"
on public.credit_exchange_rates
for update
to authenticated
using (public.is_admin() = true)
with check (public.is_admin() = true);

drop policy if exists "Admins can delete exchange rates" on public.credit_exchange_rates;
create policy "Admins can delete exchange rates"
on public.credit_exchange_rates
for delete
to authenticated
using (public.is_admin() = true);

create or replace function public.touch_credit_exchange_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists touch_credit_exchange_rates_updated_at on public.credit_exchange_rates;
create trigger touch_credit_exchange_rates_updated_at
before update on public.credit_exchange_rates
for each row
execute function public.touch_credit_exchange_rates_updated_at();
