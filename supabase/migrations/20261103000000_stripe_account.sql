-- Conta Stripe (unidade) que recebeu cada pagamento: albufeira, faro, porto ou 'geral' (conta antiga).
alter table public.orders add column if not exists stripe_account text;
alter table public.bookings add column if not exists stripe_account text;
