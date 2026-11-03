-- ═══════════════════════════════════════════════════════════
-- SEVEN Services BackOffice — Schema final consolidado
-- Estrutura de referência (apenas tabelas, colunas, RLS)
-- Sem dados de seed.
-- ═══════════════════════════════════════════════════════════

-- ── função utilitária para triggers de updated_at ──
create or replace function update_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

-- ── PERFIS DE UTILIZADOR ──
create table if not exists profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  code             text unique not null,
  name             text not null,
  role             text not null default 'collab' check (role in ('admin','collab')),
  unit             text not null default '',
  phone            text default '',
  email            text default '',
  function_        text default '',
  photo_url        text default '',
  active           boolean default true,
  commission_tiers jsonb default '[]',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ── PERMISSÕES ──
create table if not exists permissions (
  id         uuid primary key default gen_random_uuid(),
  user_code  text not null,
  module     text not null,
  can_read   boolean default true,
  can_write  boolean default false,
  can_export boolean default false,
  updated_by text default '',
  updated_at timestamptz default now(),
  unique(user_code, module)
);

-- ── CONFIGURAÇÕES DA EMPRESA (key-value) ──
create table if not exists company_settings (
  id         uuid primary key default gen_random_uuid(),
  key_       text unique not null,
  value_     text not null default '',
  updated_by text default '',
  updated_at timestamptz default now()
);

-- ── ESCRITÓRIOS ──
create table if not exists offices (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text default '',
  phone      text default '',
  email      text default '',
  sort_order integer default 0,
  active     boolean default true
);

-- ── FORMAS DE PAGAMENTO ──
-- details em JSON stringified: {"albufeira":"...","faro":"...","porto":"..."}
create table if not exists payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  details    text default '',
  link       text default '',
  sort_order integer default 0,
  active     boolean default true
);

-- ── SERVIÇOS ──
create table if not exists services (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  category    text default '',
  family      text default '',
  price       numeric(10,2),
  price_obs   text default '',
  docs        jsonb default '[]',
  prereqs     jsonb default '[]',
  incluido    jsonb default '[]',
  av          jsonb default '[]',
  ae          jsonb default '[]',
  upsell      jsonb default '[]',
  op          text default '',
  script      text default '',
  objec       jsonb default '[]',
  erros       jsonb default '[]',
  site        text default '',
  complexity  text default 'medio' check (complexity in ('simples','medio','complexo','muito_complexo')),
  needs_proc  boolean default false,
  needs_cont  boolean default false,
  status      text default 'active' check (status in ('active','draft','inactive')),
  is_complete boolean default false,
  attendance_type text default 'balcao' check (attendance_type in ('balcao','recomenda_consultoria','consultoria_obrigatoria')),
  tutorial_url text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── TEMPLATES KOMMO ──
create table if not exists templates (
  id           uuid primary key default gen_random_uuid(),
  service_code text not null,
  kommo_num    integer,
  name         text default '',
  phase        text default '',
  text         text not null,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

-- ── HISTÓRICO DE PREÇOS ──
create table if not exists price_history (
  id           uuid primary key default gen_random_uuid(),
  service_code text not null,
  old_price    numeric(10,2),
  new_price    numeric(10,2),
  changed_by   text default '',
  created_at   timestamptz default now()
);

-- ── MANUAL EDITÁVEL ──
create table if not exists manual_pages (
  id         uuid primary key default gen_random_uuid(),
  page_key   text unique not null,
  chapter    text default 'Manual Operacional',
  title      text not null,
  content    text not null default '',
  quiz       jsonb default '[]',
  updated_by text default '',
  updated_at timestamptz default now()
);

-- ── LEITURAS DO MANUAL (progresso por colaborador) ──
create table if not exists manual_reads (
  id          uuid primary key default gen_random_uuid(),
  user_code   text not null,
  page_key    text not null,
  quiz_passed boolean default false,
  created_at  timestamptz default now()
);

-- ── TENTATIVAS DE QUIZ ──
create table if not exists quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_code   text not null,
  page_key    text not null,
  passed      boolean default false,
  score       integer default 0,
  total       integer default 0,
  answers     jsonb default '[]',
  attempt_num integer default 1,
  abandoned   boolean default false,
  created_at  timestamptz default now()
);

-- ── FEEDBACK DE COLABORADORES ──
create table if not exists feedback (
  id           uuid primary key default gen_random_uuid(),
  user_code    text not null,
  type         text not null check (type in ('acerto','erro','observacao','melhoria')),
  category     text not null default '',
  description  text not null,
  context      text default '',
  severity     text default 'normal' check (severity in ('positivo','normal','atencao','critico')),
  communicated boolean default false,
  created_by   text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── PEDIDOS DOS COLABORADORES ──
create table if not exists requests (
  id          uuid primary key default gen_random_uuid(),
  user_code   text not null,
  type        text not null check (type in ('ferias','falta','justificacao','compra','outro')),
  status      text default 'pending' check (status in ('pending','approved','rejected')),
  details     jsonb not null default '{}',
  admin_note  text default '',
  created_at  timestamptz default now(),
  resolved_at timestamptz,
  resolved_by text default ''
);

-- ── SUGESTÕES ──
create table if not exists suggestions (
  id           uuid primary key default gen_random_uuid(),
  user_code    text not null,
  type         text not null,
  urgency      text default 'normal' check (urgency in ('normal','urgente','critico')),
  service_code text default '',
  description  text not null,
  status       text default 'pending' check (status in ('pending','accepted','rejected','done')),
  admin_note   text default '',
  created_at   timestamptz default now(),
  resolved_at  timestamptz,
  resolved_by  text default ''
);

-- ── TAREFAS ──
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  assigned_to  text not null,
  title        text not null,
  description  text default '',
  due_date     date,
  status       text default 'pending' check (status in ('pending','in_progress','completed','verified')),
  summary      text default '',
  created_by   text not null,
  created_at   timestamptz default now(),
  completed_at timestamptz
);

-- ── NOTIFICAÇÕES ──
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  to_user    text not null,
  type       text not null,
  title      text not null,
  body       text not null,
  link       text default '',
  read       boolean default false,
  created_at timestamptz default now()
);

