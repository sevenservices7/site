-- ═══════════════════════════════════════════════════════════
-- SEVEN BackOffice — RLS por auth.uid() / role  (Sprint 1 #5)
-- ═══════════════════════════════════════════════════════════
--
-- OBJECTIVO
--   Substituir as policies permissivas `for all using (true)` (que deixam
--   qualquer pessoa com a anon key ler/escrever tudo via REST) por policies
--   baseadas em auth.uid() e no papel (admin/collab) do utilizador.
--
-- ⚠️  PRÉ-REQUISITOS (ordem obrigatória — NÃO aplicar este ficheiro antes):
--   1. App a enviar o JWT do utilizador em todos os pedidos REST.
--      → Já implementado no index.html (sbHeaders/sbFetch + refresh de token).
--        Deve estar em PRODUÇÃO e validado antes deste SQL.
--   2. Existir um auth.users para cada profile, com profiles.id = auth.users.id.
--      → Ver SECÇÃO 0 (migração auth.users) abaixo. Passo manual (service role
--        / dashboard). Sem isto, o login Supabase não encontra o profile e os
--        utilizadores caem no fallback (sem JWT) → bloqueados pelas policies.
--   3. Testar PRIMEIRO em staging. Depois de aplicado, o acesso anónimo deixa
--      de funcionar — a app TEM de usar JWT.
--
-- VERIFICAÇÃO FINAL (após aplicar):
--   curl "$SB_URL/rest/v1/profiles?select=*" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON"
--   → deve devolver []  (RLS filtra tudo para anon)
--   Login normal (com JWT) continua a ler/escrever o que lhe compete.
-- ═══════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 0 — MIGRAÇÃO auth.users  (executar/validar ANTES das policies)
-- ═══════════════════════════════════════════════════════════
-- As palavras-passe em auth.users são geridas pelo GoTrue (bcrypt). Criar os
-- utilizadores por uma destas vias:
--
--   (A) Dashboard Supabase → Authentication → Users → Add user (email + pw),
--       um por colaborador (GR, DS, AK, DJ, …).
--   (B) Admin API (service_role key, NUNCA no frontend):
--       POST $SB_URL/auth/v1/admin/users
--       { "email":"gabriela@sevenservicess.com", "password":"<temporária>",
--         "email_confirm": true }
--
-- Depois, ligar cada profile ao respectivo auth.users (por email) para que
-- profiles.id = auth.users.id (o login faz profiles?id=eq.<auth.uid>):
--
--   update profiles p
--      set id = u.id
--     from auth.users u
--    where lower(u.email) = lower(p.email)
--      and p.id is distinct from u.id;
--
-- Conferir que não ficou nenhum profile sem auth.user:
--   select code, email from profiles
--    where id not in (select id from auth.users);
--   → deve devolver 0 linhas antes de avançar.


begin;

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 1 — FUNÇÕES AUXILIARES (security definer p/ evitar recursão de RLS)
-- ═══════════════════════════════════════════════════════════
create or replace function app_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function app_user_code() returns text
  language sql stable security definer set search_path = public as $$
  select code from profiles where id = auth.uid();
$$;

revoke all on function app_is_admin() from public;
revoke all on function app_user_code() from public;
grant execute on function app_is_admin() to authenticated;
grant execute on function app_user_code() to authenticated;

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 2 — REMOVER POLICIES PERMISSIVAS `using (true)`
-- (Enquanto existirem, o anon continua a ter acesso total.)
-- ═══════════════════════════════════════════════════════════
drop policy if exists "profiles_all"    on profiles;
drop policy if exists "perms_all"       on permissions;
drop policy if exists "settings_all"    on company_settings;
drop policy if exists "offices_all"     on offices;
drop policy if exists "payments_all"    on payment_methods;
drop policy if exists "services_all"    on services;
drop policy if exists "templates_all"   on templates;
drop policy if exists "price_hist_all"  on price_history;
drop policy if exists "manual_all"      on manual_pages;
drop policy if exists "reads_all"       on manual_reads;
drop policy if exists "quiz_all"        on quiz_attempts;
drop policy if exists "feedback_all"    on feedback;
drop policy if exists "requests_all"    on requests;
drop policy if exists "suggestions_all" on suggestions;
drop policy if exists "tasks_all"       on tasks;
drop policy if exists "notifs_all"      on notifications;
drop policy if exists "content_all"     on content_blocks;
drop policy if exists "meeting_all"     on meeting_reports;
drop policy if exists "revenue_all"     on revenue_history;
drop policy if exists "ai_agents_all"   on ai_agents;
drop policy if exists "ai_docs_all"     on ai_context_docs;
drop policy if exists "doc_templates_all" on document_templates;
drop policy if exists "docs_issued_all" on documents_issued;

-- Garantir RLS activo (idempotente).
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
alter table revenue_history  enable row level security;
alter table ai_agents        enable row level security;
alter table ai_context_docs  enable row level security;
alter table document_templates enable row level security;
alter table documents_issued enable row level security;

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 3 — PROFILES (auth.uid())
--   Leitura: qualquer autenticado (directório interno de colegas).
--   Escrita: o próprio (o seu registo) ou admin. Criar/apagar: admin.
--   Anon: sem policy → 0 linhas (verificação curl).
-- ═══════════════════════════════════════════════════════════
create policy "profiles_sel" on profiles for select to authenticated using (true);
create policy "profiles_upd" on profiles for update to authenticated
  using (id = auth.uid() or app_is_admin())
  with check (id = auth.uid() or app_is_admin());
create policy "profiles_ins" on profiles for insert to authenticated
  with check (app_is_admin());
create policy "profiles_del" on profiles for delete to authenticated
  using (app_is_admin());

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 4 — PERMISSIONS  (lê as suas; admin gere todas)
-- ═══════════════════════════════════════════════════════════
create policy "perms_sel" on permissions for select to authenticated
  using (user_code = app_user_code() or app_is_admin());
create policy "perms_mod" on permissions for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 5 — COMPANY_SETTINGS
--   Leitura: autenticado. Escrita: admin.
--   NOTA #4: a anthropic_api_key continua legível por autenticados (a IA do
--   colaborador obtém-a on-demand). Para a trancar ao admin, activar a versão
--   estrita ABAIXO em conjunto com a Edge Function da Anthropic (Sprint 2),
--   senão a IA dos colaboradores deixa de responder.
-- ═══════════════════════════════════════════════════════════
create policy "csettings_sel" on company_settings for select to authenticated using (true);
create policy "csettings_mod" on company_settings for all to authenticated
  using (app_is_admin()) with check (app_is_admin());
