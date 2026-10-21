# Landing pages de diagnóstico (tráfego pago)

Quizzes gratuitos em `/diagnostico/<slug>` para campanhas do Meta Ads. Fluxo: abertura → captura (o lead é gravado aqui) → uma pergunta por tela (cada resposta atualiza o mesmo registro e a `ultima_etapa`) → resultado em semáforo + temperatura (quente/frio).

- **Lead quente:** a equipe liga. Na tela aparece "um especialista vai chamar você no WhatsApp" (análise gratuita de 15 min, válida por 7 dias) e o botão "Falar agora com um especialista".
- **Lead frio:** botão "Baixar meu diagnóstico (PDF)", opção de receber conteúdos por e-mail (consentimento separado) e o mesmo botão do WhatsApp.

## Arquivos

| O quê | Onde |
|---|---|
| Configuração de cada LP (textos A/B, perguntas, regras, temperatura, `publicado`) | `site/src/data/diagnosticos/*.ts` |
| Tipos da configuração | `site/src/data/diagnosticos/types.ts` |
| Motor (lógica condicional, resultado, temperatura, validação do WhatsApp) | `site/src/lib/diagnostico.ts` |
| Componente único do quiz | `site/src/components/DiagnosticQuiz.astro` |
| Página (gera uma rota por configuração) | `site/src/pages/diagnostico/[slug].astro` |
| UTMs/fbclid + eventos do Meta Pixel | `site/src/lib/tracking.ts` |
| PDF do diagnóstico (sem dependências, carregado só no clique) | `site/src/lib/pdf-mini.ts` |
| Chamadas à Edge Function | `site/src/lib/api.ts` (`diagStart`, `diagUpdate`, `diagComplete`, `diagNewsletter`) |
| Edge Function (grava no Supabase, integra Kommo/Resend) | `supabase/functions/landing-lead/index.ts` |
| Migração da tabela `landing_leads` | `supabase/migrations/20261021000000_landing_leads.sql` |
| Testes do motor | `site/scripts/test-diagnosticos.ts` → `npm run test:diagnosticos` |

## Ligar / desligar uma página

Em cada configuração, `publicado: true | false`:

- `false` (rascunho): a página **não é gerada** no build de produção, então dá 404. Para rever localmente: `npm run dev` (gera tudo) ou `PUBLIC_DIAG_PREVIEW=true npm run build`. Mesmo nesse caso, ela tem `noindex, nofollow`.
- `true`: a página é gerada no próximo deploy. Todas as LPs têm `noindex` e ficam fora do sitemap.

Hoje: `situacao-em-portugal`, `carta-de-conducao` e `visto` estão publicadas; `nacionalidade` e `nacionalidade-parada` são rascunhos.

**Variante B:** acrescente `?v=b` ao link do anúncio. A variante só existe quando a configuração tem `textos.b`; sem ela, aparece a A. A variante usada fica gravada no lead.

**Nova LP:** crie um arquivo em `site/src/data/diagnosticos/` e acrescente-o a `index.ts`.

## Implantação (ordem)

1. Rever e aplicar a migração `supabase/migrations/20261021000000_landing_leads.sql` no projeto `seven-services-site`.
2. Publicar a função: `supabase functions deploy landing-lead` (mesmo esquema de autenticação das outras funções: o site chama com a anon key).
3. Definir as variáveis abaixo.
4. Fazer merge na `main` (o deploy do GitHub Pages corre sozinho).

## Variáveis de ambiente

### Build do site (GitHub → Settings → Secrets and variables → Actions → **Variables**)

| Variável do repositório | Vira | Para quê |
|---|---|---|
| `META_PIXEL_ID` | `PUBLIC_META_PIXEL_ID` | ID do Meta Pixel. Só carrega depois do consentimento de marketing no banner de cookies. |
| `DIAG_WHATSAPP` | `PUBLIC_DIAG_WHATSAPP` | WhatsApp do comercial, só dígitos com DDI (ex.: `351939146298`). Vazio = WhatsApp principal do site. |
| `DIAG_BOOKING_URL` | `PUBLIC_DIAG_BOOKING_URL` | Opcional. Link de agenda para leads quentes (recebe `?lead=CÓDIGO`). Vazio = botão escondido. |

`PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` já existem. `PUBLIC_DIAG_PREVIEW=true` só serve para rever rascunhos; nunca o defina no build de produção.

### Secrets da Edge Function (Supabase → Edge Functions → Secrets)

