import Stripe from 'npm:stripe@17';
import { adminClient, stripeClient } from '../_shared/clients.ts';
import { createKommoLead, markKommoLeadWon, updateKommoLead, createKommoTask, SITE_STAGE, KOMMO_USERS, KOMMO_TASK } from '../_shared/kommo.ts';
import { createCalendarEvent } from '../_shared/google.ts';
import { sendEmail, orderEmail, bookingEmail } from '../_shared/email.ts';

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, webhookSecret);
  } catch (e) {
    console.error('webhook signature', e);
    return new Response('invalid_signature', { status: 400 });
  }
  const sb = adminClient();
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;
        await fulfill(sb, session);
        break;
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await markFailed(sb, session);
        break;
      }
    }
  } catch (e) {
    console.error('fulfillment', e);
  }
  return new Response('ok', { status: 200 });
});

async function fulfill(sb: any, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  const bookingId = session.metadata?.booking_id;
  const pm = session.payment_method_types?.[0] || '';
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (orderId) {
    const { data: order } = await sb.from('orders').select('*').eq('id', orderId).single();
    if (!order || order.status === 'paid') return;
    await sb.from('orders').update({ status: 'paid', stripe_payment_intent: intent }).eq('id', orderId);
    await sb.from('payments').insert({ order_id: orderId, provider: 'stripe', stripe_session_id: session.id, stripe_payment_intent: intent, payment_method: pm, amount: order.amount_total, status: 'succeeded', raw_event: { id: session.id } });
    // Dados do cliente: usar os da order (checkout do site) e, em fallback, os
    // recolhidos pelo Stripe (link WhatsApp, onde a order nasce vazia).
    const cd = session.customer_details;
    const email = order.customer_email || cd?.email || '';
    const kommoLeadId = session.metadata?.kommo_lead_id;
    if (kommoLeadId) {
      // Fluxo Kommo: o link saiu de um lead existente → marcar venda ganha (sem criar novo).
      try { await markKommoLeadWon(Number(kommoLeadId)); await sb.from('orders').update({ kommo_lead_id: Number(kommoLeadId) }).eq('id', orderId); }
      catch (e) { console.error('kommo won', e); }
    } else {
      // Fluxo site: deduplicar contacto e criar lead já como venda ganha.
      await tryKommo(sb, 'orders', orderId, {
        name: order.customer_name || cd?.name || 'Cliente',
        email,
        phone: order.customer_phone || cd?.phone || '',
        nif: order.customer_nif || customField(session, 'nif'),
        unit_slug: order.unit_slug, language: order.locale, source: 'website-checkout', won: true, tags: [SITE_STAGE.pago], price: order.amount_total, paid: true,
      });
    }
    if (email) { const m = orderEmail(order.locale || 'pt', order.amount_total); await sendEmail(email, m.subject, m.html).catch(() => {}); }
  } else if (bookingId) {
    const { data: booking } = await sb.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking || booking.status === 'confirmed') return;
    let calendarEventId: string | null = null;
    try {
      calendarEventId = await createCalendarEvent({ summary: `Consulta ${({ imigratoria: 'imigratória', contabil: 'contábil', juridica: 'jurídica' } as Record<string, string>)[booking.consult_type] ?? ''} ${booking.language?.toUpperCase?.() || ''} — ${booking.customer_name}`.replace(/\s+/g, ' '), description: `Seven Services · ${booking.unit_slug || ''}`.trim(), start: booking.slot_start, end: booking.slot_end, attendeeEmail: booking.customer_email });
    } catch (e) { console.error('calendar event', e); }
    await sb.from('bookings').update({ status: 'confirmed', stripe_payment_intent: intent, calendar_event_id: calendarEventId }).eq('id', bookingId);
    await sb.from('payments').insert({ booking_id: bookingId, provider: 'stripe', stripe_session_id: session.id, stripe_payment_intent: intent, payment_method: pm, amount: booking.amount, status: 'succeeded', raw_event: { id: session.id } });
    // Consultoria paga: venda ganha em Canais digitais (a automação do Kommo segue a partir daí),
    // responsável Ana Kathlyn, tarefa no horário marcado e nota interna de "agendamento já pago".
    const kommoId = await tryKommo(sb, 'bookings', bookingId, { name: booking.customer_name, email: booking.customer_email, phone: booking.customer_phone, unit_slug: booking.unit_slug, language: booking.language, service_code: booking.consult_type ? `CONSULT-${String(booking.consult_type).toUpperCase()}` : booking.service_code, source: 'website-booking', whatsapp_consent: booking.whatsapp_consent === true, tags: [SITE_STAGE.consultoria], won: true, price: booking.amount, paid: true, responsible_user_id: KOMMO_USERS.anaKathlyn, next_appointment: booking.slot_start, juridico_consultoria: true });
    if (kommoId) {
      const area = ({ imigratoria: 'imigratória', contabil: 'contábil', juridica: 'jurídica' } as Record<string, string>)[booking.consult_type] ?? '';
      const when = new Date(booking.slot_start).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' });
      const info = `Consultoria ${booking.unit_slug ? 'Presencial' : 'Online'} - Paga\nÁrea: ${area || '—'} · Idioma: ${String(booking.language || 'pt').toUpperCase()} · €${Number(booking.amount).toFixed(2)} pagos pelo site\nHorário: ${when} (Lisboa)\nCliente: ${booking.customer_name} · ${booking.customer_phone || '—'} · ${booking.customer_email}`.replace(/ {2,}/g, ' ');
      await createKommoTask(kommoId, { text: info, at: booking.slot_start, typeId: KOMMO_TASK.consultoria, responsibleUserId: KOMMO_USERS.anaKathlyn }).catch((e) => console.error('kommo task', e));
      await updateKommoLead(kommoId, `Agendamento já pago pelo site.\n${info}`, []).catch((e) => console.error('kommo note', e));
    }
    if (booking.customer_email) { const m = bookingEmail(booking.language || 'pt', booking.slot_start); await sendEmail(booking.customer_email, m.subject, m.html).catch(() => {}); }
  }
}

function customField(session: Stripe.Checkout.Session, key: string): string {
  const f = (session.custom_fields || []).find((x: any) => x.key === key);
  return (f as any)?.text?.value || '';
}

async function tryKommo(sb: any, table: string, id: string, lead: any): Promise<number | undefined> {
  try {
    const { lead_id } = await createKommoLead(lead);
    if (lead_id) await sb.from(table).update({ kommo_lead_id: lead_id }).eq('id', id);
    return lead_id;
  } catch (e) {
    console.error('kommo from webhook', e);
  }
}

async function markFailed(sb: any, session: Stripe.Checkout.Session) {
  const status = session.status === 'expired' ? 'cancelled' : 'failed';
  if (session.metadata?.order_id) await sb.from('orders').update({ status }).eq('id', session.metadata.order_id).neq('status', 'paid');
  if (session.metadata?.booking_id) await sb.from('bookings').update({ status }).eq('id', session.metadata.booking_id).neq('status', 'confirmed');
}
