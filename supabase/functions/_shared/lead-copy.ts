// Textos legíveis das respostas da pré-qualificação (para e-mail da equipa e nota no Kommo).
export const TOPICS: Record<string, string> = {
  visto: 'Vir para Portugal / visto', residencia: 'Autorização de residência / renovação', familia: 'Reagrupamento familiar',
  nacionalidade: 'Nacionalidade portuguesa', documentos: 'NIF, NISS e primeiros documentos', empresa: 'Abrir empresa / contabilidade',
  irs: 'IRS / impostos', carta: 'Carta de condução / veículo', consular: 'Serviços consulares brasileiros', juridico: 'Problema jurídico / recurso', outro: 'Outro',
};
export const URGENCY: Record<string, string> = { urgente: 'Urgente (prazo ou notificação)', semanas: 'Nas próximas semanas', meses: 'Nos próximos meses', pesquisando: 'Só pesquisando' };
export const LOCATION: Record<string, string> = { portugal: 'Em Portugal', brasil: 'No Brasil', outro: 'Em outro país' };
export const CONSULTED: Record<string, string> = { nao: 'Não', nao_resolveu: 'Sim, mas não resolveu', comparando: 'Sim, está comparando' };
export const CONTACT: Record<string, string> = { whatsapp: 'WhatsApp', email: 'E-mail', ligacao: 'Ligação' };
export const label = (map: Record<string, string>, v?: string | null) => (v ? map[v] ?? v : '—');
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function leadSummary(l: any): string {
  return [
    `Nome: ${l.name}`, `WhatsApp: ${l.phone || '—'}`, `E-mail: ${l.email}`,
    `Autorizou contato (WhatsApp/e-mail): ${l.whatsapp_consent ? 'sim' : 'não'}`,
    `Assunto: ${label(TOPICS, l.topic)}`, `Urgência: ${label(URGENCY, l.urgency)}`, `Onde está: ${label(LOCATION, l.location)}`,
    `Já consultou outra empresa: ${label(CONSULTED, l.consulted_others)}`, `Prefere contato por: ${label(CONTACT, l.preferred_contact)}`,
    `Unidade: ${l.unit_slug || 'sem preferência'}`, `Idioma: ${l.language || '—'}`, `Página: ${l.page || '—'}`,
    l.message ? `Caso: ${l.message}` : '',
  ].filter(Boolean).join('\n');
}
