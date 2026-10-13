import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { createKommoLead } from '../_shared/kommo.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { sendEmail } from '../_shared/email.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json();
    if (body.company) return json({ ok: true }, 200, origin);
    if (!body.name || !body.email || !body.phone) return json({ error: 'missing_fields' }, 400, origin);
    const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
    if (!human) return json({ error: 'turnstile_failed' }, 400, origin);

    const consent = body.whatsapp_consent === true;
    const lead = {
      name: String(body.name).slice(0, 200), email: String(body.email).slice(0, 200), phone: String(body.phone).slice(0, 40),
      unit_slug: body.unit_slug ? String(body.unit_slug) : undefined, language: body.language ? String(body.language) : 'pt',
      service_code: body.service_code ? String(body.service_code) : undefined, message: body.message ? String(body.message).slice(0, 4000) : undefined,
      source: 'website', whatsapp_consent: consent,
    };

    // 1) Grava sempre o pedido: nenhum lead se perde, mesmo se o Kommo falhar.
    const sb = adminClient();
    const { data: row, error } = await sb.from('leads').insert({
      name: lead.name, email: lead.email, phone: lead.phone, unit_slug: lead.unit_slug ?? null, language: lead.language,
      service_code: lead.service_code ?? null, message: lead.message ?? null, source: lead.source,
      whatsapp_consent: consent, whatsapp_consent_at: consent ? new Date().toISOString() : null,
    }).select('id').single();
    if (error) throw error;

    // 2) Kommo (melhor esforço).
    let kommoId: number | undefined;
    try {
      kommoId = (await createKommoLead(lead)).lead_id;
      if (kommoId) await sb.from('leads').update({ kommo_lead_id: kommoId }).eq('id', row.id);
    } catch (e) {
      console.error('kommo-lead kommo', e);
      await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', row.id);
    }

    // 3) Aviso por e-mail para a equipa (se o Resend estiver configurado).
    const to = Deno.env.get('LEAD_NOTIFY_EMAIL');
    if (to) {
      const html = `<p><b>Novo pedido pelo site</b></p><p>Nome: ${esc(lead.name)}<br>WhatsApp: ${esc(lead.phone)} (autorizou contato: ${consent ? 'sim' : 'não'})<br>E-mail: ${esc(lead.email)}<br>Unidade: ${esc(lead.unit_slug || '—')}<br>Idioma: ${esc(lead.language)}</p><p>${esc(lead.message || '')}</p>`;
      await sendEmail(to, `Novo pedido no site — ${lead.name}`, html).catch(() => {});
    }

    return json({ ok: true, lead_id: kommoId }, 200, origin);
  } catch (e) {
    console.error('kommo-lead', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
