// Wrappers para chamar as Supabase Edge Functions a partir do browser.
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from './config';

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'ApiError';
  }
}

async function callFn<T>(name: string, body: unknown, timeoutMs?: number): Promise<T> {
  if (!FUNCTIONS_URL || !SUPABASE_ANON_KEY) throw new ApiError(400, 'api_not_configured');
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new ApiError(res.status, typeof error?.error === 'string' ? error.error : 'request_failed');
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface CheckoutCustomer {
  name?: string;
  email?: string;
  phone?: string;
  nif?: string;
}

/** Cria a sessão de checkout do carrinho e devolve a URL hospedada do Stripe. */
export function createCartCheckout(input: {
  items: { service_code: string; quantity: number }[];
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

export async function createBookingCheckout(booking_id: string, locale: string): Promise<{ url: string }> {
  const result = await callFn<{ url: string }>('create-checkout-session', { mode: 'booking', booking_id, locale }, 20000);
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('invalid_checkout_url');
  return { url: url.href };
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

export async function createBooking(input: {
  language: string;
  service_code?: string;
  slot_start: string;
  whatsapp_consent?: boolean;
  slot_end: string;
  customer: { name: string; email: string; phone?: string };
  unit_slug?: string;
  notes?: string;
  turnstile_token?: string;
}): Promise<{ booking_id: string; amount: number }> {
  const result = await callFn<{ booking_id: string; amount: number }>('create-booking', input, 20000);
  if (typeof result?.booking_id !== 'string' || !result.booking_id.trim()) throw new Error('invalid_booking_response');
  return result;
}

export function getAvailability(input: {
  from: string;
  to: string;
  unit_slug?: string;
  language?: string;
}): Promise<{ slots: { start: string; end: string }[] }> {
  return callFn('get-availability', input, 20000);
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
