-- ═══════════════════════════════════════════════════════════
-- Etapa 9 — Fase 2: Modelos completos de procurações e contratos
-- Executar no Supabase SQL Editor.
-- Pré-requisito: tabela document_templates já criada
-- (ver supabase-schema-final.sql).
--
-- Este ficheiro é IDEMPOTENTE (insert ... on conflict do update) e
-- AUTO-SUFICIENTE: popula o conjunto canónico completo de modelos.
--
-- INVENTÁRIO (20 doc_keys = conjunto canónico):
--   Procurações empresa  (4): proc_at_simples, proc_at_familia,
--                             proc_at_menor, proc_gerente_quotas
--   Procurações advogada (6): proc_aima_consulta, proc_aima_judicial,
--                             proc_gnr_pj, proc_inpi, proc_casamento,
--                             proc_nacionalidade
--   Procuração brasil    (1): proc_consulado_br
--   Contratos empresa    (6): contrato_servicos, contrato_geral,
--                             contrato_niss, contrato_troca_carta,
--                             contrato_renovacao_ar,
--                             contrato_recepcao_correspondencia
--   Contratos advogada   (3): contrato_cplp, contrato_casamento,
--                             contrato_nacionalidade
--
-- Dos 20, cinco já existem no array JS DOC_TEMPLATE_SEEDS (index.html):
--   proc_at_simples, proc_at_familia, proc_at_menor,
--   proc_consulado_br, contrato_servicos.
-- Os restantes 15 são adicionados por este seed (os "modelos em falta").
-- Os 5 existentes são reinseridos com os MESMOS bodies/fields do JS
-- para que o ficheiro funcione standalone (o DELETE + placeholder do
-- seed antigo apagava-os sem repor — bug corrigido aqui).
--
-- Convenções de variáveis nos bodies:
--   Cliente:    {{nome}} {{nac}} {{nasc}} {{tipo_doc}} {{num_doc}}
--               {{orgao_emissor}} {{validade}} {{nif}} {{morada}}
--               {{estado_civil}} {{local}} {{data_doc}}
--   Procurador: {{proc_nome}} {{proc_nac}} {{proc_nasc}} {{proc_doc_tipo}}
--               {{proc_doc_num}} {{proc_doc_org}} {{proc_doc_val}}
--               {{proc_cpf}} {{proc_oab}}
--   Advogada:   {{adv_nome}} {{adv_oab}} {{adv_passaporte}} {{adv_doc_val}}
--   Condicionais (resolvidas em runtime — só aparecem se preenchidas):
--               {{morada_texto}} {{cpf_texto}} {{nuipc_texto}}
--               {{poderes_adicionais}} {{valores_inclusos_bloco}}
--               {{valores_nao_inclusos_bloco}} {{entidade_bloco}}
--               {{dados_filhos_texto}}
-- ═══════════════════════════════════════════════════════════

begin;

-- ── 1. Corrigir o CHECK do letterhead ──────────────────────
-- O pipeline (letterheadToPng) resolve `letterhead_<valor>_url` e a UI
-- carrega os timbres com os prefixos 'empresa' / 'adv' / 'brasil'.
-- O constraint original ('seven','advogada') impedia esses valores.
alter table document_templates
  drop constraint if exists document_templates_letterhead_check;
alter table document_templates
  add constraint document_templates_letterhead_check
  check (letterhead in ('seven','advogada','empresa','adv','brasil'));

-- ── 2. Defaults do procurador advogada (não sobrescreve dados reais) ──
insert into company_settings (key_, value_) values
  ('proc_adv_nome',       'Ana Kathlyn'),
  ('proc_adv_nac',        'Brasileira'),
  ('proc_adv_passaporte', 'FU045681')
on conflict (key_) do nothing;

-- ═══════════════════════════════════════════════════════════
-- 3. MODELOS
-- ═══════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────
-- 3.1 PROCURAÇÕES EMPRESA (letterhead 'empresa')
-- ──────────────────────────────────────────────────────────