-- ── CONTEÚDOS (dicas, avisos, tarefas globais) ──
create table if not exists content_blocks (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('dica','novidade','aviso','tarefa_global')),
  title         text not null,
  body          text not null,
  target_users  jsonb default '[]',
  active        boolean default true,
  expires_at    timestamptz,
  created_by    text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── REUNIÕES / RELATÓRIOS ──
create table if not exists meeting_reports (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  period_start date not null,
  period_end   date not null,
  users_codes  jsonb default '[]',
  content      text not null,
  created_by   text not null,
  created_at   timestamptz default now()
);

-- ── AGENTES IA (SEVEN IA — definições editáveis) ──
create table if not exists ai_agents (
  id                     uuid primary key default gen_random_uuid(),
  agent_key              text unique not null,
  title                  text not null,
  description            text not null,
  system_prompt          text not null,
  suggestions            jsonb default '[]',
  use_services_context   boolean default false,
  use_manual_context     boolean default false,
  use_objections_context boolean default false,
  use_cae_context        boolean default false,
  context_filter         text default '',
  active                 boolean default true,
  sort_order             integer default 0,
  updated_at             timestamptz default now()
);

-- ── DOCUMENTOS DE CONTEXTO (texto extraído de PDFs ou fontes externas) ──
create table if not exists ai_context_docs (
  id         uuid primary key default gen_random_uuid(),
  key_       text unique not null,
  title      text not null,
  content    text not null,
  file_url   text default '',
  updated_by text default '',
  updated_at timestamptz default now()
);

-- ── MODELOS DE DOCUMENTOS (procurações e contratos editáveis) ──
create table if not exists document_templates (
  id           uuid primary key default gen_random_uuid(),
  doc_key      text unique not null,
  type         text not null check (type in ('procuracao','contrato')),
  title        text not null,
  description  text default '',
  letterhead   text default 'seven' check (letterhead in ('seven','advogada')),
  body         text not null,
  clauses      jsonb default '[]',
  fields       jsonb default '[]',
  active       boolean default true,
  sort_order   integer default 0,
  updated_by   text default '',
  updated_at   timestamptz default now()
);

-- ── HISTÓRICO DE DOCUMENTOS EMITIDOS ──
create table if not exists documents_issued (
  id           uuid primary key default gen_random_uuid(),
  doc_key      text not null,
  type         text not null,
  title        text not null,
  service_code text default '',
  client_name  text not null,
  client_data  jsonb not null default '{}',
  issued_by    text not null,
  issued_at    timestamptz default now()
);

-- ── COLUNAS EM SERVICES PARA MAPEAR MODELO POR DEFEITO ──
alter table services
  add column if not exists proc_template text default 'proc_at_simples',
  add column if not exists cont_template text default 'contrato_servicos';

