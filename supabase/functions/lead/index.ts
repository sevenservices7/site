import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { createKommoLead, updateKommoLead, SITE_STAGE } from '../_shared/kommo.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';
import { sendEmail } from '../_shared/email.ts';
import { leadSummary, esc, TOPICS, URGENCY, LOCATION, CONSULTED, CONTACT } from '../_shared/lead-copy.ts';

// Formulário "Falar com especialista" em etapas:
//  - action "start": nome e e-mail (+ autorização). Grava já como lead parcial e avisa a equipa,
//    para não perder quem desiste no meio.
//  - action "update": grava cada resposta seguinte (WhatsApp, assunto, urgência...) assim que a pessoa avança.
//  - action "complete": última resposta; marca o lead como completo. "update" e "complete" exigem o token do "start".
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = (v: unknown, allowed: Record<string, string>) => { const s = str(v, 40); return s in allowed ? s : null; };

// Só grava os campos que vieram na chamada (as respostas chegam uma a uma).
function answers(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const choice: [string, Record<string, string>][] = [['topic', TOPICS], ['urgency', URGENCY], ['location', LOCATION], ['consulted_others', CONSULTED], ['preferred_contact', CONTACT]];
  for (const [k, map] of choice) if (k in body) out[k] = pick(body[k], map);
  if ('message' in body) out.message = str(body.message, 4000) || null;
  if ('unit_slug' in body) out.unit_slug = str(body.unit_slug, 40) || null;
  if ('language' in body && str(body.language, 5)) out.language = str(body.language, 5);
  return out;
}

async function findLead(sb: any, body: any) {
  const id = Number(body.lead_id), token = str(body.token, 40);
  if (!id || !token) return null;
  const { data } = await sb.from('leads').select('*').eq('id', id).eq('token', token).single();
  return data;
}

// Kommo (melhor esforço). Criado quando há telefone, porque a deduplicação de contatos é pelo telefone.
async function syncKommo(sb: any, lead: any) {
  try {
    const { lead_id } = await createKommoLead({ name: lead.name, email: lead.email, phone: lead.phone || '', language: lead.language, source: 'website-prequal', whatsapp_consent: lead.whatsapp_consent === true, tags: [SITE_STAGE.incompleto] });
    if (lead_id) await sb.from('leads').update({ kommo_lead_id: lead_id }).eq('id', lead.id);
  } catch (e) { await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', lead.id); }
}

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
      // Basta nome e e-mail: o lead nasce aqui, mesmo que a pessoa não responda o resto.
      const name = str(body.name), email = str(body.email), phone = str(body.phone, 40);
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'missing_fields' }, 400, origin);
      const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
      if (!human) return json({ error: 'turnstile_failed' }, 400, origin);
      const consent = body.consent === true;
      const now = new Date().toISOString();
      const { data: lead, error } = await sb.from('leads').insert({
        status: 'partial', name, email, phone: phone || null, source: 'website-prequal',
        whatsapp_consent: consent, whatsapp_consent_at: consent ? now : null, email_consent: consent,
        language: str(body.language, 5) || 'pt', site_lang: str(body.site_lang, 5) || 'pt', page: str(body.page, 300) || null,
      }).select('*').single();
      if (error) throw error;
      if (phone) await syncKommo(sb, lead);
      if (await notifyTeam(`Novo contato (formulário em andamento) — ${name}`, lead)) await sb.from('leads').update({ team_notified_at: now }).eq('id', lead.id);
      return json({ ok: true, lead_id: lead.id, token: lead.token }, 200, origin);
    }

    if (body.action === 'update') {
      // Cada resposta do formulário é gravada assim que a pessoa avança.
      const cur = await findLead(sb, body);
      if (!cur) return json({ error: 'not_found' }, 404, origin);
      const patch: Record<string, unknown> = { ...answers(body), updated_at: new Date().toISOString() };
      if ('phone' in body) {
        const phone = str(body.phone, 40);
        if (phone.replace(/\D/g, '').length < 6) return json({ error: 'missing_fields' }, 400, origin);
        patch.phone = phone;
      }
      const { data: lead, error } = await sb.from('leads').update(patch).eq('id', cur.id).select('*').single();
      if (error) throw error;
      if (lead.phone && !lead.kommo_lead_id) await syncKommo(sb, lead);
      // Respondeu assunto e urgência: passa de "incompleto" para "pré-qualificado".
      else if (lead.kommo_lead_id && 'urgency' in body && lead.topic && lead.urgency) {
        await updateKommoLead(lead.kommo_lead_id, '', [SITE_STAGE.qualificado], [SITE_STAGE.incompleto]).catch(async (e) => { await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', lead.id); });
      }
      return json({ ok: true }, 200, origin);
    }

    if (body.action === 'complete') {
      const cur = await findLead(sb, body);
      if (!cur) return json({ error: 'not_found' }, 404, origin);
      const now = new Date().toISOString();
      const patch = { ...answers(body), status: 'complete', completed_at: now, updated_at: now };
      const { data: lead, error } = await sb.from('leads').update(patch).eq('id', cur.id).select('*').single();
      if (error) throw error;
      try {
        if (!lead.kommo_lead_id && lead.phone) await syncKommo(sb, lead);
        const { data: fresh } = await sb.from('leads').select('kommo_lead_id').eq('id', lead.id).single();
        if (fresh?.kommo_lead_id) await updateKommoLead(fresh.kommo_lead_id, leadSummary(lead), [SITE_STAGE.completo], [SITE_STAGE.incompleto, SITE_STAGE.qualificado]);
      } catch (e) { await sb.from('leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', lead.id); }
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
