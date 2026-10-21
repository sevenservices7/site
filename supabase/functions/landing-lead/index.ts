import { preflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { createKommoLead, updateKommoLead } from '../_shared/kommo.ts';
import { verifyTurnstile } from '../_shared/turnstile.ts';

// Landing pages de diagnóstico (quiz) — tabela public.landing_leads.
//  - action "start": etapa 1 (nome, WhatsApp, e-mail opcional, consentimento RGPD, UTMs). O lead nasce aqui.
//  - action "update": respostas até agora + ultima_etapa (quem desiste a meio fica registado).
//  - action "complete": resultado (semáforo, serviço, temperatura quente/frio, high ticket).
//  - action "newsletter": lead frio pediu para receber conteúdos por e-mail.
// "update", "complete" e "newsletter" exigem o token devolvido pelo "start".
//
// Kommo: desligado por padrão (KOMMO_ENABLED=false). Quando ligado, cria o lead na etapa 1 com a etiqueta
// da LP e atualiza com o resultado no fim. KOMMO_ENVIAR_FRIOS=false → só envia ao Kommo os leads que
// concluem como quentes (os outros ficam só no Supabase).
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const opt = (v: unknown, max = 300) => str(v, max) || null;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : null);
const flag = (k: string, def: boolean) => { const v = (Deno.env.get(k) || '').toLowerCase(); return v ? v === 'true' : def; };
const kommoOn = () => flag('KOMMO_ENABLED', false);
const enviarFrios = () => flag('KOMMO_ENVIAR_FRIOS', true);

/** Respostas do quiz: só chaves e valores curtos (ids de opção), no máximo 40. */
function respostas(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
    if (/^[a-z0-9_]{1,40}$/.test(k) && typeof val === 'string') out[k] = val.slice(0, 60);
  }
  return out;
}

async function findLead(sb: any, body: any) {
  const id = str(body.id, 40), token = str(body.token, 40);
  if (!/^[0-9a-f-]{36}$/.test(id) || !token) return null;
  const { data } = await sb.from('landing_leads').select('*').eq('id', id).eq('token', token).single();
  return data;
}

const TAG = { incompleto: 'LP - Incompleto', quente: 'LP - Quente', frio: 'LP - Frio', highTicket: 'High ticket' };
const tagLanding = (slug: string) => `LP - ${slug}`;
const tagCor = (cor: string) => `LP - ${cor[0].toUpperCase()}${cor.slice(1)}`;

async function kommoCreate(sb: any, lead: any, tags: string[]): Promise<number | undefined> {
  try {
    const { lead_id } = await createKommoLead({
      name: lead.nome, email: lead.email || '', phone: lead.whatsapp, language: 'pt',
      source: `lp-${lead.landing}`, whatsapp_consent: lead.consentimento_rgpd === true, tags,
    });
    if (lead_id) await sb.from('landing_leads').update({ kommo_lead_id: lead_id, kommo_error: null }).eq('id', lead.id);
    return lead_id;
  } catch (e) {
    await sb.from('landing_leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', lead.id);
  }
}