-- ── HISTÓRICO DE RECEITAS (mensal por unidade) ──
create table if not exists revenue_history (
  id            uuid primary key default gen_random_uuid(),
  year          integer not null,
  month         integer not null check (month between 1 and 12),
  unit          text not null,
  revenue       numeric(10,2) default 0,
  expenses      numeric(10,2) default 0,
  num_services  integer default 0,
  leads_in      integer default 0,
  leads_closed  integer default 0,
  notes         text default '',
  created_by    text default '',
  updated_at    timestamptz default now(),
  unique(year, month, unit)
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Política permissiva ("all using (true)") — a autenticação é
-- feita ao nível da aplicação com a publishable key. Ajustar
-- conforme o modelo de segurança evolua.
-- ═══════════════════════════════════════════════════════════

alter table profiles         enable row level security;
alter table permissions      enable row level security;
alter table company_settings enable row level security;
alter table offices          enable row level security;
alter table payment_methods  enable row level security;
alter table services         enable row level security;
alter table templates        enable row level security;
alter table price_history    enable row level security;
alter table manual_pages     enable row level security;
alter table manual_reads     enable row level security;
alter table quiz_attempts    enable row level security;
alter table feedback         enable row level security;
alter table requests         enable row level security;
alter table suggestions      enable row level security;
alter table tasks            enable row level security;
alter table notifications    enable row level security;
alter table content_blocks   enable row level security;
alter table meeting_reports  enable row level security;
alter table revenue_history    enable row level security;
alter table ai_agents          enable row level security;
alter table ai_context_docs    enable row level security;
alter table document_templates enable row level security;
alter table documents_issued   enable row level security;

create policy "profiles_all"   on profiles         for all using (true);
create policy "perms_all"      on permissions      for all using (true);
create policy "settings_all"   on company_settings for all using (true);
create policy "offices_all"    on offices          for all using (true);
create policy "payments_all"   on payment_methods  for all using (true);
create policy "services_all"   on services         for all using (true);
create policy "templates_all"  on templates        for all using (true);
create policy "price_hist_all" on price_history    for all using (true);
create policy "manual_all"     on manual_pages     for all using (true);
create policy "reads_all"      on manual_reads     for all using (true);
create policy "quiz_all"       on quiz_attempts    for all using (true);
create policy "feedback_all"   on feedback         for all using (true);
create policy "requests_all"   on requests         for all using (true);
create policy "suggestions_all" on suggestions     for all using (true);
create policy "tasks_all"      on tasks            for all using (true);
create policy "notifs_all"     on notifications    for all using (true);
create policy "content_all"    on content_blocks   for all using (true);
create policy "meeting_all"    on meeting_reports  for all using (true);
create policy "revenue_all"        on revenue_history    for all using (true);
create policy "ai_agents_all"      on ai_agents          for all using (true);
create policy "ai_docs_all"        on ai_context_docs    for all using (true);
create policy "doc_templates_all"  on document_templates for all using (true);
create policy "docs_issued_all"    on documents_issued   for all using (true);

-- ═══════════════════════════════════════════════════════════
-- TRIGGERS updated_at
-- ═══════════════════════════════════════════════════════════

create trigger trg_profiles_updated before update on profiles         for each row execute function update_updated_at();
create trigger trg_services_updated before update on services         for each row execute function update_updated_at();
create trigger trg_manual_updated   before update on manual_pages     for each row execute function update_updated_at();
create trigger trg_feedback_updated before update on feedback         for each row execute function update_updated_at();
create trigger trg_content_updated  before update on content_blocks   for each row execute function update_updated_at();
create trigger trg_revenue_updated     before update on revenue_history    for each row execute function update_updated_at();
create trigger trg_aiagents_updated    before update on ai_agents          for each row execute function update_updated_at();
create trigger trg_aidocs_updated      before update on ai_context_docs    for each row execute function update_updated_at();
create trigger trg_doctemplates_updated before update on document_templates for each row execute function update_updated_at();

-- ═══════════════════════════════════════════════════════════
-- STORAGE — bucket de avatars
-- ═══════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
create policy "avatars_read"   on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_upload" on storage.objects for insert with check (bucket_id = 'avatars');
create policy "avatars_update" on storage.objects for update using (bucket_id = 'avatars');

-- ── BUCKET letterheads (papéis timbrados das procurações) ──
insert into storage.buckets (id, name, public) values ('letterheads', 'letterheads', true) on conflict do nothing;
create policy "letterheads_read"   on storage.objects for select using (bucket_id = 'letterheads');
create policy "letterheads_upload" on storage.objects for insert with check (bucket_id = 'letterheads');
create policy "letterheads_update" on storage.objects for update using (bucket_id = 'letterheads');
create policy "letterheads_delete" on storage.objects for delete using (bucket_id = 'letterheads');

-- ── BUCKET agent-docs (PDF da tabela CAE) ──
insert into storage.buckets (id, name, public) values ('agent-docs', 'agent-docs', true) on conflict do nothing;
create policy "agent_docs_read"   on storage.objects for select using (bucket_id = 'agent-docs');
create policy "agent_docs_upload" on storage.objects for insert with check (bucket_id = 'agent-docs');
create policy "agent_docs_update" on storage.objects for update using (bucket_id = 'agent-docs');
