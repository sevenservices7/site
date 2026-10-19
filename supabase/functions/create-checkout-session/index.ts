import { preflight, json } from '../_shared/cors.ts';
import { adminClient, stripeClient, checkoutUrls } from '../_shared/clients.ts';
import { sendEmail } from '../_shared/email.ts';

// E-mail com o link de pagamento gerado pela equipa (modo custom, quando há e-mail do cliente).
const PAY_MAIL: Record<string, { subject: string; hi: string; body: string; cta: string; note: string }> = {
  pt: { subject: 'Seu link de pagamento SEVEN', hi: 'Olá', body: 'Segue o link para pagar', cta: 'Pagar agora', note: 'O link é válido por 24 horas. Dúvidas? É só responder este e-mail.' },
  en: { subject: 'Your SEVEN payment link', hi: 'Hello', body: 'Here is the link to pay for', cta: 'Pay now', note: 'The link is valid for 24 hours. Questions? Just reply to this email.' },
  es: { subject: 'Tu enlace de pago SEVEN', hi: 'Hola', body: 'Aquí tienes el enlace para pagar', cta: 'Pagar ahora', note: 'El enlace es válido durante 24 horas. ¿Dudas? Responde a este correo.' },
  fr: { subject: 'Votre lien de paiement SEVEN', hi: 'Bonjour', body: 'Voici le lien pour régler', cta: 'Payer maintenant', note: 'Le lien est valable 24 heures. Des questions ? Répondez simplement à cet e-mail.' },
};
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function payMailHtml(locale: string, name: string, service: string, amount: number, url: string): string {
  const c = PAY_MAIL[locale] ?? PAY_MAIL.pt;
  const first = escHtml(name.split(/\s+/)[0] || '');
  return `<div style="font:16px/1.6 Arial,sans-serif;color:#01203F;max-width:560px">
<p>${c.hi}${first ? `, ${first}` : ''}!</p><p>${c.body} <b>${escHtml(service)}</b>: <b>€${amount.toFixed(2)}</b>.</p>
<p style="margin:28px 0"><a href="${url}" style="background:#D6C496;color:#01203F;padding:12px 22px;text-decoration:none;font-weight:bold;display:inline-block">${c.cta}</a></p>
<p style="color:#5b6b7f">${c.note}</p><p style="color:#5b6b7f">SEVEN · Clareza para ir além.</p></div>`;
}

