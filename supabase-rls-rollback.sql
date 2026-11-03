-- ═══════════════════════════════════════════════════════════
-- ROLLBACK do RLS — repõe as policies permissivas `using (true)`
-- ═══════════════════════════════════════════════════════════
-- USAR SÓ EM EMERGÊNCIA: se, depois de aplicar supabase-rls-policies.sql,
-- a app/utilizadores ficarem bloqueados. Repõe o estado anterior
-- (qualquer pessoa com a anon key volta a ler/escrever tudo).
-- Executar no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

begin;

-- 1. Remover TODAS as policies actuais das tabelas public (as novas do RLS).
do $$
declare r record;
begin
  for r in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end$$;

-- 2. Recriar as policies permissivas originais (1 por tabela).
create policy "profiles_all"     on profiles         for all using (true);
create policy "perms_all"        on permissions      for all using (true);
create policy "settings_all"     on company_settings for all using (true);
create policy "offices_all"      on offices          for all using (true);
create policy "payments_all"     on payment_methods  for all using (true);
create policy "services_all"     on services         for all using (true);
create policy "templates_all"    on templates        for all using (true);
create policy "price_hist_all"   on price_history    for all using (true);
create policy "manual_all"       on manual_pages     for all using (true);
create policy "reads_all"        on manual_reads     for all using (true);
create policy "quiz_all"         on quiz_attempts    for all using (true);
create policy "feedback_all"     on feedback         for all using (true);
create policy "requests_all"     on requests         for all using (true);
create policy "suggestions_all"  on suggestions      for all using (true);
create policy "tasks_all"        on tasks            for all using (true);
create policy "notifs_all"       on notifications    for all using (true);
create policy "content_all"      on content_blocks   for all using (true);
create policy "meeting_all"      on meeting_reports  for all using (true);
create policy "revenue_all"      on revenue_history  for all using (true);
create policy "ai_agents_all"    on ai_agents        for all using (true);
create policy "ai_docs_all"      on ai_context_docs  for all using (true);
create policy "doc_templates_all" on document_templates for all using (true);
create policy "docs_issued_all"  on documents_issued for all using (true);

commit;

-- 3. (Opcional) remover as funções auxiliares do RLS:
--   drop function if exists app_is_admin();
--   drop function if exists app_user_code();

-- Verificação: deve voltar a haver 1 policy `true` por tabela.
--   select tablename, policyname, qual from pg_policies
--    where schemaname='public' order by tablename;