| Secret | Padrão | Para quê |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | já existem | Gravar na tabela. A service_role **nunca** vai para o navegador. |
| `KOMMO_ENABLED` | `false` | `true` liga a integração com o Kommo. |
| `KOMMO_ENVIAR_FRIOS` | `true` | `true`: todo lead entra no Kommo na etapa 1. `false`: só entram os que concluem como **quentes** (os outros ficam só no Supabase). |
| `KOMMO_SUBDOMAIN`, `KOMMO_LONG_LIVED_TOKEN` | já usados pelo formulário do site | Credenciais do Kommo (as mesmas de `kommo-lead`). Opcional: `KOMMO_PIPELINE_ID`, `KOMMO_STATUS_ID`. |
| `RESEND_API_KEY` | já existe | Envio de e-mails. |
| `RESEND_AUDIENCE_ID` | vazio | Opcional. Audiência do Resend para onde vão os leads frios que pedem conteúdos. Vazio = o pedido fica só na tabela (`newsletter_optin`). |
| `TURNSTILE_SECRET_KEY` | já existe, se usado | Anti-spam (o site usa `PUBLIC_TURNSTILE_SITE_KEY`). |

## Kommo (desligado até confirmar)

Com `KOMMO_ENABLED=true`:

- **Etapa 1:** cria o lead (deduplicação do contato pelo telefone, igual ao formulário do site) com as etiquetas `LP - <slug>` e `LP - Incompleto`.
- **Resultado:** troca `LP - Incompleto` por `LP - Quente` ou `LP - Frio`, `LP - Verde/Amarelo/Vermelho` e, quando for o caso, `High ticket`, e acrescenta uma nota com o resultado, as respostas, o código e as UTMs.
- Erros do Kommo vão para `landing_leads.kommo_error` e nunca bloqueiam o quiz.

## Dados

Tabela `public.landing_leads` (RLS ligado, sem nenhuma policy: o público não lê nem escreve). Campos principais: `landing`, `variante`, `nome`, `whatsapp`, `email`, `consentimento_rgpd(_em)`, `respostas` (jsonb, por id da pergunta), `ultima_etapa` (`captura` → id da última pergunta respondida → `resultado`), `concluido`, `resultado_cor`, `servico_recomendado`, `servicos_tambem`, `temperatura`, `high_ticket`, `resumo`, `newsletter_optin`, UTMs, `fbclid`, `referrer`, `user_agent`, `codigo_curto` (o código mostrado ao lead e enviado no WhatsApp).

Leads que desistiram a meio: `where not concluido` e veja `ultima_etapa`.

## Rastreamento (Meta Pixel)

`PageView` (banner de cookies), `Lead` (etapa 1), `CompleteRegistration` (resultado), `Contact` (clique no WhatsApp) e `Schedule` (clique em agendar, só se `DIAG_BOOKING_URL` existir). Nada dispara sem consentimento de marketing; os eventos anteriores ao consentimento ficam em fila e só são enviados se a pessoa aceitar. Cada evento leva um `eventID` (id do lead), para deduplicar se um dia ligarmos a Conversions API.

## Pendências: VALIDAR

Pesquise por `VALIDAR COM A EQUIPA` e `VALIDAÇÃO JURÍDICA PENDENTE` no código.

**Equipe comercial / operação**
- Pontuação quente/frio de **todas** as LPs (`temperatura` em cada configuração).
- Situação em Portugal: a regra "entrou sem visto + sem título → Plano de Regresso e Reentrada Legal (🔴)"; o título **já vencido** tratado como 🔴 (não estava no brief).
- Carta: prazos e documentos da troca, o que fazer com carta vencida, categorias aceites e documento de residência aceite. Hoje a configuração só identifica a situação e não afirma nenhum requisito.
- Visto: faixas de renda para D7/D8 (dependem do salário mínimo e devem ser revistas todos os anos) e o critério do D3 (formação + proposta).
- Decidir `KOMMO_ENVIAR_FRIOS` e se o lead frio deve receber o PDF também por e-mail.

**Advogado parceiro (antes de publicar)**
- Nacionalidade: todas as regras e cores, e os placeholders em `PRAZOS_NACIONALIDADE`. Nenhum prazo legal fixo aparece no texto.
- Nacionalidade parada: o critério dos 2 anos (vem do título pedido no brief), os nomes das fases do IRN e os placeholders `ADVOGADO.nome` e `ADVOGADO.cedula`, que formam o rodapé "Serviço jurídico prestado por …, com apoio da SEVEN".