-- VERSÃO ESTRITA (Sprint 2, com Edge Function) — substitui csettings_sel:
--   drop policy if exists "csettings_sel" on company_settings;
--   create policy "csettings_sel" on company_settings for select to authenticated
--     using (key_ <> 'anthropic_api_key' or app_is_admin());

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 6 — CATÁLOGO OPERACIONAL  (leitura: autenticado; escrita: admin)
--   offices, payment_methods, services, templates, manual_pages,
--   content_blocks, ai_agents, ai_context_docs, document_templates
-- ═══════════════════════════════════════════════════════════
create policy "offices_sel"  on offices         for select to authenticated using (true);
create policy "offices_mod"  on offices         for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "payments_sel" on payment_methods for select to authenticated using (true);
create policy "payments_mod" on payment_methods for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "services_sel" on services        for select to authenticated using (true);
create policy "services_mod" on services        for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "templates_sel" on templates      for select to authenticated using (true);
create policy "templates_mod" on templates      for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "manual_sel"   on manual_pages    for select to authenticated using (true);
create policy "manual_mod"   on manual_pages    for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "content_sel"  on content_blocks  for select to authenticated using (true);
create policy "content_mod"  on content_blocks  for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "aiagents_sel" on ai_agents       for select to authenticated using (true);
create policy "aiagents_mod" on ai_agents       for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "aidocs_sel"   on ai_context_docs for select to authenticated using (true);
create policy "aidocs_mod"   on ai_context_docs for all    to authenticated using (app_is_admin()) with check (app_is_admin());

create policy "doctpl_sel"   on document_templates for select to authenticated using (true);
create policy "doctpl_mod"   on document_templates for all    to authenticated using (app_is_admin()) with check (app_is_admin());

-- price_history: log de alterações de preço — leitura autenticada, escrita admin.
create policy "pricehist_sel" on price_history for select to authenticated using (true);
create policy "pricehist_mod" on price_history for all    to authenticated using (app_is_admin()) with check (app_is_admin());

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 7 — DADOS POR UTILIZADOR (user_code = app_user_code())
-- ═══════════════════════════════════════════════════════════