const CONSULT_NAMES: Record<string, string> = { imigratoria: 'Consultoria imigratória', contabil: 'Consultoria contábil', juridica: 'Consultoria jurídica' };

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json();
    const { mode, locale = 'pt' } = body;
    // Página da equipe: confere só o código, antes de mostrar o formulário.
    if (mode === 'team-login') {
      const teamCode = Deno.env.get('TEAM_PAY_CODE');
      if (!teamCode || String(body.team_code || '') !== teamCode) return json({ error: 'forbidden' }, 403, origin);
      return json({ ok: true }, 200, origin);
    }
    const sb = adminClient();
    const stripe = stripeClient();
    const urls = checkoutUrls(locale);
    let lineItems: any[] = [];
    let metadata: Record<string, string> = {};
    // No modo "single" (link de pagamento para WhatsApp) os dados do cliente
    // não são pré-recolhidos, por isso pedimos ao Stripe para os recolher.
    let collectInStripe = false;
    if (mode === 'cart') {
      const items: { service_code: string; quantity: number }[] = body.items || [];
      if (!items.length) return json({ error: 'empty_cart' }, 400, origin);
      const codes = items.map((i) => i.service_code);
      const { data: services, error } = await sb.from('services').select('code,name,price,status').in('code', codes).eq('status', 'active');
      if (error) throw error;
      const byCode = new Map((services || []).map((s: any) => [s.code, s]));
      let amountTotal = 0;
      const orderItems: any[] = [];
      for (const it of items) {
        const svc = byCode.get(it.service_code);
        if (!svc || svc.price == null) continue;
        const qty = Math.max(1, Math.min(20, Number(it.quantity) || 1));
        amountTotal += Number(svc.price) * qty;
        lineItems.push({ quantity: qty, price_data: { currency: 'eur', unit_amount: Math.round(Number(svc.price) * 100), product_data: { name: svc.name } } });
        orderItems.push({ service_code: svc.code, name_snapshot: svc.name, unit_price: svc.price, quantity: qty });
      }
      if (!lineItems.length) return json({ error: 'no_valid_items' }, 400, origin);
      const { data: order, error: oErr } = await sb.from('orders').insert({ status: 'pending', amount_total: amountTotal, locale, unit_slug: body.unit_slug || '', customer_name: body.customer?.name || '', customer_email: body.customer?.email || '', customer_phone: body.customer?.phone || '', customer_nif: body.customer?.nif || '' }).select('id').single();
      if (oErr) throw oErr;
      await sb.from('order_items').insert(orderItems.map((oi) => ({ ...oi, order_id: order.id })));
      metadata = { order_id: order.id };
    } else if (mode === 'single') {
      // Link de pagamento de 1 serviço (ex.: enviado por WhatsApp). O preço é
      // sempre o da BD (nunca vem do URL). `kommo_lead_id` opcional encaminha o
      // webhook para marcar "venda ganha" no lead existente em vez de criar novo.
      const code = String(body.service_code || '');
      if (!code) return json({ error: 'missing_service' }, 400, origin);
      const { data: svc, error } = await sb.from('services').select('code,name,price,status').eq('code', code).eq('status', 'active').single();
      if (error || !svc || svc.price == null) return json({ error: 'service_not_found' }, 404, origin);
      const qty = Math.max(1, Math.min(20, Number(body.quantity) || 1));
      const amountTotal = Number(svc.price) * qty;
      lineItems = [{ quantity: qty, price_data: { currency: 'eur', unit_amount: Math.round(Number(svc.price) * 100), product_data: { name: svc.name } } }];
      const { data: order, error: oErr } = await sb.from('orders').insert({ status: 'pending', amount_total: amountTotal, locale, unit_slug: body.unit_slug || '' }).select('id').single();
      if (oErr) throw oErr;
      await sb.from('order_items').insert([{ order_id: order.id, service_code: svc.code, name_snapshot: svc.name, unit_price: svc.price, quantity: qty }]);
      metadata = { order_id: order.id };
      if (body.kommo_lead_id) metadata.kommo_lead_id = String(body.kommo_lead_id);
      collectInStripe = true;
    } else if (mode === 'booking') {
      const { data: booking, error } = await sb.from('bookings').select('id,amount,service_code,language,slot_start,consult_type').eq('id', body.booking_id).single();
      if (error || !booking) return json({ error: 'booking_not_found' }, 404, origin);
      lineItems = [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(Number(booking.amount) * 100), product_data: { name: `${CONSULT_NAMES[booking.consult_type as string] ?? 'Consultoria'} (${String(booking.language).toUpperCase()})` } } }];
      metadata = { booking_id: booking.id };
    } else if (mode === 'custom') {
      // Cobrança avulsa gerada pela equipa (página oculta /equipe-pagamento): serviço e valor livres,
      // protegida pelo código da equipa (secret TEAM_PAY_CODE). Sem código configurado, fica bloqueada.
      const teamCode = Deno.env.get('TEAM_PAY_CODE');
      if (!teamCode || String(body.team_code || '') !== teamCode) return json({ error: 'forbidden' }, 403, origin);
      const service = String(body.service || '').trim().slice(0, 200);
      const amount = Math.round(Number(String(body.amount || '').replace(',', '.')) * 100) / 100;
      const unit = String(body.unit_slug || '');
      if (!service || !(amount >= 1 && amount <= 20000) || !['albufeira', 'faro', 'porto'].includes(unit)) return json({ error: 'invalid_fields' }, 400, origin);
      const name = String(body.customer?.name || '').trim().slice(0, 200);
      lineItems = [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(amount * 100), product_data: { name: service } } }];
      const { data: order, error: oErr } = await sb.from('orders').insert({ status: 'pending', amount_total: amount, locale, unit_slug: unit, customer_name: name, customer_email: body.customer?.email || '', customer_phone: body.customer?.phone || '' }).select('id').single();
      if (oErr) throw oErr;
      await sb.from('order_items').insert([{ order_id: order.id, service_code: 'CUSTOM', name_snapshot: service, unit_price: amount, quantity: 1 }]);
      metadata = { order_id: order.id, source: 'team-link' };
      collectInStripe = true;
    } else {
      return json({ error: 'invalid_mode' }, 400, origin);
    }
    // Sem payment_method_types fixos: o Stripe mostra os métodos ativos no
    // Dashboard (cartão sempre; MB Way/Multibanco/Klarna quando ativados).
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      locale: locale as any,
      customer_email: body.customer?.email || undefined,
      success_url: `${urls.success}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: urls.cancel,
      metadata,
      // Link WhatsApp: recolher telemóvel + NIF no próprio Stripe (no carrinho
      // já foram recolhidos no site, por isso não voltamos a pedir).
      ...(collectInStripe ? {
        phone_number_collection: { enabled: true },
        custom_fields: [{ key: 'nif', label: { type: 'custom', custom: 'NIF (opcional)' }, type: 'text', optional: true }],
      } : {}),
    });
    if (metadata.order_id) await sb.from('orders').update({ stripe_session_id: session.id }).eq('id', metadata.order_id);
    if (metadata.booking_id) await sb.from('bookings').update({ stripe_session_id: session.id }).eq('id', metadata.booking_id);
    let emailed = false;
    const email = String(body.customer?.email || '').trim();
    if (mode === 'custom' && /^\S+@\S+\.\S+$/.test(email) && session.url) {
      const c = PAY_MAIL[locale] ?? PAY_MAIL.pt;
      const item = lineItems[0];
      emailed = await sendEmail(email, c.subject, payMailHtml(locale, String(body.customer?.name || ''), item.price_data.product_data.name, item.price_data.unit_amount / 100, session.url), { replyTo: Deno.env.get('LEAD_NOTIFY_EMAIL') || 'contato@seveneu.com' }).catch(() => false);
    }
    return json({ url: session.url, emailed }, 200, origin);
  } catch (e) {
    console.error('create-checkout-session', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
