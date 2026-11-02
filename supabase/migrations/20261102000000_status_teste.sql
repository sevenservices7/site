-- Pagamentos feitos com a Stripe em modo de teste (sessões cs_test_) ficam com status 'test':
-- não são vendas, não contam em relatórios e não disparam e-mail ao cliente nem Kommo.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'test'));

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'paid', 'confirmed', 'failed', 'cancelled', 'test'));

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'processing', 'succeeded', 'failed', 'test'));
