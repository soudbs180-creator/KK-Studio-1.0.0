-- Drop support-table indexes that have no observed scans, do not match current
-- application query shapes, or are superseded by more selective indexes.

DROP INDEX IF EXISTS public.admin_sessions_admin_user_id_expires_at_idx;
DROP INDEX IF EXISTS public.idx_credit_exchange_rates_updated_by;
DROP INDEX IF EXISTS public.idx_external_identities_user_id;
DROP INDEX IF EXISTS public.payment_callbacks_payment_order_id_received_at_idx;
DROP INDEX IF EXISTS public.payment_orders_status_updated_at_idx;
DROP INDEX IF EXISTS public.payment_orders_user_created_at_idx;
