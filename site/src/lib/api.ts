// Wrappers para chamar as Supabase Edge Functions a partir do browser.
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from './config';
import type { CartItem } from './cart';

async function callFn<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${name} falhou (${res.status}): ${msg}`);
  }
  return (await res.json()) as T;
}

export interface CheckoutCustomer {
  name?: string;
  email?: string;
  phone?: string;
  nif?: string;
}

/** Cria a sessão de checkout do carrinho e devolve a URL hospedada do Stripe. */
export function createCartCheckout(input: {
  items: CartItem[];
  locale: string;
  customer?: CheckoutCustomer;
  unit_slug?: string;
}): Promise<{ url: string }> {
  return callFn('create-checkout-session', {
    mode: 'cart',
    items: input.items.map((i) => ({ service_code: i.service_code, quantity: i.quantity })),
    locale: input.locale,
    customer: input.customer,
    unit_slug: input.unit_slug,
  });
}

export function createBookingCheckout(booking_id: string, locale: string): Promise<{ url: string }> {
  return callFn('create-checkout-session', { mode: 'booking', booking_id, locale });
}

/**
 * Cria a sessão de checkout de um único serviço (link de pagamento para WhatsApp).
 * O preço é sempre resolvido no servidor a partir do `service_code` (nunca do URL).
 * `kommo_lead_id` opcional: quando o link é enviado a partir de um lead do Kommo,
 * o webhook marca esse lead como "venda ganha" em vez de criar um novo.
 */
export function createSingleCheckout(input: {
  service_code: string;
  quantity?: number;
  locale: string;
  kommo_lead_id?: string;
}): Promise<{ url: string }> {
  return callFn('create-checkout-session', {
    mode: 'single',
    service_code: input.service_code,
    quantity: input.quantity,
    locale: input.locale,
    kommo_lead_id: input.kommo_lead_id,
  });
}

export function createBooking(input: {
  language: string;
  service_code?: string;
  slot_start: string;
  whatsapp_consent?: boolean;
  consult_type?: string;
  slot_end: string;
  customer: { name: string; email: string; phone?: string };
  unit_slug?: string;
  notes?: string;
  turnstile_token?: string;
}): Promise<{ booking_id: string; amount: number }> {
  return callFn('create-booking', input);
}

export function getAvailability(input: {
  from: string;
  to: string;
  unit_slug?: string;
  language?: string;
}): Promise<{ slots: { start: string; end: string }[] }> {
  return callFn('get-availability', input);
}

export function sendLead(input: {
  name: string;
  email: string;
  phone: string;
  unit_slug?: string;
  language: string;
  service_code?: string;
  message?: string;
  whatsapp_consent?: boolean;
  turnstile_token?: string;
}): Promise<{ ok: boolean; lead_id?: number }> {
  return callFn('kommo-lead', { ...input, source: 'website' });
}

/** "Falar com especialista", etapa 1: grava o contato como lead parcial e devolve id + token. */
export function leadStart(input: {
  name: string; email: string; phone: string; consent: boolean;
  site_lang: string; language: string; page: string; turnstile_token?: string;
}): Promise<{ ok: boolean; lead_id: number; token: string }> {
  return callFn('lead', { action: 'start', ...input });
}

/** "Falar com especialista", etapas 2 e 3: completa a pré-qualificação do lead. */
export function leadComplete(input: {
  lead_id: number; token: string; topic: string; message: string; urgency: string; location: string;
  consulted_others: string; preferred_contact: string; unit_slug: string; language: string;
}): Promise<{ ok: boolean }> {
  return callFn('lead', { action: 'complete', ...input });
}

/** Página oculta da equipe: cobrança avulsa (serviço e valor livres), protegida por código. */
export function createCustomCheckout(input: {
  team_code: string; service: string; amount: string; locale: string;
  customer: { name: string; email?: string };
}): Promise<{ url: string }> {
  return callFn('create-checkout-session', { mode: 'custom', ...input });
}
