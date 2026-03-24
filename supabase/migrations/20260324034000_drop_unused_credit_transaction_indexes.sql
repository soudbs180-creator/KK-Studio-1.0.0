-- Drop credit transaction indexes that show zero scans and do not match the
-- current repository query shapes. The active query paths use user_id and
-- created_at ordering instead.

DROP INDEX IF EXISTS public.idx_credit_transactions_type;
DROP INDEX IF EXISTS public.idx_credit_transactions_business_reference;