-- manual_reads / quiz_attempts: progresso do próprio (admin vê tudo).
create policy "reads_sel" on manual_reads for select to authenticated
  using (user_code = app_user_code() or app_is_admin());
create policy "reads_ins" on manual_reads for insert to authenticated
  with check (user_code = app_user_code());
create policy "reads_adm" on manual_reads for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

create policy "quiz_sel" on quiz_attempts for select to authenticated
  using (user_code = app_user_code() or app_is_admin());
create policy "quiz_ins" on quiz_attempts for insert to authenticated
  with check (user_code = app_user_code());
create policy "quiz_adm" on quiz_attempts for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- feedback: o próprio vê/cria o seu; admin gere tudo.
create policy "feedback_sel" on feedback for select to authenticated
  using (user_code = app_user_code() or created_by = app_user_code() or app_is_admin());
create policy "feedback_ins" on feedback for insert to authenticated
  with check (created_by = app_user_code() or app_is_admin());
create policy "feedback_adm" on feedback for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- requests: o próprio vê/cria os seus; admin aprova/rejeita.
create policy "requests_sel" on requests for select to authenticated
  using (user_code = app_user_code() or app_is_admin());
create policy "requests_ins" on requests for insert to authenticated
  with check (user_code = app_user_code());
create policy "requests_adm" on requests for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- suggestions: o próprio vê/cria as suas; admin gere.
create policy "suggestions_sel" on suggestions for select to authenticated
  using (user_code = app_user_code() or app_is_admin());
create policy "suggestions_ins" on suggestions for insert to authenticated
  with check (user_code = app_user_code());
create policy "suggestions_adm" on suggestions for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- tasks: o responsável (assigned_to) e o criador vêem; admin gere; o
-- responsável pode actualizar o estado.
create policy "tasks_sel" on tasks for select to authenticated
  using (assigned_to = app_user_code() or created_by = app_user_code() or app_is_admin());
create policy "tasks_upd" on tasks for update to authenticated
  using (assigned_to = app_user_code() or app_is_admin())
  with check (assigned_to = app_user_code() or app_is_admin());
create policy "tasks_adm" on tasks for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- notifications: o destinatário vê/marca as suas; qualquer autenticado pode
-- criar (notificar colegas/admins); admin gere tudo.
create policy "notifs_sel" on notifications for select to authenticated
  using (to_user = app_user_code() or app_is_admin());
create policy "notifs_ins" on notifications for insert to authenticated
  with check (true);
create policy "notifs_upd" on notifications for update to authenticated
  using (to_user = app_user_code() or app_is_admin())
  with check (to_user = app_user_code() or app_is_admin());
create policy "notifs_del" on notifications for delete to authenticated
  using (to_user = app_user_code() or app_is_admin());

-- documents_issued: o emissor vê os seus; admin vê todos; cria o próprio.
create policy "docsissued_sel" on documents_issued for select to authenticated
  using (issued_by = app_user_code() or app_is_admin());
create policy "docsissued_ins" on documents_issued for insert to authenticated
  with check (issued_by = app_user_code() or app_is_admin());
create policy "docsissued_adm" on documents_issued for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 8 — DADOS SENSÍVEIS / FINANCEIROS (admin only)
--   meeting_reports, revenue_history
-- ═══════════════════════════════════════════════════════════
create policy "meeting_adm" on meeting_reports for all to authenticated
  using (app_is_admin()) with check (app_is_admin());
create policy "revenue_adm" on revenue_history for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

commit;

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 9 — STORAGE (nota, fora do âmbito deste passo)
-- Os buckets avatars/letterheads/agent-docs continuam com leitura pública e
-- upload aberto (ver supabase-schema-final.sql). Endurecer numa migração
-- própria: restringir INSERT/UPDATE/DELETE a `to authenticated` e, idealmente,
-- a app_is_admin() para letterheads/agent-docs.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- SECÇÃO 10 — VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════
-- (a) Policies activas por tabela:
--   select tablename, policyname, cmd, roles
--     from pg_policies where schemaname='public' order by tablename, policyname;
-- (b) Acesso anónimo (deve devolver [] / 0 linhas):
--   curl "$SB_URL/rest/v1/profiles?select=*" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON"
-- (c) Nenhuma policy `using (true)` permissiva a sobrar para anon:
--   select tablename, policyname from pg_policies
--    where schemaname='public' and qual='true' and 'anon'=any(roles);
--   → deve devolver 0 linhas.
