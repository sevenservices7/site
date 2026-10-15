export interface LeadInput {
  name: string; email: string; phone: string;
  unit_slug?: string; language?: string; service_code?: string; message?: string; source?: string;
  nif?: string; won?: boolean;
  /** RGPD: autorizou contacto por WhatsApp (undefined = não perguntado, ex.: leads criados por outros fluxos). */
  whatsapp_consent?: boolean;
}
const TRANSPORT = Deno.env.get('KOMMO_TRANSPORT') || 'api';
function firstLast(full: string): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}
function wonStatusId(): number {
  return Number(Deno.env.get('KOMMO_WON_STATUS_ID') || 142) || 142;
}
function digits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

/**
 * Procura um contacto existente pelo telemóvel (compara os últimos 9 dígitos
 * para tolerar formatos diferentes). Devolve o id do contacto ou undefined.
 */
async function findContactIdByPhone(subdomain: string, token: string, phone: string): Promise<number | undefined> {
  const last9 = digits(phone).slice(-9);
  if (!last9) return undefined;
  const url = `https://${subdomain}.kommo.com/api/v4/contacts?query=${encodeURIComponent(last9)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok || r.status === 204) return undefined; // 204 = sem resultados
  const data = await r.json().catch(() => null);
  const contacts: any[] = data?._embedded?.contacts || [];
  for (const c of contacts) {
    const phones = (c.custom_fields_values || [])
      .filter((f: any) => f.field_code === 'PHONE')
      .flatMap((f: any) => (f.values || []).map((v: any) => v.value));
    if (phones.some((p: string) => digits(p).slice(-9) === last9)) return c.id;
  }
  return contacts[0]?.id;
}

export async function createKommoLead(lead: LeadInput): Promise<{ ok: boolean; lead_id?: number }> {
  if (TRANSPORT === 'zapier') {
    const hook = Deno.env.get('ZAPIER_KOMMO_HOOK_URL');
    if (!hook) throw new Error('ZAPIER_KOMMO_HOOK_URL nao configurado');
    const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead) });
    return { ok: r.ok };
  }
  const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
  const token = Deno.env.get('KOMMO_LONG_LIVED_TOKEN');
  if (!subdomain || !token) throw new Error('KOMMO_SUBDOMAIN/KOMMO_LONG_LIVED_TOKEN nao configurados');
  const pipelineId = Number(Deno.env.get('KOMMO_PIPELINE_ID') || 0) || undefined;
  const statusId = lead.won ? wonStatusId() : (Number(Deno.env.get('KOMMO_STATUS_ID') || 0) || undefined);
  const fId = (k: string) => Number(Deno.env.get(k) || 0) || undefined;
  const { first, last } = firstLast(lead.name);
  const leadCFV: any[] = [];
  const pushCF = (idEnv: string, value?: string) => { const id = fId(idEnv); if (id && value) leadCFV.push({ field_id: id, values: [{ value }] }); };
  pushCF('KOMMO_FIELD_UNIT', lead.unit_slug);
  pushCF('KOMMO_FIELD_LANGUAGE', lead.language);
  pushCF('KOMMO_FIELD_SERVICE', lead.service_code);
  pushCF('KOMMO_FIELD_SOURCE', lead.source || 'website');
  pushCF('KOMMO_FIELD_NIF', lead.nif);
  if (lead.whatsapp_consent !== undefined) pushCF('KOMMO_FIELD_WHATSAPP_CONSENT', lead.whatsapp_consent ? 'sim' : 'nao');
  const contactCFV: any[] = [];
  if (lead.phone) contactCFV.push({ field_code: 'PHONE', values: [{ enum_code: 'MOB', value: lead.phone }] });
  if (lead.email) contactCFV.push({ field_code: 'EMAIL', values: [{ enum_code: 'WORK', value: lead.email }] });
  const consentTag = lead.whatsapp_consent === undefined ? null : { name: lead.whatsapp_consent ? 'whatsapp:autorizado' : 'whatsapp:nao-autorizado' };
  const tags = [{ name: 'website' }, lead.unit_slug ? { name: `unidade:${lead.unit_slug}` } : null, lead.language ? { name: `idioma:${lead.language}` } : null, consentTag].filter(Boolean);
  const leadBase: any = {
    name: `Atendimento Online — ${lead.name}`,
    ...(pipelineId ? { pipeline_id: pipelineId } : {}),
    ...(statusId ? { status_id: statusId } : {}),
    ...(leadCFV.length ? { custom_fields_values: leadCFV } : {}),
  };

  // Deduplicação: se já existe um contacto com este telemóvel, criamos apenas
  // um NOVO lead ligado a esse contacto. Caso contrário, criamos lead + contacto.
  const existingContactId = lead.phone ? await findContactIdByPhone(subdomain, token, lead.phone).catch(() => undefined) : undefined;
  let url: string;
  let body: any[];
  if (existingContactId) {
    url = `https://${subdomain}.kommo.com/api/v4/leads`;
    body = [{ ...leadBase, _embedded: { contacts: [{ id: existingContactId }], tags } }];
  } else {
    url = `https://${subdomain}.kommo.com/api/v4/leads/complex`;
    body = [{ ...leadBase, _embedded: { contacts: [{ first_name: first, last_name: last, custom_fields_values: contactCFV }], tags } }];
  }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!res.ok) { const txt = await res.text().catch(() => res.statusText); throw new Error(`Kommo error ${res.status}: ${txt}`); }
  const data = await res.json().catch(() => null);
  const lead_id = Array.isArray(data) ? data[0]?.id : data?._embedded?.leads?.[0]?.id;
  return { ok: true, lead_id };
}

