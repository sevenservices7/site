-- Landing pages de diagnóstico (tráfego pago): um registo por pessoa que preenche a etapa 1.
-- Cada etapa seguinte ATUALIZA o mesmo registo (respostas + ultima_etapa), para sabermos onde parou.
-- Escrita e leitura só pela Edge Function "landing-lead" (service_role). Nenhum acesso público.

create table if not exists public.landing_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Segredo devolvido ao navegador na etapa 1; exigido para atualizar o registo.
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  -- Código curto mostrado ao lead e enviado no WhatsApp (ex.: 3F9A1C).
  codigo_curto text generated always as (upper(substr(replace(id::text, '-', ''), 1, 6))) stored,

  landing text not null check (landing ~ '^[a-z0-9-]{3,60}$'),
  variante text not null default 'a' check (variante in ('a', 'b')),

  nome text not null,
  whatsapp text not null,
  email text,
  consentimento_rgpd boolean not null default false,
  consentimento_rgpd_em timestamptz,

  respostas jsonb not null default '{}'::jsonb,
  ultima_etapa text not null default 'captura',
  concluido boolean not null default false,
  concluido_em timestamptz,
  resultado_cor text check (resultado_cor in ('verde', 'amarelo', 'vermelho')),
  resultado_id text,
  servico_recomendado text,
  servicos_tambem text[] not null default '{}',
  temperatura text check (temperatura in ('quente', 'frio')),
  high_ticket boolean not null default false,
  resumo text,

  newsletter_optin boolean not null default false,
  newsletter_optin_em timestamptz,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  referrer text,
  user_agent text,

  kommo_lead_id bigint,
  kommo_error text
);

create index if not exists landing_leads_landing_created_idx on public.landing_leads (landing, created_at desc);
create index if not exists landing_leads_temperatura_idx on public.landing_leads (temperatura) where concluido;
create index if not exists landing_leads_whatsapp_idx on public.landing_leads (whatsapp);

create or replace function public.landing_leads_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists landing_leads_touch on public.landing_leads;
create trigger landing_leads_touch before update on public.landing_leads
  for each row execute function public.landing_leads_touch();

-- Segurança: RLS ligado e NENHUMA policy → anon/authenticated não leem nem escrevem.
-- A service_role (só na Edge Function) ignora o RLS.
alter table public.landing_leads enable row level security;
revoke all on table public.landing_leads from anon, authenticated;
