export interface LeadInput {
  name: string; email: string; phone: string;
  unit_slug?: string; language?: string; service_code?: string; message?: string; source?: string;
  nif?: string; won?: boolean;
  /** Etiquetas extra (ex.: etapa do formulário do site). */
  tags?: string[];
  /** Venda paga pelo site: valor do lead, Pagamento = Pago, Forma = TPA, Data de venda. */
  price?: number; paid?: boolean;
  /** Responsável no Kommo e campo "Próximo agendamento" (ISO). */
  responsible_user_id?: number; next_appointment?: string;
  /** Campo "Jurídico" = Consultoria (consultoria paga pelo site). */
  juridico_consultoria?: boolean;
  /** RGPD: autorizou contacto por WhatsApp (undefined = não perguntado, ex.: leads criados por outros fluxos). */
  whatsapp_consent?: boolean;
}
const TRANSPORT = Deno.env.get('KOMMO_TRANSPORT') || 'api';
// Funil "Canais digitais", onde caem os leads criados pelo site (KOMMO_PIPELINE_ID substitui).
const SITE_PIPELINE_ID = 12916319;
// IDs da conta sevenservices.kommo.com (lidos da API em 19/10/2026).
export const KOMMO_USERS = { anaKathlyn: 12535887 };
// Tipo de tarefa "Consultoria". ("Consultoria Online/Presencial" pertencem a outra integração e a API recusa-os.)
export const KOMMO_TASK = { consultoria: 3711031 };
const F = { juridico: 898761, pagamento: 887862, origem: 909033, formaPagamento: 909207, unidade: 907142, proximoAgendamento: 912142, dataVenda: 909222 };
const E = { juridicoConsultoria: 791089, pago: 783218, origemSite: 805722, tpa: 801915, unidade: { albufeira: 795892, faro: 795894, porto: 803224 } as Record<string, number> };
const unix = (iso?: string) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined);
/** Etiquetas de etapa do lead do site: só uma fica no lead de cada vez. */
export const SITE_STAGE = { incompleto: 'Site - Incompleto', qualificado: 'Site - Pré-qualificado', completo: 'Site - Completo', pago: 'Site - Pagamento', consultoria: 'Site - Consultoria paga' };
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
  const pipelineId = Number(Deno.env.get('KOMMO_PIPELINE_ID') || 0) || SITE_PIPELINE_ID;
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
  // Campos da conta: Origem = Site sempre; unidade, agendamento e dados do pagamento quando houver.
  leadCFV.push({ field_id: F.origem, values: [{ enum_id: E.origemSite }] });
  if (lead.unit_slug && E.unidade[lead.unit_slug]) leadCFV.push({ field_id: F.unidade, values: [{ enum_id: E.unidade[lead.unit_slug] }] });
  if (lead.next_appointment) leadCFV.push({ field_id: F.proximoAgendamento, values: [{ value: unix(lead.next_appointment) }] });
  if (lead.juridico_consultoria) leadCFV.push({ field_id: F.juridico, values: [{ enum_id: E.juridicoConsultoria }] });
  if (lead.paid) {
    leadCFV.push({ field_id: F.pagamento, values: [{ enum_id: E.pago }] });
    leadCFV.push({ field_id: F.formaPagamento, values: [{ enum_id: E.tpa }] });
    leadCFV.push({ field_id: F.dataVenda, values: [{ value: unix(new Date().toISOString()) }] });
  }
  const contactCFV: any[] = [];
  if (lead.phone) contactCFV.push({ field_code: 'PHONE', values: [{ enum_code: 'MOB', value: lead.phone }] });
  if (lead.email) contactCFV.push({ field_code: 'EMAIL', values: [{ enum_code: 'WORK', value: lead.email }] });
  // Uma etiqueta só, que diz de onde veio o lead e em que etapa está (ex.: "Site - Completo").
  const tags = (lead.tags?.length ? lead.tags : ['Site']).map((name) => ({ name }));
  // Sem "name": o Kommo numera o lead sozinho (Lead #12345); a equipa renomeia depois, se quiser.
  const leadBase: any = {
    ...(lead.price ? { price: Math.round(Number(lead.price)) } : {}),
    ...(lead.responsible_user_id ? { responsible_user_id: lead.responsible_user_id } : {}),
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

/** Acrescenta uma nota e troca etiquetas de um lead existente (ex.: etapa da pré-qualificação). */
export async function updateKommoLead(leadId: number, note: string, addTags: string[], removeTags: string[] = []): Promise<void> {
  const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
  const token = Deno.env.get('KOMMO_LONG_LIVED_TOKEN');
  if (!subdomain || !token || !leadId) throw new Error('KOMMO_SUBDOMAIN/KOMMO_LONG_LIVED_TOKEN nao configurados');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const base = `https://${subdomain}.kommo.com/api/v4/leads`;
  // tags_to_add / tags_to_delete mexem só nessas etiquetas e mantêm as outras (idioma, WhatsApp...).
  if (addTags.length || removeTags.length) {
    const r = await fetch(`${base}/${leadId}`, { method: 'PATCH', headers: h, body: JSON.stringify({ tags_to_add: addTags.map((name) => ({ name })), tags_to_delete: removeTags.map((name) => ({ name })) }) });
    if (!r.ok) throw new Error(`Kommo tags ${r.status}: ${await r.text().catch(() => '')}`);
  }
  if (note) await fetch(`${base}/${leadId}/notes`, { method: 'POST', headers: h, body: JSON.stringify([{ note_type: 'common', params: { text: note } }]) });
}

/** Cria uma tarefa (ex.: consultoria marcada) num lead, para o responsável indicado. */
export async function createKommoTask(leadId: number, t: { text: string; at: string; typeId: number; responsibleUserId: number }): Promise<void> {
  const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
  const token = Deno.env.get('KOMMO_LONG_LIVED_TOKEN');
  if (!subdomain || !token || !leadId) throw new Error('KOMMO_SUBDOMAIN/KOMMO_LONG_LIVED_TOKEN nao configurados');
  const body = [{ entity_id: leadId, entity_type: 'leads', text: t.text, complete_till: unix(t.at), task_type_id: t.typeId, responsible_user_id: t.responsibleUserId }];
  const r = await fetch(`https://${subdomain}.kommo.com/api/v4/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Kommo task ${r.status}: ${await r.text().catch(() => '')}`);
}
