import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { bookingInputError, normalizeCustomer } from '../_shared/booking.ts';
import { googleBusy } from '../_shared/google.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json().catch(() => null);
    const validation = bookingInputError(body, Date.now(), Number(Deno.env.get('CONSULT_SLOT_MINUTES') || 45));
    if (validation) return json({ error: validation }, 400, origin);
    const { language, slot_start, slot_end } = body;
    const customer = normalizeCustomer(body.customer);
    const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
    if (!human) return json({ error: 'turnstile_failed' }, 400, origin);
    const sb = adminClient();
    const serviceCode = body.service_code || 'CONSULT';
    const { data: svc, error: serviceError } = await sb.from('services').select('price').eq('code', serviceCode).eq('status', 'active').single();
    if (serviceError || !svc || !Number.isFinite(Number(svc.price)) || Number(svc.price) <= 0) return json({ error: 'service_unavailable' }, 503, origin);
    const amount = Number(svc.price);
    const { data: clash, error: clashError } = await sb.from('bookings').select('id').in('status', ['pending', 'paid', 'confirmed']).lt('slot_start', slot_end).gt('slot_end', slot_start).limit(1);
    if (clashError) throw clashError;
    const calendarBusy = await googleBusy(slot_start, slot_end);
    if (calendarBusy.some((interval) => Date.parse(interval.start) < Date.parse(slot_end) && Date.parse(interval.end) > Date.parse(slot_start))) return json({ error: 'slot_taken' }, 409, origin);
    if (clash && clash.length) return json({ error: 'slot_taken' }, 409, origin);
    const { data: booking, error } = await sb.from('bookings').insert({ status: 'pending', language, service_code: serviceCode, amount, unit_slug: body.unit_slug || '', slot_start, slot_end, customer_name: customer.name, customer_email: customer.email, customer_phone: customer.phone || '', notes: body.notes || '', whatsapp_consent: body.whatsapp_consent === true, whatsapp_consent_at: body.whatsapp_consent === true ? new Date().toISOString() : null }).select('id,amount').single();
    if (error) throw error;
    return json({ booking_id: booking.id, amount: booking.amount }, 200, origin);
  } catch (e) {
    console.error('create-booking', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
