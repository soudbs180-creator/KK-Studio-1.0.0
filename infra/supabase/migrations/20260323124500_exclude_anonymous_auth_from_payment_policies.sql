-- Exclude anonymous authenticated sessions from payment order access and
-- keep payment callback rows service-role only.

drop policy if exists payment_orders_select_own on public.payment_orders;

create policy payment_orders_select_own
  on public.payment_orders
  for select
  to authenticated
  using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and auth.uid() = user_id
  );

drop policy if exists payment_callbacks_block_client_access on public.payment_callbacks;
