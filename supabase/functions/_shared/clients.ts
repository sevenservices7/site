import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function stripeClient(): Stripe {
  return new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
}

// Uma conta Stripe por unidade (mesma empresa, IBAN de cada unidade): o dinheiro de cada uma não se mistura.
// Secrets: STRIPE_SECRET_KEY_<UNIDADE> e STRIPE_WEBHOOK_SECRET_<UNIDADE>. Sem chave da unidade, usa
// STRIPE_DEFAULT_UNIT e, por fim, a conta antiga (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).
export const STRIPE_UNITS = ['albufeira', 'faro', 'porto'] as const;
const envUnit = (prefix: string, unit: string) => Deno.env.get(`${prefix}_${unit.toUpperCase()}`) || '';

/** Unidade que recebe o pagamento: a pedida, se tiver conta configurada; senão a padrão; '' = conta antiga. */
export function paymentUnit(unit?: string | null): string {
  const u = String(unit || '').toLowerCase();
  if (u && envUnit('STRIPE_SECRET_KEY', u)) return u;
  const def = (Deno.env.get('STRIPE_DEFAULT_UNIT') || '').toLowerCase();
  if (def && envUnit('STRIPE_SECRET_KEY', def)) return def;
  return '';
}

export function stripeFor(unit: string): Stripe {
  const key = (unit && envUnit('STRIPE_SECRET_KEY', unit)) || Deno.env.get('STRIPE_SECRET_KEY')!;
  return new Stripe(key, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
}

/** Segredos de webhook configurados: [unidade, whsec]. '' = conta antiga. */
export function webhookSecrets(): [string, string][] {
  const list: [string, string][] = STRIPE_UNITS.map((u) => [u, envUnit('STRIPE_WEBHOOK_SECRET', u)] as [string, string]).filter(([, s]) => s);
  const legacy = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (legacy) list.push(['', legacy]);
  return list;
}
// Domínio público do site (o GitHub Pages só serve o CNAME seveneu.com).
// sevens.services é apenas o domínio de e-mail — se SITE_URL apontar para lá, ignora.
const rawSiteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/+$/, '');
export const SITE_URL = rawSiteUrl && !rawSiteUrl.includes('sevens.services') ? rawSiteUrl : 'https://seveneu.com';
export function checkoutUrls(locale: string): { success: string; cancel: string } {
  if (locale === 'en') return { success: `${SITE_URL}/en/checkout/success`, cancel: `${SITE_URL}/en/checkout/cancel` };
  if (locale === 'es') return { success: `${SITE_URL}/es/checkout/exito`, cancel: `${SITE_URL}/es/checkout/cancelado` };
  return { success: `${SITE_URL}/checkout/sucesso`, cancel: `${SITE_URL}/checkout/cancelado` };
}
