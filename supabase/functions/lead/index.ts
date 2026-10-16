import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { createKommoLead, updateKommoLead } from '../_shared/kommo.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { sendEmail } from '../_shared/email.ts';
import { leadSummary, esc, TOPICS, URGENCY, LOCATION, CONSULTED, CONTACT } from '../_shared/lead-copy.ts';

// Formulário "Falar com especialista" em etapas:
//  - action "start": etapa 1 (nome, WhatsApp, e-mail, autorização). Grava já como lead parcial e avisa a equipa,
//    para não perder quem desiste no meio.
//  - action "complete": restantes respostas (assunto, urgência, ...). Exige o token devolvido no "start".
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = (v: unknown, allowed: Record<string, string>) => { const s = str(v, 40); return s in allowed ? s : null; };

async function notifyTeam(subject: string, lead: any) {
  const to = Deno.env.get('LEAD_NOTIFY_EMAIL') || 'contato@seveneu.com';
  const html = `<pre style="font:14px/1.6 system-ui,sans-serif;white-space:pre-wrap">${esc(leadSummary(lead))}</pre>`;
  return sendEmail(to, subject, html);
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json();
    if (body.company) return json({ ok: true }, 200, origin); // honeypot
    const sb = adminClient();

    if (body.action === 'start') {
      const name = str(body.name), email = str(body.email), phone = str(body.phone, 40);
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || phone.replace(/\D/g, '').length < 6) return json({ error: 'missing_fields' }, 400, origin);
      const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
      if (!human) return json({ error: 'turnstile_failed' }, 400, origin);
      const consent = body.consent === true;
      const now = new Date().toISOString();
      const { data: lead, error } = await sb.from('leads').insert({
        status: 'partial', name, email, phone, source: 'website-prequal',
        whatsapp_consent: consent, whatsapp_consent_at: consent ? now : null, email_consent: consent,
        language: str(body.language, 5) || 'pt', site_lang: str(body.site_lang, 5) || 'pt', page: str(body.page, 300) || null,
      }).select('*').single();
      if (error) throw error;
      // Kommo (melhor esforço): lead marcado como formulário incompleto.
      try {
        const { lead_id } = await createKommoLead({ name, email, phone, language: lead.language, source: 'website-prequal', whatsapp_consent: consent });
        if (lead_id) { await sb.from('leads').update({ kommo_lead_id: lead_id }).eq('id', lead.id); await updateKommoLead(lead_id, '', ['formulario-incompleto']).catch(() => {}); }
      } catch (e) { await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', lead.id); }
      if (await notifyTeam(`Novo contato (formulário em andamento) — ${name}`, lead)) await sb.from('leads').update({ team_notified_at: now }).eq('id', lead.id);
      return json({ ok: true, lead_id: lead.id, token: lead.token }, 200, origin);
    }

    if (body.action === 'complete') {
      const id = Number(body.lead_id), token = str(body.token, 40);
      if (!id || !token) return json({ error: 'missing_fields' }, 400, origin);
      const { data: cur } = await sb.from('leads').select('*').eq('id', id).eq('token', token).single();
      if (!cur) return json({ error: 'not_found' }, 404, origin);
      const patch = {
        status: 'complete', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        topic: pick(body.topic, TOPICS), urgency: pick(body.urgency, URGENCY), location: pick(body.location, LOCATION),
        consulted_others: pick(body.consulted_others, CONSULTED), preferred_contact: pick(body.preferred_contact, CONTACT),
        message: str(body.message, 4000) || null, unit_slug: str(body.unit_slug, 40) || null,
        language: str(body.language, 5) || cur.language,
      };
      const { data: lead, error } = await sb.from('leads').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      try {
        if (lead.kommo_lead_id) await updateKommoLead(lead.kommo_lead_id, leadSummary(lead), ['pre-qualificado']);
      } catch (e) { await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', id); }
      const urgent = lead.urgency === 'urgente' ? '[URGENTE] ' : '';
      await notifyTeam(`${urgent}Pré-qualificação concluída — ${lead.name}`, lead);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: 'bad_action' }, 400, origin);
  } catch (e) {
    console.error('lead', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
