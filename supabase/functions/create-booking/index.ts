import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json();
    const { language, slot_start, slot_end, customer } = body;
    if (!language || !slot_start || !slot_end || !customer?.name || !customer?.email) return json({ error: 'missing_fields' }, 400, origin);
    if (new Date(slot_start).getTime() < Date.now()) return json({ error: 'slot_in_past' }, 400, origin);
    const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
    if (!human) return json({ error: 'turnstile_failed' }, 400, origin);
    const sb = adminClient();
    const serviceCode = body.service_code || 'CONSULT';
    const { data: svc } = await sb.from('services').select('price').eq('code', serviceCode).single();
    const amount = svc?.price ?? 0;
    const { data: clash } = await sb.from('bookings').select('id').in('status', ['pending', 'paid', 'confirmed']).lt('slot_start', slot_end).gt('slot_end', slot_start).limit(1);
    if (clash && clash.length) return json({ error: 'slot_taken' }, 409, origin);
    const { data: booking, error } = await sb.from('bookings').insert({ status: 'pending', language, service_code: serviceCode, amount, unit_slug: body.unit_slug || '', slot_start, slot_end, customer_name: customer.name, customer_email: customer.email, customer_phone: customer.phone || '', notes: body.notes || '', whatsapp_consent: body.whatsapp_consent === true, whatsapp_consent_at: body.whatsapp_consent === true ? new Date().toISOString() : null }).select('id,amount').single();
    if (error) throw error;
    return json({ booking_id: booking.id, amount: booking.amount }, 200, origin);
  } catch (e) {
    console.error('create-booking', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
