drop policy if exists "Admins can read all exchange rates" on public.credit_exchange_rates;
create policy "Admins can read all exchange rates"
on public.credit_exchange_rates
for select
to authenticated
using (public.is_admin() = true);

create or replace function public.touch_credit_exchange_rates_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;

drop trigger if exists touch_credit_exchange_rates_updated_at on public.credit_exchange_rates;
create trigger touch_credit_exchange_rates_updated_at
before insert or update on public.credit_exchange_rates
for each row
execute function public.touch_credit_exchange_rates_updated_at();