-- (já no JS — reposto verbatim) proc_at_simples
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_at_simples', 'procuracao', 'Procuração AT — Simples',
  '1 cliente, poderes junto à Autoridade Tributária', 'empresa',
  $b$Eu, **{{nome}}**, {{nacionalidade}}, nascido em {{data_nascimento}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade_doc}}, pelo presente, nomeio e constituo neste ato meu bastante procurador a empresa **SANTOS JESUS**, Unipessoal LDA, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 - Albufeira, representada pelo Sr. **{{proc_nome}}**, {{proc_nac}}, nascido em {{proc_nasc}}, portador do {{proc_doc_tipo}} n.º {{proc_doc_num}}, emitido por {{proc_doc_org}}, válido até {{proc_doc_val}}, a quem confere plenos poderes junto da Autoridade Tributária para obter o número de identificação fiscal (NIF) e nomear seu representante fiscal, obter código de acesso ao portal das finanças, alterar a morada fiscal, bem como na prática de Abertura/Alteração/Cessação de Actividade, nos termos do artigo 30.º e seguintes do Código do Imposto sobre o Valor Acrescentado – CIVA, confere também os poderes para receber os reembolsos em meu nome utilizando o IBAN do representante, e atribuição e levantamento do Número de Identificação de Segurança Social (NISS) junto da Segurança Social.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nacionalidade","label":"Nacionalidade","type":"text","required":true},
    {"key":"data_nascimento","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true,"placeholder":"ex: República Federativa do Brasil"},
    {"key":"validade_doc","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 1, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (já no JS — reposto verbatim) proc_at_familia
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_at_familia', 'procuracao', 'Procuração AT — Família',
  'Casal com ou sem filhos, poderes AT', 'empresa',
  $b$**{{nome1}}**, {{nac1}}, nascido em {{nasc1}}, portador(a) do {{tipo_doc1}} n.º {{num_doc1}}, emitido por {{emissor1}}, com validade até {{validade1}}, e **{{nome2}}**, {{nac2}}, nascido em {{nasc2}}, portador(a) do {{tipo_doc2}} n.º {{num_doc2}}, emitido por {{emissor2}}, com validade até {{validade2}}, pelo presente, nomeiam e constituem neste ato seu bastante procurador a empresa **SANTOS JESUS**, Unipessoal LDA, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 - Albufeira, representada pelo Sr. **{{proc_nome}}**, {{proc_nac}}, Casado, nascido em {{proc_nasc}}, portador do {{proc_doc_tipo}} n.º {{proc_doc_num}}, emitido por {{proc_doc_org}}, válido até {{proc_doc_val}}, a quem conferem plenos poderes junto da Autoridade Tributária para obter o número de identificação fiscal (NIF) e nomear seu representante fiscal, obter código de acesso ao portal das finanças, bem como na prática de Abertura de Actividade, nos termos do artigo 30.º e seguintes do Código do Imposto sobre o Valor Acrescentado – CIVA, confere também os poderes para receber os reembolsos em meu nome utilizando o IBAN do representante, e atribuição e levantamento do Número de Identificação de Segurança Social (NISS) junto da Segurança Social{{dados_filhos_texto}}.$b$,
  $j$[
    {"key":"nome1","label":"Nome do 1º outorgante","type":"text","required":true},
    {"key":"nac1","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc1","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc1","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc1","label":"Número do documento","type":"text","required":true},
    {"key":"emissor1","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade1","label":"Validade","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"nome2","label":"Nome do 2º outorgante","type":"text","required":true},
    {"key":"nac2","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc2","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc2","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc2","label":"Número do documento","type":"text","required":true},
    {"key":"emissor2","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade2","label":"Validade","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tem_filhos","label":"Inclui filhos?","type":"checkbox","required":false},
    {"key":"dados_filhos","label":"Dados dos filhos (um por linha)","type":"textarea","required":false},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 2, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (já no JS — reposto verbatim) proc_at_menor
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_at_menor', 'procuracao', 'Procuração AT — Menor',
  'Menor representado por progenitor', 'empresa',
  $b$**{{nome_menor}}**, {{nac_menor}}, nascido em {{nasc_menor}}, portador(a) do {{tipo_doc_menor}} n.º {{num_doc_menor}}, emitido por {{emissor_menor}}, com validade até {{validade_menor}}, representado(a) por {{relacao}} **{{nome_repr}}**, {{nac_repr}}, nascido em {{nasc_repr}}, portador(a) do {{tipo_doc_repr}} n.º {{num_doc_repr}}, emitido por {{emissor_repr}}, com validade até {{validade_repr}}, pelo presente, nomeia e constitui neste ato seu bastante procurador a empresa **SANTOS JESUS**, Unipessoal LDA, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 - Albufeira, representada pelo Sr. **{{proc_nome}}**, {{proc_nac}}, Casado, nascido em {{proc_nasc}}, portador do {{proc_doc_tipo}} n.º {{proc_doc_num}}, emitido por {{proc_doc_org}}, válido até {{proc_doc_val}}, a quem confere plenos poderes junto da Autoridade Tributária para obter o número de identificação fiscal (NIF) e nomear seu representante fiscal, obter código de acesso ao portal das finanças, bem como na prática de Abertura de Actividade, nos termos do artigo 30.º e seguintes do Código do Imposto sobre o Valor Acrescentado – CIVA, confere também os poderes para receber os reembolsos em meu nome utilizando o IBAN do representante, e atribuição e levantamento do Número de Identificação de Segurança Social (NISS) junto da Segurança Social.$b$,
  $j$[
    {"key":"nome_menor","label":"Nome do menor","type":"text","required":true},
    {"key":"nac_menor","label":"Nacionalidade do menor","type":"text","required":true},
    {"key":"nasc_menor","label":"Data de nascimento do menor","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc_menor","label":"Tipo de documento do menor","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc_menor","label":"Número do documento do menor","type":"text","required":true},
    {"key":"emissor_menor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade_menor","label":"Validade","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"relacao","label":"Relação com o menor","type":"select","required":true,"options":["sua genitora","seu genitor","sua representante legal","seu representante legal"]},
    {"key":"nome_repr","label":"Nome do representante","type":"text","required":true},
    {"key":"nac_repr","label":"Nacionalidade do representante","type":"text","required":true},
    {"key":"nasc_repr","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc_repr","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc_repr","label":"Número do documento","type":"text","required":true},
    {"key":"emissor_repr","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade_repr","label":"Validade","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 3, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) proc_gerente_quotas — gestão societária (nomeação de gerente / cessão de quotas)
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_gerente_quotas', 'procuracao', 'Procuração — Gerência e Quotas',
  'Nomeação de gerente e/ou cessão de quotas societárias', 'empresa',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}, na qualidade de sócio(a) da sociedade **{{empresa_nome}}**, NIPC {{empresa_nif}}, pelo presente nomeio e constituo meu bastante procurador a empresa **SANTOS JESUS**, Unipessoal LDA, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 - Albufeira, representada pelo Sr. **{{proc_nome}}**, {{proc_nac}}, portador do {{proc_doc_tipo}} n.º {{proc_doc_num}}, válido até {{proc_doc_val}}, a quem confiro os seguintes poderes:

1. **Representação Geral:** Representar-me em assembleias gerais e perante a Conservatória do Registo Comercial, a Autoridade Tributária e demais entidades competentes, podendo assinar actas, requerimentos, declarações e registos necessários.
{{poderes_adicionais}}
Os presentes poderes são conferidos de livre e espontânea vontade, para o bom e fiel cumprimento do mandato.$b$,
  $j$[
    {"key":"nome","label":"Nome do sócio outorgante","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Título de Residência","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"empresa_nome","label":"Nome da sociedade","type":"text","required":true},
    {"key":"empresa_nif","label":"NIPC da sociedade","type":"text","required":true},
    {"key":"novo_gerente_nome","label":"Novo gerente — nome (opcional)","type":"text","required":false},
    {"key":"novo_gerente_nasc","label":"Novo gerente — nascimento (opcional)","type":"text","required":false,"placeholder":"DD/MM/AAAA"},
    {"key":"novo_gerente_doc","label":"Novo gerente — documento (opcional)","type":"text","required":false},
    {"key":"cessionario_nome","label":"Cessionário da quota — nome (opcional)","type":"text","required":false},
    {"key":"valor_quota","label":"Valor da quota a transferir (opcional)","type":"text","required":false},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 5, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- ──────────────────────────────────────────────────────────
-- 3.2 PROCURAÇÃO BRASIL (letterhead 'brasil')
-- ──────────────────────────────────────────────────────────

-- (já no JS — reposto verbatim) proc_consulado_br
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_consulado_br', 'procuracao', 'Procuração — Consulado Brasileiro',
  'Poderes para serviços no Consulado Brasileiro (e-consular)', 'brasil',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido pela {{emissor}}, com validade até {{validade}}{{cpf_texto}}, pelo presente, nomeio e constituo neste ato meu bastante procurador o Sr. **{{proc_nome}}**, {{proc_nac}}, nascido em {{proc_nasc}}, portador do {{proc_doc_tipo}} n.º {{proc_doc_num}}, emitido por {{proc_doc_org}}, válido até {{proc_doc_val}} e CPF {{proc_cpf}}, a quem confere poderes junto ao Consulado Brasileiro para efetuar qualquer serviço e marcações no sistema e-consular.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true,"default":"Brasileiro(a)"},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"emissor","label":"Órgão emissor","type":"text","required":true,"default":"República Federativa do Brasil"},
    {"key":"validade","label":"Validade","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"cpf","label":"CPF","type":"text","required":false,"placeholder":"000.000.000-00"},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 4, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- ──────────────────────────────────────────────────────────
-- 3.3 PROCURAÇÕES ADVOGADA (letterhead 'adv')
-- ──────────────────────────────────────────────────────────

-- (NOVO) proc_aima_consulta — representação administrativa AIMA
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_aima_consulta', 'procuracao', 'Procuração — AIMA (Administrativa)',
  'Representação administrativa junto da AIMA', 'adv',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}{{morada_texto}}, pelo presente nomeio e constituo minha bastante procuradora a Dra. **{{proc_nome}}**, {{proc_nac}}, Advogada com inscrição na Ordem dos Advogados sob a cédula profissional n.º {{proc_oab}}, portadora do {{proc_doc_tipo}} n.º {{proc_doc_num}}, válido até {{proc_doc_val}}, a quem confiro poderes para me representar junto da Agência para a Integração, Migrações e Asilo (AIMA) e demais entidades administrativas competentes, podendo efetuar agendamentos, consultar e instruir processos, apresentar, entregar e levantar documentos e requerimentos, receber notificações e praticar todos os actos necessários ao bom andamento do meu processo migratório.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Título de Residência","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"morada","label":"Morada","type":"text","required":false},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 20, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) proc_aima_judicial — mandato forense
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_aima_judicial', 'procuracao', 'Procuração Forense — Judicial',
  'Mandato judicial e extrajudicial com poderes forenses', 'adv',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}{{morada_texto}}, constituo minha bastante procuradora a Dra. **{{proc_nome}}**, {{proc_nac}}, Advogada com inscrição na Ordem dos Advogados sob a cédula profissional n.º {{proc_oab}}, a quem confiro os mais amplos poderes forenses em direito permitidos, para me representar em juízo e fora dele, em todos os actos judiciais e extrajudiciais relativos ao processo{{nuipc_texto}}, incluindo os poderes especiais para confessar, desistir, transigir, substabelecer com ou sem reserva, receber e dar quitação, nos termos do artigo 45.º do Código de Processo Civil.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Título de Residência","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"nuipc","label":"NUIPC / Nº de processo (opcional)","type":"text","required":false},
    {"key":"morada","label":"Morada","type":"text","required":false},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 21, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) proc_gnr_pj — representação perante autoridades policiais
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_gnr_pj', 'procuracao', 'Procuração — GNR / PSP / PJ',
  'Apresentação de queixas e representação perante autoridades policiais', 'adv',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}{{morada_texto}}, constituo minha bastante procuradora a Dra. **{{proc_nome}}**, {{proc_nac}}, Advogada com inscrição na Ordem dos Advogados sob a cédula profissional n.º {{proc_oab}}, a quem confiro poderes para me representar junto da Guarda Nacional Republicana (GNR), da Polícia de Segurança Pública (PSP) e da Polícia Judiciária (PJ), podendo apresentar e subscrever queixas, denúncias e participações, prestar e tomar declarações, requerer certidões e cópias de autos, acompanhar diligências e praticar todos os actos necessários{{nuipc_texto}}.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Título de Residência","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"nuipc","label":"NUIPC / Nº de processo (opcional)","type":"text","required":false},
    {"key":"morada","label":"Morada","type":"text","required":false},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 22, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) proc_inpi — propriedade industrial
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_inpi', 'procuracao', 'Procuração — INPI (Propriedade Industrial)',
  'Registo de marcas, logótipos e patentes junto do INPI', 'adv',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}{{morada_texto}}, constituo minha bastante procuradora a Dra. **{{proc_nome}}**, {{proc_nac}}, Advogada com inscrição na Ordem dos Advogados sob a cédula profissional n.º {{proc_oab}}, a quem confiro poderes para me representar junto do Instituto Nacional da Propriedade Industrial (INPI), podendo requerer o registo de marcas, logótipos, patentes e demais direitos de propriedade industrial, apresentar pedidos, reclamações e recursos, efetuar o pagamento de taxas e praticar todos os actos necessários ao bom andamento dos pedidos.$b$,
  $j$[
    {"key":"nome","label":"Nome completo / Designação social","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc","label":"Data de nascimento / constituição","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Cartão Cidadão","Título de Residência","Certidão Comercial"]},
    {"key":"num_doc","label":"Número do documento / NIPC","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"morada","label":"Morada / Sede","type":"text","required":false},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 23, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) proc_casamento — processo preliminar de casamento
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_casamento', 'procuracao', 'Procuração — Casamento',
  'Organização do processo preliminar de casamento', 'adv',
  $b$Eu, **{{nome}}**, {{nac}}, {{estado_civil}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}{{morada_texto}}, constituo minha bastante procuradora a Dra. **{{proc_nome}}**, {{proc_nac}}, Advogada com inscrição na Ordem dos Advogados sob a cédula profissional n.º {{proc_oab}}, a quem confiro poderes para me representar junto da Conservatória do Registo Civil e demais entidades competentes, para efeitos de organização do processo preliminar de casamento, podendo requerer publicações, apresentar, entregar e levantar documentos e certidões, e praticar todos os actos necessários à instrução, celebração e registo do casamento.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"estado_civil","label":"Estado civil","type":"select","required":true,"options":["Solteiro(a)","Divorciado(a)","Viúvo(a)"]},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Título de Residência","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"morada","label":"Morada","type":"text","required":false},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 24, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) proc_nacionalidade — aquisição de nacionalidade portuguesa
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'proc_nacionalidade', 'procuracao', 'Procuração — Nacionalidade',
  'Instrução do pedido de nacionalidade portuguesa', 'adv',
  $b$Eu, **{{nome}}**, {{nac}}, nascido em {{nasc}}, portador(a) do {{tipo_doc}} n.º {{num_doc}}, emitido por {{orgao_emissor}}, com validade até {{validade}}{{morada_texto}}{{cpf_texto}}, constituo minha bastante procuradora a Dra. **{{proc_nome}}**, {{proc_nac}}, Advogada com inscrição na Ordem dos Advogados sob a cédula profissional n.º {{proc_oab}}, a quem confiro poderes para me representar junto da Conservatória dos Registos Centrais, do Instituto dos Registos e do Notariado (IRN) e demais entidades competentes, para efeitos de instrução do pedido de aquisição da nacionalidade portuguesa, podendo requerer e levantar certidões, apresentar requerimentos e documentos, prestar declarações e praticar todos os actos necessários.$b$,
  $j$[
    {"key":"nome","label":"Nome completo","type":"text","required":true},
    {"key":"nac","label":"Nacionalidade","type":"text","required":true},
    {"key":"nasc","label":"Data de nascimento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"tipo_doc","label":"Tipo de documento","type":"select","required":true,"options":["Passaporte","Título de Residência","Cartão Cidadão","Bilhete de Identidade"]},
    {"key":"num_doc","label":"Número do documento","type":"text","required":true},
    {"key":"orgao_emissor","label":"Órgão emissor","type":"text","required":true},
    {"key":"validade","label":"Validade do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"},
    {"key":"cpf","label":"CPF (opcional)","type":"text","required":false,"placeholder":"000.000.000-00"},
    {"key":"morada","label":"Morada","type":"text","required":false},
    {"key":"local","label":"Local de assinatura","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data do documento","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 25, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- ──────────────────────────────────────────────────────────
-- 3.4 CONTRATOS EMPRESA (letterhead 'empresa')
-- ──────────────────────────────────────────────────────────

-- (já no JS — reposto verbatim) contrato_servicos
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_servicos', 'contrato', 'Contrato de Prestação de Serviços',
  'Contrato padrão para todos os serviços', 'empresa',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços, mediante as seguintes cláusulas:

**Serviço:** {{servico}}
**Valor:** €{{valor}} (IVA incluído)$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  $c$[
    {"id":"c1","text":"A SEVEN Services presta serviços de meio, actuando com diligência, organização e profissionalismo. Não é possível garantir resultados, prazos ou decisões de entidades públicas ou judiciais."},
    {"id":"c2","text":"O pagamento remunera o tempo, análise, disponibilidade e estrutura operacional da SEVEN Services, independentemente do resultado obtido junto de entidades externas."},
    {"id":"c3","text":"Cancelamento antes do início do serviço: retenção de 30% do valor pago, a título de custos administrativos e operacionais. Considera-se início do serviço qualquer actividade preparatória, incluindo análise do caso, solicitação de documentos, criação de pasta ou elaboração de procuração."},
    {"id":"c4","text":"Após o início do serviço não há direito a reembolso, total ou parcial, independentemente do estado do processo ou do motivo alegado."},
    {"id":"c5","text":"Serviços pagos e não iniciados por falta de documentação do cliente têm validade máxima de 90 dias. Findo este prazo, o serviço é encerrado automaticamente sem direito a reembolso."},
    {"id":"c6","text":"Taxas, emolumentos e custos pagos a entidades públicas não são reembolsáveis em qualquer circunstância."}
  ]$c$::jsonb,
  true, 10, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_geral — contrato completo com cláusulas no corpo
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_geral', 'contrato', 'Contrato de Prestação de Serviços — Geral',
  'Contrato completo com todas as cláusulas no corpo do documento', 'empresa',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto a prestação do serviço: {{servico}}. {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio, actuando com diligência, organização e profissionalismo. Não é possível garantir resultados, prazos ou decisões de entidades públicas ou judiciais. O pagamento remunera o tempo, análise, disponibilidade e estrutura operacional da SEVEN Services.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço (incluindo análise do caso, solicitação de documentos, criação de pasta ou elaboração de procuração), não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Validade**
Serviços pagos e não iniciados por falta de documentação do CLIENTE têm validade máxima de 90 dias. Findo o prazo, o serviço é encerrado automaticamente sem reembolso.

**Cláusula 6.ª — Custos Externos**
Taxas, emolumentos ou valores pagos a entidades públicas não são reembolsáveis em qualquer circunstância.{{entidade_bloco}}

**Cláusula 7.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"entidade","label":"Entidade decisora (opcional)","type":"text","required":false},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 11, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_niss — NISS / Segurança Social
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_niss', 'contrato', 'Contrato — NISS / Segurança Social',
  'Pedido de NISS e representação junto da Segurança Social', 'empresa',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto o tratamento do pedido de Número de Identificação de Segurança Social (NISS) e a representação do CLIENTE junto do Instituto da Segurança Social. {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio. Não é possível garantir prazos de atribuição do NISS, que dependem exclusivamente da Segurança Social. O pagamento remunera o tempo, análise e estrutura operacional da SEVEN Services.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Validade**
Serviços pagos e não iniciados por falta de documentação do CLIENTE têm validade máxima de 90 dias, sendo depois encerrados sem reembolso.

**Cláusula 6.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Pedido de NISS"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 12, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_troca_carta — troca de carta de condução (IMT)
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_troca_carta', 'contrato', 'Contrato — Troca de Carta (IMT)',
  'Troca / reconhecimento de carta de condução junto do IMT', 'empresa',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto o tratamento do processo de troca, reconhecimento ou revalidação da carta de condução junto do Instituto da Mobilidade e dos Transportes (IMT). {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio. Não é possível garantir a equivalência ou aceitação da carta estrangeira, que depende exclusivamente do IMT. O pagamento remunera o tempo, análise e estrutura operacional da SEVEN Services.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Custos Externos**
Taxas e emolumentos do IMT e eventuais exames médicos não estão incluídos e não são reembolsáveis.

**Cláusula 6.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Troca de Carta de Condução"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 13, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_renovacao_ar — renovação de Autorização de Residência
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_renovacao_ar', 'contrato', 'Contrato — Renovação de AR (AIMA)',
  'Renovação de Autorização de Residência junto da AIMA', 'empresa',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto a instrução e submissão do pedido de renovação de Autorização de Residência junto da Agência para a Integração, Migrações e Asilo (AIMA). {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio. A decisão e os prazos de renovação são da competência exclusiva da AIMA. O pagamento remunera o tempo, análise e estrutura operacional da SEVEN Services.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Validade e Custos Externos**
Serviços pagos e não iniciados por falta de documentação têm validade máxima de 90 dias. Taxas da AIMA e certidões não estão incluídas e não são reembolsáveis.

**Cláusula 6.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Renovação de Autorização de Residência"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 14, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_recepcao_correspondencia — morada fiscal / recepção de correspondência
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_recepcao_correspondencia', 'contrato', 'Contrato — Recepção de Correspondência',
  'Cedência de morada e recepção de correspondência', 'empresa',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Recepção de Correspondência, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
A SEVEN SERVICES cede ao CLIENTE a utilização da sua morada para efeitos de recepção de correspondência e, quando aplicável, de domicílio fiscal, comprometendo-se a receber, guardar e comunicar ao CLIENTE a correspondência recebida. {{descricao}}

**Cláusula 2.ª — Obrigações do Cliente**
O CLIENTE compromete-se a levantar a correspondência ou a indicar destino para reencaminhamento, e a manter os seus contactos actualizados. A SEVEN SERVICES não se responsabiliza por correspondência não levantada após 90 dias.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Recepção de Correspondência"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 15, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- ──────────────────────────────────────────────────────────
-- 3.5 CONTRATOS ADVOGADA (letterhead 'adv')
-- ──────────────────────────────────────────────────────────

-- (NOVO) contrato_cplp — residência CPLP
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_cplp', 'contrato', 'Contrato — Residência CPLP',
  'Acordo de Mobilidade CPLP — autorização de residência', 'adv',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços Jurídicos, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto a instrução do pedido de autorização de residência ao abrigo do Acordo de Mobilidade entre os Estados-Membros da CPLP. {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio, com acompanhamento jurídico assegurado por advogada inscrita na Ordem dos Advogados. A decisão final é da competência exclusiva da AIMA. O pagamento remunera o tempo, análise e estrutura operacional.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Custos Externos**
Taxas da AIMA, certidões e traduções não estão incluídas e não são reembolsáveis.

**Cláusula 6.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Autorização de Residência CPLP"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 30, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_casamento — processo de casamento
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_casamento', 'contrato', 'Contrato — Processo de Casamento',
  'Organização e instrução do processo de casamento', 'adv',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços Jurídicos, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto a organização e instrução do processo preliminar de casamento junto da Conservatória do Registo Civil. {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio, com acompanhamento jurídico assegurado por advogada inscrita na Ordem dos Advogados. O pagamento remunera o tempo, análise e estrutura operacional.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Custos Externos**
Emolumentos da Conservatória, certidões e traduções não estão incluídos e não são reembolsáveis.

**Cláusula 6.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Processo de Casamento"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 31, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- (NOVO) contrato_nacionalidade — processo de nacionalidade
insert into document_templates
  (doc_key, type, title, description, letterhead, body, fields, clauses, active, sort_order, updated_by)
values (
  'contrato_nacionalidade', 'contrato', 'Contrato — Nacionalidade',
  'Instrução do pedido de nacionalidade portuguesa', 'adv',
  $b$**{{nome}}**, NIF {{nif}}, residente em {{morada}}, doravante designado(a) CLIENTE, e a empresa **SANTOS JESUS, Unipessoal LDA**, NIPC 518 146 529, com sede em Rua do MFA, 111 – G, 8200-157 – Albufeira, doravante designada SEVEN SERVICES, celebram o presente Contrato de Prestação de Serviços Jurídicos, nos termos das cláusulas seguintes:

**Cláusula 1.ª — Objecto**
O presente contrato tem por objecto a instrução do pedido de aquisição da nacionalidade portuguesa junto da Conservatória dos Registos Centrais / IRN. {{descricao}}

**Cláusula 2.ª — Natureza dos Serviços**
A SEVEN Services presta serviços de meio, com acompanhamento jurídico assegurado por advogada inscrita na Ordem dos Advogados. A decisão é da competência exclusiva das entidades registais. O pagamento remunera o tempo, análise e estrutura operacional.

**Cláusula 3.ª — Valor**
Valor acordado: €{{valor}} (IVA incluído).{{valores_inclusos_bloco}}{{valores_nao_inclusos_bloco}}

**Cláusula 4.ª — Cancelamento e Reembolso**
Cancelamento antes do início do serviço: retenção de 30% do valor pago. Após o início do serviço não há direito a reembolso, total ou parcial.

**Cláusula 5.ª — Custos Externos**
Emolumentos do IRN, certidões, traduções e apostilas não estão incluídos e não são reembolsáveis.

**Cláusula 6.ª — Foro**
O presente contrato rege-se pela lei portuguesa, sendo competente o foro da Comarca de Albufeira.$b$,
  $j$[
    {"key":"nome","label":"Nome completo do cliente","type":"text","required":true},
    {"key":"nif","label":"NIF do cliente","type":"text","required":true},
    {"key":"morada","label":"Morada do cliente","type":"text","required":true},
    {"key":"servico","label":"Serviço contratado","type":"text","required":true,"default":"Processo de Nacionalidade"},
    {"key":"descricao","label":"Descrição (opcional)","type":"textarea","required":false},
    {"key":"valor","label":"Valor (€)","type":"text","required":true},
    {"key":"local","label":"Local","type":"text","required":true,"default":"Albufeira"},
    {"key":"data_doc","label":"Data","type":"text","required":true,"placeholder":"DD/MM/AAAA"}
  ]$j$::jsonb,
  '[]'::jsonb, true, 32, 'seed_etapa9'
)
on conflict (doc_key) do update set
  type=excluded.type, title=excluded.title, description=excluded.description,
  letterhead=excluded.letterhead, body=excluded.body, fields=excluded.fields,
  clauses=excluded.clauses, active=excluded.active, sort_order=excluded.sort_order,
  updated_by=excluded.updated_by, updated_at=now();

-- ═══════════════════════════════════════════════════════════
-- 4. MAPEAMENTO SERVIÇO → MODELO (proc_template / cont_template)
-- UPDATEs em códigos inexistentes afectam 0 linhas (inócuo).
-- ═══════════════════════════════════════════════════════════

-- Procurações
update services set proc_template = 'proc_at_simples'
  where code like 'AT%' or code like 'SS%' or code like 'IM%';

update services set proc_template = 'proc_consulado_br'
  where code like 'BR%' or code like 'DB%';

update services set proc_template = 'proc_aima_consulta'
  where code like 'AM%';

update services set proc_template = 'proc_aima_judicial'
  where code like 'JR%';

-- Contratos
update services set cont_template = 'contrato_servicos'
  where cont_template is null;

update services set cont_template = 'contrato_niss'
  where code in ('SS400','SS404');

update services set cont_template = 'contrato_troca_carta'
  where code in ('IM307','IM308','IM309');

update services set cont_template = 'contrato_renovacao_ar'
  where code like 'AM15%' or code like 'AM16%';

update services set cont_template = 'contrato_recepcao_correspondencia'
  where code = 'AT108';

update services set cont_template = 'contrato_cplp'
  where code in ('JR350','JR351','JR352','JR353','JR354','JR355');

update services set cont_template = 'contrato_nacionalidade'
  where code in ('JR375','JR376','JR377','JR378');

update services set cont_template = 'contrato_casamento'
  where code in ('JR359','JR360','JR361');

commit;

-- ═══════════════════════════════════════════════════════════
-- 5. CONFIRMAÇÃO
-- ═══════════════════════════════════════════════════════════
select
  count(*) filter (where type='procuracao') as procuracoes,
  count(*) filter (where type='contrato')   as contratos,
  count(*)                                   as total
from document_templates;

select doc_key, type, letterhead, sort_order, title
from document_templates
order by type, letterhead, sort_order;