function nota(lead: any): string {
  const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map((k) => lead[k] && `${k}=${lead[k]}`).filter(Boolean).join(' · ');
  return [
    `Diagnóstico: ${lead.landing} (variante ${lead.variante}) · Código ${lead.codigo_curto}`,
    `Temperatura: ${lead.temperatura}${lead.high_ticket ? ' · HIGH TICKET' : ''}`,
    lead.resumo || '',
    utm ? `\nCampanha: ${utm}` : '',
  ].join('\n').slice(0, 8000);
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
  try {
    const body = await req.json();
    if (body.company) return json({ ok: true, id: crypto.randomUUID(), token: 'x', codigo: '000000' }, 200, origin); // honeypot
    const sb = adminClient();

    if (body.action === 'start') {
      const nome = str(body.nome, 120), whatsapp = str(body.whatsapp, 25), email = str(body.email, 160);
      const landing = str(body.landing, 60);
      if (!/^[a-z0-9-]{3,60}$/.test(landing) || nome.length < 2 || !/^\+\d{1,4} \d{6,15}$/.test(whatsapp)) return json({ error: 'missing_fields' }, 400, origin);
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'invalid_email' }, 400, origin);
      // RGPD: sem consentimento explícito não gravamos nada.
      if (body.consentimento !== true) return json({ error: 'consent_required' }, 400, origin);
      const human = await verifyTurnstile(body.turnstile_token, req.headers.get('x-forwarded-for'));
      if (!human) return json({ error: 'turnstile_failed' }, 400, origin);
      const { data: lead, error } = await sb.from('landing_leads').insert({
        landing, variante: oneOf(body.variante, ['a', 'b'] as const) ?? 'a',
        nome, whatsapp, email: email || null, consentimento_rgpd: true, consentimento_rgpd_em: new Date().toISOString(),
        utm_source: opt(body.utm_source), utm_medium: opt(body.utm_medium), utm_campaign: opt(body.utm_campaign),
        utm_content: opt(body.utm_content), utm_term: opt(body.utm_term), fbclid: opt(body.fbclid, 500),
        referrer: opt(body.referrer), user_agent: opt(req.headers.get('user-agent'), 400),
      }).select('*').single();
      if (error) throw error;
      if (kommoOn() && enviarFrios()) await kommoCreate(sb, lead, [tagLanding(landing), TAG.incompleto]);
      return json({ ok: true, id: lead.id, token: lead.token, codigo: lead.codigo_curto }, 200, origin);
    }

    if (body.action === 'update') {
      const cur = await findLead(sb, body);
      if (!cur) return json({ error: 'not_found' }, 404, origin);
      if (cur.concluido) return json({ ok: true }, 200, origin);
      const { error } = await sb.from('landing_leads').update({
        respostas: respostas(body.respostas), ultima_etapa: str(body.ultima_etapa, 40) || cur.ultima_etapa,
      }).eq('id', cur.id);
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    if (body.action === 'complete') {
      const cur = await findLead(sb, body);
      if (!cur) return json({ error: 'not_found' }, 404, origin);
      const cor = oneOf(body.resultado_cor, ['verde', 'amarelo', 'vermelho'] as const);
      const temperatura = oneOf(body.temperatura, ['quente', 'frio'] as const);
      if (!cor || !temperatura) return json({ error: 'missing_fields' }, 400, origin);
      const tambem = Array.isArray(body.servicos_tambem) ? body.servicos_tambem.filter((s: unknown) => typeof s === 'string').slice(0, 10).map((s: string) => s.slice(0, 120)) : [];
      const now = new Date().toISOString();
      const { data: lead, error } = await sb.from('landing_leads').update({
        respostas: respostas(body.respostas), ultima_etapa: 'resultado', concluido: true, concluido_em: cur.concluido_em || now,
        resultado_cor: cor, resultado_id: str(body.resultado_id, 60) || null, servico_recomendado: str(body.servico_recomendado, 160) || null,
        servicos_tambem: tambem, temperatura, high_ticket: body.high_ticket === true, resumo: str(body.resumo, 6000) || null,
      }).eq('id', cur.id).select('*').single();
      if (error) throw error;

      if (kommoOn() && !cur.concluido) {
        const tags = [TAG[temperatura], tagCor(cor), ...(lead.high_ticket ? [TAG.highTicket] : [])];
        try {
          let kid = lead.kommo_lead_id;
          if (!kid && (temperatura === 'quente' || enviarFrios())) kid = await kommoCreate(sb, lead, [tagLanding(lead.landing), ...tags]);
          if (kid) await updateKommoLead(kid, nota(lead), tags, [TAG.incompleto]);
        } catch (e) { await sb.from('landing_leads').update({ kommo_error: String(e).slice(0, 500) }).eq('id', lead.id); }
      }
      return json({ ok: true }, 200, origin);
    }

    if (body.action === 'newsletter') {
      const cur = await findLead(sb, body);
      if (!cur) return json({ error: 'not_found' }, 404, origin);
      const email = str(body.email, 160);
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'invalid_email' }, 400, origin);
      const { error } = await sb.from('landing_leads').update({
        email: cur.email || email, newsletter_optin: true, newsletter_optin_em: new Date().toISOString(),
      }).eq('id', cur.id);
      if (error) throw error;
      // Lista de e-mails (Resend Audiences), se configurada. Sem audiência, o pedido fica só na tabela.
      const key = Deno.env.get('RESEND_API_KEY'), audience = Deno.env.get('RESEND_AUDIENCE_ID');
      if (key && audience) {
        const [first, ...rest] = String(cur.nome).split(/\s+/);
        await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, first_name: first, last_name: rest.join(' '), unsubscribed: false }),
        }).catch((e) => console.error('resend audience', e));
      }
      return json({ ok: true }, 200, origin);
    }

    return json({ error: 'bad_action' }, 400, origin);
  } catch (e) {
    console.error('landing-lead', e);
    return json({ error: 'internal_error' }, 500, origin);
  }
});
