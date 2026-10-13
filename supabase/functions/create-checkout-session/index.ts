import { preflight, json } from '../_shared/cors.ts';
import { adminClient, stripeClient, checkoutUrls } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400, origin);
    const { mode, locale = 'pt' } = body;
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
      const { data: booking, error } = await sb.from('bookings').select('id,amount,service_code,language,slot_start,status').eq('id', body.booking_id).single();
      if (error || !booking) return json({ error: 'booking_not_found' }, 404, origin);
      if (booking.status !== 'pending' || !Number.isFinite(Date.parse(booking.slot_start)) || Date.parse(booking.slot_start) <= Date.now()) return json({ error: 'booking_not_payable' }, 409, origin);
      if (!Number.isFinite(Number(booking.amount)) || Number(booking.amount) <= 0) return json({ error: 'invalid_booking_amount' }, 409, origin);
      lineItems = [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(Number(booking.amount) * 100), product_data: { name: `Consultoria (${booking.language})` } } }];
      metadata = { booking_id: booking.id };
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
    }, metadata.booking_id ? { idempotencyKey: `booking-checkout-${metadata.booking_id}` } : undefined);
    if (!session.url) throw new Error('missing_checkout_url');
    if (metadata.order_id) await sb.from('orders').update({ stripe_session_id: session.id }).eq('id', metadata.order_id);
    if (metadata.booking_id) {
      const { error } = await sb.from('bookings').update({ stripe_session_id: session.id }).eq('id', metadata.booking_id);
      if (error) throw error;
    }
    return json({ url: session.url }, 200, origin);
  } catch (e) {
    console.error('create-checkout-session', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