/**
 * Marca um lead existente como "venda ganha" (usado quando o link de pagamento
 * foi enviado a partir do próprio Kommo). Não cria lead/contacto novo.
 */
export async function markKommoLeadWon(leadId: number): Promise<{ ok: boolean }> {
  if (!leadId) return { ok: false };
  if (TRANSPORT === 'zapier') {
    const hook = Deno.env.get('ZAPIER_KOMMO_HOOK_URL');
    if (hook) await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'won', lead_id: leadId }) });
    return { ok: true };
  }
  const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
  const token = Deno.env.get('KOMMO_LONG_LIVED_TOKEN');
  if (!subdomain || !token) throw new Error('KOMMO_SUBDOMAIN/KOMMO_LONG_LIVED_TOKEN nao configurados');
  const pipelineId = Number(Deno.env.get('KOMMO_PIPELINE_ID') || 0) || undefined;
  const body = { status_id: wonStatusId(), ...(pipelineId ? { pipeline_id: pipelineId } : {}) };
  const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!res.ok) { const txt = await res.text().catch(() => res.statusText); throw new Error(`Kommo won ${res.status}: ${txt}`); }
  return { ok: true };
}

/** Acrescenta uma nota e etiquetas a um lead existente (ex.: respostas da pré-qualificação). */
export async function updateKommoLead(leadId: number, note: string, tags: string[]): Promise<void> {
  const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
  const token = Deno.env.get('KOMMO_LONG_LIVED_TOKEN');
  if (!subdomain || !token || !leadId) throw new Error('KOMMO_SUBDOMAIN/KOMMO_LONG_LIVED_TOKEN nao configurados');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.kommo.com/api/v4/leads`;
  if (tags.length) await fetch(`${base}/${leadId}`, { method: 'PATCH', headers: h, body: JSON.stringify({ _embedded: { tags: tags.map((name) => ({ name })) } }) });
  if (note) await fetch(`${base}/${leadId}/notes`, { method: 'POST', headers: h, body: JSON.stringify([{ note_type: 'common', params: { text: note } }]) });
}
