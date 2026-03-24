-- Tighten payment sidecar RLS policies after the initial table rollout.

drop policy if exists payment_orders_select_own on public.payment_orders;

create policy payment_orders_select_own
  on public.payment_orders
  for select
  to authenticated
  using (
    auth.role() = 'authenticated'
    and auth.uid() = user_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_callbacks'
      and policyname = 'payment_callbacks_block_client_access'
  ) then
    create policy payment_callbacks_block_client_access
      on public.payment_callbacks
      as permissive
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end
$$;
