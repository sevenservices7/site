# HANDOFF — Publicação do site Seven Services

> Para um chat do Claude Code **com acesso ao repo de publicação** (`sevenservices7/website`
> ou `sevenservices7.github.io`). Esta sessão estava restrita a `sevenservices7/backoffice` e
> por isso não conseguiu criar/escrever no repo do site. Tudo o resto já está feito.

## 1. O que é / estado atual
Site institucional público novo da **Seven Services** (assessoria/consultoria a imigrantes em
Portugal), multi-idioma **PT/EN/ES**, construído em **Astro** (estático). Já implementa o
**design system da marca** (handoff do Claude Design): fonte **Bai Jamjuree** auto-hospedada,
cores navy/dourado, hero "Legalização *sem rodeios.*", "Como funciona", testemunho, navbar/rodapé
navy, catálogo real de 142 serviços, unidades, equipa, carrinho/checkout e agendamento.

**Falta apenas PUBLICAR** para ficar visível em `sevens.services` e `sevenservicess.com`.

## 2. Onde está o código
- Repo do código: **`sevenservices7/backoffice`** (é **público**), branch
  **`claude/beautiful-galileo-q0hlrk`**, pasta **`/site`** (projeto Astro isolado).
- Build local: `cd site && npm ci && npm run build` → saída em `site/dist` (42 páginas).
- O `prebuild` copia `../assets` (logos partilhados) para `site/public/assets`.
- Backoffice antigo continua em `index.html` (raiz) → GitHub Pages `sevenservices.pro` (NÃO mexer).

## 3. Backend Supabase (projeto PRÓPRIO do site, separado do backoffice)
- Projeto: **`ywywcffulifkwbllgnts`** — URL `https://ywywcffulifkwbllgnts.supabase.co`
- Publishable key (pública): `sb_publishable_qJMesIhZLiphEawYv1YqaA_dMy29YUm`
- Migrations já aplicadas: `offices`(3 unidades reais), `team`(4), `services`(142, catálogo real
  com preços c/IVA), `orders/order_items/bookings/payments` + RLS (leitura pública; comércio só
  service role). Ficheiros em `backoffice:/supabase/migrations/`.
- 5 **Edge Functions** já publicadas (v2): `create-checkout-session`, `stripe-webhook`,
  `create-booking`, `get-availability`, `kommo-lead` (Stripe + Kommo + Google Calendar + Resend +
  Turnstile, tudo guardado por env). Faltam os **secrets** (ver §7).

## 4. TAREFA IMEDIATA — publicar no GitHub Pages
Recomendado: **renomear o repo para `sevenservices7.github.io`** (user-site → serve na raiz, dá
preview imediato em `https://sevenservices7.github.io`, sem DNS, e fica limpo para domínios).
Se mantiver `website` (repo de projeto), serve em `/website/` e quebra caminhos absolutos — nesse
caso é obrigatório usar domínio próprio na raiz (CNAME) e não há preview github.io.

Passos:
1. Repo de publicação **Public** (Settings → General). **Pages 403 = repo privado.**
2. **Settings → Pages → Source = GitHub Actions.**
3. Adicionar `.github/workflows/deploy.yml` (conteúdo no §5). Ao fazer commit, corre e publica.
4. Verificar `https://sevenservices7.github.io` (hero "sem rodeios", unidades Albufeira/Faro/Porto,
   serviços com preços, "Como funciona", testemunho, rodapé navy).

## 5. Workflow de deploy (colar em `.github/workflows/deploy.yml` do repo de publicação)
```yaml
name: Deploy Seven Services site to Pages
on:
  workflow_dispatch:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: sevenservices7/backoffice
          ref: claude/beautiful-galileo-q0hlrk   # mudar p/ 'main' após merge
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: site/package-lock.json }
      - run: npm ci
        working-directory: site
      - run: npm run build
        working-directory: site
        env:
          PUBLIC_SUPABASE_URL: https://ywywcffulifkwbllgnts.supabase.co
          PUBLIC_SUPABASE_ANON_KEY: sb_publishable_qJMesIhZLiphEawYv1YqaA_dMy29YUm
      # Domínio próprio (ativar quando o DNS estiver pronto — ver §6):
      # - run: echo "sevenservicess.com" > site/dist/CNAME
      - uses: actions/upload-pages-artifact@v3
        with: { path: site/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 6. Domínios + DNS (os dois devem servir)
- GitHub Pages aceita **1 domínio custom por repo** (CNAME). Definir um canónico e o outro
  redireciona (forwarding no registrador). Para os dois a sério sem redirect → Cloudflare Pages.
- Sugestão: começar por **`sevenservicess.com`** (não perturba o `sevens.services` antigo nem o
  email). DNS no GoDaddy:
  - Apex `sevenservicess.com`: 4 registos **A** → `185.199.108.153`, `185.199.109.153`,
    `185.199.110.153`, `185.199.111.153`
  - `www`: **CNAME** → `sevenservices7.github.io`
  - (Email MX do `sevenservicess.com` fica intacto.)
- Depois `sevens.services` igual (quando quiserem trocar o site antigo).
- Ativar o passo CNAME no workflow (§5) com o domínio canónico escolhido.

## 7. Pendências (depois de publicar)
- **Secrets das Edge Functions** (Supabase → projeto `ywywcffulifkwbllgnts`):
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `KOMMO_SUBDOMAIN`, `KOMMO_LONG_LIVED_TOKEN`,
  `KOMMO_PIPELINE_ID`, `KOMMO_STATUS_ID`, `KOMMO_FIELD_*`, `SITE_URL`, `SITE_ORIGIN`
  (e opcionais `GOOGLE_SA_JSON`/`GOOGLE_CALENDAR_ID`, `RESEND_API_KEY`, `TURNSTILE_*`).
  Webhook Stripe → `https://ywywcffulifkwbllgnts.supabase.co/functions/v1/stripe-webhook`
  (eventos: checkout.session.completed, async_payment_succeeded/failed, expired).
- **Fotos** dos coordenadores (Gabriela/Albufeira, Dayane/Faro): subir a um bucket Storage do
  projeto do site e gravar em `team.photo_url` (não foram enviadas como ficheiro ainda).
- Testar **checkout** (cartão/MB Way/Multibanco) e **lead Kommo** ponta a ponta.

## 8. Notas
- Detalhes de deploy/secret em `backoffice:/site/DEPLOY.md` e `backoffice:/supabase/README.md`.
- Não commitar `site/node_modules`, `site/dist`, `site/public/assets` (gitignored).
- A publishable key do Supabase é pública por design (RLS protege o que importa).
