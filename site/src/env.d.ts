/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  /** Base URL das Supabase Edge Functions (functions/v1). Opcional. */
  readonly PUBLIC_FUNCTIONS_URL?: string;
  /** Site key do Cloudflare Turnstile (anti-spam) — opcional. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Meta Pixel (só carrega com consentimento de marketing). */
  readonly PUBLIC_META_PIXEL_ID?: string;
  /** LPs de diagnóstico: WhatsApp do comercial (só dígitos, com DDI). Vazio = WhatsApp principal do site. */
  readonly PUBLIC_DIAG_WHATSAPP?: string;
  /** LPs de diagnóstico: link de agenda opcional para leads quentes (recebe ?lead=CÓDIGO). Vazio = botão escondido. */
  readonly PUBLIC_DIAG_BOOKING_URL?: string;
  /** "true" gera também as LPs em rascunho (publicado: false), para revisão. Nunca no build de produção. */
  readonly PUBLIC_DIAG_PREVIEW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
